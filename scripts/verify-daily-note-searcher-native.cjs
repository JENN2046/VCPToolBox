'use strict';

// Explicit rebuilt executable; synthetic files, sanitized environment, loopback only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

assert.ok(process.argv[2], 'Pass the rebuilt DailyNoteSearcher executable explicitly');
const binary = path.resolve(process.argv[2]);
assert.ok(fs.statSync(binary).isFile());
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-searcher-regression-'));
const notes = path.join(root, 'notes');
const marker = 'synthetic_daily_search_marker';
const env = { PATH: process.env.PATH || '', TEMP: root, TMP: root, LANG: 'C.UTF-8', DAILY_NOTE_ROOT: notes };
if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
let child;
let checks = 0;
function cli(extra = {}) {
    const result = spawnSync(binary, [], {
        cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 10000,
        input: JSON.stringify({ query: marker, root_path: notes, ...extra }), maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    checks++;
    return JSON.parse(result.stdout);
}
function request(port, route, value = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(value);
        const req = http.request({ hostname: '127.0.0.1', port, path: route, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            timeout: 2000, agent: false }, res => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { text += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
                catch (error) { reject(error); }
            });
        });
        req.on('timeout', () => req.destroy(new Error('Synthetic request timed out')));
        req.on('error', reject);
        req.end(body);
    });
}
async function main() {
    try {
        fs.mkdirSync(notes);
        fs.writeFileSync(path.join(root, 'package.json'), '{}');
        fs.writeFileSync(path.join(notes, 'fixture.md'), marker + '\n');
        const positive = cli();
        assert.equal(positive.status, 'success');
        assert.ok(JSON.stringify(positive.result).includes(marker));
        assert.equal(cli({ folder: '..' }).status, 'error');
        assert.equal(cli({ query: '[' , is_regex: true }).status, 'error');
        const reserved = net.createServer();
        reserved.listen(0, '127.0.0.1');
        await once(reserved, 'listening');
        const port = reserved.address().port;
        await new Promise(resolve => reserved.close(resolve));
        const instance = 'synthetic-native-ci';
        const token = 'synthetic-shutdown-control-not-a-secret';
        child = spawn(binary, ['--serve'], { cwd: root, env: { ...env,
            DAILY_NOTE_SEARCHER_HOST: '127.0.0.1', DAILY_NOTE_SEARCHER_PORT: String(port),
            DAILY_NOTE_SEARCHER_INSTANCE_ID: instance, DAILY_NOTE_SEARCHER_SHUTDOWN_TOKEN: token },
            stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
        const exited = once(child, 'exit');
        let health;
        for (let attempt = 0; attempt < 50; attempt++) {
            if (child.exitCode !== null) throw new Error('Synthetic server exited before readiness');
            try { health = await request(port, '/health'); break; }
            catch { await delay(100); }
        }
        assert.equal(health?.status, 200);
        assert.equal(health.body.instance_id, instance);
        checks++;
        for (let index = 0; index < 3; index++) {
            const search = await request(port, '/search', { query: marker, root_path: notes });
            assert.equal(search.body.status, 'success');
            assert.ok(JSON.stringify(search.body.result).includes(marker));
            checks++;
        }
        assert.equal((await request(port, '/search', { query: marker, root_path: notes, folder: '..' })).body.status, 'error');
        checks++;
        assert.equal((await request(port, '/shutdown', { token: 'wrong', instance_id: instance })).status, 403);
        assert.equal((await request(port, '/health')).status, 200);
        checks++;
        assert.equal((await request(port, '/shutdown', { token, instance_id: 'wrong' })).status, 403);
        checks++;
        assert.equal((await request(port, '/shutdown', { token, instance_id: instance })).status, 200);
        const exit = await Promise.race([exited, delay(5000).then(() => { throw new Error('Synthetic server did not stop'); })]);
        assert.equal(exit[0], 0);
        checks++;
        console.log(`DailyNoteSearcher native regression: ${checks} isolated checks passed.`);
    } finally {
        if (child && child.exitCode === null) {
            child.kill();
            await Promise.race([once(child, 'exit'), delay(5000)]);
        }
        fs.rmSync(root, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
