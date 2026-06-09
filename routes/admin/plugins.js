const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { readPluginDashboardCards } = require('./lib/dashboardCards');

const manifestFileName = 'plugin-manifest.json';
const blockedManifestExtension = '.block';

const SENSITIVE_CONFIG_KEY_RE = /(api[_-]?key|token|secret|password|passwd|cookie|authorization|credential|private[_-]?key)/i;

function getProjectRoot() {
    return path.join(__dirname, '..', '..');
}

function toSafeDisplayPath(filePath, source = 'external') {
    if (!filePath || typeof filePath !== 'string') return null;
    const projectRoot = path.resolve(getProjectRoot());
    const resolved = path.resolve(filePath);
    const relative = path.relative(projectRoot, resolved);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
        return relative.replace(/\\/g, '/') || '.';
    }
    return `[${source}]/${path.basename(resolved)}`;
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

function sanitizeManifestForAdmin(manifest) {
    if (!manifest || typeof manifest !== 'object') return manifest;
    const clone = JSON.parse(JSON.stringify(manifest));

    delete clone.pluginSpecificEnvConfig;

    if (clone.configSchema) {
        clone.configSchema = redactConfigSchema(clone.configSchema);
    }

    const source = clone.pluginSource || (clone.isDistributed ? 'distributed' : 'core');
    if (clone.basePath) {
        clone.basePath = toSafeDisplayPath(clone.basePath, source);
    }
    if (clone.pluginRoot) {
        clone.pluginRoot = toSafeDisplayPath(clone.pluginRoot, source);
    }
    if (clone.pluginRootId) {
        clone.pluginRootId = sanitizeRootId(clone.pluginRootId);
    }

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
            console.warn(`[AdminPanelRoutes] Cannot inspect config.env status for ${pluginName}: ${envError.code || envError.message}`);
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

module.exports = function(options) {
    const router = express.Router();
    const { pluginManager, DEBUG_MODE } = options;
    const PREPROCESSOR_ORDER_FILE = path.join(__dirname, '..', '..', 'preprocessor_order.json');

    // GET plugin list
    router.get('/plugins', async (req, res) => {
        try {
            const pluginDataMap = new Map();
            const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

            const loadedPlugins = Array.from(pluginManager.plugins.values());
            for (const p of loadedPlugins) {
                let configEnvStatus = { exists: false, readable: false, redacted: true };
                if (!p.isDistributed && p.basePath) {
                    configEnvStatus = await getConfigEnvStatus(p.basePath, p.name);
                }
                const pluginSource = p.pluginSource || (p.isDistributed ? 'distributed' : 'core');
                pluginDataMap.set(p.name, {
                    name: p.name,
                    manifest: sanitizeManifestForAdmin(p),
                    dashboardCards: readPluginDashboardCards(p.name, p),
                    enabled: true,
                    configEnvContent: null,
                    configEnvStatus,
                    isDistributed: p.isDistributed || false,
                    pluginSource,
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
                            manifest.basePath = pluginPath;
                            manifest.pluginSource = 'core';
                            manifest.pluginRoot = PLUGIN_DIR;
                            manifest.pluginRootId = 'core:legacy';
                            const configEnvStatus = await getConfigEnvStatus(pluginPath, manifest.name);
                            pluginDataMap.set(manifest.name, {
                                name: manifest.name,
                                manifest: sanitizeManifestForAdmin(manifest),
                                dashboardCards: readPluginDashboardCards(manifest.name, manifest),
                                enabled: false,
                                configEnvContent: null,
                                configEnvStatus,
                                isDistributed: false,
                                pluginSource: 'core',
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

    // Toggle plugin status
    router.post('/plugins/:pluginName/toggle', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { enable } = req.body;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        if (typeof enable !== 'boolean') {
            return res.status(400).json({ error: 'Invalid request body. Expected { enable: boolean }.' });
        }

        try {
            const pluginFolders = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
            let targetPluginPath = null;
            let foundManifest = null;

            for (const folder of pluginFolders) {
                if (folder.isDirectory()) {
                    const potentialPluginPath = path.join(PLUGIN_DIR, folder.name);
                    const potentialManifestPath = path.join(potentialPluginPath, manifestFileName);
                    const potentialBlockedPath = potentialManifestPath + blockedManifestExtension;
                    let manifestContent = null;

                    try {
                        manifestContent = await fs.readFile(potentialManifestPath, 'utf-8');
                    } catch (err) {
                        if (err.code === 'ENOENT') {
                            try {
                                manifestContent = await fs.readFile(potentialBlockedPath, 'utf-8');
                            } catch (blockedErr) { continue; }
                        } else { continue; }
                    }

                    try {
                        const manifest = JSON.parse(manifestContent);
                        if (manifest.name === pluginName) {
                            targetPluginPath = potentialPluginPath;
                            foundManifest = manifest;
                            break;
                        }
                    } catch (parseErr) { continue; }
                }
            }

            if (!targetPluginPath || !foundManifest) {
                return res.status(404).json({ error: `Plugin '${pluginName}' not found.` });
            }

            const manifestPathToUse = path.join(targetPluginPath, manifestFileName);
            const blockedManifestPathToUse = manifestPathToUse + blockedManifestExtension;

            if (enable) {
                try {
                    await fs.rename(blockedManifestPathToUse, manifestPathToUse);
                    await pluginManager.loadPlugins();
                    res.json({ message: `插件 ${pluginName} 已启用。` });
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        try {
                            await fs.access(manifestPathToUse);
                            res.json({ message: `插件 ${pluginName} 已经是启用状态。` });
                        } catch (accessError) {
                            res.status(500).json({ error: `无法启用插件 ${pluginName}。找不到 manifest 文件。`, details: accessError.message });
                        }
                    } else {
                        console.error(`[AdminPanelRoutes] Error enabling plugin ${pluginName}:`, error);
                        res.status(500).json({ error: `启用插件 ${pluginName} 时出错`, details: error.message });
                    }
                }
            } else {
                try {
                    await fs.rename(manifestPathToUse, blockedManifestPathToUse);
                    await pluginManager.loadPlugins();
                    res.json({ message: `插件 ${pluginName} 已禁用。` });
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        try {
                            await fs.access(blockedManifestPathToUse);
                            res.json({ message: `插件 ${pluginName} 已经是禁用状态。` });
                        } catch (accessError) {
                            res.status(500).json({ error: `无法禁用插件 ${pluginName}。找不到 manifest 文件。`, details: accessError.message });
                        }
                    } else {
                        console.error(`[AdminPanelRoutes] Error disabling plugin ${pluginName}:`, error);
                        res.status(500).json({ error: `禁用插件 ${pluginName} 时出错`, details: error.message });
                    }
                }
            }
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error toggling plugin ${pluginName}:`, error);
            res.status(500).json({ error: `处理插件 ${pluginName} 状态切换时出错`, details: error.message });
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

            manifest.description = description;
            await fs.writeFile(targetManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
            await pluginManager.loadPlugins();
            res.json({ message: `插件 ${pluginName} 的描述已更新并重新加载。` });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating description for plugin ${pluginName}:`, error);
            res.status(500).json({ error: `更新插件 ${pluginName} 描述时出错`, details: error.message });
        }
    });

    // Save plugin config
    router.post('/plugins/:pluginName/config', async (req, res) => {
        const pluginName = req.params.pluginName;
        const { content, confirmBlankConfigEnv } = req.body;
        const PLUGIN_DIR = path.join(__dirname, '..', '..', 'Plugin');

        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'Invalid content format. String expected.' });
        }

        try {
            const loadedManifest = pluginManager.plugins?.get(pluginName);
            if (isExternalPluginManifest(loadedManifest)) {
                return res.status(403).json({
                    error: 'External plugin config editing is deferred in P0.',
                    code: 'external_config_deferred',
                    status: 'deferred'
                });
            }

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
            res.json({ message: `插件 ${pluginName} 的配置已保存并已重新加载。` });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error writing config.env for plugin ${pluginName}:`, error);
            res.status(500).json({ error: `保存插件 ${pluginName} 配置时出错`, details: error.message });
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

            await fs.writeFile(targetManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
            await pluginManager.loadPlugins();
            res.json({ message: `指令 '${commandIdentifier}' 在插件 '${pluginName}' 中的描述已更新并重新加载。` });
        } catch (error) {
            console.error(`[AdminPanelRoutes] Error updating command description for plugin ${pluginName}, command ${commandIdentifier}:`, error);
            res.status(500).json({ error: `更新指令描述时出错`, details: error.message });
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

        try {
            await fs.writeFile(PREPROCESSOR_ORDER_FILE, JSON.stringify(order, null, 2), 'utf-8');
            if (DEBUG_MODE) console.log('[AdminAPI] Saved new preprocessor order to file.');

            const newOrder = await pluginManager.hotReloadPluginsAndOrder();
            res.json({ status: 'success', message: 'Order saved and hot-reloaded successfully.', newOrder });
        } catch (error) {
            console.error('[AdminAPI] Error saving or hot-reloading preprocessor order:', error);
            res.status(500).json({ status: 'error', message: 'Failed to save or hot-reload preprocessor order.' });
        }
    });

    return router;
};
