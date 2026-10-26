'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const AdapterRegistry = require('../Plugin/ChannelHub/core/AdapterRegistry');
const admin = require('../Plugin/ChannelHub/routes/admin/channelHub');
const { ManagedAdapterHost } = require('../Plugin/ChannelHub/managed-adapters');
const { buildPatch } = require('../Plugin/ChannelHub/admin-config');

const logger = { log() {}, info() {}, warn() {}, error() {}, debug() {} };

async function setup(t) {
  let saved = [];
  const stateStore = {
    async getAdapters() { return { adapters: Object.fromEntries(saved.map(row => [row.adapterId, row])) }; },
    async saveAdapters(data) { saved = JSON.parse(JSON.stringify(data)); }
  };
  const registry = new AdapterRegistry({ stateStore, logger });
  await registry.initialize();
  const alias = new Map([['大肥鱼', 'Agent/bigfish.md'], ['摄影助手', 'Agent/photo.md']]);
  const agentManager = {
    agentMap: alias,
    isAgent(id) { return alias.has(id); }
  };
  const runtime = { agentManager, agents: {}, model: 'vcp-model-managed' };
  const service = {
    initialized: true,
    adapterRegistry: registry,
    runtimeGateway: runtime,
    getModule(name) { return this[name] || null; }
  };
  const resolver = () => {};
  resolver.supportsManaged = channel => channel === 'qq';
  const managedHost = new ManagedAdapterHost({ service, adapterResolver: resolver, logger });
  admin.initialize(service, managedHost);

  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/admin_api/channelHub', admin.router);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + '/admin_api/channelHub' + route, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }
  return { request, registry, runtime, managedHost };
}

test('ChannelHub admin uses live VCP Agent aliases and never exposes adapter credentials', async t => {
  const { request, registry } = await setup(t);
  let r = await request('/agents');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.agents.map(a => a.id), ['大肥鱼', '摄影助手'].sort((a,b)=>a.localeCompare(b,'zh-CN')));
  assert.equal(r.body.data.defaultModel, 'vcp-model-managed');

  r = await request('/adapters', 'POST', {
    adapterId: 'qq-main', channel: 'qq', status: 'inactive', name: 'QQ 测试',
    config: {
      agentId: '大肥鱼', wsUrl: 'ws://127.0.0.1:3001/',
      expectedQqId: '822022316', allowedUserIds: ['515292656'],
      accessToken: 'never-print-me', bridgeKey: 'secret-bridge-value-1234',
      nested: { clientSecret: 'nested-secret' }
    }
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.config.agentId, '大肥鱼');
  assert.equal(JSON.stringify(r.body).includes('never-print-me'), false);
  assert.equal(JSON.stringify(r.body).includes('secret-bridge-value'), false);
  assert.equal(JSON.stringify(r.body).includes('nested-secret'), false);
  assert.deepEqual(r.body.data.configuredSecrets, ['accessToken', 'bridgeKey']);

  for (const target of ['/adapters', '/adapters/qq-main']) {
    const result = await request(target);
    assert.equal(result.status, 200);
    assert.equal(JSON.stringify(result.body).includes('never-print-me'), false);
    assert.equal(JSON.stringify(result.body).includes('secret-bridge-value'), false);
    assert.equal(JSON.stringify(result.body).includes('nested-secret'), false);
  }
  const raw = await registry.getAdapter('qq-main');
  assert.equal(raw.config.accessToken, 'never-print-me', 'secret must still exist on the server');
  assert.equal(raw.config.nested.clientSecret, 'nested-secret');
});

test('editing QQ agent and allowed users preserves secrets, enforces optimistic edit and validates real Agent', async t => {
  const { request, registry } = await setup(t);
  let r = await request('/adapters', 'POST', {
    adapterId: 'qq-edit', channel: 'qq', config: {
      agentId: '大肥鱼', accessToken: 'untouched-secret',
      expectedQqId: '822022316', allowedUserIds: ['515292656']
    }
  });
  assert.equal(r.status, 201);
  const before = await request('/adapters/qq-edit');
  const version = before.body.data.updatedAt;

  r = await request('/adapters/qq-edit', 'PUT', {
    expectedUpdatedAt: version, name: '更换 Agent',
    config: { agentId: '摄影助手', allowedUserIds: ['515292656', '987654321'] }
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.config.agentId, '摄影助手');
  assert.equal(r.body.data.name, '更换 Agent');
  const raw = await registry.getAdapter('qq-edit');
  assert.equal(raw.config.accessToken, 'untouched-secret');
  assert.deepEqual(raw.config.allowedUserIds, ['515292656', '987654321']);

  const stale = await request('/adapters/qq-edit', 'PUT', {
    expectedUpdatedAt: version, config: { agentId: '大肥鱼' }
  });
  assert.equal(stale.status, 409);
  r = await request('/adapters/qq-edit', 'PUT', { config: { agentId: '不存在的Agent' } });
  assert.equal(r.status, 400);
  assert.equal((await registry.getAdapter('qq-edit')).config.agentId, '摄影助手');

  r = await request('/adapters/qq-edit', 'PUT', { status: 'active' });
  assert.equal(r.status, 400, 'enable/disable is a distinct authenticated operation');
  r = await request('/adapters', 'POST', { adapterId: 'qq-edit', channel: 'qq', config: {} });
  assert.equal(r.status, 409, 'POST cannot overwrite existing adapter');
});

test('active QQ channel switches Agent without stopping connection; connection edits require disable', async t => {
  const { request, registry } = await setup(t);
  await registry.upsertAdapter({
    adapterId: 'qq-live', channel: 'qq', status: 'active',
    config: { agentId: '大肥鱼', wsUrl: 'ws://127.0.0.1:3001/', accessToken: 'secret-to-keep' }
  });
  let shutdownCalls = 0;
  const running = { async shutdown() { shutdownCalls++; } };
  registry.registerAdapterInstance('qq-live', running);

  const before = await request('/adapters/qq-live');
  let r = await request('/adapters/qq-live', 'PUT', {
    expectedUpdatedAt: before.body.data.updatedAt,
    config: { agentId: '摄影助手' }
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await registry.getAdapter('qq-live')).config.agentId, '摄影助手');
  assert.equal((await registry.getAdapter('qq-live')).config.accessToken, 'secret-to-keep');
  assert.equal(shutdownCalls, 0, 'Agent switch must not interrupt NapCat connection');
  assert.equal(registry.getAdapterInstance('qq-live'), running);

  r = await request('/adapters/qq-live', 'PUT', {
    config: { allowedUserIds: ['515292656'] }
  });
  assert.equal(r.status, 409);
  r = await request('/adapters/qq-live', 'PUT', {
    name: '尝试热改名'
  });
  assert.equal(r.status, 409);
  assert.equal(shutdownCalls, 0);
  assert.equal((await registry.getAdapter('qq-live')).config.allowedUserIds, undefined);
});

test('unknown agent, malformed patch and unsafe keys fail before any update', async t => {
  const { request, registry } = await setup(t);
  const original = { adapterId: 'safe', channel: 'qq', status: 'inactive', config: { agentId: '大肥鱼' } };
  await registry.upsertAdapter(original);
  for (const patch of [
    { config: { agentId: '不存在的Agent' } },
    { config: { agentId: '' } },
    { name: '' },
    { adapterId: 'different', config: {} },
    { config: { constructor: { prototype: { polluted: true } } } }
  ]) {
    const response = await request('/adapters/safe', 'PUT', patch);
    assert.equal(response.status, 400, JSON.stringify(response.body));
  }
  assert.equal((await registry.getAdapter('safe')).config.agentId, '大肥鱼');

  assert.throws(() => buildPatch(original, { config: [] }, {}), /CHANNELHUB_CONFIG_INVALID_OBJECT/);
});

test('admin UI offers Edit, Agent select and masked connection settings', () => {
  const root = path.resolve(__dirname, '../Plugin/ChannelHub/ui');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(html, /id="adapterEditForm"/);
  assert.match(html, /id="editAgent"/);
  assert.match(html, /id="createAgent"/);
  assert.match(script, /\/agents/);
  assert.match(script, /method: 'PUT'/);
  assert.match(script, /测试连接/);
});
