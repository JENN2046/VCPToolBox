'use strict';
const { createHash } = require('node:crypto');

// C0 is a pure, read-free scope contract. It does not load NativeSync, open
// databases, enable OneRing, or change the established QQ R1 execution route.
// Only a validated managed QQ event may produce an opaque native Topic key.
const QQ_ID = /^[1-9][0-9]{4,14}$/;
const ADAPTER_ID = /^[A-Za-z0-9_-]{1,100}$/;
const NATIVE_ID_FORBIDDEN = /[<>:"/\\|?*\x00-\x1f]/;

function refused(code) {
  return Object.assign(new Error(code), { code });
}
function qqId(value, label) {
  const id = typeof value === 'number' && Number.isSafeInteger(value)
    ? String(value) : value;
  if (typeof id !== 'string' || !QQ_ID.test(id)) throw refused('QQ_SCOPE_INVALID_' + label);
  return id;
}
function nativeId(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128 ||
      NATIVE_ID_FORBIDDEN.test(value) || value === '.' || value === '..' ||
      /[. ]$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw refused('QQ_SCOPE_INVALID_AGENT_IDENTITY');
  }
  return value;
}

/**
 * @param {Object} input
 * @param {Object} input.adapter - existing active ChannelHub adapter registry row
 * @param {Object} input.envelope - B2 event from the managed OneBot adapter
 * @param {Object} input.route - server-resolved routing decision
 * @param {Object} input.context - must carry ChannelHub's trusted managed source
 * @param {string} input.resolvedAgentAlias - VCP AgentManager-validated alias
 * @returns immutable private Topic identity, not a bearer credential
 */
function deriveQqTopicScope({ adapter, envelope, route, context, resolvedAgentAlias } = {}) {
  if (context?.source !== 'managed_adapter') throw refused('QQ_SCOPE_TRUSTED_SOURCE_REQUIRED');
  if (!adapter || adapter.status !== 'active' || adapter.channel !== 'qq' ||
      !ADAPTER_ID.test(adapter.adapterId || '') ||
      envelope?.channel !== 'qq' || envelope.adapterId !== adapter.adapterId ||
      envelope.eventType !== 'message.created' || envelope.client?.clientType !== 'qq') {
    throw refused('QQ_SCOPE_ADAPTER_IDENTITY_MISMATCH');
  }
  const registeredAgent = adapter.config?.agentId;
  if (typeof registeredAgent !== 'string' || !registeredAgent.trim() ||
      registeredAgent !== route?.agentId) {
    throw refused('QQ_SCOPE_AGENT_BINDING_MISMATCH');
  }
  const ownerId = nativeId(resolvedAgentAlias);
  const botId = qqId(adapter.config?.expectedQqId, 'BOT_ID');
  const senderId = qqId(envelope.sender?.userId, 'SENDER_ID');
  if (!Array.isArray(adapter.config?.allowedUserIds) ||
      !adapter.config.allowedUserIds.some(x => String(x) === senderId) ||
      senderId === botId) throw refused('QQ_SCOPE_SENDER_NOT_AUTHORIZED');

  const raw = envelope.metadata?.platformData?.onebotData;
  if (!raw || raw.post_type !== 'message' ||
      qqId(raw.self_id, 'RAW_BOT_ID') !== botId ||
      qqId(raw.user_id, 'RAW_SENDER_ID') !== senderId ||
      String(raw.message_id ?? '') !== String(envelope.client?.messageId ?? '')) {
    throw refused('QQ_SCOPE_RAW_EVENT_MISMATCH');
  }

  const type = envelope.client.conversationType;
  const conversationId = qqId(envelope.client.conversationId, 'CONVERSATION_ID');
  let principal;
  if (type === 'private' && raw.message_type === 'private') {
    if (conversationId !== senderId || raw.group_id != null) throw refused('QQ_SCOPE_PRIVATE_MISMATCH');
    principal = senderId;
  } else if (type === 'group' && raw.message_type === 'group') {
    if (qqId(raw.group_id, 'RAW_GROUP_ID') !== conversationId ||
        !Array.isArray(adapter.config?.allowedGroupIds) ||
        !adapter.config.allowedGroupIds.some(x => String(x) === conversationId)) {
      throw refused('QQ_SCOPE_GROUP_NOT_AUTHORIZED');
    }
    // Re-check direct @self in the raw OneBot event: @all is not permission.
    if (!Array.isArray(raw.message) ||
        !raw.message.some(item => item?.type === 'at' && String(item.data?.qq) === botId)) {
      throw refused('QQ_SCOPE_EXPLICIT_MENTION_REQUIRED');
    }
    principal = conversationId;
  } else {
    throw refused('QQ_SCOPE_UNSUPPORTED_CONVERSATION');
  }

  // Never use user-provided session.bindingKey/currentTopicId. They could
  // otherwise select another user's history. NativeSync ACL stays mandatory.
  const tuple = ['channelhub-qq-native-topic-v1', adapter.adapterId, botId,
    ownerId, type, principal];
  const digest = createHash('sha256').update(JSON.stringify(tuple)).digest('hex');
  return Object.freeze({
    contractVersion: 1,
    ownerType: 'agent',
    ownerId,
    topicId: 'qqctx1_' + digest.slice(0, 48),
    channel: 'qq',
    conversationType: type,
    origin: 'managed_onebot',
    // Logging safe for diagnostics, not a bearer token or authorization proof.
    scopeFingerprint: digest.slice(0, 16)
  });
}

module.exports = { deriveQqTopicScope };
