'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { VexusIndex, NativeKnowledgeRuntime } = require('../rust-vexus-lite');
const IndexRepository = require('../modules/knowledgeBase/indexRepository');
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const DIARY = 'SyntheticDiary';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-baseline-native-'));
  const dbPath = path.join(directory, 'synthetic.sqlite');
  const runtime = new NativeKnowledgeRuntime(new VexusIndex(4, 16));
  runtime.openAndInitStore(dbPath);
  const db = new Database(dbPath);
  db.prepare('INSERT INTO files(id,path,diary_name,checksum,mtime,size) VALUES (1,?,?,?,?,?)')
    .run('synthetic.txt', DIARY, 'fixture', 1, 1);
  const repository = new IndexRepository({
    config: { storePath: directory, dimension: 4, modelSig: 'synthetic-model', persistDefault: true,
      persistFolders: new Set(), chunkIndexPersistenceMode: 'generational', chunkIndexAllowInitial: true,
      chunkIndexBaselineDeltaRatio: 0.05 },
    VexusIndex, getNativeRuntime: () => runtime, getDbPath: () => dbPath,
    waitForCoordinatorIdle: async () => {},
  });
  const vector = id => new Float32Array(id === 1 ? [1, 0, 0, 0] : id === 2 ? [0, 1, 0, 0] : [0, 0, 1, 0]);
  const insert = id => db.prepare('INSERT INTO chunks(id,file_id,chunk_index,content,vector) VALUES (?,1,?,?,?)')
    .run(id, id, 'synthetic-' + id, Buffer.from(vector(id).buffer));
  const restore = async () => {
    const index = new VexusIndex(4, 16);
    const receipt = await repository.restoreDiaryIndex(DIARY, index, 16);
    repository.diaryIndices.set(DIARY, index);
    runtime.registerDiaryIndex(DIARY, index);
    return { index, receipt };
  };
  const baseline = () => db.prepare('SELECT generation,slot FROM chunk_index_baselines WHERE diary_name=? ORDER BY generation DESC LIMIT 1').get(DIARY);
  const search = async query => parse(await runtime.searchDiaryIndices([DIARY], query, 10, 10)).results;
  t.after(() => {
    for (const timer of repository.saveTimers.values()) clearTimeout(timer);
    db.close(); runtime.shutdown(); fs.rmSync(directory, { recursive: true, force: true });
  });
  return { db, dbPath, runtime, repository, insert, vector, restore, baseline, search };
}

test('native chunk baselines replay SQL additions/deletions and rotate slots', async t => {
  const f = fixture(t);
  f.insert(1); f.insert(2); await f.restore();
  assert.equal(await f.repository.publishDiaryBaseline(DIARY), true);
  assert.deepEqual(f.baseline(), { generation: 1, slot: 'a' });
  f.db.prepare('DELETE FROM chunks WHERE id=1').run(); f.insert(3);
  const { index, receipt } = await f.restore();
  assert.equal(receipt.restored, true);
  assert.deepEqual((await f.search(f.vector(3))).map(hit => hit.id).sort(), [2, 3]);
  assert.equal(await f.repository.publishDiaryBaseline(DIARY), true);
  assert.deepEqual(f.baseline(), { generation: 2, slot: 'b' });
});

test('native chunk restore replays same-ID vector replacements', async t => {
  const f = fixture(t);
  f.insert(1); f.insert(2); await f.restore();
  await f.repository.publishDiaryBaseline(DIARY);
  f.db.prepare('DELETE FROM chunks WHERE id=2').run();
  f.db.prepare('INSERT INTO chunks(id,file_id,chunk_index,content,vector) VALUES (2,1,2,?,?)')
    .run('synthetic-replacement', Buffer.from(f.vector(3).buffer));
  const { index } = await f.restore();
  const hit = (await f.search(f.vector(3)))[0];
  assert.equal(hit.id, 2); assert.ok(hit.score > 0.99);
  assert.equal(await f.repository.publishDiaryBaseline(DIARY), true);
  assert.equal(await f.repository.publishDiaryBaseline(DIARY, { force: true }), false,
    'legacy force flag must not republish unchanged native snapshots');
});

test('native schema migration preserves facts and legacy revision evidence', async t => {
  const f = fixture(t);
  f.insert(1); await f.restore(); await f.repository.publishDiaryBaseline(DIARY);
  f.db.exec('ALTER TABLE chunk_index_baseline_entries DROP COLUMN chunk_vector_sig; ALTER TABLE chunk_index_baseline_entries ADD COLUMN vector_revision TEXT;');
  f.db.prepare('UPDATE chunk_index_baseline_entries SET vector_revision=?').run('legacy-revision-evidence');
  const facts = f.db.prepare('SELECT * FROM chunks').all();
  f.runtime.openAndInitStore(f.dbPath); f.runtime.openAndInitStore(f.dbPath);
  assert.deepEqual(f.db.prepare('SELECT * FROM chunks').all(), facts);
  const row = f.db.prepare('SELECT vector_revision,chunk_vector_sig FROM chunk_index_baseline_entries').get();
  assert.equal(row.vector_revision, 'legacy-revision-evidence');
  assert.equal(row.chunk_vector_sig, null);
  const { index } = await f.restore();
  assert.equal((await f.search(f.vector(1)))[0].id, 1);
});

test('failed native checkpoint preserves the previous ready baseline', async t => {
  const f = fixture(t);
  f.insert(1); await f.restore(); await f.repository.publishDiaryBaseline(DIARY);
  const before = f.baseline();
  f.insert(2); await f.restore();
  f.db.exec("CREATE TRIGGER reject_checkpoint BEFORE INSERT ON chunk_index_baselines BEGIN SELECT RAISE(ABORT,'synthetic checkpoint failure'); END;");
  await assert.rejects(f.repository.publishDiaryBaseline(DIARY), /synthetic checkpoint failure/);
  assert.deepEqual(f.baseline(), before);
  f.db.exec('DROP TRIGGER reject_checkpoint;');
  assert.equal(await f.repository.publishDiaryBaseline(DIARY), true);
});

test('failed native restore never caches an index or publishes a baseline', async t => {
  const f = fixture(t);
  f.insert(1);
  f.repository.getNativeRuntime = () => ({ async restoreDiaryIndex() { throw new Error('synthetic restore failure'); } });
  await assert.rejects(f.repository.getOrLoad(DIARY), /synthetic restore failure/);
  assert.equal(f.repository.diaryIndices.size, 0);
  assert.equal(f.repository.loadPromises.size, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM chunk_index_baselines').get().n, 0);
});

test('native file scope keeps ID-only callers compatible and scopes metadata without vectors', async t => {
  const f = fixture(t);
  f.db.prepare('INSERT INTO files(id,path,diary_name,checksum,mtime,size) VALUES (2,?,?,?,?,?)')
    .run('other.txt', 'OtherDiary', 'other', 1, 1);
  assert.deepEqual(parse(await f.runtime.getFileIdsByDiaries(f.dbPath, [DIARY])), [1]);
  assert.deepEqual(parse(await f.runtime.getFileIdsByDiaries(f.dbPath, [DIARY], true)),
    [{ id: 1, path: 'synthetic.txt' }]);
  assert.deepEqual(parse(await f.runtime.getFileIdsByDiaries(f.dbPath, ["' OR 1=1 --"], true)), []);
});
