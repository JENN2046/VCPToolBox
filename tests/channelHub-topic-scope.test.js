'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveQqTopicScope } = require('../Plugin/ChannelHub/topic-scope');

const base = {
  adapterId: 'qq-dafeiyu',
  status: 'active',
  channel: 'qq',
  config: {
    expectedQqId: '822022316',
    agentId: '大肥鱼',
    allowedUserIds: ['515292656', '987654321'],
    allowedGroupIds: ['1129883101', '2233445566']
  }
};
function event({ type = 'private', sender = '515292656',
  group = '1129883101', bot = '822022316', messageId = '123' } = {}) {
  const raw = {
    post_type: 'message', message_type: type,
    user_id: Number(sender), self_id: Number(bot), message_id: Number(messageId),
    ...(type === 'group' ? { group_id: Number(group), message: [
      { type: 'at', data: { qq: bot } },
      { type: 'text', data: { text: 'hello' } }
    ] } : { message: [{ type: 'text', data: { text: 'hello' } }] })
  };
  return {
    channel: 'qq', adapterId: base.adapterId, eventType: 'message.created',
    client: { clientType: 'qq', conversationType: type,
      conversationId: type === 'private' ? sender : group, messageId },
    sender: { userId: sender },
    metadata: { platformData: { onebotData: raw } },
    session: { bindingKey: 'untrusted', currentTopicId: 'forged' }
  };
}
function scope({ adapter = base, envelope = event(), agentId = '大肥鱼',
  alias = '大肥鱼', source = 'managed_adapter' } = {}) {
  return deriveQqTopicScope({ adapter, envelope, route: { agentId },
    resolvedAgentAlias: alias, context: { source } });
}
function denial(run, code) {
  assert.throws(run, error => error.code === code, code);
}

test('C0: same private QQ peer has stable Topic, without leaking raw IDs', () => {
  const a = scope({ envelope: event({ messageId: '101' }) });
  const b = scope({ envelope: event({ messageId: '102' }) });
  assert.equal(a.topicId, b.topicId);
  assert.equal(a.ownerId, '大肥鱼');
  assert.equal(a.ownerType, 'agent');
  assert.equal(a.conversationType, 'private');
  assert.equal(a.contractVersion, 1);
  assert.equal(Object.isFrozen(a), true);
  assert.match(a.topicId, /^qqctx1_[a-f0-9]{48}$/);
  assert.ok(!a.topicId.includes('515292656') && !a.topicId.includes('822022316'));
});

test('C0: two different private peers never share a Topic', () => {
  assert.notEqual(scope().topicId, scope({ envelope: event({ sender: '987654321' }) }).topicId);
});

test('C0: private and group have different Topics even for the same sender', () => {
  const group = scope({ envelope: event({ type: 'group' }) });
  assert.equal(group.conversationType, 'group');
  assert.notEqual(scope().topicId, group.topicId);
});

test('C0: group history is shared only within the same authorized group', () => {
  const a = scope({ envelope: event({ type: 'group' }) });
  const b = scope({ envelope: event({ type: 'group', sender: '987654321' }) });
  const c = scope({ envelope: event({ type: 'group', group: '2233445566' }) });
  assert.equal(a.topicId, b.topicId, 'two authorized speakers in the same group share group context');
  assert.notEqual(a.topicId, c.topicId, 'different groups never share context');
});

test('C0: changing Agent, bot identity, or adapter isolates history', () => {
  const original = scope();
  const otherAgent = scope({
    adapter: { ...base, config: { ...base.config, agentId: 'Nova' } },
    agentId: 'Nova', alias: 'Nova'
  });
  const otherBot = scope({
    adapter: { ...base, config: { ...base.config, expectedQqId: '987654321' } },
    envelope: event({ bot: '987654321' })
  });
  const otherAdapter = scope({
    adapter: { ...base, adapterId: 'qq-other' },
    envelope: { ...event(), adapterId: 'qq-other' }
  });
  assert.notEqual(original.topicId, otherAgent.topicId);
  assert.notEqual(original.topicId, otherBot.topicId);
  assert.notEqual(original.topicId, otherAdapter.topicId);
});

test('C0: untrusted B2 events cannot select NativeSync history via forged claims', () => {
  denial(() => scope({ source: 'external_http' }), 'QQ_SCOPE_TRUSTED_SOURCE_REQUIRED');
  const forged = event();
  forged.session.currentTopicId = 'somebody-elses-topic';
  forged.session.bindingKey = 'qq:private:other-user';
  assert.equal(scope({ envelope: forged }).topicId, scope().topicId);
});

test('C0: group permission and explicit @self must both be present', () => {
  denial(() => scope({ envelope: event({ type: 'group', group: '4455667788' }) }), 'QQ_SCOPE_GROUP_NOT_AUTHORIZED');
  const all = event({ type: 'group' });
  all.metadata.platformData.onebotData.message[0].data.qq = 'all';
  denial(() => scope({ envelope: all }), 'QQ_SCOPE_EXPLICIT_MENTION_REQUIRED');
  const missing = event({ type: 'group' });
  missing.metadata.platformData.onebotData.message = [];
  denial(() => scope({ envelope: missing }), 'QQ_SCOPE_EXPLICIT_MENTION_REQUIRED');
});

test('C0: unauthorized sender and raw identity mismatch fail closed', () => {
  denial(() => scope({ envelope: event({ sender: '4455667788' }) }), 'QQ_SCOPE_SENDER_NOT_AUTHORIZED');
  const forged = event(); forged.sender.userId = '987654321';
  denial(() => scope({ envelope: forged }), 'QQ_SCOPE_RAW_EVENT_MISMATCH');
  const altBot = event(); altBot.metadata.platformData.onebotData.self_id = 999999999;
  denial(() => scope({ envelope: altBot }), 'QQ_SCOPE_RAW_EVENT_MISMATCH');
  const altMsg = event(); altMsg.client.messageId = '456';
  denial(() => scope({ envelope: altMsg }), 'QQ_SCOPE_RAW_EVENT_MISMATCH');
});

test('C0: inconsistent private sender/peer and unsupported group types fail closed', () => {
  const privateMismatch = event(); privateMismatch.client.conversationId = '987654321';
  denial(() => scope({ envelope: privateMismatch }), 'QQ_SCOPE_PRIVATE_MISMATCH');
  const badType = event(); badType.client.conversationType = 'group';
  denial(() => scope({ envelope: badType }), 'QQ_SCOPE_UNSUPPORTED_CONVERSATION');
});

test('C0: missing Agent, incorrect Agent binding and disabled adapter cannot claim scope', () => {
  denial(() => scope({ agentId: 'Nova' }), 'QQ_SCOPE_AGENT_BINDING_MISMATCH');
  denial(() => scope({ alias: '' }), 'QQ_SCOPE_INVALID_AGENT_IDENTITY');
  denial(() => scope({ adapter: { ...base, status: 'inactive' } }), 'QQ_SCOPE_ADAPTER_IDENTITY_MISMATCH');
  denial(() => scope({ adapter: { ...base, adapterId: 'other' } }), 'QQ_SCOPE_ADAPTER_IDENTITY_MISMATCH');
});

test('C0: native Topic ID passes NativeSync identity contract without touching SQLite', () => {
  const { identity } = require('../Plugin/NativeSync/sync/protocol');
  const value = scope();
  assert.deepEqual(identity({
    ownerType: value.ownerType, ownerId: value.ownerId,
    topicId: value.topicId, msgId: 'test-message'
  }), { ownerType: 'agent', ownerId: '大肥鱼', topicId: value.topicId, msgId: 'test-message' });
});

test('C0: scope generation never imports NativeSync runtime or opens persistent storage', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.resolve(__dirname, '../Plugin/ChannelHub/topic-scope.js'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]\.\.\/NativeSync|sqlite|new CentralStore|readFileSync|writeFileSync|fs\.write/i);
});

test('C0: actual OneBot decodeInbound private and group envelopes pass scope contract', async () => {
  const { OneBotAdapter } = await import('../Plugin/vcp-onebot-adapter/src/adapter/contract.js');
  const driver = new OneBotAdapter({
    metadata: {
      id: base.adapterId, channel: 'qq', displayName: 'synthetic OneBot',
      transportMode: 'forward_ws', sessionGrammar: 'qq:{conversationType}:{conversationId}',
      capabilities: { supportsText: true }
    },
    options: { logger: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
      wsUrl: 'ws://127.0.0.1:3001/' }
  });
  const firstRaw = event({ messageId: '6101' }).metadata.platformData.onebotData;
  const secondRaw = event({ type: 'group', messageId: '6102' }).metadata.platformData.onebotData;
  for (const raw of [firstRaw, secondRaw]) {
    const decoded = await driver.decodeInbound(raw);
    const topic = scope({ envelope: decoded });
    assert.equal(topic.ownerId, '大肥鱼');
    assert.equal(topic.conversationType, raw.message_type);
    assert.match(topic.topicId, /^qqctx1_[a-f0-9]{48}$/);
  }
});
