const { after, test } = require('node:test');
const assert = require('node:assert/strict');

const pluginManager = require('../Plugin.js');
const toolCallRecordStore = require('../modules/toolCallRecordStore');

after(async () => {
    if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
        await pluginManager.toolApprovalManager.shutdown();
    }
    await toolCallRecordStore.shutdown();
});

async function withPluginManagerState(run) {
    const originalPlugins = pluginManager.plugins;
    const originalServiceModules = pluginManager.serviceModules;
    const originalExecutePlugin = pluginManager.executePlugin;
    const originalToolApprovalManager = pluginManager.toolApprovalManager;

    pluginManager.plugins = new Map();
    pluginManager.serviceModules = new Map();
    pluginManager.toolApprovalManager = {
        getApprovalDecision: () => ({ requiresApproval: false }),
        getPrivacyProtectionConfig: () => ({ enabled: false })
    };

    try {
        await run();
    } finally {
        pluginManager.plugins = originalPlugins;
        pluginManager.serviceModules = originalServiceModules;
        pluginManager.executePlugin = originalExecutePlugin;
        pluginManager.toolApprovalManager = originalToolApprovalManager;
    }
}

function makeStdioPlugin(name) {
    return {
        name,
        displayName: name,
        pluginType: 'synchronous',
        communication: { protocol: 'stdio', timeout: 1000 },
        entryPoint: { command: 'node FileOperator.js' },
        basePath: __dirname
    };
}

test('FileOperator alias resolves to ServerFileOperator for stdio tool calls', async () => {
    await withPluginManagerState(async () => {
        const plugin = makeStdioPlugin('ServerFileOperator');
        pluginManager.plugins.set(plugin.name, plugin);

        assert.equal(pluginManager.getPlugin('FileOperator'), plugin);

        pluginManager.executePlugin = async (pluginName, inputData) => {
            assert.equal(pluginName, 'ServerFileOperator');
            assert.deepEqual(JSON.parse(inputData), {
                command: 'FileInfo',
                filePath: '/tmp/example.txt'
            });
            return {
                status: 'success',
                result: { ok: true }
            };
        };

        const result = await pluginManager.processToolCall('FileOperator', {
            command: 'FileInfo',
            filePath: '/tmp/example.txt'
        });

        assert.equal(result.ok, true);
        assert.equal(typeof result.timestamp, 'string');
    });
});

test('exact plugin names take precedence over aliases', async () => {
    await withPluginManagerState(async () => {
        const exactPlugin = makeStdioPlugin('FileOperator');
        const aliasTarget = makeStdioPlugin('ServerFileOperator');

        pluginManager.plugins.set(exactPlugin.name, exactPlugin);
        pluginManager.plugins.set(aliasTarget.name, aliasTarget);

        assert.equal(pluginManager.getPlugin('FileOperator'), exactPlugin);
    });
});
