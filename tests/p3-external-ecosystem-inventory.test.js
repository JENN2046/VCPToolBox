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
    parseArgs,
    summarizeRecords,
    walkPathOnly
} = require('../scripts/p3-external-ecosystem-inventory');

const INVENTORY_SCRIPT = path.join(__dirname, '..', 'scripts', 'p3-external-ecosystem-inventory.js');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-p3c-inventory-'));
}

function writeFixture(root, relativePath, content = '') {
    const targetPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
}

function runCliExpectFailure(args, expectedMessage) {
    try {
        execFileSync(process.execPath, [INVENTORY_SCRIPT, ...args], {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        assert.fail(`expected CLI failure for args: ${args.join(' ')}`);
    } catch (error) {
        assert.equal(error.status, 2);
        assert.match(String(error.stderr), expectedMessage);
    }
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

test('classifyPath applies P3-E taxonomy refinement rules', () => {
    assert.deepEqual(
        classifyPath('rust-vexus-lite/target/release/build/output.o'),
        {
            decision: 'blocked',
            surface: 'generated-build-artifact',
            target: null,
            reasons: ['native_build_output_never_move_automatically']
        }
    );
    assert.deepEqual(
        classifyPath('rust-vexus-lite/src/lib.rs'),
        {
            decision: 'deferred',
            surface: 'native-module-source',
            target: 'adapters/',
            reasons: ['native_module_source_requires_package_build_contract']
        }
    );
    assert.equal(classifyPath('VectorStore/index_global_tags.usearch').decision, 'blocked');
    assert.equal(classifyPath('tests/plugin-external-dirs.test.js').surface, 'validation');
    assert.equal(classifyPath('modules/toolApprovalManager.js').surface, 'runtime-support');
    assert.equal(classifyPath('routes/taskScheduler.js').surface, 'runtime-support');
    assert.equal(classifyPath('vcp-installer-source/src/main.rs').target, 'adapters/installer/');
    assert.equal(classifyPath('scripts/rebuild_vector_indexes.js').surface, 'tooling');
    assert.equal(classifyPath('VCPChrome/manifest.json').target, 'adapters/vcpchrome/');
    assert.equal(classifyPath('SillyTavernSub/plugin.js').target, 'adapters/vcpchat/');
    assert.equal(classifyPath('OpenWebUISub/renderer.py').target, 'adapters/openwebui/');
    assert.equal(classifyPath('TVStxt/FileToolBox.txt').surface, 'operator-tool-prompts');
    assert.equal(classifyPath('.agent_board/HANDOFF.md').surface, 'protected-agent-board');
});

test('classifyPath applies P3-F remaining unknown taxonomy rules', () => {
    assert.deepEqual(
        classifyPath('.github/workflows/ci.yml'),
        {
            decision: 'keep_core',
            surface: 'repo-metadata',
            target: null,
            reasons: ['repository_metadata_stays_core']
        }
    );
    assert.deepEqual(
        classifyPath('logs/codex-memory-bridge.jsonl'),
        {
            decision: 'blocked',
            surface: 'local-cache-state',
            target: null,
            reasons: ['local_cache_state_never_move_automatically']
        }
    );
    assert.equal(classifyPath('.file_cache').surface, 'local-cache-state');
    assert.equal(classifyPath('.omc/state/last-tool-error.json').decision, 'blocked');
    assert.equal(classifyPath('data/photo-studio/.gitkeep').surface, 'local-cache-state');
    assert.equal(classifyPath('tmp/uploads').surface, 'local-cache-state');
    assert.deepEqual(
        classifyPath('server.js'),
        {
            decision: 'keep_core',
            surface: 'runtime-entrypoint',
            target: null,
            reasons: ['root_runtime_entrypoint_stays_core']
        }
    );
    assert.equal(classifyPath('adminServer.js').surface, 'runtime-entrypoint');
    assert.equal(classifyPath('WebSocketServer.js').surface, 'runtime-entrypoint');
    assert.deepEqual(
        classifyPath('package.json'),
        {
            decision: 'keep_core',
            surface: 'repo-build-config',
            target: null,
            reasons: ['repository_build_config_stays_core']
        }
    );
    assert.equal(classifyPath('docker-compose.yml').surface, 'repo-build-config');
    assert.equal(classifyPath('requirements.txt').surface, 'repo-build-config');
    assert.deepEqual(
        classifyPath('ToolConfigs/dynamic_tool_catalog.json'),
        {
            decision: 'deferred',
            surface: 'operator-config',
            target: null,
            reasons: ['operator_config_requires_separate_review']
        }
    );
    assert.equal(classifyPath('agent_map.json.example').surface, 'operator-config');
    assert.equal(classifyPath('tag-processor-config.env.example').surface, 'operator-config');
    assert.deepEqual(
        classifyPath('README For VCPChat.md'),
        {
            decision: 'docs_only',
            surface: 'documentation',
            target: 'governance/',
            reasons: ['root_documentation_catalog_only']
        }
    );
    assert.equal(classifyPath('AGENTS.override.md').surface, 'documentation');
    assert.equal(classifyPath('VCP记忆管理系统.md').surface, 'documentation');
    assert.deepEqual(
        classifyPath('示例1服务器面板.jpg'),
        {
            decision: 'deferred',
            surface: 'example-media',
            target: null,
            reasons: ['example_media_requires_asset_review']
        }
    );
    assert.equal(classifyPath('VCPLogo.png').surface, 'example-media');
    assert.deepEqual(
        classifyPath('repair_database.js'),
        {
            decision: 'keep_core',
            surface: 'maintenance-tooling',
            target: null,
            reasons: ['root_maintenance_tooling_stays_core']
        }
    );
    assert.equal(classifyPath('update.bat').surface, 'maintenance-tooling');
    assert.equal(classifyPath('timeline整理器.py').surface, 'maintenance-tooling');
    assert.deepEqual(
        classifyPath('vcp-installer-一键安装脚本.exe'),
        {
            decision: 'deferred',
            surface: 'installer-binary',
            target: null,
            reasons: ['installer_binary_requires_package_provenance_review']
        }
    );
    assert.deepEqual(
        classifyPath('VCPTimedContacts'),
        {
            decision: 'deferred',
            surface: 'contact-state',
            target: null,
            reasons: ['contact_state_requires_operator_data_review']
        }
    );
    assert.equal(classifyPath('ToolConfigs/private-token.config.json').surface, 'secret-like-path');
    assert.equal(classifyPath('logs/private.pem').surface, 'key-material');
    assert.equal(classifyPath('data/private.key').surface, 'key-material');
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
    assert.equal(classifyPath('scripts/private-token-helper.js').decision, 'blocked');
    assert.equal(classifyPath('rust-vexus-lite/target/private-key.pem').decision, 'blocked');
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
        truncated: false,
        limit: 100000,
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

test('buildInventory exposes truncation metadata when maxEntries is reached', () => {
    const root = makeTempDir();
    try {
        writeFixture(root, 'a.txt', 'alpha');
        writeFixture(root, 'b.txt', 'bravo');
        writeFixture(root, 'c.txt', 'charlie');

        const records = walkPathOnly(root, { maxEntries: 2 });
        assert.equal(records.length, 2);
        assert.equal(records.truncated, true);
        assert.equal(records.limit, 2);

        const inventory = buildInventory(root, {
            generatedAt: 'test-time',
            maxEntries: 2
        });
        assert.equal(inventory.truncated, true);
        assert.equal(inventory.limit, 2);
        assert.equal(inventory.summary.truncated, true);
        assert.equal(inventory.summary.limit, 2);
        assert.equal(inventory.records.length, 2);

        const fullInventory = buildInventory(root, {
            generatedAt: 'test-time',
            maxEntries: 10
        });
        assert.equal(fullInventory.truncated, false);
        assert.equal(fullInventory.summary.truncated, false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('CLI --summary emits JSON summary without fixture file contents', () => {
    const root = makeTempDir();
    const secretContent = 'CLI_SHOULD_NOT_PRINT_THIS';
    try {
        writeFixture(root, 'Plugin/Foo/config.env', secretContent);
        writeFixture(root, 'Plugin/PhotoStudioProjectRecord/plugin-manifest.json', '{"name":"fixture"}');
        const output = execFileSync(
            process.execPath,
            [INVENTORY_SCRIPT, '--root', root, '--summary'],
            { encoding: 'utf8' }
        );
        const parsed = JSON.parse(output);
        assert.equal(parsed.mode, 'path-only');
        assert.equal(parsed.truncated, false);
        assert.equal(parsed.limit, 100000);
        assert.equal(parsed.summary.truncated, false);
        assert.equal(parsed.summary.limit, 100000);
        assert.equal(parsed.summary.byDecision.blocked >= 1, true);
        assert.equal(parsed.summary.byDecision.externalizable >= 1, true);
        assert.equal(output.includes(secretContent), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('CLI fails closed on missing values and unknown arguments', () => {
    assert.throws(
        () => parseArgs(['--root']),
        /--root requires a value/
    );
    assert.throws(
        () => parseArgs(['--root', '--summary']),
        /--root requires a value/
    );
    assert.throws(
        () => parseArgs(['--unknown']),
        /unknown argument: --unknown/
    );
    assert.throws(
        () => parseArgs(['--max-entries', '0']),
        /--max-entries requires a positive integer/
    );

    runCliExpectFailure(['--root'], /--root requires a value/);
    runCliExpectFailure(['--root', '--summary'], /--root requires a value/);
    runCliExpectFailure(['--unknown'], /unknown argument: --unknown/);
    runCliExpectFailure(['--max-entries', '0'], /--max-entries requires a positive integer/);
});

test('CLI --summary reports maxEntries truncation metadata', () => {
    const root = makeTempDir();
    try {
        writeFixture(root, 'a.txt', 'alpha');
        writeFixture(root, 'b.txt', 'bravo');
        writeFixture(root, 'c.txt', 'charlie');

        const output = execFileSync(
            process.execPath,
            [INVENTORY_SCRIPT, '--root', root, '--summary', '--max-entries', '2'],
            { encoding: 'utf8' }
        );
        const parsed = JSON.parse(output);
        assert.equal(parsed.truncated, true);
        assert.equal(parsed.limit, 2);
        assert.equal(parsed.summary.truncated, true);
        assert.equal(parsed.summary.limit, 2);
        assert.equal(parsed.summary.total, 2);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
