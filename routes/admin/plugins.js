const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const { createHash } = require('node:crypto');
const { readPluginDashboardCards } = require('./lib/dashboardCards');

const manifestFileName = 'plugin-manifest.json';
const blockedManifestExtension = '.block';
const maxReadmeSizeBytes = 2 * 1024 * 1024;

async function findPluginReadmePath(pluginPath) {
    try {
        const entries = await fs.readdir(pluginPath, { withFileTypes: true });
        const readmeEntry = entries.find(entry =>
            entry.isFile() && entry.name.toLowerCase() === 'readme.md'
        );
        return readmeEntry ? path.join(pluginPath, readmeEntry.name) : null;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`[AdminPanelRoutes] Error checking README in ${pluginPath}:`, error);
        }
        return null;
    }
}

function validateEnvContent(content) {
    const invalidLines = [];
    String(content || '').split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const equals = normalized.indexOf('=');
        const key = equals >= 0 ? normalized.slice(0, equals).trim() : '';
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) invalidLines.push(index + 1);
    });
    if (invalidLines.length) {
        const error = new Error(`Invalid config.env syntax on line(s): ${invalidLines.join(', ')}`);
        error.code = 'INVALID_ENV_SYNTAX';
        throw error;
    }
    return dotenv.parse(String(content || ''));
}

async function atomicWriteFile(filePath, content) {
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const mode = await fs.stat(filePath)
        .then(stat => stat.mode & 0o777)
        .catch(error => {
            if (error.code === 'ENOENT') return 0o600;
            throw error;
        });
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

module.exports = function(options) {
    const router = express.Router();
    const { pluginManager, DEBUG_MODE } = options;
    const PREPROCESSOR_ORDER_FILE = path.join(__dirname, '..', '..', 'preprocessor_order.json');

    // R0 operator only: accepted P1B bytes, fixed path, initial activation only.
    // Authentication is inherited from the server's /admin_api middleware.
    const inspectorCandidate = Object.freeze({
        plugin_name: 'RiverMemoInspector',
        expected_source_sha256: '23cddf8be91dd227ea334b0de3334b734b6cdbc32fe20c3d23a69a926ac320c5',
        expected_manifest_sha256: '60364e294450951de464d77cff8ff9de568409979c42c79c76ad6955a73a2940'
    });
    const inspectorAdmissionPath = '/plugins/rivermemo-inspector/admission';
    router.get(inspectorAdmissionPath, (req, res) => {
        res.json({ status: 'success', schema: 'rivermemo-inspector-admission-r0',
            candidate: inspectorCandidate, mode: 'initial_activation',
            transaction_available: typeof pluginManager._admitDirectPlugin === 'function' });
    });
    router.post(inspectorAdmissionPath, async (req, res) => {
        const body = req.body;
        if (!body || Array.isArray(body) || typeof body !== 'object'
            || Object.keys(body).length !== Object.keys(inspectorCandidate).length
            || !Object.entries(inspectorCandidate).every(([key, value]) => body[key] === value)) {
            return res.status(400).json({ status: 'failed', code: 'INSPECTOR_ACCEPTED_CANDIDATE_REQUIRED' });
        }
        try {
            const basePath = path.resolve(__dirname, '../../Plugin/RiverMemoInspector/source');
            const [source, manifest] = await Promise.all([
                fs.readFile(path.join(basePath, 'RiverMemoInspector.js')),
                fs.readFile(path.join(basePath, 'plugin-manifest.json'))
            ]);
            const sha = bytes => createHash('sha256').update(bytes).digest('hex');
            if (sha(source) !== inspectorCandidate.expected_source_sha256
                || sha(manifest) !== inspectorCandidate.expected_manifest_sha256) {
                return res.status(409).json({ status: 'failed', code: 'INSPECTOR_ACCEPTED_SOURCE_DRIFT' });
            }
            if (pluginManager.plugins.has(inspectorCandidate.plugin_name)) {
                return res.status(409).json({ status: 'failed', code: 'INSPECTOR_ALREADY_REGISTERED' });
            }
            if (typeof pluginManager._admitDirectPlugin !== 'function') {
                return res.status(503).json({ status: 'failed', code: 'R1_TRANSACTION_UNAVAILABLE' });
            }
            // R1 alone owns loading/identity, fencing, quiescence, publication and rollback.
            const result = await pluginManager._admitDirectPlugin({
                name: inspectorCandidate.plugin_name,
                expectedIdentity: {
                    source_sha256: inspectorCandidate.expected_source_sha256,
                    manifest_sha256: inspectorCandidate.expected_manifest_sha256
                }
            });
            return res.json(result);
        } catch (error) {
            const status = Number.isInteger(error.statusCode) && error.statusCode >= 400
                && error.statusCode <= 599 ? error.statusCode : 500;
            return res.status(status).json(error.result || {
                status: 'failed', code: error.code || null, error: error.message,
                cleanup_error: error.cleanupError ? {
                    code: error.cleanupError.code || null, message: error.cleanupError.message
                } : null
            });
        }
    });

    function changedConfigKeys(before, after) {
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        return Array.from(keys).filter(key => before[key] !== after[key]).sort();
    }

    async function atomicallyApplyManifest(targetManifestPath, previousContent, manifest, reason) {
        pluginManager.suppressPluginWatcherPath?.(targetManifestPath);
        await atomicWriteFile(targetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
        try {
            return await pluginManager.reloadPlugins({
                force: false,
                reason
            });
        } catch (reloadError) {
            pluginManager.suppressPluginWatcherPath?.(targetManifestPath);
            await atomicWriteFile(targetManifestPath, previousContent);
            throw reloadError;
        }
    }

    router.get('/plugins/runtime', async (req, res) => {
        try {
            const runtime = typeof pluginManager.getDetailedRuntimeStatus === 'function'
                ? await pluginManager.getDetailedRuntimeStatus()
                : pluginManager.getRuntimeStatus?.() || { enabled: false, state: 'legacy' };
            res.json({ status: 'success', runtime });
        } catch (error) {
            console.error('[AdminPanelRoutes] Error reading plugin runtime status:', error);
            res.status(500).json({
                status: 'error',
                error: 'Failed to read plugin runtime status',
                details: error.message
            });
        }
    });

    router.post('/plugins/reload', async (req, res) => {
        const force = req.body?.force ?? false;
        if (typeof force !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                error: 'Invalid request body. force must be a boolean.'
            });
        }
        try {
            const result = await pluginManager.reloadPlugins({
                force,
                reason: 'admin_api'
            });
            res.json(result);
        } catch (error) {
            const statusCode = error.statusCode || (
                ['PLUGIN_RELOAD_BLOCKED', 'PLUGIN_RELOAD_IN_PROGRESS'].includes(error.code) ? 409 : 500
            );
            res.status(statusCode).json(
                error.result || error.reloadResult || {
                    status: 'failed',
                    error: error.message,
                    code: error.code || null,
                    runtime: pluginManager.getRuntimeStatus?.()
                }
            );
        }
    });

    // GET plugin list
    router.get('/plugins', async (req, res) => {
        try {
            const pluginDataMap = new Map();
            const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

            const loadedPlugins = Array.from(pluginManager.plugins.values());
            for (const p of loadedPlugins) {
                let configEnvContent = null;
                if (!p.isDistributed && p.basePath) {
                    try {
                        const pluginConfigPath = path.join(p.basePath, 'config.env');
                        configEnvContent = await fs.readFile(pluginConfigPath, 'utf-8');
                    } catch (envError) {
                        if (envError.code !== 'ENOENT') {
                            console.warn(`[AdminPanelRoutes] Error reading config.env for ${p.name}:`, envError);
                        }
                    }
                }
                const readmePath = !p.isDistributed && p.basePath
                    ? await findPluginReadmePath(p.basePath)
                    : null;
                pluginDataMap.set(p.name, {
                    name: p.name,
                    manifest: p,
                    dashboardCards: readPluginDashboardCards(p.name, p),
                    enabled: true,
                    configEnvContent: configEnvContent,
                    hasReadme: Boolean(readmePath),
                    isDistributed: p.isDistributed || false,
                    serverId: p.serverId || null
                });
            }

            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const pluginPath = path.join(PLUGIN_DIR, folder.name);
                    const manifestPath = path.join(pluginPath, manifestFileName);
                    const blockedManifestPath = manifestPath + blockedManifestExtension;

                    try {
                        const manifestContent = await fs.readFile(blockedManifestPath, 'utf-8');
                        const manifest = JSON.parse(manifestContent);

                        if (!pluginDataMap.has(manifest.name)) {
                            let configEnvContent = null;
                            try {
                                const pluginConfigPath = path.join(pluginPath, 'config.env');
                                configEnvContent = await fs.readFile(pluginConfigPath, 'utf-8');
                            } catch (envError) {
                                if (envError.code !== 'ENOENT') {
                                    console.warn(`[AdminPanelRoutes] Error reading config.env for disabled plugin ${manifest.name}:`, envError);
                                }
                            }
                            manifest.basePath = pluginPath;
                            const readmePath = await findPluginReadmePath(pluginPath);
                            pluginDataMap.set(manifest.name, {
                                name: manifest.name,
                                manifest: manifest,
                                dashboardCards: readPluginDashboardCards(manifest.name, manifest),
                                enabled: false,
                                configEnvContent: configEnvContent,
                                hasReadme: Boolean(readmePath),
                                isDistributed: false,
                                serverId: null
                            });
                        }
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.warn(`[AdminPanelRoutes] Error processing potential disabled plugin in ${folder.name}:`, error);
                        }
                    }
                }
            }

            const pluginDataList = Array.from(pluginDataMap.values());
            res.json(pluginDataList);
        } catch (error) {
            console.error('[AdminPanelRoutes] Error listing plugins:', error);
            res.status(500).json({ error: 'Failed to list plugins', details: error.message });
        }
    });

    // Read a plugin README (README.md match is case-insensitive)
    router.get('/plugins/:pluginName/readme', async (req, res) => {
        const pluginName = req.params.pluginName;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        try {
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            let targetPluginPath = null;

            for (const folder of pluginFolders) {
                if (!folder.isDirectory()) {
                    continue;
                }

                const pluginPath = path.join(PLUGIN_DIR, folder.name);
                const manifestPaths = [
                    path.join(pluginPath, manifestFileName),
                    path.join(pluginPath, manifestFileName + blockedManifestExtension)
                ];

                for (const manifestPath of manifestPaths) {
                    try {
                        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
                        if (manifest.name === pluginName) {
                            targetPluginPath = pluginPath;
                            break;
                        }
                    } catch (error) {
                        if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
                            console.warn(`[AdminPanelRoutes] Error checking manifest ${manifestPath}:`, error);
                        }
                    }
                }

                if (targetPluginPath) {
                    break;
                }
            }

            if (!targetPluginPath) {
                return res.status(404).json({ error: `Plugin '${pluginName}' not found.` });
            }

            const readmePath = await findPluginReadmePath(targetPluginPath);
            if (!readmePath) {
                return res.status(404).json({ error: `Plugin '${pluginName}' does not provide a README.md file.` });
            }

            const readmeStat = await fs.stat(readmePath);
            if (!readmeStat.isFile() || readmeStat.size > maxReadmeSizeBytes) {
                return res.status(413).json({ error: 'Plugin README is too large to display.' });
            }

            const content = await fs.readFile(readmePath, 'utf-8');
            res.json({
                fileName: path.basename(readmePath),
                content
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error reading README for plugin ${pluginName}:`, error);
            res.status(500).json({ error: `读取插件 ${pluginName} README 时出错`, details: error.message });
        }
    });

    // Toggle plugin status
    router.post('/plugins/:pluginName/toggle', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { enable, preprocessorOrder } = req.body;

        if (typeof enable !== 'boolean') {
            return res.status(400).json({ error: 'Invalid request body. Expected { enable: boolean }.' });
        }

        try {
            const result = await pluginManager.setLocalPluginEnabled(pluginName, enable, {
                preprocessorOrder
            });
            res.json({
                ...result,
                applyMode: result.changed ? 'hot_reload' : 'save_only',
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired: false,
                changedKeys: result.changed ? [`plugin:${pluginName}:enabled`] : []
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error toggling plugin ${pluginName}:`, error);
            const statusCode = error.statusCode || (
                ['PREPROCESSOR_ORDER_CONFIRMATION_REQUIRED', 'PREPROCESSOR_ORDER_INVALID', 'PLUGIN_RELOAD_BLOCKED']
                    .includes(error.code)
                    ? 409
                    : (error.message?.includes('not found') ? 404 : 500)
            );
            res.status(statusCode).json({
                status: 'error',
                error: `处理插件 ${pluginName} 状态切换时出错`,
                details: error.message,
                code: error.code || null,
                orderConfirmationRequired: error.code === 'PREPROCESSOR_ORDER_CONFIRMATION_REQUIRED',
                generation: pluginManager.getRuntimeStatus?.().generation || null
            });
        }
    });

    // Update plugin description
    router.post('/plugins/:pluginName/description', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { description } = req.body;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Invalid request body. Expected { description: string }.' });
        }

        try {
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            let targetManifestPath = null;
            let manifest = null;

            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const potentialPluginPath = path.join(PLUGIN_DIR, folder.name);
                    const potentialManifestPath = path.join(potentialPluginPath, manifestFileName);
                    const potentialBlockedPath = potentialManifestPath + blockedManifestExtension;
                    let currentPath = null;
                    let manifestContent = null;

                    try {
                        manifestContent = await fs.readFile(potentialManifestPath, 'utf-8');
                        currentPath = potentialManifestPath;
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            try {
                                manifestContent = await fs.readFile(potentialBlockedPath, 'utf-8');
                                currentPath = potentialBlockedPath;
                            } catch (blockedErr) { continue; }
                        } else { continue; }
                    }

                    try {
                        const parsedManifest = JSON.parse(manifestContent);
                        if (parsedManifest.name === pluginName) {
                            targetManifestPath = currentPath;
                            manifest = parsedManifest;
                            break;
                        }
                    } catch (parseErr) { continue; }
                }
            }

            if (!targetManifestPath || !manifest) {
                return res.status(404).json({ error: `Plugin '${pluginName}' or its manifest file not found.` });
            }

            const previousContent = await fs.readFile(targetManifestPath, 'utf8');
            manifest.description = description;
            const reload = await atomicallyApplyManifest(
                targetManifestPath,
                previousContent,
                manifest,
                `plugin_manifest_description:${pluginName}`
            );
            res.json({
                status: 'success',
                message: `插件 ${pluginName} 的描述已原子更新并重新加载。`,
                applyMode: 'hot_reload',
                generation: reload.newGeneration,
                restartRequired: false,
                changedKeys: [`plugin:${pluginName}:description`]
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating description for plugin ${pluginName}:`, error);
            res.status(error.statusCode || (error.code === 'PLUGIN_RELOAD_BLOCKED' ? 409 : 500)).json({
                status: 'error',
                error: `更新插件 ${pluginName} 描述时出错`,
                details: error.message,
                code: error.code || null,
                reload: error.result || error.reloadResult || null,
                applyMode: 'save_only',
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired: false,
                changedKeys: []
            });
        }
    });

    // Save plugin config
    router.post('/plugins/:pluginName/config', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { content } = req.body;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'Invalid content format. String expected.' });
        }

        try {
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            let targetPluginPath = null;

            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const potentialPluginPath = path.join(PLUGIN_DIR, folder.name);
                    const manifestPath = path.join(potentialPluginPath, manifestFileName);
                    const blockedManifestPath = manifestPath + blockedManifestExtension;
                    let manifestContent = null;
                    try {
                        manifestContent = await fs.readFile(manifestPath, 'utf-8');
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            try { manifestContent = await fs.readFile(blockedManifestPath, 'utf-8'); }
                            catch (blockedErr) { continue; }
                        } else { continue; }
                    }
                    try {
                        const manifest = JSON.parse(manifestContent);
                        if (manifest.name === pluginName) {
                            targetPluginPath = potentialPluginPath;
                            break;
                        }
                    } catch (parseErr) { continue; }
                }
            }

            if (!targetPluginPath) {
                return res.status(404).json({ error: `Plugin folder for '${pluginName}' not found.` });
            }

            const configPath = path.join(targetPluginPath, 'config.env');
            validateEnvContent(content);
            let previous = '';
            let previousExists = true;
            try {
                previous = await fs.readFile(configPath, 'utf8');
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                previousExists = false;
            }
            const beforeConfig = previousExists ? validateEnvContent(previous) : {};
            const afterConfig = validateEnvContent(content);
            const changedKeys = changedConfigKeys(beforeConfig, afterConfig);

            pluginManager.suppressPluginWatcherPath?.(configPath);
            await atomicWriteFile(configPath, content);
            if (changedKeys.length === 0) {
                return res.json({
                    status: 'success',
                    message: `插件 ${pluginName} 的配置已保存，无运行态键变化。`,
                    applyMode: 'save_only',
                    generation: pluginManager.getRuntimeStatus?.().generation || null,
                    restartRequired: false,
                    changedKeys: []
                });
            }
            try {
                const reload = await pluginManager.reloadPlugins({
                    force: false,
                    reason: `plugin_config:${pluginName}`
                });
                res.json({
                    status: 'success',
                    message: `插件 ${pluginName} 的配置已原子保存并应用。`,
                    applyMode: 'hot_reload',
                    generation: reload.newGeneration,
                    restartRequired: false,
                    changedKeys
                });
            } catch (reloadError) {
                pluginManager.suppressPluginWatcherPath?.(configPath);
                if (previousExists) await atomicWriteFile(configPath, previous);
                else await fs.unlink(configPath).catch(() => {});
                throw reloadError;
            }
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error writing config.env for plugin ${pluginName}:`, error);
            const statusCode = error.code === 'INVALID_ENV_SYNTAX'
                ? 400
                : (error.statusCode || (error.code === 'PLUGIN_RELOAD_BLOCKED' ? 409 : 500));
            res.status(statusCode).json({
                status: 'error',
                error: `保存插件 ${pluginName} 配置时出错`,
                details: error.message,
                code: error.code || null,
                reload: error.result || error.reloadResult || null,
                applyMode: 'save_only',
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired: false,
                changedKeys: []
            });
        }
    });

    // Update command description
    router.post('/plugins/:pluginName/commands/:commandIdentifier/description', async (req, res) => {
        const { pluginName, commandIdentifier } = req.params;
        const { description } = req.body;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        if (typeof description !== 'string') {
            return res.status(400).json({ error: 'Invalid request body. Expected { description: string }.' });
        }

        try {
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            let targetManifestPath = null;
            let manifest = null;
            let pluginFound = false;

            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const potentialPluginPath = path.join(PLUGIN_DIR, folder.name);
                    const potentialManifestPath = path.join(potentialPluginPath, manifestFileName);
                    const potentialBlockedPath = potentialManifestPath + blockedManifestExtension;
                    let currentPath = null;
                    let manifestContent = null;

                    try {
                        manifestContent = await fs.readFile(potentialManifestPath, 'utf-8');
                        currentPath = potentialManifestPath;
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            try {
                                manifestContent = await fs.readFile(potentialBlockedPath, 'utf-8');
                                currentPath = potentialBlockedPath;
                            } catch (blockedErr) { continue; }
                        } else { continue; }
                    }

                    try {
                        const parsedManifest = JSON.parse(manifestContent);
                        if (parsedManifest.name === pluginName) {
                            targetManifestPath = currentPath;
                            manifest = parsedManifest;
                            pluginFound = true;
                            break;
                        }
                    } catch (parseErr) {
                        console.warn(`[AdminPanelRoutes] Error parsing manifest for ${folder.name}: ${parseErr.message}`);
                        continue;
                    }
                }
            }

            if (!pluginFound || !manifest) {
                return res.status(404).json({ error: `Plugin '${pluginName}' or its manifest file not found.` });
            }

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

            const previousContent = await fs.readFile(targetManifestPath, 'utf8');
            const reload = await atomicallyApplyManifest(
                targetManifestPath,
                previousContent,
                manifest,
                `plugin_manifest_command:${pluginName}:${commandIdentifier}`
            );
            res.json({
                status: 'success',
                message: `指令 '${commandIdentifier}' 在插件 '${pluginName}' 中的描述已原子更新并重新加载。`,
                applyMode: 'hot_reload',
                generation: reload.newGeneration,
                restartRequired: false,
                changedKeys: [`plugin:${pluginName}:command:${commandIdentifier}:description`]
            });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating command description for plugin ${pluginName}, command ${commandIdentifier}:`, error);
            res.status(error.statusCode || (error.code === 'PLUGIN_RELOAD_BLOCKED' ? 409 : 500)).json({
                status: 'error',
                error: '更新指令描述时出错',
                details: error.message,
                code: error.code || null,
                reload: error.result || error.reloadResult || null,
                applyMode: 'save_only',
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired: false,
                changedKeys: []
            });
        }
    });

    // --- Preprocessor Order Management API ---
    router.get('/preprocessors/order', (req, res) => {
        try {
            const order = pluginManager.getPreprocessorOrder();
            res.json({ status: 'success', order });
        } catch (error) {
            console.error('[AdminAPI] Error getting preprocessor order:', error);
            res.status(500).json({ status: 'error', message: 'Failed to get preprocessor order.' });
        }
    });

    router.post('/preprocessors/order', async (req, res) => {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ status: 'error', message: 'Invalid request: "order" must be an array.' });
        }

        let previous;
        try {
            const normalized = order.map(item => String(item));
            const available = Array.from(pluginManager.messagePreprocessors.keys());
            const availableSet = new Set(available);
            const duplicates = normalized.filter((name, index) => normalized.indexOf(name) !== index);
            const unknown = normalized.filter(name => !availableSet.has(name));
            const configured = new Set(normalized);
            const omitted = available.filter(name => !configured.has(name));
            if (duplicates.length || unknown.length || omitted.length) {
                return res.status(409).json({
                    status: 'error',
                    code: 'PREPROCESSOR_ORDER_MISMATCH',
                    message: 'Strict order must contain every enabled preprocessor exactly once.',
                    duplicates: Array.from(new Set(duplicates)),
                    unknown,
                    omitted
                });
            }

            previous = await fs.readFile(PREPROCESSOR_ORDER_FILE, 'utf8').catch(error => {
                if (error.code === 'ENOENT') return null;
                throw error;
            });
            const document = {
                version: 2,
                strict: true,
                order: normalized
            };
            pluginManager.suppressPluginWatcherPath?.(PREPROCESSOR_ORDER_FILE);
            await atomicWriteFile(PREPROCESSOR_ORDER_FILE, `${JSON.stringify(document, null, 2)}\n`);
            if (DEBUG_MODE) console.log('[AdminAPI] Saved new preprocessor order to file.');

            try {
                const reload = await pluginManager.reloadPlugins({
                    force: false,
                    reason: 'preprocessor_order'
                });
                res.json({
                    status: 'success',
                    message: 'Strict order saved and hot-reloaded successfully.',
                    newOrder: pluginManager.getPreprocessorOrder(),
                    applyMode: 'hot_reload',
                    generation: reload.newGeneration,
                    restartRequired: false,
                    changedKeys: ['preprocessor_order']
                });
            } catch (reloadError) {
                pluginManager.suppressPluginWatcherPath?.(PREPROCESSOR_ORDER_FILE);
                if (previous === null) await fs.unlink(PREPROCESSOR_ORDER_FILE).catch(() => {});
                else await atomicWriteFile(PREPROCESSOR_ORDER_FILE, previous);
                throw reloadError;
            }
        } catch (error) {
            console.error('[AdminAPI] Error saving or hot-reloading preprocessor order:', error);
            res.status(error.statusCode || (error.code === 'PLUGIN_RELOAD_BLOCKED' ? 409 : 500)).json({
                status: 'error',
                message: 'Failed to save or hot-reload preprocessor order.',
                details: error.message,
                code: error.code || null,
                reload: error.result || error.reloadResult || null
            });
        }
    });

    return router;
};
