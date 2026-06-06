'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  createOneRingRecorder,
  normalizeRuntimeConfig,
} = require('../Plugin/OneRing/OneRing');

async function makeTempDir(prefix = 'onering-plugin-wrapper-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('normalizeRuntimeConfig keeps OneRing closed by default', () => {
  assert.deepEqual(normalizeRuntimeConfig({}), {
    ONERING_ENABLED: false,
    ONERING_RECORD_ONLY: true,
    ONERING_ALLOW_CONTEXT_PATCH: false,
    ONERING_USER_NAME: 'User',
    ONERING_DATA_DIR: '',
    ONERING_HOT_CONFIG_PATH: '',
    ONERING_MAX_DB_RECORDS: 100,
  });
});

test('OneRing plugin wrapper does not create a store while disabled', async () => {
  const tempParent = await makeTempDir();
  const baseDir = path.join(tempParent, 'data');
  const recorder = createOneRingRecorder({
    config: {
      ONERING_DATA_DIR: baseDir,
      ONERING_ENABLED: false,
    },
    hotConfig: { enabled: true },
  });

  const messages = [
    { role: 'system', content: '[[OneRing::Agnes::VChat::Only]]' },
    { role: 'user', content: 'hello' },
  ];

  assert.equal(await recorder.processMessages(messages), messages);
  await recorder.recordAIResponseFromMessages(messages, 'visible answer');

  await assert.rejects(fs.stat(baseDir), { code: 'ENOENT' });
});

test('OneRing plugin wrapper requires both runtime and hot config enablement', async () => {
  const tempParent = await makeTempDir();
  const baseDir = path.join(tempParent, 'data');
  const recorder = createOneRingRecorder({
    config: {
      ONERING_DATA_DIR: baseDir,
      ONERING_ENABLED: true,
    },
    hotConfig: { enabled: false },
  });

  const messages = [
    { role: 'system', content: '[[OneRing::Agnes::VChat::Only]]' },
    { role: 'user', content: 'hello' },
  ];

  await recorder.processMessages(messages);

  await assert.rejects(fs.stat(baseDir), { code: 'ENOENT' });
});

test('OneRing plugin wrapper records visible user and assistant messages in record-only mode', async () => {
  const tempParent = await makeTempDir();
  const baseDir = path.join(tempParent, 'data');
  const recorder = createOneRingRecorder({
    config: {
      ONERING_DATA_DIR: baseDir,
      ONERING_ENABLED: true,
      ONERING_USER_NAME: 'Ryan',
      ONERING_MAX_DB_RECORDS: 10,
    },
    hotConfig: { enabled: true },
    now: () => '2026-06-06T08:00:00.000Z',
  });

  const messages = [
    { role: 'system', content: 'prefix [[OneRing::Agnes::VChat::Only]]' },
    { role: 'user', content: '[小克的发言]: hello' },
  ];

  try {
    assert.equal(await recorder.processMessages(messages), messages);
    const assistantResult = await recorder.recordAIResponseFromMessages(messages, 'visible answer');

    assert.equal(assistantResult.recorded, true);
    assert.deepEqual(
      recorder.listMessages('Agnes').map(row => ({
        role: row.role,
        senderName: row.senderName,
        frontendSource: row.frontendSource,
        content: row.content,
        timestamp: row.timestamp,
      })),
      [
        {
          role: 'user',
          senderName: '小克',
          frontendSource: 'VChat',
          content: 'hello',
          timestamp: '2026-06-06T08:00:00.000Z',
        },
        {
          role: 'assistant',
          senderName: 'Agnes',
          frontendSource: 'VChat',
          content: 'visible answer',
          timestamp: '2026-06-06T08:00:00.000Z',
        },
      ],
    );
  } finally {
    recorder.shutdown();
  }
});

test('OneRing plugin wrapper resets runtime config on initialize reload', async () => {
  const tempParent = await makeTempDir();
  const baseDir = path.join(tempParent, 'data');
  const recorder = createOneRingRecorder({
    hotConfig: { enabled: true },
    now: () => '2026-06-06T08:00:00.000Z',
  });
  const messages = [
    { role: 'system', content: '[[OneRing::Agnes::VChat::Only]]' },
    { role: 'user', content: 'hello' },
  ];

  try {
    recorder.initialize({
      ONERING_ENABLED: true,
      ONERING_DATA_DIR: baseDir,
    });
    await recorder.processMessages(messages);
    assert.equal(recorder.listMessages('Agnes').length, 1);

    recorder.initialize({});
    const result = await recorder.recordAIResponseFromMessages(messages, 'visible answer');

    assert.equal(result.recorded, false);
    assert.equal(result.reason, 'disabled-or-empty');
    assert.equal(recorder._isEffectiveEnabled(), false);
  } finally {
    recorder.shutdown();
  }
});

test('OneRing plugin wrapper skips assistant records without trigger metadata', async () => {
  const tempParent = await makeTempDir();
  const baseDir = path.join(tempParent, 'data');
  const recorder = createOneRingRecorder({
    config: {
      ONERING_DATA_DIR: baseDir,
      ONERING_ENABLED: true,
    },
    hotConfig: { enabled: true },
  });

  const result = await recorder.recordAIResponseFromMessages(
    [{ role: 'user', content: 'plain' }],
    'visible answer',
  );

  assert.equal(result.recorded, false);
  assert.equal(result.reason, 'missing-trigger');
  await assert.rejects(fs.stat(baseDir), { code: 'ENOENT' });
});
