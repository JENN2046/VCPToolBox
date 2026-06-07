'use strict';

const ONERING_POST_TURN_METADATA_KEY = Symbol.for('vcp.onering.postTurn');
const ONERING_POST_TURN_METADATA_LEGACY_KEY = '__oneRingPostTurn';
const ONERING_POST_TURN_METADATA_KEYS = [
  ONERING_POST_TURN_METADATA_KEY,
  ONERING_POST_TURN_METADATA_LEGACY_KEY,
];

function attachOneRingPostTurnMetadata(messages, metadata) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  const normalized = normalizeOneRingPostTurnSideChannel(metadata);
  if (!normalized) {
    return messages;
  }

  for (const key of ONERING_POST_TURN_METADATA_KEYS) {
    safelyDefineMetadata(messages, key, normalized);
  }

  return messages;
}

function readOneRingPostTurnMetadata(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  for (const key of ONERING_POST_TURN_METADATA_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(messages, key);
    if (descriptor && descriptor.value && typeof descriptor.value === 'object') {
      return descriptor.value;
    }
  }

  return null;
}

function preserveOneRingPostTurnMetadata(sourceMessages, targetMessages) {
  if (!Array.isArray(sourceMessages) || !Array.isArray(targetMessages)) {
    return targetMessages;
  }

  for (const key of ONERING_POST_TURN_METADATA_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(sourceMessages, key);
    if (!descriptor) {
      continue;
    }

    try {
      Object.defineProperty(targetMessages, key, descriptor);
    } catch (error) {
      // Side-channel preservation is best-effort and must not affect message flow.
    }
  }

  return targetMessages;
}

function normalizeOneRingPostTurnSideChannel(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const postTurn = metadata.postTurn && typeof metadata.postTurn === 'object'
    ? metadata.postTurn
    : null;
  const reason = normalizeNullableText(metadata.reason);
  const prepared = metadata.prepared === false ? false : Boolean(postTurn || metadata.prepared);

  return {
    postTurn,
    prepared,
    reason,
  };
}

function safelyDefineMetadata(messages, key, value) {
  try {
    Object.defineProperty(messages, key, {
      value,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  } catch (error) {
    // Side-channel attachment is best-effort and must not affect message flow.
  }
}

function normalizeNullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = {
  ONERING_POST_TURN_METADATA_KEY,
  ONERING_POST_TURN_METADATA_LEGACY_KEY,
  attachOneRingPostTurnMetadata,
  preserveOneRingPostTurnMetadata,
  readOneRingPostTurnMetadata,
};
