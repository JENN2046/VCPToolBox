'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_STORE_FILE_NAME,
  OneRingStore,
  normalizeMessageRecord,
} = require('../modules/oneringStore');

async function makeTempStoreDir(prefix = 'onering-store-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('OneRingStore requires an explicit baseDir', () => {
  assert.throws(() => new OneRingStore(), /baseDir/);
});

test('OneRingStore creates a sqlite file only inside the provided temp baseDir', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });

  try {
    assert.equal(store.dbPath, path.join(tempDir, DEFAULT_STORE_FILE_NAME));
    const stat = await fs.stat(store.dbPath);
    assert.equal(stat.isFile(), true);
  } finally {
    store.close();
  }
});

test('OneRingStore rejects fileName path traversal', async () => {
  const tempDir = await makeTempStoreDir();

  assert.throws(
    () => new OneRingStore({ baseDir: tempDir, fileName: '../escape.sqlite' }),
    /inside baseDir/,
  );

  assert.throws(
    () => new OneRingStore({ baseDir: tempDir, fileName: 'nested/store.sqlite' }),
    /inside baseDir/,
  );
});

test('OneRingStore adds and lists visible conversation messages by agent', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 10 });

  try {
    const first = store.addMessage({
      agentName: 'Agnes',
      role: 'user',
      senderName: 'Ryan',
      frontendSource: 'VChat',
      content: 'hello',
      timestamp: '2026-06-06T04:00:00.000Z',
      postContextHash: 'hash-1',
    });
    const second = store.addMessage({
      agentName: 'Agnes',
      role: 'assistant',
      senderName: 'Agnes',
      frontendSource: 'VChat',
      content: 'hi',
      timestamp: '2026-06-06T04:00:01.000Z',
    });
    store.addMessage({
      agentName: 'Other',
      role: 'user',
      content: 'not listed',
    });

    assert.equal(first.id > 0, true);
    assert.equal(second.id > first.id, true);

    assert.deepEqual(store.listMessages('Agnes'), [
      {
        id: first.id,
        agentName: 'Agnes',
        role: 'user',
        senderName: 'Ryan',
        frontendSource: 'VChat',
        content: 'hello',
        timestamp: '2026-06-06T04:00:00.000Z',
        postContextHash: 'hash-1',
      },
      {
        id: second.id,
        agentName: 'Agnes',
        role: 'assistant',
        senderName: 'Agnes',
        frontendSource: 'VChat',
        content: 'hi',
        timestamp: '2026-06-06T04:00:01.000Z',
        postContextHash: null,
      },
    ]);
    assert.equal(store.countMessages('Agnes'), 2);
    assert.equal(store.countMessages('Other'), 1);
  } finally {
    store.close();
  }
});

test('OneRingStore prunes old messages per agent with maxRecords', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 2 });

  try {
    store.addMessage({ agentName: 'Agnes', role: 'user', content: 'one' });
    store.addMessage({ agentName: 'Agnes', role: 'assistant', content: 'two' });
    store.addMessage({ agentName: 'Agnes', role: 'user', content: 'three' });
    store.addMessage({ agentName: 'Other', role: 'user', content: 'keep other' });

    assert.deepEqual(
      store.listMessages('Agnes').map((row) => row.content),
      ['two', 'three'],
    );
    assert.deepEqual(
      store.listMessages('Other').map((row) => row.content),
      ['keep other'],
    );
  } finally {
    store.close();
  }
});

test('OneRingStore supports limit reads without changing retention', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 5 });

  try {
    for (const content of ['one', 'two', 'three']) {
      store.addMessage({ agentName: 'Agnes', role: 'user', content });
    }

    assert.deepEqual(
      store.listMessages('Agnes', { limit: 2 }).map((row) => row.content),
      ['two', 'three'],
    );
    assert.equal(store.countMessages('Agnes'), 3);
  } finally {
    store.close();
  }
});

test('OneRingStore treats maxRecords zero as no pruning while keeping bounded default reads', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 0 });

  try {
    for (const content of ['one', 'two', 'three']) {
      store.addMessage({ agentName: 'Agnes', role: 'user', content });
    }

    assert.deepEqual(
      store.listMessages('Agnes').map((row) => row.content),
      ['one', 'two', 'three'],
    );
    assert.equal(store.countMessages('Agnes'), 3);
  } finally {
    store.close();
  }
});

test('normalizeMessageRecord validates required visible fields', () => {
  assert.deepEqual(
    normalizeMessageRecord({
      agentName: ' Agnes ',
      role: 'user',
      content: ' visible ',
    }),
    {
      agentName: 'Agnes',
      role: 'user',
      senderName: 'User',
      frontendSource: 'unknown',
      content: ' visible ',
      timestamp: '',
      postContextHash: null,
    },
  );

  assert.throws(() => normalizeMessageRecord({ role: 'tool', content: 'bad' }), /role|agentName/);
  assert.throws(() => normalizeMessageRecord({ agentName: 'Agnes', role: 'tool', content: 'bad' }), /role/);
  assert.throws(() => normalizeMessageRecord({ agentName: 'Agnes', role: 'user', content: ' ' }), /content/);
});

test('OneRingStore close is idempotent and blocks later operations', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });

  store.close();
  store.close();

  assert.throws(
    () => store.addMessage({ agentName: 'Agnes', role: 'user', content: 'after close' }),
    /closed/,
  );
});
