'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { discoverAdapterFactories } = require('../Plugin/ChannelHub/adapter-loader');
const AdapterRegistry = require('../Plugin/ChannelHub/core/AdapterRegistry');
const { ChannelHubService } = require('../Plugin/ChannelHub/core/ChannelHubService');

const quiet = { log() {}, info() {}, warn() {}, debug() {}, error() {} };
function tempPlugins(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'channelhub-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function adapter(root, name, channels, { entry = 'src/driver.mjs', version = 1, content = null } = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  if (content != null) fs.writeFileSync(path.join(dir, 'src/driver.mjs'), content);
  fs.writeFileSync(path.join(dir, 'channelhub-adapter.json'), JSON.stringify({
    apiVersion: version,
    channels,
    entryPoint: entry,
    exportName: 'ExampleAdapter'
  }));
  return dir;
}

test('public ESM API exposes one stable AdapterContract to every installed adapter', async () => {
  const api = await import('../Plugin/ChannelHub/api/adapter-api.mjs');
  assert.equal(api.ADAPTER_API_VERSION, 1);
  assert.equal(api.AdapterContract, require('../Plugin/ChannelHub/core/AdapterContract').AdapterContract);
  const adapters = [
    ['dingtalk', 'DingTalkAdapter'],
    ['wecom', 'WecomAdapter'],
    ['onebot', 'OneBotAdapter']
  ];
  for (const [platform, exportName] of adapters) {
    const descriptor = require('../Plugin/vcp-' + platform + '-adapter/channelhub-adapter.json');
    assert.equal(descriptor.apiVersion, api.ADAPTER_API_VERSION);
    const file = path.resolve(__dirname, '../Plugin/vcp-' + platform + '-adapter', descriptor.entryPoint);
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes('ChannelHub/api/adapter-api.mjs'));
    assert.ok(!source.includes('ChannelHub/core/'));
    const module = await import(pathToFileURL(file).href);
    assert.equal(Object.getPrototypeOf(module[exportName].prototype), api.AdapterContract.prototype);
  }
});

test('discovery is metadata-only and a declared adapter runs only on demand', async t => {
  const root = tempPlugins(t);
  const flag = path.join(root, 'executed.txt');
  adapter(root, 'driverA', ['example'], { content: `
    import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(flag)}, 'imported');
    export class ExampleAdapter {
      constructor(input) { this.input = input; this.started = false; }
      async initialize() { this.started = true; }
      async shutdown() { this.started = false; }
    }` });
  const resolver = await discoverAdapterFactories({ pluginsDir: root, logger: quiet });
  assert.equal(fs.existsSync(flag), false, 'discover must not import optional platform code');
  assert.equal(await resolver({ adapterId: 'none', channel: 'missing' }), null);
  const created = [];
  const service = new ChannelHubService({ logger: quiet, adapterResolver: resolver });
  service.adapterRegistry = { registerAdapterInstance: (id, instance) => created.push([id, instance]) };
  const instance = await service._createAdapterInstanceFromContract({
    adapterId: 'adapter-1', channel: 'example',
    config: { apiKey: 'synthetic-key' },
    capabilityProfile: { supportsText: true }
  });
  assert.ok(instance);
  assert.equal(instance.started, true);
  assert.equal(instance.input.metadata.id, 'adapter-1');
  assert.equal(instance.input.options.apiKey, 'synthetic-key');
  assert.equal(instance.input.metadata.capabilities.supportsText, true);
  assert.equal(fs.readFileSync(flag, 'utf8'), 'imported');
  assert.equal(created.length, 1);
  await instance.shutdown();
});

test('ambiguous platform registrations fail closed without blocking other channels', async t => {
  const root = tempPlugins(t);
  const driver = `export class ExampleAdapter { constructor(input) { this.input = input; } async initialize() {} }`;
  adapter(root, 'first', ['example', 'other'], { content: driver });
  adapter(root, 'second', ['example'], { content: driver });
  const resolver = await discoverAdapterFactories({ pluginsDir: root, logger: quiet });
  await assert.rejects(resolver({ channel: 'example' }), /CHANNELHUB_ADAPTER_CHANNEL_CONFLICT/);
  assert.ok(await resolver({ adapterId: 'ok', channel: 'other' }));
});

test('descriptor traversal and incompatible API versions never import code', async t => {
  const root = tempPlugins(t);
  adapter(root, 'unsafe', ['example'], { entry: '../outside.mjs' });
  adapter(root, 'future', ['future'], { version: 2 });
  const resolver = await discoverAdapterFactories({ pluginsDir: root, logger: quiet });
  assert.equal(await resolver({ channel: 'example' }), null);
  assert.equal(await resolver({ channel: 'future' }), null);
});

test('removing an optional adapter leaves ChannelHub discovery healthy', async t => {
  const root = tempPlugins(t);
  const folder = adapter(root, 'driverA', ['example'], { content: 'export class ExampleAdapter {}' });
  const first = await discoverAdapterFactories({ pluginsDir: root, logger: quiet });
  assert.ok(await first({ channel: 'example' }));
  fs.rmSync(folder, { recursive: true, force: true });
  const afterRemoval = await discoverAdapterFactories({ pluginsDir: root, logger: quiet });
  assert.equal(await afterRemoval({ channel: 'example' }), null);
});

test('AdapterRegistry stops runtime instances on disable, unregister and shutdown', async () => {
  let state = [];
  const store = {
    async getAdapters() { return { adapters: Object.fromEntries(state.map(a => [a.adapterId, a])) }; },
    async saveAdapters(next) { state = next.map(a => ({ ...a })); }
  };
  const registry = new AdapterRegistry({ stateStore: store, logger: quiet });
  await registry.initialize();
  await registry.upsertAdapter({ adapterId: 'one', channel: 'example', status: 'active' });
  let calls = 0;
  registry.registerAdapterInstance('one', { async shutdown() { calls++; } });
  await registry.disableAdapter('one');
  assert.equal(calls, 1);
  assert.equal(registry.getAdapterInstance('one'), null);
  assert.equal((await registry.getAdapter('one')).status, 'inactive');
  await registry.enableAdapter('one');
  registry.registerAdapterInstance('one', { async shutdown() { calls++; } });
  await registry.unregister('one');
  assert.equal(calls, 2);
  assert.equal(await registry.getAdapter('one'), null);
  registry.registerAdapterInstance('leftover', { async shutdown() { calls++; } });
  await registry.shutdownAllInstances();
  assert.equal(calls, 3);
  assert.equal(registry.getAdapterInstance('leftover'), null);
});

test('AdapterRegistry reports unclosed instances without stopping remaining cleanup', async () => {
  const registry = new AdapterRegistry({ stateStore: { getAdapters: async () => ({ adapters: {} }) }, logger: quiet });
  registry.registerAdapterInstance('bad', { async shutdown() { throw new Error('synthetic failure'); } });
  let goodClosed = 0;
  registry.registerAdapterInstance('good', { async shutdown() { goodClosed++; } });
  await assert.rejects(registry.shutdownAllInstances(), /CHANNELHUB_ADAPTER_SHUTDOWN_INCOMPLETE/);
  assert.equal(goodClosed, 1);
  assert.ok(registry.getAdapterInstance('bad'), 'retain failed shutdown for diagnosis');
  assert.equal(registry.getAdapterInstance('good'), null);
});
