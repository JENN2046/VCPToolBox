const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

function createFakeRouter() {
    return {
        routes: [],
        get(routePath, handler) {
            this.routes.push({ method: 'GET', path: routePath, handler });
        },
        post(routePath, handler) {
            this.routes.push({ method: 'POST', path: routePath, handler });
        }
    };
}

const originalLoad = Module._load;
Module._load = function loadWithExpressStub(request, parent, isMain) {
    if (request === 'express') {
        return { Router: createFakeRouter };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let createAdminPluginRouter;
try {
    createAdminPluginRouter = require('../routes/admin/plugins');
} finally {
    Module._load = originalLoad;
}

function makeTempWorkspace(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-admin-command-target-'));
    t.after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

function makeSnapshot(workspaceRoot, includeExternal = false) {
    const coreRoot = path.join(workspaceRoot, 'Plugin');
    const externalRoot = path.join(workspaceRoot, 'ExternalPlugins');
    fs.mkdirSync(coreRoot, { recursive: true });
    if (includeExternal) fs.mkdirSync(externalRoot, { recursive: true });

    return {
        projectRoot: workspaceRoot,
        coreLegacyRoot: {
            rootId: 'core:legacy',
            source: 'core',
            rootPath: coreRoot,
            displayPath: '[core]/Plugin',
            allowConfigEnv: true,
            enabled: true
        },
        externalLegacyRoots: includeExternal ? [{
            rootId: 'external:0',
            source: 'external',
            rootPath: externalRoot,
            displayPath: '[external]/plugins-legacy',
            allowConfigEnv: false,
            enabled: true
        }] : [],
        diagnostics: []
    };
}

function makeManifest(pluginName = 'ManagedEcho', description = 'old description') {
    return {
        name: pluginName,
        displayName: pluginName,
        description: 'old plugin description',
        pluginType: 'synchronous',
        entryPoint: { command: 'node index.js' },
        communication: { protocol: 'stdio', timeout: 1000 },
        capabilities: {
            invocationCommands: [{
                commandIdentifier: 'echo',
                command: 'EchoCommand',
                description
            }]
        }
    };
}

function writeLegacyManifest(rootPath, folderName, manifest = makeManifest()) {
    const pluginPath = path.join(rootPath, folderName);
    fs.mkdirSync(pluginPath, { recursive: true });
    const manifestPath = path.join(pluginPath, 'plugin-manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifestPath;
}

function readCommandDescription(manifestPath) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.capabilities.invocationCommands[0].description;
}

function readManifestDescription(manifestPath) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.description;
}

function makePluginManager(snapshot, loadedPlugins = []) {
    return {
        plugins: new Map(loadedPlugins.map(manifest => [manifest.name, manifest])),
        loadCount: 0,
        getPluginRootSnapshot() {
            return snapshot;
        },
        async loadPlugins() {
            this.loadCount += 1;
        }
    };
}

function getRouteHandler(pluginManager, method, routePath) {
    const router = createAdminPluginRouter({ pluginManager, DEBUG_MODE: false });
    const route = router.routes.find(item => (
        item.method === method
        && item.path === routePath
    ));
    assert.ok(route, `${method} ${routePath} route should be registered`);
    return route.handler;
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

async function callAdminPluginRoute(pluginManager, routePath, body = {}, options = {}) {
    const handler = getRouteHandler(pluginManager, 'POST', routePath);
    const res = createResponse();

    await handler({
        params: {
            pluginName: options.pluginName || 'ManagedEcho',
            commandIdentifier: options.commandIdentifier || 'echo'
        },
        body,
        query: options.query || {}
    }, res);

    return res;
}

async function callCommandDescription(pluginManager, body = {}, options = {}) {
    return callAdminPluginRoute(
        pluginManager,
        '/plugins/:pluginName/commands/:commandIdentifier/description',
        {
            description: 'new description',
            ...body
        },
        options
    );
}

async function callPluginDescription(pluginManager, body = {}, options = {}) {
    return callAdminPluginRoute(
        pluginManager,
        '/plugins/:pluginName/description',
        {
            description: 'new description',
            ...body
        },
        options
    );
}

async function callPluginConfig(pluginManager, body = {}, options = {}) {
    return callAdminPluginRoute(
        pluginManager,
        '/plugins/:pluginName/config',
        {
            content: 'EXAMPLE=value\n',
            ...body
        },
        options
    );
}

async function callPluginToggle(pluginManager, body = {}, options = {}) {
    return callAdminPluginRoute(
        pluginManager,
        '/plugins/:pluginName/toggle',
        {
            enable: false,
            ...body
        },
        options
    );
}

function assertNoAbsolutePathLeak(payload, pathsToProtect) {
    const serialized = JSON.stringify(payload);
    for (const protectedPath of pathsToProtect) {
        assert.equal(
            serialized.includes(path.resolve(protectedPath)),
            false,
            `response should not include absolute path ${protectedPath}`
        );
    }
    assert.doesNotMatch(serialized, /[A-Za-z]:\\/);
}

test('core-only command description writes selected core manifest', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);

    const res = await callCommandDescription(pluginManager);

    assert.equal(res.statusCode, 200);
    assert.equal(readCommandDescription(coreManifest), 'new description');
    assert.equal(pluginManager.loadCount, 1);
    assert.equal(res.body.pluginRootId, 'core:legacy');
    assert.equal(res.body.pluginSource, 'core');
});

test('duplicate core and external pluginName without target criteria returns 409 and writes nothing', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);

    const res = await callCommandDescription(pluginManager);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ambiguous_admin_plugin_target');
    assert.equal(readCommandDescription(coreManifest), 'old description');
    assert.equal(readCommandDescription(externalManifest), 'old description');
    assert.equal(pluginManager.loadCount, 0);
    assert.deepEqual(
        res.body.candidates.map(candidate => candidate.pluginSource).sort(),
        ['core', 'external']
    );
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.coreLegacyRoot.rootPath, snapshot.externalLegacyRoots[0].rootPath]);
});

test('duplicate core and external pluginName blocks general description writes', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);

    const res = await callPluginDescription(pluginManager);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ambiguous_admin_plugin_target');
    assert.equal(readManifestDescription(coreManifest), 'old plugin description');
    assert.equal(readManifestDescription(externalManifest), 'old plugin description');
    assert.equal(pluginManager.loadCount, 0);
    assert.deepEqual(
        res.body.candidates.map(candidate => candidate.pluginSource).sort(),
        ['core', 'external']
    );
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.coreLegacyRoot.rootPath, snapshot.externalLegacyRoots[0].rootPath]);
});

test('duplicate core and external pluginName blocks config writes', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);
    const coreConfigPath = path.join(path.dirname(coreManifest), 'config.env');
    const externalConfigPath = path.join(path.dirname(externalManifest), 'config.env');

    const res = await callPluginConfig(pluginManager);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ambiguous_admin_plugin_target');
    assert.equal(fs.existsSync(coreConfigPath), false);
    assert.equal(fs.existsSync(externalConfigPath), false);
    assert.equal(pluginManager.loadCount, 0);
    assert.deepEqual(
        res.body.candidates.map(candidate => candidate.pluginSource).sort(),
        ['core', 'external']
    );
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.coreLegacyRoot.rootPath, snapshot.externalLegacyRoots[0].rootPath]);
});

test('core config write creates regular config.env and reloads plugins', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);
    const configPath = path.join(path.dirname(coreManifest), 'config.env');

    const res = await callPluginConfig(pluginManager, {
        content: 'EXAMPLE=value\n',
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(fs.readFileSync(configPath, 'utf8'), 'EXAMPLE=value\n');
    assert.equal(fs.lstatSync(configPath).isFile(), true);
    assert.equal(pluginManager.loadCount, 1);
    assert.equal(res.body.pluginRootId, 'core:legacy');
    assert.equal(res.body.pluginSource, 'core');
});

test('core config write rejects existing config.env symlink without writing target', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);
    const configPath = path.join(path.dirname(coreManifest), 'config.env');
    const outsideConfigPath = path.join(workspace, 'outside-config.env');
    const outsideConfigDir = path.join(workspace, 'outside-config-dir');
    const outsideMarkerPath = path.join(outsideConfigDir, 'marker.txt');
    fs.writeFileSync(outsideConfigPath, 'OUTSIDE=old\n', 'utf8');

    try {
        fs.symlinkSync(outsideConfigPath, configPath);
    } catch (error) {
        try {
            fs.mkdirSync(outsideConfigDir);
            fs.writeFileSync(outsideMarkerPath, 'OUTSIDE=old\n', 'utf8');
            fs.symlinkSync(outsideConfigDir, configPath, process.platform === 'win32' ? 'junction' : 'dir');
        } catch (fallbackError) {
            t.skip(`symlink unavailable in this environment: ${error.message}; fallback failed: ${fallbackError.message}`);
            return;
        }
    }

    const res = await callPluginConfig(pluginManager, {
        content: 'EXAMPLE=new\n',
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'config_env_symlink_unsupported');
    assert.equal(fs.readFileSync(outsideConfigPath, 'utf8'), 'OUTSIDE=old\n');
    if (fs.existsSync(outsideMarkerPath)) {
        assert.equal(fs.readFileSync(outsideMarkerPath, 'utf8'), 'OUTSIDE=old\n');
    }
    assert.equal(pluginManager.loadCount, 0);
    assertNoAbsolutePathLeak(res.body, [workspace, outsideConfigPath, outsideConfigDir, snapshot.coreLegacyRoot.rootPath]);
});

test('core config write rejects existing config.env directory', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);
    const configPath = path.join(path.dirname(coreManifest), 'config.env');
    fs.mkdirSync(configPath);

    const res = await callPluginConfig(pluginManager, {
        content: 'EXAMPLE=value\n',
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'config_env_non_regular_unsupported');
    assert.equal(fs.lstatSync(configPath).isDirectory(), true);
    assert.equal(pluginManager.loadCount, 0);
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.coreLegacyRoot.rootPath]);
});

test('duplicate core and external pluginName blocks toggle writes', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);
    const coreBlockedManifest = `${coreManifest}.block`;
    const externalBlockedManifest = `${externalManifest}.block`;

    const res = await callPluginToggle(pluginManager, { enable: false });

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ambiguous_admin_plugin_target');
    assert.equal(fs.existsSync(coreManifest), true);
    assert.equal(fs.existsSync(externalManifest), true);
    assert.equal(fs.existsSync(coreBlockedManifest), false);
    assert.equal(fs.existsSync(externalBlockedManifest), false);
    assert.equal(pluginManager.loadCount, 0);
    assert.deepEqual(
        res.body.candidates.map(candidate => candidate.pluginSource).sort(),
        ['core', 'external']
    );
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.coreLegacyRoot.rootPath, snapshot.externalLegacyRoots[0].rootPath]);
});

test('explicit core target writes core manifest when duplicate external exists', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const coreManifest = writeLegacyManifest(snapshot.coreLegacyRoot.rootPath, 'ManagedEcho');
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);

    const res = await callCommandDescription(pluginManager, {
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    });

    assert.equal(res.statusCode, 200);
    assert.equal(readCommandDescription(coreManifest), 'new description');
    assert.equal(readCommandDescription(externalManifest), 'old description');
    assert.equal(pluginManager.loadCount, 1);
});

test('explicit external target returns deferred 403 and writes nothing', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace, true);
    const externalManifest = writeLegacyManifest(snapshot.externalLegacyRoots[0].rootPath, 'ManagedEcho');
    const pluginManager = makePluginManager(snapshot);

    const res = await callCommandDescription(pluginManager, {
        pluginRootId: 'external:0',
        pluginSource: 'external'
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'external_command_description_deferred');
    assert.equal(res.body.status, 'deferred');
    assert.equal(readCommandDescription(externalManifest), 'old description');
    assert.equal(pluginManager.loadCount, 0);
    assertNoAbsolutePathLeak(res.body, [workspace, snapshot.externalLegacyRoots[0].rootPath]);
});

test('loaded target outside managed root is rejected through managed assertion', async (t) => {
    const workspace = makeTempWorkspace(t);
    const snapshot = makeSnapshot(workspace);
    const outsidePluginPath = path.join(workspace, 'OutsideRoot', 'ManagedEcho');
    fs.mkdirSync(outsidePluginPath, { recursive: true });
    const pluginManager = makePluginManager(snapshot, [{
        ...makeManifest('ManagedEcho'),
        basePath: outsidePluginPath,
        pluginRoot: snapshot.coreLegacyRoot.rootPath,
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    }]);

    const res = await callCommandDescription(pluginManager, {
        pluginRootId: 'core:legacy',
        pluginSource: 'core'
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'managed_manifest_outside_root');
    assert.equal(pluginManager.loadCount, 0);
    assertNoAbsolutePathLeak(res.body, [workspace, outsidePluginPath, snapshot.coreLegacyRoot.rootPath]);
});
