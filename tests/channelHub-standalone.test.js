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
