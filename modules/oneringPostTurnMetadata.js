'use strict';

const crypto = require('crypto');

const {
  buildOneRingContentHash,
  buildOneRingRequestHash,
  normalizeRequestBlocks,
} = require('./oneringSqlHashContract');

const POST_TURN_STATUSES = new Set(['pending', 'completed', 'aborted']);

function buildPendingPostTurnMetadata({
  agentName,
  frontendSource,
  postBlocks,
  now,
  makeId,
} = {}) {
  const safeAgentName = normalizeRequiredText(agentName);
  if (!safeAgentName) {
    return failure('missing-agentName');
  }

  const safeFrontendSource = normalizeRequiredText(frontendSource);
  if (!safeFrontendSource) {
    return failure('missing-frontendSource');
  }

  const normalizedBlocks = normalizeRequestBlocks(postBlocks);
  const requestHash = buildOneRingRequestHash(postBlocks);
  const createdAt = normalizeTimestampSource(now);
  const turnId = buildTurnId({
    makeId,
    agentName: safeAgentName,
    frontendSource: safeFrontendSource,
    requestHash,
    createdAt,
  });

  if (!turnId) {
    return failure('missing-turnId');
  }

  return success({
    turnId,
    agentName: safeAgentName,
    frontendSource: safeFrontendSource,
    requestHash,
    requestBlockCount: normalizedBlocks.length,
    responseMessageId: null,
    responseContentHash: null,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    abortedAt: null,
  });
}

function completePostTurnMetadata(pendingMeta, assistantCandidate, { now } = {}) {
  const validMeta = normalizePostTurnMetadata(pendingMeta);
  if (!validMeta.ok) {
    return validMeta;
  }

  if (validMeta.metadata.status !== 'pending') {
    return failure(`post-turn-${validMeta.metadata.status}`);
  }

  if (!assistantCandidate || assistantCandidate.shouldRecord !== true) {
    return failure(candidateReason(assistantCandidate) || 'assistant-candidate-not-recordable');
  }

  const content = typeof assistantCandidate.content === 'string'
    ? assistantCandidate.content.trim()
    : '';
  if (!content) {
    return failure('empty-assistant-content');
  }

  const completedAt = normalizeTimestampSource(now);
  return success({
    ...validMeta.metadata,
    responseMessageId: null,
    responseContentHash: buildOneRingContentHash(content),
    status: 'completed',
    updatedAt: completedAt,
    completedAt,
    abortedAt: null,
  });
}

function abortPostTurnMetadata(pendingMeta, reason = 'aborted', { now } = {}) {
  const validMeta = normalizePostTurnMetadata(pendingMeta);
  if (!validMeta.ok) {
    return validMeta;
  }

  if (validMeta.metadata.status !== 'pending') {
    return failure(`post-turn-${validMeta.metadata.status}`);
  }

  const abortedAt = normalizeTimestampSource(now);
  return {
    ok: true,
    metadata: {
      ...validMeta.metadata,
      responseMessageId: null,
      responseContentHash: null,
      status: 'aborted',
      updatedAt: abortedAt,
      completedAt: null,
      abortedAt,
    },
    reason: normalizeRequiredText(reason) || 'aborted',
  };
}

function normalizePostTurnMetadata(meta) {
  if (!meta || typeof meta !== 'object') {
    return failure('missing-post-turn-metadata');
  }

  const turnId = normalizeRequiredText(meta.turnId);
  if (!turnId) {
    return failure('missing-turnId');
  }

  const agentName = normalizeRequiredText(meta.agentName);
  if (!agentName) {
    return failure('missing-agentName');
  }

  const frontendSource = normalizeRequiredText(meta.frontendSource);
  if (!frontendSource) {
    return failure('missing-frontendSource');
  }

  const requestHash = normalizeRequiredText(meta.requestHash);
  if (!requestHash) {
    return failure('missing-requestHash');
  }

  const requestBlockCount = normalizeCount(meta.requestBlockCount);
  if (requestBlockCount === null) {
    return failure('invalid-requestBlockCount');
  }

  const status = normalizeRequiredText(meta.status);
  if (!POST_TURN_STATUSES.has(status)) {
    return failure('invalid-status');
  }

  const createdAt = normalizeRequiredText(meta.createdAt);
  const updatedAt = normalizeRequiredText(meta.updatedAt);
  if (!createdAt || !updatedAt) {
    return failure('missing-timestamp');
  }

  return success({
    turnId,
    agentName,
    frontendSource,
    requestHash,
    requestBlockCount,
    responseMessageId: normalizeNullableInteger(meta.responseMessageId),
    responseContentHash: normalizeNullableText(meta.responseContentHash),
    status,
    createdAt,
    updatedAt,
    completedAt: normalizeNullableText(meta.completedAt),
    abortedAt: normalizeNullableText(meta.abortedAt),
  });
}

function buildTurnId({ makeId, agentName, frontendSource, requestHash, createdAt }) {
  if (typeof makeId === 'function') {
    return normalizeRequiredText(makeId({
      agentName,
      frontendSource,
      requestHash,
      createdAt,
    }));
  }

  const stablePrefix = sha256Hex([
    agentName,
    frontendSource,
    requestHash,
    createdAt,
  ].join('\n')).slice(0, 24);
  return `turn_${stablePrefix}_${randomHex(6)}`;
}

function normalizeTimestampSource(now) {
  const value = typeof now === 'function' ? now() : new Date().toISOString();
  if (value instanceof Date) {
    return value.toISOString();
  }
  const text = normalizeRequiredText(value);
  return text || new Date().toISOString();
}

function normalizeRequiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
  const text = normalizeRequiredText(value);
  return text || null;
}

function normalizeNullableInteger(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function candidateReason(candidate) {
  return candidate && typeof candidate.reason === 'string' && candidate.reason.trim()
    ? candidate.reason.trim()
    : '';
}

function sha256Hex(value) {
  return crypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function randomHex(byteLength) {
  return crypto.randomBytes(byteLength).toString('hex');
}

function success(metadata) {
  return {
    ok: true,
    metadata,
    reason: null,
  };
}

function failure(reason) {
  return {
    ok: false,
    metadata: null,
    reason,
  };
}

module.exports = {
  buildPendingPostTurnMetadata,
  completePostTurnMetadata,
  abortPostTurnMetadata,
  normalizePostTurnMetadata,
};
