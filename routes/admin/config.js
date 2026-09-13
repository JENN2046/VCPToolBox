const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

const PROCESS_LEVEL_CONFIG_KEYS = new Set([
    'PORT',
    'VECTORDB_DIMENSION',
    'KNOWLEDGEBASE_ROOT_PATH',
    'TDB_KNOWLEDGE_ROOT_PATH',
    'KNOWLEDGEBASE_DB_PATH',
    'VECTORDB_PATH',
    'DATABASE_URL',
    'Key',
    'API_Key',
    'API_URL',
    'AdminUsername',
    'AdminPassword',
    'VCP_Key',
    'VCP_BIND_HOST',
    'BIND_HOST',
    'DEFAULT_TIMEZONE'
]);

function parseAndValidateEnv(content) {
    const text = String(content || '');
    const invalidLines = [];
    text.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const equalsIndex = normalized.indexOf('=');
        const key = equalsIndex >= 0 ? normalized.slice(0, equalsIndex).trim() : '';
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            invalidLines.push(index + 1);
        }
    });
    if (invalidLines.length) {
        const error = new Error(`Invalid config.env syntax on line(s): ${invalidLines.join(', ')}`);
        error.code = 'INVALID_ENV_SYNTAX';
        throw error;
    }
    return dotenv.parse(text);
}

function changedEnvKeys(before, after) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).filter(key => before[key] !== after[key]).sort();
}

function isProcessLevelKey(key) {
    return PROCESS_LEVEL_CONFIG_KEYS.has(key)
        || /(?:^|_)(?:DB|DATABASE|SQLITE)(?:_|$).*PATH/i.test(key)
        || /(?:^|_)DIMENSION$/i.test(key);
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
    const { pluginManager, triggerRestart } = options;

    async function readFileIfExists(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { exists: true, content };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { exists: false, content: '' };
            }
            throw error;
        }
    }

    function normalizeEnvContent(content) {
        return String(content || '').replace(/\r\n/g, '\n').trimEnd();
    }

    // --- Tool Approval Config API ---
    router.get('/tool-approval-config', async (req, res) => {
        const configPath = path.join(__dirname, '..', '..', 'toolApprovalConfig.json');
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            res.json(JSON.parse(content));
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json({ enabled: false, timeoutMinutes: 5, approveAll: false, approvalList: [] });
            } else {
                console.error('[AdminPanelRoutes API] Error reading tool approval config:', error);
                res.status(500).json({ error: 'Failed to read tool approval config', details: error.message });
            }
        }
    });

    router.post('/tool-approval-config', async (req, res) => {
        const { config } = req.body;
        if (typeof config !== 'object' || config === null) {
            return res.status(400).json({ error: 'Invalid configuration data. Object expected.' });
        }
        const configPath = path.join(__dirname, '..', '..', 'toolApprovalConfig.json');
        try {
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
            res.json({ success: true, message: '工具调用审核配置已成功保存。' });
        } catch (error) {
            console.error('[AdminPanelRoutes API] Error writing tool approval config:', error);
            res.status(500).json({ error: 'Failed to write tool approval config', details: error.message });
        }
    });

    // --- Main Config API ---
    router.get('/config/main', async (req, res) => {
        try {
            const configPath = path.join(__dirname, '..', '..', 'config.env');
            const examplePath = path.join(__dirname, '..', '..', 'config.env.example');
            const [configResult, exampleResult] = await Promise.all([
                readFileIfExists(configPath),
                readFileIfExists(examplePath),
            ]);

            const configExists = configResult.exists;
            const exampleExists = exampleResult.exists;
            const configMatchesExample =
                configExists &&
                exampleExists &&
                normalizeEnvContent(configResult.content) ===
                    normalizeEnvContent(exampleResult.content);
            const hasCustomConfig = configExists && (!exampleExists || !configMatchesExample);

            let source = 'none';
            let content = '';

            if (hasCustomConfig) {
                source = 'config.env';
                content = configResult.content;
            } else if (exampleExists) {
                source = 'config.env.example';
                content = exampleResult.content;
            } else if (configExists) {
                source = 'config.env';
                content = configResult.content;
            }

            res.json({
                content,
                exampleContent: exampleExists ? exampleResult.content : '',
                source,
                configExists,
                exampleExists,
                configMatchesExample,
                hasCustomConfig,
            });
        } catch (error) {
            console.error('Error reading main config for admin panel:', error);
            res.status(500).json({ error: 'Failed to read main config file', details: error.message });
        }
    });

    router.get('/config/main/raw', async (req, res) => {
        try {
            const configPath = path.join(__dirname, '..', '..', 'config.env');
            const content = await fs.readFile(configPath, 'utf-8');
            res.json({ content: content });
        } catch (error) {
            console.error('Error reading raw main config for admin panel:', error);
            res.status(500).json({ error: 'Failed to read raw main config file', details: error.message });
        }
    });

    router.post('/config/main', async (req, res) => {
        const { content } = req.body;
        if (typeof content !== 'string') {
            return res.status(400).json({ error: 'Invalid content format. String expected.' });
        }
        const configPath = path.join(__dirname, '..', '..', 'config.env');
        let previous;
        let previousExists = true;
        let before = {};
        let after;
        try {
            try {
                previous = await fs.readFile(configPath, 'utf8');
                before = parseAndValidateEnv(previous);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                previousExists = false;
                previous = '';
            }
            after = parseAndValidateEnv(content);
            const changedKeys = changedEnvKeys(before, after);
            const pluginRuntimeOnly = changedKeys.length > 0 && changedKeys.every(key => (
                !isProcessLevelKey(key)
                && pluginManager.isPluginRuntimeConfigKey?.(key) === true
            ));
            const restartRequired = changedKeys.length > 0 && !pluginRuntimeOnly;
            const applyMode = changedKeys.length === 0
                ? 'save_only'
                : (restartRequired ? 'restart' : 'hot_reload');

            await atomicWriteFile(configPath, content);

            if (applyMode === 'hot_reload') {
                const previousEnvValues = new Map(changedKeys.map(key => [key, process.env[key]]));
                for (const key of changedKeys) {
                    if (Object.prototype.hasOwnProperty.call(after, key)) process.env[key] = after[key];
                    else delete process.env[key];
                }
                try {
                    await pluginManager.reloadPlugins({
                        force: false,
                        reason: 'main_config'
                    });
                } catch (reloadError) {
                    if (previousExists) await atomicWriteFile(configPath, previous);
                    else await fs.unlink(configPath).catch(() => {});
                    for (const [key, value] of previousEnvValues) {
                        if (value === undefined) delete process.env[key];
                        else process.env[key] = value;
                    }
                    reloadError.code = reloadError.code || 'CONFIG_HOT_RELOAD_FAILED';
                    throw reloadError;
                }
            }

            const response = {
                status: 'success',
                message: applyMode === 'hot_reload'
                    ? '主配置已原子保存并应用到新插件代际。'
                    : (applyMode === 'restart'
                        ? '主配置已原子保存，将由 systemd 受控重启后应用。'
                        : '主配置内容已保存，无运行态键变化。'),
                applyMode,
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired,
                changedKeys
            };
            res.status(applyMode === 'restart' ? 202 : 200).json(response);

            if (applyMode === 'restart' && typeof triggerRestart === 'function') {
                setImmediate(() => {
                    Promise.resolve(triggerRestart(1)).catch(error => {
                        console.error('[AdminPanelRoutes] Controlled restart after config save failed:', error);
                    });
                });
            }
        } catch (error) {
            console.error('Error writing main config for admin panel:', error);
            const statusCode = error.code === 'INVALID_ENV_SYNTAX'
                ? 400
                : (error.statusCode || (error.code === 'PLUGIN_RELOAD_BLOCKED' ? 409 : 500));
            res.status(statusCode).json({
                status: 'error',
                error: 'Failed to atomically apply main config file',
                details: error.message,
                code: error.code || null,
                reload: error.result || error.reloadResult || null,
                applyMode: 'save_only',
                generation: pluginManager.getRuntimeStatus?.().generation || null,
                restartRequired: false,
                changedKeys: after ? changedEnvKeys(before, after) : []
            });
        }
    });

    return router;
};
