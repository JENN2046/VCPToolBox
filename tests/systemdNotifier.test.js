'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const SystemdNotifier = require('../modules/systemdNotifier');

test('systemd watchdog uses the portable WATCHDOG=1 sd_notify field', async () => {
    const invocations = [];
    const spawnProcess = (command, args, options) => {
        invocations.push({ command, args, options });
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('exit', 0, null));
        return child;
    };
    const notifier = new SystemdNotifier({
        notifySocket: '/run/user/test/notify',
        spawnProcess
    });

    const sent = await notifier.watchdog();

    assert.equal(sent, true);
    assert.equal(invocations.length, 1);
    assert.equal(invocations[0].command, 'systemd-notify');
    assert.deepEqual(invocations[0].args, ['WATCHDOG=1']);
    assert.equal(invocations[0].options.env, process.env);
});
