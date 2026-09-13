'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDirectPluginRuntime } = require('../modules/directPluginRuntime');

test('Runtime V2 legacy adapter is restartable and shutdown is idempotent', async () => {
    const calls = [];
    const moduleExports = {
        async initialize(config, dependencies) {
            calls.push(['start', config.value, dependencies.marker]);
        },
        async processToolCall(args) {
            return { echo: args.value };
        },
        async shutdown() {
            calls.push(['stop']);
        },
        health() {
            return { status: 'ready' };
        },
        getReloadBlockers() {
            return [{ type: 'active_test' }];
        }
    };
    const runtime = createDirectPluginRuntime(moduleExports, {
        manifest: { name: 'TestRuntime' },
        config: { value: 7 },
        dependencies: { marker: 'dependency' }
    });

    await runtime.prepare();
    assert.equal(runtime.started, false);
    await runtime.start();
    assert.deepEqual(await runtime.process({ value: 3 }, {}), { echo: 3 });
    assert.deepEqual(await runtime.getReloadBlockers(), [{ type: 'active_test' }]);
    await runtime.shutdown();
    await runtime.shutdown();
    await runtime.start();
    await runtime.shutdown();

    assert.deepEqual(calls, [
        ['start', 7, 'dependency'],
        ['stop'],
        ['start', 7, 'dependency'],
        ['stop']
    ]);
});

test('Runtime V2 uses a native createRuntime factory when provided', async () => {
    let prepared = 0;
    const runtime = createDirectPluginRuntime({
        createRuntime(context) {
            return {
                prepare() {
                    prepared += 1;
                },
                start() {},
                shutdown() {},
                processMessages(messages) {
                    return messages.concat({ role: 'system', content: context.manifest.name });
                }
            };
        }
    }, {
        manifest: { name: 'FactoryRuntime' },
        config: {},
        dependencies: {}
    });

    await runtime.prepare();
    await runtime.start();
    assert.equal(prepared, 1);
    assert.equal((await runtime.processMessages([], {}))[0].content, 'FactoryRuntime');
    await runtime.shutdown();
});
