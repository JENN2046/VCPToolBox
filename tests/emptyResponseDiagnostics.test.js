'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '..');
const baselineRoot = process.env.VCP_DIAGNOSTICS_BASELINE_DIR;
const EVENT = '[VCP_EMPTY_ASSISTANT_RESPONSE_DIAGNOSTIC] ';
const sse = (delta, finish_reason = null, space = true) => `data:${space ? ' ' : ''}${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;
const json = message => JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] });
const clone = value => JSON.parse(JSON.stringify(value));

async function run(handler, bodies, options = {}, baseline = false) {
  const calls = [], writes = [], events = [], fetches = [], states = [], logs = [];
  const timers = new Map();
  const consoleStub = { log() {}, error() {}, warn(line) { events.push(String(line)); } };
  const helperPath = path.join(root, 'modules/emptyResponseDiagnostics.js');
  const helperModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(helperPath, 'utf8'), { module: helperModule, console: consoleStub, Buffer });
  const Observer = helperModule.exports;
  class CapturedObserver extends Observer {
    constructor(...args) { super(...args); states.push(this); }
  }
  const filename = path.join(root, 'modules/handlers', handler === 'stream' ? 'streamHandler.js' : 'nonStreamHandler.js');
  const source = fs.readFileSync(baseline ? path.join(baselineRoot, path.relative(root, filename)) : filename, 'utf8');
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  class FixedDate extends Date { static now() { return 1700000000000; } }
  vm.runInNewContext(source, {
    module, Buffer, console: consoleStub, Date: FixedDate,
    setInterval(fn, delay) { const id = {}; timers.set(id, { fn, delay }); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout(fn, delay) { if (delay >= 90000) { const id = {}; timers.set(id, { fn, delay }); return id; } return setTimeout(fn, delay); },
    clearTimeout(id) { timers.delete(id); clearTimeout(id); },
    require(name) {
      if (name === '../emptyResponseDiagnostics') return CapturedObserver;
      if (name === '../../vcpInfoHandler.js') return { streamVcpInfo() { return ''; } };
      return localRequire(name);
    }
  }, { filename });
  const abortController = new AbortController();
  const req = { aborted: false };
  const res = {
    writableEnded: false, destroyed: false,
    write(chunk, callback) { writes.push(Buffer.from(chunk)); if (callback) callback(); return true; },
    end(chunk) { if (chunk) writes.push(Buffer.from(chunk)); this.writableEnded = true; },
    send(chunk) { this.end(chunk); }
  };
  // Exercise the real OneRing WithMeta -> compatibility wrapper without loading
  // its runtime/DB. Persistence itself is deliberately replaced by a test sink.
  const oneRingSource = fs.readFileSync(path.join(root, 'Plugin/OneRing/OneRing.js'), 'utf8');
  const wrapper = oneRingSource.match(/async recordAIResponseWithMeta\(meta, aiText\) \{[\s\S]*?\n    \}/)[0];
  const oneRing = vm.runInNewContext(`({ ${wrapper} })`);
  oneRing.recordAIResponse = async (meta, text) => { events.push('OneRing'); calls.push({ entry: 'meta', text }); };
  oneRing.recordAIResponseFromMessages = async (messages, text) => { events.push('OneRing'); calls.push({ entry: 'messages', text }); };
  const makeResponse = raw => {
    const status = options.status || 200;
    let body;
    if (handler === 'stream') {
      body = options.termination ? new Readable({ read() {} }) : Readable.from(Array.isArray(raw) ? raw : [Buffer.from(raw)]);
    }
    return { status, ok: status >= 200 && status < 300, body,
      headers: new Headers({ 'content-type': handler === 'stream' ? 'text/event-stream' : 'application/json' }),
      async arrayBuffer() { return Buffer.from(raw); }
    };
  };
  let responseIndex = 0;
  const context = {
    originalBody: { requestId: 'synthetic-request-1', model: 'synthetic-model', stream: handler === 'stream', messages: [] },
    abortController, pluginManager: { messagePreprocessors: new Map([['OneRing', oneRing]]) },
    oneRingResponseMeta: options.fallback ? null : { agentName: 'synthetic' },
    apiRetries: options.retries || 1, apiRetryDelay: 1,
    maxVCPLoopStream: 4, maxVCPLoopNonStream: 4,
    enableRoleDivider: options.roleDivider || false, enableRoleDividerInLoop: options.roleDivider || false,
    ToolCallParser: localRequire('../vcpLoop/toolCallParser'),
    toolExecutor: { async executeAll(toolCalls) { return toolCalls.map(() => ({ success: true, content: [{ type: 'text', text: 'synthetic-result' }] })); } },
    isToolResultError() { return false; },
    writeChatLog(request, turns) { logs.push(clone(turns)); },
    async fetchWithRetry(url, fetchOptions) { fetches.push(JSON.parse(fetchOptions.body)); responseIndex++; return makeResponse(bodies[Math.min(responseIndex, bodies.length - 1)]); }
  };
  const pending = new module.exports(context).handle(req, res, makeResponse(bodies[0]));
  if (options.termination === 'timeout') {
    [...timers.values()].find(timer => timer.delay === 90000).fn();
  } else if (options.termination) {
    if (options.termination === 'client_disconnect') { req.aborted = true; res.destroyed = true; }
    abortController.abort();
  }
  await pending;
  const warnings = events.filter(event => event.startsWith(EVENT)).map(event => JSON.parse(event.slice(EVENT.length)));
  return { output: Buffer.concat(writes).toString(), calls: clone(calls), fetches: clone(fetches), logs: clone(logs),
    warnings, events, states: states.map(state => clone(state)) };
}

async function check(handler, bodies, options = {}) {
  const result = await run(handler, bodies, options);
  if (baselineRoot) {
    const before = await run(handler, bodies, options, true);
    for (const key of ['output', 'calls', 'fetches', 'logs']) assert.deepEqual(result[key], before[key], `baseline ${key}`);
  }
  return result;
}

test('S1 standard SSE: bytes, callback and visible content unchanged; no WARN', async () => {
  const result = await check('stream', [sse({ content: 'hello' }) + 'data: [DONE]\n\n']);
  assert.equal(result.calls[0].text, 'hello');
  assert.equal(result.warnings.length, 0);
  assert.equal(result.states[0].delta.contentChars, 5);
});

test('S2 no-space SSE: observer sees content; production parser still ignores it', async () => {
  const result = await check('stream', [sse({ content: 'hello' }, null, false) + 'data:[DONE]\n\n']);
  const d = result.warnings[0];
  assert.equal(result.calls[0].text, '');
  assert.match(result.output, /hello/);
  assert.equal(d.sse.dataNoSpaceLines, 2);
  assert.equal(d.sse.observerOnlyJsonParseSuccess, 1);
  assert.equal(d.sse.parserJsonParseSuccess, 0);
  assert.equal(d.delta.contentChars, 5);
  assert.equal(d.delta.parserConsumedContentChars, 0);
  assert.equal(d.forwardedContentChars, 5);
  assert.equal(d.aggregation.finalOneRingTextChars, 0);
  assert.ok(result.events.indexOf('OneRing') > result.events.findIndex(event => event.startsWith(EVENT)));
});

for (const [name, delta, field, value] of [
  ['S3 reasoning only', { reasoning_content: 'private-reasoning-canary' }, 'reasoningChars', 24],
  ['S4 native tool only', { tool_calls: [{ function: { arguments: 'private-argument-canary' } }] }, 'toolCallsPresentCount', 1]
]) test(name, async () => {
  const result = await check('stream', [sse(delta) + 'data: [DONE]\n\n']);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].delta[field], field === 'reasoningChars' ? delta.reasoning_content.length : value);
  assert.equal(result.warnings[0].delta.contentChars, 0);
  assert.doesNotMatch(JSON.stringify(result.warnings), /private-reasoning-canary|private-argument-canary/);
});

test('S5 malformed JSON counted once; forwarded bytes and fallback unchanged', async () => {
  const result = await check('stream', ['data: {invalid-private-canary\n\ndata: [DONE]\n\n']);
  assert.equal(result.warnings[0].sse.jsonParseFailure, 1);
  assert.doesNotMatch(JSON.stringify(result.warnings), /invalid-private-canary/);
});

test('S6 DONE without content', async () => {
  const result = await check('stream', ['data: [DONE]\n\n']);
  assert.equal(result.warnings[0].termination, 'done');
  assert.equal(result.warnings[0].sse.doneLines, 1);
});

test('parse failures on nonempty stream remain counters only', async () => {
  const result = await check('stream', ['data: {broken\n\n' + sse({ content: 'visible' })]);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.states[0].sse.jsonParseFailure, 1);
});

test('split UTF-8 / CRLF / unterminated tail preserve output and counts', async () => {
  const raw = Buffer.from(sse({ content: '你好🌻' }).replaceAll('\n', '\r\n').trimEnd());
  const result = await check('stream', [Array.from(raw, byte => Buffer.from([byte]))]);
  assert.equal(result.calls[0].text, '你好🌻');
  assert.equal(result.states[0].delta.contentChars, 4);
  assert.equal(result.states[0].upstreamBytes, raw.length);
});

for (const [name, raw, expected, warning] of [
  ['normal', json({ content: 'hello' }), 'hello', false],
  ['empty', json({ content: '' }), '', true],
  ['reasoning', json({ content: '', reasoning_content: 'private-reasoning-canary' }), '', true],
  ['tool', json({ content: null, tool_calls: [{ function: { arguments: 'private-argument-canary' } }] }), '', true],
  ['invalid JSON fallback', 'invalid-private-canary', 'invalid-private-canary', false],
  ['valid JSON null fallback', 'null', 'null', false]
]) test(`non-stream ${name}`, async () => {
  const result = await check('non_stream', [raw]);
  assert.equal(result.calls[0].text, expected);
  assert.equal(result.warnings.length, Number(warning));
  assert.equal(result.states[0].responseBytes, Buffer.byteLength(raw));
  assert.equal(result.states[0].nonStream.jsonParseFailure, name === 'invalid JSON fallback' ? 1 : 0);
  if (warning) {
    assert.equal(result.warnings[0].clientVisibleContentChars, 0);
    assert.equal(result.warnings[0].nonStream.messageContentChars, 0);
  }
  assert.doesNotMatch(JSON.stringify(result.warnings), /private-reasoning-canary|private-argument-canary/);
});

test('non-stream semantic retries unchanged, counters cover all attempts', async () => {
  const result = await check('non_stream', [json({ content: '', reasoning_content: 'hidden' })], { retries: 3 });
  assert.equal(result.fetches.length, 2);
  assert.equal(result.warnings[0].responses, 3);
  assert.equal(result.warnings[0].nonStream.jsonParseSuccess, 3);
});

const toolRequest = '<<<[TOOL_REQUEST]>>>\ntool_name:「始」SyntheticTool「末」\n<<<[END_TOOL_REQUEST]>>>';
for (const handler of ['stream', 'non_stream']) test(`${handler}: real VCP parser/tool-loop/RoleDivider contract unchanged`, async () => {
  const bodies = handler === 'stream' ? [sse({ content: toolRequest }), sse({ content: 'tool completed' })] : [json({ content: toolRequest }), json({ content: 'tool completed' })];
  const result = await check(handler, bodies, { roleDivider: true });
  assert.equal(result.fetches.length, 1);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0].text, /tool completed/);
  assert.equal(result.states[0].aggregation.assistantTurnPartCount, 2);
  assert.equal(result.warnings.length, 0);
});

for (const termination of ['abort', 'timeout', 'client_disconnect']) test(`stream ${termination}: classification without changing existing final handoff`, async () => {
  const result = await check('stream', [''], { termination });
  assert.equal(result.warnings[0].termination, termination);
  assert.equal(result.calls[0].text, '');
});

for (const handler of ['stream', 'non_stream']) test(`${handler}: OneRing message-extraction fallback unchanged`, async () => {
  const result = await check(handler, [handler === 'stream' ? 'data: [DONE]\n\n' : json({ content: '' })], { fallback: true });
  assert.equal(result.calls[0].entry, 'messages');
  assert.equal(result.warnings.length, 1);
});

test('explicit provider HTTP or error envelope is not mislabeled empty success', async () => {
  for (const handler of ['stream', 'non_stream']) {
    const raw = handler === 'stream' ? 'data: {"error":{"message":"private-error-canary"}}\n\n' : '{"error":{"message":"private-error-canary"}}';
    const result = await check(handler, [raw], { status: 500 });
    assert.equal(result.warnings.length, 0);
  }
});

test('missing finish signal classifies EOF; unknown finish reason never leaks text', async () => {
  const eof = await check('stream', ['']);
  assert.equal(eof.warnings[0].termination, 'provider_eof');
  const finish = await check('stream', [sse({}, 'private-finish-canary')]);
  assert.equal(finish.warnings[0].termination, 'finish_reason');
  assert.equal(finish.warnings[0].finishReasonSeen, 'other');
  assert.doesNotMatch(JSON.stringify(finish.warnings), /private-finish-canary/);
});

test('empty spaced data line is classified before whitespace trimming', async () => {
  const result = await check('stream', ['data: \n\ndata: [DONE]\n\n']);
  assert.equal(result.warnings[0].sse.dataSpaceLines, 2);
  assert.equal(result.warnings[0].sse.dataNoSpaceLines, 0);
});

test('helper retains only scalar diagnostics and emits at most once even if logger throws', () => {
  const module = { exports: {} };
  let calls = 0;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'modules/emptyResponseDiagnostics.js'), 'utf8'), {
    module, console: { warn() { calls++; throw new Error('synthetic logging failure'); } }
  });
  const d = new module.exports('stream', { requestId: 123, model: 'synthetic-model' }, { status: 200 });
  const raw = { choices: [{ delta: { reasoning_content: 'private-retention-canary', tool_calls: [{ arguments: 'private-tool-canary' }] } }] };
  d.streamParsed(raw, true, false);
  const stateSize = JSON.stringify(d).length;
  for (let i = 0; i < 10000; i++) d.streamParsed(raw, true, false);
  assert.ok(JSON.stringify(d).length < stateSize + 100);
  assert.doesNotMatch(JSON.stringify(d), /private-retention-canary|private-tool-canary/);
  assert.doesNotThrow(() => d.finalize('', [], '', {}));
  assert.doesNotThrow(() => d.finalize('', [], '', {}));
  assert.equal(calls, 1);
  assert.equal(d.requestId, 123);
});
