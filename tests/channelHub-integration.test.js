'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const express = require('express');
const { HostRuntime } = require('../Plugin/ChannelHub/host-runtime');
const { ChannelHubService } = require('../Plugin/ChannelHub/core/ChannelHubService');
const plugin = require('../Plugin/ChannelHub/channel-hub');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); };
const agents = { isAgent: name => name === 'synthetic', getAgentPrompt: async () => 'SYNTHETIC_AGENT' };

test('disabled service does not import the legacy core or create storage', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'channelhub-disabled-'));
    const entry = path.resolve(__dirname, '../Plugin/ChannelHub/channel-hub');
    const result = spawnSync(process.execPath, ['-e', `const Module=require('node:module'),load=Module._load;Module._load=function(id,...args){if(id.includes('ChannelHubService')||id==='express')throw Error('DISABLED_IMPORT');return load.call(this,id,...args)};require(${JSON.stringify(entry)}).initialize({ChannelHubDataDir:${JSON.stringify(path.join(root, 'data'))}}).catch(()=>process.exitCode=1)`], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(root), []);
    fs.rmSync(root, { recursive: true });
});

test('host runtime uses configured Agent/model, preserves parts and refuses upstream overrides and errors', async t => {
    let calls = 0, fail = false;
    const server = http.createServer(async (req, res) => {
        let bytes = ''; for await (const chunk of req) bytes += chunk;
        const body = JSON.parse(bytes); calls++;
        assert.equal(req.url, '/v1/chat/completions'); assert.equal(req.headers.authorization, 'Bearer synthetic-host');
        assert.equal(body.messages[0].content, 'SYNTHETIC_AGENT'); assert.equal(body.model, 'synthetic-model');
        assert.deepEqual(body.messages[1].content, [{ type: 'text', text: 'hello' }, { type: 'image_url', image_url: { url: 'https://synthetic.invalid/image' } }]);
        assert.equal(body.apiKeyOverride, undefined); assert.equal(body.apiBaseOverride, undefined);
        res.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(fail ? { error: 'synthetic failure' } : { choices: [{ message: { content: 'synthetic reply' } }] }));
    });
    const port = await listen(server), runtime = new HostRuntime({ agentManager: agents, model: 'synthetic-model' });
    t.after(async () => { await runtime.close(); await close(server); });
    for (const url of ['https://127.0.0.1:1/v1/chat/completions', 'http://remote.invalid/v1/chat/completions', 'http://127.0.0.1/v1/chat/completions?target=x']) assert.throws(() => runtime.setEndpoint({ url, key: 'synthetic' }));
    runtime.setEndpoint({ url: `http://127.0.0.1:${port}/v1/chat/completions`, key: 'synthetic-host' });
    const envelope = { payload: { messages: [{ role: 'system', content: [{ type: 'text', text: 'hello' }, { type: 'image_url', image_url: { url: 'https://synthetic.invalid/image' } }] }] }, runtime: { overrides: { apiBase: 'https://evil.invalid', apiKey: 'evil', model: 'evil' } } };
    assert.equal((await runtime.invoke(envelope, { agentId: 'synthetic', model: 'evil' })).messages[0].content[0].text, 'synthetic reply');
    await assert.rejects(runtime.invoke(envelope, { agentId: 'unmapped-desktop-id' }), /NOT_CONFIGURED/);
    fail = true; await assert.rejects(runtime.invoke(envelope, { agentId: 'synthetic' }), /HOST_HTTP_503/);
    runtime.beginDrain(); await assert.rejects(runtime.invoke(envelope, { agentId: 'synthetic' }), /NOT_READY/);
    assert.equal(calls, 2);
});

test('plugin mounts admin and authenticated B2 routes, returns one inline reply, deduplicates and drains', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'channelhub-host-'));
    const manager = require('../modules/agentManager');
    const originalIsAgent = manager.isAgent, originalPrompt = manager.getAgentPrompt;
    manager.isAgent = agents.isAgent; manager.getAgentPrompt = agents.getAgentPrompt;
    let hostCalls = 0;
    const app = express(); app.use(express.json());
    // Same placement as server.js: admin gate before generic API bearer gate.
    app.use('/admin_api', (req, res, next) => req.headers['x-synthetic-admin'] === 'yes' ? next() : res.status(401).end());
    app.use(require('../modules/apiBearerAuth')('synthetic-host'));
    app.post('/v1/chat/completions', (_req, res) => { hostCalls++; res.json({ choices: [{ message: { content: 'synthetic answer' } }] }); });
    const admin = express.Router(); plugin.registerRoutes(app, admin, {}, root); app.use('/admin_api', admin);
    const server = http.createServer(app), port = await listen(server), url = `http://127.0.0.1:${port}`;
    t.after(async () => { await plugin.shutdown(); manager.isAgent = originalIsAgent; manager.getAgentPrompt = originalPrompt; await close(server); fs.rmSync(root, { recursive: true, force: true }); });
    const config = { ChannelHubEnabled: true, ChannelHubDataDir: root, ChannelHubModel: 'synthetic-model', PORT: String(port), Key: 'synthetic-host' };
    await plugin.initialize(config); plugin.setExecutionEndpoint({ url: url + '/v1/chat/completions', key: 'synthetic-host' });
    const request = (endpoint, body, headers = {}) => fetch(url + endpoint, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    const adminHeaders = { 'x-synthetic-admin': 'yes' };
    assert.equal((await request('/admin_api/channelHub/health')).status, 401);
    assert.equal((await request('/admin_api/channelHub/health', null, adminHeaders)).status, 200);
    assert.equal((await request('/admin_api/channelHub/ui')).status, 401);
    const uiPage = await request('/admin_api/channelHub/ui', null, adminHeaders);
    assert.equal(uiPage.status, 200); assert.match(await uiPage.text(), /ChannelHub/);
    assert.equal((await request('/admin_api/channelHub/ui/app.js', null, adminHeaders)).status, 200);
    assert.equal((await request('/internal/channelHub/health')).status, 401);
    const created = await request('/admin_api/channelHub/adapters', { adapterId: 'synthetic-adapter', channel: 'dingtalk', status: 'active', config: { bridgeKey: 'synthetic-adapter-key' } }, adminHeaders);
    assert.equal(created.status, 201, await created.text());
    const body = { version: '2.0', eventId: 'synthetic-event', adapterId: 'synthetic-adapter', channel: 'dingtalk', eventType: 'message.created', occurredAt: Date.now(), target: { agentId: 'synthetic' }, client: { messageId: 'synthetic-message', conversationId: 'synthetic-chat' }, sender: { userId: 'synthetic-user' }, payload: { messages: [{ role: 'user', content: 'hello' }] } };
    const headers = { 'x-channel-adapter-id': 'synthetic-adapter', 'x-channel-bridge-key': 'synthetic-adapter-key' };
    assert.equal((await request('/plugin-callback/ChannelHub/events', body)).status, 404);
    assert.equal((await request('/plugin-callback/ChannelHub/events', body, { ...headers, 'x-channel-bridge-key': 'wrong' })).status, 401);
    const response = await request('/plugin-callback/ChannelHub/events', body, headers), reply = await response.json();
    assert.equal(response.status, 200, JSON.stringify(reply)); assert.equal(reply.status, 'success'); assert.equal(reply.jobId, null);
    assert.equal(reply.reply.messages[0].content[0].text, 'synthetic answer'); assert.equal(hostCalls, 1);
    const outbox = await (await request('/admin_api/channelHub/outbox', null, adminHeaders)).json(); assert.deepEqual(outbox.data, []);
    const replay = await (await request('/plugin-callback/ChannelHub/events', body, headers)).json(); assert.equal(replay.status, 'duplicate'); assert.equal(hostCalls, 1);
    const forged = { ...body, eventId: 'forged', adapterId: 'another-adapter' };
    assert.equal((await request('/plugin-callback/ChannelHub/events', forged, headers)).status, 400);
    plugin.beginDrain(); assert.equal((await request('/plugin-callback/ChannelHub/events', { ...body, eventId: 'after-drain' }, headers)).status, 503);
    await plugin.shutdown(); assert.equal(plugin.snapshot().ready, false);
    await plugin.initialize(config); assert.equal(plugin.snapshot().ready, true);
    const adapters = await (await request('/admin_api/channelHub/adapters', null, adminHeaders)).json(); assert.equal(adapters.data.length, 1);
});

test('inline service never starts legacy outbox delivery', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'channelhub-inline-'));
    const service = new ChannelHubService({ config: { baseDir: root, deliveryMode: 'inline', mediaStoragePath: path.join(root, 'media'), auditLogDir: path.join(root, 'audit') } });
    t.after(async () => { await service.shutdown(); fs.rmSync(root, { recursive: true, force: true }); });
    await service.initialize(); assert.equal(service.deliveryOutbox.isProcessing, false); assert.equal(service.deliveryOutbox.processTimer, null);
});

test('unchanged PluginManager discovers, initializes, mounts and shuts down ChannelHub', async t => {
    const source = path.resolve(__dirname, '..');
    // Locate the fixture below node_modules so its copied host resolves the same
    // installed dependencies without changing the package or production loader.
    const root = fs.mkdtempSync(path.join(source, 'node_modules/.channelhub-host-'));
    const copied = new Set();
    function copyCode(relative) {
        if (copied.has(relative)) return; copied.add(relative);
        const file = path.join(source, relative), target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(file, target);
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
            const base = path.resolve(path.dirname(file), match[1]);
            const dependency = [base, base + '.js', base + '.json'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
            if (dependency) copyCode(path.relative(source, dependency));
        }
    }
    copyCode('Plugin.js'); copyCode('Plugin/ChannelHub/channel-hub.js');
    for (const relative of ['Plugin/ChannelHub/routes/admin/channelHub.js', 'Plugin/ChannelHub/routes/admin/mediaGateway.js', 'Plugin/ChannelHub/routes/internal/channelHub.js']) copyCode(relative);
    fs.copyFileSync(path.join(source, 'Plugin/ChannelHub/plugin-manifest.json'), path.join(root, 'Plugin/ChannelHub/plugin-manifest.json'));
    const names = { ChannelHubEnabled: 'true', ChannelHubDataDir: path.join(root, 'data'), ChannelHubModel: 'synthetic', PORT: '6005', Key: 'synthetic-host', DebugMode: 'false' };
    const previous = Object.fromEntries(Object.keys(names).map(key => [key, process.env[key]]));
    Object.assign(process.env, names);
    let manager, server;
    t.after(async () => {
        await manager?.shutdownAllPlugins(); await manager?.toolApprovalManager.watcher?.close(); manager?.toolApprovalManager.shutdown();
        if (server) await close(server);
        for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
        fs.rmSync(root, { recursive: true, force: true });
    });
    manager = require(path.join(root, 'Plugin')); manager.setProjectBasePath(root);
    await manager.loadPlugins();
    assert.equal(manager.plugins.size, 1);
    const module = manager.getServiceModule('ChannelHub'); assert.equal(module.snapshot().ready, true);
    const app = express(), admin = express.Router(); app.use(express.json()); manager.initializeServices(app, admin, root); app.use('/admin_api', admin);
    server = http.createServer(app); const port = await listen(server);
    assert.equal((await fetch(`http://127.0.0.1:${port}/admin_api/channelHub/health`)).status, 200);
    await manager.shutdownAllPlugins(); assert.equal(module.snapshot().ready, false);
});

test('VCP host PluginManager remains usable with ChannelHub physically uninstalled', async t => {
    const source = path.resolve(__dirname, '..');
    const root = fs.mkdtempSync(path.join(source, 'node_modules/.no-channelhub-host-'));
    const copied = new Set();
    function copyCode(relative) {
        if (copied.has(relative)) return; copied.add(relative);
        const file = path.join(source, relative), target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(file, target);
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(['"]([.][^'"]+)['"]\)/g)) {
            const base = path.resolve(path.dirname(file), match[1]);
            const dependency = [base, base + '.js', base + '.json']
                .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
            if (dependency) copyCode(path.relative(source, dependency));
        }
    }
    copyCode('Plugin.js');
    fs.mkdirSync(path.join(root, 'Plugin'), { recursive: true });
    let manager;
    t.after(async () => {
        await manager?.shutdownAllPlugins();
        await manager?.toolApprovalManager.watcher?.close();
        manager?.toolApprovalManager.shutdown();
        fs.rmSync(root, { recursive: true, force: true });
    });
    manager = require(path.join(root, 'Plugin'));
    manager.setProjectBasePath(root);
    await manager.loadPlugins();
    assert.equal(manager.getServiceModule('ChannelHub'), undefined);
    const app = express(), admin = express.Router();
    manager.initializeServices(app, admin, root);
    assert.equal(manager.plugins.size, 0);
});

test('drain aborts and awaits an in-flight host request without publishing a reply', async t => {
    let entered; const received = new Promise(resolve => { entered = resolve; });
    const server = http.createServer(async (req, _res) => { for await (const chunk of req) {} entered(); });
    const port = await listen(server), runtime = new HostRuntime({ agentManager: agents, model: 'synthetic' });
    t.after(async () => { await runtime.close(); await close(server); });
    runtime.setEndpoint({ url: `http://127.0.0.1:${port}/v1/chat/completions`, key: 'synthetic' });
    const request = runtime.invoke({ payload: { messages: [{ content: 'held' }] } }, { agentId: 'synthetic' });
    const rejected = assert.rejects(request, /abort/i);
    await received; await runtime.close(); await rejected;
    assert.equal(runtime.pending.size, 0); assert.equal(runtime.controllers.size, 0);
});
