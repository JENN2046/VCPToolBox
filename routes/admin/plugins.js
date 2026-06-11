const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { readPluginDashboardCards } = require('./lib/dashboardCards');
const {
    discoverAdminLegacyManifestRecords,
    isManagedPathInsideRoot,
    isPathInsideRootByRealpath,
    pathKey
} = require('../../modules/pluginRootResolver');

const manifestFileName = 'plugin-manifest.json';
const blockedManifestExtension = '.block';
const blockedManifestFileName = `${manifestFileName}${blockedManifestExtension}`;

const SENSITIVE_CONFIG_KEY_RE = /(api[_-]?key|token|secret|password|passwd|cookie|authorization|credential|private[_-]?key)/i;

function getProjectRoot() {
    return path.join(__dirname, '..', '..');
}

function toSafeDisplayPath(filePath, source = 'external', rootPath = null) {
    if (!filePath || typeof filePath !== 'string') return null;
    const projectRoot = path.resolve(getProjectRoot());
    const resolved = path.resolve(filePath);
    const label = source === 'external'
        ? 'external'
        : (source === 'distributed' ? 'distributed' : 'core');
    const baseRoot = rootPath ? path.resolve(rootPath) : projectRoot;
    const rootRelative = path.relative(baseRoot, resolved);

    if (rootRelative && !rootRelative.startsWith('..') && !path.isAbsolute(rootRelative)) {
        return `[${label}]/${rootRelative.replace(/\\/g, '/')}`;
    }

    const projectRelative = path.relative(projectRoot, resolved);
    if (projectRelative && !projectRelative.startsWith('..') && !path.isAbsolute(projectRelative)) {
        return `[${label}]/${projectRelative.replace(/\\/g, '/')}`;
    }

    return `[${label}]/${path.basename(resolved)}`;
}

function redactConfigSchema(configSchema) {
    if (!configSchema || typeof configSchema !== 'object') return configSchema || {};
    const redacted = {};
    for (const [key, value] of Object.entries(configSchema)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            redacted[key] = { ...value };
            if (Object.prototype.hasOwnProperty.call(redacted[key], 'default') && SENSITIVE_CONFIG_KEY_RE.test(key)) {
                redacted[key].default = '[redacted]';
            }
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

function sanitizeRootId(rootId) {
    if (!rootId || typeof rootId !== 'string') return rootId || null;
    if (rootId.startsWith('external:')) return rootId.split(':').slice(0, 2).join(':');
    if (rootId.startsWith('core:')) return rootId;
    return 'unknown';
}

function sanitizeManifestForAdmin(manifest, context = {}) {
    if (!manifest || typeof manifest !== 'object') return manifest;
    const clone = JSON.parse(JSON.stringify(manifest));

    delete clone.pluginSpecificEnvConfig;
    delete clone.configEnvContent;

    if (clone.configSchema) {
        clone.configSchema = redactConfigSchema(clone.configSchema);
    }

    const source = context.pluginSource || clone.pluginSource || (clone.isDistributed ? 'distributed' : 'core');
    const pluginRoot = context.pluginRoot || clone.pluginRoot || null;
    const pluginPath = context.pluginPath || clone.basePath || null;
    if (pluginPath) {
        clone.basePath = toSafeDisplayPath(pluginPath, source, pluginRoot);
    }
    if (pluginRoot) {
        clone.pluginRoot = toSafeDisplayPath(pluginRoot, source);
        clone.pluginRootDisplayPath = toSafeDisplayPath(pluginRoot, source);
    }
    if (clone.rootPath) {
        clone.rootPath = toSafeDisplayPath(clone.rootPath, source);
    }
    clone.pluginRootId = sanitizeRootId(context.pluginRootId || clone.pluginRootId);
    clone.pluginSource = source;

    return clone;
}

async function getConfigEnvStatus(pluginPath, pluginName) {
    if (!pluginPath) {
        return { exists: false, readable: false, redacted: true };
    }

    const configPath = path.join(pluginPath, 'config.env');
    try {
        const stat = await fs.stat(configPath);
        return {
            exists: true,
            readable: true,
            redacted: true,
            size: stat.size,
            updatedAt: stat.mtime ? stat.mtime.toISOString() : null
        };
    } catch (envError) {
        if (envError.code !== 'ENOENT') {
            console.warn(`[AdminPanelRoutes] Cannot inspect config.env status for ${pluginName}: ${safeErrorDetails(envError)}`);
        }
        return {
            exists: false,
            readable: false,
            redacted: true,
            errorCode: envError.code === 'ENOENT' ? null : (envError.code || 'UNKNOWN')
        };
    }
}

function isExternalPluginManifest(manifest) {
    return Boolean(
        manifest
        && (
            manifest.pluginSource === 'external'
            || (typeof manifest.pluginRootId === 'string' && manifest.pluginRootId.startsWith('external:'))
        )
    );
}

function isBlankConfigContent(content) {
    return typeof content === 'string' && content.trim().length === 0;
}

async function statExistingConfigEnv(configPath) {
    try {
        return await fs.stat(configPath);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

function safeErrorDetails(error) {
    if (!error) return 'UNKNOWN';
    return error.code || error.name || 'UNKNOWN';
}

function getAdminPluginRootSnapshot(pluginManager) {
    if (pluginManager && typeof pluginManager.getPluginRootSnapshot === 'function') {
        return pluginManager.getPluginRootSnapshot();
    }

    const projectRoot = getProjectRoot();
    const coreLegacyRoot = path.join(projectRoot, 'Plugin');
    return {
        projectRoot,
        coreLegacyRoot: {
            rootId: 'core:legacy',
            source: 'core',
            rootPath: coreLegacyRoot,
            displayPath: toSafeDisplayPath(coreLegacyRoot, 'core'),
            allowConfigEnv: true,
            enabled: true
        },
        externalLegacyRoots: [],
        diagnostics: []
    };
}

function normalizePluginSource(source, isDistributed = false) {
    if (source === 'external') return 'external';
    if (isDistributed || source === 'distributed') return 'distributed';
    return 'core';
}

function createManifestRecord(record) {
    const pluginSource = normalizePluginSource(record.source);
    const manifest = {
        ...record.manifest,
        basePath: record.pluginPath,
        pluginSource,
        pluginRoot: record.rootPath,
        pluginRootId: record.rootId,
        pluginRootDisplayPath: record.rootDisplayPath
    };

    return {
        name: record.name,
        manifest,
        pluginPath: record.pluginPath,
        manifestPath: record.manifestPath,
        activeManifestPath: record.activeManifestPath,
        blockedManifestPath: record.blockedManifestPath,
        enabled: record.enabled,
        loaded: false,
        pluginSource,
        pluginRootId: sanitizeRootId(record.rootId),
        pluginRoot: record.rootPath,
        allowConfigEnv: record.allowConfigEnv,
        displayPath: record.displayPath,
        isDistributed: false,
        serverId: null,
        diagnostics: [],
        pathKey: record.pathKey
    };
}

function createLoadedRecord(manifest) {
    const pluginSource = normalizePluginSource(manifest.pluginSource, manifest.isDistributed);
    const pluginPath = manifest.basePath || null;
    const pluginRoot = manifest.pluginRoot || null;
    return {
        name: manifest.name,
        manifest,
        pluginPath,
        manifestPath: pluginPath ? path.join(pluginPath, manifestFileName) : null,
        activeManifestPath: pluginPath ? path.join(pluginPath, manifestFileName) : null,
        blockedManifestPath: pluginPath ? path.join(pluginPath, blockedManifestFileName) : null,
        enabled: true,
        loaded: true,
        pluginSource,
        pluginRootId: sanitizeRootId(manifest.pluginRootId || (pluginSource === 'external' ? 'external:unknown' : 'core:legacy')),
        pluginRoot,
        allowConfigEnv: pluginSource !== 'external',
        displayPath: pluginPath ? toSafeDisplayPath(pluginPath, pluginSource, pluginRoot) : null,
        isDistributed: manifest.isDistributed || false,
        serverId: manifest.serverId || null,
        diagnostics: [],
        pathKey: pluginPath ? pathKey(pluginPath) : null
    };
}

function addDuplicateDiagnostics(records) {
    const byName = new Map();
    for (const record of records) {
        if (!record.name) continue;
        if (!byName.has(record.name)) byName.set(record.name, []);
        byName.get(record.name).push(record);
    }

    for (const [pluginName, matches] of byName.entries()) {
        const distinctKeys = new Set(matches.map(record => record.pathKey || `${record.pluginSource}:${record.pluginRootId}:${record.name}`));
        if (distinctKeys.size < 2) continue;

        const hasCore = matches.some(record => record.pluginSource === 'core');
        const diagnostic = {
            level: 'warn',
            code: 'duplicate_plugin_name',
            pluginName,
            message: hasCore
                ? 'Duplicate plugin name detected; core plugin keeps priority over external plugin.'
                : 'Duplicate plugin name detected across managed plugin roots.',
            roots: matches.map(record => ({
                pluginRootId: record.pluginRootId,
                pluginSource: record.pluginSource,
                enabled: record.enabled,
                loaded: record.loaded
            }))
        };

        matches.forEach(record => record.diagnostics.push(diagnostic));
    }
}

async function findCurrentAllowlistedExternalRoot(loadedRecord, externalLegacyRoots) {
    if (!loadedRecord || loadedRecord.pluginSource !== 'external' || !loadedRecord.pluginPath) {
        return null;
    }

    for (const rootInfo of externalLegacyRoots || []) {
        if (!await isPathInsideRootByRealpath(loadedRecord.pluginPath, rootInfo.rootPath)) {
            continue;
        }
        if (
            loadedRecord.pluginRoot
            && !await isPathInsideRootByRealpath(loadedRecord.pluginRoot, rootInfo.rootPath)
        ) {
            continue;
        }
        return rootInfo;
    }

    return null;
}

async function buildAdminPluginCatalog(pluginManager) {
    const rootSnapshot = getAdminPluginRootSnapshot(pluginManager);
    const discovered = await discoverAdminLegacyManifestRecords(rootSnapshot);
    const records = discovered.records.map(createManifestRecord);
    const byPath = new Map(records.filter(record => record.pathKey).map(record => [record.pathKey, record]));
    const externalLegacyRoots = rootSnapshot.externalLegacyRoots || [];

    const loadedPlugins = Array.from(pluginManager?.plugins?.values?.() || []);
    for (const loadedManifest of loadedPlugins) {
        const loadedRecord = createLoadedRecord(loadedManifest);
        if (loadedRecord.pluginSource === 'external') {
            const matchedExternalRoot = await findCurrentAllowlistedExternalRoot(loadedRecord, externalLegacyRoots);
            if (!matchedExternalRoot || !loadedRecord.pathKey || !byPath.has(loadedRecord.pathKey)) {
                continue;
            }
        }
        if (loadedRecord.pathKey && byPath.has(loadedRecord.pathKey)) {
            const existing = byPath.get(loadedRecord.pathKey);
            existing.loaded = true;
            existing.enabled = true;
            existing.manifest = {
                ...loadedManifest,
                basePath: existing.pluginPath,
                pluginSource: existing.pluginSource,
                pluginRoot: existing.pluginRoot,
                pluginRootId: existing.pluginRootId
            };
            existing.serverId = loadedRecord.serverId;
            continue;
        }
        records.push(loadedRecord);
    }

    addDuplicateDiagnostics(records);
    return {
        records,
        diagnostics: [
            ...(rootSnapshot.diagnostics || []),
            ...(discovered.diagnostics || [])
        ].map(item => ({
            level: item.level || 'warn',
            code: item.code || 'unknown',
            rootId: sanitizeRootId(item.rootId),
            message: item.message || null
        }))
    };
}

function getLookupCriteria(req, overrides = {}) {
    const body = req.body || {};
    const query = req.query || {};
    return {
        pluginRootId: sanitizeRootId(overrides.pluginRootId || body.pluginRootId || query.pluginRootId || body.rootId || query.rootId),
        pluginSource: overrides.pluginSource || body.pluginSource || query.pluginSource || null,
        enabled: Object.prototype.hasOwnProperty.call(overrides, 'enabled') ? overrides.enabled : null
    };
}

function createAdminPluginTargetCandidate(record) {
    return {
        pluginRootId: record.pluginRootId,
        pluginSource: record.pluginSource,
        enabled: record.enabled,
        loaded: record.loaded,
        displayPath: record.displayPath || null
    };
}

function getDistinctAdminPluginTargets(records) {
    const seen = new Set();
    const distinct = [];

    for (const record of records) {
        const targetKey = record.pathKey || `${record.pluginSource}:${record.pluginRootId}:${record.name}:${record.enabled ? 'enabled' : 'disabled'}`;
        if (seen.has(targetKey)) continue;
        seen.add(targetKey);
        distinct.push(record);
    }

    return distinct;
}

function resolveAdminPluginRecordForManagedWrite(catalog, pluginName, criteria = {}) {
    let matches = catalog.records.filter(record => record.name === pluginName);

    if (criteria.pluginRootId) {
        matches = matches.filter(record => record.pluginRootId === criteria.pluginRootId);
    }
    if (criteria.pluginSource) {
        matches = matches.filter(record => record.pluginSource === criteria.pluginSource);
    }

    const distinctTargets = getDistinctAdminPluginTargets(matches);
    if (distinctTargets.length === 0) {
        return { status: 'not_found', target: null, candidates: [] };
    }
    if (distinctTargets.length > 1) {
        return {
            status: 'ambiguous',
            target: null,
            candidates: distinctTargets.map(createAdminPluginTargetCandidate)
        };
    }

    return { status: 'resolved', target: distinctTargets[0], candidates: [] };
}

function sendManagedWriteResolutionError(res, resolution, pluginName, notFoundError) {
    if (resolution.status === 'not_found') {
        res.status(404).json({ error: notFoundError });
        return true;
    }
    if (resolution.status === 'ambiguous') {
        res.status(409).json({
            error: `Multiple managed plugin targets match '${pluginName}'. Please specify pluginRootId or pluginSource.`,
            code: 'ambiguous_admin_plugin_target',
            requiresPluginRoot: true,
            candidates: resolution.candidates
        });
        return true;
    }
    return false;
}

function isWritableLegacyRecord(record) {
    return Boolean(record && record.pluginPath && record.pluginRoot && record.manifestPath && !record.isDistributed);
}

async function assertManagedManifestRecord(record) {
    if (!record || !record.pluginPath || !record.pluginRoot || !record.manifestPath) {
        const error = new Error('Managed plugin manifest target is unavailable.');
        error.code = 'managed_manifest_unavailable';
        throw error;
    }

    const pathsToCheck = [
        record.pluginPath,
        record.activeManifestPath,
        record.blockedManifestPath,
        record.manifestPath
    ].filter(Boolean);

    for (const targetPath of pathsToCheck) {
        if (!await isManagedPathInsideRoot(targetPath, record.pluginRoot)) {
            const error = new Error('Managed plugin manifest target is outside its root.');
            error.code = 'managed_manifest_outside_root';
            throw error;
        }

        try {
            const stat = await fs.lstat(targetPath);
            if (stat.isSymbolicLink()) {
                const error = new Error('Managed plugin manifest target must not be a symlink.');
                error.code = 'managed_manifest_symlink_unsupported';
                throw error;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }
}

function createAdminPluginResponseRecord(record) {
    return {
        name: record.name,
        manifest: sanitizeManifestForAdmin(record.manifest, {
            pluginSource: record.pluginSource,
            pluginPath: record.pluginPath,
            pluginRoot: record.pluginRoot,
            pluginRootId: record.pluginRootId
        }),
        dashboardCards: readPluginDashboardCards(record.name, record.manifest),
        enabled: record.enabled,
        loaded: record.loaded,
        displayPath: record.displayPath,
        pluginRootId: record.pluginRootId,
        pluginSource: record.pluginSource,
        configEnvContent: null,
        configEnvStatus: { exists: false, readable: false, redacted: true },
        isDistributed: record.isDistributed || false,
        serverId: record.serverId || null,
        adminDiagnostics: record.diagnostics || []
    };
}

module.exports = function(options) {
    const router = express.Router();
    const { pluginManager, DEBUG_MODE } = options;
    const PREPROCESSOR_ORDER_FILE = path.join(__dirname, '..', '..', 'preprocessor_order.json');

    // GET plugin list
    router.get('/plugins', async (req, res) => {
        try {
            const catalog = await buildAdminPluginCatalog(pluginManager);
            const pluginDataList = [];
            for (const record of catalog.records) {
                const responseRecord = createAdminPluginResponseRecord(record);
                if (!record.isDistributed && record.pluginPath) {
                    responseRecord.configEnvStatus = await getConfigEnvStatus(record.pluginPath, record.name);
                }
                pluginDataList.push(responseRecord);
            }
            res.json(pluginDataList);
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error listing plugins: ${safeErrorDetails(error)}`);
            res.status(500).json({ error: 'Failed to list plugins', details: safeErrorDetails(error) });
        }
    });

    // Toggle plugin status
    router.post('/plugins/:pluginName/toggle', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { enable } = req.body;

        if (typeof enable !== 'boolean') {
            return res.status(400).json({ error: 'Invalid request body. Expected { enable: boolean }.' });
        }

        try {
            const catalog = await buildAdminPluginCatalog(pluginManager);
            const resolution = resolveAdminPluginRecordForManagedWrite(catalog, pluginName, getLookupCriteria(req));
            if (sendManagedWriteResolutionError(res, resolution, pluginName, `Plugin '${pluginName}' not found.`)) {
                return;
            }
            const target = resolution.target;

            if (!isWritableLegacyRecord(target)) {
                return res.status(403).json({
                    error: 'Plugin is not a managed legacy manifest target.',
                    code: 'managed_legacy_manifest_required'
                });
            }

            await assertManagedManifestRecord(target);

            if (enable) {
                if (target.enabled) {
                    return res.json({
                        message: `插件 ${pluginName} 已经是启用状态。`,
                        pluginRootId: target.pluginRootId,
                        pluginSource: target.pluginSource,
                        diagnostics: target.diagnostics || []
                    });
                }
                try {
                    await fs.rename(target.blockedManifestPath, target.activeManifestPath);
                    await pluginManager.loadPlugins();
                    res.json({
                        message: `插件 ${pluginName} 已启用。`,
                        pluginRootId: target.pluginRootId,
                        pluginSource: target.pluginSource,
                        diagnostics: target.diagnostics || []
                    });
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        try {
                            await fs.access(target.activeManifestPath);
                            res.json({
                                message: `插件 ${pluginName} 已经是启用状态。`,
                                pluginRootId: target.pluginRootId,
                                pluginSource: target.pluginSource,
                                diagnostics: target.diagnostics || []
                            });
                        } catch (accessError) {
                            res.status(500).json({ error: `无法启用插件 ${pluginName}。找不到 manifest 文件。`, details: safeErrorDetails(accessError) });
                        }
                    } else {
                        console.error(`[AdminPanelRoutes] Error enabling plugin ${pluginName}: ${safeErrorDetails(error)}`);
                        res.status(500).json({ error: `启用插件 ${pluginName} 时出错`, details: safeErrorDetails(error) });
                    }
                }
            } else {
                if (!target.enabled) {
                    return res.json({
                        message: `插件 ${pluginName} 已经是禁用状态。`,
                        pluginRootId: target.pluginRootId,
                        pluginSource: target.pluginSource,
                        diagnostics: target.diagnostics || []
                    });
                }
                try {
                    await fs.rename(target.activeManifestPath, target.blockedManifestPath);
                    await pluginManager.loadPlugins();
                    res.json({
                        message: `插件 ${pluginName} 已禁用。`,
                        pluginRootId: target.pluginRootId,
                        pluginSource: target.pluginSource,
                        diagnostics: target.diagnostics || []
                    });
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        try {
                            await fs.access(target.blockedManifestPath);
                            res.json({
                                message: `插件 ${pluginName} 已经是禁用状态。`,
                                pluginRootId: target.pluginRootId,
                                pluginSource: target.pluginSource,
                                diagnostics: target.diagnostics || []
                            });
                        } catch (accessError) {
                            res.status(500).json({ error: `无法禁用插件 ${pluginName}。找不到 manifest 文件。`, details: safeErrorDetails(accessError) });
                        }
                    } else {
                        console.error(`[AdminPanelRoutes] Error disabling plugin ${pluginName}: ${safeErrorDetails(error)}`);
                        res.status(500).json({ error: `禁用插件 ${pluginName} 时出错`, details: safeErrorDetails(error) });
                    }
                }
            }
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error toggling plugin ${pluginName}: ${safeErrorDetails(error)}`);
            res.status(500).json({ error: `处理插件 ${pluginName} 状态切换时出错`, details: safeErrorDetails(error) });
        }
    });

    // Update plugin description
    router.post('/plugins/:pluginName/description', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { description } = req.body;

        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Invalid request body. Expected { description: string }.' });
        }

        try {
            const catalog = await buildAdminPluginCatalog(pluginManager);
            const resolution = resolveAdminPluginRecordForManagedWrite(catalog, pluginName, getLookupCriteria(req));
            if (sendManagedWriteResolutionError(res, resolution, pluginName, `Plugin '${pluginName}' or its manifest file not found.`)) {
                return;
            }
            const target = resolution.target;

            if (!isWritableLegacyRecord(target)) {
                return res.status(403).json({
                    error: 'Plugin is not a managed legacy manifest target.',
                    code: 'managed_legacy_manifest_required'
                });
            }

            await assertManagedManifestRecord(target);
            const manifest = JSON.parse(await fs.readFile(target.manifestPath, 'utf-8'));
            manifest.description = description;
            await fs.writeFile(target.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
            await pluginManager.loadPlugins();
            res.json({
                message: `插件 ${pluginName} 的描述已更新并重新加载。`,
                pluginRootId: target.pluginRootId,
                pluginSource: target.pluginSource,
                diagnostics: target.diagnostics || []
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating description for plugin ${pluginName}: ${safeErrorDetails(error)}`);
            res.status(500).json({ error: `更新插件 ${pluginName} 描述时出错`, details: safeErrorDetails(error) });
        }
    });

    // Save plugin config
    router.post('/plugins/:pluginName/config', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { content, confirmBlankConfigEnv } = req.body;

        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'Invalid content format. String expected.' });
        }

        try {
            const catalog = await buildAdminPluginCatalog(pluginManager);
            const resolution = resolveAdminPluginRecordForManagedWrite(catalog, pluginName, getLookupCriteria(req));
            if (sendManagedWriteResolutionError(res, resolution, pluginName, `Plugin folder for '${pluginName}' not found.`)) {
                return;
            }
            const target = resolution.target;

            if (target.pluginSource === 'external' || isExternalPluginManifest(target.manifest)) {
                return res.status(403).json({
                    error: 'External plugin config editing is deferred in P1.',
                    code: 'external_config_deferred',
                    status: 'deferred'
                });
            }

            if (!isWritableLegacyRecord(target)) {
                return res.status(403).json({
                    error: 'Plugin is not a managed legacy config target.',
                    code: 'managed_legacy_manifest_required'
                });
            }

            await assertManagedManifestRecord(target);

            const configPath = path.join(target.pluginPath, 'config.env');
            if (!await isManagedPathInsideRoot(configPath, target.pluginRoot)) {
                return res.status(403).json({
                    error: 'Config target is outside the managed plugin root.',
                    code: 'config_target_outside_root'
                });
            }
            const existingConfigStat = await statExistingConfigEnv(configPath);
            if (
                existingConfigStat
                && existingConfigStat.size > 0
                && isBlankConfigContent(content)
                && confirmBlankConfigEnv !== true
            ) {
                return res.status(409).json({
                    error: 'Refusing to overwrite an existing non-empty config.env with blank content.',
                    code: 'blank_config_env_requires_confirmation',
                    requiresConfirmation: true
                });
            }

            await fs.writeFile(configPath, content, 'utf-8');
            await pluginManager.loadPlugins();
            res.json({
                message: `插件 ${pluginName} 的配置已保存并已重新加载。`,
                pluginRootId: target.pluginRootId,
                pluginSource: target.pluginSource
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error writing config.env for plugin ${pluginName}: ${safeErrorDetails(error)}`);
            res.status(500).json({ error: `保存插件 ${pluginName} 配置时出错`, details: safeErrorDetails(error) });
        }
    });

    // Update command description
    router.post('/plugins/:pluginName/commands/:commandIdentifier/description', async (req, res) => {
        const { pluginName, commandIdentifier } = req.params;
        const { description } = req.body;

        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Invalid request body. Expected { description: string }.' });
        }

        try {
            const catalog = await buildAdminPluginCatalog(pluginManager);
            const resolution = resolveAdminPluginRecordForManagedWrite(catalog, pluginName, getLookupCriteria(req));
            if (sendManagedWriteResolutionError(res, resolution, pluginName, `Plugin '${pluginName}' or its manifest file not found.`)) {
                return;
            }
            const target = resolution.target;

            if (!isWritableLegacyRecord(target)) {
                return res.status(403).json({
                    error: 'Plugin is not a managed legacy command description target.',
                    code: 'managed_legacy_manifest_required'
                });
            }

            try {
                await assertManagedManifestRecord(target);
            } catch (managedError) {
                return res.status(403).json({
                    error: 'Managed plugin command description target rejected.',
                    code: managedError.code || 'managed_manifest_rejected'
                });
            }

            if (target.pluginSource === 'external' || isExternalPluginManifest(target.manifest)) {
                return res.status(403).json({
                    error: 'External plugin command description editing is deferred.',
                    code: 'external_command_description_deferred',
                    status: 'deferred',
                    pluginRootId: target.pluginRootId,
                    pluginSource: target.pluginSource
                });
            }

            const manifest = JSON.parse(await fs.readFile(target.manifestPath, 'utf-8'));
            let commandUpdated = false;
            if (manifest.capabilities && manifest.capabilities.invocationCommands && Array.isArray(manifest.capabilities.invocationCommands)) {
                const commandIndex = manifest.capabilities.invocationCommands.findIndex(cmd => cmd.commandIdentifier === commandIdentifier || cmd.command === commandIdentifier);
                if (commandIndex !== -1) {
                    manifest.capabilities.invocationCommands[commandIndex].description = description;
                    commandUpdated = true;
                }
            }

            if (!commandUpdated) {
                return res.status(404).json({ error: `Command '${commandIdentifier}' not found in plugin '${pluginName}'.` });
            }

            await fs.writeFile(target.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
            await pluginManager.loadPlugins();
            res.json({
                message: `指令 '${commandIdentifier}' 在插件 '${pluginName}' 中的描述已更新并重新加载。`,
                pluginRootId: target.pluginRootId,
                pluginSource: target.pluginSource,
                diagnostics: target.diagnostics || []
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating command description for plugin ${pluginName}, command ${commandIdentifier}: ${safeErrorDetails(error)}`);
            res.status(500).json({ error: `更新指令描述时出错`, details: safeErrorDetails(error) });
        }
    });

    // --- Preprocessor Order Management API ---
    router.get('/preprocessors/order', (req, res) => {
        try {
            const order = pluginManager.getPreprocessorOrder();
            res.json({ status: 'success', order });
        } catch (error) {
            console.error(`[AdminAPI] Error getting preprocessor order: ${safeErrorDetails(error)}`);
            res.status(500).json({ status: 'error', message: 'Failed to get preprocessor order.' });
        }
    });

    router.post('/preprocessors/order', async (req, res) => {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ status: 'error', message: 'Invalid request: "order" must be an array.' });
        }

        try {
            await fs.writeFile(PREPROCESSOR_ORDER_FILE, JSON.stringify(order, null, 2), 'utf-8');
            if (DEBUG_MODE) console.log('[AdminAPI] Saved new preprocessor order to file.');

            const newOrder = await pluginManager.hotReloadPluginsAndOrder();
            res.json({ status: 'success', message: 'Order saved and hot-reloaded successfully.', newOrder });
        } catch (error) {
            console.error(`[AdminAPI] Error saving or hot-reloading preprocessor order: ${safeErrorDetails(error)}`);
            res.status(500).json({ status: 'error', message: 'Failed to save or hot-reload preprocessor order.' });
        }
    });

    return router;
};
