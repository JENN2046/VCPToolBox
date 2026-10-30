'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const target = path.join(__dirname, 'external-native-host-config.test.cjs');
const jso = process.env.JSO_SOURCE, extensions = process.env.JSO_EXTENSIONS_ROOT;

function run(t, paths, expectedStatus, skipped, expectedError) {
    const env = { ...process.env };
    delete env.JSO_SOURCE; delete env.JSO_EXTENSIONS_ROOT;
    // A subprocess must not inherit the parent node:test worker context.
    delete env.NODE_TEST_CONTEXT;
    Object.assign(env, paths);
    const start = Date.now();
    const result = spawnSync(process.execPath, ['--test-reporter=tap', target], {
        env, encoding: 'utf8', timeout: 6000, killSignal: 'SIGTERM'
    });
    t.diagnostic(JSON.stringify({ elapsedMs: Date.now() - start, status: result.status,
        signal: result.signal, timedOut: result.error?.code === 'ETIMEDOUT' }));
    assert.equal(result.error, undefined, 'test process must exit naturally within six seconds');
    assert.equal(result.signal, null);
    assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
    assert.equal(result.stdout.includes('SKIP'), skipped);
    if (expectedError) assert.match(result.stdout + result.stderr, expectedError);
    if (!skipped) assert.match(result.stdout, expectedStatus === 0 ? /(?:#|ℹ) pass 1/ : /(?:#|ℹ) fail 1/);
}

for (const paths of [{}, {JSO_SOURCE: '/synthetic-unused'}, {JSO_EXTENSIONS_ROOT: '/synthetic-unused'}]) {
    test('missing integration paths skips and exits: ' + Object.keys(paths).join(','), t => run(t, paths, 0, true));
}

test('early JSO import failure also releases the manager watcher', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-jso-'));
    t.after(() => fs.rmSync(root, {recursive:true,force:true}));
    run(t, {JSO_SOURCE:root,JSO_EXTENSIONS_ROOT:root}, 1, false, /ERR_MODULE_NOT_FOUND/);
});

test('configured real integration exits naturally', {skip: !jso || !extensions}, t => {
    run(t, {JSO_SOURCE:jso,JSO_EXTENSIONS_ROOT:extensions}, 0, false);
});

test('manifest failure after server startup cleans up listener and watcher', {skip: !jso || !extensions}, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-extension-'));
    t.after(() => fs.rmSync(root, {recursive:true,force:true}));
    run(t, {JSO_SOURCE:jso,JSO_EXTENSIONS_ROOT:root}, 1, false, /ENOENT[^\n]*plugin-manifest\.local-agent\.json/);
});
