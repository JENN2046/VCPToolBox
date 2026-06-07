'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const roleDivider = require('../modules/roleDivider');
const {
  ONERING_POST_TURN_METADATA_KEY,
  ONERING_POST_TURN_METADATA_LEGACY_KEY,
  attachOneRingPostTurnMetadata,
  preserveOneRingPostTurnMetadata,
  readOneRingPostTurnMetadata,
} = require('../modules/oneringPostTurnContext');

function makePostTurn(overrides = {}) {
  return {
    turnId: overrides.turnId || 'turn-fixed',
    agentName: overrides.agentName || 'Agnes',
    frontendSource: overrides.frontendSource || 'VChat',
    requestHash: overrides.requestHash || 'hash-fixed',
    requestBlockCount: overrides.requestBlockCount || 1,
    responseMessageId: null,
    responseContentHash: null,
    status: 'pending',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    completedAt: null,
    abortedAt: null,
  };
}

test('attachOneRingPostTurnMetadata stores a non-serializing side channel', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  const postTurn = makePostTurn();
  const result = attachOneRingPostTurnMetadata(messages, {
    postTurn,
    prepared: true,
    reason: null,
  });

  assert.equal(result, messages);
  assert.deepEqual(readOneRingPostTurnMetadata(messages), {
    postTurn,
    prepared: true,
    reason: null,
  });
  assert.equal(JSON.stringify(messages), '[{"role":"user","content":"hello"}]');

  const symbolDescriptor = Object.getOwnPropertyDescriptor(messages, ONERING_POST_TURN_METADATA_KEY);
  assert.equal(symbolDescriptor.enumerable, false);
  assert.equal(symbolDescriptor.configurable, true);
  assert.equal(symbolDescriptor.writable, false);

  const legacyDescriptor = Object.getOwnPropertyDescriptor(messages, ONERING_POST_TURN_METADATA_LEGACY_KEY);
  assert.equal(legacyDescriptor.enumerable, false);
  assert.equal(legacyDescriptor.configurable, true);
  assert.equal(legacyDescriptor.writable, false);
});

test('readOneRingPostTurnMetadata supports legacy string-keyed metadata', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  const postTurn = makePostTurn({ turnId: 'turn-legacy' });
  const sideChannel = { postTurn, prepared: true, reason: null };

  Object.defineProperty(messages, ONERING_POST_TURN_METADATA_LEGACY_KEY, {
    value: sideChannel,
    enumerable: false,
    configurable: true,
    writable: false,
  });

  assert.equal(readOneRingPostTurnMetadata(messages), sideChannel);
});

test('preserveOneRingPostTurnMetadata carries metadata onto fresh replacement arrays', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'hello' },
  ];
  const postTurn = makePostTurn();
  attachOneRingPostTurnMetadata(messages, { postTurn, prepared: true, reason: null });

  const replacement = messages.map(message => ({ ...message }));
  assert.equal(readOneRingPostTurnMetadata(replacement), null);

  const preserved = preserveOneRingPostTurnMetadata(messages, replacement);

  assert.equal(preserved, replacement);
  assert.equal(readOneRingPostTurnMetadata(replacement).postTurn, postTurn);
  assert.equal(JSON.stringify(replacement), '[{"role":"system","content":"system"},{"role":"user","content":"hello"}]');
  assert.equal(Object.prototype.propertyIsEnumerable.call(replacement, ONERING_POST_TURN_METADATA_KEY), false);
  assert.equal(Object.prototype.propertyIsEnumerable.call(replacement, ONERING_POST_TURN_METADATA_LEGACY_KEY), false);
});

test('preserveOneRingPostTurnMetadata supports final merged array replacements', () => {
  const messages = [
    { role: 'system', content: 'inserted before system' },
    { role: 'system', content: 'original system' },
    { role: 'user', content: 'hello' },
  ];
  const postTurn = makePostTurn({ turnId: 'turn-merged' });
  attachOneRingPostTurnMetadata(messages, { postTurn, prepared: true, reason: null });

  const before = messages.slice(0, 1);
  const protectedSystemPrompt = messages[1];
  const after = messages.slice(2);
  const merged = [
    ...before,
    protectedSystemPrompt,
    ...after,
  ];

  assert.equal(readOneRingPostTurnMetadata(merged), null);
  preserveOneRingPostTurnMetadata(messages, merged);

  assert.equal(readOneRingPostTurnMetadata(merged).postTurn, postTurn);
});

test('roleDivider.process keeps attached OneRing post-turn metadata', () => {
  const messages = [
    { role: 'system', content: 'system' },
    {
      role: 'user',
      content: 'hello <<<[ROLE_DIVIDE_ASSISTANT]>>>side<<<[END_ROLE_DIVIDE_ASSISTANT]>>>',
    },
  ];
  const postTurn = makePostTurn({ turnId: 'turn-role-divider' });
  attachOneRingPostTurnMetadata(messages, { postTurn, prepared: true, reason: null });

  const processed = roleDivider.process(messages);

  assert.notEqual(processed, messages);
  assert.deepEqual(processed.map(message => message.role), ['system', 'user', 'assistant']);
  assert.equal(readOneRingPostTurnMetadata(processed).postTurn, postTurn);
  assert.equal(JSON.stringify(processed).includes('turn-role-divider'), false);
});

test('OneRing post-turn side-channel helpers safely ignore invalid inputs', () => {
  assert.equal(readOneRingPostTurnMetadata(null), null);
  assert.equal(readOneRingPostTurnMetadata({}), null);
  assert.equal(attachOneRingPostTurnMetadata(null, { postTurn: makePostTurn() }), null);
  assert.deepEqual(preserveOneRingPostTurnMetadata(null, [{ role: 'user', content: 'hello' }]), [
    { role: 'user', content: 'hello' },
  ]);

  const messages = [{ role: 'user', content: 'hello' }];
  attachOneRingPostTurnMetadata(messages, null);
  assert.equal(readOneRingPostTurnMetadata(messages), null);
});

test('attachOneRingPostTurnMetadata is best-effort when existing descriptors block writes', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  const legacySideChannel = {
    postTurn: makePostTurn({ turnId: 'turn-locked' }),
    prepared: true,
    reason: null,
  };

  Object.defineProperty(messages, ONERING_POST_TURN_METADATA_KEY, {
    value: legacySideChannel,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  assert.doesNotThrow(() => attachOneRingPostTurnMetadata(messages, {
    postTurn: makePostTurn({ turnId: 'turn-new' }),
    prepared: true,
    reason: null,
  }));
  assert.equal(readOneRingPostTurnMetadata(messages), legacySideChannel);
});
