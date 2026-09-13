'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const h = require('./fixtures/tdbRecoveryHarness.cjs');
const {witness} = require('../modules/tdbRecovery/artifacts');
async function setup(t, damage = 'healthy', opts = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-case-'));
    await h.seed(root);
    h.mutate(root, damage);
    const m = h.manager(root, { recovery: h.recoveryOptions(opts) });
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
        'healthy',
        'missing_text',
        'missing_meta',
        'missing_both',
        'invalid_text'
    ])
    test(`actual implementation repairs ${ damage }, verifies complete source/IDs and preserves B`, async t => {
        const {root, r} = await setup(t, damage);
        const b = witness(path.join(root, 'store'), 'B');
        const j = r.request({
            library: 'A',
            reason: damage
        });
        const result = await r.run(j.job_id);
        assert.equal(result.state, 'COMMITTED', JSON.stringify({
            state: result.state,
            error: result.last_error
        }));
        assert.equal(result.verification_receipt.orphan_count, 0);
        assert.equal(result.verification_receipt.source_count, 3);
        assert.ok(result.verification_receipt.semantic_probes.some(p => p.kind === 'long_tail'));
        assert.ok(fs.readFileSync(path.join(root, 'knowledge/A/doc0.md'), 'utf8').indexOf('tailonlyalpha') > 500);
        assert.deepEqual(witness(path.join(root, 'store'), 'B'), b);
        assert.equal(r.admission.state('A').blocked, false);
        assert.equal(r.autoPublish, false);
        assert.throws(() => r.request({
            library: 'A',
            automatic: true
        }), /AUTO_RECOVERY_DISABLED/);
    });
const {withSourceMutation} = require('../modules/tdbRecovery/writer');
const {verify, lossless} = require('../modules/tdbRecovery/verifier');
const {fingerprint} = require('../modules/tdbRecovery/snapshot');
function error(code) {
    return Object.assign(new Error(code), { code });
}
for (const change of [
        'modified',
        'added',
        'deleted',
        'recipe',
        'live_epoch',
        'failed_writer'
    ])
    test(`actual staleness fence rejects ${ change } after build`, async t => {
        let root, r, m;
        const env = await setup(t, 'healthy', {
            checkpoint: async point => {
                if (point !== 'VERIFIED')
                    return;
                if (change === 'recipe')
                    m.config.model = 'changed-recipe';
                else if (change === 'live_epoch')
                    r.journal.bump('A', 'live');
                else
                    await withSourceMutation({
                        journalRoot: r.root,
                        sourceRoot: m.config.rootPath,
                        library: 'A'
                    }, async () => {
                        if (change === 'modified')
                            fs.appendFileSync(path.join(root, 'knowledge/A/doc0.md'), ' changed');
                        if (change === 'added')
                            fs.writeFileSync(path.join(root, 'knowledge/A/added.md'), 'new quasar');
                        if (change === 'deleted')
                            fs.unlinkSync(path.join(root, 'knowledge/A/doc2.md'));
                        if (change === 'failed_writer')
                            throw error('INJECTED_WRITER_FAIL');
                    }).catch(e => {
                        if (change !== 'failed_writer')
                            throw e;
                    });
            }
        });
        ({root, r, m} = env);
        const before = witness(m.config.storePath, 'A');
        const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
        assert.equal(result.state, 'STALE', result.last_error);
        assert.match(result.last_error, /STALE_/);
        assert.deepEqual(witness(m.config.storePath, 'A'), before);
        assert.equal(result.commit_receipt, null);
    });
for (const failure of [
        'embedding',
        'indexText',
        'flush',
        'read',
        'disk',
        'partial',
        'verify'
    ])
    test(`candidate ${ failure } failure leaves exact live witness`, async t => {
        let m, r;
        const env = await setup(t);
        ({m, r} = env);
        const before = witness(m.config.storePath, 'A');
        let original;
        if (failure === 'embedding') {
            h.setEmbedding(async () => {
                throw error('ETIMEDOUT');
            });
            t.after(() => h.setEmbedding());
        }
        if (failure === 'partial') {
            h.setEmbedding(async texts => texts.map(() => null));
            t.after(() => h.setEmbedding());
        }
        if (failure === 'disk')
            r.options.minimumFreeBytes = Number.MAX_SAFE_INTEGER;
        if ([
                'indexText',
                'flush'
            ].includes(failure)) {
            original = r.native.prototype[failure];
            r.native.prototype[failure] = function () {
                throw error('INJECTED_' + failure);
            };
            t.after(() => r.native.prototype[failure] = original);
        }
        if (failure === 'read') {
            const read = h.d.read;
            h.d.read = (root, file) => {
                if (root === m.config.rootPath && file.endsWith('doc0.md'))
                    throw error('EIO');
                return read(root, file);
            };
            t.after(() => h.d.read = read);
        }
        if (failure === 'verify')
            r.options.checkpoint = p => {
                if (p === 'BUILT') {
                    const j = r.journal.all().at(-1);
                    fs.writeFileSync(r.jobPath(j, 'candidate/store/A.tdb.text.meta'), 'corrupt');
                }
            };
        if (failure === 'disk') {
            assert.throws(() => r.request({ library: 'A' }), /CAPACITY/);
            assert.deepEqual(witness(m.config.storePath, 'A'), before);
            return;
        }
        const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
        assert.equal(result.state, 'FAILED', JSON.stringify({
            state: result.state,
            error: result.last_error
        }));
        assert.equal(result.commit_receipt, null);
        assert.deepEqual(witness(m.config.storePath, 'A'), before);
    });
for (const point of [
        'MID_FILE_0',
        'MID_METADATA',
        'AFTER_METADATA',
        'SWITCHED',
        'POST_VERIFYING',
        'POST_VERIFIED'
    ])
    test(`failure at ${ point } restores exact old generation and B rowset`, async t => {
        const {m, r} = await setup(t, 'missing_text', {
            checkpoint: p => {
                if (p === point)
                    throw error('INJECTED_PUBLISH_FAIL');
            }
        });
        const before = witness(m.config.storePath, 'A'), b = witness(m.config.storePath, 'B'), gen = r.journal.epoch('A').generation;
        const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
        assert.equal(result.state, 'ROLLED_BACK', result.last_error);
        assert.deepEqual(witness(m.config.storePath, 'A'), before);
        assert.deepEqual(witness(m.config.storePath, 'B'), b);
        assert.equal(r.journal.epoch('A').generation, gen);
        assert.equal(r.admission.state('A').blocked, false);
    });
test('rollback failure persists quarantine and blocks A while B is admitted', async t => {
    const {r} = await setup(t, 'healthy', {
        checkpoint: p => {
            if ([
                    'POST_VERIFYING',
                    'ROLLBACK_FILE'
                ].includes(p))
                throw error('FAULT');
        }
    });
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'ROLLBACK_FAILED');
    assert.throws(() => r.admission.assert('A'), /ROLLBACK/);
    r.admission.assert('B');
});
test('source writer at publish boundary cannot acquire source lease', async t => {
    let r, m, attempts = 0;
    ({r, m} = await setup(t, 'healthy', {
        checkpoint: async p => {
            if (p === 'PREPARED') {
                await assert.rejects(withSourceMutation({
                    journalRoot: r.root,
                    sourceRoot: m.config.rootPath,
                    library: 'A'
                }, async () => {
                    throw error('WRITER_ENTERED');
                }), /LEASE_BUSY/);
                attempts++;
            }
        }
    }));
    const j = r.request({ library: 'A' });
    assert.equal((await r.run(j.job_id)).state, 'COMMITTED');
    assert.equal(attempts, 1);
});
test('held native reader drains before switch; B search proceeds; escaped handle denied', async t => {
    let r, m, release, hold, observed = false;
    ({r, m} = await setup(t, 'healthy', {
        checkpoint: async p => {
            if (p === 'VERIFIED') {
                hold = r.admission.use('A', async () => {
                    const handle = m.getOrOpenLibrary('A');
                    m._beginLibraryUse(handle);
                    await new Promise(resolve => release = resolve);
                    m._endLibraryUse(handle);
                });
                setTimeout(async () => {
                    try {
                        assert.equal(r.admission.state('A').blocked, true);
                        const hits = await m.searchLibrary('B', 'quokka', [
                            1,
                            0
                        ], { minScore: 0 });
                        assert.ok(hits.length);
                        observed = true;
                    } finally {
                        release();
                    }
                }, 20);
            }
        }
    }));
    const j = r.request({ library: 'A' });
    const result = await r.run(j.job_id);
    await hold;
    assert.equal(result.state, 'COMMITTED', result.last_error);
    assert.ok(observed);
    assert.throws(() => m.getOrOpenLibrary('A'), /UNREGISTERED/);
    const hits = await m.searchLibrary('A', 'quasar', [
        1,
        0
    ], { minScore: 0 });
    assert.ok(hits[0].generation);
    assert.throws(() => m.reachable('A', hits[0].id), /UNQUALIFIED/);
});
test('strict close failure keeps admission blocked and cannot publish', async t => {
    let r, m;
    ({r, m} = await setup(t, 'healthy', {
        checkpoint: async p => {
            if (p === 'VERIFIED') {
                await m.searchLibrary('A', 'quasar', [
                    1,
                    0
                ], {});
                const handle = m.libs.get('A');
                const old = handle.db;
                handle.db = new Proxy(old, {
                    get(target, k) {
                        if (k === 'flush')
                            return () => {
                                throw error('FLUSH_FAILURE');
                            };
                        return target[k];
                    }
                });
            }
        }
    }));
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'ROLLBACK_FAILED');
    assert.equal(result.undo_receipt, null);
    assert.throws(() => r.admission.assert('A'));
});
test('retention refuses early cleanup; failed cleanup never rolls back and retry retires old', async t => {
    const {m, r} = await setup(t);
    const j = r.request({ library: 'A' });
    let result = await r.run(j.job_id);
    const newState = witness(m.config.storePath, 'A');
    await assert.rejects(r.retire(j.job_id), /RETENTION_ACTIVE/);
    r.options.checkpoint = p => {
        if (p === 'RETIRING')
            throw error('CLEANUP_FAILURE');
    };
    result = await r.retire(j.job_id, result.commit_receipt.time + 86400001);
    assert.equal(result.state, 'RETIRING');
    assert.deepEqual(witness(m.config.storePath, 'A'), newState);
    r.options.checkpoint = null;
    result = await r.retire(j.job_id, result.commit_receipt.time + 86400002);
    assert.equal(result.state, 'RETIRED');
    assert.deepEqual(witness(m.config.storePath, 'A'), newState);
});
test('all source files but missing one chunk is rejected by independent verifier', async t => {
    let r;
    ({r} = await setup(t, 'healthy', {
        checkpoint: p => {
            if (p === 'BUILT') {
                const j = r.journal.all().at(-1), SQL = require('better-sqlite3'), db = new SQL(r.jobPath(j, 'candidate/store/tdb_knowledge_meta.sqlite'));
                db.prepare('DELETE FROM chunks WHERE library=\'A\' AND path=\'A/doc1.md\'').run();
                db.close();
            }
        }
    }));
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'FAILED');
    assert.equal(result.commit_receipt, null);
    assert.ok(result.quarantined);
});
test('unknown active writer and unqualified canonical ownership fail before build', async t => {
    const {r} = await setup(t);
    r.options.writerInventory.A = [{
            id: 'shell',
            classification: 'EXTERNAL_UNGOVERNED'
        }];
    assert.throws(() => r.request({ library: 'A' }), /UNCOORDINATED/);
    r.options.writerInventory.A = [{
            id: 'operator',
            classification: 'QUIESCABLE',
            isQuiesced: () => true
        }];
    r.options.sourceOwned.A = false;
    assert.throws(() => r.request({ library: 'A' }), /OWNERSHIP/);
    assert.equal(r.journal.all().length, 0);
});
test('inspector is read only; structural health never means sparse/stale auto recovery', async t => {
    const {m, r} = await setup(t, 'missing_both');
    const before = witness(m.config.storePath, 'A');
    const result = r.inspect('A');
    assert.equal(result.damage_type, 'missing_both');
    assert.equal(result.automatic_eligible, true);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
    assert.throws(() => r.request({
        library: 'A',
        automatic: true,
        reason: 'sparse_detected'
    }), /AUTO_RECOVERY_DISABLED/);
});
test('concurrent same-library request coalesces origins; second publisher is excluded', async t => {
    const {r} = await setup(t);
    const a = r.request({
            library: 'A',
            origin: 'startup'
        }), b = r.request({
            library: 'A',
            origin: 'operator'
        });
    assert.equal(a.job_id, b.job_id);
    assert.deepEqual(b.origins, [
        'startup',
        'operator'
    ]);
    const lease = r.journal.acquire('A', 'publish');
    await assert.rejects(r.run(a.job_id), /LEASE_BUSY/);
    lease.release();
    assert.equal((await r.run(a.job_id)).state, 'COMMITTED');
});
test('A and B recovery jobs commit independently', async t => {
    const {r} = await setup(t);
    const a = r.request({ library: 'A' }), b = r.request({ library: 'B' });
    const results = await Promise.all([
        r.run(a.job_id),
        r.run(b.job_id)
    ]);
    assert.deepEqual(results.map(j => j.state), [
        'COMMITTED',
        'COMMITTED'
    ]);
});
for (const point of [
        'BUILD_SOURCE',
        'PREPARED'
    ])
    test(`shutdown at ${ point } joins/cancels actual registered recovery work`, async t => {
        let r, shutdown;
        ({r} = await setup(t, 'healthy', {
            checkpoint: p => {
                if (p === point && !shutdown)
                    shutdown = Promise.resolve().then(() => r.shutdown());
            }
        }));
        const j = r.request({ library: 'A' }), run = r.run(j.job_id);
        const result = await run;
        await shutdown;
        assert.equal(r.active.size, 0);
        assert.equal(result.state, point === 'BUILD_SOURCE' ? 'CANCELLED' : 'COMMITTED');
    });
test('symlink canonical input and path traversal are rejected before mutation', async t => {
    const {m, r} = await setup(t);
    assert.throws(() => r.request({ library: '../B' }), /UNSAFE/);
    fs.symlinkSync('/etc/hostname', path.join(m.config.rootPath, 'A/escape.md'));
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'FAILED');
    assert.equal(result.last_error, 'SYMLINK_REJECTED');
});
test('existing long-single-sentence chunker boundary fails closed without patching parser', async t => {
    const {m, r} = await setup(t);
    fs.writeFileSync(path.join(m.config.rootPath, 'A/doc0.md'), 'quasar ' + 'word '.repeat(9000) + 'tailonlyomega');
    const before = witness(m.config.storePath, 'A');
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'FAILED');
    assert.match(result.last_error, /LOSSY|MISSING_CANONICAL/);
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
});
test('real normal-ingest metadata attempt with unchanged bytes invalidates live generation', async t => {
    let m, r;
    ({m, r} = await setup(t, 'healthy', {
        checkpoint: async p => {
            if (p === 'VERIFIED') {
                const file = path.join(m.config.rootPath, 'A/doc0.md');
                fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
                await m.upsertFile(file);
            }
        }
    }));
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'STALE');
    assert.equal(result.last_error, 'STALE_LIVE_GENERATION');
});
test('unknown native graph data cannot be silently discarded', async t => {
    const {m, r} = await setup(t);
    await r.admission.use('A', () => {
        const handle = m.getOrOpenLibrary('A');
        handle.db.link(1, 2, 'custom-relation', 1);
        handle.db.flush();
        handle.db.close();
        m.libs.delete('A');
    });
    const before = witness(m.config.storePath, 'A');
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'FAILED');
    assert.equal(result.last_error, 'UNOWNED_GRAPH_REFERENCE');
    assert.deepEqual(witness(m.config.storePath, 'A'), before);
});
test('old in-place orphan regression is eliminated by the actual candidate implementation', async t => {
    const {m, r} = await setup(t);
    const SQL = require('better-sqlite3');
    m.metaDb.exec('DELETE FROM chunks WHERE library=\'A\';DELETE FROM files WHERE library=\'A\';');
    await m.upsertFile(path.join(m.config.rootPath, 'A/doc0.md'));
    await m.closeLibrary('A');
    const native = r.readNativeBaseline('A').node_count;
    const mapped = m.metaDb.prepare('SELECT COUNT(*) n FROM chunks WHERE library=\'A\'').get().n + m.metaDb.prepare('SELECT COUNT(*) n FROM files WHERE library=\'A\'').get().n;
    assert.ok(native > mapped);
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'COMMITTED', result.last_error);
    assert.equal(result.verification_receipt.orphan_count, 0);
    assert.equal(result.verification_receipt.node_count, 6);
});
test('snapshot supports explicit no-text disposition and ignored-source inventory', async t => {
    const {root, m, r} = await setup(t);
    fs.writeFileSync(path.join(m.config.rootPath, 'A/empty.md'), ' \n');
    fs.writeFileSync(path.join(m.config.rootPath, 'A/ignored.pdf'), 'not a supported ingestion source');
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'COMMITTED', result.last_error);
    assert.ok(result.snapshot_receipt.files.some(f => f.disposition === 'NO_TEXT_EXPECTED'));
    assert.deepEqual(result.snapshot_receipt.excluded, ['A/ignored.pdf']);
    assert.equal(result.verification_receipt.source_count, 3);
    assert.ok(result.verification_receipt.semantic_probes.some(p => p.kind === 'long_tail'));
    assert.ok(fs.readFileSync(path.join(root, 'knowledge/A/doc0.md'), 'utf8').indexOf('tailonlyalpha') > 500);
});
test('multi-sentence multi-chunk long content and long-tail terms recover completely', async t => {
    const {m, r} = await setup(t);
    fs.writeFileSync(path.join(m.config.rootPath, 'A/doc0.md'), ('quasar ' + 'filler '.repeat(120) + 'tailonlyend\u3002\n').repeat(90));
    const j = r.request({ library: 'A' }), result = await r.run(j.job_id);
    assert.equal(result.state, 'COMMITTED', result.last_error);
    assert.ok(result.verification_receipt.chunk_count > 3);
    assert.equal(result.verification_receipt.canonical_content, true);
    assert.equal(result.verification_receipt.exact_postings, true);
});
test('retiring an older committed job cannot reactivate it on fresh startup', async t => {
    const {root, m, r} = await setup(t);
    const first = await r.run(r.request({ library: 'A' }).job_id);
    const second = await r.run(r.request({ library: 'A' }).job_id);
    assert.equal(first.state, 'COMMITTED');
    assert.equal(second.state, 'COMMITTED');
    assert.ok(second.commit_receipt.serial > first.commit_receipt.serial);
    const expected = witness(m.config.storePath, 'A');
    assert.equal((await r.retire(first.job_id, first.commit_receipt.time + 86400001)).state, 'RETIRED');
    r.close();
    m.metaDb.close();
    const fresh = h.manager(root, { recovery: h.recoveryOptions() });
    await fresh.initialize();
    assert.equal(fresh.recovery.journal.epoch('A').generation, second.candidate_generation);
    assert.deepEqual(witness(fresh.config.storePath, 'A'), expected);
    fresh.recovery.close();
    fresh.metaDb.close();
});
test('actual manager shutdown joins publishing before closing metadata and journal', async t => {
    let m, shutdown;
    ({m} = await setup(t, 'healthy', {
        checkpoint: p => {
            if (p === 'PREPARED' && !shutdown)
                shutdown = Promise.resolve().then(() => m.shutdown());
        }
    }));
    const r = m.recovery;
    const result = await r.run(r.request({ library: 'A' }).job_id);
    await shutdown;
    assert.equal(result.state, 'COMMITTED');
    assert.equal(r.active.size, 0);
    assert.equal(r.journal.db.open, false);
    assert.ok(!m.metaDb || !m.metaDb.open);
});
test('detached async context cannot use a native handle after its admitted scope ends', async t => {
    const {m, r} = await setup(t);
    let release, escaped;
    await r.admission.use('A', async () => {
        const handle = m.getOrOpenLibrary('A');
        escaped = new Promise(resolve => release = resolve).then(() => handle.db.storageInfo());
    });
    release();
    await assert.rejects(escaped, /UNREGISTERED_NATIVE_HANDLE/);
});
