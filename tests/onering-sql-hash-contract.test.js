'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { diffContextBlocks } = require('../modules/oneringFuzzy');
const {
  buildOneRingContentHash,
  buildOneRingRequestHash,
  normalizeRequestBlocks,
  storeRowsToDiffBlocks,
} = require('../modules/oneringSqlHashContract');
const { OneRingStore } = require('../modules/oneringStore');

async function makeTempStoreDir(prefix = 'onering-sql-hash-contract-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('content hash is stable for equivalent visible SQL/hash text', () => {
  const marker = '[OneRing通知:Alice于2026-06-05 10:11:12发送于VChat]';

  assert.equal(
    buildOneRingContentHash(`[Alice的发言]： hello   world ${marker}`),
    buildOneRingContentHash('hello world'),
  );

  assert.notEqual(
    buildOneRingContentHash('hello world'),
    buildOneRingContentHash('hello brave world'),
  );
});

test('request hash normalizes post block text while preserving role and frontend identity', () => {
  const hashFromText = buildOneRingRequestHash([
    {
      role: 'user',
      senderName: ' Alice ',
      frontendSource: ' VChat ',
      text: '[Alice的发言]： hello   world',
    },
    {
      role: 'assistant',
      senderName: 'Agnes',
      frontendSource: 'VChat',
      content: 'hi there',
    },
  ]);
  const hashFromContent = buildOneRingRequestHash([
    {
      frontendSource: 'VChat',
      senderName: 'Alice',
      role: 'user',
      content: 'hello world',
    },
    {
      role: 'assistant',
      senderName: 'Agnes',
      frontendSource: 'VChat',
      text: 'hi there',
    },
  ]);

  assert.equal(hashFromText, hashFromContent);
  assert.notEqual(
    hashFromContent,
    buildOneRingRequestHash([
      { role: 'user', senderName: 'Alice', frontendSource: 'Other', content: 'hello world' },
      { role: 'assistant', senderName: 'Agnes', frontendSource: 'VChat', content: 'hi there' },
    ]),
  );
});

test('request block normalization ignores hidden reasoning and invalid block values', () => {
  assert.deepEqual(
    normalizeRequestBlocks([
      null,
      'bad',
      {
        role: 'user',
        senderName: 'Alice',
        frontendSource: 'VChat',
        content: [
          { type: 'text', text: 'visible' },
          { reasoning_content: 'hidden' },
        ],
      },
    ]),
    [
      {
        role: 'user',
        senderName: 'Alice',
        frontendSource: 'VChat',
        text: 'visible',
      },
    ],
  );
});

test('temp store rows become diff blocks without touching runtime OneRing data', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 10 });
  const requestHash = buildOneRingRequestHash([
    { role: 'user', senderName: 'Alice', frontendSource: 'VChat', content: 'hello world' },
    { role: 'assistant', senderName: 'Agnes', frontendSource: 'VChat', content: 'hi there' },
  ]);

  try {
    store.addMessage({
      agentName: 'Agnes',
      role: 'user',
      senderName: 'Alice',
      frontendSource: 'VChat',
      content: 'hello world',
      postContextHash: requestHash,
    });
    store.addMessage({
      agentName: 'Agnes',
      role: 'assistant',
      senderName: 'Agnes',
      frontendSource: 'VChat',
      content: 'hi there',
      postContextHash: requestHash,
    });

    assert.equal(store.dbPath.startsWith(tempDir), true);
    assert.equal(store.dbPath.includes(path.join('Plugin', 'OneRing', 'data')), false);

    const rows = store.listMessages('Agnes');
    assert.deepEqual(rows.map((row) => row.postContextHash), [requestHash, requestHash]);

    const diff = diffContextBlocks(
      [
        { role: 'user', content: '[Alice的发言]： hello   world' },
        { role: 'assistant', content: 'hi there' },
      ],
      storeRowsToDiffBlocks(rows),
    );

    assert.equal(diff.matchedCount, 2);
    assert.equal(diff.unknownCount, 0);
    assert.deepEqual(diff.editedBlocks, []);
    assert.deepEqual(diff.newBlocks, []);
    assert.equal(diff.reliable, true);
  } finally {
    store.close();
  }
});

test('store row conversion tolerates invalid rows without widening roles', () => {
  assert.deepEqual(
    storeRowsToDiffBlocks([
      null,
      { id: 1, role: 'user', content: 'hello' },
      { id: 2, role: 42, content: null },
    ]),
    [
      { id: 1, role: 'user', content: 'hello' },
      { id: 2, role: '', content: '' },
    ],
  );
});
