'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOneRingContentHash, buildOneRingRequestHash } = require('../modules/oneringSqlHashContract');
const {
  abortPostTurnMetadata,
  buildPendingPostTurnMetadata,
  completePostTurnMetadata,
  normalizePostTurnMetadata,
} = require('../modules/oneringPostTurnMetadata');

const POST_BLOCKS = [
  {
    role: 'user',
    senderName: ' Alice ',
    frontendSource: ' VChat ',
    content: '[Alice的发言]： hello   world',
  },
  {
    role: 'assistant',
    senderName: 'Agnes',
    frontendSource: 'VChat',
    content: 'hi there',
  },
];

test('buildPendingPostTurnMetadata computes request identity without side effects', () => {
  const result = buildPendingPostTurnMetadata({
    agentName: ' Agnes ',
    frontendSource: ' VChat ',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
    makeId: ({ requestHash }) => `turn-${requestHash.slice(0, 12)}`,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.deepEqual(result.metadata, {
    turnId: `turn-${buildOneRingRequestHash(POST_BLOCKS).slice(0, 12)}`,
    agentName: 'Agnes',
    frontendSource: 'VChat',
    requestHash: buildOneRingRequestHash(POST_BLOCKS),
    requestBlockCount: 2,
    responseMessageId: null,
    responseContentHash: null,
    status: 'pending',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:00.000Z',
    completedAt: null,
    abortedAt: null,
  });
});

test('buildPendingPostTurnMetadata default turnId includes request prefix and random suffix', () => {
  const first = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
  });
  const second = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.metadata.turnId, second.metadata.turnId);
  assert.match(first.metadata.turnId, /^turn_[a-f0-9]{24}_[a-f0-9]{12}$/);
  assert.equal(
    first.metadata.turnId.slice(0, 29),
    second.metadata.turnId.slice(0, 29),
  );
});

test('buildPendingPostTurnMetadata safely rejects missing required trigger fields', () => {
  assert.deepEqual(
    buildPendingPostTurnMetadata({ frontendSource: 'VChat', postBlocks: [] }),
    { ok: false, metadata: null, reason: 'missing-agentName' },
  );
  assert.deepEqual(
    buildPendingPostTurnMetadata({ agentName: 'Agnes', postBlocks: [] }),
    { ok: false, metadata: null, reason: 'missing-frontendSource' },
  );
});

test('completePostTurnMetadata completes only recordable assistant candidates', () => {
  const pending = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
    makeId: () => 'turn-fixed',
  }).metadata;

  const completed = completePostTurnMetadata(
    pending,
    {
      shouldRecord: true,
      role: 'assistant',
      content: ' final answer ',
      reason: null,
    },
    { now: () => '2026-06-07T00:00:02.000Z' },
  );

  assert.equal(completed.ok, true);
  assert.equal(completed.metadata.status, 'completed');
  assert.equal(completed.metadata.responseMessageId, null);
  assert.equal(completed.metadata.responseContentHash, buildOneRingContentHash('final answer'));
  assert.equal(completed.metadata.completedAt, '2026-06-07T00:00:02.000Z');
  assert.equal(completed.metadata.updatedAt, '2026-06-07T00:00:02.000Z');
  assert.equal(completed.metadata.abortedAt, null);
  assert.equal(pending.status, 'pending');
});

test('completePostTurnMetadata never completes skipped, empty, or failed candidates', () => {
  const pending = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
  }).metadata;

  assert.deepEqual(
    completePostTurnMetadata(pending, { shouldRecord: false, reason: 'stream-error', content: 'partial' }),
    { ok: false, metadata: null, reason: 'stream-error' },
  );
  assert.deepEqual(
    completePostTurnMetadata(pending, { shouldRecord: true, content: '   ' }),
    { ok: false, metadata: null, reason: 'empty-assistant-content' },
  );
  assert.equal(completePostTurnMetadata(null, { shouldRecord: true, content: 'ok' }).reason, 'missing-post-turn-metadata');
});

test('abortPostTurnMetadata marks pending metadata aborted without response content', () => {
  const pending = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
    makeId: () => 'turn-fixed',
  }).metadata;

  const aborted = abortPostTurnMetadata(
    pending,
    'client-abort',
    { now: () => '2026-06-07T00:00:03.000Z' },
  );

  assert.equal(aborted.ok, true);
  assert.equal(aborted.reason, 'client-abort');
  assert.equal(aborted.metadata.status, 'aborted');
  assert.equal(aborted.metadata.responseMessageId, null);
  assert.equal(aborted.metadata.responseContentHash, null);
  assert.equal(aborted.metadata.completedAt, null);
  assert.equal(aborted.metadata.abortedAt, '2026-06-07T00:00:03.000Z');
});

test('metadata transitions reject already-finalized turns', () => {
  const pending = buildPendingPostTurnMetadata({
    agentName: 'Agnes',
    frontendSource: 'VChat',
    postBlocks: POST_BLOCKS,
    now: () => '2026-06-07T00:00:00.000Z',
  }).metadata;
  const completed = completePostTurnMetadata(
    pending,
    { shouldRecord: true, content: 'done' },
    { now: () => '2026-06-07T00:00:01.000Z' },
  ).metadata;

  assert.deepEqual(
    abortPostTurnMetadata(completed, 'late-abort'),
    { ok: false, metadata: null, reason: 'post-turn-completed' },
  );
  assert.deepEqual(
    completePostTurnMetadata(completed, { shouldRecord: true, content: 'again' }),
    { ok: false, metadata: null, reason: 'post-turn-completed' },
  );
});

test('normalizePostTurnMetadata safely normalizes nullable store fields', () => {
  const result = normalizePostTurnMetadata({
    turnId: ' turn-1 ',
    agentName: ' Agnes ',
    frontendSource: ' VChat ',
    requestHash: ' hash ',
    requestBlockCount: '2',
    responseMessageId: '42',
    responseContentHash: ' content-hash ',
    status: 'completed',
    createdAt: '2026-06-07T00:00:00.000Z',
    updatedAt: '2026-06-07T00:00:01.000Z',
    completedAt: '2026-06-07T00:00:01.000Z',
    abortedAt: '',
  });

  assert.deepEqual(result, {
    ok: true,
    metadata: {
      turnId: 'turn-1',
      agentName: 'Agnes',
      frontendSource: 'VChat',
      requestHash: 'hash',
      requestBlockCount: 2,
      responseMessageId: 42,
      responseContentHash: 'content-hash',
      status: 'completed',
      createdAt: '2026-06-07T00:00:00.000Z',
      updatedAt: '2026-06-07T00:00:01.000Z',
      completedAt: '2026-06-07T00:00:01.000Z',
      abortedAt: null,
    },
    reason: null,
  });
});

test('normalizePostTurnMetadata safely rejects invalid metadata', () => {
  assert.equal(normalizePostTurnMetadata(null).reason, 'missing-post-turn-metadata');
  assert.equal(normalizePostTurnMetadata({ turnId: 't' }).reason, 'missing-agentName');
  assert.equal(
    normalizePostTurnMetadata({
      turnId: 't',
      agentName: 'a',
      frontendSource: 'f',
      requestHash: 'h',
      requestBlockCount: -1,
      status: 'pending',
      createdAt: 'c',
      updatedAt: 'u',
    }).reason,
    'invalid-requestBlockCount',
  );
  assert.equal(
    normalizePostTurnMetadata({
      turnId: 't',
      agentName: 'a',
      frontendSource: 'f',
      requestHash: 'h',
      requestBlockCount: 0,
      status: 'mystery',
      createdAt: 'c',
      updatedAt: 'u',
    }).reason,
    'invalid-status',
  );
});
