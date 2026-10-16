'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { VexusIndex } = require('../rust-vexus-lite');
const IndexRepository = require('../modules/knowledgeBase/indexRepository');
const { initializeKnowledgeBaseSchema } = require('../modules/knowledgeBase/schemaManager');

function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-baseline-synthetic-'));
  const db = new Database(path.join(directory, 'synthetic.sqlite'));
  db.pragma('foreign_keys = ON');
  initializeKnowledgeBaseSchema(db, { logPrefix: 'SyntheticChunkBaseline' });
  db.prepare('INSERT INTO files (id,path,diary_name,checksum,mtime,size) VALUES (1,?,?,?,?,?)')
    .run('synthetic.txt', 'SyntheticDiary', 'fixture', 1, 1);
  const repository = new IndexRepository({
    config: { storePath: directory, dimension: 4, modelSig: 'synthetic-model', persistDefault: true,
      persistFolders: new Set(), chunkIndexPersistenceMode: 'generational', chunkIndexBaselineDeltaRatio: 0.05 },
    VexusIndex, getDb: () => db, getDbPath: () => db.name, waitForCoordinatorIdle: async () => {}, ...overrides
  });
  const vector = id => new Float32Array(id === 1 ? [1, 0, 0, 0] : id === 2 ? [0, 1, 0, 0] : [0, 0, 1, 0]);
  const insert = id => db.prepare('INSERT INTO chunks (id,file_id,chunk_index,content,vector) VALUES (?,1,?,?,?)')
    .run(id, id, 'synthetic-' + id, Buffer.from(vector(id).buffer));
  t.after(() => { for (const timer of repository.saveTimers.values()) clearTimeout(timer);
    db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { db, repository, insert, vector };
}

test('chunk baselines replay the authoritative SQLite delta and rotate slots', async t => {
  const { db, repository, insert, vector } = fixture(t);
  const index = new VexusIndex(4, 16);
  for (const id of [1, 2]) { insert(id); index.add(id, vector(id)); }
  repository.diaryIndices.set('SyntheticDiary', index);
  assert.equal(repository.publishDiaryBaseline('SyntheticDiary', { force: true }), true);
  assert.equal(repository._readActiveDiaryBaseline('SyntheticDiary').slot, 'a');
  db.prepare('DELETE FROM chunks WHERE id=1').run();
  insert(3);
  const restored = await repository.loadDiaryBaseline('SyntheticDiary');
  assert.equal(restored.delta.upserts, 1);
  assert.equal(restored.delta.deletes, 1);
  assert.deepEqual(restored.index.search(vector(3), 10).map(hit => hit.id).sort(), [2, 3]);
  repository.diaryIndices.set('SyntheticDiary', restored.index);
  repository.publishDiaryBaseline('SyntheticDiary', { force: true });
  const active = repository._readActiveDiaryBaseline('SyntheticDiary');
  assert.equal(active.slot, 'b');
  assert.equal(active.generation, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_index_baselines').get().n, 1);
  assert.deepEqual((await repository.loadDiaryBaseline('SyntheticDiary')).index.search(vector(3), 10).map(hit => hit.id).sort(), [2, 3]);
});

test('a failed checkpoint keeps the previous ready baseline and a model mismatch rejects it', async t => {
  const { repository, insert, vector } = fixture(t);
  const index = new VexusIndex(4, 16);
  insert(1); index.add(1, vector(1));
  repository.diaryIndices.set('SyntheticDiary', index);
  repository.publishDiaryBaseline('SyntheticDiary', { force: true });
  const before = repository._readActiveDiaryBaseline('SyntheticDiary');
  repository.diaryIndices.set('SyntheticDiary', { save() { throw Error('synthetic disk failure'); } });
  assert.throws(() => repository.publishDiaryBaseline('SyntheticDiary', { force: true }), /synthetic disk failure/);
  assert.deepEqual(repository._readActiveDiaryBaseline('SyntheticDiary'), before);
  assert.ok((await repository.loadDiaryBaseline('SyntheticDiary')).index);
  repository.config.modelSig = 'different-synthetic-model';
  assert.equal(await repository.loadDiaryBaseline('SyntheticDiary'), null);
});

test('adding chunk baseline tables is idempotent and preserves existing chunk content and vectors', t => {
  const { db, insert } = fixture(t);
  insert(1);
  const before = db.prepare('SELECT * FROM chunks').all();
  db.exec('DROP TABLE chunk_index_baseline_entries; DROP TABLE chunk_index_baselines;');
  initializeKnowledgeBaseSchema(db);
  initializeKnowledgeBaseSchema(db);
  assert.deepEqual(db.prepare('SELECT * FROM chunks').all(), before);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_index_baselines').get().n, 0);
});

test('same-ID vector replacements are replayed and trigger a checkpoint', async t => {
  const { db, repository, insert, vector } = fixture(t);
  insert(1); insert(2);
  const index = new VexusIndex(4, 16);
  index.add(1, vector(1)); index.add(2, vector(2));
  repository.diaryIndices.set('SyntheticDiary', index);
  repository.publishDiaryBaseline('SyntheticDiary', { force: true });
  const replacement = vector(3);
  db.prepare('DELETE FROM chunks WHERE id=2').run();
  db.prepare('INSERT INTO chunks (id,file_id,chunk_index,content,vector) VALUES (2,1,2,?,?)')
    .run('synthetic-replacement', Buffer.from(replacement.buffer));
  const restored = await repository.loadDiaryBaseline('SyntheticDiary');
  assert.equal(restored.delta.upserts, 1);
  const nearest = restored.index.search(replacement, 1)[0];
  assert.equal(nearest.id, 2);
  assert.ok(nearest.score > 0.99);
  repository.diaryIndices.set('SyntheticDiary', restored.index);
  assert.equal(repository.publishDiaryBaseline('SyntheticDiary'), true);
  assert.equal(repository._countDiaryBaselineDelta('SyntheticDiary', 2).delta, 0);
  assert.ok((await repository.loadDiaryBaseline('SyntheticDiary')).index.search(replacement, 1)[0].score > 0.99);
});

test('legacy baseline entries migrate additively and unknown revisions force replay', async t => {
  const { db, repository, insert, vector } = fixture(t);
  insert(1);
  const index = new VexusIndex(4, 16);
  index.add(1, vector(1));
  repository.diaryIndices.set('SyntheticDiary', index);
  repository.publishDiaryBaseline('SyntheticDiary', { force: true });
  db.exec('ALTER TABLE chunk_index_baseline_entries DROP COLUMN vector_revision');
  const chunks = db.prepare('SELECT * FROM chunks').all();
  initializeKnowledgeBaseSchema(db);
  initializeKnowledgeBaseSchema(db);
  assert.deepEqual(db.prepare('SELECT * FROM chunks').all(), chunks);
  assert.equal((await repository.loadDiaryBaseline('SyntheticDiary')).delta.upserts, 1);
});

test('failed and partial initial recoveries cannot publish or cache an empty baseline', async t => {
  const { db, repository, insert } = fixture(t);
  insert(1); insert(2);
  for (const fail of [async () => { throw Error('synthetic recovery failure'); }, async () => 1]) {
    repository.VexusIndex = class { async recoverFromSqlite() { return fail(); } };
    await assert.rejects(repository.getOrLoad('SyntheticDiary'), /synthetic recovery failure|recovery count mismatch/);
    assert.equal(repository.diaryIndices.has('SyntheticDiary'), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_index_baselines').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_index_baseline_entries').get().n, 0);
    assert.equal(repository.loadPromises.size, 0);
  }
  repository.VexusIndex = VexusIndex;
  const recovered = await repository.getOrLoad('SyntheticDiary');
  assert.equal(recovered.search(new Float32Array([1, 0, 0, 0]), 10).length, 2);
  assert.equal(repository._readActiveDiaryBaseline('SyntheticDiary').chunkCount, 2);
});

test('a failed recovery with no chunks also fails closed instead of publishing zero', async t => {
  const { db, repository } = fixture(t);
  repository.VexusIndex = class { async recoverFromSqlite() { throw Error('synthetic empty-db failure'); } };
  await assert.rejects(repository.getOrLoad('SyntheticDiary'), /synthetic empty-db failure/);
  assert.equal(repository.diaryIndices.size, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chunk_index_baselines').get().n, 0);
  repository.VexusIndex = VexusIndex;
  await repository.getOrLoad('SyntheticDiary');
  assert.equal(repository._readActiveDiaryBaseline('SyntheticDiary').chunkCount, 0);
});

test('scheduled and forced checkpoints cannot publish between SQLite commit and native delta', async t => {
  let busy = false;
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const idle = new Promise(resolve => { release = resolve; });
  const { db, repository, insert, vector } = fixture(t, {
    isMutationActive: () => busy,
    waitForCoordinatorIdle: async () => { entered(); if (busy) await idle; }
  });
  insert(1);
  const index = new VexusIndex(4, 16);
  index.add(1, vector(1));
  repository.diaryIndices.set('SyntheticDiary', index);
  repository.publishDiaryBaseline('SyntheticDiary', { force: true });
  const before = repository._readActiveDiaryBaseline('SyntheticDiary');
  repository.config.indexSaveDelay = 1;
  repository.scheduleSave('SyntheticDiary');
  repository.saveTimers.get('SyntheticDiary').ref();
  busy = true;
  db.prepare('UPDATE chunks SET vector=? WHERE id=1').run(Buffer.from(vector(3).buffer));
  await waiting;
  assert.deepEqual(repository._readActiveDiaryBaseline('SyntheticDiary'), before);
  assert.equal(repository.publishDiaryBaseline('SyntheticDiary', { force: true }), false);
  repository.config.indexIdleTTL = 0;
  repository.lastUsed.set('SyntheticDiary', 0);
  repository.evictIdle();
  assert.equal(repository.diaryIndices.get('SyntheticDiary'), index);
  await index.applyChunkDelta([1], [1], vector(3));
  busy = false;
  release();
  await repository.flushAndStop();
  assert.equal(repository._readActiveDiaryBaseline('SyntheticDiary').generation, before.generation + 1);
  const restored = await repository.loadDiaryBaseline('SyntheticDiary');
  assert.equal(restored.delta.delta, 0);
  assert.ok(restored.index.search(vector(3), 1)[0].score > 0.99);
});
