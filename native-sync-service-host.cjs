'use strict';
// Isolated VCPToolBox service-only acceptance host. The production Plugin.js,
// shared API auth, discovery, dependency injection, route registration and
// shutdown are real. No knowledge base, providers or unrelated plugins start.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const readline = require('node:readline');
const express = require('express');
const createApiBearerAuth = require('./modules/apiBearerAuth');
const root = path.resolve(process.argv[2] || '');
const allowed = '/home/admin/VCPKF/vcp/artifacts/native-sync-r5';
if (process.platform !== 'linux' || path.dirname(root) !== allowed || !/^run-\d+$/.test(path.basename(root)) || path.resolve(__dirname, '..') !== root) throw new Error('EXPLICIT_R5_HOST_ROOT_REQUIRED');
process.umask(0o077);
const output = value => process.stdout.write(JSON.stringify(value) + '\n');
// Imported runtime diagnostics are suppressed, never persisted as raw logs.
// Explicit low-disclosure lifecycle receipts below are the evidence surface.
console.log = () => {}; console.warn = () => {}; console.error = () => {};
async function main() {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source-manifest.json'), 'utf8'));
    for (const f of manifest.files) {
        const file = path.resolve(__dirname, f.name);
        if (!file.startsWith(__dirname + path.sep) || crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== f.sha256) throw new Error('R5_SOURCE_INTEGRITY_FAILED');
    }
    process.env.Key = 'isolated-poc-token'; process.env.NativeSyncEnabled = 'true';
    process.env.NativeSyncDataDir = path.join(root, 'data/native-sync');
    process.env.DebugMode = 'false';
    const manager = require('./Plugin');
    manager.setProjectBasePath(__dirname);
    await manager.loadPlugins();
    if (manager.plugins.size !== 1 || !manager.serviceModules.has('NativeSync')) throw new Error('R5_PLUGIN_DISCOVERY_FAILED');
    const plugin = manager.getServiceModule('NativeSync');
    if (!plugin?.snapshot().ready) throw new Error('R5_PLUGIN_INITIALIZATION_FAILED');
    const app = express();
    app.use(createApiBearerAuth(process.env.Key));
    app.use(express.json({ limit: '1mb' }));
    manager.initializeServices(app, express.Router(), __dirname);
    const initial = plugin.snapshot();
    if (initial.lifecycle.namespacedRegistrations !== 1 || initial.lifecycle.compatibilityRegistrations !== 1) throw new Error('R5_ROUTE_REGISTRATION_FAILED');
    const server = await new Promise((resolve, reject) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); value.once('error', reject); });
    const ready = { event: 'ready', pid: process.pid, hostname: os.hostname(), platform: process.platform, node: process.versions.node, url: `http://127.0.0.1:${server.address().port}`, dbPath: path.join(initial.dataDir, 'central.sqlite'), plugin: 'NativeSync', pluginManagerSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'Plugin.js'))).digest('hex'), sharedAuthSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'modules/apiBearerAuth.js'))).digest('hex'), sourceHashesVerified: manifest.files.length, ...initial };
    output(ready); fs.writeFileSync(path.join(root, `host-start-${process.pid}.json`), JSON.stringify(ready, null, 2));
    let stopping = false;
    async function stop() {
        if (stopping) return; stopping = true;
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        const data = plugin.snapshot();
        await manager.shutdownAllPlugins();
        const after = plugin.snapshot();
        if (after.ready || after.lifecycle.shutdowns !== 1) throw new Error('R5_PLUGIN_SHUTDOWN_FAILED');
        await manager.toolApprovalManager.watcher?.close(); manager.toolApprovalManager.shutdown();
        const receipt = { event: 'stopped', pid: process.pid, metrics: data.metrics, entries: data.entries, lifecycle: after.lifecycle, pluginReadyAfterShutdown: after.ready, sqliteSha256AfterClose: crypto.createHash('sha256').update(fs.readFileSync(ready.dbPath)).digest('hex') };
        fs.writeFileSync(path.join(root, `host-stop-${process.pid}.json`), JSON.stringify(receipt, null, 2)); output(receipt); process.exit(0);
    }
    const input = readline.createInterface({ input: process.stdin });
    input.on('line', line => {
        if (line === 'stop') void stop().catch(fail);
        else if (line.startsWith('snapshot:')) output({ event: 'snapshot', pid: process.pid, requestId: line.slice(9), ...plugin.snapshot() });
    });
    input.on('close', () => void stop().catch(fail));
    process.on('SIGTERM', () => void stop().catch(fail)); process.on('SIGINT', () => void stop().catch(fail));
}
function fail(error) { output({ event: 'failure', code: error.code || 'R5_HOST_FAILED', message: String(error.message).split('\n')[0] }); process.exit(1); }
main().catch(fail);
