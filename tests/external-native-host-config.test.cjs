'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executeNativeRequest } = require('../modules/nativeConversationTransport');
const jso = process.env.JSO_SOURCE, ext = process.env.JSO_EXTENSIONS_ROOT;
test('registered external JSO: real PluginManager, native broker, stdio and SQLite owner session',
    { skip: !jso || !ext, timeout: 30000 }, async t => {
    const manager = require('../Plugin');
    t.after(() => manager.toolApprovalManager.shutdown());
    const importJso = p => import(pathToFileURL(path.join(jso, p)));
    const { maintenanceFixture } = await importJso('tests/support/empty-db-maintenance-fixture.mjs');
    const { createOperationsServer } = await importJso('src/server.mjs');
    const { conversationFactoryFromEnv } = await importJso('src/server-conversation.mjs');
    const { createBusinessRuntimeOptionsFromEnv } = await importJso('src/business-runtime-auth-v1.mjs');
    const { createKioskServiceBindingV1 } = await importJso('src/kiosk-service-context-v1.mjs');
    const fixture = maintenanceFixture(undefined, { schemaVersion: 12 });
    t.after(() => fixture.close()); assert.equal(fixture.execute().ok, true);
    const owner = 'synthetic-owner-'.padEnd(40, 'x'), agent = 'synthetic-agent-'.padEnd(40, 'x');
    const resource = 'JSO-BIZ-RESOURCE-001';
    const env = { JSO_BUSINESS_RUNTIME: 'enabled',
        JSO_BUSINESS_IDENTITIES_JSON: JSON.stringify([{ token: owner, subjectId: 'synthetic-owner', role: 'administrator', resourceIds: [resource] }]),
        JSO_AGENT_IDENTITIES_JSON: JSON.stringify([{ token: agent, subjectId: 'synthetic-agent', mode: 'executor', resourceIds: [resource] }]) };
    const app = createOperationsServer({ databasePath: path.join(fixture.root, 'synthetic.sqlite'), uploadRoot: path.join(fixture.root, 'uploads'),
        orphanCleanupMode: 'disabled', cleanupIntervalMs: 0,
        kioskServiceBinding: createKioskServiceBindingV1({ context: 'PROD11_PRODUCTION' }),
        ...createBusinessRuntimeOptionsFromEnv(env), conversationBoundaryFactory: conversationFactoryFromEnv(env) });
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(r => app.server.close(r)));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jso-host-config-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const source = path.join(ext, 'Plugin'), basePath = path.join(source, 'JennShootingOperations');
    const manifest = { ...JSON.parse(fs.readFileSync(path.join(basePath, 'plugin-manifest.local-agent.json'))),
        basePath, pluginSource: 'external', pluginRoot: source, pluginRootId: 'external:fixture', pluginRootDisplayPath: '[external]/Plugin' };
    const previous = { plugins: manager.plugins, env: { ...process.env }, spawn: manager._spawnPluginProcess, project: manager.projectBasePath };
    t.after(() => { manager.plugins = previous.plugins; manager.projectBasePath = previous.project; manager._spawnPluginProcess = previous.spawn;
        for (const key of ['PATH', 'VCP_EXTERNAL_PLUGIN_ALLOWLIST', 'VCP_EXTERNAL_PLUGIN_CONFIG_FILE']) {
            if (previous.env[key] === undefined) delete process.env[key]; else process.env[key] = previous.env[key];
        }
    });
    manager.plugins = new Map(); manager.setProjectBasePath(path.resolve(__dirname, '..'));
    process.env.PATH = path.dirname(process.execPath)+path.delimiter+process.env.PATH;
    process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST = manifest.name+'@'+source;
    assert.equal(await manager._registerLocalPlugin(manifest, new Map(), []), true);
    const file = path.join(root, 'host.json'); process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE = file;
    const config = { JSO_LOCAL_AGENT_ENDPOINT: `http://127.0.0.1:${app.server.address().port}/api/v2/agent/tools`,
        JSO_LOCAL_AGENT_TOKEN: agent, JSO_RESOURCE_IDS: resource, JSO_CALL_POLICY: 'native-direct-and-confirm', JSO_MAX_SHIFT_MINUTES: 1,
        JSO_JOURNAL_PATH: path.join(root, 'journal'), JSO_ASSISTANT_SUBJECT_ID: 'synthetic-agent', JSO_DEFAULT_RESOURCE_ID: resource };
    const write = sourceDirectory => fs.writeFileSync(file, JSON.stringify({ bindings: [{ pluginName: manifest.name, sourceDirectory, config }] }), { mode: 0o600 });
    let spawns = 0;
    manager._spawnPluginProcess = function(command, args, options) {
        spawns++;
        assert.equal(options.env.JSO_LOCAL_AGENT_TOKEN, undefined);
        assert.ok(!JSON.stringify(options.env).includes(owner));
        assert.ok(!JSON.stringify(options.env).includes(agent));
        assert.ok(options.env.VCP_EXECUTION_CONTEXT);
        return previous.spawn.call(this, command, args, options);
    };
    const logs = [], originalConsole = {}, debug = manager.debugMode; manager.debugMode = true;
    for (const method of ['warn','log','error']) { originalConsole[method] = console[method]; console[method] = (...args) => logs.push(JSON.stringify(args)); }
    t.after(() => { Object.assign(console, originalConsole); manager.debugMode = debug; });
    write(root); // Existing but incorrect source, never inherit config.
    assert.equal((await executeNativeRequest(manager, manifest.name, 'Bearer '+owner, { action: 'status', payload: {} })).ok, false);
    assert.equal(spawns, 0);
    write(source);
    const result = await executeNativeRequest(manager, manifest.name, 'Bearer '+owner, { action: 'status', payload: {} });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(spawns, 1);
    assert.equal(app.store.db.prepare('select count(*) n from schedule_reschedule_operations').get().n, 0);
    fs.writeFileSync(file, JSON.stringify({ bindings: [] }));
    assert.equal((await executeNativeRequest(manager, manifest.name, 'Bearer '+owner, { action: 'status', payload: {} })).ok, false);
    assert.equal(spawns, 1);
    assert.ok(logs.every(line => !line.includes(owner) && !line.includes(agent)));
    t.diagnostic(JSON.stringify({ actualPluginManager: true, actualNativeBroker: true, actualStdioJsoPlugin: true, actualJsoSqlite: true,
        syntheticIdentities: true, statusPassed: true, childReceivedCredentials: false, writes: 0, model: false, electron: false, targetWss: false }));
});
