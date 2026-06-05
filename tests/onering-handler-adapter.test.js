'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAssistantRecordCandidate,
  buildStreamAssistantRecordCandidate,
  buildNonStreamAssistantRecordCandidate,
} = require('../modules/oneringHandlerAdapter');

test('stream success records only visible assistant content', () => {
  const result = buildStreamAssistantRecordCandidate({
    message: {
      content: 'visible answer',
      reasoning_content: 'hidden reasoning',
    },
  });

  assert.deepEqual(result, {
    shouldRecord: true,
    role: 'assistant',
    content: 'visible answer',
    reason: null,
  });
});

test('stream success supports multimodal visible text and ignores reasoning parts', () => {
  const result = buildStreamAssistantRecordCandidate({
    status: 'done',
    message: {
      content: [
        { type: 'text', text: 'first' },
        { reasoning_content: 'hidden' },
        { type: 'text', value: 'second' },
      ],
      reasoning_content: 'hidden root',
    },
  });

  assert.deepEqual(result, {
    shouldRecord: true,
    role: 'assistant',
    content: 'first\nsecond',
    reason: null,
  });
});

test('stream abort, idle timeout, and read errors are not recorded', () => {
  assert.deepEqual(
    buildStreamAssistantRecordCandidate({
      aborted: true,
      message: { content: 'partial' },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'stream-aborted',
    },
  );

  assert.equal(
    buildStreamAssistantRecordCandidate({
      idleTimeout: true,
      message: { content: 'partial' },
    }).reason,
    'stream-idle-timeout',
  );

  assert.equal(
    buildStreamAssistantRecordCandidate({
      error: new Error('read failed'),
      message: { content: 'partial' },
    }).reason,
    'stream-error',
  );
});

test('non-stream success records only parsed message content', () => {
  const result = buildNonStreamAssistantRecordCandidate({
    ok: true,
    payload: {
      choices: [
        {
          message: {
            content: 'visible non-stream answer',
            reasoning_content: 'hidden non-stream reasoning',
          },
        },
      ],
    },
  });

  assert.deepEqual(result, {
    shouldRecord: true,
    role: 'assistant',
    content: 'visible non-stream answer',
    reason: null,
  });
});

test('non-stream ignores reasoning even if caller provides direct message', () => {
  const result = buildNonStreamAssistantRecordCandidate({
    ok: true,
    message: {
      reasoning_content: 'hidden only',
      content: [{ type: 'text', text: 'visible direct message' }],
    },
  });

  assert.deepEqual(result, {
    shouldRecord: true,
    role: 'assistant',
    content: 'visible direct message',
    reason: null,
  });
});

test('non-stream upstream errors and raw fallback bodies are skipped', () => {
  assert.deepEqual(
    buildNonStreamAssistantRecordCandidate({
      ok: false,
      payload: {
        choices: [{ message: { content: 'should not record' } }],
      },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'upstream-error',
    },
  );

  assert.deepEqual(
    buildNonStreamAssistantRecordCandidate({
      ok: true,
      rawBody: '{"not":"chat"}',
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'empty-visible-content',
    },
  );
});

test('empty visible content is skipped', () => {
  assert.deepEqual(
    buildAssistantRecordCandidate({
      message: { content: '  ', reasoning_content: 'hidden' },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'empty-visible-content',
    },
  );
});

test('adapter does not mutate handler result objects', () => {
  const streamResult = {
    message: {
      content: 'visible',
      reasoning_content: 'hidden',
    },
  };

  const before = JSON.stringify(streamResult);
  buildStreamAssistantRecordCandidate(streamResult);

  assert.equal(JSON.stringify(streamResult), before);
});
