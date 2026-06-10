const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
    buildInventory,
    classifyPath,
    isEnvExample,
    isRealEnvOrConfig,
    summarizeRecords,
    walkPathOnly
} = require('../scripts/p3-external-ecosystem-inventory');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-p3c-inventory-'));
}

function writeFixture(root, relativePath, content = '') {
    const targetPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

test('classifyPath keeps P3 core adapter files in core', () => {
    assert.equal(classifyPath('Plugin.js').decision, 'keep_core');
    assert.equal(classifyPath('modules/pluginRootResolver.js').decision, 'keep_core');
    assert.equal(classifyPath('routes/admin/plugins.js').decision, 'keep_core');
    assert.equal(classifyPath('routes/admin/pluginStore.js').decision, 'keep_core');
    assert.equal(classifyPath('AdminPanel-Vue/src/views/PluginStore.vue').decision, 'keep_core');
    assert.equal(classifyPath('modules/agentManager.js').decision, 'keep_core');
    assert.equal(classifyPath('agent_map.json').decision, 'keep_core');
});

test('classifyPath identifies externalizable Jenn ecosystem candidates by path only', () => {
    assert.deepEqual(
        classifyPath('Plugin/PhotoStudioProjectRecord/plugin-manifest.json'),
        {
            decision: 'externalizable',
            surface: 'plugin-legacy',
            target: 'adapters/photography/',
            reasons: ['photo_studio_plugin_family']
        }
    );
    assert.equal(classifyPath('Plugin/vcp-dingtalk-adapter/plugin-manifest.json').target, 'adapters/dingtalk/');
    assert.equal(classifyPath('Plugin/CodexMemoryBridge/plugin-manifest.json').target, 'adapters/codex/');
    assert.equal(classifyPath('Plugin/VCPTavern/plugin-manifest.json').target, 'adapters/vcpchat/');
    assert.equal(classifyPath('Agent/Muse.txt').target, 'agents/');
    assert.equal(classifyPath('docs/governance/P3_JENN_EXTERNAL_ECOSYSTEM_DIRECTORY_CONTRACT_20260610.md').decision, 'docs_only');
});

test('classifyPath defers surfaces that need separate migration design', () => {
    assert.equal(classifyPath('plugins/custom/shared/photo_studio_data/projects.json').decision, 'deferred');
    assert.equal(classifyPath('plugins/custom/registry.json').target, 'plugins-modern/');
    assert.equal(classifyPath('modules/photoStudio/store.js').decision, 'deferred');
    assert.equal(classifyPath('modules/channelHub/AdapterContract.js').decision, 'keep_core');
    assert.equal(classifyPath('dailynote/Codex/example.txt').decision, 'deferred');
});

test('classifyPath blocks secret, config, runtime, and private store paths', () => {
    assert.equal(isRealEnvOrConfig('config.env'), true);
    assert.equal(isRealEnvOrConfig('Plugin/Foo/config.env'), true);
    assert.equal(isEnvExample('Plugin/Foo/config.env.example'), true);
    assert.equal(classifyPath('config.env').decision, 'blocked');
    assert.equal(classifyPath('Plugin/Foo/config.env').decision, 'blocked');
    assert.equal(classifyPath('Plugin/Foo/config.env.example').decision, 'externalizable');
    assert.equal(classifyPath('state/runtime.json').decision, 'blocked');
    assert.equal(classifyPath('cache/data.json').decision, 'blocked');
    assert.equal(classifyPath('image/output.png').decision, 'blocked');
    assert.equal(classifyPath('VectorStore/main.sqlite').decision, 'blocked');
    assert.equal(classifyPath('certs/private.pem').decision, 'blocked');
});

test('walkPathOnly and buildInventory never include file contents', () => {
    const root = makeTempDir();
    const secretContent = 'SHOULD_NOT_APPEAR_IN_PATH_ONLY_OUTPUT';
    try {
        writeFixture(root, 'Plugin/PhotoStudioProjectRecord/plugin-manifest.json', '{"name":"fixture"}');
        writeFixture(root, 'Plugin/Foo/config.env', secretContent);
        writeFixture(root, 'Agent/Muse.txt', secretContent);
        writeFixture(root, 'modules/pluginRootResolver.js', 'module source should not be read');

        const records = walkPathOnly(root);
        const inventory = buildInventory(root, { generatedAt: 'test-time' });
        const serialized = JSON.stringify({ records, inventory });

        assert.ok(records.some(record => record.path === 'Plugin/Foo/config.env'));
        assert.ok(records.some(record => record.path === 'Agent/Muse.txt'));
        assert.equal(serialized.includes(secretContent), false);
        assert.equal(inventory.mode, 'path-only');
        assert.equal(inventory.summary.byDecision.blocked >= 1, true);
        assert.equal(inventory.summary.byDecision.externalizable >= 1, true);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('summarizeRecords counts decisions and surfaces', () => {
    const records = [
        { decision: 'keep_core', surface: 'adapter-core' },
        { decision: 'blocked', surface: 'secret-config' },
        { decision: 'blocked', surface: 'runtime-state' }
    ];
    assert.deepEqual(summarizeRecords(records), {
        total: 3,
        byDecision: {
            keep_core: 1,
            blocked: 2
        },
        bySurface: {
            'adapter-core': 1,
            'secret-config': 1,
            'runtime-state': 1
        }
    });
});

test('CLI --summary emits JSON summary without fixture file contents', () => {
    const root = makeTempDir();
    const secretContent = 'CLI_SHOULD_NOT_PRINT_THIS';
    try {
        writeFixture(root, 'Plugin/Foo/config.env', secretContent);
        writeFixture(root, 'Plugin/PhotoStudioProjectRecord/plugin-manifest.json', '{"name":"fixture"}');
        const output = execFileSync(
            process.execPath,
            [path.join(__dirname, '..', 'scripts', 'p3-external-ecosystem-inventory.js'), '--root', root, '--summary'],
            { encoding: 'utf8' }
        );
        const parsed = JSON.parse(output);
        assert.equal(parsed.mode, 'path-only');
        assert.equal(parsed.summary.byDecision.blocked >= 1, true);
        assert.equal(parsed.summary.byDecision.externalizable >= 1, true);
        assert.equal(output.includes(secretContent), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
