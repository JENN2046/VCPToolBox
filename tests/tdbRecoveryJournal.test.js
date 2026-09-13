'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {Journal} = require('../modules/tdbRecovery/journal');
const {Admission} = require('../modules/tdbRecovery/admission');
const {reconcile} = require('../modules/tdbRecovery/reconcile');
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-journal-'));
    const j = new Journal(root);
    t.after(() => j.close());
    return {
        j,
        root
    };
}
test('journal survives a new connection; CAS, state and dedup preserve identity', t => {
    const {j, root} = fixture(t);
    let job = j.create({
        library: 'A',
        reasons: ['missing_text'],
        origins: ['startup']
    });
    job = j.update(job.job_id, job.sequence, { state: 'QUEUED' });
    const merged = j.create({
        library: 'A',
        reasons: ['missing_meta'],
        origins: ['manual']
    });
    assert.equal(merged.job_id, job.job_id);
    assert.deepEqual(merged.origins, [
        'startup',
        'manual'
    ]);
    assert.throws(() => j.update(job.job_id, job.sequence, { state: 'SNAPSHOTTING' }), /STALE_JOURNAL/);
    assert.throws(() => j.update(job.job_id, merged.sequence, { state: 'COMMITTED' }), /ILLEGAL/);
    const other = new Journal(root);
    assert.equal(other.get(job.job_id).sequence, merged.sequence);
    other.close();
});
test('corrupt journal blocks readiness before normal discovery', async t => {
    const {j} = fixture(t);
    const job = j.create({
        library: 'A',
        reasons: ['manual'],
        origins: ['manual']
    });
    j.db.prepare('UPDATE jobs SET body=? WHERE id=?').run('{}', job.job_id);
    const a = new Admission();
    await assert.rejects(reconcile(j, a, {}), /CORRUPT/);
    assert.throws(() => a.assert('B'), /STARTUP/);
});
test('startup reconciliation precedes readiness and replays idempotently', async t => {
    const {j} = fixture(t);
    let job = j.create({
        library: 'A',
        reasons: ['manual'],
        origins: ['manual']
    });
    for (const state of [
            'QUEUED',
            'SNAPSHOTTING',
            'BUILDING'
        ])
        job = j.update(job.job_id, job.sequence, { state });
    const a = new Admission();
    assert.throws(() => a.assert('A'));
    await reconcile(j, a, {});
    assert.equal(j.get(job.job_id).state, 'FAILED');
    const seq = j.get(job.job_id).sequence;
    await reconcile(j, a, {});
    assert.equal(j.get(job.job_id).sequence, seq);
    a.assert('A');
});
test('cross-connection lease excludes writers and failed attempts advance epoch', t => {
    const {j, root} = fixture(t), other = new Journal(root);
    t.after(() => other.close());
    const lease = j.acquire('A', 'source');
    assert.throws(() => other.acquire('A', 'source'), /LEASE_BUSY/);
    const before = j.epoch('A').source;
    j.bump('A', 'source');
    lease.release();
    assert.equal(other.epoch('A').source, before + 1);
    other.acquire('A', 'source').release();
});
test('admission drains holders, rejects nested exclusive and leaves B usable', async () => {
    const a = new Admission();
    a.globalBlocked = false;
    let release;
    const hold = a.use('A', () => new Promise(r => release = r));
    let entered = false;
    const swap = a.exclusive('A', async () => {
        entered = true;
    });
    assert.throws(() => a.assert('A'));
    await a.use('B', () => Promise.resolve());
    assert.equal(entered, false);
    release();
    await hold;
    await swap;
    a.unblock('A');
    await a.use('A', () => assert.rejects(a.exclusive('A', async () => {
    }), /LOCK_ORDER/));
});
test('missing journal with retained job namespace fails closed', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-missingjournal-'));
    fs.mkdirSync(path.join(root, 'jobs'));
    assert.throws(() => new Journal(root), /JOURNAL_MISSING/);
});
test('illegal persisted publishing phase cannot be accepted even with valid checksum', async t => {
    const {j} = fixture(t);
    const job = j.create({
        library: 'A',
        reasons: ['manual'],
        origins: ['manual']
    });
    const forged = {
        ...job,
        state: 'PUBLISHING',
        phase: 'UNKNOWN'
    };
    const {canonical, digest} = require('../modules/tdbRecovery/durable');
    j.db.prepare('UPDATE jobs SET body=?,checksum=? WHERE id=?').run(canonical(forged), digest(forged), job.job_id);
    const a = new Admission();
    await assert.rejects(reconcile(j, a, {}), /PHASE_INVALID/);
    assert.throws(() => a.assert('A'));
});
test('scheduler persists independent backoff and bounded retry attempts', t => {
    const {j, root} = fixture(t);
    const {Scheduler} = require('../modules/tdbRecovery/scheduler');
    let now = 1000;
    const s = new Scheduler(j, {
        clock: () => now,
        maxAttempts: 2
    });
    let job = s.queue({
        library: 'A',
        reasons: ['manual'],
        origins: ['operator']
    });
    job = s.attempt(job.job_id, 'build');
    s.retry(job.job_id, 'build', 'EIO');
    assert.throws(() => s.attempt(job.job_id, 'build'), /BACKOFF/);
    assert.equal(s.attempt(job.job_id, 'verify').verify_attempt, 1);
    now = 5000;
    assert.equal(s.attempt(job.job_id, 'build').build_attempt, 2);
    assert.throws(() => s.attempt(job.job_id, 'build'), /EXHAUSTED/);
    const next = new Journal(root);
    assert.equal(next.get(job.job_id).build_attempt, 2);
    next.close();
});
test('canonical coverage detects lossy or missing chunks independently of hash equality', () => {
    const {lossless} = require('../modules/tdbRecovery/verifier');
    assert.doesNotThrow(() => lossless('one two three', [
        'one two',
        'two three'
    ]));
    assert.throws(() => lossless('one two three', [
        'one two',
        'other'
    ]), /LOSSY/);
    assert.throws(() => lossless('one two three', ['one two']), /MISSING/);
});
test('ambiguous pre-switch phase and malformed retry counters block durable record acceptance', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-journal-shape-'));
    const j = new Journal(root);
    try {
        const job = j.create({
            library: 'A',
            reasons: ['manual'],
            origins: ['operator']
        });
        assert.throws(() => j.update(job.job_id, job.sequence, { phase: 'UNKNOWN' }), /JOURNAL_PHASE_INVALID/);
        assert.throws(() => j.update(job.job_id, job.sequence, { build_attempt: 'one' }), /JOURNAL_CORRUPT/);
        assert.equal(j.get(job.job_id).sequence, job.sequence);
    } finally {
        j.close();
    }
});
