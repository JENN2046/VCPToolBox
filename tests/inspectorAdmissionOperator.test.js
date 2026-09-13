'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = path.resolve(__dirname, '..');
const ownerPath = path.join(core, 'routes/admin/plugins.js');
const source = fs.readFileSync(ownerPath, 'utf8');
const endpoint = '/plugins/rivermemo-inspector/admission';
const candidate = {
    plugin_name: 'RiverMemoInspector',
    expected_source_sha256: '23cddf8be91dd227ea334b0de3334b734b6cdbc32fe20c3d23a69a926ac320c5',
    expected_manifest_sha256: '60364e294450951de464d77cff8ff9de568409979c42c79c76ad6955a73a2940'
};
function fixture({ drift, transaction, registered = false } = {}) {
    const routes = new Map(), calls = [], reads = [];
    const router = new Proxy({}, { get: (_, method) => (url, handler) => routes.set(`${method} ${url}`, handler) });
    const pm = { plugins: new Map(registered ? [['RiverMemoInspector', {}]] : []),
        async _admitDirectPlugin(args) { calls.push(args); return transaction ? transaction(args) : { status: 'published', plugin: args.name, sentinel: 123 }; } };
    const context = { module: { exports: {} }, __dirname: path.dirname(ownerPath), console,
        require(name) {
            if (name === 'express') return { Router: () => router };
            if (name === 'fs') return { promises: { async readFile(file) {
                reads.push(file);
                assert.ok(file.startsWith(path.join(core, 'Plugin/RiverMemoInspector/source/')));
                return drift && file.endsWith(drift) ? Buffer.from('drift') : fs.readFileSync(file);
            } } };
            if (name === './lib/dashboardCards') return {};
            return require(name);
        } };
    vm.runInNewContext(source, context, { filename: ownerPath });
    context.module.exports({ pluginManager: pm });
    async function invoke(body = candidate, method = 'post') {
        const response = { statusCode: 200, status(n) { this.statusCode = n; return this; },
            json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
        await routes.get(`${method} ${endpoint}`)({ body }, response);
        return response;
    }
    return { invoke, calls, reads, pm, routes };
}
test('T1/T4 accepted Inspector forwards once and preserves R1 result', async () => {
    const f = fixture(); const response = await f.invoke();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { status: 'published', plugin: 'RiverMemoInspector', sentinel: 123 });
    assert.equal(f.calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), { name: 'RiverMemoInspector', expectedIdentity: {
        source_sha256: candidate.expected_source_sha256, manifest_sha256: candidate.expected_manifest_sha256 } });
});
test('T2 other targets and arbitrary paths denied before reading or calling R1', async () => {
    for (const plugin_name of ['LightMemo', 'OneRing', 'arbitrary', '../RiverMemoInspector']) {
        const f = fixture(); assert.equal((await f.invoke({ ...candidate, plugin_name })).statusCode, 400);
        assert.equal(f.calls.length, 0); assert.equal(f.reads.length, 0);
    }
    const f = fixture(); assert.equal((await f.invoke({ ...candidate, source_path: '/tmp/anything' })).statusCode, 400);
    assert.equal(f.calls.length, 0);
});
test('T3 request identities and actual source/manifest drift reject before transaction', async () => {
    for (const key of ['expected_source_sha256', 'expected_manifest_sha256']) {
        const f = fixture(); assert.equal((await f.invoke({ ...candidate, [key]: '0'.repeat(64) })).statusCode, 400);
        assert.equal(f.calls.length, 0);
    }
    for (const drift of ['RiverMemoInspector.js', 'plugin-manifest.json']) {
        const f = fixture({ drift }); const response = await f.invoke();
        assert.equal(response.statusCode, 409); assert.equal(response.body.code, 'INSPECTOR_ACCEPTED_SOURCE_DRIFT');
        assert.equal(f.calls.length, 0);
    }
});
test('T5 operator owns no lifecycle/publication implementation', () => {
    const block = source.slice(source.indexOf('// R0 operator only:'), source.indexOf('    function changedConfigKeys'));
    assert.equal((block.match(/await pluginManager\._admitDirectPlugin\(/g) || []).length, 1);
    assert.doesNotMatch(block, /\.(shutdown|start|reloadPlugins|publishDirectPluginPublication|restoreDirectPluginPublication|_publishDirectCandidate|_beginGenerationInvocation)\s*\(/);
    assert.doesNotMatch(block, /directAdmissions|admission_locked|\.writeFile|\.set\(/);
});
test('T6 structured R1 failure and cleanup diagnostics preserved without retry', async () => {
    const result = { status: 'rolled_back', code: 'FIXTURE_PUBLICATION_FAILURE', details: { target: 'RiverMemoInspector', future: true } };
    const f = fixture({ transaction() { throw Object.assign(new Error('failure'), { statusCode: 409, result }); } });
    const response = await f.invoke(); assert.equal(response.statusCode, 409); assert.deepEqual(response.body, result); assert.equal(f.calls.length, 1);
    const g = fixture({ transaction() { throw Object.assign(new Error('failed'), { code: 'PUBLICATION_FAILED', cleanupError: Object.assign(new Error('cleanup'), { code: 'CLEANUP_FAILED' }) }); } });
    assert.deepEqual((await g.invoke()).body, { status: 'failed', code: 'PUBLICATION_FAILED', error: 'failed', cleanup_error: { code: 'CLEANUP_FAILED', message: 'cleanup' } });
    assert.equal(g.calls.length, 1);
});
test('initial activation only: already registered rejects; missing R1 rejects', async () => {
    const f = fixture({ registered: true }); assert.equal((await f.invoke()).body.code, 'INSPECTOR_ALREADY_REGISTERED'); assert.equal(f.calls.length, 0);
    const g = fixture(); delete g.pm._admitDirectPlugin; assert.equal((await g.invoke()).statusCode, 503);
});
test('descriptor is a pure read; invalid request shapes reject', async () => {
    const f = fixture(); const descriptor = await f.invoke(undefined, 'get');
    assert.equal(descriptor.body.schema, 'rivermemo-inspector-admission-r0');
    assert.deepEqual(descriptor.body.candidate, candidate); assert.equal(f.reads.length, 0); assert.equal(f.calls.length, 0);
    for (const body of [null, [], {}, 'RiverMemoInspector', { plugin_name: 'RiverMemoInspector' }]) assert.equal((await f.invoke(body)).statusCode, 400);
});
test('existing management routes retained and main auth precedes admin mount', () => {
    const f = fixture(); assert.ok(f.routes.has('get /plugins/runtime')); assert.ok(f.routes.has('post /plugins/reload'));
    const server = fs.readFileSync(path.join(core, 'server.js'), 'utf8');
    assert.ok(server.indexOf('app.use(adminAuth)') < server.indexOf("app.use('/admin_api', adminPanelRoutes)"));
    assert.match(server, /req\.path\.startsWith\('\/admin_api'\)/);
    assert.ok(!server.slice(server.indexOf('const publicPaths'), server.indexOf('const isVerifyEndpoint')).includes('rivermemo-inspector'));
});
