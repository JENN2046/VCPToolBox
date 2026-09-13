'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

test('VCPToolBridge removes generation listeners and restores its WebSocket hook', async () => {
    const modulePath = require.resolve('../Plugin/VCPToolBridge');
    delete require.cache[modulePath];
    const bridge = require(modulePath);
    const pluginManager = new EventEmitter();
    const originalHandler = async () => 'original';
    const webSocketServer = {
        handleDistributedServerMessage: originalHandler,
        sendMessageToClient() {}
    };
    const router = { get() {} };
    const dependencies = {
        pluginManager,
        vcpLogFunctions: { pushVcpLog() {}, pushVcpInfo() {} }
    };

    for (let generation = 0; generation < 3; generation += 1) {
        await bridge.initialize({ Bridge_Enabled: true }, dependencies);
        bridge.registerApiRoutes(router, { Bridge_Enabled: true }, '', webSocketServer);

        assert.equal(pluginManager.listenerCount('vcp_log'), 1);
        assert.equal(pluginManager.listenerCount('vcp_info'), 1);
        assert.equal(pluginManager.listenerCount('plugin_async_callback'), 1);
        assert.notEqual(webSocketServer.handleDistributedServerMessage, originalHandler);

        await bridge.shutdown();
        assert.equal(pluginManager.listenerCount('vcp_log'), 0);
        assert.equal(pluginManager.listenerCount('vcp_info'), 0);
        assert.equal(pluginManager.listenerCount('plugin_async_callback'), 0);
        assert.equal(webSocketServer.handleDistributedServerMessage, originalHandler);
    }
});
