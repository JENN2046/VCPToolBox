'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const {
    CALLBACK_COMPATIBILITY_DEADLINE_MS,
    authorizeCallback,
    atomicWriteJson,
    resolveCallbackResultPath,
    validateCallbackParams,
    resetCallbackCompatibilityMetricsForTests
} = require('../modules/asyncCallbackSecurity');

test.beforeEach(() => resetCallbackCompatibilityMetricsForTests());

test('callback identifiers reject traversal, encoded separators and excessive length', () => {
    for (const taskId of ['..', '.', '../escape', decodeURIComponent('%2e%2e%2fescape'), 'x'.repeat(201)]) {
        assert.equal(validateCallbackParams('AgentAssistant', taskId).ok, false, taskId);
    }
    assert.equal(validateCallbackParams('AgentAssistant', 'task:2026-08_05.1').ok, true);
});

test('resolved callback files remain under VCPAsyncResults', () => {
    const root = path.resolve('/tmp/VCPAsyncResults-test');
    const result = resolveCallbackResultPath(root, 'AgentAssistant', 'task-1');
    assert.equal(path.dirname(result), root);
    assert.throws(
        () => resolveCallbackResultPath(root, 'AgentAssistant', '../outside'),
        /Invalid callback identifier/
    );
});

test('callback compatibility is fixed-time, built-in-only and never accepts bad credentials', () => {
    const beforeDeadline = CALLBACK_COMPATIBILITY_DEADLINE_MS - 1;
    const afterDeadline = CALLBACK_COMPATIBILITY_DEADLINE_MS + 1;

    assert.equal(authorizeCallback({
        authorization: undefined,
        serverKey: 'secret',
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        now: beforeDeadline
    }).mode, 'legacy_compatibility');

    assert.equal(authorizeCallback({
        authorization: undefined,
        serverKey: 'secret',
        pluginName: 'UnknownPlugin',
        taskId: 'task-1',
        now: beforeDeadline
    }).statusCode, 401);

    assert.equal(authorizeCallback({
        authorization: 'Bearer wrong',
        serverKey: 'secret',
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        now: beforeDeadline
    }).statusCode, 401);

    assert.equal(authorizeCallback({
        authorization: undefined,
        serverKey: 'secret',
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        now: afterDeadline
    }).statusCode, 401);

    assert.equal(authorizeCallback({
        authorization: 'Bearer secret',
        serverKey: 'secret',
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        now: afterDeadline
    }).mode, 'bearer');
});

test('callback JSON is committed atomically without temporary-file residue', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-callback-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'AgentAssistant-task.json');
    await atomicWriteJson(target, { status: 'Succeed', message: 'ok' });

    assert.deepEqual(JSON.parse(await fs.readFile(target, 'utf8')), {
        status: 'Succeed',
        message: 'ok'
    });
    assert.deepEqual(await fs.readdir(directory), ['AgentAssistant-task.json']);
});
