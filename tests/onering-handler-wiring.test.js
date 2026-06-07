'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOneRingDispatchMetadata,
  completeOneRingPostTurnAfterRecord,
  dispatchOneRingAssistantRecordCandidate,
} = require('../modules/oneringHandlerWiring');
const { buildPendingPostTurnMetadata } = require('../modules/oneringPostTurnMetadata');
const { buildOneRingContentHash } = require('../modules/oneringSqlHashContract');

function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

function makePendingPostTurn(overrides = {}) {
  const result = buildPendingPostTurnMetadata({
    agentName: overrides.agentName || 'Agnes',
    frontendSource: overrides.frontendSource || 'VChat',
    postBlocks: overrides.postBlocks || [{ role: 'user', content: 'hello' }],
    now: () => overrides.now || '2026-06-06T04:00:00.000Z',
    makeId: () => overrides.turnId || 'turn_agnes_vchat_1',
  });

  assert.equal(result.ok, true);
  return result.metadata;
}

test('dispatchOneRingAssistantRecordCandidate skips non-recordable candidates', async () => {
  let called = false;
  const result = dispatchOneRingAssistantRecordCandidate(
    { onOneRingAssistantRecordCandidate: () => { called = true; } },
    { shouldRecord: false, role: 'assistant', content: '', reason: 'partial-stream-result' },
  );

  await tick();

  assert.equal(called, false);
  assert.equal(result.dispatched, false);
  assert.equal(result.reason, 'partial-stream-result');
});

test('dispatchOneRingAssistantRecordCandidate does not abort post-turns by default for skipped candidates', async () => {
  let called = false;
  const abortCalls = [];
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      oneRingPostTurn: makePendingPostTurn(),
      oneRingPostTurnStore: {
        completePostTurn() {},
        abortPostTurn(metadata) {
          abortCalls.push(metadata);
          return { updated: true, row: metadata };
        },
      },
      onOneRingAssistantRecordCandidate: () => { called = true; },
    },
    { shouldRecord: false, role: 'assistant', content: '', reason: 'stream-error' },
  );

  await tick();

  assert.equal(result.dispatched, false);
  assert.equal(called, false);
  assert.deepEqual(abortCalls, []);
});

test('dispatchOneRingAssistantRecordCandidate can abort post-turns with explicit opt-in', async () => {
  const abortCalls = [];
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      oneRingPostTurn: makePendingPostTurn(),
      oneRingPostTurnStore: {
        completePostTurn() {},
        abortPostTurn(metadata) {
          abortCalls.push(metadata);
          return { updated: true, row: metadata };
        },
      },
    },
    { shouldRecord: false, role: 'assistant', content: '', reason: 'stream-idle-timeout' },
    {
      abortPostTurnOnSkip: true,
      now: () => '2026-06-06T04:00:01.000Z',
    },
  );

  await tick();

  assert.equal(result.dispatched, false);
  assert.equal(abortCalls.length, 1);
  assert.equal(abortCalls[0].status, 'aborted');
  assert.equal(abortCalls[0].abortedAt, '2026-06-06T04:00:01.000Z');
});

test('dispatchOneRingAssistantRecordCandidate calls explicit handler hook asynchronously', async () => {
  const calls = [];
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      onOneRingAssistantRecordCandidate: (candidate, metadata) => {
        calls.push({ candidate, metadata });
      },
    },
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
    { phaseLabel: 'final_turn', logPrefix: '[Test OneRing]' },
  );

  assert.equal(result.dispatched, true);
  assert.equal(calls.length, 0);

  await tick();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].candidate.content, 'visible answer');
  assert.equal(calls[0].metadata.phaseLabel, 'final_turn');
  assert.deepEqual(calls[0].metadata.messages, [{ role: 'user', content: 'hello' }]);
});

test('dispatch metadata preserves messages key and carries optional postTurn metadata', () => {
  const postTurn = makePendingPostTurn();
  const metadata = buildOneRingDispatchMetadata(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      oneRingPostTurn: postTurn,
    },
    { phaseLabel: 'final_turn' },
  );

  assert.deepEqual(metadata.messages, [{ role: 'user', content: 'hello' }]);
  assert.equal(metadata.postTurn, postTurn);
  assert.equal(Object.hasOwn(metadata, 'originalBody'), false);
});

test('dispatchOneRingAssistantRecordCandidate completes post-turn after assistant record id exists', async () => {
  const postTurn = makePendingPostTurn();
  const recordCalls = [];
  const completeCalls = [];
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      oneRingPostTurn: postTurn,
      oneRingPostTurnStore: {
        completePostTurn(metadata, responseMessageId) {
          completeCalls.push({ metadata, responseMessageId });
          return { updated: true, row: { ...metadata, responseMessageId } };
        },
      },
      onOneRingAssistantRecordCandidate: (candidate, metadata) => {
        recordCalls.push({ candidate, metadata });
        return { recorded: true, id: 42 };
      },
    },
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
    {
      phaseLabel: 'final_turn',
      now: () => '2026-06-06T04:00:01.000Z',
    },
  );

  assert.equal(result.dispatched, true);
  assert.equal(completeCalls.length, 0);

  await tick();

  assert.equal(recordCalls.length, 1);
  assert.equal(recordCalls[0].metadata.postTurn, postTurn);
  assert.equal(completeCalls.length, 1);
  assert.equal(completeCalls[0].responseMessageId, 42);
  assert.equal(completeCalls[0].metadata.status, 'completed');
  assert.equal(completeCalls[0].metadata.responseMessageId, null);
  assert.equal(completeCalls[0].metadata.responseContentHash, buildOneRingContentHash('visible answer'));
  assert.equal(completeCalls[0].metadata.completedAt, '2026-06-06T04:00:01.000Z');
});

test('completeOneRingPostTurnAfterRecord skips completion without successful assistant record id', () => {
  const postTurn = makePendingPostTurn();
  const storeCalls = [];
  const context = {
    oneRingPostTurnStore: {
      completePostTurn(metadata, responseMessageId) {
        storeCalls.push({ metadata, responseMessageId });
        return { updated: true, row: metadata };
      },
    },
  };
  const metadata = { postTurn };
  const candidate = { shouldRecord: true, role: 'assistant', content: 'visible answer' };

  assert.deepEqual(
    completeOneRingPostTurnAfterRecord(context, metadata, candidate, { recorded: false, reason: 'disabled' }),
    { completed: false, reason: 'disabled' },
  );
  assert.deepEqual(
    completeOneRingPostTurnAfterRecord(context, metadata, candidate, { recorded: true }),
    { completed: false, reason: 'missing-response-message-id' },
  );
  assert.deepEqual(storeCalls, []);
});

test('dispatchOneRingAssistantRecordCandidate falls back to OneRing plugin recorder', async () => {
  const calls = [];
  const oneRingModule = {
    recordAIResponseFromMessages(messages, content) {
      calls.push({ messages, content });
    },
  };
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      pluginManager: {
        messagePreprocessors: new Map([['OneRing', oneRingModule]]),
      },
    },
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
  );

  assert.equal(result.dispatched, true);

  await tick();

  assert.deepEqual(calls, [{
    messages: [{ role: 'user', content: 'hello' }],
    content: 'visible answer',
  }]);
});

test('dispatchOneRingAssistantRecordCandidate preserves legacy behavior when postTurn metadata is missing', async () => {
  const calls = [];
  const completeCalls = [];
  const result = dispatchOneRingAssistantRecordCandidate(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      oneRingPostTurnStore: {
        completePostTurn() {
          completeCalls.push('unexpected');
        },
      },
      onOneRingAssistantRecordCandidate: (candidate, metadata) => {
        calls.push({ candidate, metadata });
        return { recorded: true, id: 7 };
      },
    },
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
  );

  assert.equal(result.dispatched, true);

  await tick();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].metadata.postTurn, null);
  assert.deepEqual(completeCalls, []);
});

test('dispatchOneRingAssistantRecordCandidate does not complete post-turn when recorder throws', async () => {
  const originalError = console.error;
  const errors = [];
  const completeCalls = [];
  console.error = (...args) => errors.push(args);

  try {
    const result = dispatchOneRingAssistantRecordCandidate(
      {
        oneRingPostTurn: makePendingPostTurn(),
        oneRingPostTurnStore: {
          completePostTurn() {
            completeCalls.push('unexpected');
          },
        },
        onOneRingAssistantRecordCandidate: () => {
          throw new Error('record failed');
        },
      },
      { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
      { logPrefix: '[Test OneRing]' },
    );

    assert.equal(result.dispatched, true);

    await tick();

    assert.deepEqual(completeCalls, []);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /Error recording assistant candidate/);
  } finally {
    console.error = originalError;
  }
});

test('dispatchOneRingAssistantRecordCandidate does not require a recorder', async () => {
  const result = dispatchOneRingAssistantRecordCandidate(
    {},
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
  );

  await tick();

  assert.equal(result.dispatched, false);
  assert.equal(result.content, 'visible answer');
});
