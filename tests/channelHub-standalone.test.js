'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '../Plugin/ChannelHub');

test('ChannelHub is a native VCP service with a self-contained implementation', () => {
    const manifest = require(path.join(pluginRoot, 'plugin-manifest.json'));
    assert.equal(manifest.name, 'ChannelHub');
    assert.equal(manifest.pluginType, 'service');
    assert.equal(manifest.communication.protocol, 'direct');
    for (const file of [
        'core/ChannelHubService.js',
        'api/adapter-api.mjs',
        'adapter-loader.js',
        'core/schemas/ChannelEventEnvelope.schema.json',
        'routes/admin/channelHub.js',
        'routes/admin/mediaGateway.js',
        'routes/internal/channelHub.js',
        'ui/index.html',
        'ui/app.js',
        'ui/style.css'
    ]) assert.ok(fs.existsSync(path.join(pluginRoot, file)), file);
    assert.equal(fs.existsSync(path.resolve(__dirname, '../modules/channelHub')), false);
    assert.equal(fs.existsSync(path.resolve(__dirname, '../routes/internal/channelHub.js')), false);
    // Optional sibling adapters must import the contract exported by the plugin,
    // not the deleted modules/channelHub path.
    for (const platform of ['dingtalk', 'wecom', 'onebot']) {
        const adapterPath = path.resolve(__dirname, '../Plugin/vcp-' + platform + '-adapter/src/adapter/contract.js');
        const source = fs.readFileSync(adapterPath, 'utf8');
        assert.ok(source.includes('ChannelHub/api/adapter-api.mjs'), platform + ': public contract import missing');
        assert.ok(!source.includes('ChannelHub/core/AdapterContract.js'), platform + ': internal contract import');
        assert.ok(!source.includes('modules/channelHub/AdapterContract.js'), platform + ': legacy contract import');
    }
    const core = fs.readFileSync(path.join(pluginRoot, 'core/ChannelHubService.js'), 'utf8');
    assert.doesNotMatch(core, /vcp-(?:dingtalk|wecom|onebot)-adapter/);
    const ui = fs.readFileSync(path.join(pluginRoot, 'ui/index.html'), 'utf8');
    assert.match(ui, /list="channel-options"/, 'new platform channels must be enterable without changing code');
    const entry = fs.readFileSync(path.join(pluginRoot, 'channel-hub.js'), 'utf8');
    assert.doesNotMatch(entry, /\.\.\/\.\.\/(?:routes|modules\/channelHub)/);
});

test('enabled ChannelHub refuses to start without injected host authority', async () => {
    const plugin = require(path.join(pluginRoot, 'channel-hub.js'));
    await assert.rejects(plugin.initialize({
        ChannelHubEnabled: true,
        ChannelHubDataDir: path.resolve(__dirname, '..', 'node_modules', '.unused-channelhub-data'),
        ChannelHubModel: 'synthetic'
    }), /CHANNELHUB_HOST_PORT_OR_KEY_UNAVAILABLE/);
    assert.equal(plugin.snapshot().ready, false);
    await plugin.shutdown();
});

test('DingTalk B2 inline reply is extracted and not misrouted to the old outbox', async () => {
    const { createVcpClient, shouldSendInlineReply } =
        await import('../Plugin/vcp-dingtalk-adapter/src/adapters/vcp/client.js');
    const instance = createVcpClient({
        bridgeUrl: 'http://127.0.0.1/plugin-callback/ChannelHub/events',
        useBridge: true,
        bridgeKey: 'synthetic-only',
        baseUrl: 'http://127.0.0.1',
        model: 'synthetic-model'
    });
    const inline = {
        ok: true, status: 'success', jobId: null,
        reply: { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'inline hello' }] }] }
    };
    assert.equal(instance.extractRichReply(inline).text, 'inline hello');
    assert.equal(shouldSendInlineReply(true, inline), true);
    assert.equal(shouldSendInlineReply(true, { ...inline, jobId: 'queued-1' }), false);
    assert.equal(shouldSendInlineReply(true, { ok: true, status: 'duplicate' }), false);
    assert.equal(shouldSendInlineReply(false, { choices: [{ message: { content: 'direct hello' } }] }), true);
});
