const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const pluginManager = require('../Plugin.js');

after(() => {
    if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
        pluginManager.toolApprovalManager.shutdown();
    }
});

test('CodexMemoryBridge should reject without context and accept with Codex context', async () => {
    const previousProjectBasePath = pluginManager.projectBasePath;
    const previousPlugin = pluginManager.plugins.get('CodexMemoryBridge');
    const tempBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-codex-bridge-test-'));
    const pluginBasePath = path.resolve(__dirname, '..', 'Plugin', 'CodexMemoryBridge');

    try {
        pluginManager.setProjectBasePath(tempBasePath);
        if (pluginManager.toolApprovalManager && pluginManager.toolApprovalManager.config) {
            pluginManager.toolApprovalManager.config.enabled = false;
        }

        pluginManager.plugins.set('CodexMemoryBridge', {
            name: 'CodexMemoryBridge',
            pluginType: 'synchronous',
            communication: { protocol: 'stdio', timeout: 10000 },
            entryPoint: { command: 'node codex-memory-bridge.js' },
            basePath: pluginBasePath,
            requiresAdmin: false,
            configSchema: {}
        });

        const args = {
            target: 'process',
            title: 'test checkpoint',
            content: 'Type: checkpoint\nverify context bridge',
            evidence: 'automated test evidence',
            validated: true,
            reusable: false,
            tags: 'test, codex-memory-bridge',
            sensitivity: 'none'
        };

        const rejected = await pluginManager.processToolCall('CodexMemoryBridge', args, null, null);
        assert.equal(rejected.decision, 'rejected');
        assert.match(rejected.reason, /Codex Agent/);

        const accepted = await pluginManager.processToolCall('CodexMemoryBridge', args, null, {
            agentAlias: 'Codex',
            agentId: 'test-agent',
            requestSource: 'node-test'
        });
        assert.equal(accepted.decision, 'accepted');
        assert.equal(accepted.agentAlias, 'Codex');
        assert.equal(accepted.requestSource, 'node-test');
        assert.match(accepted.memoryId, /^codex-process-/);
        assert.ok(accepted.filePath, 'accepted response should include filePath');
        assert.match(accepted.filePath, /dailynote[\\/]Codex[\\/]/);
        await fs.access(accepted.filePath);
        const writtenContent = await fs.readFile(accepted.filePath, 'utf8');
        assert.match(writtenContent, new RegExp(`Memory-ID: ${accepted.memoryId}`));

        const auditLogPath = path.join(tempBasePath, 'logs', 'codex-memory-bridge.jsonl');
        const auditRaw = await fs.readFile(auditLogPath, 'utf8');
        const auditEntries = auditRaw
            .split(/\r?\n/)
            .filter(Boolean)
            .map(line => JSON.parse(line));

        assert.ok(auditEntries.some(entry => entry.decision === 'rejected'));
        assert.ok(auditEntries.some(entry =>
            entry.decision === 'accepted' &&
            entry.agentAlias === 'Codex' &&
            entry.memoryId === accepted.memoryId &&
            entry.title === 'test checkpoint'
        ));
    } finally {
        if (previousPlugin) {
            pluginManager.plugins.set('CodexMemoryBridge', previousPlugin);
        } else {
            pluginManager.plugins.delete('CodexMemoryBridge');
        }
        pluginManager.setProjectBasePath(previousProjectBasePath || null);
        await fs.rm(tempBasePath, { recursive: true, force: true });
    }
});
