'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const WebSocket = require('ws');

const bridge = require('../Plugin/VCPToolBridge/index.js');
const webSocketServer = require('../WebSocketServer.js');
const {
    DIRECT_REFRESH_METADATA_FIELDS,
    NATIVE_MANIFEST_UNAVAILABLE,
    NativeManifestAuthorityError,
    createRuntimePluginEntry,
    getCurrentNativeManifest,
    hasDirectRuntimeContractChange
} = require('../modules/nativeManifestAuthority');

const NATIVE_SURFACE = 'native-v1';
let loadedPluginManager = null;

function getPluginManager() {
    if (!loadedPluginManager) loadedPluginManager = require('../Plugin.js');
    return loadedPluginManager;
}

after(async () => {
    if (loadedPluginManager?.toolApprovalManager?.watcher) {
        await loadedPluginManager.toolApprovalManager.watcher.close();
    }
});

function makeNativeManifest(overrides = {}) {
    return {
        name: 'FutureTool',
        displayName: 'Future Tool',
        description: 'Native description',
        version: '1.0.0',
        author: 'VCP',
        pluginType: 'synchronous',
        entryPoint: { script: 'index.js' },
        communication: { protocol: 'stdio' },
        parameterSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                options: {
                    type: 'object',
                    properties: {
                        mode: { enum: ['one', 'two'] }
                    }
                }
            }
        },
        configSchema: {
            endpoint: { type: 'string' }
        },
        configSchemaDescriptions: {
            endpoint: 'Service endpoint'
        },
        defaults: {
            endpoint: 'https://example.invalid'
        },
        capabilities: {
            invocationCommands: [
                { commandIdentifier: 'future', description: 'Run future tool' }
            ],
            arbitraryCapability: { enabled: true }
        },
        'x-future-extension': {
            nested: {
                values: [1, true, null, 'hello']
            }
        },
        ...overrides
    };
}

function withJsonMetaKeys(manifest) {
    const metaKeyValues = JSON.parse(`{
        "__proto__":{"nested":[1,true,null,"proto-value"]},
        "constructor":{"nested":{"x":"constructor-value"}},
        "prototype":["prototype-value",7],
        "toJSON":{"kind":"plain-data","nested":[false,null]}
    }`);
    for (const [key, value] of Object.entries(metaKeyValues)) {
        Object.defineProperty(manifest, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    }
    return manifest;
}

function makeWireCapture() {
    const messages = [];
    return {
        messages,
        wss: {
            sendMessageToClient(serverId, message, options) {
                messages.push({
                    serverId,
                    message: JSON.parse(JSON.stringify(message)),
                    options
                });
            }
        }
    };
}

async function requestManifests(pluginManager, data = {}) {
    const capture = makeWireCapture();
    bridge.wss = capture.wss;
    bridge.config = {};
    bridge.debugMode = false;

    await bridge.handleGetManifests('dist-test-client', {
        type: 'get_vcp_manifests',
        data: {
            requestId: 'manifest-request',
            ...data
        }
    }, pluginManager);

    assert.equal(capture.messages.length, 1);
    assert.equal(capture.messages[0].serverId, 'test-client');
    return capture.messages[0].message;
}

test('authority capsule preserves complete native JSON and excludes runtime augmentation', () => {
    const nativeManifest = makeNativeManifest();
    const runtimeEntry = createRuntimePluginEntry(nativeManifest);

    runtimeEntry.basePath = '/runtime/plugin/path';
    runtimeEntry.pluginSpecificEnvConfig = { API_KEY: 'runtime-only' };
    runtimeEntry.loadedModule = () => 'runtime-only';
    runtimeEntry.executionState = { running: true };

    const authority = getCurrentNativeManifest(runtimeEntry);
    assert.deepEqual(authority, nativeManifest);
    assert.equal(Object.hasOwn(authority, 'basePath'), false);
    assert.equal(Object.hasOwn(authority, 'pluginSpecificEnvConfig'), false);
    assert.equal(Object.hasOwn(authority, 'loadedModule'), false);
    assert.equal(Object.hasOwn(authority, 'executionState'), false);
});

test('authority clones are detached from callers and runtime entries', () => {
    const runtimeEntry = createRuntimePluginEntry(makeNativeManifest());
    const first = getCurrentNativeManifest(runtimeEntry);
    first.parameterSchema.properties.query.type = 'number';
    first['x-future-extension'].nested.values.push('mutated');

    const second = getCurrentNativeManifest(runtimeEntry);
    assert.equal(second.parameterSchema.properties.query.type, 'string');
    assert.deepEqual(second['x-future-extension'].nested.values, [1, true, null, 'hello']);
    assert.equal(runtimeEntry.parameterSchema.properties.query.type, 'string');
});

test('authority clone preserves JSON meta keys without invoking executable toJSON', () => {
    const manifest = JSON.parse(`{
        "name":"MetaTool",
        "pluginType":"synchronous",
        "entryPoint":{"script":"index.js"},
        "communication":{"protocol":"stdio"},
        "capabilities":{"invocationCommands":[{"commandIdentifier":"meta"}]},
        "__proto__":{"polluted":true},
        "constructor":{"kind":"data"},
        "prototype":{"kind":"data"},
        "toJSON":{"kind":"data"}
    }`);
    const runtimeEntry = createRuntimePluginEntry(manifest);
    const authority = getCurrentNativeManifest(runtimeEntry);

    assert.deepEqual(authority, manifest);
    assert.equal(Object.hasOwn(authority, '__proto__'), true);
    assert.equal({}.polluted, undefined);

    let toJSONCalled = false;
    const executable = makeNativeManifest({
        toJSON() {
            toJSONCalled = true;
            return {};
        }
    });
    assert.throws(
        () => createRuntimePluginEntry(executable),
        error => error instanceof NativeManifestAuthorityError &&
            error.code === NATIVE_MANIFEST_UNAVAILABLE
    );
    assert.equal(toJSONCalled, false);
});

test('native-v1 exports complete authority and derives compatibility fields from it', async () => {
    const nativeManifest = makeNativeManifest({ negativeZero: -0 });
    const runtimeEntry = createRuntimePluginEntry(nativeManifest);

    runtimeEntry.displayName = 'Divergent runtime display';
    runtimeEntry.description = 'Divergent runtime description';
    runtimeEntry.version = '99.0.0';
    runtimeEntry.capabilities.invocationCommands = [
        { commandIdentifier: 'runtime-only', description: 'Runtime drift' }
    ];
    runtimeEntry.basePath = '/runtime/plugin/path';
    runtimeEntry.pluginSpecificEnvConfig = { API_KEY: 'runtime-only' };

    const pluginManager = {
        plugins: new Map([[runtimeEntry.name, runtimeEntry]]),
        getCurrentNativeManifest
    };
    const response = await requestManifests(pluginManager, { manifestSurface: NATIVE_SURFACE });
    const plugin = response.data.plugins[0];

    assert.equal(response.type, 'vcp_manifest_response');
    assert.equal(response.data.manifestSurface, NATIVE_SURFACE);
    assert.equal(plugin.displayName, nativeManifest.displayName);
    assert.equal(plugin.description, nativeManifest.description);
    assert.equal(plugin.version, nativeManifest.version);
    assert.deepEqual(plugin.capabilities, {
        invocationCommands: nativeManifest.capabilities.invocationCommands
    });
    assert.deepEqual(plugin.nativeManifest, JSON.parse(JSON.stringify(nativeManifest)));
    assert.equal(Object.is(plugin.nativeManifest.negativeZero, -0), false);
    assert.equal(Object.hasOwn(plugin.nativeManifest, 'basePath'), false);
    assert.equal(Object.hasOwn(plugin.nativeManifest, 'pluginSpecificEnvConfig'), false);
});

test('legacy manifest requests retain the existing fixed response shape', async () => {
    const runtimeEntry = createRuntimePluginEntry(makeNativeManifest());
    const pluginManager = {
        plugins: new Map([[runtimeEntry.name, runtimeEntry]]),
        getCurrentNativeManifest
    };
    const response = await requestManifests(pluginManager);

    assert.deepEqual(response, {
        type: 'vcp_manifest_response',
        data: {
            requestId: 'manifest-request',
            plugins: [{
                name: 'FutureTool',
                displayName: 'Future Tool',
                description: 'Native description',
                version: '1.0.0',
                capabilities: {
                    invocationCommands: [
                        { commandIdentifier: 'future', description: 'Run future tool' }
                    ]
                }
            }],
            vcpVersion: '1.0.0'
        }
    });
    assert.equal(Object.hasOwn(response.data, 'manifestSurface'), false);
    assert.equal(Object.hasOwn(response.data.plugins[0], 'nativeManifest'), false);
});

test('native-v1 fails the whole request when any eligible entry lacks authority', async () => {
    const validEntry = createRuntimePluginEntry(makeNativeManifest());
    const missingEntry = makeNativeManifest({
        name: 'MissingAuthorityTool',
        displayName: 'Missing Authority Tool'
    });
    const pluginManager = {
        plugins: new Map([
            [validEntry.name, validEntry],
            [missingEntry.name, missingEntry]
        ]),
        getCurrentNativeManifest
    };
    const response = await requestManifests(pluginManager, { manifestSurface: NATIVE_SURFACE });

    assert.deepEqual(response, {
        type: 'vcp_manifest_response',
        data: {
            requestId: 'manifest-request',
            manifestSurface: NATIVE_SURFACE,
            status: 'error',
            error: NATIVE_MANIFEST_UNAVAILABLE
        }
    });
    assert.equal(Object.hasOwn(response.data, 'plugins'), false);
});

test('native-v1 preserves the existing Bridge export cohort policy', async () => {
    const visible = createRuntimePluginEntry(makeNativeManifest({ name: 'VisibleTool' }));
    visible.displayName = 'Private runtime-only drift';
    visible.capabilities.invocationCommands = [];

    const excludedByName = makeNativeManifest({ name: 'ExcludedTool' });
    const excludedByKeyword = createRuntimePluginEntry(makeNativeManifest({
        name: 'KeywordTool',
        displayName: 'Private keyword tool'
    }));
    const distributed = createRuntimePluginEntry(makeNativeManifest({ name: 'DistributedTool' }));
    distributed.isDistributed = true;

    const capture = makeWireCapture();
    bridge.wss = capture.wss;
    bridge.config = {
        Excluded_Tools: 'ExcludedTool',
        Excluded_Display_Keywords: 'Private'
    };
    bridge.debugMode = false;
    await bridge.handleGetManifests('dist-test-client', {
        data: {
            requestId: 'cohort-request',
            manifestSurface: NATIVE_SURFACE
        }
    }, {
        plugins: new Map([
            [visible.name, visible],
            [excludedByName.name, excludedByName],
            [excludedByKeyword.name, excludedByKeyword],
            [distributed.name, distributed]
        ]),
        getCurrentNativeManifest
    });

    assert.deepEqual(
        capture.messages[0].message.data.plugins.map(plugin => plugin.name),
        ['VisibleTool']
    );
    assert.deepEqual(
        capture.messages[0].message.data.plugins[0].capabilities.invocationCommands,
        getCurrentNativeManifest(visible).capabilities.invocationCommands
    );
});

test('native-v1 observes the current registry without becoming an execution snapshot', async () => {
    const first = createRuntimePluginEntry(makeNativeManifest({ name: 'FirstTool' }));
    const second = createRuntimePluginEntry(makeNativeManifest({ name: 'SecondTool' }));
    const plugins = new Map([[first.name, first]]);
    const pluginManager = { plugins, getCurrentNativeManifest };

    const firstResponse = await requestManifests(pluginManager, { manifestSurface: NATIVE_SURFACE });
    plugins.clear();
    plugins.set(second.name, second);
    const secondResponse = await requestManifests(pluginManager, { manifestSurface: NATIVE_SURFACE });

    assert.deepEqual(firstResponse.data.plugins.map(plugin => plugin.name), ['FirstTool']);
    assert.deepEqual(secondResponse.data.plugins.map(plugin => plugin.name), ['SecondTool']);

    const calls = [];
    const executionManager = {
        async processToolCall(toolName, toolArgs) {
            calls.push({ toolName, toolArgs });
            return { ok: true };
        }
    };
    const capture = makeWireCapture();
    bridge.wss = capture.wss;
    bridge.debugMode = false;
    await bridge.handleExecuteTool('dist-test-client', {
        data: {
            requestId: 'execution-request',
            toolName: 'SecondTool',
            toolArgs: { query: 'current' }
        }
    }, executionManager);
    assert.deepEqual(calls, [{ toolName: 'SecondTool', toolArgs: { query: 'current' } }]);
});

test('PluginManager production loader captures complete native authority before runtime augmentation', async t => {
    const pluginManager = getPluginManager();
    const originalState = {
        plugins: pluginManager.plugins,
        messagePreprocessors: pluginManager.messagePreprocessors,
        serviceModules: pluginManager.serviceModules,
        preprocessorOrder: pluginManager.preprocessorOrder,
        scheduledJobs: pluginManager.scheduledJobs,
        individualPluginDescriptions: pluginManager.individualPluginDescriptions,
        staticPluginsInitialized: pluginManager.staticPluginsInitialized,
        vectorDBManager: pluginManager.vectorDBManager
    };
    const pluginRoot = path.join(__dirname, '..', 'Plugin');
    const fixtureRoot = path.join(pluginRoot, 'FMSR1InitialLoaderFixture');
    const manifestPath = path.join(fixtureRoot, 'plugin-manifest.json');
    const configPath = path.join(fixtureRoot, 'config.env');
    const orderPath = path.join(__dirname, '..', 'preprocessor_order.json');
    const initialNative = withJsonMetaKeys(makeNativeManifest({
        description: 'Initial production-loader description',
        'x-future-extension': { generation: 1 }
    }));
    const originalReadFile = fs.readFile.bind(fs);
    const originalReaddir = fs.readdir.bind(fs);

    t.after(async () => {
        Object.assign(pluginManager, originalState);
    });

    t.mock.method(pluginManager, '_validateLocalPluginManifestsBeforeReload', async () => {});
    t.mock.method(fs, 'readdir', async (target, options) => {
        if (path.resolve(String(target)) === path.resolve(pluginRoot)) {
            return [{ name: 'FMSR1InitialLoaderFixture', isDirectory: () => true }];
        }
        return originalReaddir(target, options);
    });
    t.mock.method(fs, 'readFile', async (target, encoding) => {
        const resolved = path.resolve(String(target));
        if (resolved === path.resolve(manifestPath)) return JSON.stringify(initialNative);
        if (resolved === path.resolve(orderPath)) return '[]';
        if (resolved === path.resolve(configPath)) {
            const error = new Error('Synthetic config is absent.');
            error.code = 'ENOENT';
            throw error;
        }
        return originalReadFile(target, encoding);
    });

    pluginManager.plugins = new Map();
    pluginManager.messagePreprocessors = new Map();
    pluginManager.serviceModules = new Map();
    pluginManager.preprocessorOrder = [];
    pluginManager.scheduledJobs = new Map();
    pluginManager.individualPluginDescriptions = new Map();
    pluginManager.staticPluginsInitialized = false;
    pluginManager.vectorDBManager = {};

    await pluginManager._loadPluginsOnce();

    const initialEntry = pluginManager.plugins.get(initialNative.name);
    const initialAuthority = pluginManager.getCurrentNativeManifest(initialEntry);
    assert.ok(initialEntry);
    assert.deepEqual(initialAuthority, JSON.parse(JSON.stringify(initialNative)));
    assert.equal(initialEntry.basePath, fixtureRoot);
    assert.deepEqual(initialEntry.pluginSpecificEnvConfig, {});
    assert.equal(Object.hasOwn(initialAuthority, 'basePath'), false);
    assert.equal(Object.hasOwn(initialAuthority, 'pluginSpecificEnvConfig'), false);

    const fakeHttpServer = new EventEmitter();
    const wirePayloads = [];
    const previousBridgeState = {
        wss: bridge.wss,
        config: bridge.config,
        debugMode: bridge.debugMode
    };
    const fakeWs = {
        clientId: 'meta-key-wire-client',
        readyState: WebSocket.OPEN,
        send(payload) {
            wirePayloads.push(payload);
        }
    };
    webSocketServer.initialize(fakeHttpServer, {
        debugMode: false,
        heartbeatEnabled: false,
        vcpKey: 'synthetic-test-key'
    });
    webSocketServer.__testing.distributedServers.set('dist-meta-key-wire-client', { ws: fakeWs });
    bridge.wss = webSocketServer;
    bridge.config = {};
    bridge.debugMode = false;

    t.after(async () => {
        webSocketServer.__testing.distributedServers.delete('dist-meta-key-wire-client');
        Object.assign(bridge, previousBridgeState);
        await webSocketServer.shutdown();
    });

    await bridge.handleGetManifests('dist-meta-key-wire-client', {
        type: 'get_vcp_manifests',
        data: {
            requestId: 'meta-key-wire-request',
            manifestSurface: NATIVE_SURFACE
        }
    }, pluginManager);

    assert.equal(wirePayloads.length, 1);
    const response = JSON.parse(wirePayloads[0]);
    const wireManifest = response.data.plugins[0].nativeManifest;
    const expectedWireManifest = JSON.parse(JSON.stringify(initialNative));
    assert.deepEqual(wireManifest, expectedWireManifest);
    for (const key of ['__proto__', 'constructor', 'prototype', 'toJSON']) {
        assert.equal(Object.hasOwn(wireManifest, key), true);
        assert.deepEqual(wireManifest[key], expectedWireManifest[key]);
    }
    assert.equal(Object.getPrototypeOf(wireManifest), Object.prototype);
    assert.equal({}.polluted, undefined);
    assert.equal([].polluted, undefined);
});

test('PluginManager metadata-only refresh replaces authority with the complete fresh manifest', async t => {
    const pluginManager = getPluginManager();
    const originalPlugins = pluginManager.plugins;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-native-metadata-'));
    t.after(async () => {
        pluginManager.plugins = originalPlugins;
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const initialNative = makeNativeManifest({
        description: 'Initial description',
        'x-future-extension': { generation: 1 }
    });
    const initialEntry = pluginManager._createRuntimePluginEntryFromNativeManifest(initialNative);
    initialEntry.basePath = tempDir;
    initialEntry.pluginSpecificEnvConfig = { API_KEY: 'runtime-only' };
    pluginManager.plugins = new Map([[initialEntry.name, initialEntry]]);

    const freshNative = JSON.parse(JSON.stringify(initialNative));
    freshNative.displayName = 'Fresh display';
    freshNative.description = 'Fresh complete description';
    freshNative.version = '2.0.0';
    freshNative.author = 'Fresh author';
    freshNative.capabilities.invocationCommands = [
        { commandIdentifier: 'fresh-command', description: 'Fresh command' }
    ];

    const manifestPath = path.join(tempDir, 'plugin-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(freshNative), 'utf8');

    const result = await pluginManager._refreshPluginManifestMetadata(manifestPath);
    const refreshedEntry = pluginManager.plugins.get(freshNative.name);
    const refreshedAuthority = pluginManager.getCurrentNativeManifest(refreshedEntry);

    assert.deepEqual(result, {
        refreshed: true,
        pluginName: 'FutureTool',
        restartRequired: false
    });
    assert.deepEqual(refreshedAuthority, freshNative);
    assert.equal(Object.hasOwn(refreshedAuthority, 'basePath'), false);
    assert.equal(Object.hasOwn(refreshedAuthority, 'pluginSpecificEnvConfig'), false);
    assert.equal(refreshedEntry.basePath, tempDir);
    assert.deepEqual(refreshedEntry.pluginSpecificEnvConfig, { API_KEY: 'runtime-only' });
});

test('conservative semantic diff ignores only exact direct-refresh metadata paths', () => {
    const oldNative = makeNativeManifest({
        communication: { protocol: 'direct' },
        'x-future-extension': { mode: 'A' }
    });
    const currentEntry = createRuntimePluginEntry(oldNative);
    const metadataOnly = JSON.parse(JSON.stringify(oldNative));
    metadataOnly.displayName = 'Fresh display';
    metadataOnly.description = 'Fresh description';
    metadataOnly.version = '2.0.0';
    metadataOnly.author = 'Fresh author';
    metadataOnly.capabilities.invocationCommands = [
        { commandIdentifier: 'fresh-command' }
    ];
    assert.equal(hasDirectRuntimeContractChange(currentEntry, metadataOnly), false);

    const variants = [];
    const unknownChanged = JSON.parse(JSON.stringify(oldNative));
    unknownChanged['x-future-extension'].mode = 'B';
    variants.push(unknownChanged);

    const unknownAdded = JSON.parse(JSON.stringify(oldNative));
    unknownAdded['x-added-extension'] = { enabled: true };
    variants.push(unknownAdded);

    const unknownDeleted = JSON.parse(JSON.stringify(oldNative));
    delete unknownDeleted['x-future-extension'];
    variants.push(unknownDeleted);

    const parameterChanged = JSON.parse(JSON.stringify(oldNative));
    parameterChanged.parameterSchema.properties.query.type = 'number';
    variants.push(parameterChanged);

    const configChanged = JSON.parse(JSON.stringify(oldNative));
    configChanged.configSchema.endpoint.type = 'number';
    variants.push(configChanged);

    const futureCapabilityChanged = JSON.parse(JSON.stringify(oldNative));
    futureCapabilityChanged.capabilities.arbitraryCapability.enabled = false;
    variants.push(futureCapabilityChanged);

    for (const freshManifest of variants) {
        assert.equal(hasDirectRuntimeContractChange(currentEntry, freshManifest), true);
    }
});

test('FMS-R1-UNKNOWN-ONLY classifies an opaque-only direct change as restart-required', async t => {
    const pluginManager = getPluginManager();
    const originalPlugins = pluginManager.plugins;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-native-unknown-only-'));
    t.after(async () => {
        pluginManager.plugins = originalPlugins;
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const oldNative = makeNativeManifest({
        communication: { protocol: 'direct' },
        'x-future-extension': { mode: 'A' }
    });
    const currentEntry = pluginManager._createRuntimePluginEntryFromNativeManifest(oldNative);
    currentEntry.basePath = tempDir;
    currentEntry.pluginSpecificEnvConfig = { API_KEY: 'runtime-only' };
    pluginManager.plugins = new Map([[currentEntry.name, currentEntry]]);

    const freshNative = JSON.parse(JSON.stringify(oldNative));
    freshNative['x-future-extension'].mode = 'B';
    const manifestPath = path.join(tempDir, 'plugin-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(freshNative), 'utf8');

    const result = await pluginManager._refreshPluginManifestMetadata(manifestPath);
    const refreshedEntry = pluginManager.plugins.get(freshNative.name);
    const authority = pluginManager.getCurrentNativeManifest(refreshedEntry);

    assert.equal(result.restartRequired, true);
    assert.deepEqual(authority['x-future-extension'], oldNative['x-future-extension']);
});

test('PluginManager direct runtime-change refresh exposes hybrid effective semantics', async t => {
    const pluginManager = getPluginManager();
    const originalPlugins = pluginManager.plugins;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-native-hybrid-'));
    t.after(async () => {
        pluginManager.plugins = originalPlugins;
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const oldNative = makeNativeManifest({
        displayName: 'Old display',
        description: 'Old description',
        version: '1.0.0',
        author: 'Old author',
        communication: { protocol: 'direct' },
        entryPoint: { script: 'resident-runtime.js' },
        parameterSchema: { contractVersion: 'A' },
        configSchema: { mode: { const: 'A' } },
        'x-future-extension': { effectiveRuntimeContract: 'A' }
    });
    const currentEntry = pluginManager._createRuntimePluginEntryFromNativeManifest(oldNative);
    currentEntry.basePath = tempDir;
    currentEntry.pluginSpecificEnvConfig = { API_KEY: 'runtime-only' };
    pluginManager.plugins = new Map([[currentEntry.name, currentEntry]]);

    const freshNative = makeNativeManifest({
        displayName: 'Fresh display',
        description: 'Fresh description',
        version: '2.0.0',
        author: 'Fresh author',
        communication: { protocol: 'direct' },
        entryPoint: { script: 'resident-runtime.js' },
        parameterSchema: { contractVersion: 'B' },
        configSchema: { mode: { const: 'B' } },
        capabilities: {
            invocationCommands: [
                { commandIdentifier: 'fresh-command', description: 'Fresh command' }
            ],
            arbitraryCapability: { enabled: false }
        },
        'x-future-extension': { effectiveRuntimeContract: 'B' }
    });
    const manifestPath = path.join(tempDir, 'plugin-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(freshNative), 'utf8');

    const result = await pluginManager._refreshPluginManifestMetadata(manifestPath);
    const refreshedEntry = pluginManager.plugins.get(freshNative.name);
    const authority = pluginManager.getCurrentNativeManifest(refreshedEntry);

    assert.deepEqual(DIRECT_REFRESH_METADATA_FIELDS, [
        'displayName',
        'description',
        'version',
        'author',
        'capabilities.invocationCommands'
    ]);
    assert.equal(result.restartRequired, true);
    assert.deepEqual(refreshedEntry.entryPoint, oldNative.entryPoint);
    assert.deepEqual(authority.entryPoint, oldNative.entryPoint);
    assert.deepEqual(authority.parameterSchema, oldNative.parameterSchema);
    assert.deepEqual(authority.configSchema, oldNative.configSchema);
    assert.deepEqual(authority['x-future-extension'], oldNative['x-future-extension']);
    assert.equal(authority.displayName, freshNative.displayName);
    assert.equal(authority.description, freshNative.description);
    assert.equal(authority.version, freshNative.version);
    assert.equal(authority.author, freshNative.author);
    assert.deepEqual(
        authority.capabilities.invocationCommands,
        freshNative.capabilities.invocationCommands
    );
    assert.deepEqual(
        authority.capabilities.arbitraryCapability,
        oldNative.capabilities.arbitraryCapability
    );
    assert.equal(Object.hasOwn(authority, 'basePath'), false);
    assert.equal(Object.hasOwn(authority, 'pluginSpecificEnvConfig'), false);
});

test('FMS-R3-SERIALIZED-FRAME-LOG-SINK classifies the exact frame sent by every outbound path', async t => {
    const sentinel = 'FMS_RAW_MANIFEST_SECRET_SENTINEL';
    const toJSONSentinel = 'FMS_SERIALIZED_TOJSON_SENTINEL';
    const getterSentinel = 'FMS_STATEFUL_GETTER_SENTINEL';
    const reverseSentinel = 'FMS_REVERSE_FRAME_AUTHORITY_SENTINEL';
    const nonManifestSentinel = 'FMS_NON_MANIFEST_LOG_SENTINEL';
    const nativeManifest = makeNativeManifest({
        description: sentinel,
        'x-future-extension': { sentinel }
    });
    const runtimeEntry = createRuntimePluginEntry(nativeManifest);
    const pluginManager = {
        plugins: new Map([[runtimeEntry.name, runtimeEntry]]),
        getCurrentNativeManifest
    };
    const fakeHttpServer = new EventEmitter();
    const wirePayloads = [];
    const logLines = [];
    const previousBridgeState = {
        wss: bridge.wss,
        config: bridge.config,
        debugMode: bridge.debugMode
    };
    const fakeWs = {
        clientId: 'test-client',
        readyState: WebSocket.OPEN,
        send(payload) {
            wirePayloads.push(payload);
        }
    };

    t.mock.method(console, 'log', (...args) => {
        logLines.push(args.map(value => String(value)).join(' '));
    });
    webSocketServer.initialize(fakeHttpServer, {
        debugMode: true,
        heartbeatEnabled: false,
        vcpKey: 'synthetic-test-key'
    });
    webSocketServer.__testing.distributedServers.set('dist-test-client', { ws: fakeWs });
    webSocketServer.__testing.adminPanelClients.set('admin-test-client', fakeWs);
    bridge.wss = webSocketServer;
    bridge.config = {};
    bridge.debugMode = false;

    t.after(async () => {
        webSocketServer.__testing.distributedServers.delete('dist-test-client');
        webSocketServer.__testing.adminPanelClients.delete('admin-test-client');
        Object.assign(bridge, previousBridgeState);
        await webSocketServer.shutdown();
    });

    const directManifestResponse = {
        type: 'vcp_manifest_response',
        data: {
            plugins: [{ description: sentinel }]
        }
    };
    webSocketServer.sendMessageToClient('test-client', directManifestResponse);
    webSocketServer.sendMessageToClient('test-client', directManifestResponse, {});
    webSocketServer.sendMessageToClient('test-client', directManifestResponse, {
        safeLogSummary: {
            manifestSurface: NATIVE_SURFACE,
            outcome: 'success',
            toolCount: 1
        }
    });
    webSocketServer.sendMessageToClient('test-client', directManifestResponse, {
        rawLogging: true
    });
    webSocketServer.broadcast(directManifestResponse);
    webSocketServer.broadcastToAdminPanel(directManifestResponse);

    await bridge.handleGetManifests('dist-test-client', {
        type: 'get_vcp_manifests',
        data: {
            requestId: 'legacy-raw-log-request'
        }
    }, pluginManager);

    await bridge.handleGetManifests('dist-test-client', {
        type: 'get_vcp_manifests',
        data: {
            requestId: 'raw-log-request',
            manifestSurface: NATIVE_SURFACE
        }
    }, pluginManager);

    let rootToJSONCalls = 0;
    const makeRootToJSONEnvelope = () => ({
        type: 'ordinary_before_serialization',
        toJSON() {
            rootToJSONCalls += 1;
            return {
                type: 'vcp_manifest_response',
                data: { value: toJSONSentinel }
            };
        }
    });
    webSocketServer.sendMessageToClient('test-client', makeRootToJSONEnvelope());
    webSocketServer.broadcast(makeRootToJSONEnvelope());
    webSocketServer.broadcastToAdminPanel(makeRootToJSONEnvelope());

    let statefulTypeReads = 0;
    const makeStatefulTypeEnvelope = () => {
        let envelopeReads = 0;
        const message = {
            data: { value: getterSentinel }
        };
        Object.defineProperty(message, 'type', {
            enumerable: true,
            configurable: true,
            get() {
                envelopeReads += 1;
                statefulTypeReads += 1;
                return envelopeReads === 1
                    ? 'vcp_manifest_response'
                    : 'ordinary_after_serialization';
            }
        });
        return message;
    };
    webSocketServer.sendMessageToClient('test-client', makeStatefulTypeEnvelope());
    webSocketServer.broadcast(makeStatefulTypeEnvelope());
    webSocketServer.broadcastToAdminPanel(makeStatefulTypeEnvelope());

    let reverseToJSONCalls = 0;
    webSocketServer.sendMessageToClient('test-client', {
        type: 'vcp_manifest_response',
        toJSON() {
            reverseToJSONCalls += 1;
            return {
                type: 'ordinary_message',
                data: { value: reverseSentinel }
            };
        }
    });

    webSocketServer.sendMessageToClient('test-client', {
        type: 'non_manifest_message',
        data: { value: nonManifestSentinel }
    });

    assert.equal(wirePayloads.length, 16);
    assert.equal(wirePayloads.slice(0, 8).every(payload => payload.includes(sentinel)), true);
    assert.equal(logLines.some(line => line.includes(sentinel)), false);
    assert.equal(rootToJSONCalls, 3);
    assert.equal(statefulTypeReads, 3);
    assert.equal(reverseToJSONCalls, 1);

    const rootToJSONFrames = wirePayloads.slice(8, 11);
    assert.equal(rootToJSONFrames.every(frame => JSON.parse(frame).type === 'vcp_manifest_response'), true);
    assert.equal(rootToJSONFrames.every(frame => frame.includes(toJSONSentinel)), true);
    assert.equal(logLines.some(line => line.includes(toJSONSentinel)), false);

    const getterFrames = wirePayloads.slice(11, 14);
    assert.equal(getterFrames.every(frame => JSON.parse(frame).type === 'vcp_manifest_response'), true);
    assert.equal(getterFrames.every(frame => frame.includes(getterSentinel)), true);
    assert.equal(logLines.some(line => line.includes(getterSentinel)), false);

    assert.equal(JSON.parse(wirePayloads[14]).type, 'ordinary_message');
    assert.equal(wirePayloads[14].includes(reverseSentinel), true);
    assert.equal(logLines.some(line => line.includes(reverseSentinel)), true);
    assert.equal(
        logLines.filter(line => line.includes(
            'Sent vcp_manifest_response; payload logging suppressed.'
        )).length,
        14
    );
    assert.equal(wirePayloads[15].includes(nonManifestSentinel), true);
    assert.equal(logLines.some(line => line.includes(nonManifestSentinel)), true);
});
