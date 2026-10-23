'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const express = require('express');
const auth = require('../modules/apiBearerAuth');
const plugin = require('../Plugin/NativeSync/native-sync');
const { createSyncHttpService } = require('../Plugin/NativeSync/sync/httpService');
const artifacts = path.resolve(__dirname, '../../../artifacts/native-sync-r5');
fs.mkdirSync(artifacts, { recursive: true });
const root = fs.mkdtempSync(path.join(artifacts, 'plugin-unit-'));
const operation = { ownerType: 'agent', ownerId: 'R5UnitAgent', topicId: 'unit', msgId: 'r5-unit-message', deviceId: 'R5Unit', opId: 'r5-unit-operation', action: 'upsert', baseHash: null, message: { id: 'r5-unit-message', role: 'user', content: 'synthetic unit content', timestamp: 1 } };

test('shared API auth preserves the original server gate, including every existing skip class', () => {
    const source = execFileSync('git', ['show', '1d0f87b:server.js'], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', windowsHide: true });
    const start = source.indexOf('app.use((req, res, next) => {', source.indexOf('// General API authentication'));
    const end = source.indexOf('\n});', start) + 4;
    const original = vm.runInNewContext(source.slice(start + 8, end - 2), { serverKey: 'synthetic-key' });
    const run = (handler, url, header) => {
        let code = null, next = false;
        handler({ path: url, headers: { authorization: header } }, { status(value) { code = value; return this; }, json() {} }, () => { next = true; });
        return { code, next };
    };
    for (const url of ['/api/v1/sync/push', '/api/plugins/NativeSync/sync/pull', '/v1/models', '/admin_api/test', '/AdminPanel/test', '/pw=test/images/a', '/pw=test/files/a', '/plugin-callback/test']) {
        for (const header of [undefined, 'Bearer invalid', 'Bearer synthetic-key']) assert.deepEqual(run(auth('synthetic-key'), url, header), run(original, url, header));
    }
});

test('explicit enable and dedicated absolute data path are required; aliases are refused', async () => {
    await plugin.initialize({ NativeSyncEnabled: false, NativeSyncDataDir: path.join(root, 'disabled') });
    assert.equal(plugin.snapshot().ready, false); assert.equal(fs.existsSync(path.join(root, 'disabled')), false);
    await assert.rejects(plugin.initialize({ NativeSyncEnabled: true, NativeSyncDataDir: 'relative' }), /ABSOLUTE_DATA_DIR/);
    const actual = path.join(root, 'actual'); const alias = path.join(root, 'alias'); fs.mkdirSync(actual);
    fs.symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(plugin.initialize({ NativeSyncEnabled: true, NativeSyncDataDir: alias }), /DATA_DIR_ALIAS/);
    const hard = path.join(root, 'hard'); fs.mkdirSync(hard); fs.writeFileSync(path.join(hard, 'source'), 'synthetic'); fs.linkSync(path.join(hard, 'source'), path.join(hard, 'central.sqlite'));
    await assert.rejects(plugin.initialize({ NativeSyncEnabled: true, NativeSyncDataDir: hard }), /DB_ALIAS/);
});

test('authenticated Express routes preserve journal/idempotency through plugin shutdown and reinitialize', async t => {
    const config = { NativeSyncEnabled: true, NativeSyncDataDir: path.join(root, 'restart') };
    await plugin.initialize(config);
    const app = express(); app.use(auth('synthetic-key')); app.use(express.json({ limit: '1mb' }));
    const router = express.Router(); plugin.registerApiRoutes(router); app.use('/api/plugins/NativeSync', router);
    plugin.registerRoutes(app, express.Router(), {}, root);
    const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
    t.after(async () => { await plugin.shutdown(); await new Promise(resolve => server.close(resolve)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (route, body, key = 'synthetic-key') => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal((await request('/api/v1/sync/push', operation, 'wrong')).status, 401);
    assert.equal(plugin.snapshot().metrics.journalRows, 0);
    let response = await request('/api/v1/sync/push', operation); assert.equal(response.status, 200); const ack = await response.json();
    response = await request('/api/plugins/NativeSync/sync/push', operation); assert.deepEqual(await response.json(), { ...ack, replayed: true });
    assert.equal(plugin.snapshot().metrics.journalRows, 1);
    await plugin.shutdown(); assert.equal((await request('/api/v1/sync/status')).status, 503);
    await plugin.initialize(config);
    response = await request('/api/v1/sync/push', operation); assert.deepEqual(await response.json(), { ...ack, replayed: true });
    assert.equal((await (await request('/api/v1/sync/pull?after_seq=0&limit=1')).json()).events.length, 1);
    assert.equal(plugin.snapshot().metrics.journalRows, 1);
    assert.equal((await request('/api/v1/sync/push', { ...operation, opId: 'conflict', message: { ...operation.message, content: 'concurrent edit' } })).status, 409);
    assert.equal(plugin.snapshot().metrics.journalRows, 1);
});

test('HTTP adapter drains an already accepted raw request before closing SQLite and rejects new work', async () => {
    let release, entered, closed = false, applied = 0;
    const accepted = new Promise(resolve => { entered = resolve; });
    const body = new Promise(resolve => { release = resolve; });
    const service = createSyncHttpService({ apply() { applied++; return { seq: 1 }; }, close() { closed = true; } });
    const makeResponse = () => ({ status: null, writeHead(code) { this.status = code; }, end() {} });
    const first = service.handle({ url: '/push', method: 'POST', async *[Symbol.asyncIterator]() { entered(); yield await body; } }, makeResponse());
    await accepted;
    const closing = service.close(); await Promise.resolve(); assert.equal(closed, false);
    const later = makeResponse(); await service.handle({ url: '/status', method: 'GET' }, later); assert.equal(later.status, 503);
    release(JSON.stringify(operation)); await first; await closing; assert.equal(applied, 1); assert.equal(closed, true);
});

test('R4 schema/write authority and canonical/hash rules remain unchanged; scoped pull is tested separately', () => {
    const chat = process.env.VCP_P1_CHAT_SOURCE || path.resolve(__dirname, '../../vcpchat-native-sync-r1');
    const normalize = s => s.replaceAll('\r\n', '\n');
    for (const item of JSON.parse(fs.readFileSync(path.resolve(__dirname, '../Plugin/NativeSync/SOURCE_PROVENANCE.json'), 'utf8'))) {
        let expected = normalize(fs.readFileSync(path.join(chat, item.source), 'utf8'));
        if (item.destination === 'sync/protocol.js') expected = expected.replaceAll('../../../VCPDistributedServer/Plugin/VCPMobileSync/sync/canonical', './canonical/canonical').replaceAll('../../../VCPDistributedServer/Plugin/VCPMobileSync/core/hash', './canonical/hash');
        if (item.destination.endsWith('/canonical.js')) expected = expected.replace('../core/hash', './hash');
        const actual = normalize(fs.readFileSync(path.resolve(__dirname, '../Plugin/NativeSync', item.destination), 'utf8'));
        if (item.destination === 'sync/centralStore.js') {
            assert.equal(actual.slice(0, actual.indexOf('  pull(')), expected.slice(0, expected.indexOf('  pull(')));
            assert.equal(actual.slice(actual.indexOf('  metrics(')), expected.slice(expected.indexOf('  metrics(')));
        } else assert.equal(actual, expected);
    }
});
