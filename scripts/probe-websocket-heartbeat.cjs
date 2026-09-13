'use strict';

// Read credentials locally; persist only allowlisted connection metadata.
// Usage: node scripts/probe-websocket-heartbeat.cjs /absolute/output.ndjson
// Uses the actual public domain. No models, tools, or business events are invoked.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('An absolute metadata output path is required');
const durationMs = 610000;
const config = dotenv.parse(fs.readFileSync(path.join(root, 'config.env')));
const pluginPath = path.join(root, 'Plugin/VCPLog/config.env');
const pluginConfig = fs.existsSync(pluginPath) ? dotenv.parse(fs.readFileSync(pluginPath)) : {};
const key = pluginConfig.VCP_Key || config.VCP_Key;
if (!key) throw new Error('Configured credential missing');
const runId = randomUUID();
const fd = fs.openSync(output, 'wx', 0o600);
const sockets = new Set();
let failed = false;
function record(event, fields = {}) {
    const line = JSON.stringify({ at: new Date().toISOString(), event, ...fields });
    fs.writeSync(fd, line + '\n');
    console.log(line);
}
function runtime() {
    try {
        return Object.fromEntries(execFileSync('systemctl', ['--user', 'show', 'vcp-main', '--property=MainPID,NRestarts,ActiveState,ExecMainStartTimestamp'], { encoding: 'utf8' })
            .trim().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
    } catch { return { unavailable: true }; }
}
function connect(channel, label, credential = key) {
    return new Promise((resolve, reject) => {
        const route = channel === 'AdminPanel' ? 'vcp-admin-panel' : channel === 'VCPInfo' ? 'vcpinfo' : 'VCPlog';
        const ws = new WebSocket(`wss://vcp.skmt617.top/${route}/VCP_Key=${credential}?deviceName=heartbeat-probe-${runId}`, { handshakeTimeout: 15000 });
        const stats = { channel, label, openedAt: null, pings: 0, matchingPongs: 0, ack: false, reconnects: 0, closeCode: null, initiatedByProbe: false };
        const nonces = new Set();
        let opened = false;
        let lastPing = null;
        const gaps = [];
        sockets.add(ws);
        ws.on('upgrade', res => record('upgrade', { channel, label, status: res.statusCode, server: res.headers.server, cloudflare: Boolean(res.headers['cf-ray']) }));
        ws.on('open', () => {
            opened = true;
            stats.openedAt = new Date().toISOString();
            stats.started = process.hrtime.bigint();
            record('connected', { channel, label });
            resolve({ ws, stats, gaps, sendSynthetic: () => { const nonce = randomUUID(); nonces.add(nonce); ws.ping(nonce); } });
        });
        ws.on('ping', () => {
            const now = process.hrtime.bigint();
            if (lastPing !== null) gaps.push(Number(now - lastPing) / 1e6);
            lastPing = now;
            stats.pings++;
        });
        ws.on('pong', data => { if (nonces.delete(data.toString())) stats.matchingPongs++; });
        ws.on('message', data => {
            // Never retain or print application data, including potential broadcasts.
            try { if (JSON.parse(data).type === 'connection_ack') stats.ack = true; } catch {}
        });
        ws.on('unexpected-response', (_req, res) => {
            record('rejected', { channel, label, status: res.statusCode });
            res.resume();
            ws.terminate();
            reject(new Error('Handshake rejected'));
        });
        ws.on('error', error => {
            record('socket_error', { channel, label, code: error.code || 'WEBSOCKET_ERROR' });
            if (!opened) reject(new Error('Handshake failed'));
        });
        ws.on('close', code => {
            stats.closeCode = code;
            sockets.delete(ws);
            record('closed', { channel, label, code, initiatedByProbe: stats.initiatedByProbe,
                lifetimeSeconds: opened ? Number(process.hrtime.bigint() - stats.started) / 1e9 : 0 });
            if (!opened) reject(new Error('Closed before handshake'));
        });
    });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function connectWithRetry(channel, label) {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const connection = await connect(channel, label);
            record('connection_attempt_result', { channel, label, attempts: attempt, pass: true });
            return connection;
        } catch {
            record('connection_attempt_result', { channel, label, attempts: attempt, pass: false });
            if (attempt === 3) throw new Error('Connection attempts exhausted');
            await delay(3000);
        }
    }
}
async function closeProbe(connection, interrupt = false) {
    const { ws, stats } = connection;
    stats.initiatedByProbe = true;
    if (ws.readyState === WebSocket.CLOSED) return;
    await new Promise(resolve => {
        const timer = setTimeout(() => { ws.terminate(); resolve(); }, 3000);
        ws.once('close', () => { clearTimeout(timer); resolve(); });
        if (interrupt) ws.terminate(); else ws.close(1000, 'diagnostic complete');
    });
}
async function observe(channel) {
    const connection = await connectWithRetry(channel, 'idle-610s');
    const { ws, stats, gaps, sendSynthetic } = connection;
    sendSynthetic();
    const progress = setInterval(() => record('progress', { channel, label: stats.label,
        observedSeconds: Number(process.hrtime.bigint() - stats.started) / 1e9,
        open: ws.readyState === WebSocket.OPEN, pings: stats.pings, matchingPongs: stats.matchingPongs, runtime: runtime() }), 60000);
    await delay(durationMs);
    clearInterval(progress);
    const continuousSeconds = Number(process.hrtime.bigint() - stats.started) / 1e9;
    if (ws.readyState === WebSocket.OPEN) { sendSynthetic(); await delay(2000); }
    const pass = ws.readyState === WebSocket.OPEN && stats.closeCode === null && stats.ack && stats.pings >= 29 && stats.matchingPongs === 2;
    if (!pass) failed = true;
    record('observation_result', { channel, pass, openedAt: stats.openedAt, continuousSeconds,
        pings: stats.pings, matchingSyntheticPongs: stats.matchingPongs, ack: stats.ack,
        reconnects: stats.reconnects, unexpectedCloseCode: stats.closeCode,
        pingGapMinMs: gaps.length ? Math.min(...gaps) : null, pingGapMaxMs: gaps.length ? Math.max(...gaps) : null });
    await closeProbe(connection);
}
async function auxiliary() {
    // Give the continuous connections time to establish before negative checks.
    await delay(5000);
    for (const channel of ['VCPInfo', 'VCPLog']) {
        try {
            const unexpected = await connect(channel, 'invalid-credential', randomUUID());
            failed = true;
            record('authentication_result', { channel, pass: false });
            await closeProbe(unexpected);
        } catch { record('authentication_result', { channel, pass: true }); }
        const first = await connectWithRetry(channel, 'isolated-interruption');
        await closeProbe(first, true);
        await delay(3000);
        const recovered = await connectWithRetry(channel, 'isolated-recovery');
        recovered.sendSynthetic();
        await delay(2000);
        const pass = recovered.stats.ack && recovered.stats.matchingPongs === 1;
        if (!pass) failed = true;
        record('recovery_result', { channel, pass, reconnects: 1, interruptScope: 'diagnostic-socket-only' });
        await closeProbe(recovered);
    }
    const admin = await connectWithRetry('AdminPanel', 'other-channel');
    admin.sendSynthetic();
    await delay(2000);
    const pass = admin.stats.matchingPongs === 1;
    if (!pass) failed = true;
    record('other_channel_result', { channel: 'AdminPanel', pass });
    await closeProbe(admin);
}
(async () => {
    const before = runtime();
    record('run_start', { runId, domain: 'vcp.skmt617.top', idleDurationMs: durationMs, runtime: before });
    const results = await Promise.allSettled([observe('VCPInfo'), observe('VCPLog'), auxiliary()]);
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            failed = true;
            record('subtest_failed', { subtest: ['VCPInfo', 'VCPLog', 'auxiliary'][index] });
        }
    });
    const after = runtime();
    const unchanged = before.MainPID === after.MainPID && before.NRestarts === after.NRestarts && after.ActiveState === 'active';
    record('run_result', { pass: !failed && unchanged, processUnchanged: unchanged, runtime: after });
    fs.closeSync(fd);
    process.exitCode = !failed && unchanged ? 0 : 1;
})().catch(() => {
    record('run_failed', { reason: 'Probe could not complete; see metadata events' });
    for (const ws of sockets) ws.terminate();
    fs.closeSync(fd);
    process.exit(1);
});
