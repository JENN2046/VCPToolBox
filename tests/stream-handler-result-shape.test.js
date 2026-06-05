'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const StreamHandler = require('../modules/handlers/streamHandler');

test('stream helper success result keeps legacy fields and is recordable', () => {
  const message = { content: 'visible', reasoning_content: 'hidden' };
  const result = StreamHandler._buildStreamHelperResult({
    content: 'visiblehidden',
    raw: 'data: {...}',
    message,
    outcome: 'success',
  });

  assert.equal(result.content, 'visiblehidden');
  assert.equal(result.raw, 'data: {...}');
  assert.equal(result.message, message);
  assert.equal(result.outcome, 'success');
  assert.equal(result.recordable, true);
  assert.equal(result.partial, false);
});

test('stream helper idle timeout result is partial and not recordable', () => {
  const result = StreamHandler._buildStreamHelperResult({
    content: 'partial',
    raw: 'raw partial',
    message: { content: 'partial', reasoning_content: 'hidden' },
    outcome: 'idle-timeout',
  });

  assert.equal(result.outcome, 'idle-timeout');
  assert.equal(result.recordable, false);
  assert.equal(result.partial, true);
});

test('stream helper client abort result is partial and not recordable', () => {
  const result = StreamHandler._buildStreamHelperResult({
    content: 'partial',
    raw: 'raw partial',
    message: { content: 'partial', reasoning_content: 'hidden' },
    outcome: 'client-abort',
  });

  assert.equal(result.outcome, 'client-abort');
  assert.equal(result.recordable, false);
  assert.equal(result.partial, true);
});

test('stream helper aborted stream error carries sanitized error metadata', () => {
  const error = new Error('aborted by upstream');
  error.type = 'aborted';

  const result = StreamHandler._buildStreamHelperResult({
    content: 'partial',
    raw: 'raw partial',
    message: { content: 'partial', reasoning_content: 'hidden' },
    outcome: 'stream-abort',
    error,
  });

  assert.equal(result.outcome, 'stream-abort');
  assert.equal(result.recordable, false);
  assert.equal(result.partial, true);
  assert.deepEqual(result.error, {
    name: 'Error',
    message: 'aborted by upstream',
    type: 'aborted',
  });
});

test('stream helper defaults to non-recordable stream-error shape', () => {
  assert.deepEqual(StreamHandler._buildStreamHelperResult(), {
    content: '',
    raw: '',
    message: { content: '', reasoning_content: '' },
    outcome: 'stream-error',
    recordable: false,
    partial: true,
  });
});
