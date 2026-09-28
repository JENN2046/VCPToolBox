'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const { createDefaultExecutionBridgeRegistry } = require('../modules/pluginBridgeRegistry');
const createDailyNotesRouter = require('../routes/dailyNotesRoutes');
const { injectStaticPluginPlaceholdersInMessages } = require('../modules/messageProcessor');

function noteHandler(root) {
  const router = createDailyNotesRouter(root, false);
  return router.stack.find(layer => (
    layer.route?.path === '/note/:folderName/:fileName' && layer.route.methods.post
  )).route.stack[0].handle;
}

function noteResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('hybrid direct bridge preserves a resident presentation callback', async () => {
  const presentationSink = () => {};
  const plugin = {
    name: 'AGENTSOSResident',
    pluginType: 'hybridservice',
    communication: { protocol: 'direct' },
    requiresAdmin: false
  };
  const serviceModule = { processToolCall: async (_args, directContext) => directContext };
  const context = {
    toolName: plugin.name,
    requestIp: '127.0.0.1',
    sourceNode: 'test',
    emitEphemeralPresentation: presentationSink,
    debugLog: () => {},
    getServiceModule: () => serviceModule,
    executeDirectWithTimeout: async (_plugin, _name, module, args, directContext) => (
      module.processToolCall(args, directContext)
    )
  };

  const output = await createDefaultExecutionBridgeRegistry().execute(plugin, {}, context);
  assert.equal(output.result.emitEphemeralPresentation, presentationSink);
  assert.equal(Object.keys(output.result).includes('emitEphemeralPresentation'), false);
});

test('failed note rename removes the new destination and permits retry', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-note-rename-'));
  const folder = path.join(root, 'notes');
  const original = path.join(folder, 'old.txt');
  const destination = path.join(folder, 'new.txt');
  const unlink = fs.promises.unlink;
  const unlinkCalls = [];
  try {
    fs.mkdirSync(folder);
    fs.writeFileSync(original, 'original');
    const router = createDailyNotesRouter(root, false);
    const handler = router.stack.find(layer => (
      layer.route?.path === '/note/:folderName/:fileName' && layer.route.methods.post
    )).route.stack[0].handle;
    const request = {
      params: { folderName: 'notes', fileName: 'old.txt' },
      body: { content: 'edited', newFileName: 'new.txt' }
    };
    const response = () => ({
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    });

    fs.promises.unlink = async file => {
      unlinkCalls.push(file);
      if (file === original) throw Object.assign(new Error('locked'), { code: 'EPERM' });
      return unlink(file);
    };
    const failed = response();
    await handler(request, failed);
    assert.equal(failed.statusCode, 500);
    assert.deepEqual(unlinkCalls, [original, destination]);
    assert.equal(fs.readFileSync(original, 'utf8'), 'original');
    assert.equal(fs.existsSync(destination), false);

    fs.promises.unlink = unlink;
    const retried = response();
    await handler(request, retried);
    assert.equal(retried.statusCode, 200);
    assert.equal(fs.existsSync(original), false);
    assert.equal(fs.readFileSync(destination, 'utf8'), 'edited');
  } finally {
    fs.promises.unlink = unlink;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Doubao image alt text escapes HTML attribute metacharacters', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Plugin/DoubaoGen/DoubaoGen.js'), 'utf8');
  const helper = source.match(/function escapeHtml\(str\) \{[\s\S]*?\n\}/u)?.[0];
  assert.ok(helper, 'escapeHtml helper must exist');
  const escapeHtml = vm.runInNewContext(`${helper}\nescapeHtml`);
  assert.equal(escapeHtml('A & "<tag>'), 'A &amp; &quot;&lt;tag&gt;');
});

test('static placeholders expand only in system-like user messages', async () => {
  const markers = ['[系统提示:]', '[系统邀请指令:]', '[系统通知:]', '[系统通知]'];
  const messages = [
    { role: 'system', content: '{{STATIC}}' },
    ...markers.map(marker => ({ role: 'user', content: `${marker} {{STATIC}}` })),
    { role: 'user', content: '{{STATIC}}' },
    { role: 'user', content: [{ type: 'text', text: '[系统提示:] {{STATIC}}' }] }
  ];
  await injectStaticPluginPlaceholdersInMessages(messages, {
    pluginManager: { getAllPlaceholderValues: () => new Map([['STATIC', 'expanded']]) }
  });
  assert.equal(messages[0].content, 'expanded');
  for (const message of messages.slice(1, 5)) assert.match(message.content, /expanded$/);
  assert.equal(messages[5].content, '{{STATIC}}');
  assert.equal(messages[6].content[0].text, '[系统提示:] expanded');
});

test('VCPSleep triggers a parallel dream only for a valid sleep duration', async () => {
  const plugin = { name: 'VCPSleep', pluginType: 'synchronous', communication: { protocol: 'stdio' } };
  const triggered = [];
  const context = {
    toolName: 'VCPSleep', requestIp: '127.0.0.1', executionOptions: {},
    debugLog: () => {}, debugWarn: () => {},
    triggerSleepDream: (_plugin, args) => triggered.push(args),
    executeStdio: async () => ({ status: 'success', result: '{}' })
  };
  const bridge = createDefaultExecutionBridgeRegistry();
  await bridge.execute(plugin, { sleepTime: 'invalid' }, context);
  await bridge.execute(plugin, { sleepTime: '0s' }, context);
  await bridge.execute(plugin, { sleepTime: '13h' }, context);
  assert.equal(triggered.length, 0);
  await bridge.execute(plugin, { sleepTime: '30s' }, context);
  assert.equal(triggered.length, 1);
});

test('concurrent note renames cannot overwrite the same destination', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-note-race-'));
  try {
    const folder = path.join(root, 'notes');
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'a.txt'), 'a');
    fs.writeFileSync(path.join(folder, 'b.txt'), 'b');
    const handler = noteHandler(root);
    const responses = [noteResponse(), noteResponse()];
    await Promise.all(['a.txt', 'b.txt'].map((fileName, index) => handler({
      params: { folderName: 'notes', fileName },
      body: { content: fileName, newFileName: 'final.txt' }
    }, responses[index])));
    assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 409]);
    const winner = fs.readFileSync(path.join(folder, 'final.txt'), 'utf8');
    assert.ok(['a.txt', 'b.txt'].includes(winner));
    const loser = winner === 'a.txt' ? 'b.txt' : 'a.txt';
    assert.equal(fs.readFileSync(path.join(folder, loser), 'utf8'), loser[0]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('case-only note rename keeps edited content', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-note-case-'));
  try {
    const folder = path.join(root, 'notes');
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'Note.txt'), 'old');
    const response = noteResponse();
    await noteHandler(root)({
      params: { folderName: 'notes', fileName: 'Note.txt' },
      body: { content: 'edited', newFileName: 'note.txt' }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(fs.readFileSync(path.join(folder, 'note.txt'), 'utf8'), 'edited');
    assert.equal(fs.readdirSync(folder).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('case-only note rename restores the original if cleanup fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-note-case-rollback-'));
  const originalUnlink = fs.promises.unlink;
  try {
    const folder = path.join(root, 'notes');
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'Note.txt'), 'original');
    // This path is distinct only on a case-sensitive filesystem; the rollback
    // branch is exercised on Windows where both names resolve to one file.
    if (process.platform !== 'win32') return;
    let holdingUnlinks = 0;
    fs.promises.unlink = async file => {
      if (path.basename(file).startsWith('.vcp-rename-') && holdingUnlinks++ === 0) {
        throw Object.assign(new Error('locked holding file'), { code: 'EPERM' });
      }
      return originalUnlink(file);
    };
    const response = noteResponse();
    await noteHandler(root)({
      params: { folderName: 'notes', fileName: 'Note.txt' },
      body: { content: 'edited', newFileName: 'note.txt' }
    }, response);
    assert.equal(response.statusCode, 500);
    assert.equal(fs.readFileSync(path.join(folder, 'Note.txt'), 'utf8'), 'original');
    assert.deepEqual(fs.readdirSync(folder), ['Note.txt']);
  } finally {
    fs.promises.unlink = originalUnlink;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Doubao model discovery sends its credential only to the configured endpoint origin', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../Plugin/DoubaoGen/DoubaoGen.js'), 'utf8');
  const discovery = source.match(/async function discoverFallbackModel\([\s\S]*?\n\}/u)?.[0];
  const listModels = source.match(/async function handleListModels\([\s\S]*?\n\}/u)?.[0];
  for (const method of [discovery, listModels]) {
    assert.ok(method);
    assert.match(method, /protocol: apiProtocol,[\s\S]*?hostname: apiBaseHost,[\s\S]*?port: apiBasePort/u);
    assert.doesNotMatch(method, /hostname: 'ark\.cn-beijing\.volces\.com'/u);
  }
  let request;
  const discover = vm.runInNewContext(`${discovery}\ndiscoverFallbackModel`, {
    loadModelCache: () => null,
    log: () => {},
    apiKeyPool: { getNextKey: () => ({ key: 'test-key' }), markSuccess: () => {} },
    netRequest: async options => {
      request = options;
      return { statusCode: 200, body: { data: [{ id: 'seedream-test' }] } };
    },
    apiProtocol: 'http:', apiBaseHost: 'relay.example.test', apiBasePort: 18765,
    apiModelsPath: '/api/v3/models', saveModelCache: () => {}
  });
  assert.equal(await discover(new Set()), 'seedream-test');
  assert.equal(request.protocol, 'http:');
  assert.equal(request.hostname, 'relay.example.test');
  assert.equal(request.port, 18765);
  assert.equal(request.headers.Authorization, 'Bearer test-key');
});

test('DreamWave narrows public diary files before native TopK', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-dream-scope-'));
  const previousRoot = process.env.KNOWLEDGEBASE_ROOT_PATH;
  const modulePath = require.resolve('../Plugin/AgentDream/DreamWaveEngine');
  try {
    fs.mkdirSync(path.join(root, 'Nova'));
    fs.mkdirSync(path.join(root, '公共共享'));
    fs.writeFileSync(path.join(root, 'Nova', 'own.md'), '[2026-03-23] - Nova\nOwn');
    fs.writeFileSync(path.join(root, '公共共享', 'other.md'), '[2026-03-23] - Other\nOther');
    fs.writeFileSync(path.join(root, '公共共享', 'shared.md'), '[2026-03-23] - Nova\nShared');
    process.env.KNOWLEDGEBASE_ROOT_PATH = root;
    delete require.cache[modulePath];
    const DreamWaveEngine = require(modulePath);
    let queryOptions;
    const kb = {
      db: { prepare: () => ({ all: () => [
        { id: 1, path: 'Nova/own.md' },
        { id: 2, path: '公共共享/other.md' },
        { id: 3, path: '公共共享/shared.md' }
      ] }) },
      executeNativeRiverQuery: async (_query, options) => {
        queryOptions = options;
        return { results: [] };
      }
    };
    const dream = new DreamWaveEngine(kb);
    dream._getSearchableIndexNames = () => ['Nova', '公共共享'];
    await dream._recallForVector('Nova', new Float32Array([1]), 2);
    assert.deepEqual(queryOptions.fileIdFilter, [1, 3]);
  } finally {
    if (previousRoot === undefined) delete process.env.KNOWLEDGEBASE_ROOT_PATH;
    else process.env.KNOWLEDGEBASE_ROOT_PATH = previousRoot;
    delete require.cache[modulePath];
    fs.rmSync(root, { recursive: true, force: true });
  }
});
