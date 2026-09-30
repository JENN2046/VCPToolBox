const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bridge = require('../Plugin/CodeSearcher/CodeSearcher');

test('Linux targets never select legacy binaries that ignore current manifest fields', () => {
    for (const arch of ['x64', 'arm64']) {
        const candidates = bridge.getCandidates(bridge.getTarget('linux', arch));
        assert.equal(candidates.some(candidate => /CodeSearcher-linux-(?:x64-musl|arm64)$/.test(candidate)), false);
        assert.equal(path.basename(candidates[0]), `CodeSearcher-${bridge.getTarget('linux', arch).triple}`);
    }
});

test('Linux host selects the source-matched rebuilt artifact', { skip: process.platform !== 'linux' }, () => {
    const selected = bridge.findExecutable();
    assert.equal(path.basename(selected), `CodeSearcher-${bridge.getTarget().triple}`);
});

test('Linux selects the declared libc and musl never falls back to host GNU builds', () => {
    for (const arch of ['x64', 'arm64']) {
        for (const libc of ['gnu', 'musl']) {
            const target = bridge.getTarget('linux', arch, libc);
            assert.ok(target.triple.endsWith(`-linux-${libc}`));
            const candidates = bridge.getCandidates(target);
            if (libc === 'musl') {
                assert.ok(candidates.every(candidate => candidate.includes('linux-musl')));
            }
        }
    }
    assert.equal(bridge.getTarget('linux', 'x64', 'unknown'), null);
});
