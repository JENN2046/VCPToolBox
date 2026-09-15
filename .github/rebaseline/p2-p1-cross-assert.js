const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pluginManager = require('../../Plugin.js');

(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-p2-cross-'));
    const pluginDir = path.join(root, 'ExternalCrossFixture');
    fs.mkdirSync(pluginDir, { recursive: true });
    const native = {
        name: 'ExternalCrossFixture',
        displayName: 'External Cross Fixture',
        pluginType: 'synchronous',
        entryPoint: { command: 'node fixture.js' },
        communication: { protocol: 'stdio', timeout: 1000 },
        capabilities: { invocationCommands: [] }
    };
    const manifestPath = path.join(pluginDir, 'plugin-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(native, null, 2));

    try {
        const manifests = await pluginManager._discoverLegacyPluginManifestsFromDir(root, 'external', {
            rootId: 'external:1',
            source: 'external',
            rootPath: root,
            displayPath: '[external]/fixture',
            allowConfigEnv: false,
            enabled: true
        });
        assert.equal(manifests.length, 1);
        const runtimeEntry = manifests[0];
        assert.deepEqual(pluginManager.getCurrentNativeManifest(runtimeEntry), native);
        assert.equal(runtimeEntry.pluginSource, 'external');
        assert.equal(runtimeEntry.pluginRootId, 'external:1');

        pluginManager.plugins.set(native.name, runtimeEntry);
        const refreshedNative = { ...native, displayName: 'External Cross Fixture v2' };
        fs.writeFileSync(manifestPath, JSON.stringify(refreshedNative, null, 2));
        const result = await pluginManager._refreshPluginManifestMetadata(manifestPath);
        assert.equal(result.refreshed, true);
        const refreshed = pluginManager.plugins.get(native.name);
        assert.equal(refreshed.pluginSource, 'external');
        assert.equal(refreshed.pluginRootId, 'external:1');
        assert.deepEqual(pluginManager.getCurrentNativeManifest(refreshed), refreshedNative);
        assert.equal(pluginManager._isExternalPluginManifest(refreshed), true);
        console.log('PASS_P1_P2_NATIVE_AUTHORITY_PROVENANCE');
    } finally {
        pluginManager.plugins.delete(native.name);
        await pluginManager.toolApprovalManager?.shutdown?.();
        fs.rmSync(root, { recursive: true, force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
