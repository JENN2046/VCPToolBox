'use strict';

// Offline regressions: evaluate public source with synthetic state and mocked
// I/O. Never initialize plugins, load runtime configuration or call providers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inspect } = require('node:util');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const SENTINEL = 'SYNTHETIC_PRIVATE_VALUE';

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `source section: ${start}`);
  return source.slice(from, to);
}

function comfyBridge() {
  const source = read('Plugin/ChromeBridge/VCPChrome/webcore/comfyui-main-world-bridge.js');
  const context = { document: { addEventListener() {} } };
  vm.runInNewContext(source.slice(0, source.indexOf("    if (document.readyState === 'loading')")) +
    'globalThis.api = { serializeWidget, serializeNode, applyWidgetValue, setApp: app => { comfyApp = app; } }; })();', context);
  return context.api;
}

test('Comfy MAIN bridge redacts sensitive widgets, options and nested fields', async () => {
  const api = comfyBridge();
  for (const hint of [{ name: 'api_key' }, { label: 'access token' }, { type: 'password' },
    { inputEl: { type: 'password' } }, { options: { type: 'password' } }]) {
    const widget = { name: 'value', value: SENTINEL, options: { values: [SENTINEL] }, ...hint };
    const serialized = api.serializeWidget(widget, 0);
    assert.equal(serialized.sensitive, true);
    assert.ok(!JSON.stringify(serialized).includes(SENTINEL));
    const node = { id: 1, widgets: [widget] };
    api.setApp({ graph: { _nodes: [node], getNodeById: () => node } });
    await assert.rejects(api.applyWidgetValue({ nodeId: 1, widgetIndex: 0, value: 'new' }), /敏感/);
    assert.equal(widget.value, SENTINEL);
  }
  const nested = api.serializeWidget({ name: 'settings', value: { nested: [{ apiKey: SENTINEL, steps: 12 }] } }, 0);
  assert.ok(!JSON.stringify(nested).includes(SENTINEL));
  assert.equal(nested.value.nested[0].steps, 12);
  const node = api.serializeNode({ id: 1, title: 'API Key', widgets: [{ name: 'value', value: SENTINEL }] }, 0);
  assert.ok(!JSON.stringify(node).includes(SENTINEL));
  assert.equal(api.serializeWidget({ name: 'prompt', value: 'a landscape' }, 0).value, 'a landscape');
});

test('Comfy adapter redacts legacy DOM state in all snapshot views and blocks sensitive actions', async () => {
  const api = require('../Plugin/ChromeBridge/VCPChrome/webcore/comfyui-page-adapter');
  const state = { adapter: 'comfyui-litegraph', ready: true, nodes: [{ id: 1, type: 'fixture', widgets: [
    { index: 0, name: 'api_key', type: 'text', value: SENTINEL, options: { values: [SENTINEL] } },
    { index: 1, name: 'settings', value: { password: SENTINEL, steps: 20 } }
  ] }] };
  const document = { title: 'ComfyUI', getElementById: () => ({ textContent: JSON.stringify(state) }) };
  const window = { location: { port: '8188' } };
  for (const view of [api.buildSnapshot(document, window), api.createWidgetRecords(state), api.buildMarkdown(state)]) {
    assert.ok(!JSON.stringify(view).includes(SENTINEL));
  }
  await assert.rejects(api.execute('set_value', { target: 'comfy-widget-1-0', value: 'new' }, { document, window }),
    { code: 'SENSITIVE_FIELD_BLOCKED' });
});

function doubaoHarness(pathApi) {
  const source = read('Plugin/DoubaoGen/DoubaoGen.js');
  const writes = [];
  const root = pathApi === path.win32 ? 'C:\\synthetic-vcp' : '/synthetic-vcp';
  const code = section(source, 'function normalizeOutputFormat(', 'function normalizeDoubaoArgs(') +
    section(source, 'function isPathWithinBase(', '\n}') + '\n}\n' +
    section(source, 'async function saveImageToLocal(', 'function getCommandDesc(');
  const api = vm.runInNewContext(code + '\n({ normalizeOutputFormat, saveImageToLocal })', {
    path: pathApi, Buffer, PROJECT_BASE_PATH: root,
    crypto: { randomUUID: () => 'fixed-fixture-id' }, log() {},
    fs: { mkdir: async () => {}, writeFile: async (...args) => writes.push(args) },
    downloadImage: async () => ({ data: Buffer.from('fixture'), contentType: 'image/webp' }),
    VAR_HTTP_URL: 'http://example.test', SERVER_PORT: 1, IMAGESERVER_IMAGE_KEY: 'fixture'
  });
  return { api, writes, root };
}

for (const [label, pathApi] of [['POSIX', path.posix], ['Windows', path.win32]]) {
  test(`Doubao ${label} rejects path-like formats before I/O and writes images exclusively`, async () => {
    const { api, writes, root } = doubaoHarness(pathApi);
    for (const format of ['png/../../../modules/overwrite.js', 'png\\..\\..\\x.js', '../x', '/tmp/x', 'png:stream', {}, 42]) {
      assert.throws(() => api.normalizeOutputFormat(format), /output_format/);
      assert.equal(await api.saveImageToLocal(null, 'Zml4dHVyZQ==', format), null);
    }
    assert.equal(writes.length, 0);
    for (const format of ['png', 'jpeg', 'jpg', 'webp', ' PNG ']) {
      const saved = await api.saveImageToLocal(null, 'Zml4dHVyZQ==', format);
      assert.equal(pathApi.dirname(saved.localPath), pathApi.join(root, 'image', 'doubaogen'));
      assert.equal(writes.at(-1)[2].flag, 'wx');
    }
    const downloaded = await api.saveImageToLocal('https://example.test/image', null, 'png');
    assert.equal(downloaded.mimeType, 'image/webp');
  });
}

function ragHarness() {
  const source = read('Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js');
  const method = section(source, '    async _rerankDocumentsWithJev(', '    async _rerankDocuments(');
  return vm.runInNewContext(`({ ${method} })`, { console: quiet });
}

for (const [window, count, k, rrf] of [[2, 5, 5, null], [2, 5, 4, { alpha: 0.5 }], [255, 270, 260, null], [9, 5, 3, null]]) {
  test(`RAG Jev keeps unscored tail: window=${window}, count=${count}, k=${k}, rrf=${!!rrf}`, async () => {
    const rag = ragHarness();
    const documents = Array.from({ length: count }, (_, i) => ({ text: `fixture-${i}`, id: i, retrieval_rank: i + 1 }));
    const original = JSON.stringify(documents);
    rag.rerankConfig = { jevMaxChoices: window };
    rag.jevClient = { isConfigured: () => true, decide: async (_state, questions) => ({
      answers: { best_memory: { type: 'choice', choice: 'doc_001', confidence: 1,
        probabilities: Object.fromEntries(Object.keys(questions.best_memory.criteria).map((key, i) => [key, i === 1 ? 1 : 0])) } }
    }) };
    const result = await rag._rerankDocumentsWithJev('fixture', documents, k, rrf);
    assert.equal(result.length, Math.min(count, k));
    assert.equal(new Set(result.map(doc => doc.id)).size, result.length);
    if (!rrf) assert.equal(result[0].id, 1);
    assert.deepEqual(Array.from(result.slice(window), doc => doc.id), documents.slice(window, k).map(doc => doc.id));
    assert.equal(JSON.stringify(documents), original);
    rag.jevClient.decide = async () => { throw new Error('synthetic failure'); };
    assert.deepEqual(await rag._rerankDocumentsWithJev('fixture', documents, k), documents.slice(0, k));
  });
}

test('Jev request errors expose status/retry metadata, never response bodies, transport text or Axios causes', () => {
  const { JevClient } = require('../modules/jevClient');
  const client = new JevClient();
  for (const data of [SENTINEL, { requestEcho: SENTINEL }, { toJSON() { throw new Error('must not serialize'); } }]) {
    const original = Object.assign(new Error(SENTINEL), {
      response: { status: 429, data }, config: { headers: { Authorization: SENTINEL } }
    });
    const error = client._createRequestError(original, { provider: 'typesafe' });
    assert.equal(error.status, 429);
    assert.equal(error.retryable, true);
    assert.equal(error.code, 'JEV_HTTP_429');
    assert.equal(error.cause, undefined);
    assert.ok(!inspect(error, { depth: 10 }).includes(SENTINEL));
    assert.ok(!JSON.stringify(error).includes(SENTINEL));
  }
  const timeout = client._createRequestError({ message: SENTINEL, code: 'ETIMEDOUT', request: {} }, {});
  assert.equal(timeout.retryable, true);
  assert.equal(timeout.code, 'JEV_NETWORK_ERROR');
  assert.ok(!timeout.message.includes(SENTINEL));
  assert.throws(() => client._getProxyAgent(SENTINEL), error => {
    assert.equal(error.code, 'JEV_INVALID_PROXY_URL');
    assert.ok(!inspect(error, { depth: 10 }).includes(SENTINEL));
    return true;
  });
});

async function runMediaPipeline(mode, plus = true) {
  const source = read('modules/chatCompletionHandler.js');
  const pipeline = section(source, '      // --- 可排序消息处理管线 ---', '      let presenceOneRingMeta');
  const cleanup = section(source, '      // --- TransBase64+ Cleanup & Restore ---', '      // --- Detector / SuperDetector 后置处理 ---');
  const imageSource = read('Plugin/ImageProcessor/image-processor.js');
  const image = vm.runInNewContext(`({ ${section(imageSource, '    async processMessages(', '    async shutdown(')} })`, {
    pluginConfig: {}, mergeWithJsonStore: config => config,
    translateMediaAndCacheInternal: async () => 'synthetic description'
  });
  const media = id => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${id}` } });
  const result = await vm.runInNewContext(`(async () => { ${pipeline} ${cleanup} return processedMessages; })()`, {
    processedMessages: [{ role: 'user', content: [{ type: 'text', text: 'fixture' }, media('b3JpZ2luYWw=')] }],
    shouldProcessMedia: true, shouldProcessMediaPlus: plus,
    residentPresenceRequested: false, DEBUG_MODE: false, console: quiet,
    copyArrayMetadata: (_before, after) => after, requestPreprocessorConfig: {},
    pluginManager: {
      messagePreprocessors: new Map([['CapturePreprocessor', {}], ['ImageProcessor', {}]]),
      preprocessorOrder: ['CapturePreprocessor', 'ImageProcessor'],
      executeMessagePreprocessor: async (name, messages) => {
        if (name === 'CapturePreprocessor') { messages[0].content.push(media('Y2FwdHVyZQ==')); return messages; }
        if (mode === 'throw') throw new Error('synthetic processor failure');
        if (mode === 'noop') return messages;
        return image.processMessages(messages);
      }
    }
  });
  return JSON.parse(JSON.stringify(result));
}

for (const mode of ['translate', 'noop', 'throw']) {
  test(`TransBase64+ preserves original and captured images exactly once (${mode})`, async () => {
    const messages = await runMediaPipeline(mode);
    const images = messages[0].content.filter(part => part.type === 'image_url');
    assert.equal(images.length, 2);
    assert.equal(new Set(images.map(part => part.image_url.url)).size, 2);
    assert.ok(!JSON.stringify(messages).includes('synthetic description'));
    assert.equal(Object.hasOwn(messages[0], '__vcp_media_backup__'), false);
  });
}

test('ordinary TransBase64 keeps translated descriptions and does not restore media', async () => {
  const messages = await runMediaPipeline('translate', false);
  assert.equal(messages[0].content.filter(part => part.type === 'image_url').length, 0);
  assert.ok(JSON.stringify(messages).includes('synthetic description'));
});
