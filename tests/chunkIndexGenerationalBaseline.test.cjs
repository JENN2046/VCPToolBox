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

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-baseline-synthetic-'));
  const db = new Database(path.join(directory, 'synthetic.sqlite'));
  db.pragma('foreign_keys = ON');
  initializeKnowledgeBaseSchema(db, { logPrefix: 'SyntheticChunkBaseline' });
  db.prepare('INSERT INTO files (id,path,diary_name,checksum,mtime,size) VALUES (1,?,?,?,?,?)')
    .run('synthetic.txt', 'SyntheticDiary', 'fixture', 1, 1);
  const repository = new IndexRepository({
    config: { storePath: directory, dimension: 4, modelSig: 'synthetic-model', persistDefault: true,
      persistFolders: new Set(), chunkIndexPersistenceMode: 'generational', chunkIndexBaselineDeltaRatio: 0.05 },
    VexusIndex, getDb: () => db, getDbPath: () => db.name, waitForCoordinatorIdle: async () => {}
  });
  const vector = id => new Float32Array(id === 1 ? [1, 0, 0, 0] : id === 2 ? [0, 1, 0, 0] : [0, 0, 1, 0]);
  const insert = id => db.prepare('INSERT INTO chunks (id,file_id,chunk_index,content,vector) VALUES (?,1,?,?,?)')
    .run(id, id, 'synthetic-' + id, Buffer.from(vector(id).buffer));
  t.after(() => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); });
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
