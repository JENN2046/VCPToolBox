'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const WebSocket = require('ws');
const bridge = require('../WebSocketServer');

test('heartbeat interval rejects unsafe and malformed values', () => {
    for (const value of [undefined, null, '', 'abc', '20000ms', 0, -1, 4999, 30001, Infinity, NaN, true, [], 20000.5]) {
        assert.equal(bridge.__testing.normalizeHeartbeatInterval(value), 20000);
    }
    for (const value of [5000, '20000', 30000]) {
        assert.equal(bridge.__testing.normalizeHeartbeatInterval(value), Number(value));
    }
});

test('real authenticated sockets receive protocol pings and synthetic broadcasts; reinitialization and drain clean timers', { timeout: 10000 }, async t => {
    const timers = new Map();
    t.mock.method(global, 'setInterval', (fn, ms) => {
        const handle = { unref() {} };
        timers.set(handle, { fn, ms });
        return handle;
    });
    t.mock.method(global, 'clearInterval', handle => timers.delete(handle));
    const server = http.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const key = randomUUID();
    const sockets = [];
    t.after(async () => {
        for (const ws of sockets) ws.terminate();
        await bridge.shutdown();
        await new Promise(resolve => server.close(resolve));
    });
    const connect = async route => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/${route}/VCP_Key=${key}?deviceName=heartbeat-unit-test`);
        sockets.push(ws);
        const [message] = await once(ws, 'message');
        assert.equal(JSON.parse(message).type, 'connection_ack');
        return ws;
    };
    bridge.initialize(server, { vcpKey: key, debugMode: false, heartbeatEnabled: true, heartbeatIntervalMs: 20000 });
    const info = await connect('vcpinfo');
    const log = await connect('VCPlog');
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].ms, 20000);
    const pingEvents = [once(info, 'ping'), once(log, 'ping')];
    [...timers.values()][0].fn();
    await Promise.all(pingEvents);

    for (const [ws, type] of [[info, 'VCPInfo'], [log, 'VCPLog']]) {
        const delivered = once(ws, 'message');
        bridge.broadcast({ type: 'heartbeat_test_event', data: { nonce: 'synthetic-only' } }, type);
        const event = JSON.parse((await delivered)[0]);
        assert.equal(event.type, 'heartbeat_test_event');
        assert.deepEqual(event.data, { nonce: 'synthetic-only' });
    }

    bridge.initialize(server, { heartbeatIntervalMs: 5000 });
    assert.equal(server.listenerCount('upgrade'), 1);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].ms, 5000);
    assert.equal(info.readyState, WebSocket.OPEN);
    assert.throws(() => bridge.initialize(http.createServer(), {}), /Shut down/);
    assert.equal(timers.size, 1);
    bridge.initialize(server, { heartbeatEnabled: false });
    assert.equal(timers.size, 0);
    bridge.initialize(server, { heartbeatEnabled: true });
    assert.equal(timers.size, 1);
    await bridge.beginDrain();
    assert.equal(timers.size, 0);
    await bridge.shutdown();
    assert.equal(timers.size, 0);
    bridge.initialize(server, { heartbeatEnabled: true, heartbeatIntervalMs: 20000 });
    assert.equal(timers.size, 1);
    assert.equal(server.listenerCount('upgrade'), 1);
    await bridge.shutdown();
    assert.equal(timers.size, 0);
    assert.equal(server.listenerCount('upgrade'), 0);
    await bridge.beginDrain();
    assert.equal(timers.size, 0);
});
