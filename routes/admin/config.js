const express = require('express');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const {
    DEFAULT_TOOL_APPROVAL_CONFIG,
    normalizeToolApprovalConfig,
    validateToolApprovalConfig
} = require('../../modules/toolApprovalConfigSchema');

module.exports = function(options) {
    const router = express.Router();
    const { pluginManager } = options;
    const projectBasePath = path.resolve(options.projectBasePath || path.join(__dirname, '..', '..'));

    function projectPath(...segments) {
        return path.join(projectBasePath, ...segments);
    }

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

    async function assertRegularConfigTarget(configPath) {
        try {
            const stat = await fs.lstat(configPath);
            if (stat.isSymbolicLink()) {
                const error = new Error('config.env symlink targets are not supported.');
                error.code = 'main_config_env_symlink_unsupported';
                error.status = 409;
                throw error;
            }
            if (!stat.isFile()) {
                const error = new Error('config.env target must be a regular file.');
                error.code = 'main_config_env_non_regular_unsupported';
                error.status = 409;
                throw error;
            }
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }
    }

    function createMainConfigTempPath(configPath) {
        const suffix = `${Date.now()}-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
        return path.join(path.dirname(configPath), `.config.env.${suffix}.tmp`);
    }

    async function writeMainConfigNoFollow(configPath, content) {
        await assertRegularConfigTarget(configPath);
        const tempPath = createMainConfigTempPath(configPath);
        let tempCreated = false;
        try {
            await fs.writeFile(tempPath, content, { encoding: 'utf-8', flag: 'wx' });
            tempCreated = true;
            const tempStat = await fs.lstat(tempPath);
            if (!tempStat.isFile() || tempStat.isSymbolicLink()) {
                const error = new Error('Temporary config.env target must be a regular file.');
                error.code = 'main_config_env_temp_unsafe';
                error.status = 500;
                throw error;
            }
            await fs.rename(tempPath, configPath);
            tempCreated = false;
        } finally {
            if (tempCreated) {
                await fs.rm(tempPath, { force: true }).catch(() => {});
            }
        }
    }

    // --- Tool Approval Config API ---
    router.get('/tool-approval-config', async (req, res) => {
        const configPath = projectPath('toolApprovalConfig.json');
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            res.json(normalizeToolApprovalConfig(JSON.parse(content)));
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json(normalizeToolApprovalConfig(DEFAULT_TOOL_APPROVAL_CONFIG));
            } else {
                console.error('[AdminPanelRoutes API] Error reading tool approval config:', error);
                res.status(500).json({ error: 'Failed to read tool approval config', details: error.message });
            }
        }
    });

    router.post('/tool-approval-config', async (req, res) => {
        const { config } = req.body;
        const validation = validateToolApprovalConfig(config);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid tool approval configuration.',
                details: validation.errors
            });
        }
        const configPath = projectPath('toolApprovalConfig.json');
        try {
            const normalizedConfig = normalizeToolApprovalConfig(config);
            await fs.writeFile(configPath, JSON.stringify(normalizedConfig, null, 2), 'utf-8');
            res.json({ success: true, message: '工具调用审核配置已成功保存。' });
        } catch (error) {
            console.error('[AdminPanelRoutes API] Error writing tool approval config:', error);
            res.status(500).json({ error: 'Failed to write tool approval config', details: error.message });
        }
    });

    // --- Main Config API ---
    router.get('/config/main', async (req, res) => {
        try {
            const configPath = projectPath('config.env');
            const examplePath = projectPath('config.env.example');
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
            const configPath = projectPath('config.env');
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
        try {
            const configPath = projectPath('config.env');
            await writeMainConfigNoFollow(configPath, content);
            await pluginManager.loadPlugins();
            res.json({ message: '主配置已成功保存并已重新加载。' });
        } catch (error) {
            const status = error.status || 500;
            if (status >= 500) {
                console.error('Error writing main config for admin panel:', error);
            } else {
                console.warn(`[AdminPanelRoutes] Refused main config write: ${error.code || error.message}`);
            }
            res.status(status).json({
                error: 'Failed to write main config file',
                details: error.message,
                code: error.code || undefined,
            });
        }
    });

    return router;
};
