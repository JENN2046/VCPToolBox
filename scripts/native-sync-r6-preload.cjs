'use strict';
// Observation and isolation for the real server.js process. No application
// module, native dependency, lifecycle method or request handler is replaced.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const readline = require('node:readline');
const crypto = require('node:crypto');
const { fileURLToPath } = require('node:url');
const isR7 = Boolean(process.env.VCP_R7_RUN_ROOT);
const root = path.resolve(process.env.VCP_R7_RUN_ROOT || process.env.VCP_R6_RUN_ROOT || '');
const source = path.join(root, 'source');
const base = '/home/admin/VCPKF/vcp/artifacts/' + (isR7 ? 'native-sync-r7' : 'native-sync-r6');
if (process.platform !== 'linux' || path.dirname(root) !== base || !/^run-\d+$/.test(path.basename(root)) || process.cwd() !== source || path.resolve(process.argv[1]) !== path.join(source, 'server.js')) throw new Error('R6_REAL_SERVER_ISOLATION_REQUIRED');
process.umask(0o077);
const original = { write: fs.writeFileSync, mkdir: fs.mkdirSync, read: fs.readFileSync, stdout: process.stdout.write.bind(process.stdout), stderr: process.stderr.write.bind(process.stderr) };
const evidence = { entry: process.argv[1], pid: process.pid, violations: [], outboundAttempts: [], listeners: [], bootReady: false, beforeShutdown: null };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sanitize = text => String(text).replaceAll('isolated-poc-token', '[SYNTHETIC_KEY]').replaceAll('r6-synthetic-provider-unused', '[SYNTHETIC_PROVIDER_VALUE]').replaceAll('r7-synthetic-provider-unused','[SYNTHETIC_PROVIDER_VALUE]');
const emit = value => original.stdout('@@R6_RECEIPT@@' + JSON.stringify(value) + '\n');
function inside(file) {
    const target = path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
    return target === root || target.startsWith(root + path.sep);
}
function writable(file) {
    if (typeof file === 'number') return;
    if (!inside(file)) { evidence.violations.push('OUTSIDE_WRITE'); throw Object.assign(new Error('R6 outside experiment write denied'), { code: 'R6_WRITE_DENIED' }); }
}
function readable(file) {
    if (typeof file === 'number') return;
    const target = path.resolve(file instanceof URL ? fileURLToPath(file) : String(file));
    if (inside(target) || target.startsWith(base + '/') || target.startsWith('/home/admin/VCPKF/vcp/artifacts/native-sync-r6/deps/') || target.startsWith('/usr/') || target.startsWith('/lib/') || target.startsWith('/lib64/') || target === '/etc/ld.so.cache') return;
    evidence.violations.push('OUTSIDE_READ'); throw Object.assign(new Error('R6 outside experiment read denied'), { code: 'R6_READ_DENIED' });
}
for (const [object, methods, check] of [
    [fs, ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'mkdir', 'mkdirSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync'], writable],
    [fsp, ['writeFile', 'appendFile', 'mkdir', 'unlink', 'rm', 'rmdir'], writable],
    [fs, ['readFile', 'readFileSync'], readable], [fsp, ['readFile'], readable],
]) for (const method of methods) {
    const fn = object[method]; object[method] = function (file, ...args) { check(file); return fn.call(this, file, ...args); };
}
for (const object of [fs, fsp]) for (const method of object === fs ? ['rename', 'renameSync', 'copyFile', 'copyFileSync'] : ['rename', 'copyFile']) {
    const fn = object[method]; object[method] = function (from, to, ...args) { (method.startsWith('rename') ? writable : readable)(from); writable(to); return fn.call(this, from, to, ...args); };
}
const createStream = fs.createWriteStream;
fs.createWriteStream = function (file, ...args) {
    writable(file); const stream = createStream.call(this, file, ...args), write = stream.write;
    if (!String(file).includes('/DebugLog/')) return stream;
    stream.write = function (chunk, ...rest) { return write.call(this, sanitize(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk), ...rest); };
    return stream;
};
for (const object of [fs, fsp]) for (const method of object === fs ? ['open', 'openSync'] : ['open']) {
    const fn = object[method]; object[method] = function (file, flags, ...rest) {
        const writing = typeof flags === 'number' ? Boolean(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) : /[wa+]/.test(flags || 'r');
        (writing ? writable : readable)(file); return fn.call(this, file, flags, ...rest);
    };
}
for (const name of ['stdout', 'stderr']) process[name].write = function (chunk, ...args) { return original[name](sanitize(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk), ...args); };
const loopback = host => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host));
function options(args) {
    if (Array.isArray(args[0])) return args[0][0];
    if (args[0] && typeof args[0] === 'object') return args[0];
    if (typeof args[0] === 'string' && !/^\d+$/.test(args[0])) return { path: args[0] };
    return { port: args[0], host: typeof args[1] === 'string' ? args[1] : undefined };
}
for (const [object, method] of [[net.Socket.prototype, 'connect'], [tls, 'connect']]) {
    const fn = object[method]; object[method] = function (...args) {
        const value = options(args); evidence.outboundAttempts.push({ host: value.host || value.hostname || 'pipe', port: value.port || null, path: value.path || null, frames: new Error().stack.split('\n').slice(2, 5) });
        if (value.path && !inside(value.path)) { evidence.violations.push('OUTSIDE_IPC'); throw new Error('R6 outside experiment IPC denied'); }
        const approved=globalThis.__r9ProviderPolicy;
        const providerAllowed=approved?.model==='doubao-seed-2.0-mini' && approved.hostname===(value.host||value.hostname) && Number(value.port)===443;
        if (!value.path && !loopback(value.host || value.hostname) && !providerAllowed) { evidence.violations.push('NON_LOOPBACK_CONNECT'); throw new Error('R6 non-loopback connection denied'); }
        return fn.apply(this, args);
    };
}
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
    const value = options(args);
    if (!value.path && !loopback(value.host)) { evidence.violations.push('PUBLIC_LISTENER'); throw new Error('R6 explicit loopback listener required'); }
    this.once('listening', () => setImmediate(() => {
        const address = this.address();
        evidence.listeners.push(address);
        if (this.__nativeSyncFixture) return;
        if (typeof address !== 'object' || evidence.bootReady) return;
        const manager = require('../Plugin');
        const plugin = manager.getServiceModule('NativeSync');
        const state = plugin?.snapshot();
        const enabled = process.env.NativeSyncEnabled === 'true';
        if (!plugin || Boolean(state.ready) !== enabled || state.lifecycle.namespacedRegistrations !== 1 || state.lifecycle.compatibilityRegistrations !== 1) throw new Error('R6 plugin readiness contract failed');
        const kb = require('../KnowledgeBaseManager');
        if (!kb.initialized) throw new Error('R6 mandatory native knowledge initialization incomplete');
        evidence.bootReady = true;
        const event = { event: 'ready', pid: process.pid, platform: process.platform, node: process.versions.node, url: `http://127.0.0.1:${address.port}`, dbPath: path.join(process.env.NativeSyncDataDir, 'central.sqlite'), fullEntry: process.argv[1], nativeKnowledgeInitialized: kb.initialized, enabled, discoveredPlugins: [...manager.plugins.keys()], ...state };
        original.write(path.join(root, `host-start-${process.pid}.json`), JSON.stringify(event, null, 2)); emit(event);
    }));
    return listen.apply(this, args);
};
const manifest = JSON.parse(original.read(path.join(root, 'source-manifest.json'), 'utf8'));
for (const file of manifest.files) if (sha(original.read(path.join(source, file.name))) !== file.sha256) throw new Error('R6_SOURCE_HASH_MISMATCH');
if (manifest.nativeBinary && sha(original.read(path.join(source, manifest.nativeBinary.name))) !== manifest.nativeBinary.sha256) throw new Error('R6_NATIVE_BINARY_HASH_MISMATCH');
function stop() {
    const plugin = require('../Plugin').getServiceModule('NativeSync');
    evidence.beforeShutdown = plugin?.snapshot();
    process.kill(process.pid, 'SIGTERM');
}
readline.createInterface({ input: process.stdin }).on('line', line => {
    if (line === 'stop') stop();
    else if(line.startsWith('r9-provider:') && globalThis.__r9ProviderRelay) emit({event:'r9-provider',requestId:line.slice(12),...globalThis.__r9ProviderRelay.snapshot()});
    else if(line==='r9-fail-next' && globalThis.__r9ProviderRelay) {globalThis.__r9ProviderRelay.failNext();emit({event:'r9-fault-armed'});}
    else if (line.startsWith('snapshot:')) emit({ event: 'snapshot', requestId: line.slice(9), pid: process.pid, syncDataCreated: fs.existsSync(process.env.NativeSyncDataDir), ...require('../Plugin').getServiceModule('NativeSync').snapshot() });
}).on('close', () => { if (evidence.bootReady && !evidence.beforeShutdown) stop(); });
process.on('exit', code => {
    const plugin = require.cache[require.resolve('../Plugin')]?.exports?.getServiceModule('NativeSync');
    const after = plugin?.snapshot();
    const before = evidence.beforeShutdown;
    const db = path.join(process.env.NativeSyncDataDir, 'central.sqlite');
    const event = { event: evidence.bootReady && code === 0 ? 'stopped' : 'boot-failed', pid: process.pid, exitCode: code, fullEntry: process.argv[1], bootReady: evidence.bootReady, metrics: before?.metrics ?? null, entries: before?.entries ?? [], lifecycle: after?.lifecycle ?? null, pluginReadyAfterShutdown: after?.ready ?? false, sqliteSha256AfterClose: fs.existsSync(db) ? sha(original.read(db)) : null, syncDataCreated: fs.existsSync(process.env.NativeSyncDataDir), isolation: evidence };
    try { original.write(path.join(root, `host-exit-${process.pid}.json`), JSON.stringify(event, null, 2)); emit(event); } catch {}
});
