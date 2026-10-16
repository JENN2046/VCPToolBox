'use strict';
const { test, after } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const manager = require('../Plugin');
const { readExternalPluginHostConfig } = require('../modules/externalPluginHostConfig');
const { createPluginRootResolver } = require('../modules/pluginRootResolver');
after(() => manager.toolApprovalManager.shutdown());
function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'host-plugin-binding-'));
    const source = path.join(root, 'external'); fs.mkdirSync(source);
    const file = path.join(root, 'host.json');
    const manifest = { name: 'JennShootingOperations', pluginSource: 'external', pluginRoot: source,
        basePath: path.join(source, 'JennShootingOperations'), configSchema: {
            JSO_LOCAL_AGENT_TOKEN: 'string', JSO_LOCAL_AGENT_ENDPOINT: 'string', JSO_MAX_SHIFT_MINUTES: 'integer', ENABLED: 'boolean'
        } };
    const original = process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE, globalToken = process.env.JSO_LOCAL_AGENT_TOKEN;
    const previous = manager.plugins;
    manager.plugins = new Map([[manifest.name, manifest]]);
    process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE = file;
    process.env.JSO_LOCAL_AGENT_TOKEN = 'GLOBAL_MUST_NOT_INHERIT';
    t.after(() => {
        manager.plugins = previous;
        if (original === undefined) delete process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE; else process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE = original;
        if (globalToken === undefined) delete process.env.JSO_LOCAL_AGENT_TOKEN; else process.env.JSO_LOCAL_AGENT_TOKEN = globalToken;
        fs.rmSync(root, { recursive: true, force: true });
    });
    const write = (config, overrides = {}) => fs.writeFileSync(file, JSON.stringify({ bindings: [{ pluginName: manifest.name, sourceDirectory: source, config, ...overrides }] }));
    return { root, source, file, manifest, write };
}
test('host-scoped declared values only; no global fallback, no external config.env', t => {
    const f = fixture(t); f.write({ JSO_LOCAL_AGENT_TOKEN: 'SYNTHETIC_PRIVATE', JSO_MAX_SHIFT_MINUTES: 1, ENABLED: true });
    const config = manager._getPluginConfig(f.manifest);
    assert.equal(config.JSO_LOCAL_AGENT_TOKEN, 'SYNTHETIC_PRIVATE');
    assert.equal(config.JSO_LOCAL_AGENT_ENDPOINT, undefined);
    assert.equal(config.JSO_MAX_SHIFT_MINUTES, 1);
    assert.equal(config.ENABLED, true);
    const env = manager._buildPluginProcessEnv(f.manifest, config, {});
    assert.equal(env.JSO_LOCAL_AGENT_TOKEN, undefined);
    assert.equal(env.API_Key, undefined);
    const resolver = createPluginRootResolver({ projectRoot: f.root, env: { VCP_PLUGIN_DIRS: f.source, VCP_PLUGIN_ALLOWED_ROOTS: f.source } });
    assert.equal(resolver.getExternalLegacyRootsSync().roots[0].allowConfigEnv, false);
});
test('absent binding, other name, wrong source and unregistered manifest do not inherit', t => {
    const f = fixture(t);
    delete process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE;
    assert.equal(manager._getPluginConfig(f.manifest).JSO_LOCAL_AGENT_TOKEN, undefined);
    process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE = f.file;
    f.write({ JSO_LOCAL_AGENT_TOKEN: 'SYNTHETIC_PRIVATE' }, { pluginName: 'OtherPlugin' });
    assert.equal(manager._getPluginConfig(f.manifest).JSO_LOCAL_AGENT_TOKEN, undefined);
    f.write({ JSO_LOCAL_AGENT_TOKEN: 'SYNTHETIC_PRIVATE' }, { sourceDirectory: f.root });
    assert.equal(manager._getPluginConfig(f.manifest).JSO_LOCAL_AGENT_TOKEN, undefined);
    f.write({ JSO_LOCAL_AGENT_TOKEN: 'SYNTHETIC_PRIVATE' });
    assert.equal(manager._getPluginConfig({ ...f.manifest }).JSO_LOCAL_AGENT_TOKEN, undefined);
    assert.equal(manager._getPluginConfig({ ...f.manifest, name: 'OtherPlugin' }).JSO_LOCAL_AGENT_TOKEN, undefined);
});
test('invalid input fails closed with fixed non-secret error and no logs', t => {
    const f = fixture(t), logs = []; const warn = console.warn;
    console.warn = (...args) => logs.push(args.join(' ')); t.after(() => { console.warn = warn; });
    for (const config of [{ API_Key: 'SYNTHETIC_PRIVATE' }, { JSO_MAX_SHIFT_MINUTES: 'SYNTHETIC_PRIVATE' }, { ENABLED: 'true' }, JSON.parse('{"__proto__":"SYNTHETIC_PRIVATE"}')]) {
        f.write(config);
        assert.throws(() => manager._getPluginConfig(f.manifest), { message: 'EXTERNAL_PLUGIN_HOST_CONFIG_INVALID' });
    }
    fs.writeFileSync(f.file, 'SYNTHETIC_PRIVATE invalid JSON');
    assert.throws(() => manager._getPluginConfig(f.manifest), { message: 'EXTERNAL_PLUGIN_HOST_CONFIG_INVALID' });
    assert.deepEqual(logs, []);
});
test('duplicate binding is rejected, core precedence unchanged even with invalid host file', t => {
    const f = fixture(t); f.write({ JSO_LOCAL_AGENT_TOKEN: 'SYNTHETIC_PRIVATE' });
    const data = JSON.parse(fs.readFileSync(f.file)); data.bindings.push(data.bindings[0]); fs.writeFileSync(f.file, JSON.stringify(data));
    assert.throws(() => readExternalPluginHostConfig(f.file, f.manifest), /EXTERNAL_PLUGIN_HOST_CONFIG_INVALID/);
    const core = { ...f.manifest, pluginSource: 'core', pluginSpecificEnvConfig: { JSO_LOCAL_AGENT_TOKEN: 'CORE_LOCAL' } };
    assert.equal(manager._getPluginConfig(core).JSO_LOCAL_AGENT_TOKEN, 'CORE_LOCAL');
    core.pluginSpecificEnvConfig = {};
    assert.equal(manager._getPluginConfig(core).JSO_LOCAL_AGENT_TOKEN, 'GLOBAL_MUST_NOT_INHERIT');
});
