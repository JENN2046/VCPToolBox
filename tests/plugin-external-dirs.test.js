const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pluginManager = require('../Plugin.js');
const { classifyExternalPluginManifest } = require('../modules/externalPluginSafetyGate');

after(() => {
    if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
        pluginManager.toolApprovalManager.shutdown();
    }
});

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-plugin-dirs-'));
}

function writeLegacyManifest(root, folderName, manifest) {
    const pluginDir = path.join(root, folderName);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
        path.join(pluginDir, 'plugin-manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
    );
    return pluginDir;
}

test('VCP_PLUGIN_DIRS parser tolerates missing, empty, semicolon, and duplicate entries', () => {
    assert.deepEqual(pluginManager._parseExternalLegacyPluginDirs(''), []);
    assert.deepEqual(pluginManager._parseExternalLegacyPluginDirs('  ;  '), []);

    const first = path.resolve(__dirname, '..', 'external-one');
    const second = path.resolve(__dirname, '..', 'external-two');
    assert.deepEqual(
        pluginManager._parseExternalLegacyPluginDirs('external-one; external-two ; external-one'),
        [first, second]
    );
    assert.deepEqual(
        pluginManager._parseExternalLegacyPluginDirs('external-one:external-two:external-one'),
        [first, second]
    );
});

test('legacy external discovery ignores missing and empty directories without changing built-in loading', async () => {
    const missingRoot = path.join(os.tmpdir(), `vcp-missing-${Date.now()}`);
    const emptyRoot = makeTempDir();

    try {
        assert.deepEqual(
            await pluginManager._discoverLegacyPluginManifestsFromDir(missingRoot, 'external'),
            []
        );
        assert.deepEqual(
            await pluginManager._discoverLegacyPluginManifestsFromDir(emptyRoot, 'external'),
            []
        );
    } finally {
        fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
});

test('legacy external discovery reads plugin-manifest.json without executing plugin code', async () => {
    const root = makeTempDir();
    const pluginDir = writeLegacyManifest(root, 'ExternalEcho', {
        name: 'ExternalEcho',
        displayName: 'External Echo',
        pluginType: 'synchronous',
        entryPoint: { command: 'node external-echo.js' },
        communication: { protocol: 'stdio', timeout: 1000 }
    });
    fs.writeFileSync(
        path.join(pluginDir, 'external-echo.js'),
        'throw new Error("should not execute during discovery");\n',
        'utf8'
    );

    try {
        const manifests = await pluginManager._discoverLegacyPluginManifestsFromDir(root, 'external');
        assert.equal(manifests.length, 1);
        assert.equal(manifests[0].name, 'ExternalEcho');
        assert.equal(manifests[0].pluginSource, 'external');
        assert.equal(manifests[0].basePath, pluginDir);
        assert.deepEqual(manifests[0].pluginSpecificEnvConfig, {});

        const safetyDecision = classifyExternalPluginManifest(manifests[0]);
        assert.equal(safetyDecision.pluginName, 'ExternalEcho');
        assert.equal(safetyDecision.isExternal, true);
        assert.equal(safetyDecision.decision, 'would_block');
        assert.equal(safetyDecision.risk, 'executes_process');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('PluginManager discovers resolver legacy roots in core-first order', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Plugin.js'), 'utf8');

    assert.match(source, /for \(const rootInfo of rootSnapshot\.legacyLoadRoots\)/);
    assert.match(source, /_discoverLegacyPluginManifestsFromDir\(\s+rootInfo\.rootPath,\s+rootInfo\.source,\s+rootInfo\s+\)/s);
    assert.match(source, /if \(this\.plugins\.has\(manifest\.name\)\) continue;\s+await this\._registerLocalPlugin\(manifest/s);

    const firstExternalRoot = makeTempDir();
    const secondExternalRoot = makeTempDir();
    const previousDirs = process.env.VCP_PLUGIN_DIRS;
    const previousAllowedRoots = process.env.VCP_PLUGIN_ALLOWED_ROOTS;

    try {
        process.env.VCP_PLUGIN_ALLOWED_ROOTS = [firstExternalRoot, secondExternalRoot].join(path.delimiter);
        process.env.VCP_PLUGIN_DIRS = [secondExternalRoot, firstExternalRoot].join(path.delimiter);

        const snapshot = pluginManager.pluginRootResolver.getPluginRootSnapshotSync();
        assert.equal(snapshot.legacyLoadRoots[0].source, 'core');
        assert.equal(snapshot.legacyLoadRoots[0].rootId, 'core:legacy');
        assert.deepEqual(
            snapshot.legacyLoadRoots.slice(1).map(rootInfo => rootInfo.rootPath),
            [secondExternalRoot, firstExternalRoot]
        );
        assert.deepEqual(
            snapshot.legacyLoadRoots.slice(1).map(rootInfo => rootInfo.source),
            ['external', 'external']
        );
    } finally {
        if (previousDirs === undefined) delete process.env.VCP_PLUGIN_DIRS;
        else process.env.VCP_PLUGIN_DIRS = previousDirs;

        if (previousAllowedRoots === undefined) delete process.env.VCP_PLUGIN_ALLOWED_ROOTS;
        else process.env.VCP_PLUGIN_ALLOWED_ROOTS = previousAllowedRoots;

        fs.rmSync(firstExternalRoot, { recursive: true, force: true });
        fs.rmSync(secondExternalRoot, { recursive: true, force: true });
    }
});
