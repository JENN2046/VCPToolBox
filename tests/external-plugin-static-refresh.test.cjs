'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const schedule = require('node-schedule');
const manager = require('../Plugin');
after(() => manager.toolApprovalManager.shutdown());

async function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'static-host-refresh-'));
    const source = path.join(root, 'external');
    const basePath = path.join(source, 'StaticFixture');
    fs.mkdirSync(basePath, { recursive: true });
    const native = { name: 'StaticFixture', displayName: 'Static fixture', pluginType: 'static',
        entryPoint: { command: 'node fixture.js' }, communication: { protocol: 'stdio' },
        refreshIntervalCron: '0 * * * *', configSchema: { FIXTURE_VALUE: 'string' },
        capabilities: { systemPromptPlaceholders: [{ placeholder: '{{STATIC_FIXTURE}}' }] } };
    const manifest = Object.assign(manager._createRuntimePluginEntryFromNativeManifest(native), { pluginSource: 'external', pluginRoot: source,
        pluginRootId: 'external:fixture', basePath, pluginSpecificEnvConfig: {} });
    const file = path.join(basePath, 'plugin-manifest.json');
    fs.writeFileSync(file, JSON.stringify(native));
    const configFile = path.join(root, 'host.json');
    fs.writeFileSync(configFile, JSON.stringify({ bindings: [{ pluginName: native.name,
        sourceDirectory: source, config: { FIXTURE_VALUE: 'SYNTHETIC_HOST_VALUE' } }] }));
    const saved = new Map();
    const set = (key, value) => { saved.set(key, manager[key]); manager[key] = value; };
    for (const key of ['plugins', 'scheduledJobs', 'staticPluginSignatures', 'staticPluginPlaceholderKeys',
        'staticPlaceholderValues', 'messagePreprocessors', 'serviceModules']) set(key, new Map());
    set('staticPluginsInitialized', false);
    set('preprocessorOrder', []);
    const oldFile = process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE;
    const oldAllow = process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST;
    process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE = configFile;
    process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST = `${native.name}@${source}`;
    const jobs = [], calls = [];
    const oldSchedule = schedule.scheduleJob;
    schedule.scheduleJob = (_cron, callback) => {
        const job = { callback, cancelled: false, cancel() { this.cancelled = true; } };
        jobs.push(job); return job;
    };
    set('_updateStaticPluginValue', async current => {
        calls.push({ manifest: current, config: manager._getPluginConfig(current) });
        manager.staticPlaceholderValues.set('{{STATIC_FIXTURE}}', { value: 'fixture', serverId: 'local' });
    });
    set('_validateLocalPluginManifestsBeforeReload', async () => {});
    set('_discoverLegacyPluginManifests', async () => [{ ...manifest }]);
    set('buildVCPDescription', () => {});
    set('buildJevPromptRegistry', async () => {});
    t.after(() => {
        schedule.scheduleJob = oldSchedule;
        for (const [key, value] of saved) manager[key] = value;
        for (const [key, value] of [['VCP_EXTERNAL_PLUGIN_CONFIG_FILE', oldFile], ['VCP_EXTERNAL_PLUGIN_ALLOWLIST', oldAllow]]) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        fs.rmSync(root, { recursive: true, force: true });
    });
    manager.plugins.set(native.name, manifest);
    await manager.initializeStaticPlugins();
    calls.length = 0;
    return { root, manifest, native, file, jobs, calls };
}

test('metadata refresh cron uses current registered object and retains host configuration', async t => {
    const f = await fixture(t);
    fs.writeFileSync(f.file, JSON.stringify({ ...f.native, description: 'metadata updated' }));
    assert.equal((await manager.refreshPluginManifestMetadata(f.file)).refreshed, true);
    const current = manager.plugins.get(f.manifest.name);
    assert.notEqual(current, f.manifest);
    f.jobs[0].callback();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].config.FIXTURE_VALUE, 'SYNTHETIC_HOST_VALUE');
    assert.equal(f.calls[0].manifest, current);
    assert.equal(manager._getPluginConfig(f.manifest).FIXTURE_VALUE, undefined);
});

test('ordinary reload retains same-signature cron but executes newly registered object', async t => {
    const f = await fixture(t);
    await manager.loadPlugins();
    assert.equal(f.jobs.length, 1);
    assert.equal(f.jobs[0].cancelled, false);
    assert.equal(f.calls.length, 0);
    f.jobs[0].callback();
    assert.equal(f.calls[0].manifest, manager.plugins.get(f.manifest.name));
    assert.equal(f.calls[0].config.FIXTURE_VALUE, 'SYNTHETIC_HOST_VALUE');
});

test('stale cron cannot execute removed, non-static, or different-source replacement', async t => {
    const f = await fixture(t);
    manager.plugins.delete(f.manifest.name);
    f.jobs[0].callback();
    manager.plugins.set(f.manifest.name, { ...f.manifest, pluginType: 'synchronous' });
    f.jobs[0].callback();
    for (const changed of [{ pluginSource: 'core' }, { pluginRootId: 'external:other' },
        { basePath: f.root }, { isDistributed: true }, { pluginRoot: f.root }]) {
        manager.plugins.set(f.manifest.name, { ...f.manifest, ...changed });
        f.jobs[0].callback();
    }
    assert.equal(f.calls.length, 0);
    await manager.initializeStaticPlugins();
    assert.equal(f.jobs.length, 2);
    assert.equal(f.jobs[0].cancelled, true);
    f.calls.length = 0;
    f.jobs[0].callback();
    assert.equal(f.calls.length, 0);
    f.jobs[1].callback();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].config.FIXTURE_VALUE, undefined);
});
