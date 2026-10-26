'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const { ManagedAdapterHost } = require('../Plugin/ChannelHub/managed-adapters');
const { discoverAdapterFactories } = require('../Plugin/ChannelHub/adapter-loader');
const { ChannelHubService } = require('../Plugin/ChannelHub/core/ChannelHubService');

const qqSelf = '123456789', allowedUser = '987654321', allowedGroup = '111111111';
const quiet = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label, tries = 150) {
  for (let i = 0; i < tries; i++) {
    if (predicate()) return;
    await sleep(15);
  }
  assert.fail('Timed out waiting for ' + label);
}

async function mockNapCat(t) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const state = { connections: 0, api: [], sockets: new Set(), token: 'synthetic-token-12345' };
  server.on('connection', (socket, req) => {
    assert.equal(req.headers.authorization, 'Bearer ' + state.token);
    state.connections++;
    state.sockets.add(socket);
    socket.on('close', () => state.sockets.delete(socket));
    socket.on('message', bytes => {
      const request = JSON.parse(String(bytes));
      state.api.push(request);
      let data;
      if (request.action === 'get_login_info') data = { user_id: Number(qqSelf), nickname: 'Nobao' };
      else if (['send_private_msg', 'send_group_msg'].includes(request.action)) data = { message_id: state.api.length + 8000 };
      else data = {};
      socket.send(JSON.stringify({ status: 'ok', retcode: 0, echo: request.echo, data }));
    });
  });
  t.after(async () => {
    for (const socket of state.sockets) socket.terminate();
    await new Promise(resolve => server.close(resolve));
  });
  return {
    url: 'ws://127.0.0.1:' + server.address().port + '/',
    state,
    send(event) {
      for (const socket of state.sockets) socket.send(JSON.stringify(event));
    },
    closeConnections() {
      for (const socket of state.sockets) socket.close(1012, 'synthetic reconnect');
    }
  };
}
function qqMessage(messageId, { userId = allowedUser, groupId = null, at = null, selfId = qqSelf } = {}) {
  const group = groupId != null;
  return {
    post_type: 'message',
    message_type: group ? 'group' : 'private',
    sub_type: 'friend',
    self_id: Number(selfId), user_id: Number(userId),
    ...(group ? { group_id: Number(groupId) } : {}),
    message_id: messageId, time: 1700000000,
    sender: { user_id: Number(userId), nickname: 'QQ friend', role: 'admin' },
    message: [...(at ? [{ type: 'at', data: { qq: at } }] : []), { type: 'text', data: { text: 'ping' } }]
  };
}
function accountConfig(wsUrl, override = {}) {
  return {
    wsUrl,
    accessToken: 'synthetic-token-12345',
    expectedQqId: qqSelf,
    allowedUserIds: [allowedUser],
    allowedGroupIds: [allowedGroup],
    agentId: 'synthetic-agent',
    ...override
  };
}
async function setupHub(t, runtimeGateway, diagnostics = quiet) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'qqpersonal-hub-'));
  const service = new ChannelHubService({
    logger: diagnostics,
    runtimeGateway,
    config: {
      baseDir: data, deliveryMode: 'inline',
      enforceAdapterIdentity: true, CHANNEL_HUB_AUTH_MODE: 'enforce',
      mediaStoragePath: path.join(data, 'media'),
      auditLogDir: path.join(data, 'audit')
    }
  });
  await service.initialize();
  const resolver = await discoverAdapterFactories({ pluginsDir: path.resolve(__dirname, '../Plugin'), logger: diagnostics });
  service.adapterResolver = resolver;
  const host = new ManagedAdapterHost({ service, adapterResolver: resolver, logger: diagnostics });
  t.after(async () => {
    host.beginDrain();
    await service.shutdown();
    fs.rmSync(data, { recursive: true, force: true });
  });
  return { service, host, resolver };
}

test('one NapCat WS does inbound QQ -> ChannelHub -> Agent -> outbound private and group replies', async t => {
  const napcat = await mockNapCat(t);
  const observed = [];
  const { service, host } = await setupHub(t, {
    async invoke(envelope, route) {
      observed.push({ envelope, route });
      return { messages: [{ role: 'assistant', content: [{ type: 'text', text: '诺宝回复' }] }] };
    }
  }, { ...quiet, error: (...args) => console.error('[QQManagedTest]', ...args) });
  await service.adapterRegistry.upsertAdapter({
    adapterId: 'qq-personal', channel: 'qq', status: 'active',
    config: accountConfig(napcat.url)
  });
  await host.startActive();
  const instance = service.adapterRegistry.getAdapterInstance('qq-personal');
  assert.ok(instance, 'the active adapter should have been started');
  assert.equal(napcat.state.connections, 1);
  assert.equal(instance.getMetadata().channel, 'qq');

  napcat.send(qqMessage(100, { userId: '888888888' }));
  napcat.send(qqMessage(101, { userId: qqSelf }));
  napcat.send(qqMessage(102, { groupId: allowedGroup, at: 'all' }));
  napcat.send(qqMessage(103, { groupId: '222222222', at: qqSelf }));
  await sleep(100);
  assert.equal(observed.length, 0, 'unauthorized users, self and @all must not trigger VCP');

  napcat.send(qqMessage(104));
  await until(() => napcat.state.api.some(x => x.action === 'send_private_msg'), 'private reply');
  assert.equal(observed.length, 1);
  assert.equal(observed[0].route.agentId, 'synthetic-agent');
  assert.equal(observed[0].envelope.sender.isAdmin, false, 'QQ admins are not VCP administrators');
  const privateSend = napcat.state.api.find(x => x.action === 'send_private_msg');
  assert.equal(String(privateSend.params.user_id), allowedUser);
  assert.ok(JSON.stringify(privateSend.params.message).includes('诺宝回复'));

  napcat.send(qqMessage(104));
  await sleep(100);
  assert.equal(observed.length, 1, 'duplicate message must not re-execute AI');

  napcat.send(qqMessage(105, { groupId: allowedGroup, at: qqSelf }));
  await until(() => napcat.state.api.some(x => x.action === 'send_group_msg'), 'group reply');
  assert.equal(observed.length, 2);
  const groupSend = napcat.state.api.find(x => x.action === 'send_group_msg');
  assert.equal(String(groupSend.params.group_id), allowedGroup);
  assert.equal(napcat.state.connections, 1, 'the same socket handles both directions');
  await service.adapterRegistry.disableAdapter('qq-personal');
  assert.equal(service.adapterRegistry.getAdapterInstance('qq-personal'), null);
  await sleep(1250);
  assert.equal(napcat.state.connections, 1, 'manual stop cannot auto-reconnect');
});

test('same QQ conversation is FIFO while replies still share the same WebSocket', async t => {
  const napcat = await mockNapCat(t);
  const timeline = [];
  const { service, host } = await setupHub(t, {
    async invoke(envelope) {
      const id = String(envelope.client.messageId);
      timeline.push('start:' + id);
      if (id === '201') await sleep(120);
      timeline.push('end:' + id);
      return { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'reply ' + id }] }] };
    }
  });
  await service.adapterRegistry.upsertAdapter({
    adapterId: 'qq-fifo', channel: 'qq', status: 'active', config: accountConfig(napcat.url)
  });
  await host.startActive();
  assert.ok(service.adapterRegistry.getAdapterInstance('qq-fifo'));
  napcat.send(qqMessage(201));
  napcat.send(qqMessage(202));
  await until(() => napcat.state.api.filter(x => x.action === 'send_private_msg').length === 2, 'two ordered replies');
  assert.deepEqual(timeline, ['start:201', 'end:201', 'start:202', 'end:202']);
  const replies = napcat.state.api.filter(x => x.action === 'send_private_msg').map(x => JSON.stringify(x.params.message));
  assert.match(replies[0], /reply 201/);
  assert.match(replies[1], /reply 202/);
  assert.equal(napcat.state.connections, 1);
});

test('online QQ Agent switch routes the next message to a different native VCP Agent without reconnecting', async t => {
  const napcat = await mockNapCat(t);
  const observed = [];
  const { service, host } = await setupHub(t, {
    async invoke(envelope, route) {
      observed.push(route.agentId);
      return { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'reply-' + route.agentId }] }] };
    }
  });
  await service.adapterRegistry.upsertAdapter({
    adapterId: 'qq-native-agent', channel: 'qq', status: 'active',
    config: accountConfig(napcat.url, { agentId: '大肥鱼' })
  });
  await host.startActive();
  const socketOwner = service.adapterRegistry.getAdapterInstance('qq-native-agent');
  assert.ok(socketOwner);
  napcat.send(qqMessage(410));
  await until(() => napcat.state.api.some(x => x.action === 'send_private_msg'), 'original Agent reply');
  assert.deepEqual(observed, ['大肥鱼']);
  const startConnections = napcat.state.connections;
  await host.update('qq-native-agent', { config: { agentId: '摄影助手' } });
  assert.equal(service.adapterRegistry.getAdapterInstance('qq-native-agent'), socketOwner);
  napcat.send(qqMessage(411));
  await until(() => napcat.state.api.filter(x => x.action === 'send_private_msg').length === 2, 'new Agent reply');
  assert.deepEqual(observed, ['大肥鱼', '摄影助手']);
  assert.equal(napcat.state.connections, startConnections);
  const bindings = await service.sessionBindingStore.list({ adapterId: 'qq-native-agent' });
  assert.ok(bindings.some(record => record.agentId === '摄影助手'),
    'persisted session binding should reflect the new Agent');
  assert.equal(JSON.stringify(napcat.state.api.filter(x => x.action === 'send_private_msg').at(-1).params.message).includes('摄影助手'), true);
  await service.adapterRegistry.disableAdapter('qq-native-agent');
});

test('managed QQ refuses unknown account and does not enable it after failure', async t => {
  const napcat = await mockNapCat(t);
  const { service, host } = await setupHub(t, { async invoke() { throw Error('Unexpected execution'); } });
  await service.adapterRegistry.upsertAdapter({
    adapterId: 'account-guard', channel: 'qq', status: 'inactive',
    config: accountConfig(napcat.url, { expectedQqId: '555555555' })
  });
  await assert.rejects(host.enable('account-guard'), /CHANNELHUB_MANAGED_ADAPTER_START_FAILED/);
  assert.equal((await service.adapterRegistry.getAdapter('account-guard')).status, 'inactive');
  assert.equal(service.adapterRegistry.getAdapterInstance('account-guard'), null);
});

test('managed QQ requires an explicit allowlist and access token; no implicit public access', async t => {
  const napcat = await mockNapCat(t);
  const { service, host } = await setupHub(t, { async invoke() { throw Error('Unexpected execution'); } });
  await service.adapterRegistry.upsertAdapter({
    adapterId: 'open-account', channel: 'qq', status: 'inactive',
    config: accountConfig(napcat.url, { allowedUserIds: [] })
  });
  await assert.rejects(host.enable('open-account'), /CHANNELHUB_MANAGED_ADAPTER_START_FAILED/);
  assert.equal(napcat.state.connections, 0, 'invalid permissions must fail before network connection');
});

test('unexpected OneBot socket loss reconnects, manual disconnect does not', async t => {
  const napcat = await mockNapCat(t);
  const { createOneBotClient } = await import('../Plugin/vcp-onebot-adapter/src/adapters/onebot/client.js');
  const client = createOneBotClient({ wsUrl: napcat.url, accessToken: napcat.state.token, logger: quiet });
  t.after(async () => { await client.disconnect(); });
  await client.connect();
  await until(() => client.selfId != null, 'verified QQ account');
  assert.equal(String(client.selfId), qqSelf);
  napcat.closeConnections();
  await until(() => napcat.state.connections === 2, 'reconnect after unexpected close', 210);
  await client.disconnect();
  await sleep(1250);
  assert.equal(napcat.state.connections, 2, 'disabled adapter must not reconnect after stop');
});
