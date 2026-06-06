'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAssistantRecordCandidate,
  buildStreamAssistantRecordCandidate,
  buildNonStreamAssistantRecordCandidate,
  buildCombinedAssistantRecordCandidate,
} = require('../modules/oneringHandlerAdapter');

test('stream success records only visible assistant content', () => {
  const result = buildStreamAssistantRecordCandidate({
    outcome: 'success',
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

test('stream result requires explicit success before recording visible content', () => {
  const result = buildStreamAssistantRecordCandidate({
    content: 'legacy collected text',
    raw: 'legacy raw stream',
    message: {
      content: 'partial visible answer',
      reasoning_content: 'hidden reasoning',
    },
  });

  assert.deepEqual(result, {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'missing-stream-success',
  });
});

test('stream helper result metadata blocks non-recordable partial content', () => {
  assert.equal(
    buildStreamAssistantRecordCandidate({
      outcome: 'idle-timeout',
      recordable: false,
      partial: true,
      message: { content: 'partial timeout answer' },
    }).reason,
    'idle-timeout',
  );

  assert.equal(
    buildStreamAssistantRecordCandidate({
      outcome: 'client-abort',
      recordable: false,
      partial: true,
      message: { content: 'partial client abort answer' },
    }).reason,
    'client-abort',
  );

  assert.equal(
    buildStreamAssistantRecordCandidate({
      outcome: 'stream-abort',
      recordable: false,
      partial: true,
      error: { name: 'AbortError', message: 'aborted', type: 'aborted' },
      message: { content: 'partial stream abort answer' },
    }).reason,
    'stream-abort',
  );
});

test('stream helper recordable flag does not replace explicit success', () => {
  assert.deepEqual(
    buildStreamAssistantRecordCandidate({
      recordable: true,
      partial: false,
      message: { content: 'visible but missing outcome' },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'missing-stream-success',
    },
  );

  assert.deepEqual(
    buildStreamAssistantRecordCandidate({
      outcome: 'success',
      recordable: false,
      partial: false,
      message: { content: 'visible but non-recordable' },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'non-recordable-stream-result',
    },
  );

  assert.deepEqual(
    buildStreamAssistantRecordCandidate({
      outcome: 'success',
      recordable: true,
      partial: true,
      message: { content: 'visible but partial' },
    }),
    {
      shouldRecord: false,
      role: 'assistant',
      content: '',
      reason: 'partial-stream-result',
    },
  );
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

test('stream invalid inputs return skip candidates without throwing', () => {
  assert.deepEqual(buildStreamAssistantRecordCandidate(null), {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'invalid-stream-result',
  });

  assert.deepEqual(buildStreamAssistantRecordCandidate('bad input'), {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'invalid-stream-result',
  });
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

test('non-stream invalid inputs return skip candidates without throwing', () => {
  assert.deepEqual(buildNonStreamAssistantRecordCandidate(null), {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'invalid-nonstream-result',
  });

  assert.deepEqual(buildNonStreamAssistantRecordCandidate('bad input'), {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'invalid-nonstream-result',
  });
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

test('combined assistant record candidate joins only recordable assistant content', () => {
  assert.deepEqual(
    buildCombinedAssistantRecordCandidate([
      { shouldRecord: false, role: 'assistant', content: 'skip me', reason: 'partial' },
      { shouldRecord: true, role: 'assistant', content: ' first visible ', reason: null },
      { shouldRecord: true, role: 'user', content: 'wrong role', reason: null },
      { shouldRecord: true, role: 'assistant', content: 'second visible', reason: null },
    ]),
    {
      shouldRecord: true,
      role: 'assistant',
      content: 'first visible\nsecond visible',
      reason: null,
    },
  );

  assert.deepEqual(buildCombinedAssistantRecordCandidate([]), {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'empty-assistant-record-candidates',
  });
});
