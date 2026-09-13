'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), {spawnSync} = require('node:child_process');
const worker = path.join(__dirname, 'fixtures/tdbRecoveryHarness.cjs');
const points = [
    'SNAPSHOTTING',
    'BUILD_SOURCE',
    'BUILT',
    'VERIFIED',
    'PREPARING',
    'PREPARED',
    ...Array.from({ length: 7 }, (_, i) => 'MID_FILE_' + i),
    'MID_INSTALL_WRITE',
    'MID_METADATA',
    'AFTER_METADATA',
    'SWITCHED',
    'POST_VERIFYING',
    'POST_VERIFIED',
    'COMMITTED',
    'AFTER_RETIRE_FILE'
];
function run(...args) {
    return spawnSync(process.execPath, [
        worker,
        ...args
    ], {
        encoding: 'utf8',
        timeout: 90000
    });
}
function receipt(result) {
    assert.equal(result.status, 0, result.stderr);
    const row = result.stdout.split('\n').find(l => l.startsWith('RECEIPT '));
    assert.ok(row, result.stdout);
    return JSON.parse(row.slice(8));
}
const {witness} = require('../modules/tdbRecovery/artifacts');
for (const point of points)
    test(`real SIGKILL ${ point }: journal-first new-process recovery is idempotent`, () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-crash-'));
        const seed = run('seed', root);
        assert.equal(seed.status, 0, seed.stderr);
        const before = witness(path.join(root, 'store'), 'A'), b = witness(path.join(root, 'store'), 'B');
        const killed = run('recover', root, point);
        assert.equal(killed.signal, 'SIGKILL', killed.stderr + killed.stdout);
        const first = receipt(run('restart', root)), second = receipt(run('restart', root));
        assert.deepEqual(second, first);
        assert.equal(first.length, 1);
        assert.equal(first[0].blocked, false);
        if ([
                'COMMITTED',
                'AFTER_RETIRE_FILE'
            ].includes(point)) {
            assert.equal(first[0].state, point === 'COMMITTED' ? 'COMMITTED' : 'RETIRED');
            assert.notEqual(first[0].generation, first[0].old_generation);
        } else {
            assert.ok([
                'FAILED',
                'ROLLED_BACK'
            ].includes(first[0].state));
            assert.deepEqual(witness(path.join(root, 'store'), 'A'), before);
        }
        assert.deepEqual(witness(path.join(root, 'store'), 'B'), b);
    });
test('fresh startup restores partial second publish before opening historical first commit', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-tdb-recovery-impl-crash-history-'));
    assert.equal(run('seed', root).status, 0);
    assert.equal(receipt(run('recover', root)).state, 'COMMITTED');
    const before = witness(path.join(root, 'store'), 'A');
    const killed = run('recover', root, 'MID_FILE_2');
    assert.equal(killed.signal, 'SIGKILL', killed.stderr);
    const first = receipt(run('restart', root)), second = receipt(run('restart', root));
    assert.deepEqual(first, second);
    assert.deepEqual(first.map(j => j.state), [
        'COMMITTED',
        'ROLLED_BACK'
    ]);
    assert.deepEqual(witness(path.join(root, 'store'), 'A'), before);
});
