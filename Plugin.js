// Plugin.js
const fs = require('fs').promises;
const EventEmitter = require('events');
const path = require('path');
const { spawn } = require('child_process');
const schedule = require('node-schedule');
const dotenv = require('dotenv'); // Ensures dotenv is available
const FileFetcherServer = require('./FileFetcherServer.js');
const express = require('express'); // For plugin API routing
const chokidar = require('chokidar');
const { getAuthCode } = require('./modules/captchaDecoder'); // 导入统一的解码函数
const ToolApprovalManager = require('./modules/toolApprovalManager');
const { authority: approvalReceiptAuthority } = require('./modules/approvalReceiptAuthority');
const { ApprovalProtocol } = require('./modules/approvalProtocol');
const { hasFoldMarkers, buildDynamicFoldObject } = require('./modules/foldProtocol');
const { sanitizeToolResult } = require('./modules/toolResultPrivacyGuard');
const toolCallRecordStore = require('./modules/toolCallRecordStore');
const {
    createPluginRootResolver,
    discoverLegacyManifestRecordsFromRoot
} = require('./modules/pluginRootResolver');
const { classifyExternalPluginManifest } = require('./modules/externalPluginSafetyGate');
const {
    evaluateExternalPluginAllowPolicy
} = require('./modules/externalPluginAllowPolicy');
const {
    buildExternalPluginRuntimeEnv,
    isPluginRuntimeEnvKeyDenied
} = require('./modules/pluginRuntimeEnvSandbox');
const {
    resolvePythonExecutable,
    resolvePluginCommand,
    validatePythonPlugins
} = require('./modules/pythonRuntime');
const { createDirectPluginRuntime } = require('./modules/directPluginRuntime');
const {
    getCallbackCompatibilityMetrics: getCallbackSecurityMetrics
} = require('./modules/asyncCallbackSecurity');
const { createPreprocessorControlContext } = require('./modules/preprocessorControlContext');

const PLUGIN_DIR = path.join(__dirname, 'Plugin');
const manifestFileName = 'plugin-manifest.json';
const EXTERNAL_LEGACY_PLUGIN_DIRS_ENV = 'VCP_PLUGIN_DIRS';
const EXTERNAL_PLUGIN_ALLOWLIST_ENV = 'VCP_EXTERNAL_PLUGIN_ALLOWLIST';
const PREPROCESSOR_ORDER_FILE = path.join(__dirname, 'preprocessor_order.json');
const PREPROCESSOR_ORDER_EXAMPLE_FILE = path.join(__dirname, 'preprocessor_order.example.json');
const SSH_MANAGER_ENV_PLUGIN_ALLOWLIST = new Set([
    'LinuxShellExecutor',
    'LinuxLogMonitor'
]);
const LOG_MONITOR_ENV_PLUGIN_ALLOWLIST = new Set([
    'LinuxLogMonitor'
]);
const EMBEDDED_FILE_URL_REGEX = /file:\/\/[^\s"'()\]\}\>，。？！）\r\n]+/g;
const PLUGIN_NAME_ALIASES = new Map([
    ['FileOperator', 'ServerFileOperator']
]);

const PLUGIN_DIAGNOSTIC_SECRET_PATTERNS = [
    /((?:api[_-]?key|apikey|token|secret|password|passwd|pwd|authorization|bearer|cookie|session|credential|private[_-]?key)\s*[:=]\s*)[^\s"',;}\]]+/gi,
    /\b(?:sk|ghp|github_pat|xox[baprs]|ya29)\b[-_A-Za-z0-9]{12,}/gi,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi
];

function scrubPluginDiagnosticText(value) {
    if (value === undefined || value === null) {
        return '';
    }

    let text = String(value);
    for (const pattern of PLUGIN_DIAGNOSTIC_SECRET_PATTERNS) {
        text = text.replace(pattern, (match, prefix) => (
            prefix ? `${prefix}[redacted]` : '[redacted]'
        ));
    }
    text = text.replace(/\b[A-Za-z]:\\[^\s"',;}\]]+/g, '[path]');
    text = text.replace(/(^|[\s"'(])\/(?:Users|home|var|tmp|etc|opt|srv|mnt)\/[^\s"',;}\]]+/g, '$1[path]');
    text = text.replace(/\\\\[^\\\s"',;}\]]+(?:\\[^\s"',;}\]]+)+/g, '[path]');
    return text;
}

function scrubPluginDiagnosticSnippet(value, maxLength) {
    return scrubPluginDiagnosticText(value).substring(0, maxLength);
}

function formatRuntimeEnvDebugKeyList(env = {}) {
    const keys = Object.keys(env || {});
    const visibleKeys = keys
        .filter(key => !isPluginRuntimeEnvKeyDenied(key))
        .sort();
    const redactedCount = keys.length - visibleKeys.length;
    const suffix = redactedCount > 0 ? ` (redacted ${redactedCount} sensitive keys)` : '';
    return `${visibleKeys.join(',')}${suffix}`;
}

function getFormattedLocalTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    const timezoneOffsetMinutes = date.getTimezoneOffset();
    const offsetSign = timezoneOffsetMinutes > 0 ? '-' : '+';
    const offsetHours = Math.abs(Math.floor(timezoneOffsetMinutes / 60)).toString().padStart(2, '0');
    const offsetMinutes = Math.abs(timezoneOffsetMinutes % 60).toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

function getCaseInsensitiveToolArg(toolArgs, ...candidateNames) {
    if (!toolArgs || typeof toolArgs !== 'object' || Array.isArray(toolArgs)) {
        return undefined;
    }

    for (const name of candidateNames) {
        if (Object.prototype.hasOwnProperty.call(toolArgs, name) && toolArgs[name] !== undefined) {
            return toolArgs[name];
        }
    }

    const normalizedNames = candidateNames.map(name => String(name).toLowerCase());
    for (const [key, value] of Object.entries(toolArgs)) {
        if (value !== undefined && normalizedNames.includes(key.toLowerCase())) {
            return value;
        }
    }

    return undefined;
}

function buildToolChangePreview(toolArgs) {
    // 新字段优先；旧字段及任意键名大小写均兼容，让旧 Agent 提示词也能获得审核 diff。
    const target = getCaseInsensitiveToolArg(toolArgs, 'target', 'searchString');
    const replace = getCaseInsensitiveToolArg(toolArgs, 'replace', 'replaceString');

    if (typeof target !== 'string' || typeof replace !== 'string') {
        return null;
    }

    return { target, replace };
}

function filterFuzzyDiff(resultObj, timestamp) {
    if (
        resultObj &&
        typeof resultObj === 'object' &&
        resultObj.fuzzyDiff &&
        typeof resultObj.fuzzyDiff === 'object'
    ) {
        const { candidateFile, diff } = resultObj.fuzzyDiff;
        resultObj.fuzzyDiff = { candidateFile, diff, timestamp };
    }
}

async function resolveArgsFileUrls(obj, requestIp, debugMode = false) {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value === 'string') {
            if (value.startsWith('file://')) {
                if (debugMode) console.log(`[PluginManager] Intercepted file URL in args: ${value}`);
                obj[key] = await FileFetcherServer.resolveFileUrl(value, requestIp);
            } else if (value.includes('file://')) {
                const matches = value.match(EMBEDDED_FILE_URL_REGEX);
                if (!matches) continue;

                let resolvedValue = value;
                for (const matchUrl of matches) {
                    if (debugMode) console.log(`[PluginManager] Intercepted embedded file URL in args: ${matchUrl}`);
                    const resolvedUrl = await FileFetcherServer.resolveFileUrl(matchUrl, requestIp);
                    resolvedValue = resolvedValue.split(matchUrl).join(resolvedUrl);
                }
                obj[key] = resolvedValue;
            }
        } else if (value && typeof value === 'object') {
            await resolveArgsFileUrls(value, requestIp, debugMode);
        }
    }
}

async function atomicWriteFilePreservingMode(filePath, content, defaultMode = 0o600) {
    const mode = await fs.stat(filePath)
        .then(stat => stat.mode & 0o777)
        .catch(error => {
            if (error.code === 'ENOENT') return defaultMode;
            throw error;
        });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    let handle;
    try {
        handle = await fs.open(tempPath, 'wx', mode);
        await handle.writeFile(content, 'utf8');
        await handle.sync();
        await handle.close();
        handle = null;
        await fs.rename(tempPath, filePath);
    } finally {
        if (handle) await handle.close().catch(() => {});
        await fs.unlink(tempPath).catch(() => {});
    }
}

class PluginManager extends EventEmitter {
    constructor() {
        super();
        this.plugins = new Map(); // 存储所有插件（本地和分布式）
        this.staticPlaceholderValues = new Map();
        this.scheduledJobs = new Map();
        this.messagePreprocessors = new Map();
        this.preprocessorOrder = []; // 新增：用于存储预处理器的最终加载顺序
        this.serviceModules = new Map();
        this.projectBasePath = null;
        this.individualPluginDescriptions = new Map(); // New map for individual descriptions
        this.debugMode = (process.env.DebugMode || "False").toLowerCase() === "true";
        this.webSocketServer = null; // 为 WebSocketServer 实例占位
        this.isReloading = false;
        this.reloadTimeout = null;
        this.reloadPending = false;
        this.reloadChangedPaths = new Set();
        this.pluginWatcher = null;
        this.pluginLoadPromise = null;
        this.pluginLoadRequested = false;
        this.staticPluginsInitialized = false;
        this.staticPluginSignatures = new Map();
        this.staticPluginPlaceholderKeys = new Map();
        this.vectorDBManager = null; // 修复：不再自己创建，等待注入
        this.tdbKnowledgeManager = null; // 冷知识库管理器，等待 server.js 注入
        this.toolApprovalManager = new ToolApprovalManager(path.join(__dirname, 'toolApprovalConfig.json'));
        this.approvalProtocol = new ApprovalProtocol({
            authority: approvalReceiptAuthority,
            onTerminal: terminal => {
                try { this.webSocketServer?.cancelVcpLogApprovalCache?.(terminal.requestId); }
                finally { this.webSocketServer?.broadcastApprovalTerminal?.(terminal); }
            },
            onDeliveryError: code => console.warn(`[PluginManager] ${code}`)
        });
        this.pluginRootResolver = createPluginRootResolver({
            projectRoot: __dirname,
            env: process.env
        });
        this.lastPluginRootSnapshot = null;
        this.pythonExecutable = resolvePythonExecutable({ projectRoot: __dirname });
        this.pythonRuntimeStatus = new Map();
        this.runtimeV2Enabled = String(process.env.VCP_PLUGIN_RUNTIME_V2 || 'true').toLowerCase() !== 'false';
        this.runtimeGenerationSequence = 0;
        this.currentGeneration = null;
        this.directAdmissions = new Map();
        this.directPluginCatalog = null;
        this.runtimeState = 'STARTING';
        this.lastReloadResult = null;
        this.reloadPromise = null;
        this.pluginWatcher = null;
        this.serviceDispatchersMounted = false;
        this.serviceHost = null;
        this.activePluginRequests = new Map();
        this.watcherSuppressions = new Map();
        this.pluginCircuitBreakers = new Map();
    }

    _sanitizeToolResultForAi(result) {
        try {
            const privacyConfig = this.toolApprovalManager?.getPrivacyProtectionConfig
                ? this.toolApprovalManager.getPrivacyProtectionConfig()
                : { enabled: false };
            return sanitizeToolResult(result, privacyConfig);
        } catch (error) {
            console.error(`[PluginManager] Tool result privacy protection failed, returning original result to avoid breaking tool flow: ${error.message}`);
            return result;
        }
    }

    _resolvePluginName(name) {
        if (this.plugins.has(name)) {
            return { name, requestedName: name, isAlias: false };
        }

        const aliasTarget = PLUGIN_NAME_ALIASES.get(name);
        if (aliasTarget && this.plugins.has(aliasTarget)) {
            return { name: aliasTarget, requestedName: name, isAlias: true };
        }

        return { name, requestedName: name, isAlias: false };
    }

    setWebSocketServer(wss) {
        this.webSocketServer = wss;
        if (this.debugMode) console.log('[PluginManager] WebSocketServer instance has been set.');
    }

    setVectorDBManager(vdbManager) {
        this.vectorDBManager = vdbManager;
        if (this.debugMode) console.log('[PluginManager] VectorDBManager instance has been set.');
    }

    setTdbKnowledgeManager(tdbManager) {
        this.tdbKnowledgeManager = tdbManager;
        if (this.debugMode) console.log('[PluginManager] TDBKnowledgeManager instance has been set.');
    }

    async _getDecryptedAuthCode() {
        try {
            const authCodePath = path.join(__dirname, 'Plugin', 'UserAuth', 'code.bin');
            // 使用正确的 getAuthCode 函数，并传递文件路径
            return await getAuthCode(authCodePath);
        } catch (error) {
            if (this.debugMode) {
                console.error('[PluginManager] Failed to read or decrypt auth code for plugin execution:', error.message);
            }
            return null; // Return null if code cannot be obtained
        }
    }

    setProjectBasePath(basePath) {
        this.projectBasePath = basePath;
        if (this.debugMode) console.log(`[PluginManager] Project base path set to: ${this.projectBasePath}`);
    }

    _getPluginConfig(pluginManifest) {
        const config = {};
        const globalEnv = process.env;
        const pluginSpecificEnv = pluginManifest.pluginSpecificEnvConfig || {};

        if (pluginManifest.configSchema) {
            for (const key in pluginManifest.configSchema) {
                const schemaEntry = pluginManifest.configSchema[key];
                // 兼容两种格式：对象格式 { type: "string", ... } 和简单字符串格式 "string"
                const expectedType = (typeof schemaEntry === 'object' && schemaEntry !== null)
                    ? schemaEntry.type
                    : schemaEntry;
                let rawValue;

                if (pluginSpecificEnv.hasOwnProperty(key)) {
                    rawValue = pluginSpecificEnv[key];
                } else if (globalEnv.hasOwnProperty(key)) {
                    rawValue = globalEnv[key];
                } else {
                    continue;
                }

                let value = rawValue;
                if (expectedType === 'integer') {
                    value = parseInt(value, 10);
                    if (isNaN(value)) {
                        if (this.debugMode) console.warn(`[PluginManager] Config key '${key}' for ${pluginManifest.name} expected integer, got NaN from raw value '${rawValue}'. Using undefined.`);
                        value = undefined;
                    }
                } else if (expectedType === 'boolean') {
                    value = String(value).toLowerCase() === 'true';
                }
                config[key] = value;
            }
        }

        if (pluginSpecificEnv.hasOwnProperty('DebugMode')) {
            config.DebugMode = String(pluginSpecificEnv.DebugMode).toLowerCase() === 'true';
        } else if (globalEnv.hasOwnProperty('DebugMode')) {
            config.DebugMode = String(globalEnv.DebugMode).toLowerCase() === 'true';
        } else if (!config.hasOwnProperty('DebugMode')) {
            config.DebugMode = false;
        }
        return config;
    }

    getResolvedPluginConfigValue(pluginName, configKey) {
        const pluginManifest = this.plugins.get(pluginName);
        if (!pluginManifest) {
            return undefined;
        }
        const effectiveConfig = this._getPluginConfig(pluginManifest);
        return effectiveConfig ? effectiveConfig[configKey] : undefined;
    }

    _shouldInjectSSHManagerEnv(pluginName) {
        return SSH_MANAGER_ENV_PLUGIN_ALLOWLIST.has(pluginName);
    }

    _shouldInjectLogMonitorEnv(pluginName) {
        return LOG_MONITOR_ENV_PLUGIN_ALLOWLIST.has(pluginName);
    }

    _isLinuxShellExecutorLocalUserCommand(plugin, inputData) {
        if (!plugin || !inputData) return false;

        let args;
        try {
            args = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
        } catch (e) {
            return false;
        }

        if (!args || typeof args !== 'object' || !args.command) {
            return false;
        }

        const hostId = args.hostId;
        if (!hostId) {
            return true;
        }

        try {
            const hostsPath = path.join(plugin.basePath, 'hosts.json');
            delete require.cache[require.resolve(hostsPath)];
            const hostsConfig = require(hostsPath);
            const hostConfig = hostsConfig.hosts?.[hostId];
            return hostConfig ? hostConfig.type !== 'ssh' : hostId === 'local';
        } catch (e) {
            return hostId === 'local';
        }
    }

    _shouldInjectSSHManagerEnvForExecution(pluginName, plugin, inputData) {
        if (!this._shouldInjectSSHManagerEnv(pluginName)) {
            return false;
        }
        if (
            pluginName === 'LinuxShellExecutor' &&
            this._isLinuxShellExecutorLocalUserCommand(plugin, inputData)
        ) {
            return false;
        }
        return true;
    }

    _isExternalPluginManifest(plugin) {
        return plugin?.pluginSource === 'external';
    }

    _spawnPluginProcess(command, args, options) {
        return spawn(command, args, options);
    }

    _resolvePluginEntryCommand(plugin) {
        return resolvePluginCommand(plugin, this.pythonExecutable);
    }

    getPythonRuntimeStatus() {
        return new Map(this.pythonRuntimeStatus);
    }

    isPluginRuntimeConfigKey(key) {
        if (typeof key !== 'string' || !key) return false;
        for (const manifest of this.plugins.values()) {
            if (
                !manifest?.isDistributed
                && manifest.configSchema
                && Object.prototype.hasOwnProperty.call(manifest.configSchema, key)
            ) {
                return true;
            }
        }
        return false;
    }

    getRuntimeStatus() {
        const generation = this.currentGeneration;
        return {
            enabled: this.runtimeV2Enabled,
            generation: generation?.id || null,
            state: this.runtimeState,
            generationState: generation?.state || null,
            activeRequests: generation?.activeRequests || 0,
            activeByPlugin: generation
                ? Object.fromEntries(generation.activeByPlugin)
                : {},
            createdAt: generation?.createdAt || null,
            startedAt: generation?.startedAt || null,
            lastReload: this.lastReloadResult,
            callbackCompatibility: getCallbackSecurityMetrics(),
            circuitBreakers: Object.fromEntries(
                Array.from(this.pluginCircuitBreakers.entries()).map(([name, state]) => [
                    name,
                    {
                        failures: state.failures,
                        openUntil: state.openUntil || null,
                        lastError: state.lastError || null
                    }
                ])
            )
        };
    }

    _emitRuntimeState(details = {}) {
        this.emit('runtime_state_changed', {
            state: this.runtimeState,
            generation: this.currentGeneration?.id || null,
            generationState: this.currentGeneration?.state || null,
            lastReload: this.lastReloadResult,
            ...details
        });
    }

    async getDetailedRuntimeStatus() {
        const base = this.getRuntimeStatus();
        const plugins = [];
        if (this.currentGeneration) {
            for (const [name, runtime] of this.currentGeneration.runtimes) {
                let health;
                let blockers = [];
                try {
                    health = await this._withTimeout(runtime.health(), 2000, `Plugin ${name} health`);
                } catch (error) {
                    health = { status: 'failed', error: error.message };
                }
                try {
                    blockers = await this._withTimeout(
                        runtime.getReloadBlockers(),
                        2000,
                        `Plugin ${name} reload blocker check`
                    );
                } catch (error) {
                    blockers = [{ type: 'health_check_failed', message: error.message }];
                }
                const observedRuntime = this.currentGeneration?.runtimes.get(name);
                if (observedRuntime !== runtime) {
                    health = { status: 'changed_during_observation' };
                    blockers = [];
                }
                plugins.push({
                    name,
                    availability: this.plugins.get(name)?.runtimeAvailability || 'available',
                    health,
                    blockers,
                    state: observedRuntime?.started ? 'active' : 'stopped',
                    loaded_identity: observedRuntime?.loadedIdentity || null,
                    admission_locked: this.directAdmissions?.get(name)?.locked || false,
                    inflight_calls: this.currentGeneration.activeByPlugin.get(name) || 0,
                    activeRequests: this.currentGeneration.activeByPlugin.get(name) || 0
                });
            }
        }
        return {
            ...base,
            plugins,
            admissions: Array.from(this.directAdmissions?.entries() || [], ([name, record]) => ({
                name, state: record.state, admission_locked: record.locked,
                candidate_identity: record.candidate?.loadedIdentity || null,
                previous_identity: record.previous?.loadedIdentity || null,
                cleanup_error: record.cleanupError || null
            })),
            python: Array.from(this.pythonRuntimeStatus.values())
        };
    }

    _buildPluginProcessEnv(plugin, pluginConfig = {}, additionalEnv = {}) {
        if (this._isExternalPluginManifest(plugin)) {
            return buildExternalPluginRuntimeEnv(process.env, pluginConfig, additionalEnv);
        }

        return {
            ...process.env,
            ...Object.fromEntries(
                Object.entries(pluginConfig || {})
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => [key, String(value)])
            ),
            ...additionalEnv
        };
    }

    async _loadPluginEnvConfig(pluginPath, pluginName) {
        try {
            const pluginEnvContent = await fs.readFile(path.join(pluginPath, 'config.env'), 'utf-8');
            return dotenv.parse(pluginEnvContent);
        } catch (envError) {
            if (envError.code !== 'ENOENT') {
                console.warn(`[PluginManager] Error reading config.env for ${pluginName}:`, scrubPluginDiagnosticText(envError.message));
            }
            return {};
        }
    }

    _parseExternalLegacyPluginDirs(rawValue) {
        if (!rawValue || typeof rawValue !== 'string') {
            return [];
        }

        const hasWindowsDrivePrefix = /^[A-Za-z]:[\\/]/.test(rawValue);
        const primarySeparator = rawValue.includes(';') ? ';' : (hasWindowsDrivePrefix ? null : ':');
        const rawParts = primarySeparator ? rawValue.split(primarySeparator) : [rawValue];
        const seen = new Set();
        const dirs = [];

        for (const rawPart of rawParts) {
            const trimmed = rawPart.trim();
            if (!trimmed) continue;

            const resolved = path.resolve(__dirname, trimmed);
            const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
            if (seen.has(key)) continue;
            seen.add(key);
            dirs.push(resolved);
        }

        return dirs;
    }

    _getExternalLegacyPluginDirs() {
        return this._parseExternalLegacyPluginDirs(process.env[EXTERNAL_LEGACY_PLUGIN_DIRS_ENV]);
    }

    _formatPluginRootForLog(rootInfo, fallbackLabel = 'plugin-root') {
        if (!rootInfo || typeof rootInfo !== 'object') return fallbackLabel;
        const rootId = rootInfo.rootId || fallbackLabel;
        const displayPath = rootInfo.displayPath || rootInfo.root || null;
        return displayPath ? `${rootId}(${displayPath})` : rootId;
    }

    _formatPluginRootDiagnosticForLog(item) {
        if (!item || typeof item !== 'object') return 'plugin-root';
        return this._formatPluginRootForLog(
            { rootId: item.rootId || item.code || 'plugin-root', displayPath: item.root || null },
            item.code || 'plugin-root'
        );
    }

    _formatPluginErrorForLog(error) {
        if (!error || typeof error !== 'object') return 'UNKNOWN_ERROR';
        return error.code || error.name || 'UNKNOWN_ERROR';
    }

    getPluginRootSnapshot() {
        return this.lastPluginRootSnapshot || this.pluginRootResolver.getPluginRootSnapshotSync();
    }

    _getPluginRootInfosForLog(snapshot = null) {
        const rootSnapshot = snapshot || this.getPluginRootSnapshot();
        return [
            rootSnapshot.coreLegacyRoot,
            rootSnapshot.coreModernRoot,
            ...(rootSnapshot.externalLegacyRoots || [])
        ].filter(Boolean);
    }

    _isPathInsideRoot(candidatePath, rootPath) {
        const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
        return !relative.startsWith('..') && !path.isAbsolute(relative);
    }

    _formatPluginEventPathForLog(filePath) {
        if (!filePath || typeof filePath !== 'string') return 'unknown';
        const rootInfos = this._getPluginRootInfosForLog()
            .filter(rootInfo => rootInfo.rootPath)
            .sort((a, b) => b.rootPath.length - a.rootPath.length);

        for (const rootInfo of rootInfos) {
            if (this._isPathInsideRoot(filePath, rootInfo.rootPath)) {
                const relative = path.relative(rootInfo.rootPath, filePath).replace(/\\/g, '/');
                return `${this._formatPluginRootForLog(rootInfo)}/${relative || path.basename(filePath)}`;
            }
        }

        return path.basename(filePath);
    }

    _getExternalPluginRuntimeAllowPolicy() {
        return process.env[EXTERNAL_PLUGIN_ALLOWLIST_ENV] || '';
    }

    _getExternalRegistrationReasonCode(policyDecision, classification) {
        const reasons = [
            ...(classification?.reasons || []),
            ...(policyDecision?.reasons || [])
        ].join('\n');

        if (classification?.duplicateOfBuiltIn) return 'external_runtime_duplicate_core_name';
        if (/missing a concrete plugin name|missing a plugin name/i.test(reasons)) return 'external_runtime_missing_name';
        if (/missing a base path/i.test(reasons)) return 'external_runtime_missing_base_path';
        if (/invalid entries|wildcard allowlist|name-only allowlist|path-only/i.test(reasons)) return 'external_runtime_invalid_policy';
        if (/source directory did not match/i.test(reasons)) return 'external_runtime_source_mismatch';
        if (/requires explicit name and source directory allow policy/i.test(reasons)) return 'external_runtime_allowlist_required';
        if (/entrypoint is missing or unsupported/i.test(reasons)) return 'external_runtime_unsupported_entrypoint';
        return 'external_runtime_registration_blocked';
    }

    _sanitizeExternalRootIdForLog(rootId) {
        if (typeof rootId !== 'string') return 'external:unknown';

        const trimmed = rootId.trim();
        if (!trimmed.startsWith('external:')) return 'external:unknown';

        const value = trimmed.slice('external:'.length).trim();
        if (!value) return 'external:unknown';

        if (
            value.includes('/') ||
            value.includes('\\') ||
            path.isAbsolute(value) ||
            path.win32.isAbsolute(value)
        ) {
            return 'external:path';
        }

        if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
            return 'external:opaque';
        }

        return `external:${value}`;
    }

    _sanitizeExternalRuntimeRootId(rootId) {
        return this._sanitizeExternalRootIdForLog(rootId);
    }

    _sanitizeExternalRuntimeDisplayPath(displayPath) {
        if (typeof displayPath === 'string' && displayPath.startsWith('[external]')) {
            return displayPath;
        }
        return '[external]';
    }

    _isExternalDirectOrHybridSameProcess(manifest) {
        if (!this._isExternalPluginManifest(manifest)) {
            return false;
        }
        const protocol = manifest?.communication?.protocol;
        return protocol === 'direct' && typeof manifest.entryPoint?.script === 'string' && manifest.entryPoint.script.trim();
    }

    _getExternalDirectRuntimeBlockReason(manifest) {
        if (manifest?.requiresAdmin === true) {
            return 'external_direct_requires_admin_denied';
        }

        if (manifest?.pluginType === 'hybridservice') {
            return 'external_hybrid_runtime_denied';
        }

        return 'external_direct_runtime_denied';
    }

    _evaluateExternalPluginRuntimeRegistration(manifest) {
        if (!this._isExternalPluginManifest(manifest)) {
            return {
                allowed: true,
                decision: 'observe',
                pluginName: manifest?.name || 'unknown',
                pluginSource: manifest?.pluginSource || 'core'
            };
        }

        const classification = classifyExternalPluginManifest(manifest, {
            projectRoot: __dirname,
            isExternal: true,
            builtInPluginNames: Array.from(this.plugins.keys())
        });

        if (this._isExternalDirectOrHybridSameProcess(manifest)) {
            return {
                allowed: false,
                decision: 'blocked',
                code: this._getExternalDirectRuntimeBlockReason(manifest),
                pluginName: classification.pluginName,
                pluginSource: 'external',
                pluginRootId: this._sanitizeExternalRuntimeRootId(manifest.pluginRootId),
                pluginRootDisplayPath: this._sanitizeExternalRuntimeDisplayPath(manifest.pluginRootDisplayPath),
                risk: classification.risk,
                entryPointKind: classification.entryPointKind
            };
        }

        const policyDecision = evaluateExternalPluginAllowPolicy(
            classification,
            this._getExternalPluginRuntimeAllowPolicy(),
            { projectRoot: __dirname }
        );
        const duplicateExisting = Boolean(manifest.name && this.plugins.has(manifest.name));
        const allowed = policyDecision.decision === 'would_allow'
            && classification.duplicateOfBuiltIn !== true
            && duplicateExisting !== true;

        return {
            allowed,
            decision: allowed ? 'allowed' : 'blocked',
            code: allowed
                ? 'external_runtime_registration_allowed'
                : this._getExternalRegistrationReasonCode(policyDecision, {
                    ...classification,
                    duplicateOfBuiltIn: classification.duplicateOfBuiltIn || duplicateExisting
                }),
            pluginName: classification.pluginName,
            pluginSource: 'external',
            pluginRootId: this._sanitizeExternalRuntimeRootId(manifest.pluginRootId),
            pluginRootDisplayPath: this._sanitizeExternalRuntimeDisplayPath(manifest.pluginRootDisplayPath),
            risk: classification.risk,
            entryPointKind: classification.entryPointKind
        };
    }

    _warnExternalPluginRegistrationBlocked(decision) {
        const pluginName = decision?.pluginName || 'unknown';
        const rootId = decision?.pluginRootId || 'external:unknown';
        const rootLabel = decision?.pluginRootDisplayPath || '[external]';
        const code = decision?.code || 'external_runtime_registration_blocked';
        console.warn(`[PluginManager] Skipped external plugin runtime registration: ${pluginName} (${rootId}, ${rootLabel}) ${code}`);
    }

    _sanitizeRuntimeDuplicateSource(source) {
        if (source === 'external') return 'external';
        if (source === 'distributed') return 'distributed';
        return 'core';
    }

    _sanitizeRuntimeDuplicateRootId(source, rootId) {
        const safeSource = this._sanitizeRuntimeDuplicateSource(source);
        if (typeof rootId !== 'string' || !rootId.trim()) {
            return safeSource === 'external' ? 'external:unknown' : `${safeSource}:unknown`;
        }
        if (rootId.startsWith('external:')) return this._sanitizeExternalRootIdForLog(rootId);
        if (rootId.startsWith('core:')) return rootId;
        if (rootId.startsWith('distributed:')) return rootId;
        return `${safeSource}:unknown`;
    }

    _buildRuntimeDuplicateDescriptor(manifest) {
        const source = this._sanitizeRuntimeDuplicateSource(
            manifest?.pluginSource || (manifest?.isDistributed ? 'distributed' : 'core')
        );
        return {
            source,
            rootId: this._sanitizeRuntimeDuplicateRootId(source, manifest?.pluginRootId)
        };
    }

    _warnDuplicateLocalPluginSkipped(skippedManifest, existingManifest = null) {
        const pluginName = skippedManifest?.name || 'unknown';
        const skipped = this._buildRuntimeDuplicateDescriptor(skippedManifest);
        const existing = this._buildRuntimeDuplicateDescriptor(existingManifest);
        console.warn(
            `[PluginManager] Skipped duplicate local plugin manifest: ${pluginName} ` +
            `(existing ${existing.source}/${existing.rootId}, skipped ${skipped.source}/${skipped.rootId}) duplicate_plugin_name`
        );
    }

    async _discoverLegacyPluginManifestsFromDir(pluginRoot, sourceLabel = 'core', rootInfo = null) {
        const effectiveRootInfo = rootInfo || {
            rootId: sourceLabel === 'external' ? 'external:manual' : 'core:legacy',
            source: sourceLabel,
            rootPath: pluginRoot,
            displayPath: sourceLabel === 'external' ? '[external]' : 'Plugin',
            allowConfigEnv: sourceLabel !== 'external',
            enabled: true
        };
        const result = await discoverLegacyManifestRecordsFromRoot(effectiveRootInfo);

        if (result.diagnostics?.length && this.debugMode) {
            result.diagnostics.forEach(item => {
                const rootLabel = this._formatPluginRootDiagnosticForLog(item);
                console.warn(`[PluginManager] Plugin manifest diagnostic: ${item.code} ${rootLabel}`.trim());
            });
        }

        const manifests = [];
        for (const record of result.records || []) {
            if (!record.enabled) continue;

            try {
                await fs.access(path.join(record.pluginPath, '.disabled'));
                continue;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    continue;
                }
            }

            const manifest = record.manifest;
            if (!manifest.name || !manifest.pluginType || !manifest.entryPoint) continue;

            manifest.basePath = record.pluginPath;
            manifest.pluginSource = record.source;
            manifest.pluginRoot = record.rootPath;
            manifest.pluginRootId = record.rootId;
            manifest.pluginRootDisplayPath = record.rootDisplayPath;
            manifest.pluginSpecificEnvConfig = record.allowConfigEnv === false
                ? {}
                : await this._loadPluginEnvConfig(record.pluginPath, manifest.name);
            manifests.push(manifest);
        }

        return manifests;
    }

    async _discoverLegacyPluginManifests() {
        const rootSnapshot = await this.pluginRootResolver.getPluginRootSnapshot();
        this.lastPluginRootSnapshot = rootSnapshot;

        if (rootSnapshot.diagnostics?.length && this.debugMode) {
            rootSnapshot.diagnostics.forEach(item => {
                const rootLabel = this._formatPluginRootDiagnosticForLog(item);
                console.warn(`[PluginManager] Plugin root diagnostic: ${item.code} ${rootLabel} ${item.message || ''}`.trim());
            });
        }

        const manifests = [];
        for (const rootInfo of rootSnapshot.legacyLoadRoots) {
            const rootManifests = await this._discoverLegacyPluginManifestsFromDir(
                rootInfo.rootPath,
                rootInfo.source,
                rootInfo
            );
            manifests.push(...rootManifests);
        }
        return manifests;
    }

    async _registerLocalPlugin(manifest, discoveredPreprocessors, modulesToInitialize) {
        const registrationDecision = this._evaluateExternalPluginRuntimeRegistration(manifest);
        if (!registrationDecision.allowed) {
            this._warnExternalPluginRegistrationBlocked(registrationDecision);
            return false;
        }

        this.plugins.set(manifest.name, manifest);
        console.log(`[PluginManager] Loaded manifest: ${manifest.displayName} (${manifest.name}, Type: ${manifest.pluginType})`);

        const isPreprocessor = manifest.pluginType === 'messagePreprocessor' || manifest.pluginType === 'hybridservice';
        const isService = manifest.pluginType === 'service' || manifest.pluginType === 'hybridservice';

        if ((isPreprocessor || isService) && manifest.entryPoint.script && manifest.communication?.protocol === 'direct') {
            try {
                const scriptPath = path.join(manifest.basePath, manifest.entryPoint.script);
                const module = require(scriptPath);

                modulesToInitialize.push({ manifest, module });

                if (isPreprocessor && typeof module.processMessages === 'function') {
                    discoveredPreprocessors.set(manifest.name, module);
                }
                if (isService) {
                    this.serviceModules.set(manifest.name, { manifest, module });
                }
            } catch (error) {
                console.error(`[PluginManager] Error loading module for ${manifest.name}:`, scrubPluginDiagnosticText(error.message));
            }
        }

        return true;
    }

    /**
     * 跨平台进程树终止方法。
     * Windows 上 shell:true 会创建 cmd.exe 包装进程，直接 kill 只杀 cmd 不杀子进程，
     * 导致孤儿进程。此方法使用 taskkill /T /F 递归杀死整个进程树。
     * Linux/macOS 上使用负 PID 发送信号给进程组，或回退到普通 SIGKILL。
     */
    _killProcessTree(pid, pluginName) {
        if (!pid) return;
        try {
            if (process.platform === 'win32') {
                // Windows: taskkill /T (tree kill) /F (force) /PID
                spawn('taskkill', ['/T', '/F', '/PID', pid.toString()], {
                    windowsHide: true,
                    stdio: 'ignore'
                });
                if (this.debugMode) console.log(`[PluginManager] Sent taskkill /T /F /PID ${pid} for plugin "${pluginName}"`);
            } else {
                // Unix: 尝试杀死进程组（负 PID）
                try {
                    process.kill(-pid, 'SIGKILL');
                } catch (e) {
                    // 如果进程组不存在，回退到杀单个进程
                    try { process.kill(pid, 'SIGKILL'); } catch (e2) { /* 进程可能已退出 */ }
                }
                if (this.debugMode) console.log(`[PluginManager] Sent SIGKILL to process group -${pid} for plugin "${pluginName}"`);
            }
        } catch (err) {
            console.warn(`[PluginManager] Failed to kill process tree for plugin "${pluginName}" (PID: ${pid}): ${err.message}`);
        }
    }

    async _executeStaticPluginCommand(plugin, options = {}) {
        if (!plugin || plugin.pluginType !== 'static' || !plugin.entryPoint || !plugin.entryPoint.command) {
            console.error(`[PluginManager] Invalid static plugin or command for execution: ${plugin ? plugin.name : 'Unknown'}`);
            return Promise.reject(new Error(`Invalid static plugin or command for ${plugin ? plugin.name : 'Unknown'}`));
        }

        if (options.signal?.aborted) {
            const error = options.signal.reason || new Error(`Static plugin ${plugin.name} start was aborted.`);
            error.code = error.code || 'STATIC_PLUGIN_ABORTED';
            throw error;
        }

        return new Promise((resolve, reject) => {
            const pluginConfig = this._getPluginConfig(plugin);
            const additionalEnv = {};
            if (this.projectBasePath) { // Add projectBasePath for static plugins too if needed
                additionalEnv.PROJECT_BASE_PATH = this.projectBasePath;
            }
            const envForProcess = this._buildPluginProcessEnv(plugin, pluginConfig, additionalEnv);

            const { command, args } = this._resolvePluginEntryCommand(plugin);
            const pluginProcess = this._spawnPluginProcess(command, args, { cwd: plugin.basePath, shell: true, env: envForProcess, windowsHide: true });
            let output = '';
            let errorOutput = '';
            let processExited = false;
            let timeoutId = null;
            const timeoutDuration = plugin.communication?.timeout || 60000; // 增加默认超时时间到 1 分钟
            const onAbort = () => {
                if (processExited) return;
                processExited = true;
                clearTimeout(timeoutId);
                this._killProcessTree(pluginProcess.pid, plugin.name);
                const error = options.signal.reason || new Error(`Static plugin ${plugin.name} execution aborted.`);
                error.code = error.code || 'STATIC_PLUGIN_ABORTED';
                reject(error);
            };
            options.signal?.addEventListener('abort', onAbort, { once: true });
            const clearAbortListener = () => options.signal?.removeEventListener('abort', onAbort);

            timeoutId = setTimeout(() => {
                if (!processExited) {
                    console.log(`[PluginManager] Static plugin "${plugin.name}" has completed its work cycle (${timeoutDuration}ms), terminating background process.`);
                    this._killProcessTree(pluginProcess.pid, plugin.name);
                    clearAbortListener();
                    // 超时不作为错误 - static 插件完成工作周期后返回已收集的输出
                    resolve(output.trim());
                }
            }, timeoutDuration);

            pluginProcess.stdout.on('data', (data) => { output += data.toString(); });
            pluginProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

            pluginProcess.on('error', (err) => {
                processExited = true;
                clearTimeout(timeoutId);
                clearAbortListener();
                const safeMessage = scrubPluginDiagnosticText(err.message);
                console.error(`[PluginManager] Failed to start static plugin ${plugin.name}: ${safeMessage}`);
                reject(new Error(safeMessage));
            });

            pluginProcess.on('exit', (code, signal) => {
                processExited = true;
                clearTimeout(timeoutId);
                clearAbortListener();
                if (signal === 'SIGKILL' || signal === 'SIGTERM') {
                    // 被强制终止（超时），已经在 timeout 回调中 resolve 了，这里直接返回
                    return;
                }
                if (code === 1 && !output.trim() && !errorOutput.trim()) {
                    // Windows taskkill 导致的退出码 1，且无有效输出，视为超时终止
                    return;
                }
                if (code !== 0) {
                    const errMsg = `Static plugin ${plugin.name} exited with code ${code}. Stderr: ${scrubPluginDiagnosticText(errorOutput.trim())}`;
                    console.error(`[PluginManager] ${errMsg}`);
                    reject(new Error(errMsg));
                } else {
                    if (errorOutput.trim() && this.debugMode) {
                        console.warn(`[PluginManager] Static plugin ${plugin.name} produced stderr output: ${scrubPluginDiagnosticText(errorOutput.trim())}`);
                    }
                    resolve(output.trim());
                }
            });
        });
    }

    async _updateStaticPluginValue(plugin, targetValues = this.staticPlaceholderValues, options = {}) {
        let newValue = null;
        let executionError = null;
        try {
            if (this.debugMode) console.log(`[PluginManager] Updating static plugin: ${plugin.name}`);
            newValue = await this._executeStaticPluginCommand(plugin, options);
        } catch (error) {
            console.error(`[PluginManager] Error executing static plugin ${plugin.name} script:`, error.message);
            executionError = error;
        }

        if (plugin.capabilities && plugin.capabilities.systemPromptPlaceholders) {
            plugin.capabilities.systemPromptPlaceholders.forEach(ph => {
                const placeholderKey = ph.placeholder;
                const currentValueEntry = targetValues.get(placeholderKey);
                const currentValue = currentValueEntry ? currentValueEntry.value : undefined;

                let parsedValue = newValue;
                if (newValue !== null) {
                    const trimmedValue = newValue.trim();
                    parsedValue = trimmedValue;

                    try {
                        // 优先兼容原有 JSON dynamic fold 协议
                        if (trimmedValue.startsWith('{')) {
                            const jsonObj = JSON.parse(trimmedValue);
                            if (jsonObj && jsonObj.vcp_dynamic_fold) {
                                parsedValue = jsonObj; // 保持对象形式以供折叠处理
                            }
                        } else if (hasFoldMarkers(trimmedValue)) {
                            // 兼容共享的文本折叠协议，支持 [===vcp_fold: x ::desc: ...===]
                            parsedValue = buildDynamicFoldObject({
                                content: trimmedValue,
                                pluginDescription: plugin.description || plugin.displayName || plugin.name,
                                strategy: 'toolbox_block_similarity'
                            });
                        }
                    } catch (e) {
                        if (hasFoldMarkers(trimmedValue)) {
                            parsedValue = buildDynamicFoldObject({
                                content: trimmedValue,
                                pluginDescription: plugin.description || plugin.displayName || plugin.name,
                                strategy: 'toolbox_block_similarity'
                            });
                        } else {
                            parsedValue = trimmedValue;
                        }
                    }
                }

                if (parsedValue !== null && parsedValue !== "") {
                    targetValues.set(placeholderKey, { value: parsedValue, serverId: 'local' });
                    if (this.debugMode) {
                        const logVal = typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue;
                        console.log(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} updated with value: "${logVal.substring(0, 70)}..."`);
                    }
                } else if (executionError) {
                    const errorMessage = `[Error updating ${plugin.name}: ${executionError.message.substring(0, 100)}...]`;
                    if (!currentValue || (typeof currentValue === 'string' && currentValue.startsWith("[Error"))) {
                        targetValues.set(placeholderKey, { value: errorMessage, serverId: 'local' });
                        if (this.debugMode) console.warn(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} set to error state: ${errorMessage}`);
                    } else {
                        if (this.debugMode) console.warn(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} failed to update. Keeping stale value: "${(typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue)).substring(0, 70)}..."`);
                    }
                } else {
                    if (this.debugMode) console.warn(`[PluginManager] Static plugin ${plugin.name} produced no new output for ${placeholderKey}. Keeping stale value (if any).`);
                    if (!currentValueEntry) {
                        targetValues.set(placeholderKey, { value: `[${plugin.name} data currently unavailable]`, serverId: 'local' });
                        if (this.debugMode) console.log(`[PluginManager] Placeholder ${placeholderKey} for ${plugin.name} set to 'unavailable'.`);
                    }
                }
            });
        }
    }

    async initializeStaticPlugins(generation = null) {
        const runtimeGeneration = this.runtimeV2Enabled
            ? (generation || this.currentGeneration)
            : null;
        if (runtimeGeneration?.staticInitialized) return;

        const plugins = runtimeGeneration?.plugins || this.plugins;
        const targetValues = runtimeGeneration?.staticPlaceholderValues || this.staticPlaceholderValues;
        const scheduledJobs = runtimeGeneration?.scheduledJobs || this.scheduledJobs;
        const staticTasks = runtimeGeneration?.staticTasks || new Set();
        const abortController = runtimeGeneration?.staticAbortController || new AbortController();
        if (runtimeGeneration) {
            runtimeGeneration.scheduledJobs = scheduledJobs;
            runtimeGeneration.staticTasks = staticTasks;
            runtimeGeneration.staticAbortController = abortController;
        }

        const launchUpdate = plugin => {
            const task = this._updateStaticPluginValue(plugin, targetValues, {
                signal: abortController.signal
            }).catch(err => {
                if (err.code !== 'STATIC_PLUGIN_ABORTED') {
                    console.error(`[PluginManager] Static update for ${plugin.name} failed: ${err.message}`);
                }
            }).finally(() => staticTasks.delete(task));
            staticTasks.add(task);
            return task;
        };

        console.log(`[PluginManager] Initializing static plugins${runtimeGeneration ? ` for generation ${runtimeGeneration.id}` : ''}...`);
        for (const plugin of plugins.values()) {
            if (plugin.pluginType !== 'static') continue;

            if (plugin.capabilities && plugin.capabilities.systemPromptPlaceholders) {
                plugin.capabilities.systemPromptPlaceholders.forEach(ph => {
                    targetValues.set(ph.placeholder, {
                        value: `[${plugin.displayName} a-zheng-zai-jia-zai-zhong... ]`,
                        serverId: 'local'
                    });
                });
            }

            launchUpdate(plugin);

            if (plugin.refreshIntervalCron) {
                if (scheduledJobs.has(plugin.name)) scheduledJobs.get(plugin.name).cancel();
                try {
                    const job = schedule.scheduleJob(plugin.refreshIntervalCron, () => {
                        if (abortController.signal.aborted) return;
                        if (this.debugMode) console.log(`[PluginManager] Scheduled update for static plugin: ${plugin.name}`);
                        launchUpdate(plugin);
                    });
                    scheduledJobs.set(plugin.name, job);
                    if (this.debugMode) console.log(`[PluginManager] Scheduled ${plugin.name} with cron: ${plugin.refreshIntervalCron}`);
                } catch (e) {
                    console.error(`[PluginManager] Invalid cron string for ${plugin.name}: ${plugin.refreshIntervalCron}. Error: ${e.message}`);
                }
            }
        }
        if (runtimeGeneration) runtimeGeneration.staticInitialized = true;
        console.log('[PluginManager] Static plugin tasks and schedules have started.');
    }
    async prewarmPythonPlugins() {
        console.log('[PluginManager] Checking for Python plugins to pre-warm...');
        if (this.plugins.has('SciCalculator')) {
            console.log('[PluginManager] SciCalculator found. Starting pre-warming of Python scientific libraries in the background.');
            try {
                const command = this.pythonExecutable;
                const args = ['-c', 'import sympy, scipy.stats, scipy.integrate, numpy'];
                const prewarmProcess = spawn(command, args, {
                    // 移除 shell: true
                    windowsHide: true
                });

                prewarmProcess.on('error', (err) => {
                    console.warn(`[PluginManager] Python pre-warming process failed to start. Is Python installed and in the system's PATH? Error: ${err.message}`);
                });

                prewarmProcess.stderr.on('data', (data) => {
                    console.warn(`[PluginManager] Python pre-warming process stderr: ${data.toString().trim()}`);
                });

                prewarmProcess.on('exit', (code) => {
                    if (code === 0) {
                        console.log('[PluginManager] Python scientific libraries pre-warmed successfully.');
                    } else {
                        console.warn(`[PluginManager] Python pre-warming process exited with code ${code}. Please ensure required libraries are installed (pip install sympy scipy numpy).`);
                    }
                });
            } catch (e) {
                console.error(`[PluginManager] An exception occurred while spawning the Python pre-warming process: ${e.message}`);
            }
        } else {
            if (this.debugMode) console.log('[PluginManager] SciCalculator not found, skipping Python pre-warming.');
        }
    }


    getPlaceholderValue(placeholder) {
        // First, try the modern, clean key (e.g., "VCPChromePageInfo")
        let entry = this.staticPlaceholderValues.get(placeholder);

        // If not found, try the legacy key with brackets (e.g., "{{VCPChromePageInfo}}")
        if (entry === undefined) {
            entry = this.staticPlaceholderValues.get(`{{${placeholder}}}`);
        }

        // If still not found, return the "not found" message
        if (entry === undefined) {
            return `[Placeholder ${placeholder} not found]`;
        }

        // Now, handle the value format
        // Modern format: { value: "...", serverId: "..." }
        if (typeof entry === 'object' && entry !== null && entry.hasOwnProperty('value')) {
            return entry.value;
        }

        // Legacy format: raw string
        if (typeof entry === 'string') {
            return entry;
        }

        // Fallback for unexpected formats
        return `[Invalid value format for placeholder ${placeholder}]`;
    }

    _assertDirectAdmissionOpen(pluginName) {
        if (this.directAdmissions?.get(pluginName)?.locked) {
            const error = new Error(`Plugin ${pluginName} is temporarily unavailable for admission.`);
            error.code = 'PLUGIN_TEMPORARILY_UNAVAILABLE_FOR_ADMISSION';
            error.statusCode = 503;
            throw error;
        }
    }

    _beginGenerationInvocation(pluginName) {
        this._assertDirectAdmissionOpen?.(pluginName);
        if (!this.runtimeV2Enabled || !this.currentGeneration) {
            return () => {};
        }
        if (this.runtimeState !== 'READY' || this.currentGeneration.state !== 'READY') {
            const error = new Error(`Plugin runtime is ${this.runtimeState}; new plugin calls are temporarily unavailable.`);
            error.code = 'PLUGIN_RUNTIME_RELOADING';
            error.statusCode = 503;
            throw error;
        }

        const generation = this.currentGeneration;
        generation.activeRequests += 1;
        generation.activeByPlugin.set(pluginName, (generation.activeByPlugin.get(pluginName) || 0) + 1);
        this.activePluginRequests.set(pluginName, (this.activePluginRequests.get(pluginName) || 0) + 1);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            generation.activeRequests = Math.max(0, generation.activeRequests - 1);
            const generationCount = Math.max(0, (generation.activeByPlugin.get(pluginName) || 1) - 1);
            if (generationCount) generation.activeByPlugin.set(pluginName, generationCount);
            else generation.activeByPlugin.delete(pluginName);
            const totalCount = Math.max(0, (this.activePluginRequests.get(pluginName) || 1) - 1);
            if (totalCount) this.activePluginRequests.set(pluginName, totalCount);
            else this.activePluginRequests.delete(pluginName);
        };
    }

    _assertPluginCircuitClosed(pluginName) {
        const state = this.pluginCircuitBreakers.get(pluginName);
        if (!state?.openUntil) return;
        if (state.openUntil <= Date.now()) {
            this.pluginCircuitBreakers.delete(pluginName);
            return;
        }
        const error = new Error(
            `Plugin ${pluginName} circuit breaker is open until ${new Date(state.openUntil).toISOString()}.`
        );
        error.code = 'PLUGIN_CIRCUIT_OPEN';
        error.statusCode = 503;
        throw error;
    }

    _recordPluginCallResult(pluginName, error = null) {
        if (!error) {
            this.pluginCircuitBreakers.delete(pluginName);
            return;
        }
        const code = String(error.code || '');
        const infrastructureFailure = code === 'DIRECT_TOOL_TIMEOUT'
            || code === 'PLUGIN_NOT_RUNNING'
            || code === 'PLUGIN_RUNTIME_RELOADING'
            || /^E[A-Z_]+$/.test(code)
            || /timed out|connection|socket|unavailable/i.test(String(error.message || ''));
        if (!infrastructureFailure) return;

        const previous = this.pluginCircuitBreakers.get(pluginName) || { failures: 0 };
        const failures = previous.failures + 1;
        this.pluginCircuitBreakers.set(pluginName, {
            failures,
            lastError: error.message,
            openUntil: failures >= 5 ? Date.now() + 30000 : null
        });
    }

    async executeMessagePreprocessor(pluginName, messages, requestConfig = {}) {
        const processorModule = this.messagePreprocessors.get(pluginName);
        const pluginManifest = this.plugins.get(pluginName);
        if (!processorModule || !pluginManifest) {
            console.error(`[PluginManager] Message preprocessor plugin "${pluginName}" not found.`);
            return messages;
        }
        if (typeof processorModule.processMessages !== 'function') {
            console.error(`[PluginManager] Plugin "${pluginName}" does not have 'processMessages' function.`);
            return messages;
        }
        let release = () => {};
        const startedAt = Date.now();
        try {
            release = this._beginGenerationInvocation(pluginName);
            if (this.debugMode) console.log(`[PluginManager] Executing message preprocessor: ${pluginName}`);
            const pluginSpecificConfig = this._getPluginConfig(pluginManifest);
            const runtime = this.currentGeneration?.runtimes.get(pluginName);
            const processContext = { ...pluginSpecificConfig, ...requestConfig };
            let inputMessages = messages;
            let controlContext = null;
            if (pluginManifest.interpretsControlSyntax === true) {
                controlContext = createPreprocessorControlContext(messages, {
                    pluginName,
                    generation: this.currentGeneration?.id || null
                });
                inputMessages = controlContext.messages;
                processContext.controlContext = controlContext;
                processContext.patch = controlContext.patch;
            }
            const candidateMessages = runtime
                ? await runtime.processMessages(inputMessages, processContext)
                : await processorModule.processMessages(inputMessages, processContext);
            let processedMessages = candidateMessages;
            if (controlContext) {
                // Runtime V2 applies control-syntax mutations through the
                // host-owned patch surface. Built-ins may retain their
                // historical return-value convention for one migration cycle;
                // the adapter converts that value into a host patch here.
                if (candidateMessages !== undefined && candidateMessages !== null) {
                    controlContext.patch.applyMessages(candidateMessages);
                }
                processedMessages = controlContext.restoreAndValidate(undefined);
            }
            const durationMs = Date.now() - startedAt;
            if (this.debugMode || durationMs >= 1000) {
                console.log(JSON.stringify({
                    event: 'preprocessor_complete',
                    generation: this.currentGeneration?.id || null,
                    pluginName,
                    durationMs,
                    protectedBlocks: controlContext?.protectedBlockCount || 0,
                    success: true
                }));
            }
            if (this.debugMode) console.log(`[PluginManager] Message preprocessor ${pluginName} finished.`);
            return processedMessages;
        } catch (error) {
            console.error(JSON.stringify({
                event: 'preprocessor_complete',
                generation: this.currentGeneration?.id || null,
                pluginName,
                durationMs: Date.now() - startedAt,
                success: false,
                code: error.code || null
            }));
            console.error(`[PluginManager] Error in message preprocessor ${pluginName}:`, error);
            return messages;
        } finally {
            release();
        }
    }

    async shutdownAllPlugins() {
        this.cancelPendingApprovals();
        this._assertNoDirectAdmission?.();
        console.log('[PluginManager] Shutting down all plugins...'); // Keep

        this.runtimeState = 'SHUTTING_DOWN';
        this._emitRuntimeState({ reason: 'shutdown' });
        if (this.pluginWatcher) {
            try {
                await this.pluginWatcher.close();
            } catch (error) {
                console.warn(`[PluginManager] Failed to close plugin watcher: ${error.message}`);
            }
            this.pluginWatcher = null;
        }
        clearTimeout(this.reloadTimeout);
        this.reloadTimeout = null;

        if (this.runtimeV2Enabled && this.currentGeneration) {
            const errors = await this._shutdownRuntimeGeneration(this.currentGeneration, {
                totalTimeoutMs: 30000
            });
            for (const error of errors) {
                console.error(`[PluginManager] Runtime shutdown error for ${error.pluginName}: ${error.error}`);
            }
            this.currentGeneration = null;
            this.runtimeState = errors.length ? 'STOPPED_WITH_ERRORS' : 'STOPPED';
            this._emitRuntimeState({ reason: 'shutdown' });
            for (const job of this.scheduledJobs.values()) job.cancel();
            this.scheduledJobs.clear();
            await this.toolApprovalManager?.shutdown?.();
            console.log('[PluginManager] Runtime V2 generation stopped.');
            return;
        }

        // VectorDBManager 是 server.js 注入并持有生命周期的外部依赖。
        // 必须先让 DailyNote 等常驻服务排空自身队列，再由 server.js 统一关闭 KBD；
        // 禁止在此提前/重复 shutdown 数据库。
        for (const [name, pluginModuleData] of this.messagePreprocessors) {
            const pluginModule = pluginModuleData.module || pluginModuleData;
            if (pluginModule && typeof pluginModule.shutdown === 'function') {
                try {
                    if (this.debugMode) console.log(`[PluginManager] Calling shutdown for ${name}...`);
                    await pluginModule.shutdown();
                } catch (error) {
                    console.error(`[PluginManager] Error during shutdown of plugin ${name}:`, error); // Keep error
                }
            }
        }
        for (const [name, serviceData] of this.serviceModules) {
            if (serviceData.module && typeof serviceData.module.shutdown === 'function') {
                try {
                    if (this.debugMode) console.log(`[PluginManager] Calling shutdown for service plugin ${name}...`);
                    await serviceData.module.shutdown();
                } catch (error) {
                    console.error(`[PluginManager] Error during shutdown of service plugin ${name}:`, error); // Keep error
                }
            }
        }
        for (const job of this.scheduledJobs.values()) {
            job.cancel();
        }
        this.scheduledJobs.clear();
        await this.toolApprovalManager?.shutdown?.();
        this.runtimeState = 'STOPPED';
        this._emitRuntimeState({ reason: 'shutdown' });
        console.log('[PluginManager] All plugin shutdown processes initiated and scheduled jobs cancelled.'); // Keep
    }

    async _readStrictPreprocessorOrder(discoveredPreprocessors) {
        const available = Array.from(discoveredPreprocessors.keys());
        let parsed;
        let source = PREPROCESSOR_ORDER_FILE;

        try {
            parsed = JSON.parse(await fs.readFile(source, 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                const wrapped = new Error(`Invalid preprocessor order file: ${error.message}`);
                wrapped.code = 'PREPROCESSOR_ORDER_INVALID';
                throw wrapped;
            }
            source = PREPROCESSOR_ORDER_EXAMPLE_FILE;
            try {
                parsed = JSON.parse(await fs.readFile(source, 'utf8'));
            } catch (fallbackError) {
                const wrapped = new Error(
                    `Strict preprocessor order is required, but neither ${path.basename(PREPROCESSOR_ORDER_FILE)} ` +
                    `nor a valid ${path.basename(PREPROCESSOR_ORDER_EXAMPLE_FILE)} is available: ${fallbackError.message}`
                );
                wrapped.code = 'PREPROCESSOR_ORDER_REQUIRED';
                throw wrapped;
            }
        }

        if (!parsed || Array.isArray(parsed) || parsed.version !== 2 || parsed.strict !== true || !Array.isArray(parsed.order)) {
            const error = new Error(
                `${path.basename(source)} must be { "version": 2, "strict": true, "order": [...] }.`
            );
            error.code = 'PREPROCESSOR_ORDER_INVALID';
            throw error;
        }

        const duplicates = parsed.order.filter((name, index) => parsed.order.indexOf(name) !== index);
        const availableSet = new Set(available);
        const unknown = parsed.order.filter(name => !availableSet.has(name));
        const configuredSet = new Set(parsed.order);
        const omitted = available.filter(name => !configuredSet.has(name));

        if (duplicates.length || unknown.length || omitted.length) {
            const error = new Error(
                `Strict preprocessor order mismatch. duplicates=${JSON.stringify(Array.from(new Set(duplicates)))}, ` +
                `unknown=${JSON.stringify(unknown)}, omitted=${JSON.stringify(omitted)}`
            );
            error.code = 'PREPROCESSOR_ORDER_MISMATCH';
            error.details = {
                duplicates: Array.from(new Set(duplicates)),
                unknown,
                omitted,
                available,
                source
            };
            throw error;
        }

        return parsed.order.slice();
    }

    _runtimeConfigForManifest(manifest) {
        const config = this._getPluginConfig(manifest);
        config.PORT = process.env.PORT;
        config.Key = process.env.Key;
        config.PROJECT_BASE_PATH = this.projectBasePath;
        return config;
    }

    _runtimeDependenciesForManifest(manifest, generation) {
        const dependencies = {
            vcpLogFunctions: this.getVCPLogFunctions(generation),
            pluginManager: this,
            webSocketServer: this.webSocketServer,
            ...(manifest.name === 'CodexWorker' ? { codexWorkerWriteAuthority: Object.freeze({verifyAuthorization: (expected, context) => approvalReceiptAuthority.verifyAuthorization(expected, context)}) } : {})
        };

        if (
            manifest.requiresKnowledgeBaseManager === true ||
            manifest.name === 'RAGDiaryPlugin' ||
            manifest.name === 'DailyNote' ||
            manifest.name === 'DailyNoteManager'
        ) {
            dependencies.vectorDBManager = this.vectorDBManager;
            dependencies.knowledgeBaseManager = this.vectorDBManager;
        }

        if ((manifest.name === 'RAGDiaryPlugin' || manifest.name === 'LightMemo') && this.tdbKnowledgeManager) {
            dependencies.tdbKnowledgeManager = this.tdbKnowledgeManager;
        }

        const ragRuntime = generation.runtimes.get('RAGDiaryPlugin');
        const ragModule = ragRuntime?.routeModule || generation.messagePreprocessors.get('RAGDiaryPlugin');
        if (manifest.requiresContextBridge && typeof ragModule?.getContextBridge === 'function') {
            dependencies.contextBridge = ragModule.getContextBridge();
        }

        if (manifest.name === 'LightMemo' && ragModule) {
            if (ragModule.vectorDBManager && typeof ragModule.getSingleEmbedding === 'function') {
                dependencies.vectorDBManager = ragModule.vectorDBManager;
                dependencies.getSingleEmbedding = ragModule.getSingleEmbedding.bind(ragModule);
                if (typeof ragModule.getBatchEmbeddingsCached === 'function') {
                    dependencies.getBatchEmbeddings = ragModule.getBatchEmbeddingsCached.bind(ragModule);
                } else if (typeof ragModule.getBatchEmbeddings === 'function') {
                    dependencies.getBatchEmbeddings = ragModule.getBatchEmbeddings.bind(ragModule);
                }
            }
            if (!dependencies.contextBridge && typeof ragModule.getContextBridge === 'function') {
                dependencies.contextBridge = ragModule.getContextBridge();
            }
            if (typeof ragModule.getAIMemoBridge === 'function') {
                dependencies.aiMemoBridge = ragModule.getAIMemoBridge();
            }
        }

        return dependencies;
    }

    _loadFreshDirectModule(manifest, manifestBytes = null, expectedIdentity = null) {
        const scriptPath = path.resolve(manifest.basePath, manifest.entryPoint.script);
        const relative = path.relative(path.resolve(manifest.basePath), scriptPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            const error = new Error(`Direct plugin entry escapes its plugin directory: ${manifest.name}`);
            error.code = 'PLUGIN_ENTRY_OUTSIDE_BASE';
            throw error;
        }

        // A generation owns the complete module graph below its plugin root,
        // not only the entry module. The active generation keeps its existing
        // object references, while an explicit reload receives fresh
        // transitive modules and state.
        const pluginRoot = path.resolve(manifest.basePath);
        for (const cachedPath of Object.keys(require.cache)) {
            const cachedRelative = path.relative(pluginRoot, cachedPath);
            if (
                cachedRelative === ''
                || (!cachedRelative.startsWith(`..${path.sep}`)
                    && cachedRelative !== '..'
                    && !path.isAbsolute(cachedRelative))
            ) {
                delete require.cache[cachedPath];
            }
        }
        return require('./modules/directPluginRuntime').loadIdentityBoundDirectModule(
            manifest, entry => require(entry), manifestBytes, expectedIdentity
        );
    }

    _assertNoDirectAdmission() {
        if (this.directAdmissions?.size) {
            const error = new Error('A direct plugin admission or its cleanup is in progress.');
            error.code = 'PLUGIN_ADMISSION_IN_PROGRESS';
            error.statusCode = 409;
            throw error;
        }
    }

    _directPluginDescription(plugin) {
        if (plugin.runtimeAvailability === 'unavailable') return null;
        const descriptions = [];
        for (const cmd of plugin.capabilities?.invocationCommands || []) {
            if (!cmd.description) continue;
            let text = `- ${plugin.displayName} (${plugin.name}) - 命令: ${cmd.command || 'N/A'}:\n`;
            text += cmd.description.split('\n').map(line => `    ${line}`).join('\n');
            if (cmd.example) text += `\n  调用示例:\n${cmd.example.split('\n').map(line => `    ${line}`).join('\n')}`;
            descriptions.push(text);
        }
        return descriptions.length ? descriptions.join('\n\n') : null;
    }

    _publishDirectCandidate(generation, manifest, candidate, description) {
        const name = manifest.name;
        generation.plugins.set(name, manifest);
        generation.runtimes.set(name, candidate);
        generation.serviceModules.set(name, { manifest, module: candidate.routeModule, runtime: candidate });
        if (description === null) this.individualPluginDescriptions.delete(`VCP${name}`);
        else this.individualPluginDescriptions.set(`VCP${name}`, description);
        if (!generation.initializationOrder.includes(name)) generation.initializationOrder.push(name);
    }

    _verifyDirectPublication(generation, manifest, candidate, identity, description) {
        const service = generation.serviceModules.get(manifest.name);
        if (this.currentGeneration !== generation || this.plugins !== generation.plugins
            || this.serviceModules !== generation.serviceModules
            || generation.plugins.get(manifest.name) !== manifest
            || generation.runtimes.get(manifest.name) !== candidate
            || service?.runtime !== candidate || service?.manifest !== manifest
            || service?.module !== candidate.routeModule || !candidate.started
            || !identity || candidate.loadedIdentity !== identity
            || (this.individualPluginDescriptions.get(`VCP${manifest.name}`) ?? null) !== description
            || !generation.initializationOrder.includes(manifest.name)) {
            throw new Error('PLUGIN_ADMISSION_PUBLICATION_INVARIANT_FAILED');
        }
    }

    // Internal R0 primitive, deliberately no HTTP/operator route. Eligibility
    // is limited to the two audited resource-local, tool-only direct plugins.
    // Other plugins need their own lifecycle/continuity admission evidence.
    async _admitDirectPlugin({ name, expectedIdentity, quiescenceTimeoutMs = 30000 }) {
        if (!['LightMemo', 'RiverMemoInspector'].includes(name)) throw new Error('PLUGIN_TARGET_NOT_ADMITTED');
        if (!Number.isInteger(quiescenceTimeoutMs) || quiescenceTimeoutMs < 1 || quiescenceTimeoutMs > 30000) {
            throw new Error('INVALID_PLUGIN_QUIESCENCE_TIMEOUT');
        }
        if (!expectedIdentity || !['source_sha256', 'manifest_sha256'].every(key => /^[a-f0-9]{64}$/.test(expectedIdentity[key] || ''))) {
            throw new Error('PLUGIN_ACCEPTED_IDENTITY_REQUIRED');
        }
        const generation = this.currentGeneration;
        if (!this.runtimeV2Enabled || !generation || generation.state !== 'READY' || this.runtimeState !== 'READY'
            || this.reloadPromise || this.plugins !== generation.plugins || this.serviceModules !== generation.serviceModules) {
            throw new Error('PLUGIN_ADMISSION_RUNTIME_NOT_READY');
        }
        this.directAdmissions ||= new Map();
        if (this.directAdmissions.has(name)) throw new Error('PLUGIN_ADMISSION_IN_PROGRESS');
        const catalog = this.directPluginCatalog;
        if (!catalog?.initialized || catalog.pluginManager !== this
            || typeof catalog.prepareDirectPluginPublication !== 'function') throw new Error('PLUGIN_TARGET_CATALOG_UNAVAILABLE');
        const previous = generation.runtimes.get(name) || null;
        if (previous && !previous.loadedIdentity) throw new Error('PLUGIN_PREVIOUS_LOADED_IDENTITY_UNAVAILABLE');
        if (generation.plugins.has(name) && (!previous || generation.plugins.get(name).isDistributed)) {
            throw new Error('PLUGIN_ADMISSION_NAME_COLLISION');
        }
        if (generation.messagePreprocessors.has(name)) throw new Error('PLUGIN_TARGET_HAS_PREPROCESSOR_REGISTRATION');
        const record = { state: 'preparing', locked: false, previous, candidate: null };
        this.directAdmissions.set(name, record); // Reserve preparation; old calls remain admitted.
        let candidate;
        let candidateWork;
        let pendingCleanup = false;
        let committed = false;
        const snapshots = [
            [generation.plugins, name], [generation.runtimes, name], [generation.serviceModules, name],
            [this.individualPluginDescriptions, `VCP${name}`]
        ].map(([map, key]) => ({ map, key, had: map.has(key), value: map.get(key) }));
        const wasOrdered = generation.initializationOrder.includes(name);
        const restore = () => {
            for (const entry of snapshots) {
                if (entry.had) entry.map.set(entry.key, entry.value);
                else entry.map.delete(entry.key);
            }
            if (!wasOrdered) {
                const index = generation.initializationOrder.indexOf(name);
                if (index !== -1) generation.initializationOrder.splice(index, 1);
            }
        };
        // A lifecycle timeout never means its underlying work has stopped.
        // Retain the reservation/previous reference until cleanup really settles.
        const retainCleanup = work => {
            pendingCleanup = true;
            record.state = 'cleanup_pending';
            record.locked = false;
            Promise.resolve(work).then(
                () => this.directAdmissions.delete(name),
                error => { record.state = 'cleanup_failed'; record.cleanupError = error.message; }
            );
        };
        try {
            const basePath = path.join(__dirname, 'Plugin', name, name === 'RiverMemoInspector' ? 'source' : '');
            const manifestBytes = require('node:fs').readFileSync(path.join(basePath, 'plugin-manifest.json'));
            const manifest = JSON.parse(manifestBytes.toString('utf8'));
            if (manifest.name !== name || manifest.runtimeLifecycle !== 2 || manifest.pluginType !== 'hybridservice'
                || manifest.communication?.protocol !== 'direct' || manifest.hasApiRoutes) {
                throw new Error('PLUGIN_TARGET_MANIFEST_NOT_ADMITTED');
            }
            manifest.basePath = basePath;
            const registration = this._evaluateExternalPluginRuntimeRegistration(manifest);
            if (!registration.allowed) throw new Error('PLUGIN_TARGET_REGISTRATION_DENIED');
            const moduleExports = this._loadFreshDirectModule(manifest, manifestBytes, expectedIdentity);
            candidate = createDirectPluginRuntime(moduleExports, {
                generationId: generation.id, manifest,
                config: this._runtimeConfigForManifest(manifest), dependencies: {},
                projectBasePath: this.projectBasePath, webSocketServer: this.webSocketServer
            });
            record.candidate = candidate;
            const identity = candidate.loadedIdentity;
            if (!identity || identity.source_sha256 !== expectedIdentity.source_sha256
                || identity.manifest_sha256 !== expectedIdentity.manifest_sha256
                || (identity.source_files.length > 1 && !expectedIdentity.source_graph_sha256)
                || (expectedIdentity.source_graph_sha256 && identity.source_graph_sha256 !== expectedIdentity.source_graph_sha256)) {
                throw new Error('PLUGIN_ACCEPTED_IDENTITY_MISMATCH');
            }
            candidateWork = (async () => {
                await candidate.prepare();
                const module = candidate.routeModule;
                if (typeof (module.process || module.processToolCall) !== 'function') throw new Error('PLUGIN_TARGET_HANDLER_REQUIRED');
                if (typeof module.processMessages === 'function' || typeof module.registerRoutes === 'function'
                    || typeof module.registerApiRoutes === 'function') throw new Error('PLUGIN_TARGET_HAS_NONLOCAL_REGISTRATION');
                Object.assign(candidate.context.dependencies, this._runtimeDependenciesForManifest(manifest, generation));
                await candidate.start();
                const health = await candidate.health();
                if (!health || health.status !== 'ready' || (await candidate.getReloadBlockers()).length) {
                    throw new Error('PLUGIN_CANDIDATE_NOT_READY');
                }
            })();
            await this._withTimeout(candidateWork, 10000, 'Plugin candidate preparation/start');
            const description = this._directPluginDescription(manifest);
            record.state = 'quiescing';
            record.locked = true;
            const deadline = Date.now() + quiescenceTimeoutMs;
            while ((generation.activeByPlugin.get(name) || 0) > 0 && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
            }
            if ((generation.activeByPlugin.get(name) || 0) > 0) {
                const error = new Error(`Plugin ${name} did not quiesce within the admission window.`);
                error.code = 'PLUGIN_QUIESCENCE_TIMEOUT';
                error.statusCode = 409;
                throw error;
            }
            if (this.currentGeneration !== generation || this.runtimeState !== 'READY'
                || generation.runtimes.get(name) !== (previous || undefined)
                || this.directPluginCatalog !== catalog || catalog.pluginManager !== this
                || snapshots.some(entry => entry.map.has(entry.key) !== entry.had || entry.map.get(entry.key) !== entry.value)) {
                throw new Error('PLUGIN_ADMISSION_SOURCE_DRIFT');
            }
            // Snapshot the currently effective target catalog only after the
            // admitted work has drained. Preparation has no visible side effects.
            const publication = catalog.prepareDirectPluginPublication(manifest, description, identity);
            record.state = 'publishing';
            // No await or external event callback inside publication/verification.
            try {
                this._publishDirectCandidate(generation, manifest, candidate, description);
                catalog.publishDirectPluginPublication(publication);
                this._verifyDirectPublication(generation, manifest, candidate, identity, description);
                catalog.verifyDirectPluginPublication(publication, identity);
            } catch (error) {
                restore();
                catalog.restoreDirectPluginPublication(publication);
                throw error;
            }
            committed = true;
            record.state = 'active';
            record.locked = false;
            const result = { status: 'published', plugin: name, loaded_identity: identity,
                previous_identity: previous?.loadedIdentity || null, catalog_origin_key: publication.key,
                catalog_persistence: 'runtime_only', retirement_error: null };
            if (previous) {
                const retirement = previous.shutdown();
                try { await this._withTimeout(retirement, 10000, 'Previous plugin retirement'); }
                catch (error) {
                    result.status = 'published_cleanup_failed';
                    result.retirement_error = { code: error.code || null, message: error.message };
                    retainCleanup(retirement);
                }
            }
            return result;
        } catch (error) {
            record.locked = false;
            if (!committed && candidate) {
                // Wait even if preparation timed out; never shutdown a candidate
                // concurrently with its still-running initialize/start method.
                const cleanup = Promise.resolve(candidateWork).catch(() => {}).then(() => candidate.shutdown());
                try { await this._withTimeout(cleanup, 10000, 'Candidate cleanup'); }
                catch (cleanupError) { error.cleanupError = cleanupError; retainCleanup(cleanup); }
            }
            throw error;
        } finally {
            record.locked = false;
            if (!pendingCleanup) this.directAdmissions.delete(name);
        }
    }

    async _buildRuntimeGeneration(reason) {
        const generation = {
            id: ++this.runtimeGenerationSequence,
            reason,
            state: 'PREPARING',
            createdAt: new Date().toISOString(),
            startedAt: null,
            stoppedAt: null,
            activeRequests: 0,
            activeByPlugin: new Map(),
            plugins: new Map(),
            staticPlaceholderValues: new Map(
                Array.from(this.staticPlaceholderValues.entries())
                    .filter(([, entry]) => entry?.serverId !== 'local')
            ),
            messagePreprocessors: new Map(),
            serviceModules: new Map(),
            runtimes: new Map(),
            scheduledJobs: new Map(),
            staticTasks: new Set(),
            staticAbortController: new AbortController(),
            staticInitialized: false,
            initializationOrder: [],
            preprocessorOrder: [],
            publicRouter: express.Router(),
            adminRouter: express.Router(),
            routesRegistered: false
        };

        for (const [name, manifest] of this.plugins) {
            if (manifest?.isDistributed) generation.plugins.set(name, manifest);
        }

        const manifests = await this._discoverLegacyPluginManifests();
        this.pythonExecutable = resolvePythonExecutable({ projectRoot: __dirname });
        this.pythonRuntimeStatus = await validatePythonPlugins(manifests, {
            projectRoot: __dirname,
            pythonExecutable: this.pythonExecutable
        });

        for (const manifest of manifests) {
            const pythonStatus = this.pythonRuntimeStatus.get(manifest.name);
            if (pythonStatus && !pythonStatus.available) {
                manifest.runtimeAvailability = 'unavailable';
                manifest.runtimeUnavailableReason = pythonStatus.missing;
            } else if (pythonStatus) {
                manifest.runtimeAvailability = 'available';
            }

            if (generation.plugins.has(manifest.name)) {
                this._warnDuplicateLocalPluginSkipped(manifest, generation.plugins.get(manifest.name));
                continue;
            }

            const registrationDecision = this._evaluateExternalPluginRuntimeRegistration(manifest);
            if (!registrationDecision.allowed) {
                this._warnExternalPluginRegistrationBlocked(registrationDecision);
                continue;
            }

            generation.plugins.set(manifest.name, manifest);
            const isPreprocessor = manifest.pluginType === 'messagePreprocessor' || manifest.pluginType === 'hybridservice';
            const isService = manifest.pluginType === 'service' || manifest.pluginType === 'hybridservice';
            const isDirect = manifest.communication?.protocol === 'direct' && manifest.entryPoint?.script;
            if (!isDirect || (!isPreprocessor && !isService)) continue;

            if (manifest.runtimeLifecycle !== 2) {
                const error = new Error(
                    `Direct plugin ${manifest.name} does not declare runtimeLifecycle: 2. ` +
                    'Legacy direct plugins require a supervised process restart.'
                );
                error.code = 'LEGACY_DIRECT_RESTART_REQUIRED';
                error.pluginName = manifest.name;
                throw error;
            }

            const moduleExports = this._loadFreshDirectModule(manifest);
            const context = {
                generationId: generation.id,
                manifest,
                config: this._runtimeConfigForManifest(manifest),
                dependencies: {},
                projectBasePath: this.projectBasePath,
                webSocketServer: this.webSocketServer,
                publicRouter: generation.publicRouter,
                adminRouter: generation.adminRouter
            };
            const runtime = createDirectPluginRuntime(moduleExports, context);
            await runtime.prepare();
            generation.runtimes.set(manifest.name, runtime);

            const routeModule = runtime.routeModule;
            if (isPreprocessor && typeof routeModule.processMessages === 'function') {
                generation.messagePreprocessors.set(manifest.name, routeModule);
            }
            if (isService) {
                generation.serviceModules.set(manifest.name, { manifest, module: routeModule, runtime });
            }
        }

        generation.preprocessorOrder = await this._readStrictPreprocessorOrder(generation.messagePreprocessors);
        const orderedPreprocessors = new Map();
        for (const name of generation.preprocessorOrder) {
            orderedPreprocessors.set(name, generation.messagePreprocessors.get(name));
        }
        generation.messagePreprocessors = orderedPreprocessors;

        generation.initializationOrder = generation.preprocessorOrder.slice();
        for (const name of generation.runtimes.keys()) {
            if (!generation.initializationOrder.includes(name)) generation.initializationOrder.push(name);
        }
        generation.state = 'PREPARED';
        return generation;
    }

    async _registerGenerationRoutes(generation) {
        if (generation.routesRegistered || !this.serviceHost) return;
        const { projectBasePath } = this.serviceHost;

        for (const [name, serviceData] of generation.serviceModules) {
            const manifest = serviceData.manifest;
            const module = serviceData.runtime?.routeModule || serviceData.module;
            const pluginConfig = this._getPluginConfig(manifest);

            if (manifest.hasApiRoutes && typeof module.registerApiRoutes === 'function') {
                const pluginRouter = express.Router();
                await module.registerApiRoutes(
                    pluginRouter,
                    pluginConfig,
                    projectBasePath,
                    this.webSocketServer
                );
                generation.publicRouter.use(`/api/plugins/${name}`, pluginRouter);
            }

            if (name === 'VCPLog' && this.webSocketServer && typeof module.setBroadcastFunctions === 'function') {
                if (typeof this.webSocketServer.broadcastVCPInfo === 'function') {
                    module.setBroadcastFunctions(this.webSocketServer.broadcastVCPInfo);
                }
            }

            if (typeof module.registerRoutes === 'function') {
                if (module.registerRoutes.length >= 4) {
                    await module.registerRoutes(
                        generation.publicRouter,
                        generation.adminRouter,
                        pluginConfig,
                        projectBasePath
                    );
                } else {
                    await module.registerRoutes(generation.publicRouter, pluginConfig, projectBasePath);
                }
            }
        }
        generation.routesRegistered = true;
    }

    async _startRuntimeGeneration(generation) {
        const started = [];
        const previousPlaceholders = this.staticPlaceholderValues;
        this.staticPlaceholderValues = generation.staticPlaceholderValues;
        try {
            for (const name of generation.initializationOrder) {
                const runtime = generation.runtimes.get(name);
                if (!runtime) continue;
                const pluginStartedAt = Date.now();
                const dependencies = this._runtimeDependenciesForManifest(
                    generation.plugins.get(name),
                    generation
                );
                Object.assign(runtime.context.dependencies, dependencies);
                await runtime.start();
                started.push(runtime);
                const health = await this._withTimeout(
                    runtime.health(),
                    2000,
                    `Plugin ${name} startup health`
                );
                if (health && ['failed', 'unhealthy', 'unavailable'].includes(health.status)) {
                    const error = new Error(`Plugin ${name} reported unhealthy after start: ${JSON.stringify(health)}`);
                    error.code = 'PLUGIN_START_HEALTH_FAILED';
                    throw error;
                }
                console.log(JSON.stringify({
                    event: 'plugin_runtime_started',
                    generation: generation.id,
                    pluginName: name,
                    durationMs: Date.now() - pluginStartedAt,
                    health: health?.status || 'ready'
                }));
            }
            await this._registerGenerationRoutes(generation);
            await this.initializeStaticPlugins(generation);
            generation.startedAt = new Date().toISOString();
            generation.state = 'READY';
        } catch (error) {
            for (const runtime of started.reverse()) {
                try {
                    await this._withTimeout(runtime.shutdown(), 10000, 'plugin shutdown');
                } catch (shutdownError) {
                    console.error('[PluginManager] Failed to clean up partially started generation:', shutdownError.message);
                }
            }
            this.staticPlaceholderValues = previousPlaceholders;
            generation.state = 'FAILED';
            throw error;
        }
    }

    _withTimeout(promise, timeoutMs, label) {
        let timer;
        return Promise.race([
            Promise.resolve(promise),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const error = new Error(`${label} timed out after ${timeoutMs}ms`);
                    error.code = 'PLUGIN_LIFECYCLE_TIMEOUT';
                    reject(error);
                }, timeoutMs);
            })
        ]).finally(() => clearTimeout(timer));
    }

    async _shutdownRuntimeGeneration(generation, options = {}) {
        if (!generation) return [];
        const errors = [];
        const runtimes = Array.from(generation.runtimes.entries()).reverse();
        const shutdownAll = (async () => {
            for (const job of generation.scheduledJobs?.values?.() || []) {
                try {
                    job.cancel();
                } catch (error) {
                    errors.push({
                        pluginName: '*static-schedule*',
                        error: error.message,
                        code: error.code || null
                    });
                }
            }
            generation.scheduledJobs?.clear?.();
            if (generation.staticAbortController && !generation.staticAbortController.signal.aborted) {
                generation.staticAbortController.abort(
                    Object.assign(new Error(`Generation ${generation.id} is stopping.`), {
                        code: 'STATIC_PLUGIN_ABORTED'
                    })
                );
            }
            if (generation.staticTasks?.size) {
                await Promise.allSettled(Array.from(generation.staticTasks));
                generation.staticTasks.clear();
            }
            generation.staticInitialized = false;
            generation.staticAbortController = new AbortController();

            for (const [name, runtime] of runtimes) {
                const pluginShutdownStartedAt = Date.now();
                try {
                    await this._withTimeout(runtime.shutdown(), 10000, `Plugin ${name} shutdown`);
                    console.log(JSON.stringify({
                        event: 'plugin_runtime_stopped',
                        generation: generation.id,
                        pluginName: name,
                        durationMs: Date.now() - pluginShutdownStartedAt,
                        success: true
                    }));
                } catch (error) {
                    errors.push({ pluginName: name, error: error.message, code: error.code || null });
                    console.error(JSON.stringify({
                        event: 'plugin_runtime_stopped',
                        generation: generation.id,
                        pluginName: name,
                        durationMs: Date.now() - pluginShutdownStartedAt,
                        success: false,
                        code: error.code || null
                    }));
                }
            }
        })();

        try {
            await this._withTimeout(shutdownAll, options.totalTimeoutMs || 30000, 'Plugin generation shutdown');
        } catch (error) {
            errors.push({ pluginName: '*generation*', error: error.message, code: error.code || null });
        }

        generation.state = errors.length ? 'STOPPED_WITH_ERRORS' : 'STOPPED';
        generation.stoppedAt = new Date().toISOString();
        if (errors.length && options.throwOnError) {
            const error = new Error(`Generation ${generation.id} shutdown failed: ${JSON.stringify(errors)}`);
            error.code = 'GENERATION_SHUTDOWN_FAILED';
            error.details = errors;
            throw error;
        }
        return errors;
    }

    async _collectReloadBlockers(generation) {
        const blockers = [];
        if (!generation) return blockers;
        for (const [name, runtime] of generation.runtimes) {
            try {
                const pluginBlockers = await runtime.getReloadBlockers();
                for (const blocker of pluginBlockers) {
                    blockers.push({ pluginName: name, ...blocker });
                }
            } catch (error) {
                blockers.push({
                    pluginName: name,
                    type: 'health_check_failed',
                    message: error.message
                });
            }
        }
        return blockers;
    }

    async _waitForGenerationDrain(generation, timeoutMs = 30000) {
        if (!generation || generation.activeRequests === 0) return true;
        const deadline = Date.now() + timeoutMs;
        while (generation.activeRequests > 0 && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        return generation.activeRequests === 0;
    }

    _commitRuntimeGeneration(generation) {
        this.currentGeneration = generation;
        this.plugins = generation.plugins;
        this.staticPlaceholderValues = generation.staticPlaceholderValues;
        this.messagePreprocessors = generation.messagePreprocessors;
        this.serviceModules = generation.serviceModules;
        this.preprocessorOrder = generation.preprocessorOrder;
        this.scheduledJobs = generation.scheduledJobs;
        this.runtimeState = 'READY';
        this.buildVCPDescription();
        this._emitRuntimeState({ reason: generation.reason });
        this.emit('tools_changed', {
            reason: generation.reason,
            generation: generation.id
        });
    }

    async reloadPlugins(options = {}) {
        this._assertNoDirectAdmission?.();
        if (!this.runtimeV2Enabled) return this._loadPluginsLegacy();
        if (this.reloadPromise) {
            const error = new Error('A plugin generation reload is already in progress.');
            error.code = 'PLUGIN_RELOAD_IN_PROGRESS';
            error.statusCode = 409;
            throw error;
        }

        const force = options.force === true;
        const reason = options.reason || (this.currentGeneration ? 'manual_reload' : 'startup');
        const operation = (async () => {
            const oldGeneration = this.currentGeneration;
            const oldGenerationId = oldGeneration?.id || null;
            let nextGeneration;
            let oldStopped = false;
            const startedAt = new Date().toISOString();

            try {
                // Candidate preparation is side-effect free, so the active
                // generation continues serving until the candidate is ready
                // and the runtime explicitly enters RELOADING.
                this.runtimeState = oldGeneration ? 'READY' : 'STARTING';
                nextGeneration = await this._buildRuntimeGeneration(reason);
                this.runtimeState = 'RELOADING';
                this._emitRuntimeState({
                    reason,
                    candidateGeneration: nextGeneration.id
                });

                const drained = await this._waitForGenerationDrain(oldGeneration, 30000);
                const blockers = await this._collectReloadBlockers(oldGeneration);
                if (!drained) {
                    blockers.push({
                        pluginName: '*generation*',
                        type: 'active_requests',
                        message: `Generation ${oldGeneration.id} still has ${oldGeneration.activeRequests} active request(s).`
                    });
                }

                if (blockers.length && !force) {
                    await this._shutdownRuntimeGeneration(nextGeneration);
                    this.runtimeState = oldGeneration ? 'READY' : 'FAILED';
                    const result = {
                        status: 'blocked',
                        oldGeneration: oldGenerationId,
                        newGeneration: nextGeneration.id,
                        blockers,
                        rollback: { attempted: false, succeeded: true },
                        startedAt,
                        finishedAt: new Date().toISOString()
                    };
                    this.lastReloadResult = result;
                    this._emitRuntimeState({ reason, reload: result });
                    const error = new Error('Plugin reload blocked by active non-migratable work.');
                    error.code = 'PLUGIN_RELOAD_BLOCKED';
                    error.statusCode = 409;
                    error.result = result;
                    throw error;
                }

                if (oldGeneration) {
                    // A failed or timed-out shutdown may still have stopped a
                    // subset of plugins. Always enter the rollback restart path.
                    oldStopped = true;
                    await this._shutdownRuntimeGeneration(oldGeneration, { throwOnError: true });
                }

                await this._startRuntimeGeneration(nextGeneration);
                this._commitRuntimeGeneration(nextGeneration);
                const result = {
                    status: 'success',
                    oldGeneration: oldGenerationId,
                    newGeneration: nextGeneration.id,
                    blockers,
                    rollback: { attempted: false, succeeded: null },
                    startedAt,
                    finishedAt: new Date().toISOString()
                };
                this.lastReloadResult = result;
                this._emitRuntimeState({ reason, reload: result });
                console.log(`[PluginManager] Runtime generation ${nextGeneration.id} committed (${reason}).`);
                return result;
            } catch (error) {
                if (error.code === 'PLUGIN_RELOAD_BLOCKED') throw error;

                if (nextGeneration && nextGeneration !== this.currentGeneration) {
                    await this._shutdownRuntimeGeneration(nextGeneration);
                }

                const rollback = { attempted: oldStopped, succeeded: !oldStopped, error: null };
                if (oldStopped && oldGeneration) {
                    try {
                        await this._startRuntimeGeneration(oldGeneration);
                        oldGeneration.state = 'READY';
                        this._commitRuntimeGeneration(oldGeneration);
                        rollback.succeeded = true;
                    } catch (rollbackError) {
                        rollback.succeeded = false;
                        rollback.error = rollbackError.message;
                        this.runtimeState = 'FAILED';
                    }
                } else {
                    this.runtimeState = oldGeneration ? 'READY' : 'FAILED';
                }

                const result = {
                    status: 'failed',
                    oldGeneration: oldGenerationId,
                    newGeneration: nextGeneration?.id || null,
                    blockers: [],
                    error: error.message,
                    rollback,
                    startedAt,
                    finishedAt: new Date().toISOString()
                };
                this.lastReloadResult = result;
                this._emitRuntimeState({ reason, reload: result });
                error.reloadResult = result;
                throw error;
            }
        })();

        this.reloadPromise = operation;
        try {
            return await operation;
        } finally {
            this.reloadPromise = null;
        }
    }

    async loadPlugins(options = {}) {
        return this.reloadPlugins(options);
    }

    async _loadPluginsLegacy() {
        console.log('[PluginManager] Starting plugin discovery...');
        // 1. 清理现有插件状态
        // 1.1 识别并关闭本地插件，保留分布式插件
        const distributedPlugins = new Map();
        const localModulesToShutdown = new Set();

        for (const [name, manifest] of this.plugins.entries()) {
            if (manifest.isDistributed) {
                distributedPlugins.set(name, manifest);
            } else {
                // 收集本地插件模块以进行清理
                const preprocessor = this.messagePreprocessors.get(name);
                if (preprocessor) localModulesToShutdown.add(preprocessor);

                const service = this.serviceModules.get(name)?.module;
                if (service) localModulesToShutdown.add(service);
            }
        }

        // 执行清理：在重新加载前关闭旧的本地插件实例，释放资源
        for (const module of localModulesToShutdown) {
            if (typeof module.shutdown === 'function') {
                try {
                    await module.shutdown();
                } catch (e) {
                    console.error(`[PluginManager] Error during hot-reload shutdown of a plugin:`, e.message);
                }
            }
        }

        this.plugins = distributedPlugins; // 仅保留分布式插件，本地插件将被重新发现
        this.messagePreprocessors.clear();
        this.staticPlaceholderValues.clear();
        this.serviceModules.clear();

        const discoveredPreprocessors = new Map();
        const modulesToInitialize = [];

        try {
            // 2. 发现并加载所有插件模块，但不初始化
            const legacyManifests = await this._discoverLegacyPluginManifests();
            this.pythonExecutable = resolvePythonExecutable({ projectRoot: __dirname });
            this.pythonRuntimeStatus = await validatePythonPlugins(legacyManifests, {
                projectRoot: __dirname,
                pythonExecutable: this.pythonExecutable
            });
            for (const manifest of legacyManifests) {
                const pythonStatus = this.pythonRuntimeStatus.get(manifest.name);
                if (pythonStatus && !pythonStatus.available) {
                    manifest.runtimeAvailability = 'unavailable';
                    manifest.runtimeUnavailableReason = pythonStatus.missing;
                    console.error(
                        `[PluginManager] Python plugin ${manifest.name} is unavailable: ` +
                        JSON.stringify(pythonStatus.missing)
                    );
                } else if (pythonStatus) {
                    manifest.runtimeAvailability = 'available';
                }
            }
            for (const manifest of legacyManifests) {
                if (this.plugins.has(manifest.name)) {
                    this._warnDuplicateLocalPluginSkipped(manifest, this.plugins.get(manifest.name));
                    continue;
                }
                await this._registerLocalPlugin(manifest, discoveredPreprocessors, modulesToInitialize);
            }

            // 3. 确定预处理器加载顺序
            const availablePlugins = new Set(discoveredPreprocessors.keys());
            let finalOrder = [];
            try {
                const orderContent = await fs.readFile(PREPROCESSOR_ORDER_FILE, 'utf-8');
                const savedOrder = JSON.parse(orderContent);
                if (Array.isArray(savedOrder)) {
                    savedOrder.forEach(pluginName => {
                        if (availablePlugins.has(pluginName)) {
                            finalOrder.push(pluginName);
                            availablePlugins.delete(pluginName);
                        }
                    });
                }
            } catch (error) {
                if (error.code !== 'ENOENT') console.error(`[PluginManager] Error reading existing ${PREPROCESSOR_ORDER_FILE}:`, error);
            }

            finalOrder.push(...Array.from(availablePlugins).sort());

            // 4. 注册预处理器
            for (const pluginName of finalOrder) {
                this.messagePreprocessors.set(pluginName, discoveredPreprocessors.get(pluginName));
            }
            this.preprocessorOrder = finalOrder;
            if (finalOrder.length > 0) console.log('[PluginManager] Final message preprocessor order: ' + finalOrder.join(' -> '));

            // 5. VectorDBManager 应该已经由 server.js 初始化，这里不再重复初始化
            if (!this.vectorDBManager) {
                console.warn('[PluginManager] VectorDBManager not set! Plugins requiring it may fail.');
            }

            // 6. 按顺序初始化所有模块
            const allModulesMap = new Map(modulesToInitialize.map(m => [m.manifest.name, m]));
            const initializationOrder = [...this.preprocessorOrder];
            allModulesMap.forEach((_, name) => {
                if (!initializationOrder.includes(name)) {
                    initializationOrder.push(name);
                }
            });

            for (const pluginName of initializationOrder) {
                const item = allModulesMap.get(pluginName);
                if (!item || typeof item.module.initialize !== 'function') continue;

                const { manifest, module } = item;
                try {
                    const initialConfig = this._getPluginConfig(manifest);
                    initialConfig.PORT = process.env.PORT;
                    initialConfig.Key = process.env.Key;
                    initialConfig.PROJECT_BASE_PATH = this.projectBasePath;

                    const dependencies = {
                        vcpLogFunctions: this.getVCPLogFunctions(),
                        pluginManager: this,
                        webSocketServer: this.webSocketServer,
                        ...(manifest.name === 'CodexWorker' ? { codexWorkerWriteAuthority: Object.freeze({verifyAuthorization: (expected, context) => approvalReceiptAuthority.verifyAuthorization(expected, context)}) } : {})
                    };

                    // --- 注入 VectorDBManager ---
                    if (
                        manifest.requiresKnowledgeBaseManager === true ||
                        manifest.name === 'RAGDiaryPlugin' ||
                        manifest.name === 'DailyNote' ||
                        manifest.name === 'DailyNoteManager'
                    ) {
                        dependencies.vectorDBManager = this.vectorDBManager;
                        dependencies.knowledgeBaseManager = this.vectorDBManager;
                    }
                    if (manifest.name === 'RAGDiaryPlugin') {
                        // 🧊 注入冷知识库管理器，供 [[xx知识库]] / 《《xx知识库》》 占位符使用
                        if (this.tdbKnowledgeManager) {
                            dependencies.tdbKnowledgeManager = this.tdbKnowledgeManager;
                            if (this.debugMode) console.log(`[PluginManager] 🧊 Injected TDBKnowledgeManager into RAGDiaryPlugin.`);
                        }
                    }

                    // --- 🌟 ContextBridge 通用依赖注入 ---
                    // 任何在 manifest 中声明 "requiresContextBridge": true 的插件都能获得 RAG 上下文向量接口
                    if (manifest.requiresContextBridge) {
                        const ragPluginModule = this.messagePreprocessors.get('RAGDiaryPlugin');
                        if (ragPluginModule && typeof ragPluginModule.getContextBridge === 'function') {
                            dependencies.contextBridge = ragPluginModule.getContextBridge();
                            if (this.debugMode) console.log(`[PluginManager] 🌟 Injected ContextBridge into ${manifest.name}.`);
                        } else {
                            console.warn(`[PluginManager] Plugin "${manifest.name}" requires ContextBridge, but RAGDiaryPlugin is not available.`);
                        }
                    }

                    // --- LightMemo 特殊依赖注入（向后兼容 + ContextBridge） ---
                    if (manifest.name === 'LightMemo') {
                        const ragPluginModule = this.messagePreprocessors.get('RAGDiaryPlugin');
                        if (ragPluginModule && ragPluginModule.vectorDBManager && typeof ragPluginModule.getSingleEmbedding === 'function') {
                            dependencies.vectorDBManager = ragPluginModule.vectorDBManager;
                            dependencies.getSingleEmbedding = ragPluginModule.getSingleEmbedding.bind(ragPluginModule);
                            if (typeof ragPluginModule.getBatchEmbeddingsCached === 'function') {
                                dependencies.getBatchEmbeddings = ragPluginModule.getBatchEmbeddingsCached.bind(ragPluginModule);
                            } else if (typeof ragPluginModule.getBatchEmbeddings === 'function') {
                                dependencies.getBatchEmbeddings = ragPluginModule.getBatchEmbeddings.bind(ragPluginModule);
                            }
                            // 同时注入 ContextBridge（如果 LightMemo 未在 manifest 中声明，也主动注入）
                            if (!dependencies.contextBridge && typeof ragPluginModule.getContextBridge === 'function') {
                                dependencies.contextBridge = ragPluginModule.getContextBridge();
                            }
                            // AIMemoBridge 由 RAGDiaryPlugin 唯一持有配置、预设和缓存。
                            // LightMemo 只提交自身召回候选，避免重复实例化 AIMemoHandler。
                            if (typeof ragPluginModule.getAIMemoBridge === 'function') {
                                dependencies.aiMemoBridge = ragPluginModule.getAIMemoBridge();
                            }
                            if (this.debugMode) console.log(`[PluginManager] Injected VectorDBManager, embeddings, ContextBridge and AIMemoBridge into LightMemo.`);
                        } else {
                            console.error(`[PluginManager] Critical dependency failure: RAGDiaryPlugin or its components not available for LightMemo injection.`);
                        }
                        // 注入冷知识库管理器（TDBKnowledge），供 LightMemo 检索企业级知识库
                        if (this.tdbKnowledgeManager) {
                            dependencies.tdbKnowledgeManager = this.tdbKnowledgeManager;
                            if (this.debugMode) console.log(`[PluginManager] Injected TDBKnowledgeManager into LightMemo.`);
                        }
                    }
                    // --- 注入结束 ---

                    await module.initialize(initialConfig, dependencies);
                } catch (e) {
                    console.error(`[PluginManager] Error initializing module for ${manifest.name}:`, e instanceof Error ? e.message : JSON.stringify(e));
                    if (e instanceof Error && e.stack) {
                        console.error(`[PluginManager] Stack trace for ${manifest.name}:`, e.stack);
                    }
                }
            }

            this.buildVCPDescription();
            this.emit('tools_changed', { reason: 'local_reload' });
            console.log(`[PluginManager] Plugin discovery finished. Loaded ${this.plugins.size} plugins.`);
        } catch (error) {
            if (error.code === 'ENOENT') console.error(`[PluginManager] Plugin directory ${PLUGIN_DIR} not found.`);
            else console.error('[PluginManager] Error reading plugin directory:', error);
        }
    }

    buildVCPDescription() {
        this.individualPluginDescriptions.clear(); // Clear previous descriptions
        let overallLog = ['[PluginManager] Building individual VCP descriptions:'];

        for (const plugin of this.plugins.values()) {
            if (plugin.runtimeAvailability === 'unavailable') {
                continue;
            }
            if (plugin.capabilities && plugin.capabilities.invocationCommands && plugin.capabilities.invocationCommands.length > 0) {
                let pluginSpecificDescriptions = [];
                plugin.capabilities.invocationCommands.forEach(cmd => {
                    if (cmd.description) {
                        let commandDescription = `- ${plugin.displayName} (${plugin.name}) - 命令: ${cmd.command || 'N/A'}:\n`; // Assuming cmd might have a 'command' field or similar identifier
                        const indentedCmdDescription = cmd.description.split('\n').map(line => `    ${line}`).join('\n');
                        commandDescription += `${indentedCmdDescription}`;

                        if (cmd.example) {
                            const exampleHeader = `\n  调用示例:\n`;
                            const indentedExample = cmd.example.split('\n').map(line => `    ${line}`).join('\n');
                            commandDescription += exampleHeader + indentedExample;
                        }
                        pluginSpecificDescriptions.push(commandDescription);
                    }
                });

                if (pluginSpecificDescriptions.length > 0) {
                    const placeholderKey = `VCP${plugin.name}`;
                    const fullDescriptionForPlugin = pluginSpecificDescriptions.join('\n\n');
                    this.individualPluginDescriptions.set(placeholderKey, fullDescriptionForPlugin);
                    overallLog.push(`  - Generated description for {{${placeholderKey}}} (Length: ${fullDescriptionForPlugin.length})`);
                }
            }
        }

        if (this.individualPluginDescriptions.size === 0) {
            overallLog.push("  - No VCP plugins with invocation commands found to generate descriptions for.");
        }
        if (this.debugMode) console.log(overallLog.join('\n'));
    }

    // New method to get all individual descriptions
    getIndividualPluginDescriptions() {
        return this.individualPluginDescriptions;
    }

    getAllPlaceholderValues() {
        return this.staticPlaceholderValues;
    }

    // getVCPDescription() { // This method is no longer needed as VCPDescription is deprecated
    //     return this.vcpDescription;
    // }

    getPlugin(name) {
        return this.plugins.get(this._resolvePluginName(name).name);
    }

    getServiceModule(name) {
        return this.serviceModules.get(this._resolvePluginName(name).name)?.module;
    }

    _executeDirectToolCallWithTimeout(plugin, toolName, serviceModule, pluginSpecificArgs, directContext) {
        const timeoutDuration = plugin.communication?.timeout || 60000;
        const startedAt = Date.now();
        try {
            this._assertDirectAdmissionOpen?.(plugin.name || toolName);
            if (this.runtimeV2Enabled && this.currentGeneration?.plugins.get(plugin.name || toolName) !== plugin) {
                const error = new Error('Plugin registration changed while this request was awaiting admission; retry the request.');
                error.code = 'PLUGIN_REGISTRATION_CHANGED';
                error.statusCode = 503;
                throw error;
            }
            this._assertPluginCircuitClosed(plugin.name || toolName);
        } catch (error) {
            return Promise.reject(error);
        }
        const abortController = typeof AbortController === 'function'
            ? new AbortController()
            : null;
        if (abortController) {
            directContext.signal = abortController.signal;
        }
        let release;
        try {
            release = this._beginGenerationInvocation(plugin.name || toolName);
        } catch (error) {
            return Promise.reject(error);
        }
        const runtime = this.currentGeneration?.runtimes.get(plugin.name || toolName);
        const directCallPromise = Promise.resolve().then(() => (
            runtime
                ? runtime.process(pluginSpecificArgs, directContext)
                : serviceModule.processToolCall(pluginSpecificArgs, directContext)
        )).finally(() => release());

        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                const timeoutError = new Error(`Plugin "${toolName}" direct tool call timed out after ${timeoutDuration}ms.`);
                timeoutError.code = 'DIRECT_TOOL_TIMEOUT';
                if (abortController) {
                    try {
                        abortController.abort(timeoutError);
                    } catch (_) {
                        abortController.abort();
                    }
                }
                this._recordPluginCallResult(plugin.name || toolName, timeoutError);
                console.warn(JSON.stringify({
                    event: 'plugin_call_timeout',
                    generation: this.currentGeneration?.id || null,
                    pluginName: plugin.name || toolName,
                    durationMs: Date.now() - startedAt,
                    timeoutMs: timeoutDuration
                }));
                reject(timeoutError);
            }, timeoutDuration);

            directCallPromise.then(
                result => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    this._recordPluginCallResult(plugin.name || toolName);
                    console.log(JSON.stringify({
                        event: 'plugin_call_complete',
                        generation: this.currentGeneration?.id || null,
                        pluginName: plugin.name || toolName,
                        durationMs: Date.now() - startedAt,
                        success: true
                    }));
                    resolve(result);
                },
                error => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    this._recordPluginCallResult(plugin.name || toolName, error);
                    console.warn(JSON.stringify({
                        event: 'plugin_call_complete',
                        generation: this.currentGeneration?.id || null,
                        pluginName: plugin.name || toolName,
                        durationMs: Date.now() - startedAt,
                        success: false,
                        code: error?.code || null
                    }));
                    reject(error);
                }
            );
        });
    }

    // 新增：获取 VCPLog 插件的推送函数，供其他插件依赖注入
    getVCPLogFunctions(generation = null) {
        const vcpLogModule = generation
            ? generation.serviceModules.get('VCPLog')?.runtime?.routeModule
                || generation.serviceModules.get('VCPLog')?.module
            : this.getServiceModule('VCPLog');
        const self = this;
        return {
            pushVcpLog: (data) => {
                if (vcpLogModule && typeof vcpLogModule.pushVcpLog === 'function') {
                    vcpLogModule.pushVcpLog(data);
                }
                self.emit('vcp_log', data);
            },
            pushVcpInfo: (data) => {
                if (vcpLogModule && typeof vcpLogModule.pushVcpInfo === 'function') {
                    vcpLogModule.pushVcpInfo(data);
                }
                self.emit('vcp_info', data);
            }
        };
    }

    async processToolCall(toolName, toolArgs, requestIp = null, sourceNode = null, executionOptions = {}) {
        const requestedToolName = toolName;
        const resolvedToolName = this._resolvePluginName(toolName);
        toolName = resolvedToolName.name;
        const shouldManageToolCallRecord = !executionOptions?.toolCallRecordHandle;
        const managedToolCallRecord = shouldManageToolCallRecord
            ? toolCallRecordStore.beginRecord({ toolName: requestedToolName, args: toolArgs || {}, requestIp, sourceNode })
            : null;

        this._assertDirectAdmissionOpen?.(toolName);
        const plugin = this.plugins.get(toolName);
        if (!plugin) {
            const notFoundError = new Error(`[PluginManager] Plugin "${requestedToolName}" not found for tool call.`);
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: false,
                result: { plugin_execution_error: notFoundError.message },
                error: notFoundError
            });
            throw notFoundError;
        }
        if (plugin.runtimeAvailability === 'unavailable') {
            const unavailableError = new Error(JSON.stringify({
                plugin_execution_error: `Plugin "${requestedToolName}" is unavailable.`,
                missing: plugin.runtimeUnavailableReason || []
            }));
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: false,
                result: { plugin_execution_error: unavailableError.message },
                error: unavailableError
            });
            throw unavailableError;
        }
        if (resolvedToolName.isAlias && this.debugMode) {
            console.log(`[PluginManager] Plugin alias resolved: ${requestedToolName} -> ${toolName}`);
        }

        // Helper function to generate a timestamp string
        const _getFormattedLocalTimestamp = () => {
            const date = new Date();
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
            const timezoneOffsetMinutes = date.getTimezoneOffset();
            const offsetSign = timezoneOffsetMinutes > 0 ? "-" : "+";
            const offsetHours = Math.abs(Math.floor(timezoneOffsetMinutes / 60)).toString().padStart(2, '0');
            const offsetMinutes = Math.abs(timezoneOffsetMinutes % 60).toString().padStart(2, '0');
            const timezoneString = `${offsetSign}${offsetHours}:${offsetMinutes}`;
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${timezoneString}`;
        };

        // Helper to clean up fuzzyDiff output for error/success responses
        const _filterFuzzyDiff = (resultObj, timestamp) => {
            if (resultObj && typeof resultObj === 'object' &&
                resultObj.fuzzyDiff && typeof resultObj.fuzzyDiff === 'object') {
                const { candidateFile, diff } = resultObj.fuzzyDiff;
                resultObj.fuzzyDiff = { candidateFile, diff, timestamp };
            }
        };

        const maidNameFromArgs = toolArgs && toolArgs.maid ? toolArgs.maid : null;
        let pluginSpecificArgs = { ...toolArgs };

        if (maidNameFromArgs && sourceNode) {
            console.log(`[VCPToolUse]来自${sourceNode}节点(${requestIp || '未知IP'})的${maidNameFromArgs}调用了${toolName}`);
        }

        if (maidNameFromArgs) {
            // The 'maid' parameter is intentionally passed through for plugins like DeepMemo.
            // delete pluginSpecificArgs.maid;
        }

        // --- 预先拉取所有的异地文件，将其透明化 ---
        // 逻辑漏洞修复：如果是分布式插件，则不进行预拉取，直接透传 file:// 协议，由分布式端自行处理
        if (!plugin.isDistributed) {
            const resolveArgsUrls = async (obj) => {
                if (!obj || typeof obj !== 'object') return;
                for (const key of Object.keys(obj)) {
                    const val = obj[key];
                    if (typeof val === 'string') {
                        if (val.startsWith('file://')) {
                            if (this.debugMode) console.log(`[PluginManager] Intercepted file URL in args: ${val}`);
                            obj[key] = await FileFetcherServer.resolveFileUrl(val, requestIp);
                        } else if (val.includes('file://')) {
                            // 优化正则表达式：增加对中文标点（），。？！）和换行符的排除，防止匹配过长导致解析失败
                            const fileRegex = /file:\/\/[^\s"'()\]\}\>，。？！）\r\n]+/g;
                            const matches = val.match(fileRegex);
                            if (matches) {
                                let newVal = val;
                                for (const matchUrl of matches) {
                                    if (this.debugMode) console.log(`[PluginManager] Intercepted embedded file URL in args: ${matchUrl}`);
                                    const resolvedUrl = await FileFetcherServer.resolveFileUrl(matchUrl, requestIp);
                                    newVal = newVal.split(matchUrl).join(resolvedUrl); // replaceAll fallback
                                }
                                obj[key] = newVal;
                            }
                        }
                    } else if (typeof val === 'object' && val !== null) {
                        await resolveArgsUrls(val);
                    }
                }
            };

            try {
                await resolveArgsUrls(pluginSpecificArgs);
            } catch (resolveError) {
                throw new Error(JSON.stringify({ plugin_error: `Failed to pre-fetch files: ${resolveError.message}` }));
            }
        }
        // --- 透明化处理结束 ---

        // --- 人工审核逻辑 (新增) ---
        const approvalDecision = this.toolApprovalManager.getApprovalDecision(toolName, pluginSpecificArgs);
        const sensitiveApproval = approvalReceiptAuthority.snapshot(toolName, pluginSpecificArgs, approvalDecision, this.toolApprovalManager.config);
        let approvalHandle = null;
        if (sensitiveApproval) pluginSpecificArgs = sensitiveApproval.args;
        if (approvalDecision.requiresApproval) {
            const requestId = `approve-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            if (this.debugMode) {
                console.log(
                    `[PluginManager] Tool call for "${toolName}" requires manual approval. Request ID: ${requestId}. notifyAiOnReject=${approvalDecision.notifyAiOnReject !== false}`
                );
            }

            const pending = this.approvalProtocol.create({
                requestId, toolName, args: pluginSpecificArgs, sensitiveApproval,
                timeoutMs: this.toolApprovalManager.getTimeoutMs(),
                notifyAiOnReject: approvalDecision.notifyAiOnReject !== false,
                signal: executionOptions.signal
            });
            const approvalPromise = pending.promise;

            try {
                // 发送审核请求到管理面板
                if (this.webSocketServer && this.approvalProtocol.inspect(requestId)?.state === 'PENDING') {
                    const approvalTtlMs = this.toolApprovalManager.getTimeoutMs();
                    const changePreview = buildToolChangePreview(pluginSpecificArgs);
                    const approvalRequest = {
                        type: 'tool_approval_request',
                        data: {
                            requestId,
                            protocolVersion: 1,
                            createdAt: pending.metadata.createdAt,
                            expiresAt: pending.metadata.expiresAt,
                            argsDigest: pending.metadata.argsDigest,
                            toolName,
                            maid: maidNameFromArgs,
                            args: pending.metadata.args,
                            // 提供稳定的文件变更预览协议，前端无需了解各插件的新旧参数别名。
                            ...(changePreview ? { changePreview } : {}),
                            timestamp: _getFormattedLocalTimestamp(),
                            approvalTtlMs // 同步给 VCPLog 补发缓存使用,确保超时后能自动清除
                        }
                    };
                    this.webSocketServer.broadcast(approvalRequest, 'VCPLog');
                    console.log(`[PluginManager] 🔔 正在等待工具调用人工审核: ${toolName} (ID: ${requestId})`);
                } else {
                    this.approvalProtocol.cancel(requestId);
                }

                try {
                    const approvalResult = await approvalPromise;
                    // Dispatch precisely the approved snapshot. Legacy plugins may mutate their private copy.
                    pluginSpecificArgs = sensitiveApproval ? pending.metadata.args : JSON.parse(JSON.stringify(pending.metadata.args));
                    if (sensitiveApproval) approvalHandle = approvalResult;
                    if (approvalResult && approvalResult.silentRejected === true) {
                        if (this.debugMode) {
                            console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) was rejected silently. Returning empty result to AI.`);
                        }
                        const silentRejectionRecord = {
                            status: 'rejected',
                            success: false,
                            silentRejected: true,
                            error_type: 'approval_rejected',
                            rejected_by_user: true,
                            message: `Tool call "${toolName}" was rejected silently by manual approval.`
                        };
                        toolCallRecordStore.finishRecord(managedToolCallRecord, {
                            success: false,
                            result: silentRejectionRecord,
                            error: silentRejectionRecord.message
                        });
                        return undefined;
                    }
                    if (this.debugMode) console.log(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) approved.`);
                } catch (error) {
                    if (this.debugMode) console.warn(`[PluginManager] Tool call for "${toolName}" (ID: ${requestId}) rejected: ${error.message}`);
                    throw error;
                }
            } finally { this.approvalProtocol.cancel(requestId); }
        }
        // --- 人工审核逻辑结束 ---

        try {
            let resultFromPlugin;
            if (plugin.isDistributed) {
                // --- 分布式插件调用逻辑 ---
                if (!this.webSocketServer) {
                    throw new Error('[PluginManager] WebSocketServer is not initialized. Cannot call distributed tool.');
                }
                if (this.debugMode) console.log(`[PluginManager] Processing distributed tool call for: ${toolName} on server ${plugin.serverId}`);
                resultFromPlugin = await this.webSocketServer.executeDistributedTool(plugin.serverId, toolName, pluginSpecificArgs);
                // 分布式工具的返回结果应该已经是JS对象了
            } else if (toolName === 'ChromeControl' && plugin.communication?.protocol === 'direct') {
                // --- ChromeControl 特殊处理逻辑 ---
                if (!this.webSocketServer) {
                    throw new Error('[PluginManager] WebSocketServer is not initialized. Cannot call ChromeControl tool.');
                }
                if (this.debugMode) console.log(`[PluginManager] Processing direct WebSocket tool call for: ${toolName}`);
                const command = pluginSpecificArgs.command;
                delete pluginSpecificArgs.command;
                resultFromPlugin = await this.webSocketServer.forwardCommandToChrome(command, pluginSpecificArgs);

            } else if (plugin.pluginType === 'hybridservice' && plugin.communication?.protocol === 'direct') {
                // --- 混合服务插件直接调用逻辑 ---
                if (this.debugMode) console.log(`[PluginManager] Processing direct tool call for hybrid service: ${toolName}`);
                const serviceModule = this.getServiceModule(toolName);
                if (!serviceModule) {
                    throw new Error(`[PluginManager] Hybrid service plugin "${toolName}" module not found. It may have failed to load or initialize during hot-reload.`);
                }
                const serviceRuntime = this.currentGeneration?.runtimes.get(toolName);
                if (!serviceRuntime && typeof serviceModule.processToolCall !== 'function') {
                    throw new Error(`[PluginManager] Hybrid service plugin "${toolName}" does not have a process/processToolCall function.`);
                }
                const directContext = {
                    requestIp,
                    sourceNode,
                    pluginName: toolName
                };
                if (plugin.requiresAdmin) {
                    const decryptedCode = await this._getDecryptedAuthCode();
                    if (decryptedCode) {
                        directContext.decryptedAuthCode = decryptedCode;
                        if (this.debugMode) console.log(`[PluginManager] Provided decrypted auth context for admin-required hybrid plugin: ${toolName}`);
                    } else {
                        console.error(`[PluginManager] Failed to obtain auth code for admin-required hybrid plugin: ${toolName}. Execution denied.`);
                        throw new Error(JSON.stringify({ plugin_error: `Plugin "${toolName}" requires admin authentication, but auth code could not be obtained. Execution denied.` }));
                    }
                }
                if (approvalHandle) approvalReceiptAuthority.bindInvocation(approvalHandle, directContext, pluginSpecificArgs);
                try { resultFromPlugin = await this._executeDirectToolCallWithTimeout(
                    plugin,
                    toolName,
                    serviceModule,
                    pluginSpecificArgs,
                    directContext
                ); } finally { approvalReceiptAuthority.finishInvocation(directContext); }
            } else {
                // --- 本地插件调用逻辑 (现有逻辑) ---
                if (!((plugin.pluginType === 'synchronous' || plugin.pluginType === 'asynchronous') && plugin.communication?.protocol === 'stdio')) {
                    throw new Error(`[PluginManager] Local plugin "${toolName}" (type: ${plugin.pluginType}) is not a supported stdio plugin for direct tool call.`);
                }

                let executionParam = null;
                if (Object.keys(pluginSpecificArgs).length > 0) {
                    executionParam = JSON.stringify(pluginSpecificArgs);
                }

                const logParam = executionParam ? (executionParam.length > 100 ? executionParam.substring(0, 100) + '...' : executionParam) : null;
                if (this.debugMode) console.log(`[PluginManager] Calling local executePlugin for: ${toolName} with prepared param:`, logParam);

                const pluginOutput = await this.executePlugin(toolName, executionParam, requestIp, executionOptions); // Returns {status, result/error}

                if (pluginOutput.__vcpArcheryNoReplySilent) {
                    toolCallRecordStore.finishRecord(managedToolCallRecord, {
                        success: true,
                        result: pluginOutput.result
                    });
                    if (managedToolCallRecord?.id && pluginOutput.result && typeof pluginOutput.result === 'object' && !pluginOutput.result.tool_call_record_id) {
                        pluginOutput.result.tool_call_record_id = managedToolCallRecord.id;
                    }
                    return pluginOutput.result;
                }

                if (pluginOutput.status === "success") {
                    if (typeof pluginOutput.result === 'string') {
                        try {
                            // If the result is a string, try to parse it as JSON.
                            resultFromPlugin = JSON.parse(pluginOutput.result);
                        } catch (parseError) {
                            // If parsing fails, wrap it. This is for plugins that return plain text.
                            if (this.debugMode) console.warn(`[PluginManager] Local plugin ${toolName} result string was not valid JSON. Original: "${pluginOutput.result.substring(0, 100)}"`);
                            resultFromPlugin = { original_plugin_output: pluginOutput.result };
                        }
                    } else {
                        // If the result is already an object (as with our new image plugins), use it directly.
                        resultFromPlugin = pluginOutput.result;
                    }
                } else {
                    const normalizedPluginOutput = {};
                    if (pluginOutput.result) {
                        normalizedPluginOutput.result = pluginOutput.result;
                    }
                    normalizedPluginOutput.plugin_error = pluginOutput.error || `Plugin "${toolName}" reported an unspecified error.`;
                    _filterFuzzyDiff(normalizedPluginOutput, _getFormattedLocalTimestamp());
                    throw new Error(JSON.stringify(normalizedPluginOutput));
                }
            }

            // --- 通用结果处理 ---
            // 兼容 direct/hybrid 插件主动返回 stdio 风格的 { status, result } 包装。
            // stdio 插件会在上方被解包到 pluginOutput.result；direct 插件没有这一步，
            // 因此这里补齐一次，使 direct 插件也能返回与 VSearch 相同的
            // { status: "success", result: { content: [...] } } 形态。
            if (
                resultFromPlugin &&
                typeof resultFromPlugin === 'object' &&
                resultFromPlugin.status === 'success' &&
                resultFromPlugin.result &&
                typeof resultFromPlugin.result === 'object'
            ) {
                resultFromPlugin = resultFromPlugin.result;
            }

            let finalResultObject = (typeof resultFromPlugin === 'object' && resultFromPlugin !== null) ? resultFromPlugin : { original_plugin_output: resultFromPlugin };

            if (maidNameFromArgs) {
                finalResultObject.MaidName = maidNameFromArgs;
            }
            finalResultObject.timestamp = _getFormattedLocalTimestamp();
            _filterFuzzyDiff(finalResultObject, _getFormattedLocalTimestamp());

            const sanitizedResult = this._sanitizeToolResultForAi(finalResultObject);
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: true,
                result: sanitizedResult
            });
            if (managedToolCallRecord?.id && sanitizedResult && typeof sanitizedResult === 'object' && !sanitizedResult.tool_call_record_id) {
                sanitizedResult.tool_call_record_id = managedToolCallRecord.id;
            }
            return sanitizedResult;

        } catch (e) {
            console.error(`[PluginManager processToolCall] Error during execution for plugin ${toolName}:`, e.message);
            let errorObject;
            try {
                errorObject = JSON.parse(e.message);
            } catch (jsonParseError) {
                errorObject = { plugin_execution_error: e.message || 'Unknown plugin execution error' };
            }

            if (maidNameFromArgs && !errorObject.MaidName) {
                errorObject.MaidName = maidNameFromArgs;
            }
            if (!errorObject.timestamp) {
                errorObject.timestamp = _getFormattedLocalTimestamp();
            }
            _filterFuzzyDiff(errorObject, _getFormattedLocalTimestamp());
            const sanitizedErrorObject = this._sanitizeToolResultForAi(errorObject);
            toolCallRecordStore.finishRecord(managedToolCallRecord, {
                success: false,
                result: sanitizedErrorObject,
                error: e
            });
            if (managedToolCallRecord?.id && sanitizedErrorObject && typeof sanitizedErrorObject === 'object' && !sanitizedErrorObject.tool_call_record_id) {
                sanitizedErrorObject.tool_call_record_id = managedToolCallRecord.id;
            }
            throw new Error(JSON.stringify(sanitizedErrorObject));
        }
    }

    async executePlugin(pluginName, inputData, requestIp = null, executionOptions = {}) {
        const requestedPluginName = pluginName;
        const resolvedPluginName = this._resolvePluginName(pluginName);
        pluginName = resolvedPluginName.name;
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            // This case should ideally be caught by processToolCall before calling executePlugin
            throw new Error(`[PluginManager executePlugin] Plugin "${requestedPluginName}" not found.`);
        }
        if (plugin.runtimeAvailability === 'unavailable') {
            throw new Error(JSON.stringify({
                plugin_error: `Plugin "${pluginName}" is unavailable because its Python runtime requirements are not satisfied.`,
                missing: plugin.runtimeUnavailableReason || []
            }));
        }
        // Validations for pluginType, communication, entryPoint remain important
        if (!((plugin.pluginType === 'synchronous' || plugin.pluginType === 'asynchronous') && plugin.communication?.protocol === 'stdio')) {
            throw new Error(`[PluginManager executePlugin] Plugin "${pluginName}" (type: ${plugin.pluginType}, protocol: ${plugin.communication?.protocol}) is not a supported stdio plugin. Expected synchronous or asynchronous stdio plugin.`);
        }
        if (!plugin.entryPoint || !plugin.entryPoint.command) {
            throw new Error(`[PluginManager executePlugin] Entry point command undefined for plugin "${pluginName}".`);
        }

        const pluginConfig = this._getPluginConfig(plugin);
        const additionalEnv = {};
        if (this.projectBasePath) {
            additionalEnv.PROJECT_BASE_PATH = this.projectBasePath;
        } else {
            if (this.debugMode) console.warn("[PluginManager executePlugin] projectBasePath not set, PROJECT_BASE_PATH will not be available to plugins.");
        }

        const executionContext = (
            executionOptions?.executionContext
            && typeof executionOptions.executionContext === 'object'
        ) ? executionOptions.executionContext : (
            executionOptions && (
                executionOptions.requestSource ||
                executionOptions.agentAlias ||
                executionOptions.agentId ||
                executionOptions.executionContext
            )
                ? executionOptions
                : null
        );
        if (executionContext && typeof executionContext === 'object') {
            if (executionContext.requestSource) {
                additionalEnv.VCP_REQUEST_SOURCE = executionContext.requestSource;
            }
            if (executionContext.agentAlias) {
                additionalEnv.VCP_AGENT_ALIAS = executionContext.agentAlias;
            }
            if (executionContext.agentId) {
                additionalEnv.VCP_AGENT_ID = executionContext.agentId;
            }
            if (executionContext.executionContext) {
                additionalEnv.VCP_EXECUTION_CONTEXT = executionContext.executionContext;
            }
        }

        // 如果插件需要管理员权限，则获取解密后的验证码并注入环境变量
        if (plugin.requiresAdmin) {
            if (this._isExternalPluginManifest(plugin)) {
                throw new Error(`External plugin "${pluginName}" cannot receive admin authentication.`);
            }
            const decryptedCode = await this._getDecryptedAuthCode();
            if (decryptedCode) {
                additionalEnv.DECRYPTED_AUTH_CODE = decryptedCode;
                if (this.debugMode) console.log(`[PluginManager] Injected DECRYPTED_AUTH_CODE for admin-required plugin: ${pluginName}`);
            } else {
                console.error(`[PluginManager] Failed to obtain auth code for admin-required plugin: ${pluginName}. Execution denied.`);
                throw new Error(JSON.stringify({ plugin_error: `Plugin "${pluginName}" requires admin authentication, but auth code could not be obtained. Execution denied.` }));
            }
        }
        // 将 requestIp 添加到环境变量
        if (requestIp) {
            additionalEnv.VCP_REQUEST_IP = requestIp;
        }
        if (process.env.PORT) {
            additionalEnv.SERVER_PORT = process.env.PORT;
        }
        const imageServerKey = this.getResolvedPluginConfigValue('ImageServer', 'Image_Key');
        if (imageServerKey) {
            additionalEnv.IMAGESERVER_IMAGE_KEY = imageServerKey;
        }
        const fileServerKey = this.getResolvedPluginConfigValue('ImageServer', 'File_Key');
        if (fileServerKey) {
            additionalEnv.IMAGESERVER_FILE_KEY = fileServerKey;
        }

        // 新增：注入 SSHManagerService 的 UDS 路径（如果服务已启动）
        const sshManagerSock = global.__vcp_ssh_manager_sock;
        if (sshManagerSock && this._shouldInjectSSHManagerEnvForExecution(pluginName, plugin, inputData)) {
            additionalEnv.SSH_MANAGER_SOCK = sshManagerSock;
            if (global.__vcp_ssh_manager_token) {
                additionalEnv.SSH_MANAGER_TOKEN = global.__vcp_ssh_manager_token;
            }
            if (this.debugMode) console.log(`[PluginManager] 注入 SSH_MANAGER_SOCK=${sshManagerSock} 到插件 ${pluginName}`);
        } else if (sshManagerSock && this.debugMode) {
            console.log(`[PluginManager] 跳过向非白名单插件 ${pluginName} 注入 SSH_MANAGER_SOCK`);
        }

        // 注入 LinuxLogMonitorServer 的 UDS 路径和 token（仅限白名单插件）
        const logMonitorSock = global.__vcp_log_monitor_sock;
        if (logMonitorSock && this._shouldInjectLogMonitorEnv(pluginName, plugin)) {
            additionalEnv.LOG_MONITOR_SOCK = logMonitorSock;
            if (global.__vcp_log_monitor_token) {
                additionalEnv.LOG_MONITOR_TOKEN = global.__vcp_log_monitor_token;
            }
            if (this.debugMode) console.log(`[PluginManager] 注入 LOG_MONITOR_SOCK=${logMonitorSock} 到插件 ${pluginName}`);
        } else if (logMonitorSock && this.debugMode) {
            console.log(`[PluginManager] 跳过向非白名单插件 ${pluginName} 注入 LOG_MONITOR_SOCK`);
        }

        // Pass CALLBACK_BASE_URL and PLUGIN_NAME to asynchronous plugins
        if (plugin.pluginType === 'asynchronous') {
            const callbackBaseUrl = pluginConfig.CALLBACK_BASE_URL || process.env.CALLBACK_BASE_URL; // Prefer plugin-specific, then global
            if (callbackBaseUrl) {
                additionalEnv.CALLBACK_BASE_URL = callbackBaseUrl;
            } else {
                if (this.debugMode) console.warn(`[PluginManager executePlugin] CALLBACK_BASE_URL not configured for asynchronous plugin ${pluginName}. Callback functionality might be impaired.`);
            }
            additionalEnv.PLUGIN_NAME_FOR_CALLBACK = pluginName; // Pass the plugin's name
            if (!this._isExternalPluginManifest(plugin) && process.env.Key) {
                additionalEnv.VCP_CALLBACK_BEARER_TOKEN = process.env.Key;
            }
        }

        // Force Python stdio encoding to UTF-8
        additionalEnv.PYTHONIOENCODING = 'utf-8';
        const finalEnv = this._buildPluginProcessEnv(plugin, pluginConfig, additionalEnv);

        if (this.debugMode && plugin.pluginType === 'asynchronous') {
            const scope = this._isExternalPluginManifest(plugin) ? 'External' : 'Core';
            console.log(`[PluginManager executePlugin] ${scope} async plugin ${pluginName} runtime env keys:`, formatRuntimeEnvDebugKeyList(finalEnv));
        }

        return new Promise((resolve, reject) => {
            if (this.debugMode) console.log(`[PluginManager executePlugin Internal] For plugin "${pluginName}", manifest entryPoint command is: "${plugin.entryPoint.command}"`);
            const { command, args } = this._resolvePluginEntryCommand(plugin);
            if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Attempting to spawn command: "${command}" with args: [${args.join(', ')}] in cwd: ${plugin.basePath}`);

            const pluginProcess = this._spawnPluginProcess(command, args, { cwd: plugin.basePath, shell: true, env: finalEnv, windowsHide: true });


            let outputBuffer = ''; // Buffer to accumulate data chunks
            let errorOutput = '';
            let processExited = false;
            let initialResponseSent = false; // Flag for async plugins
            const isAsyncPlugin = plugin.pluginType === 'asynchronous';
            const isArcheryNoReply = isAsyncPlugin && executionOptions?.archeryNoReply === true;
            const noReplyGraceMs = Number.isFinite(Number(executionOptions?.archeryNoReplyGraceMs))
                ? Math.max(0, Number(executionOptions.archeryNoReplyGraceMs))
                : 3000;

            const timeoutDuration = plugin.communication.timeout || (isAsyncPlugin ? 1800000 : 60000); // Use manifest timeout, or 30min for async, 1min for sync

            const timeoutId = setTimeout(() => {
                if (!processExited && !initialResponseSent && isAsyncPlugin) {
                    // For async, if initial response not sent by timeout, it's an error for that phase
                    console.error(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" initial response timed out after ${timeoutDuration}ms.`);
                    this._killProcessTree(pluginProcess.pid, pluginName);
                    reject(new Error(`Plugin "${pluginName}" initial response timed out.`));
                } else if (!processExited && !isAsyncPlugin) {
                    // For sync plugins, or if async initial response was sent but process hangs
                    console.error(`[PluginManager executePlugin Internal] Plugin "${pluginName}" execution timed out after ${timeoutDuration}ms.`);
                    this._killProcessTree(pluginProcess.pid, pluginName);
                    reject(new Error(`Plugin "${pluginName}" execution timed out.`));
                } else if (!processExited && isAsyncPlugin && initialResponseSent) {
                    // Async plugin's initial response was sent, but the process is still running (e.g. for background tasks)
                    // We let it run, but log if it exceeds the overall timeout.
                    // The process will be managed by its own non-daemon threads.
                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" process is still running in background after timeout. This is expected for non-daemon threads.`);
                }
            }, timeoutDuration);

            const resolveArcheryNoReplySilent = (reason) => {
                if (!isArcheryNoReply || processExited || initialResponseSent) return false;
                initialResponseSent = true;
                if (this.debugMode) {
                    console.log(`[PluginManager executePlugin Internal] Async no-reply plugin "${pluginName}" resolved silently. reason=${reason}`);
                }
                resolve({
                    status: "success",
                    __vcpArcheryNoReplySilent: true,
                    result: {
                        status: "success",
                        noReply: true,
                        __vcpArcheryNoReplySilent: true,
                        toolName: pluginName,
                        message: `Async no-reply tool "${pluginName}" accepted silently (${reason}).`
                    }
                });
                return true;
            };

            const noReplyTimerId = isArcheryNoReply ? setTimeout(() => {
                resolveArcheryNoReplySilent(`no_response_after_${noReplyGraceMs}ms`);
            }, noReplyGraceMs) : null;

            pluginProcess.stdout.setEncoding('utf8');
            pluginProcess.stdout.on('data', (data) => {
                if (processExited || (isAsyncPlugin && initialResponseSent)) {
                    // If async and initial response sent, or process exited, ignore further stdout for this Promise.
                    // The plugin's background task might still log to its own stdout, but we don't collect it here.
                    if (this.debugMode && isAsyncPlugin && initialResponseSent) console.log(`[PluginManager executePlugin Internal] Async plugin ${pluginName} (initial response sent) produced more stdout: ${scrubPluginDiagnosticSnippet(data, 100)}...`);
                    return;
                }
                outputBuffer += data;
                try {
                    // Try to parse a complete JSON object from the buffer.
                    // This is a simple check; for robust streaming JSON, a more complex parser is needed.
                    // We assume the first complete JSON is the one we want for async initial response.
                    const potentialJsonMatch = outputBuffer.match(/(\{[\s\S]*?\})(?:\s|$)/);
                    if (potentialJsonMatch && potentialJsonMatch[1]) {
                        const jsonString = potentialJsonMatch[1];
                        const parsedOutput = JSON.parse(jsonString);

                        if (parsedOutput && (parsedOutput.status === "success" || parsedOutput.status === "error")) {
                            if (isAsyncPlugin) {
                                if (!initialResponseSent) {
                                    if (noReplyTimerId) clearTimeout(noReplyTimerId);
                                    if (isArcheryNoReply && parsedOutput.status === "success") {
                                        resolveArcheryNoReplySilent('initial_success_json');
                                        return;
                                    }
                                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" sent initial JSON response. Resolving promise.`);
                                    initialResponseSent = true;
                                    // For async, we resolve with the first valid JSON and let the process continue if it has non-daemon threads.
                                    // We don't clear the main timeout here for async, as the process might still need to be killed if it misbehaves badly later.
                                    // However, the primary purpose of this promise is fulfilled.
                                    resolve(parsedOutput);
                                    // We don't return or clear outputBuffer here, as more data might be part of a *synchronous* plugin's single large JSON output.
                                }
                            } else { // Synchronous plugin
                                // For sync plugins, we wait for 'exit' to ensure all output is collected.
                                // This block within 'data' event is more for validating if the output *looks* like our expected JSON.
                                // The actual resolve for sync plugins happens in 'exit'.
                                if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Sync plugin "${pluginName}" current output buffer contains a potential JSON.`);
                            }
                        }
                    }
                } catch (e) {
                    // Incomplete JSON or invalid JSON, wait for more data or 'exit' event.
                    if (this.debugMode && outputBuffer.length > 2) console.log(`[PluginManager executePlugin Internal] Plugin "${pluginName}" stdout buffer not yet a complete JSON or invalid. Buffer: ${scrubPluginDiagnosticSnippet(outputBuffer, 100)}...`);
                }
            });

            pluginProcess.stderr.setEncoding('utf8');
            pluginProcess.stderr.on('data', (data) => {
                errorOutput += data;
                if (this.debugMode) console.warn(`[PluginManager executePlugin Internal stderr] Plugin "${pluginName}": ${scrubPluginDiagnosticText(data.trim())}`);
            });

            pluginProcess.on('error', (err) => {
                processExited = true; clearTimeout(timeoutId);
                if (noReplyTimerId) clearTimeout(noReplyTimerId);
                const safeMessage = scrubPluginDiagnosticText(err.message);
                if (!initialResponseSent) { // Only reject if initial response (for async) or any response (for sync) hasn't been sent
                    reject(new Error(`Failed to start plugin "${pluginName}": ${safeMessage}`));
                } else if (this.debugMode) {
                    console.error(`[PluginManager executePlugin Internal] Error after initial response for async plugin "${pluginName}": ${safeMessage}. Process might have been expected to continue.`);
                }
            });

            pluginProcess.on('exit', (code, signal) => {
                processExited = true;
                clearTimeout(timeoutId); // Clear the main timeout once the process exits.
                if (noReplyTimerId) clearTimeout(noReplyTimerId);

                if (isAsyncPlugin && initialResponseSent) {
                    // For async plugins where initial response was already sent, log exit but don't re-resolve/reject.
                    if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Async plugin "${pluginName}" process exited with code ${code}, signal ${signal} after initial response was sent.`);
                    return;
                }

                // If we are here, it's either a sync plugin, or an async plugin whose initial response was NOT sent before exit.

                if (signal === 'SIGKILL' || signal === 'SIGTERM') { // Typically means timeout killed it
                    if (!initialResponseSent) reject(new Error(`Plugin "${pluginName}" execution timed out or was killed.`));
                    return;
                }

                try {
                    const parsedOutput = JSON.parse(outputBuffer.trim()); // Use accumulated outputBuffer
                    if (parsedOutput && (parsedOutput.status === "success" || parsedOutput.status === "error")) {
                        if (code !== 0 && parsedOutput.status === "success" && this.debugMode) {
                            console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" exited with code ${code} but reported success in JSON. Trusting JSON.`);
                        }
                        if (code === 0 && parsedOutput.status === "error" && this.debugMode) {
                            console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" exited with code 0 but reported error in JSON. Trusting JSON.`);
                        }
                        if (errorOutput.trim()) parsedOutput.pluginStderr = scrubPluginDiagnosticText(errorOutput.trim());

                        if (!initialResponseSent) resolve(parsedOutput); // Ensure resolve only once
                        else if (this.debugMode) console.log(`[PluginManager executePlugin Internal] Plugin ${pluginName} exited, initial async response already sent.`);
                        return;
                    }
                    if (this.debugMode) console.warn(`[PluginManager executePlugin Internal] Plugin "${pluginName}" final stdout was not in the expected JSON format: ${scrubPluginDiagnosticSnippet(outputBuffer.trim(), 100)}`);
                } catch (e) {
                    if (this.debugMode) console.warn(`[PluginManager executePlugin Internal] Failed to parse final stdout JSON from plugin "${pluginName}". Error: ${scrubPluginDiagnosticText(e.message)}. Stdout: ${scrubPluginDiagnosticSnippet(outputBuffer.trim(), 100)}`);
                }

                if (!initialResponseSent) { // Only reject if no response has been sent yet
                    if (isArcheryNoReply && code === 0) {
                        initialResponseSent = true;
                        if (this.debugMode) {
                            console.log(`[PluginManager executePlugin Internal] Async no-reply plugin "${pluginName}" exited with code 0 before initial JSON. Resolving silently.`);
                        }
                        resolve({
                            status: "success",
                            __vcpArcheryNoReplySilent: true,
                            result: {
                                status: "success",
                                noReply: true,
                                __vcpArcheryNoReplySilent: true,
                                toolName: pluginName,
                                message: `Async no-reply tool "${pluginName}" exited successfully before initial JSON.`
                            }
                        });
                    } else if (code !== 0) {
                        let detailedError = `Plugin "${pluginName}" exited with code ${code}.`;
                        if (outputBuffer.trim()) detailedError += ` Stdout: ${scrubPluginDiagnosticSnippet(outputBuffer.trim(), 200)}`;
                        if (errorOutput.trim()) detailedError += ` Stderr: ${scrubPluginDiagnosticSnippet(errorOutput.trim(), 200)}`;
                        reject(new Error(detailedError));
                    } else {
                        // Exit code 0, but no valid initial JSON response was sent/parsed.
                        reject(new Error(`Plugin "${pluginName}" exited successfully but did not provide a valid initial JSON response. Stdout: ${scrubPluginDiagnosticSnippet(outputBuffer.trim(), 200)}`));
                    }
                }
            });

            try {
                if (inputData !== undefined && inputData !== null) {
                    pluginProcess.stdin.write(inputData.toString());
                }
                pluginProcess.stdin.end();
            } catch (e) {
                const safeMessage = scrubPluginDiagnosticText(e.message);
                console.error(`[PluginManager executePlugin Internal] Stdin write error for "${pluginName}": ${safeMessage}`);
                if (!initialResponseSent) { // Only reject if no response has been sent yet
                    reject(new Error(`Stdin write error for "${pluginName}": ${safeMessage}`));
                }
            }
        });
    }

    handleApprovalResponse(requestId, approved, reason, approvalConnection = null) {
        return this.handleApprovalResponseOutcome({ requestId, approved, reason }, approvalConnection).outcome === 'ACCEPTED';
    }

    handleApprovalResponseOutcome(data, approvalConnection) {
        // Protocol checks remain authoritative; this guard preserves the H1 sensitive gate.
        const pending = this.approvalProtocol.inspect(data?.requestId);
        if (pending?.toolName === 'CodexWorker' && ['grant', 'revoke'].includes(pending.command)
            && !approvalReceiptAuthority.isHuman(approvalConnection)) {
            return { protocolVersion: 1, requestId: typeof data?.requestId === 'string' && data.requestId.length <= 200 ? data.requestId : null,
                outcome: 'CLIENT_NOT_AUTHORIZED', terminalState: null };
        }
        return this.approvalProtocol.respond(data, approvalConnection);
    }

    syncApprovals(connection) { return this.approvalProtocol.sync(connection); }
    cancelPendingApprovals() { this.approvalProtocol.cancelAll(); }

    async initializeServices(app, adminApiRouter, projectBasePath) {
        if (!app) {
            console.error('[PluginManager] Cannot initialize services without Express app instance.');
            return;
        }
        if (!adminApiRouter) {
            console.error('[PluginManager] Cannot initialize services without adminApiRouter instance.');
            return;
        }
        if (!projectBasePath) {
            console.error('[PluginManager] Cannot initialize services without projectBasePath.'); // Keep error
            return;
        }
        if (this.runtimeV2Enabled) {
            this.serviceHost = { app, adminApiRouter, projectBasePath };
            if (!this.serviceDispatchersMounted) {
                app.use((req, res, next) => {
                    const generation = this.currentGeneration;
                    if (!generation) return next();
                    if (this.runtimeState !== 'READY') {
                        return res.status(503).json({
                            error: 'Plugin runtime is temporarily unavailable.',
                            state: this.runtimeState,
                            generation: generation.id
                        });
                    }
                    return generation.publicRouter(req, res, next);
                });
                adminApiRouter.use((req, res, next) => {
                    const generation = this.currentGeneration;
                    if (!generation) return next();
                    if (this.runtimeState !== 'READY') {
                        return res.status(503).json({
                            error: 'Plugin runtime is temporarily unavailable.',
                            state: this.runtimeState,
                            generation: generation.id
                        });
                    }
                    return generation.adminRouter(req, res, next);
                });
                this.serviceDispatchersMounted = true;
            }
            await this._registerGenerationRoutes(this.currentGeneration);
            console.log(
                `[PluginManager] Runtime V2 service dispatchers ready for generation ` +
                `${this.currentGeneration?.id || 'none'}.`
            );
            return;
        }
        console.log('[PluginManager] Initializing service plugins...'); // Keep
        for (const [name, serviceData] of this.serviceModules) {
            try {
                const pluginConfig = this._getPluginConfig(serviceData.manifest);
                const manifest = serviceData.manifest;
                const module = serviceData.module;

                // 新的、带命名空间的API路由注册机制
                if (manifest.hasApiRoutes && typeof module.registerApiRoutes === 'function') {
                    if (this.debugMode) console.log(`[PluginManager] Registering namespaced API routes for service plugin: ${name}`);
                    const pluginRouter = express.Router();
                    // 将 router 和其他上下文传递给插件
                    module.registerApiRoutes(pluginRouter, pluginConfig, projectBasePath, this.webSocketServer);
                    // 统一挂载到带命名空间的前缀下
                    app.use(`/api/plugins/${name}`, pluginRouter);
                    if (this.debugMode) console.log(`[PluginManager] Mounted API routes for ${name} at /api/plugins/${name}`);
                }

                // VCPLog 特殊处理：注入 WebSocketServer 的广播函数
                if (name === 'VCPLog' && this.webSocketServer && typeof module.setBroadcastFunctions === 'function') {
                    if (typeof this.webSocketServer.broadcastVCPInfo === 'function') {
                        module.setBroadcastFunctions(this.webSocketServer.broadcastVCPInfo);
                        if (this.debugMode) console.log(`[PluginManager] Injected broadcastVCPInfo into VCPLog.`);
                    } else {
                        console.warn(`[PluginManager] WebSocketServer is missing broadcastVCPInfo function. VCPInfo will not be broadcastable.`);
                    }
                }

                // 兼容旧的、直接在 app 上注册的 service 插件
                if (typeof module.registerRoutes === 'function') {
                    if (this.debugMode) console.log(`[PluginManager] Registering legacy routes for service plugin: ${name}`);
                    if (module.registerRoutes.length >= 4) {
                        if (this.debugMode) console.log(`[PluginManager] Calling new-style legacy registerRoutes for ${name} (4+ args).`);
                        module.registerRoutes(app, adminApiRouter, pluginConfig, projectBasePath);
                    } else {
                        if (this.debugMode) console.log(`[PluginManager] Calling legacy-style registerRoutes for ${name} (3 args).`);
                        module.registerRoutes(app, pluginConfig, projectBasePath);
                    }
                }

            } catch (e) {
                console.error(`[PluginManager] Error initializing service plugin ${name}:`, e); // Keep error
            }
        }
        console.log('[PluginManager] Service plugins initialized.'); // Keep
    }
    // --- 新增分布式插件管理方法 ---
    registerDistributedTools(serverId, tools) {
        if (this.debugMode) console.log(`[PluginManager] Registering ${tools.length} tools from distributed server: ${serverId}`);
        for (const toolManifest of tools) {
            if (!toolManifest.name || !toolManifest.pluginType || !toolManifest.entryPoint) {
                if (this.debugMode) console.warn(`[PluginManager] Invalid manifest from ${serverId} for tool '${toolManifest.name}'. Skipping.`);
                continue;
            }
            if (this.plugins.has(toolManifest.name)) {
                if (this.debugMode) console.warn(`[PluginManager] Distributed tool '${toolManifest.name}' from ${serverId} conflicts with an existing tool. Skipping.`);
                continue;
            }

            // 标记为分布式插件并存储其来源服务器ID
            toolManifest.isDistributed = true;
            toolManifest.serverId = serverId;

            // 在显示名称前加上[云端]前缀
            toolManifest.displayName = `[云端] ${toolManifest.displayName || toolManifest.name}`;

            this.plugins.set(toolManifest.name, toolManifest);
            console.log(`[PluginManager] Registered distributed tool: ${toolManifest.displayName} (${toolManifest.name}) from ${serverId}`);
        }
        // 注册后重建描述，以包含新插件
        this.buildVCPDescription();
        this.emit('tools_changed', { reason: 'distributed_register', serverId });
    }

    unregisterAllDistributedTools(serverId) {
        if (this.debugMode) console.log(`[PluginManager] Unregistering all tools from distributed server: ${serverId}`);
        let unregisteredCount = 0;
        const unregisteredPluginNames = [];
        const unregisteredManifests = [];
        for (const [name, manifest] of this.plugins.entries()) {
            if (manifest.isDistributed && manifest.serverId === serverId) {
                unregisteredPluginNames.push(name);
                unregisteredManifests.push(JSON.parse(JSON.stringify(manifest)));
            }
        }
        if (unregisteredPluginNames.length > 0) {
            this.emit('distributed_tools_offline', { serverId, pluginNames: unregisteredPluginNames, manifests: unregisteredManifests });
        }
        for (const name of unregisteredPluginNames) {
            if (this.plugins.delete(name)) {
                unregisteredCount++;
                if (this.debugMode) console.log(`  - Unregistered: ${name}`);
            }
        }
        if (unregisteredCount > 0) {
            console.log(`[PluginManager] Unregistered ${unregisteredCount} tools from server ${serverId}.`);
            // 注销后重建描述
            this.buildVCPDescription();
        }

        // 新增：清理分布式静态占位符
        if (unregisteredCount > 0) {
            this.emit('tools_changed', { reason: 'distributed_unregister', serverId, pluginNames: unregisteredPluginNames });
        }
        this.clearDistributedStaticPlaceholders(serverId);
    }

    // 新增：更新分布式静态占位符
    updateDistributedStaticPlaceholders(serverId, serverName, placeholders) {
        if (this.debugMode) {
            console.log(`[PluginManager] Updating static placeholders from distributed server ${serverName} (${serverId})`);
        }

        for (const [placeholder, value] of Object.entries(placeholders)) {
            // 兼容 JSON 折叠对象与共享文本折叠协议
            let parsedValue = value;
            if (typeof value === 'string') {
                const trimmedValue = value.trim();
                parsedValue = trimmedValue;

                if (trimmedValue.startsWith('{')) {
                    try {
                        const jsonObj = JSON.parse(trimmedValue);
                        if (jsonObj && jsonObj.vcp_dynamic_fold) {
                            parsedValue = jsonObj; // 保持对象形式以供折叠处理
                        }
                    } catch (e) {
                        if (hasFoldMarkers(trimmedValue)) {
                            parsedValue = buildDynamicFoldObject({
                                content: trimmedValue,
                                pluginDescription: placeholder,
                                strategy: 'toolbox_block_similarity'
                            });
                        }
                    }
                } else if (hasFoldMarkers(trimmedValue)) {
                    parsedValue = buildDynamicFoldObject({
                        content: trimmedValue,
                        pluginDescription: placeholder,
                        strategy: 'toolbox_block_similarity'
                    });
                }
            }

            // 为分布式占位符添加服务器来源标识
            this.staticPlaceholderValues.set(placeholder, { value: parsedValue, serverId: serverId });

            if (this.debugMode) {
                const logVal = typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : parsedValue;
                console.log(`[PluginManager] Updated distributed placeholder ${placeholder} from ${serverName}: ${logVal.substring(0, 100)}${logVal.length > 100 ? '...' : ''}`);
            }
        }

        // 强制日志记录分布式静态占位符更新
        console.log(`[PluginManager] Updated ${Object.keys(placeholders).length} static placeholders from distributed server ${serverName}.`);
    }

    // 新增：清理分布式静态占位符
    clearDistributedStaticPlaceholders(serverId) {
        const placeholdersToRemove = [];

        for (const [placeholder, entry] of this.staticPlaceholderValues.entries()) {
            if (entry && entry.serverId === serverId) {
                placeholdersToRemove.push(placeholder);
            }
        }

        for (const placeholder of placeholdersToRemove) {
            this.staticPlaceholderValues.delete(placeholder);
            if (this.debugMode) {
                console.log(`[PluginManager] Removed distributed placeholder ${placeholder} from disconnected server ${serverId}`);
            }
        }

        if (placeholdersToRemove.length > 0) {
            console.log(`[PluginManager] Cleared ${placeholdersToRemove.length} static placeholders from disconnected server ${serverId}.`);
        }
    }

    // --- 新增方法 ---
    async hotReloadPluginsAndOrder() {
        console.log('[PluginManager] Hot reloading plugins and preprocessor order...');
        // 重新加载所有插件，这将自动应用新的顺序
        await this.loadPlugins();
        console.log('[PluginManager] Hot reload complete.');
        return this.getPreprocessorOrder();
    }

    _normalizePluginCommands(manifest) {
        const commands = manifest?.capabilities?.invocationCommands;
        if (!Array.isArray(commands)) return [];
        return commands.map((cmd, index) => {
            const identifier = cmd.commandIdentifier || cmd.command || cmd.name || `command_${index + 1}`;
            return {
                commandIdentifier: cmd.commandIdentifier || null,
                command: cmd.command || null,
                name: cmd.name || null,
                identifier,
                description: cmd.description || '',
                example: cmd.example || null
            };
        });
    }

    _summarizePluginRegistryEntry(manifest, enabled, extra = {}) {
        const isDistributed = !!manifest.isDistributed;
        const commands = this._normalizePluginCommands(manifest);
        const placeholderKey = `VCP${manifest.name}`;
        return {
            name: manifest.name,
            displayName: manifest.displayName || manifest.name,
            description: manifest.description || '',
            version: manifest.version || null,
            pluginType: manifest.pluginType || 'unknown',
            enabled,
            status: enabled ? 'enabled' : 'disabled',
            origin: isDistributed ? 'cloud' : 'local',
            isDistributed,
            serverId: manifest.serverId || null,
            requiresAdmin: !!manifest.requiresAdmin,
            hasApiRoutes: !!manifest.hasApiRoutes,
            communicationProtocol: manifest.communication?.protocol || null,
            commandCount: commands.length,
            commands: commands.map(cmd => cmd.identifier),
            placeholder: commands.length > 0 ? `{{${placeholderKey}}}` : null,
            basePath: manifest.basePath || null,
            manifestFile: extra.manifestFile || (enabled ? manifestFileName : `${manifestFileName}.block`),
            folderName: extra.folderName || null
        };
    }

    async _discoverDisabledPluginManifests() {
        const disabledPlugins = [];
        const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
        for (const folder of pluginFolders) {
            if (!folder.isDirectory()) continue;
            const pluginPath = path.join(PLUGIN_DIR, folder.name);
            const blockedManifestPath = path.join(pluginPath, `${manifestFileName}.block`);
            try {
                const manifestContent = await fs.readFile(blockedManifestPath, 'utf-8');
                const manifest = JSON.parse(manifestContent);
                if (!manifest.name) continue;
                manifest.basePath = pluginPath;
                disabledPlugins.push({
                    manifest,
                    folderName: folder.name,
                    manifestPath: blockedManifestPath
                });
            } catch (error) {
                if (error.code !== 'ENOENT' && this.debugMode) {
                    console.warn(`[PluginManager] Error reading disabled plugin manifest in ${folder.name}: ${error.message}`);
                }
            }
        }
        return disabledPlugins;
    }

    async listPluginRegistry() {
        const pluginDataMap = new Map();

        for (const manifest of this.plugins.values()) {
            if (!manifest || !manifest.name) continue;
            pluginDataMap.set(manifest.name, this._summarizePluginRegistryEntry(manifest, true));
        }

        const disabledPlugins = await this._discoverDisabledPluginManifests();
        for (const item of disabledPlugins) {
            if (pluginDataMap.has(item.manifest.name)) continue;
            pluginDataMap.set(
                item.manifest.name,
                this._summarizePluginRegistryEntry(item.manifest, false, {
                    manifestFile: `${manifestFileName}.block`,
                    folderName: item.folderName
                })
            );
        }

        const plugins = Array.from(pluginDataMap.values()).sort((a, b) => {
            if (a.origin !== b.origin) return a.origin.localeCompare(b.origin);
            if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return {
            status: 'success',
            total: plugins.length,
            enabledCount: plugins.filter(p => p.enabled).length,
            disabledCount: plugins.filter(p => !p.enabled).length,
            cloudCount: plugins.filter(p => p.isDistributed).length,
            localCount: plugins.filter(p => !p.isDistributed).length,
            plugins
        };
    }

    async getPluginRegistryDetail(pluginName) {
        const name = String(pluginName || '').trim();
        if (!name) {
            throw new Error('pluginName is required.');
        }

        let manifest = this.plugins.get(name);
        let enabled = !!manifest;
        let folderName = manifest?.basePath ? path.basename(manifest.basePath) : null;
        let manifestFile = manifestFileName;

        if (!manifest) {
            const disabledPlugins = await this._discoverDisabledPluginManifests();
            const disabled = disabledPlugins.find(item => item.manifest.name === name);
            if (!disabled) {
                throw new Error(`Plugin "${name}" not found.`);
            }
            manifest = disabled.manifest;
            enabled = false;
            folderName = disabled.folderName;
            manifestFile = `${manifestFileName}.block`;
        }

        const commands = this._normalizePluginCommands(manifest);
        const placeholderKey = `VCP${manifest.name}`;
        const descriptionEntry = this.individualPluginDescriptions.get(placeholderKey) || null;

        return {
            status: 'success',
            plugin: {
                ...this._summarizePluginRegistryEntry(manifest, enabled, { folderName, manifestFile }),
                author: manifest.author || null,
                manifestVersion: manifest.manifestVersion || null,
                entryPoint: manifest.entryPoint || null,
                communication: manifest.communication || null,
                configSchema: manifest.configSchema || null,
                capabilities: manifest.capabilities || null,
                commands,
                placeholderDescription: descriptionEntry,
                rawManifest: manifest
            }
        };
    }

    async _findLocalPluginManifestPaths(pluginName) {
        const name = String(pluginName || '').trim();
        if (!name) {
            throw new Error('pluginName is required.');
        }

        const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
        for (const folder of pluginFolders) {
            if (!folder.isDirectory()) continue;

            const pluginPath = path.join(PLUGIN_DIR, folder.name);
            const enabledManifestPath = path.join(pluginPath, manifestFileName);
            const disabledManifestPath = `${enabledManifestPath}.block`;

            for (const candidate of [
                { manifestPath: enabledManifestPath, enabled: true },
                { manifestPath: disabledManifestPath, enabled: false }
            ]) {
                try {
                    const manifestContent = await fs.readFile(candidate.manifestPath, 'utf-8');
                    const manifest = JSON.parse(manifestContent);
                    if (manifest.name === name) {
                        return {
                            pluginPath,
                            folderName: folder.name,
                            manifest,
                            enabled: candidate.enabled,
                            enabledManifestPath,
                            disabledManifestPath
                        };
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT' && this.debugMode) {
                        console.warn(`[PluginManager] Error checking manifest for ${folder.name}: ${error.message}`);
                    }
                }
            }
        }

        throw new Error(`Local plugin "${name}" not found.`);
    }

    _assertPluginToggleAllowed(pluginName, enable, manifest = null) {
        const protectedPlugins = new Set([
            'PluginManager',
            'UserAuth',
            'VCPLog',
            'VCPInfo',
            'VCPToolBridge'
        ]);

        if (!enable && protectedPlugins.has(pluginName)) {
            throw new Error(`Plugin "${pluginName}" is protected and cannot be disabled by PluginManager.`);
        }

        const knownTypes = new Set([
            'static',
            'messagePreprocessor',
            'synchronous',
            'asynchronous',
            'service',
            'hybridservice'
        ]);
        if (manifest && !knownTypes.has(manifest.pluginType)) {
            throw new Error(`Plugin "${pluginName}" has unsupported type "${manifest.pluginType}".`);
        }
    }

    async setLocalPluginEnabled(pluginName, enable, options = {}) {
        if (typeof enable !== 'boolean') {
            throw new Error('enable must be a boolean.');
        }

        const name = String(pluginName || '').trim();

        const loadedManifest = this.plugins.get(name);
        if (loadedManifest?.isDistributed) {
            throw new Error(`Plugin "${name}" is a cloud/distributed tool and cannot be enabled or disabled locally.`);
        }

        const target = await this._findLocalPluginManifestPaths(name);
        this._assertPluginToggleAllowed(name, enable, target.manifest);

        if (target.manifest.isDistributed) {
            throw new Error(`Plugin "${name}" is marked as distributed and cannot be toggled locally.`);
        }

        const isPreprocessor = (
            target.manifest.pluginType === 'messagePreprocessor'
            || target.manifest.messagePreprocessor === true
            || target.manifest.interpretsControlSyntax === true
        ) && target.manifest.communication?.protocol === 'direct'
            && target.manifest.entryPoint?.script;
        let nextOrder = null;
        let previousOrderContent = null;
        if (isPreprocessor && enable && !target.enabled) {
            if (!Array.isArray(options.preprocessorOrder)) {
                const error = new Error(
                    `Plugin "${name}" interprets or preprocesses messages and needs an explicit complete preprocessorOrder before it can be enabled.`
                );
                error.code = 'PREPROCESSOR_ORDER_CONFIRMATION_REQUIRED';
                error.statusCode = 409;
                error.details = { pluginName: name };
                throw error;
            }
            nextOrder = {
                version: 2,
                strict: true,
                order: options.preprocessorOrder.map(item => String(item))
            };
            const duplicates = nextOrder.order.filter((item, index) => nextOrder.order.indexOf(item) !== index);
            if (!nextOrder.order.includes(name) || duplicates.length) {
                const error = new Error('preprocessorOrder must include the enabled plugin exactly once.');
                error.code = 'PREPROCESSOR_ORDER_CONFIRMATION_REQUIRED';
                error.statusCode = 409;
                throw error;
            }
            previousOrderContent = await fs.readFile(PREPROCESSOR_ORDER_FILE, 'utf8').catch(error => {
                if (error.code === 'ENOENT') return null;
                throw error;
            });
        } else if (isPreprocessor && !enable && target.enabled) {
            previousOrderContent = await fs.readFile(PREPROCESSOR_ORDER_FILE, 'utf8');
            const currentOrder = JSON.parse(previousOrderContent);
            if (
                !currentOrder
                || currentOrder.version !== 2
                || currentOrder.strict !== true
                || !Array.isArray(currentOrder.order)
            ) {
                const error = new Error('Cannot disable a preprocessor while the strict order file is invalid.');
                error.code = 'PREPROCESSOR_ORDER_INVALID';
                error.statusCode = 409;
                throw error;
            }
            nextOrder = {
                version: 2,
                strict: true,
                order: currentOrder.order.filter(item => item !== name)
            };
        }

        if (enable && target.enabled) {
            return {
                status: 'success',
                changed: false,
                message: `插件 ${name} 已经是启用状态。`,
                plugin: this._summarizePluginRegistryEntry(target.manifest, true, {
                    folderName: target.folderName,
                    manifestFile: manifestFileName
                })
            };
        }

        if (!enable && !target.enabled) {
            return {
                status: 'success',
                changed: false,
                message: `插件 ${name} 已经是禁用状态。`,
                plugin: this._summarizePluginRegistryEntry(target.manifest, false, {
                    folderName: target.folderName,
                    manifestFile: `${manifestFileName}.block`
                })
            };
        }

        const oldOrder = previousOrderContent;
        try {
            if (nextOrder) {
                this.suppressPluginWatcherPath(PREPROCESSOR_ORDER_FILE);
                await atomicWriteFilePreservingMode(
                    PREPROCESSOR_ORDER_FILE,
                    `${JSON.stringify(nextOrder, null, 2)}\n`
                );
            }

            this.suppressPluginWatcherPath(enable ? target.enabledManifestPath : target.disabledManifestPath);
            this.suppressPluginWatcherPath(enable ? target.disabledManifestPath : target.enabledManifestPath);
            if (enable) {
                await fs.rename(target.disabledManifestPath, target.enabledManifestPath);
            } else {
                await fs.rename(target.enabledManifestPath, target.disabledManifestPath);
            }

            await this.loadPlugins({
                force: false,
                reason: `plugin_toggle:${name}:${enable ? 'enable' : 'disable'}`
            });
        } catch (error) {
            const currentSource = enable ? target.enabledManifestPath : target.disabledManifestPath;
            const rollbackTarget = enable ? target.disabledManifestPath : target.enabledManifestPath;
            await fs.rename(currentSource, rollbackTarget).catch(() => {});
            if (nextOrder) {
                if (oldOrder === null) await fs.unlink(PREPROCESSOR_ORDER_FILE).catch(() => {});
                else await atomicWriteFilePreservingMode(PREPROCESSOR_ORDER_FILE, oldOrder);
            }
            throw error;
        }

        if (this.webSocketServer && typeof this.webSocketServer.broadcastToAdminPanel === 'function') {
            this.webSocketServer.broadcastToAdminPanel({
                type: 'plugins-reloaded',
                message: `Plugin ${name} has been ${enable ? 'enabled' : 'disabled'} by PluginManager.`
            });
        }

        const detail = await this.getPluginRegistryDetail(name);
        return {
            status: 'success',
            changed: true,
            message: `插件 ${name} 已${enable ? '启用' : '禁用'}。`,
            plugin: detail.plugin
        };
    }

    async enableLocalPlugin(pluginName) {
        return this.setLocalPluginEnabled(pluginName, true);
    }

    async disableLocalPlugin(pluginName) {
        return this.setLocalPluginEnabled(pluginName, false);
    }

    getPreprocessorOrder() {
        // 返回所有已发现、已排序的预处理器信息
        return this.preprocessorOrder.map(name => {
            const manifest = this.plugins.get(name);
            return {
                name: name,
                displayName: manifest ? manifest.displayName : name,
                description: manifest ? manifest.description : 'N/A'
            };
        });
    }
    startPluginWatcher() {
        if (this.debugMode) console.log('[PluginManager] Starting plugin file watcher...');
        if (this.pluginWatcher) return this.pluginWatcher;

        const pluginRoots = this.pluginRootResolver.getWatchRoots();
        const controlledWatchPaths = [
            ...pluginRoots.flatMap(rootPath => [
                path.join(rootPath, '*', 'plugin-manifest.json'),
                path.join(rootPath, '*', 'plugin-manifest.json.block'),
                path.join(rootPath, '*', 'config.env')
            ]),
            PREPROCESSOR_ORDER_FILE
        ];
        const watcher = chokidar.watch(controlledWatchPaths, {
            ignored: [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/target/**',
                '**/image/**',
                '**/.*'
            ],
            persistent: true,
            ignoreInitial: true, // Don't fire on initial scan
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        const filterControlledRuntimeFile = (filePath) => {
            const fileName = path.basename(filePath);
            return fileName === 'plugin-manifest.json'
                || fileName === 'plugin-manifest.json.block'
                || fileName === 'config.env'
                || path.resolve(filePath) === path.resolve(PREPROCESSOR_ORDER_FILE);
        };

        const dispatchControlledChange = (eventType, filePath) => {
            const resolved = path.resolve(filePath);
            const suppressedUntil = this.watcherSuppressions.get(resolved) || 0;
            if (suppressedUntil >= Date.now()) {
                if (this.debugMode) {
                    console.log(`[PluginManager] Suppressed self-generated watcher event for ${resolved}.`);
                }
                return;
            }
            this.watcherSuppressions.delete(resolved);
            this.handlePluginManifestChange(eventType, filePath);
        };

        watcher
            .on('add', filePath => {
                if (filterControlledRuntimeFile(filePath)) dispatchControlledChange('add', filePath);
            })
            .on('change', filePath => {
                if (filterControlledRuntimeFile(filePath)) dispatchControlledChange('change', filePath);
            })
            .on('unlink', filePath => {
                if (filterControlledRuntimeFile(filePath)) dispatchControlledChange('unlink', filePath);
            });

        this.pluginWatcher = watcher;
        console.log(
            `[PluginManager] Watching controlled runtime files below ` +
            `${pluginRoots.map(rootPath => this._formatPluginEventPathForLog(rootPath)).join(', ')}.`
        );
        return watcher;
    }

    suppressPluginWatcherPath(filePath, ttlMs = 3000) {
        this.watcherSuppressions.set(path.resolve(filePath), Date.now() + ttlMs);
    }

    handlePluginManifestChange(eventType, filePath) {
        if (this.isReloading) {
            if (this.debugMode) console.log(`[PluginManager] Already reloading, skipping event '${eventType}' for: ${filePath}`);
            return;
        }

        clearTimeout(this.reloadTimeout);

        if (this.debugMode) console.log(`[PluginManager] Debouncing plugin reload trigger due to '${eventType}' event on: ${path.basename(filePath)}`);

        this.reloadTimeout = setTimeout(async () => {
            this.isReloading = true;

            try {
                console.log(`[PluginManager] Controlled runtime file change detected ('${eventType}'). Hot-reloading plugins...`);
                await this.loadPlugins({
                    force: false,
                    reason: `watch:${path.basename(filePath)}:${eventType}`
                });
                console.log('[PluginManager] Hot-reload complete.');

                if (this.webSocketServer && typeof this.webSocketServer.broadcastToAdminPanel === 'function') {
                    this.webSocketServer.broadcastToAdminPanel({
                        type: 'plugins-reloaded',
                        message: 'Plugin list has been updated due to file changes.'
                    });
                    if (this.debugMode) console.log('[PluginManager] Notified admin panel about plugin reload.');
                }
            } catch (error) {
                console.error('[PluginManager] Error during hot-reload:', error);
            } finally {
                this.isReloading = false;
            }
        }, 500); // 500ms debounce window
    }
}

const pluginManager = new PluginManager();

// 新增：获取所有静态占位符值
pluginManager.getAllPlaceholderValues = function () {
    const valuesMap = new Map();
    for (const [key, entry] of this.staticPlaceholderValues.entries()) {
        // Sanitize the key to remove legacy brackets for consistency
        const sanitizedKey = key.replace(/^{{|}}$/g, '');

        let value;
        // Handle modern object format
        if (typeof entry === 'object' && entry !== null && entry.hasOwnProperty('value')) {
            value = entry.value;
            // Handle legacy raw string format
        } else if (typeof entry === 'string') {
            value = entry;
        } else {
            // Fallback for any other unexpected format
            value = `[Invalid format for placeholder ${sanitizedKey}]`;
        }

        valuesMap.set(sanitizedKey, value || `[Placeholder ${sanitizedKey} has no value]`);
    }
    return valuesMap;
};

module.exports = pluginManager;
module.exports.PluginManager = PluginManager;
