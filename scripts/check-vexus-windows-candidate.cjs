'use strict';

// Complements the existing source/receipt checker and native acceptance suite.
// It can only execute on actual Windows x64; it never replaces SourceRoot files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync, spawnSync } = require('node:child_process');
assert(process.platform === 'win32' && process.arch === 'x64',
    'WINDOWS_NATIVE_VERIFICATION_BLOCKED: real Windows x64 Node is required');
const [rootArg, commit, bindingArg, secondArg, proofArg] = process.argv.slice(2);
assert(rootArg && /^[0-9a-f]{40}$/.test(commit || '') && bindingArg && secondArg && proofArg,
    'Usage: node check-vexus-windows-candidate.cjs SOURCE_ROOT COMMIT BINDING_1 BINDING_2 NEW_PROOF_ROOT');
const root = fs.realpathSync(rootArg);
const bindingPath = fs.realpathSync(bindingArg);
const secondPath = fs.realpathSync(secondArg);
const proof = path.resolve(proofArg);
assert(!proof.toLowerCase().startsWith(root.toLowerCase() + path.sep), 'Proof root must be outside SourceRoot');
assert(!fs.existsSync(proof), 'Proof root must be new');
const gitHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(gitHead, commit);
execFileSync('git', ['-C', root, 'diff', '--quiet', commit, '--', '.']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = fs.readFileSync(bindingPath);
const second = fs.readFileSync(secondPath);
assert.equal(bytes.subarray(0, 2).toString(), 'MZ', 'Expected actual PE native output');
const sourceReceipt = JSON.parse(fs.readFileSync(path.join(root, 'docs/native-delivery-upstream-r1-linux.json'), 'utf8'));
const { checkNativeDelivery } = require(path.join(root, 'scripts/check-native-delivery.cjs'));
checkNativeDelivery(root, 'x86_64-unknown-linux-gnu', ['vexus'], 'docs/native-delivery-upstream-r1-linux.json');
const binding = require(bindingPath); // The actual Windows Node runtime loads the built DLL.
for (const name of ['VexusIndex', 'NativeKnowledgeRuntime', 'VexusWatcher']) assert.equal(typeof binding[name], 'function');
const runtime = new binding.NativeKnowledgeRuntime(new binding.VexusIndex(4, 16));
try {
    const caps = runtime.capabilities();
    assert.equal(caps.abiVersion, 2);
    for (const capability of ['index.tdb-vec.v1', 'index.query-options.v1', 'river.native-query.v1']) {
        assert(caps.capabilities.includes(capability), `Missing candidate capability: ${capability}`);
    }
    for (const method of ['executeRiverQueryHybrid', 'executeExternalRerank', 'getFileIdsByDiaries']) {
        assert.equal(typeof runtime[method], 'function', `Missing ABI method: ${method}`);
    }
    assert.throws(() => runtime.openAndInitStore(''));
} finally { runtime.shutdown(); }
const index = new binding.VexusIndex(4, 16);
index.addBatch([1, 2], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0]));
const query = new Float32Array([1, 0, 0, 0]);
assert.equal(index.search(query, 1)[0].id, 1);
assert.equal(index.searchWithOptions(query, 1, '{"excludeIds":[1]}')[0].id, 2);
assert.throws(() => index.searchWithOptions(query, 1, '{'));
assert.throws(() => index.search(new Float32Array([1, 0]), 1));
assert.throws(() => index.add(3, new Float32Array([NaN, 0, 0, 0])));
fs.mkdirSync(proof, { recursive: true });
const loaderFile = path.join(root, 'rust-vexus-lite/index.js');
const loaderSource = fs.readFileSync(loaderFile, 'utf8');
function loadFrom(directory) {
    const module = { exports: {} };
    vm.runInNewContext(loaderSource, {
        module, exports: module.exports, process, Buffer, console,
        __dirname: directory, __filename: loaderFile,
        require: createRequire(path.join(directory, 'index.js'))
    }, { filename: loaderFile });
    return module.exports;
}
assert.equal(loadFrom(path.dirname(bindingPath)).VexusIndex, binding.VexusIndex,
    'Unmodified candidate loader must load the newly built binary from the isolated build path');
const missing = path.join(proof, 'loader-missing');
const quarantined = path.join(proof, 'loader-quarantined-only');
const malformed = path.join(proof, 'loader-malformed');
for (const directory of [missing, quarantined, malformed]) fs.mkdirSync(directory);
fs.writeFileSync(path.join(quarantined, 'vexus-lite.win32-x64-msvc.node.unverified'), 'synthetic quarantine marker');
fs.writeFileSync(path.join(malformed, 'vexus-lite.win32-x64-msvc.node'), 'synthetic invalid native binary');
assert.throws(() => loadFrom(missing), /VEXUS_CANDIDATE_BUILD_REQUIRED/);
assert.throws(() => loadFrom(quarantined), /VEXUS_CANDIDATE_BUILD_REQUIRED/);
assert.throws(() => loadFrom(malformed));
// Reuse the existing eight-entry native suite. Child environment omits provider
// credentials/configuration and passes only the explicitly built candidate path.
const env = { TDB_NATIVE_BINDING: bindingPath };
for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
}
const suite = spawnSync(process.execPath, ['--test', '--test-concurrency=1',
    'tests/tdbNativeAcceptance.test.js', 'tests/tdbLegacyDimensionCompatibility.test.js'], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180000
});
fs.writeFileSync(path.join(proof, 'native-suite.stdout.txt'), suite.stdout || '');
fs.writeFileSync(path.join(proof, 'native-suite.stderr.txt'), suite.stderr || '');
assert.ifError(suite.error);
assert.equal(suite.status, 0, 'Existing native acceptance/legacy dimensions suite failed; inspect proof logs');
assert(!/# skipped [1-9]/.test(suite.stdout || ''), 'Skipped required native tests are not acceptance');
const receiptRoot = path.join(proof, 'receipt-root');
for (const input of sourceReceipt.source_inputs.vexus) {
    const destination = path.join(receiptRoot, input.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, input.path), destination);
}
const artifactPath = 'rust-vexus-lite/vexus-lite.win32-x64-msvc.node';
fs.copyFileSync(bindingPath, path.join(receiptRoot, artifactPath));
const receiptPath = 'docs/native-delivery-r1c-windows.json';
const receipt = {
    schema: 1, source_commit: commit,
    scope: 'Local Windows build and isolated native tests; not publication or production approval',
    source_inputs: { vexus: sourceReceipt.source_inputs.vexus },
    artifacts: [{ group: 'vexus', target: 'x86_64-pc-windows-msvc', path: artifactPath, sha256: sha(bytes), size: bytes.length }]
};
fs.mkdirSync(path.join(receiptRoot, 'docs'));
fs.writeFileSync(path.join(receiptRoot, receiptPath), JSON.stringify(receipt, null, 2) + '\n');
assert.equal(checkNativeDelivery(receiptRoot, 'x86_64-pc-windows-msvc', ['vexus'], receiptPath), 1);
const peOffset = data => data.length >= 64 ? data.readUInt32LE(0x3c) : 0;
const peTimestamp = data => peOffset(data) + 12 <= data.length ? data.readUInt32LE(peOffset(data) + 8) : null;
const result = {
    sourceCommit: commit, actualWindows: true, node: process.version, napi: process.versions.napi,
    build1Sha256: sha(bytes), build2Sha256: sha(second), byteEqual: bytes.equals(second),
    peTimeDateStamp1: peTimestamp(bytes), peTimeDateStamp2: peTimestamp(second),
    nativeLoad: 'PASS', abiAndErrorChecks: 'PASS', originalLoaderCandidateAndMissingMalformedChecks: 'PASS',
    existingNativeSuite: 'PASS', receiptSourceAndArtifactChecks: 'PASS',
    validWrongVersionLoaderRejection: 'NOT_RUN: loader does not itself validate artifact hash or ABI version',
    deploymentCompatibility: 'BLOCKED_PENDING_INDEPENDENT_REVIEW_AND_REMAINING_COMPATIBILITY'
};
fs.writeFileSync(path.join(proof, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (!result.byteEqual) {
    console.error('Windows build bytes differ. Inspect PE timestamps, dumpbin /headers and compiler/PDB path differences; reproducibility remains unresolved.');
    process.exitCode = 2;
}
