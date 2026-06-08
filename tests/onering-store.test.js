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
const {
  abortPostTurnMetadata,
  buildPendingPostTurnMetadata,
  completePostTurnMetadata,
} = require('../modules/oneringPostTurnMetadata');

async function makeTempStoreDir(prefix = 'onering-store-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function makePendingPostTurn(overrides = {}) {
  const turnId = overrides.turnId || 'turn_agnes_vchat_1';
  const result = buildPendingPostTurnMetadata({
    agentName: overrides.agentName || 'Agnes',
    frontendSource: overrides.frontendSource || 'VChat',
    postBlocks: overrides.postBlocks || [{ role: 'user', content: 'hello' }],
    now: () => overrides.now || '2026-06-06T04:00:00.000Z',
    makeId: () => turnId,
  });

  assert.equal(result.ok, true);
  return result.metadata;
}

function makeCompletedPostTurn(pending, overrides = {}) {
  const result = completePostTurnMetadata(
    pending,
    {
      shouldRecord: true,
      content: overrides.content || 'assistant reply',
    },
    { now: () => overrides.now || '2026-06-06T04:00:01.000Z' },
  );

  assert.equal(result.ok, true);
  return result.metadata;
}

function makeAbortedPostTurn(pending, overrides = {}) {
  const result = abortPostTurnMetadata(
    pending,
    overrides.reason || 'idle-timeout',
    { now: () => overrides.now || '2026-06-06T04:00:01.000Z' },
  );

  assert.equal(result.ok, true);
  return result.metadata;
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

test('OneRingStore enables foreign keys and creates post_turns schema idempotently', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });

  try {
    assert.equal(store.db.pragma('foreign_keys', { simple: true }), 1);
    const table = store.db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'post_turns'
    `).get();
    assert.equal(table.name, 'post_turns');

    const message = store.addMessage({
      agentName: 'Agnes',
      role: 'user',
      content: 'survives reopen',
    });
    assert.equal(message.id > 0, true);
  } finally {
    store.close();
  }

  const reopened = new OneRingStore({ baseDir: tempDir });
  try {
    assert.equal(reopened.db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(reopened.countMessages('Agnes'), 1);
  } finally {
    reopened.close();
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

test('OneRingStore updates message content only for the scoped owner', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 10 });

  try {
    const assistantMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'draft reply',
      timestamp: '2026-06-06T04:00:00.000Z',
    });
    const otherMessage = store.addMessage({
      agentName: 'Other',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'other reply',
    });

    assert.deepEqual(
      store.updateMessageContent(0, {
        agentName: 'Agnes',
        frontendSource: 'VChat',
        role: 'assistant',
        content: 'ignored',
      }),
      { updated: false, reason: 'invalid-message-id', row: null },
    );

    assert.deepEqual(
      store.updateMessageContent(assistantMessage.id, {
        agentName: 'Other',
        frontendSource: 'VChat',
        role: 'assistant',
        content: 'wrong agent',
      }),
      { updated: false, reason: 'missing-message-or-owner-mismatch', row: null },
    );
    assert.deepEqual(
      store.updateMessageContent(assistantMessage.id, {
        agentName: 'Agnes',
        frontendSource: 'OtherUI',
        role: 'assistant',
        content: 'wrong frontend',
      }),
      { updated: false, reason: 'missing-message-or-owner-mismatch', row: null },
    );
    assert.deepEqual(
      store.updateMessageContent(assistantMessage.id, {
        agentName: 'Agnes',
        frontendSource: 'VChat',
        role: 'user',
        content: 'wrong role',
      }),
      { updated: false, reason: 'missing-message-or-owner-mismatch', row: null },
    );

    const updated = store.updateMessageContent(assistantMessage.id, {
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'final reply',
      timestamp: '2026-06-06T04:00:01.000Z',
    });
    assert.equal(updated.updated, true);
    assert.equal(updated.reason, null);
    assert.equal(updated.row.content, 'final reply');
    assert.equal(updated.row.timestamp, '2026-06-06T04:00:01.000Z');

    assert.equal(store.listMessages('Other')[0].content, 'other reply');
    assert.equal(store.listMessages('Agnes')[0].content, 'final reply');
    assert.equal(otherMessage.id > assistantMessage.id, true);
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

test('OneRingStore upserts pending post-turn metadata and returns camelCase rows', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });
  const pending = makePendingPostTurn();

  try {
    const row = store.upsertPostTurn(pending);

    assert.deepEqual(row, {
      turnId: 'turn_agnes_vchat_1',
      agentName: 'Agnes',
      frontendSource: 'VChat',
      requestHash: pending.requestHash,
      requestBlockCount: 1,
      status: 'pending',
      responseMessageId: null,
      responseContentHash: null,
      createdAt: '2026-06-06T04:00:00.000Z',
      updatedAt: '2026-06-06T04:00:00.000Z',
      completedAt: null,
      abortedAt: null,
    });

    const refreshed = {
      ...pending,
      requestBlockCount: 2,
      updatedAt: '2026-06-06T04:00:02.000Z',
    };
    assert.equal(store.upsertPostTurn(refreshed).requestBlockCount, 2);
  } finally {
    store.close();
  }
});

test('OneRingStore completes pending post-turn only with owned assistant message', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });
  const pending = makePendingPostTurn();
  const completed = makeCompletedPostTurn(pending);

  try {
    store.upsertPostTurn(pending);
    const otherAgentMessage = store.addMessage({
      agentName: 'Other',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'wrong agent',
    });
    const otherFrontendMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'OtherUI',
      role: 'assistant',
      content: 'wrong source',
    });
    const userMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'user',
      content: 'wrong role',
    });
    const assistantMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'assistant reply',
    });

    assert.deepEqual(
      store.completePostTurn(completed, otherAgentMessage.id),
      { updated: false, reason: 'response-message-owner-mismatch', row: null },
    );
    assert.deepEqual(
      store.completePostTurn(completed, otherFrontendMessage.id),
      { updated: false, reason: 'response-message-owner-mismatch', row: null },
    );
    assert.deepEqual(
      store.completePostTurn(completed, userMessage.id),
      { updated: false, reason: 'response-message-role-mismatch', row: null },
    );
    assert.deepEqual(
      store.completePostTurn(completed, 0),
      { updated: false, reason: 'invalid-response-message-id', row: null },
    );
    assert.deepEqual(
      store.completePostTurn(completed, 999999),
      { updated: false, reason: 'missing-response-message', row: null },
    );

    const result = store.completePostTurn(completed, assistantMessage.id);
    assert.equal(result.updated, true);
    assert.equal(result.reason, null);
    assert.equal(result.row.status, 'completed');
    assert.equal(result.row.responseMessageId, assistantMessage.id);
    assert.equal(result.row.responseContentHash, completed.responseContentHash);
    assert.equal(result.row.completedAt, '2026-06-06T04:00:01.000Z');

    assert.equal(store.completePostTurn(completed, assistantMessage.id).updated, false);
  } finally {
    store.close();
  }
});

test('OneRingStore aborts only pending post-turns and clears response fields', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });
  const pending = makePendingPostTurn();
  const aborted = makeAbortedPostTurn(pending);

  try {
    store.upsertPostTurn(pending);
    const result = store.abortPostTurn(aborted);

    assert.equal(result.updated, true);
    assert.equal(result.reason, null);
    assert.equal(result.row.status, 'aborted');
    assert.equal(result.row.responseMessageId, null);
    assert.equal(result.row.responseContentHash, null);
    assert.equal(result.row.abortedAt, '2026-06-06T04:00:01.000Z');

    assert.equal(store.abortPostTurn(aborted).updated, false);
  } finally {
    store.close();
  }
});

test('OneRingStore lists recent completed post-turns by agent and frontend', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 10 });

  try {
    const oldPending = makePendingPostTurn({
      turnId: 'turn_old',
      now: '2026-06-06T04:00:00.000Z',
    });
    const newPending = makePendingPostTurn({
      turnId: 'turn_new',
      now: '2026-06-06T04:00:00.000Z',
    });
    const otherPending = makePendingPostTurn({
      turnId: 'turn_other',
      frontendSource: 'OtherUI',
      now: '2026-06-06T04:00:00.000Z',
    });
    store.upsertPostTurn(oldPending);
    store.upsertPostTurn(newPending);
    store.upsertPostTurn(otherPending);

    const oldMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'old',
    });
    const newMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'new',
    });
    const otherMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'OtherUI',
      role: 'assistant',
      content: 'other',
    });

    store.completePostTurn(
      makeCompletedPostTurn(oldPending, { content: 'old', now: '2026-06-06T04:00:01.000Z' }),
      oldMessage.id,
    );
    store.completePostTurn(
      makeCompletedPostTurn(newPending, { content: 'new', now: '2026-06-06T04:00:02.000Z' }),
      newMessage.id,
    );
    store.completePostTurn(
      makeCompletedPostTurn(otherPending, { content: 'other', now: '2026-06-06T04:00:03.000Z' }),
      otherMessage.id,
    );

    assert.deepEqual(
      store.listRecentCompletedPostTurns('Agnes', 'VChat').map((row) => row.turnId),
      ['turn_new', 'turn_old'],
    );
    assert.deepEqual(
      store.listRecentCompletedPostTurns('Agnes', 'VChat', { limit: 1 }).map((row) => row.turnId),
      ['turn_new'],
    );
  } finally {
    store.close();
  }
});

test('OneRingStore nulls completed post-turn response reference when retained messages are pruned', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir, maxRecords: 1 });
  const pending = makePendingPostTurn();
  const completed = makeCompletedPostTurn(pending);

  try {
    const assistantMessage = store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'assistant',
      content: 'assistant reply',
    });
    store.upsertPostTurn(pending);
    assert.equal(store.completePostTurn(completed, assistantMessage.id).updated, true);

    assert.doesNotThrow(() => store.addMessage({
      agentName: 'Agnes',
      frontendSource: 'VChat',
      role: 'user',
      content: 'newer message prunes assistant',
    }));

    const row = store.getPostTurn('Agnes', pending.turnId);
    assert.equal(row.status, 'completed');
    assert.equal(row.responseMessageId, null);
    assert.deepEqual(store.listRecentCompletedPostTurns('Agnes', 'VChat'), []);
  } finally {
    store.close();
  }
});

test('OneRingStore validates post-turn state transitions', async () => {
  const tempDir = await makeTempStoreDir();
  const store = new OneRingStore({ baseDir: tempDir });
  const pending = makePendingPostTurn();
  const completed = makeCompletedPostTurn(pending);
  const aborted = makeAbortedPostTurn(pending);

  try {
    assert.throws(() => store.upsertPostTurn(null), /post-turn metadata/);
    assert.throws(() => store.upsertPostTurn(completed), /pending metadata/);
    assert.throws(() => store.completePostTurn(pending, 1), /completed metadata/);
    assert.throws(() => store.abortPostTurn(pending), /aborted metadata/);

    assert.deepEqual(
      store.completePostTurn(completed, 1),
      { updated: false, reason: 'missing-response-message', row: null },
    );
    assert.deepEqual(
      store.abortPostTurn(aborted),
      { updated: false, reason: 'missing-pending-post-turn', row: null },
    );
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
  assert.throws(() => store.getPostTurn('Agnes', 'turn_closed'), /closed/);
});
