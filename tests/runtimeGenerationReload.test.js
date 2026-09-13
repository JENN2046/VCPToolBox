'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const pluginModule = require('../Plugin');
const { PluginManager } = pluginModule;
const { createDirectPluginRuntime } = require('../modules/directPluginRuntime');
const toolCallRecordStore = require('../modules/toolCallRecordStore');

let generationId = 0;

async function makeGeneration(options = {}) {
    const id = ++generationId;
    const counters = options.counters || { starts: 0, stops: 0 };
    const manifest = {
        name: 'ReloadFixture',
        displayName: 'ReloadFixture',
        pluginType: 'hybridservice',
        communication: { protocol: 'direct' },
        capabilities: { invocationCommands: [] }
    };
    const runtime = createDirectPluginRuntime({
        async initialize() {
            counters.starts += 1;
            if (options.failStart) throw new Error('candidate start failed');
        },
        async shutdown() {
            counters.stops += 1;
        },
        health() {
            return { status: 'ready' };
        },
        getReloadBlockers() {
            return options.blockers || [];
        },
        processToolCall(args) {
            return args;
        }
    }, {
        generationId: id,
        manifest,
        config: {},
        dependencies: {}
    });
    await runtime.prepare();
    return {
        id,
        reason: options.reason || 'test',
        state: 'PREPARED',
        createdAt: new Date().toISOString(),
        startedAt: null,
        stoppedAt: null,
        activeRequests: 0,
        activeByPlugin: new Map(),
        plugins: new Map([[manifest.name, manifest]]),
        staticPlaceholderValues: new Map(),
        messagePreprocessors: new Map(),
        serviceModules: new Map([[
            manifest.name,
            { manifest, module: runtime.routeModule, runtime }
        ]]),
        runtimes: new Map([[manifest.name, runtime]]),
        initializationOrder: [manifest.name],
        preprocessorOrder: [],
        publicRouter: express.Router(),
        adminRouter: express.Router(),
        routesRegistered: false,
        scheduledJobs: new Map(),
        staticTasks: new Set(),
        staticAbortController: new AbortController(),
        staticInitialized: false,
        counters
    };
}

async function createManagerWithGeneration(t, options = {}) {
    const manager = new PluginManager();
    const generation = await makeGeneration(options);
    await manager._startRuntimeGeneration(generation);
    manager._commitRuntimeGeneration(generation);
    t.after(async () => {
        await manager.shutdownAllPlugins();
    });
    return { manager, generation };
}

test.after(async () => {
    await pluginModule.toolApprovalManager.shutdown();
    await toolCallRecordStore.shutdown();
});

test('default reload returns 409 and leaves an active blocked generation running', async t => {
    const { manager, generation } = await createManagerWithGeneration(t, {
        blockers: [{ type: 'active_fixture', id: 'work-1' }]
    });
    const candidate = await makeGeneration();
    manager._buildRuntimeGeneration = async () => candidate;

    await assert.rejects(
        manager.reloadPlugins({ force: false, reason: 'blocker-test' }),
        error => error.code === 'PLUGIN_RELOAD_BLOCKED'
            && error.statusCode === 409
            && error.result.blockers[0].id === 'work-1'
    );
    assert.equal(manager.currentGeneration, generation);
    assert.equal(generation.runtimes.get('ReloadFixture').started, true);
    assert.equal(candidate.runtimes.get('ReloadFixture').started, false);
});

test('failed candidate start restarts and recommits the retained generation', async t => {
    const oldCounters = { starts: 0, stops: 0 };
    const { manager, generation } = await createManagerWithGeneration(t, {
        counters: oldCounters
    });
    const candidate = await makeGeneration({ failStart: true });
    manager._buildRuntimeGeneration = async () => candidate;

    await assert.rejects(
        manager.reloadPlugins({ reason: 'rollback-test' }),
        error => error.reloadResult?.rollback?.succeeded === true
    );
    assert.equal(manager.currentGeneration, generation);
    assert.equal(manager.runtimeState, 'READY');
    assert.equal(generation.runtimes.get('ReloadFixture').started, true);
    assert.equal(oldCounters.starts, 2);
    assert.equal(oldCounters.stops, 1);
});

test('candidate preparation leaves the active generation dispatchable', async t => {
    const { manager, generation } = await createManagerWithGeneration(t);
    const candidate = await makeGeneration();
    let preparationStarted;
    let releasePreparation;
    const preparationStartedPromise = new Promise(resolve => {
        preparationStarted = resolve;
    });
    const releasePreparationPromise = new Promise(resolve => {
        releasePreparation = resolve;
    });
    manager._buildRuntimeGeneration = async () => {
        preparationStarted();
        await releasePreparationPromise;
        return candidate;
    };

    const reloadPromise = manager.reloadPlugins({ reason: 'prepare-continuity-test' });
    await preparationStartedPromise;

    try {
        assert.equal(manager.runtimeState, 'READY');
        assert.equal(manager.currentGeneration, generation);
        const resultDuringPrepare = await manager.processToolCall(
            'ReloadFixture',
            { duringPrepare: true }
        );
        assert.equal(resultDuringPrepare.duringPrepare, true);
    } finally {
        // Never strand the in-flight reload if an assertion fails; otherwise
        // the test itself leaves a live promise/open handle behind.
        releasePreparation();
    }
    const result = await reloadPromise;
    assert.equal(result.status, 'success');
    assert.equal(manager.currentGeneration, candidate);
});

test('50 consecutive generation swaps do not accumulate runtime or EventEmitter listeners', async t => {
    const { manager } = await createManagerWithGeneration(t);
    const baselineListenerCounts = Object.fromEntries(
        manager.eventNames().map(name => [String(name), manager.listenerCount(name)])
    );
    const generations = [];
    manager._buildRuntimeGeneration = async reason => {
        const generation = await makeGeneration({ reason });
        generations.push(generation);
        return generation;
    };

    const originalLog = console.log;
    console.log = () => {};
    try {
        for (let index = 0; index < 50; index += 1) {
            const result = await manager.reloadPlugins({ reason: `leak-test-${index}` });
            assert.equal(result.status, 'success');
        }
    } finally {
        console.log = originalLog;
    }

    for (const generation of generations.slice(0, -1)) {
        assert.equal(generation.runtimes.get('ReloadFixture').started, false);
        assert.equal(generation.scheduledJobs.size, 0);
        assert.equal(generation.staticTasks.size, 0);
    }
    assert.equal(manager.currentGeneration, generations.at(-1));
    assert.deepEqual(
        Object.fromEntries(manager.eventNames().map(name => [String(name), manager.listenerCount(name)])),
        baselineListenerCounts
    );
});
