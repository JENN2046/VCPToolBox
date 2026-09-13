'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

test('ChromeBridge rebinds host-owned sockets without accumulating generation listeners', async () => {
    const ws = new EventEmitter();
    ws.clientId = 'chrome-lifecycle-fixture';
    ws.clientIp = '127.0.0.1';
    ws.readyState = 1;
    ws.send = () => {};

    const pluginManager = {
        staticPlaceholderValues: new Map()
    };
    const webSocketServer = {
        getChromeObserverClients: () => [ws]
    };
    const modulePath = require.resolve('../Plugin/ChromeBridge/ChromeBridge.js');

    for (let generation = 0; generation < 5; generation += 1) {
        delete require.cache[modulePath];
        const bridge = require(modulePath);
        await bridge.initialize({}, { pluginManager, webSocketServer });

        assert.equal(ws.listenerCount('close'), 1);
        assert.equal(ws.listenerCount('error'), 1);
        assert.equal(bridge.health().connectedClients, 1);

        await bridge.shutdown();
        assert.equal(ws.listenerCount('close'), 0);
        assert.equal(ws.listenerCount('error'), 0);
    }
});
