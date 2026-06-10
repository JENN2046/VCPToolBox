#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    '.local-retain'
]);

const CORE_EXACT_PATHS = new Set([
    'Plugin.js',
    'modules/pluginRootResolver.js',
    'routes/admin/plugins.js',
    'routes/admin/pluginStore.js',
    'modules/agentManager.js',
    'agent_map.json'
]);

const RUNTIME_ROOTS = new Set([
    'state',
    'cache',
    'DebugLog',
    'image',
    'LocalState'
]);

const SECRET_LIKE_RE = /(secret|token|password|passwd|apikey|api_key|credential|private[_-]?key|cookie|authorization)/i;
const KEY_MATERIAL_RE = /\.(pem|p12|pfx|key)$/i;
const VECTOR_OR_DB_RE = /(^|\/)(VectorStore[^/]*|.*\.(sqlite|sqlite3|db|db3|duckdb|parquet|faiss|index))$/i;

const REPO_METADATA_PATHS = new Set([
    '.dockerignore',
    '.gitignore',
    'LICENSE'
]);

const REPO_METADATA_ROOTS = new Set([
    '.github'
]);

const LOCAL_CACHE_STATE_ROOTS = new Set([
    '.file_cache',
    '.omc',
    'data',
    'logs',
    'tmp'
]);

const MAINTENANCE_TOOLING_PATHS = new Set([
    '一键启动服务器start_server.bat',
    'backup_vcp.py',
    'LinuxNotify.py',
    'rebuild_tag_index_custom.js',
    'rebuild_vector_indexes.js',
    'repair_database.js',
    'reset_vectordb.js',
    'sync_missing_tags.js',
    'test-units.js',
    'timeline整理器.py',
    'update_with_no_dependency.bat',
    'update.bat',
    'VCPWinNotify.Py',
    'WinNotify.py'
]);

const RUNTIME_ENTRYPOINT_PATHS = new Set([
    'adminServer.js',
    'diary-tag-batch-processor.js',
    'EmbeddingUtils.js',
    'envLoader.js',
    'EPAModule.js',
    'FileFetcherServer.js',
    'KnowledgeBaseManager.js',
    'modelRedirectHandler.js',
    'ResidualPyramid.js',
    'ResultDeduplicator.js',
    'server.js',
    'TagMemoEngine.js',
    'TextChunker.js',
    'vcpInfoHandler.js',
    'WebSocketServer.js',
    'WorkerPool.js'
]);

const REPO_BUILD_CONFIG_PATHS = new Set([
    'diary-tag-processor-package.json',
    'docker-compose.yml',
    'Dockerfile',
    'ecosystem.config.js',
    'package-lock.json',
    'package.json',
    'poetry.lock',
    'pyproject.toml',
    'requirements.txt'
]);

const OPERATOR_CONFIG_PATHS = new Set([
    'agent_map.json.example',
    'ip_blacklist.json',
    'ModelRedirect.json.example',
    'preprocessor_order.json',
    'rag_params.json',
    'sarprompt.json',
    'SemanticModelRouter.json',
    'SemanticModelRouter.json.example',
    'tag-processor-config.env.example',
    'toolApprovalConfig.json',
    'toolbox_map.json'
]);

function toPosixPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function splitPath(relativePath) {
    return toPosixPath(relativePath).split('/').filter(Boolean);
}

function isRealEnvOrConfig(relativePath) {
    const normalized = toPosixPath(relativePath);
    return /(^|\/)\.env$/i.test(normalized)
        || /(^|\/)config\.env$/i.test(normalized)
        || /^Plugin\/[^/]+\/config\.env$/i.test(normalized);
}

function isEnvExample(relativePath) {
    const normalized = toPosixPath(relativePath);
    return /(^|\/)(\.env\.example|config\.env\.example)$/i.test(normalized);
}

function firstPluginName(parts) {
    return parts[0] === 'Plugin' && parts.length > 1 ? parts[1] : null;
}

function isRootPath(normalized) {
    return !normalized.includes('/');
}

function isRootDocumentationPath(normalized) {
    if (!isRootPath(normalized)) return false;
    return normalized === 'AgentDream.md'
        || normalized === 'dailynote.md'
        || normalized === 'MEMORY.md'
        || /^AGENTS(?:\..*)?\.md$/i.test(normalized)
        || /^README(?:[ ._-].*)?\.md$/i.test(normalized)
        || /^TagMemo.*\.md$/i.test(normalized)
        || /^VCP.*\.md$/i.test(normalized)
        || /^vcptoolbox.*\.txt$/i.test(normalized);
}

function isExampleMediaPath(normalized) {
    if (!isRootPath(normalized)) return false;
    return normalized === 'VCPLogo.png'
        || /^示例\d+.*\.(jpg|jpeg|png)$/i.test(normalized);
}

function classifyPluginPath(parts, relativePath) {
    const pluginName = firstPluginName(parts);
    if (!pluginName) {
        return {
            decision: 'keep_core',
            surface: 'plugin-root',
            target: null,
            reasons: ['core_plugin_root']
        };
    }

    if (relativePath === 'Plugin/AGENTS.md') {
        return {
            decision: 'keep_core',
            surface: 'plugin-governance',
            target: null,
            reasons: ['core_plugin_governance_file']
        };
    }

    if (isEnvExample(relativePath)) {
        return {
            decision: 'externalizable',
            surface: 'env-example',
            target: 'env-examples/',
            reasons: ['placeholder_env_example_requires_secret_pattern_review']
        };
    }

    if (/^PhotoStudio/.test(pluginName)) {
        return {
            decision: 'externalizable',
            surface: 'plugin-legacy',
            target: 'adapters/photography/',
            reasons: ['photo_studio_plugin_family']
        };
    }

    const adapterMatch = pluginName.match(/^vcp-(dingtalk|feishu|wecom|onebot)-adapter$/i);
    if (adapterMatch) {
        return {
            decision: 'externalizable',
            surface: 'adapter',
            target: `adapters/${adapterMatch[1].toLowerCase()}/`,
            reasons: ['channel_adapter_pack']
        };
    }

    if (/^(CodexMemoryBridge)$/i.test(pluginName)) {
        return {
            decision: 'externalizable',
            surface: 'adapter',
            target: 'adapters/codex/',
            reasons: ['codex_bridge_adapter']
        };
    }

    if (/^(VCPTavern|VCPForum|VCPForumLister|VCPForumOnline|VCPForumOnlinePatrol)$/i.test(pluginName)) {
        return {
            decision: 'externalizable',
            surface: 'adapter',
            target: 'adapters/vcpchat/',
            reasons: ['vcpchat_integration_adapter']
        };
    }

    if (/^(AIGent|Agent|MagiAgent)/i.test(pluginName)) {
        return {
            decision: 'externalizable',
            surface: 'plugin-legacy',
            target: 'plugins-legacy/',
            reasons: ['jenn_agent_related_legacy_plugin_candidate']
        };
    }

    if (/Bridge$/i.test(pluginName)) {
        return {
            decision: 'deferred',
            surface: 'adapter',
            target: 'adapters/',
            reasons: ['bridge_plugin_needs_adapter_shim_review']
        };
    }

    return {
        decision: 'externalizable',
        surface: 'plugin-legacy',
        target: 'plugins-legacy/',
        reasons: ['selected_legacy_plugin_candidate_needs_review']
    };
}

function classifyPath(relativePath, entryType = 'file') {
    const normalized = toPosixPath(relativePath);
    const parts = splitPath(normalized);
    const first = parts[0] || '';

    if (!normalized) {
        return {
            decision: 'keep_core',
            surface: 'repository-root',
            target: null,
            reasons: ['repository_root']
        };
    }

    if (isRealEnvOrConfig(normalized)) {
        return {
            decision: 'blocked',
            surface: 'secret-config',
            target: null,
            reasons: ['real_env_or_config_file_never_move_automatically']
        };
    }

    if (SECRET_LIKE_RE.test(normalized) && !isEnvExample(normalized)) {
        return {
            decision: 'blocked',
            surface: 'secret-like-path',
            target: null,
            reasons: ['secret_like_path_needs_manual_review']
        };
    }

    if (KEY_MATERIAL_RE.test(normalized)) {
        return {
            decision: 'blocked',
            surface: 'key-material',
            target: null,
            reasons: ['key_material_path_needs_manual_review']
        };
    }

    if (RUNTIME_ROOTS.has(first)) {
        return {
            decision: 'blocked',
            surface: 'runtime-state',
            target: null,
            reasons: ['runtime_cache_state_log_image_or_operator_data']
        };
    }

    if (VECTOR_OR_DB_RE.test(normalized)) {
        return {
            decision: 'blocked',
            surface: 'private-store',
            target: null,
            reasons: ['sqlite_vector_or_private_store_never_move_automatically']
        };
    }

    if (first === 'VectorStore') {
        return {
            decision: 'blocked',
            surface: 'private-store',
            target: null,
            reasons: ['vector_store_never_move_automatically']
        };
    }

    if (first === '.agent_board') {
        return {
            decision: 'blocked',
            surface: 'protected-agent-board',
            target: null,
            reasons: ['protected_agent_board_never_move_automatically']
        };
    }

    if (REPO_METADATA_PATHS.has(normalized) || REPO_METADATA_ROOTS.has(first)) {
        return {
            decision: 'keep_core',
            surface: 'repo-metadata',
            target: null,
            reasons: ['repository_metadata_stays_core']
        };
    }

    if (LOCAL_CACHE_STATE_ROOTS.has(first)) {
        return {
            decision: 'blocked',
            surface: 'local-cache-state',
            target: null,
            reasons: ['local_cache_state_never_move_automatically']
        };
    }

    if (CORE_EXACT_PATHS.has(normalized)) {
        return {
            decision: 'keep_core',
            surface: 'adapter-core',
            target: null,
            reasons: ['p3_contract_keep_core']
        };
    }

    if (first === 'AdminPanel-Vue') {
        return {
            decision: 'keep_core',
            surface: 'admin-panel',
            target: null,
            reasons: ['adminpanel_extension_loader_deferred']
        };
    }

    if (MAINTENANCE_TOOLING_PATHS.has(normalized)) {
        return {
            decision: 'keep_core',
            surface: 'maintenance-tooling',
            target: null,
            reasons: ['root_maintenance_tooling_stays_core']
        };
    }

    if (RUNTIME_ENTRYPOINT_PATHS.has(normalized)) {
        return {
            decision: 'keep_core',
            surface: 'runtime-entrypoint',
            target: null,
            reasons: ['root_runtime_entrypoint_stays_core']
        };
    }

    if (REPO_BUILD_CONFIG_PATHS.has(normalized)) {
        return {
            decision: 'keep_core',
            surface: 'repo-build-config',
            target: null,
            reasons: ['repository_build_config_stays_core']
        };
    }

    if (first === 'ToolConfigs' || OPERATOR_CONFIG_PATHS.has(normalized)) {
        return {
            decision: 'deferred',
            surface: 'operator-config',
            target: null,
            reasons: ['operator_config_requires_separate_review']
        };
    }

    if (isRootDocumentationPath(normalized)) {
        return {
            decision: 'docs_only',
            surface: 'documentation',
            target: 'governance/',
            reasons: ['root_documentation_catalog_only']
        };
    }

    if (isExampleMediaPath(normalized)) {
        return {
            decision: 'deferred',
            surface: 'example-media',
            target: null,
            reasons: ['example_media_requires_asset_review']
        };
    }

    if (normalized === 'vcp-installer-一键安装脚本.exe') {
        return {
            decision: 'deferred',
            surface: 'installer-binary',
            target: null,
            reasons: ['installer_binary_requires_package_provenance_review']
        };
    }

    if (first === 'VCPTimedContacts') {
        return {
            decision: 'deferred',
            surface: 'contact-state',
            target: null,
            reasons: ['contact_state_requires_operator_data_review']
        };
    }

    if (first === 'rust-vexus-lite') {
        if (normalized === 'rust-vexus-lite/target' || normalized.startsWith('rust-vexus-lite/target/')) {
            return {
                decision: 'blocked',
                surface: 'generated-build-artifact',
                target: null,
                reasons: ['native_build_output_never_move_automatically']
            };
        }
        return {
            decision: 'deferred',
            surface: 'native-module-source',
            target: 'adapters/',
            reasons: ['native_module_source_requires_package_build_contract']
        };
    }

    if (first === 'Agent') {
        if (normalized === 'Agent/.gitignore') {
            return {
                decision: 'keep_core',
                surface: 'agent-governance',
                target: null,
                reasons: ['agent_directory_ignore_policy']
            };
        }
        return {
            decision: 'externalizable',
            surface: 'agent',
            target: 'agents/',
            reasons: ['jenn_agent_pack_candidate']
        };
    }

    if (first === 'dailynote') {
        return {
            decision: 'deferred',
            surface: 'memory',
            target: 'memory/',
            reasons: ['private_operator_adjacent_memory_content']
        };
    }

    if (first === 'Plugin') {
        return classifyPluginPath(parts, normalized);
    }

    if (first === 'plugins') {
        if (normalized.startsWith('plugins/custom/shared/photo_studio_data/')) {
            return {
                decision: 'deferred',
                surface: 'shared-state',
                target: 'shared/photo-studio-data/',
                reasons: ['photo_studio_shared_data_requires_state_policy']
            };
        }
        return {
            decision: 'deferred',
            surface: 'plugin-modern',
            target: 'plugins-modern/',
            reasons: ['external_modern_plugin_registry_deferred']
        };
    }

    if (first === 'modules') {
        if (normalized.startsWith('modules/photoStudio/')) {
            return {
                decision: 'deferred',
                surface: 'adapter',
                target: 'adapters/photography/',
                reasons: ['photo_studio_core_business_logic_split_required']
            };
        }
        if (normalized.startsWith('modules/channelHub/')) {
            return {
                decision: 'keep_core',
                surface: 'adapter-core',
                target: null,
                reasons: ['channelhub_contracts_remain_core_until_split']
            };
        }
        if (/^modules\/(codex|aiImage)/i.test(normalized)) {
            return {
                decision: 'deferred',
                surface: 'adapter',
                target: 'adapters/codex/',
                reasons: ['codex_or_ai_image_adapter_split_requires_shim']
            };
        }
        return {
            decision: 'keep_core',
            surface: 'runtime-support',
            target: null,
            reasons: ['runtime_module_stays_core_by_default']
        };
    }

    if (first === 'routes') {
        if (normalized.startsWith('routes/admin/plugins.js') || normalized.startsWith('routes/admin/pluginStore.js')) {
            return {
                decision: 'keep_core',
                surface: 'admin-adapter-core',
                target: null,
                reasons: ['p3_contract_keep_core']
            };
        }
        if (/^routes\/(codex|admin\/(codex|aiImage|agent))/i.test(normalized)) {
            return {
                decision: 'deferred',
                surface: 'admin-or-adapter-route',
                target: 'adapters/',
                reasons: ['admin_or_adapter_route_needs_separate_design']
            };
        }
        return {
            decision: 'keep_core',
            surface: 'runtime-support',
            target: null,
            reasons: ['server_route_stays_core_by_default']
        };
    }

    if (first === 'docs') {
        if (normalized.startsWith('docs/governance/')) {
            return {
                decision: 'docs_only',
                surface: 'governance',
                target: 'governance/',
                reasons: ['governance_receipt_or_design_doc']
            };
        }
        return {
            decision: 'docs_only',
            surface: 'documentation',
            target: 'governance/',
            reasons: ['documentation_requires_context_review']
        };
    }

    if (isEnvExample(normalized)) {
        return {
            decision: 'externalizable',
            surface: 'env-example',
            target: 'env-examples/',
            reasons: ['placeholder_env_example_requires_secret_pattern_review']
        };
    }

    if (first === 'tests') {
        return {
            decision: 'keep_core',
            surface: 'validation',
            target: null,
            reasons: ['repository_validation_stays_core']
        };
    }

    if (first === 'vcp-installer-source') {
        return {
            decision: 'deferred',
            surface: 'installer-source',
            target: 'adapters/installer/',
            reasons: ['installer_source_requires_packaging_review']
        };
    }

    if (first === 'scripts') {
        return {
            decision: 'keep_core',
            surface: 'tooling',
            target: null,
            reasons: ['repository_tooling_stays_core_by_default']
        };
    }

    if (first === 'VCPChrome') {
        return {
            decision: 'deferred',
            surface: 'client-subproject',
            target: 'adapters/vcpchrome/',
            reasons: ['browser_extension_packaging_requires_client_review']
        };
    }

    if (first === 'SillyTavernSub') {
        return {
            decision: 'deferred',
            surface: 'client-subproject',
            target: 'adapters/vcpchat/',
            reasons: ['sillytavern_integration_requires_adapter_packaging_review']
        };
    }

    if (first === 'OpenWebUISub') {
        return {
            decision: 'deferred',
            surface: 'client-subproject',
            target: 'adapters/openwebui/',
            reasons: ['openwebui_integration_requires_adapter_packaging_review']
        };
    }

    if (first === 'TVStxt') {
        return {
            decision: 'deferred',
            surface: 'operator-tool-prompts',
            target: 'capability-maps/',
            reasons: ['operator_tool_prompts_need_evidence_policy']
        };
    }

    return {
        decision: 'unknown',
        surface: entryType === 'directory' ? 'directory' : 'file',
        target: null,
        reasons: ['no_p3c_rule_matched']
    };
}

function shouldSkipDirectory(dirName, relativePath, options = {}) {
    const skipDirs = options.skipDirs || DEFAULT_SKIP_DIRS;
    if (skipDirs.has(dirName)) return true;
    const normalized = toPosixPath(relativePath);
    return normalized === 'AdminPanel-Vue/node_modules'
        || normalized.endsWith('/node_modules');
}

function normalizeMaxEntries(value) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 100000;
}

function walkPathOnly(rootDir, options = {}) {
    const root = path.resolve(rootDir || process.cwd());
    const maxEntries = normalizeMaxEntries(options.maxEntries);
    const includeDirectories = options.includeDirectories !== false;
    const records = [];
    let truncated = false;

    function visit(relativeDir) {
        if (records.length >= maxEntries) {
            truncated = true;
            return;
        }
        const absoluteDir = path.join(root, relativeDir);
        let entries = [];
        try {
            entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
        } catch (error) {
            records.push({
                path: toPosixPath(relativeDir || '.'),
                entryType: 'unreadable-directory',
                decision: 'blocked',
                surface: 'unreadable',
                target: null,
                reasons: ['directory_unreadable_path_only'],
                errorCode: error.code || 'UNKNOWN'
            });
            return;
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            if (records.length >= maxEntries) {
                truncated = true;
                break;
            }
            const relativePath = toPosixPath(path.join(relativeDir, entry.name));
            const entryType = entry.isDirectory()
                ? 'directory'
                : (entry.isSymbolicLink() ? 'symlink' : 'file');

            if (entryType === 'directory' && shouldSkipDirectory(entry.name, relativePath, options)) {
                continue;
            }

            if (includeDirectories || entryType !== 'directory') {
                records.push({
                    path: relativePath,
                    entryType,
                    ...classifyPath(relativePath, entryType)
                });
            }

            if (entryType === 'directory') {
                visit(relativePath);
            }
        }
    }

    visit('');
    Object.defineProperty(records, 'truncated', {
        value: truncated,
        enumerable: false
    });
    Object.defineProperty(records, 'limit', {
        value: maxEntries,
        enumerable: false
    });
    return records;
}

function summarizeRecords(records, options = {}) {
    const truncated = Boolean(options.truncated);
    const limit = normalizeMaxEntries(options.limit);
    const summary = {
        total: records.length,
        truncated,
        limit,
        byDecision: {},
        bySurface: {}
    };

    for (const record of records) {
        summary.byDecision[record.decision] = (summary.byDecision[record.decision] || 0) + 1;
        summary.bySurface[record.surface] = (summary.bySurface[record.surface] || 0) + 1;
    }

    return summary;
}

function buildInventory(rootDir, options = {}) {
    const records = walkPathOnly(rootDir, options);
    const truncated = Boolean(records.truncated);
    const limit = normalizeMaxEntries(records.limit);
    return {
        schemaVersion: 'p3c.path-only.inventory.v1',
        mode: 'path-only',
        rootLabel: options.rootLabel || '[repo]',
        generatedAt: options.generatedAt || new Date().toISOString(),
        truncated,
        limit,
        summary: summarizeRecords(records, { truncated, limit }),
        records
    };
}

class CliUsageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CliUsageError';
    }
}

function readOptionValue(argv, index, flagName) {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
        throw new CliUsageError(`${flagName} requires a value`);
    }
    return value;
}

function parsePositiveInteger(value, flagName) {
    if (!/^\d+$/.test(String(value))) {
        throw new CliUsageError(`${flagName} requires a positive integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new CliUsageError(`${flagName} requires a positive integer`);
    }
    return parsed;
}

function parseArgs(argv) {
    const args = {
        root: process.cwd(),
        summaryOnly: false,
        includeDirectories: true,
        maxEntries: 100000
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--root') {
            args.root = readOptionValue(argv, index, '--root');
            index += 1;
        } else if (arg === '--summary') {
            args.summaryOnly = true;
        } else if (arg === '--files-only') {
            args.includeDirectories = false;
        } else if (arg === '--max-entries') {
            args.maxEntries = parsePositiveInteger(readOptionValue(argv, index, '--max-entries'), '--max-entries');
            index += 1;
        } else {
            throw new CliUsageError(`unknown argument: ${arg}`);
        }
    }

    return args;
}

function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (error) {
        if (error instanceof CliUsageError) {
            process.stderr.write(`p3-external-ecosystem-inventory: ${error.message}\n`);
            process.exitCode = 2;
            return;
        }
        throw error;
    }

    const inventory = buildInventory(args.root, {
        includeDirectories: args.includeDirectories,
        maxEntries: args.maxEntries
    });

    const payload = args.summaryOnly
        ? {
            schemaVersion: inventory.schemaVersion,
            mode: inventory.mode,
            rootLabel: inventory.rootLabel,
            truncated: inventory.truncated,
            limit: inventory.limit,
            summary: inventory.summary
        }
        : inventory;

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (require.main === module) {
    main();
}

module.exports = {
    buildInventory,
    classifyPath,
    isEnvExample,
    isRealEnvOrConfig,
    parseArgs,
    summarizeRecords,
    toPosixPath,
    walkPathOnly
};
