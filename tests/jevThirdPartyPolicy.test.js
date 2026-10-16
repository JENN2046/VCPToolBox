'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { JevThirdPartyRegistry } = require('../modules/jevThirdPartyRegistry');

test('管理策略：旧环境回退、空名单、精确名单、不限和损坏拒绝', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-policy-'));
    const registry = new JevThirdPartyRegistry();
    registry.policyPath = path.join(dir, 'policy.json');
    const env = { JEV_THIRD_PARTY_ALLOWLIST: 'OldPlugin' };
    try {
        assert.deepEqual(registry.getAllowlist(env), ['OldPlugin']);
        fs.writeFileSync(registry.policyPath, JSON.stringify({ mode: 'selected', allowlist: [] }));
        assert.deepEqual(registry.getAllowlist(env), []);
        fs.writeFileSync(registry.policyPath, JSON.stringify({ mode: 'selected', allowlist: ['AgentMessage', 'AgentMessage'] }));
        assert.deepEqual(registry.getAllowlist(env), ['AgentMessage']);
        fs.writeFileSync(registry.policyPath, JSON.stringify({ mode: 'selected', allowlist: ['Wan2.1VideoGen'] }));
        assert.deepEqual(registry.getAllowlist(env), ['Wan2.1VideoGen']);
        fs.writeFileSync(registry.policyPath, JSON.stringify({ mode: 'unrestricted', allowlist: [] }));
        assert.equal(registry.getAllowlist(env), null);
        fs.writeFileSync(registry.policyPath, '{broken');
        assert.deepEqual(registry.getAllowlist(env), []);
        fs.writeFileSync(registry.policyPath, JSON.stringify({ mode: 'selected', allowlist: ['../bad'] }));
        assert.deepEqual(registry.getAllowlist(env), []);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('策略读写与注册表共用精确工具名语法，点号不改变实验总开关', async () => {
    const registry = require('../modules/jevThirdPartyRegistry');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-dotted-policy-'));
    const name = 'Wan2.1VideoGen';
    const oldPath = registry.policyPath;
    const previous = registry.entries.get(name);
    registry.policyPath = path.join(dir, 'policy.json');
    registry.entries.set(name, { toolName: name, validation: { status: 'valid' } });
    const app = express();
    app.use(express.json());
    app.use(require('../routes/admin/jevRegistry')({ pluginManager: {}, jevPolicyPath: registry.policyPath }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        const post = value => fetch(`http://127.0.0.1:${server.address().port}/jev/registry/policy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'selected', allowlist: [value] })
        });
        assert.equal((await post(name)).status, 200);
        assert.deepEqual(registry.getAllowlist({}), [name]);
        assert.equal(registry.isExperimentEnabled({}), false);
        for (const bad of ['../bad', '1bad', '', 'A'.repeat(129), 'wan2.1videogen']) {
            assert.equal((await post(bad)).status, 400);
            assert.deepEqual(registry.getAllowlist({}), [name]);
        }
    } finally {
        registry.policyPath = oldPath;
        if (previous) registry.entries.set(name, previous); else registry.entries.delete(name);
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('管理路由拒绝非法策略与未注册插件，不落盘', async () => {
    const app = express();
    app.use(express.json());
    app.use(require('../routes/admin/jevRegistry')({ pluginManager: {} }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        for (const body of [
            { mode: 'selected', allowlist: '../bad' },
            { mode: 'selected', allowlist: ['../bad'] },
            { mode: 'invalid', allowlist: [] },
            { mode: 'selected', allowlist: ['DefinitelyNotRegistered_Plfta'] }
        ]) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/jev/registry/policy`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            });
            assert.equal(response.status, 400);
        }
    } finally { await new Promise(resolve => server.close(resolve)); }
});
test('管理接口原子保存空名单并立即拒绝全部，可恢复不限模式', async () => {
    const registry = require('../modules/jevThirdPartyRegistry');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-policy-http-'));
    const oldPath = registry.policyPath;
    registry.policyPath = path.join(dir, 'policy.json');
    const app = express();
    app.use(express.json());
    app.use(require('../routes/admin/jevRegistry')({ pluginManager: {}, jevPolicyPath: registry.policyPath }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        for (const mode of ['selected', 'unrestricted']) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/jev/registry/policy`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, allowlist: [] })
            });
            assert.equal(response.status, 200);
            const result = await response.json();
            assert.deepEqual(result.experiment.allowlist, mode === 'selected' ? [] : null);
            assert.deepEqual(JSON.parse(fs.readFileSync(registry.policyPath, 'utf8')), { mode, allowlist: [] });
        }
        assert.deepEqual(fs.readdirSync(dir), ['policy.json']);
    } finally {
        registry.policyPath = oldPath;
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
