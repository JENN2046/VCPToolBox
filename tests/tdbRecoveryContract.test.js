'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const h = require('./fixtures/tdbRecoveryHarness.cjs');
const {witness} = require('../modules/tdbRecovery/artifacts');
const {verify} = require('../modules/tdbRecovery/verifier');
const {publish} = require('../modules/tdbRecovery/publish');
const {withSourceMutation} = require('../modules/tdbRecovery/writer');
async function setup(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-contract-'));
    await h.seed(root);
    const m = h.manager(root, { recovery: h.recoveryOptions() });
    await m.initialize();
    t.after(() => {
        if (m.recovery.journal.db.open)
            m.recovery.close();
        if (m.metaDb?.open)
            m.metaDb.close();
    });
    return {
        root,
        m,
        r: m.recovery
    };
}
for (const damage of [
        'missing_source',
        'wrong_source_identity',
        'duplicate_mapping',
        'custom_edge',
        'orphan',
        'invalid_vector'
    ])
    test(`independent verifier rejects candidate ${ damage } without any live mutation`, async t => {
        const {m, r} = await setup(t);
        const j = await r.run(r.request({ library: 'A' }).job_id);
        assert.equal(j.state, 'COMMITTED');
        const before = witness(m.config.storePath, 'A');
        const store = r.jobPath(j, 'candidate/store'), knowledge = r.jobPath(j, 'candidate/knowledge');
        const SQL = require('better-sqlite3'), db = new SQL(path.join(store, 'tdb_knowledge_meta.sqlite'));
        const chunks = db.prepare('SELECT * FROM chunks WHERE library=\'A\' ORDER BY node_id').all();
        if (damage === 'missing_source') {
            db.prepare('DELETE FROM files WHERE path=?').run(chunks[0].path);
            db.prepare('DELETE FROM chunks WHERE path=?').run(chunks[0].path);
        }
        if (damage === 'wrong_source_identity')
            db.prepare('UPDATE files SET path=\'A/wrong.md\' WHERE path=?').run(chunks[0].path);
        if (damage === 'duplicate_mapping')
            db.prepare('UPDATE chunks SET node_id=? WHERE id=?').run(chunks[0].node_id, chunks[1].id);
        db.close();
        if ([
                'custom_edge',
                'orphan',
                'invalid_vector'
            ].includes(damage)) {
            const native = new r.native(path.join(store, 'A.tdb'), {
                dim: 2,
                dtype: 'f32',
                storageMode: 'mmap',
                loadTextIndex: true,
                autoBuildQuiver: false
            });
            if (damage === 'custom_edge')
                native.link(chunks[0].node_id, chunks[1].node_id, 'external_ref', 1);
            else if (damage === 'orphan')
                native.insert([
                    1,
                    0
                ], {
                    type: 'chunk',
                    library: 'A',
                    source_path: 'A/removed.md'
                });
            else {
                // A finite but wrong-dimensional vector cannot be inserted; native must reject before seal.
                assert.throws(() => native.insert([
                    1,
                    0,
                    0
                ], { type: 'chunk' }));
                native.insert([
                    1,
                    0
                ], { type: 'unknown' });
            }
            native.buildTextIndex();
            native.flush();
            native.close();
        }
        await assert.rejects(verify(r, j, {
            store,
            knowledge,
            snapshot: j.snapshot_receipt
        }));
        assert.deepEqual(witness(m.config.storePath, 'A'), before);
    });
test('candidate artifacts have separate inodes and replaying committed job is a no-op', async t => {
    const {m, r} = await setup(t);
    const j = await r.run(r.request({ library: 'A' }).job_id);
    assert.notEqual(fs.statSync(path.join(m.config.storePath, 'A.tdb')).ino, fs.statSync(r.jobPath(j, 'candidate/store/A.tdb')).ino);
    const before = witness(m.config.storePath, 'A');
    assert.deepEqual(await r.run(j.job_id), j);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
});
for (const library of [
        'A',
        'B'
    ])
    test(`pending ${ library } ingest queue survives target A recovery with correct admission decision`, async t => {
        const {m, r} = await setup(t);
        m._scheduleBatch = () => {
        };
        // Keep the persisted queue pending; this fixture intentionally has no ingest worker.
        m._enqueueIngestJob('upsert', path.join(m.config.rootPath, library, library === 'A' ? 'doc0.md' : 'other.md'));
        const queue = m.metaDb.prepare('SELECT * FROM ingest_queue ORDER BY id').all(), before = witness(m.config.storePath, 'A');
        const result = await r.run(r.request({ library: 'A' }).job_id);
        assert.equal(result.state, library === 'A' ? 'FAILED' : 'COMMITTED', result.last_error);
        if (library === 'A')
            assert.deepEqual(witness(m.config.storePath, 'A'), before);
        assert.deepEqual(m.metaDb.prepare('SELECT * FROM ingest_queue ORDER BY id').all(), queue);
    });
test('actual source mutation during candidate build makes sealed old snapshot stale', async t => {
    const {m, r} = await setup(t);
    let changed = false;
    const before = witness(m.config.storePath, 'A');
    r.options.checkpoint = async p => {
        if (p === 'BUILD_SOURCE' && !changed) {
            changed = true;
            await withSourceMutation({
                journalRoot: r.root,
                sourceRoot: m.config.rootPath,
                library: 'A'
            }, async () => fs.appendFileSync(path.join(m.config.rootPath, 'A/doc0.md'), ' changed during build'));
        }
    };
    const result = await r.run(r.request({ library: 'A' }).job_id);
    assert.equal(result.state, 'STALE');
    assert.ok(result.verification_receipt?.pass);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
});
test('source changed after switch restores A exactly while preserving a concurrent B metadata update', async t => {
    const {m, r} = await setup(t);
    const before = witness(m.config.storePath, 'A');
    let b;
    r.options.checkpoint = p => {
        if (p === 'SWITCHED') {
            fs.appendFileSync(path.join(m.config.rootPath, 'A/doc0.md'), ' deliberately ungoverned isolated source mutation');
            m.metaDb.prepare('UPDATE files SET updated_at=updated_at+1 WHERE library=\'B\'').run();
            b = witness(m.config.storePath, 'B');
        }
    };
    const result = await r.run(r.request({ library: 'A' }).job_id);
    assert.equal(result.state, 'ROLLED_BACK', result.last_error);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
    assert.deepEqual(witness(m.config.storePath, 'B'), b);
});
test('publish refuses an unverified queued job without opening normal admission', async t => {
    const {m, r} = await setup(t);
    const before = witness(m.config.storePath, 'A'), j = r.request({ library: 'A' });
    await assert.rejects(publish(r, j, {}), /UNVERIFIED_CANDIDATE/);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
    assert.equal(r.admission.state('A').blocked, true);
});
