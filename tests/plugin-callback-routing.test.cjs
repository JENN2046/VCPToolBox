'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

const routePath = '/plugin-callback/:pluginName/:taskId';
const bridgeKey = 'synthetic-callback-regression-key';
const body = { version: 'B2', text: 'synthetic callback' };

function registerActualCallback(app, effects) {
    // Exercise the server's real registration without starting the full server,
    // loading runtime configuration, or importing any provider/plugin process.
    const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
    const start = source.indexOf(`app.post('${routePath}',`);
    const end = source.indexOf('\n});', start);
    assert.ok(start >= 0 && end > start, 'the native callback registration must exist');
    const manifest = { webSocketPush: { enabled: true, messageType: 'synthetic_result' } };
    vm.runInNewContext(source.slice(start, end + '\n});'.length), {
        // Keep Express's native-Promise behavior across the VM realm boundary.
        app: { post: (route, handler) => app.post(route, async (...args) => handler(...args)) },
        path, DEBUG_MODE: false, VCP_ASYNC_RESULTS_DIR: '/synthetic-results',
        ensureAsyncResultsDir: async () => { effects.directoryCreates++; },
        fs: { writeFile: async (...args) => { effects.writes.push(args); } },
        pluginManager: { getPlugin: name => ['ChannelHub', 'LegacyTool'].includes(name) ? manifest : null },
        webSocketServer: { broadcast: (...args) => { effects.broadcasts.push(args); } },
        console: { log() {}, error() {} },
    });
}

async function fixture(t, { pluginInstalled = true, pluginError = false } = {}) {
    const effects = { directoryCreates: 0, writes: [], broadcasts: [], pluginCalls: 0 };
    const app = express();
    app.use(express.json());
    registerActualCallback(app, effects);
    // Match native startup order: the service registers after the generic route.
    // This synthetic guard checks handoff, not the external plugin's protocol.
    if (pluginInstalled) app.post('/plugin-callback/ChannelHub/events', (req, res) => {
        effects.pluginCalls++;
        if (req.get('x-channel-bridge-key') !== bridgeKey) return res.status(401).json({ error: 'denied' });
        if (pluginError) return res.status(503).json({ error: 'synthetic-unavailable' });
        res.json({ accepted: true });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    return {
        effects,
        post: (url, key) => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
            method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-channel-bridge-key': key } : {}) },
            body: JSON.stringify(body),
        }),
    };
}

function assertNoLegacyEffects(effects) {
    assert.equal(effects.directoryCreates, 0, 'reserved events must not create the async-result directory');
    assert.equal(effects.writes.length, 0, 'reserved events must not be persisted as legacy task results');
    assert.equal(effects.broadcasts.length, 0, 'reserved events must not produce legacy WebSocket pushes');
}

for (const key of [undefined, 'synthetic-wrong-key']) {
    test(`ChannelHub events reach the service credential gate (${key ? 'wrong' : 'missing'} key)`, async t => {
        const f = await fixture(t);
        const result = await f.post('/plugin-callback/ChannelHub/events', key);
        assert.equal(result.status, 401);
        assert.equal(f.effects.pluginCalls, 1);
        assertNoLegacyEffects(f.effects);
    });
}

test('valid ChannelHub events are acknowledged only by the later service route', async t => {
    const f = await fixture(t);
    const result = await f.post('/plugin-callback/ChannelHub/events', bridgeKey);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { accepted: true });
    assert.equal(f.effects.pluginCalls, 1);
    assertNoLegacyEffects(f.effects);
});

for (const route of [
    '/plugin-callback/ChannelHub/EVENTS',
    '/plugin-callback/ChannelHub/Events',
    '/plugin-callback/channelhub/events',
    '/plugin-callback/CHANNELHUB/events',
    '/plugin-callback/ChannelHub/events/',
]) {
    test(`case/trailing-slash aliases keep the plugin gate: ${route}`, async t => {
        const f = await fixture(t);
        assert.equal((await f.post(route, 'synthetic-wrong-key')).status, 401);
        assert.equal(f.effects.pluginCalls, 1);
        assertNoLegacyEffects(f.effects);
    });
}

for (const route of ['/plugin-callback/ChannelHub/events', '/plugin-callback/ChannelHub/EVENTS']) {
    test(`an absent service fails closed without saving a task result: ${route}`, async t => {
        const f = await fixture(t, { pluginInstalled: false });
        assert.equal((await f.post(route, bridgeKey)).status, 404);
        assertNoLegacyEffects(f.effects);
    });
}

test('a service failure cannot fall back to legacy success or result storage', async t => {
    const f = await fixture(t, { pluginError: true });
    assert.equal((await f.post('/plugin-callback/ChannelHub/events', bridgeKey)).status, 503);
    assertNoLegacyEffects(f.effects);
});

for (const route of ['/plugin-callback/ChannelHub/%65vents', '/plugin-callback/%43hannelHub/events']) {
    test(`encoded reserved names never become legacy async results: ${route}`, async t => {
        const f = await fixture(t, { pluginInstalled: false });
        assert.equal((await f.post(route, bridgeKey)).status, 404);
        assertNoLegacyEffects(f.effects);
    });
}

for (const [plugin, taskId] of [['LegacyTool', 'events'], ['LegacyTool', 'task-1'], ['ChannelHub', 'task-1'], ['ChannelHub', 'events-1']]) {
    test(`ordinary async callbacks retain persistence, push and acknowledgement: ${plugin}/${taskId}`, async t => {
        const f = await fixture(t);
        const result = await f.post(`/plugin-callback/${plugin}/${taskId}`);
        assert.equal(result.status, 200);
        assert.equal((await result.json()).status, 'success');
        assert.equal(f.effects.pluginCalls, 0);
        assert.equal(f.effects.directoryCreates, 1);
        assert.equal(f.effects.writes.length, 1);
        assert.equal(f.effects.writes[0][0], path.join('/synthetic-results', `${plugin}-${taskId}.json`));
        assert.deepEqual(JSON.parse(f.effects.writes[0][1]), body);
        assert.equal(f.effects.broadcasts.length, 1);
    });
}
