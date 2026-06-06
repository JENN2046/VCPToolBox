'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { dispatchOneRingAssistantRecordCandidate } = require('../modules/oneringHandlerWiring');

function tick() {
  return new Promise(resolve => setImmediate(resolve));
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

test('dispatchOneRingAssistantRecordCandidate does not require a recorder', async () => {
  const result = dispatchOneRingAssistantRecordCandidate(
    {},
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
  );

  await tick();

  assert.equal(result.dispatched, false);
  assert.equal(result.content, 'visible answer');
});
