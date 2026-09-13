'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), {fork} = require('node:child_process');
const h = require('./fixtures/tdbRecoveryHarness.cjs');
const {OperatorControl} = require('../modules/tdbRecovery/operator-control');
const {start} = require('../modules/tdbRecovery/operator-server');
const {request} = require('../modules/tdbRecovery/operator-client');
function temp() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-operator-'));
}
async function fixture(t, {dispatch = () => {
    }, clock} = {}) {
    const root = temp();
    await h.seed(root);
    const m = h.manager(root, { recovery: h.recoveryOptions() });
    await m.initialize();
    const ctlRoot = path.join(root, 'control');
    fs.mkdirSync(ctlRoot, { mode: 448 });
    const c = new OperatorControl(m.recovery, {
        root: ctlRoot,
        dispatch,
        clock
    });
    t.after(async () => {
        if (m.recovery.journal.db.open)
            m.recovery.close();
        if (m.metaDb?.open)
            m.metaDb.close();
    });
    return {
        root,
        m,
        r: m.recovery,
        c,
        ctlRoot
    };
}
const command = (operation, fields = {}) => ({
    operation,
    ...fields
});
const query = {
    library: 'A',
    reason: 'missing_text',
    origin: 'OPERATOR_TEST'
};
const enable = c => c.handle(command('ENABLE_MANUAL', {
    library: 'A',
    origin: 'OPERATOR_TEST',
    ttl_seconds: 60
}));
function journalBytes(r) {
    return r.journal.db.prepare('SELECT * FROM jobs ORDER BY id').all();
}
test('STATUS read-only, disabled submit, enable idempotence, scope, shared validate, expiry and disable', async t => {
    let now = 1000;
    const {c, r} = await fixture(t, { clock: () => now });
    const before = journalBytes(r), epochs = r.journal.db.prepare('SELECT * FROM epochs').all();
    assert.equal(c.handle(command('STATUS')).manual.enabled, false);
    assert.throws(() => c.handle(command('SUBMIT', query)), /MANUAL_RECOVERY_DISABLED/);
    const grant = enable(c);
    assert.deepEqual(enable(c), grant);
    assert.equal(c.status().auto_enabled, false);
    assert.throws(() => c.handle(command('VALIDATE', {
        ...query,
        library: 'B'
    })), /MANUAL_LIBRARY_SCOPE/);
    assert.equal(c.handle(command('VALIDATE', query)).validated, true);
    assert.deepEqual(journalBytes(r), before);
    assert.deepEqual(r.journal.db.prepare('SELECT * FROM epochs').all(), epochs);
    now = grant.expires_at;
    assert.equal(c.status().manual.enabled, false);
    assert.throws(() => c.handle(command('SUBMIT', query)), /MANUAL_RECOVERY_DISABLED/);
    assert.deepEqual(c.handle(command('DISABLE_MANUAL')), c.handle(command('DISABLE_MANUAL')));
});
test('invalid paths/wildcards/fields/reasons and automatic requests fail closed; unknown target is never created', async t => {
    const {c, r, m} = await fixture(t);
    for (const library of [
            '*',
            '../A',
            '/tmp/A',
            ''
        ])
        assert.throws(() => c.handle(command('ENABLE_MANUAL', { library })));
    assert.throws(() => c.handle(command('ENABLE_MANUAL')));
    assert.throws(() => c.handle(command('SUBMIT', {
        ...query,
        candidate_path: '/tmp'
    })), /INVALID_OPERATOR_FIELD/);
    enable(c);
    assert.throws(() => c.handle(command('VALIDATE', {
        ...query,
        reason: 'invented'
    })), /INVALID_RECOVERY_REASON/);
    assert.throws(() => c.handle(command('VALIDATE', {
        ...query,
        automatic: true
    })), /AUTO_RECOVERY_DISABLED/);
    c.handle(command('DISABLE_MANUAL'));
    c.handle(command('ENABLE_MANUAL', { library: 'RECOVERY-LIVE-ACCEPTANCE-RESERVED' }));
    assert.throws(() => c.handle(command('VALIDATE', {
        ...query,
        library: 'RECOVERY-LIVE-ACCEPTANCE-RESERVED'
    })), /UNKNOWN_LIBRARY/);
    assert.equal(fs.existsSync(path.join(m.config.rootPath, 'RECOVERY-LIVE-ACCEPTANCE-RESERVED')), false);
    assert.equal(r.journal.all().length, 0);
});
test('SUBMIT goes through Coordinator/Scheduler durable readback, one shot, dedup, JOB_STATUS readonly', async t => {
    let dispatched = 0;
    const {c, r} = await fixture(t, { dispatch: () => dispatched++ });
    enable(c);
    let calls = 0;
    const validate = r.coordinator.validate.bind(r.coordinator);
    r.coordinator.validate = input => {
        calls++;
        return validate(input);
    };
    const receipt = c.handle(command('SUBMIT', query));
    assert.equal(receipt.state, 'QUEUED');
    assert.equal(c.status().manual.enabled, false);
    assert.equal(dispatched, 1);
    assert.equal(r.journal.get(receipt.job_id).sequence, receipt.sequence);
    assert.equal(calls, 1);
    assert.throws(() => c.handle(command('SUBMIT', query)), /MANUAL_RECOVERY_DISABLED/);
    enable(c);
    const second = c.handle(command('SUBMIT', query));
    assert.equal(second.job_id, receipt.job_id);
    assert.equal(r.journal.all().length, 1);
    assert.equal(dispatched, 1);
    const before = journalBytes(r);
    assert.equal(c.handle(command('JOB_STATUS', { job_id: receipt.job_id })).state, 'QUEUED');
    assert.deepEqual(journalBytes(r), before);
    assert.throws(() => c.handle(command('JOB_STATUS', { job_id: 'bad' })), /INVALID_JOB_ID/);
});
test('job status preserves all existing state names without mutating journal records', async t => {
    const {c, r} = await fixture(t);
    const id = '11111111-1111-1111-1111-111111111111';
    const original = r.journal.get.bind(r.journal), seq = 10;
    for (const state of [
            'QUEUED',
            'BUILDING',
            'READY_TO_PUBLISH',
            'COMMITTED',
            'FAILED',
            'ROLLED_BACK',
            'ROLLBACK_FAILED'
        ]) {
        // Accessor-only fixture; recovery state semantics remain independently covered by real journal/crash suites.
        r.journal.get = () => ({
            job_id: id,
            library: 'A',
            state,
            phase: 'fixture',
            sequence: seq,
            last_error: null,
            base_live_generation: { generation: 'fixture' }
        });
        const before = journalBytes(r);
        assert.equal(c.jobStatus(id).state, state);
        assert.deepEqual(journalBytes(r), before);
    }
    r.journal.get = original;
});
test('journal corruption is visible in STATUS and denies enable/validation without a job', async t => {
    const {c, r} = await fixture(t);
    const original = r.journal.all.bind(r.journal);
    r.journal.all = () => {
        throw Error('corruption');
    };
    assert.equal(c.status().journal_healthy, false);
    assert.throws(() => enable(c), /JOURNAL_UNHEALTHY/);
    r.journal.all = original;
    assert.equal(r.journal.all().length, 0);
});
test('uncontrolled writers and ROLLBACK_FAILED deny submit via same policy; audit is classified and durable', async t => {
    const {c, r, ctlRoot} = await fixture(t);
    enable(c);
    r.options.writerInventory.A = [{
            id: 'external',
            classification: 'EXTERNAL_UNGOVERNED'
        }];
    assert.throws(() => c.handle(command('VALIDATE', query)), /UNCOORDINATED_WRITER/);
    r.options.writerInventory.A = [{
            id: 'fixture',
            classification: 'READ_ONLY'
        }];
    const original = r.journal.all.bind(r.journal);
    r.journal.all = () => [{
            job_id: 'blocked',
            library: 'A',
            state: 'ROLLBACK_FAILED'
        }];
    assert.deepEqual(c.status().rollback_failed_jobs, ['blocked']);
    assert.throws(() => c.handle(command('SUBMIT', query)), /INCOMPATIBLE_RECOVERY/);
    r.journal.all = original;
    const audit = fs.readFileSync(c.auditPath, 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(audit.some(x => x.result_class === 'UNCOORDINATED_WRITER'));
    assert.ok(audit.every(x => x.authority_class === 'LOCAL_OS_UID' && !('token' in x) && !('source' in x)));
    assert.equal(fs.statSync(c.auditPath).mode & 511, 384);
    assert.equal(r.journal.all().length, 0);
});
test('Unix socket authority, no TCP bind, bad request denial and unavailable main never falls back', async t => {
    const {r, root} = await fixture(t);
    const server = await start(r, {
        root: path.join(root, 'ipc'),
        dispatch: () => {
        }
    });
    t.after(() => server.close());
    assert.equal(typeof server.server.address(), 'string');
    assert.equal(fs.statSync(server.socket).mode & 511, 384);
    assert.equal(fs.statSync(path.dirname(server.socket)).mode & 511, 448);
    const s = await request(command('STATUS'), { socket: server.socket });
    assert.equal(s.pid, process.pid);
    assert.equal(s.job_count, 0);
    await assert.rejects(request(command('SUBMIT', query), { socket: server.socket }), /MANUAL_RECOVERY_DISABLED/);
    await assert.rejects(request(command('STATUS'), { socket: server.socket + '.missing' }), /MAIN_OPERATOR_UNAVAILABLE/);
    const bad = path.join(root, 'world');
    fs.mkdirSync(bad, { mode: 493 });
    await assert.rejects(start(r, { root: bad }), /UNSAFE_OPERATOR_DIRECTORY/);
});
test('actual child main control process restart resets manual OFF', async t => {
    const root = temp();
    await h.seed(root);
    const childPath = path.join(__dirname, 'fixtures/tdbRecoveryOperatorChild.cjs');
    async function boot() {
        const child = fork(childPath, [root], {
            stdio: [
                'ignore',
                'ignore',
                'pipe',
                'ipc'
            ]
        });
        let errors = '';
        child.stderr.on('data', b => errors += b);
        const ready = await new Promise((resolve, reject) => {
            child.once('message', resolve);
            child.once('exit', code => reject(Error('child exit ' + code + ' ' + errors)));
        });
        return {
            child,
            ready
        };
    }
    async function stop(child) {
        await new Promise(resolve => {
            child.once('exit', resolve);
            child.send('stop');
        });
    }
    const first = await boot();
    await request(command('ENABLE_MANUAL', { library: 'A' }), { socket: first.ready.socket });
    assert.equal((await request(command('STATUS'), { socket: first.ready.socket })).manual.enabled, true);
    await stop(first.child);
    const second = await boot();
    const status = await request(command('STATUS'), { socket: second.ready.socket });
    assert.notEqual(second.ready.pid, first.ready.pid);
    assert.equal(status.manual.enabled, false);
    assert.equal(status.auto_enabled, false);
    assert.equal(status.job_count, 0);
    await stop(second.child);
});
test('accepted operator SUBMIT invokes actual existing isolated recovery pipeline after durable queue', async t => {
    const {r, c} = await fixture(t, { dispatch: fn => setImmediate(fn) });
    enable(c);
    const job = c.handle(command('SUBMIT', query));
    assert.equal(job.state, 'QUEUED');
    for (let i = 0; i < 400; i++) {
        if (r.journal.get(job.job_id).state === 'COMMITTED')
            break;
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    const result = r.journal.get(job.job_id);
    assert.equal(result.state, 'COMMITTED', result.last_error);
    assert.equal(c.status().manual.enabled, false);
    assert.equal(c.status().auto_enabled, false);
});
test('trusted qualification adapter uses existing writer policy and expiry/hash fence, without granting requests itself', async t => {
    let now = 1000;
    const {c, r, ctlRoot} = await fixture(t, { clock: () => now });
    r.options.sourceOwned = {};
    r.options.writerInventory = {};
    const file = path.join(ctlRoot, 'qualified-writers.json');
    const profile = {
        A: {
            sourceOwned: true,
            expires_at: now + 120000,
            writers: [
                {
                    id: 'app',
                    classification: 'LEASE_AWARE',
                    protocol: 'VCP_TDB_SOURCE_LEASE_V1'
                },
                {
                    id: 'operator',
                    classification: 'QUIESCABLE',
                    positively_quiesced: true
                }
            ]
        }
    };
    fs.writeFileSync(file, JSON.stringify(profile), { mode: 384 });
    enable(c);
    assert.equal(c.handle(command('VALIDATE', query)).validated, true);
    c.handle(command('DISABLE_MANUAL'));
    assert.doesNotThrow(() => r.assertWriters('A'));
    assert.throws(() => c.handle(command('SUBMIT', query)), /MANUAL_RECOVERY_DISABLED/);
    enable(c);
    fs.appendFileSync(file, ' ');
    assert.throws(() => c.handle(command('VALIDATE', query)), /UNCOORDINATED_WRITER/);
    c.handle(command('DISABLE_MANUAL'));
    enable(c);
    now += 120000;
    assert.throws(() => r.assertWriters('A'), /UNCOORDINATED_WRITER/);
    c.handle(command('DISABLE_MANUAL'));
    assert.throws(() => enable(c), /WRITER_QUALIFICATION_INVALID/);
    assert.equal(r.journal.all().length, 0);
});
test('audit failures revoke authorization; invalid requests are audited without unsafe input content', async t => {
    const {c, r, ctlRoot} = await fixture(t);
    enable(c);
    assert.throws(() => c.handle(command('SUBMIT', {
        ...query,
        source_text: 'SENSITIVE_TEST_SENTINEL'
    })), /INVALID_OPERATOR_FIELD/);
    const file = c.auditPath;
    assert.equal(fs.readFileSync(file, 'utf8').includes('SENSITIVE_TEST_SENTINEL'), false);
    fs.chmodSync(file, 420);
    assert.throws(() => c.handle(command('VALIDATE', query)), /OPERATOR_AUDIT_UNHEALTHY/);
    assert.equal(c.status().manual.enabled, false);
    assert.equal(c.status().audit_healthy, false);
    assert.equal(r.journal.all().length, 0);
});
test('disable does not cancel already accepted recovery execution', async t => {
    let resume;
    const {r, c} = await fixture(t, {
        dispatch: fn => {
            resume = fn;
        }
    });
    enable(c);
    const job = c.handle(command('SUBMIT', query));
    c.handle(command('DISABLE_MANUAL'));
    resume();
    for (let i = 0; i < 400; i++) {
        if (r.journal.get(job.job_id).state === 'COMMITTED')
            break;
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(r.journal.get(job.job_id).state, 'COMMITTED');
    assert.equal(c.status().manual.enabled, false);
});
