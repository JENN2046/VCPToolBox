const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const routePath = require.resolve('../routes/admin/config');

async function withConfigApp(fsStub, callback) {
    const originalLoad = Module._load;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === 'fs') {
            return { promises: fsStub };
        }

        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[routePath];

    try {
        const createConfigRouter = require('../routes/admin/config');
        const app = express();
        app.use(express.json());
        app.use(createConfigRouter({ pluginManager: { loadPlugins() {} } }));

        const server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        const baseUrl = `http://127.0.0.1:${address.port}`;

        try {
            await callback(baseUrl);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    } finally {
        Module._load = originalLoad;
        delete require.cache[routePath];
    }
}

async function withMainConfigApp(projectBasePath, callback) {
    delete require.cache[routePath];
    const createConfigRouter = require('../routes/admin/config');
    const app = express();
    app.use(express.json());

    const pluginManager = {
        loadCount: 0,
        async loadPlugins() {
            this.loadCount += 1;
        }
    };

    app.use(createConfigRouter({ pluginManager, projectBasePath }));

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
        await callback(baseUrl, pluginManager);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        delete require.cache[routePath];
    }
}

test('tool approval config route rejects semantic schema errors', async () => {
    const writes = [];

    await withConfigApp({
        async readFile() {
            throw Object.assign(new Error('not needed'), { code: 'ENOENT' });
        },
        async writeFile(...args) {
            writes.push(args);
        }
    }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/tool-approval-config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: {
                    enabled: 'yes',
                    timeoutMinutes: 0,
                    approvalList: ['ok', '']
                }
            })
        });

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.error, 'Invalid tool approval configuration.');
        assert.deepEqual(body.details, [
            'enabled must be a boolean',
            'timeoutMinutes must be a positive number',
            'approvalList must contain only non-empty strings'
        ]);
        assert.equal(writes.length, 0);
    });
});

test('tool approval config route writes normalized canonical config through a regular temp file', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-tool-approval-config-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    await withMainConfigApp(projectRoot, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/tool-approval-config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: {
                    enabled: true,
                    approveAll: false,
                    timeout: 9.7,
                    toolList: [' SciCalculator '],
                    debugMode: true
                }
            })
        });

        assert.equal(response.status, 200);
        const configPath = path.join(projectRoot, 'toolApprovalConfig.json');
        assert.equal(fs.lstatSync(configPath).isFile(), true);
        assert.deepEqual(JSON.parse(await fsp.readFile(configPath, 'utf8')), {
            enabled: true,
            timeoutMinutes: 9,
            approveAll: false,
            approvalList: ['SciCalculator'],
            debugMode: true,
            fuzzyToolMatching: false
        });
        const tempFiles = (await fsp.readdir(projectRoot))
            .filter((entry) => entry.startsWith('.toolApprovalConfig.json.'));
        assert.deepEqual(tempFiles, []);
    });
});

test('tool approval config route rejects existing toolApprovalConfig.json symlink without writing target', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-tool-approval-config-symlink-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    const configPath = path.join(projectRoot, 'toolApprovalConfig.json');
    const outsideConfigPath = path.join(projectRoot, 'outside-tool-approval.json');
    await fsp.writeFile(outsideConfigPath, '{"enabled":false}\n', 'utf8');
    try {
        fs.symlinkSync(outsideConfigPath, configPath);
    } catch (error) {
        try {
            const outsideConfigDir = path.join(projectRoot, 'outside-tool-approval-dir');
            await fsp.mkdir(outsideConfigDir);
            await fsp.writeFile(path.join(outsideConfigDir, 'marker.json'), '{"enabled":false}\n', 'utf8');
            fs.symlinkSync(outsideConfigDir, configPath, process.platform === 'win32' ? 'junction' : 'dir');
        } catch (fallbackError) {
            t.skip(`symlink unavailable in this environment: ${error.message}; fallback failed: ${fallbackError.message}`);
            return;
        }
    }

    await withMainConfigApp(projectRoot, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/tool-approval-config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: {
                    enabled: true,
                    approvalList: ['SciCalculator']
                }
            })
        });
        const body = await response.json();

        assert.equal(response.status, 409);
        assert.equal(body.code, 'tool_approval_config_symlink_unsupported');
        assert.equal(await fsp.readFile(outsideConfigPath, 'utf8'), '{"enabled":false}\n');
        const outsideMarkerPath = path.join(projectRoot, 'outside-tool-approval-dir', 'marker.json');
        if (fs.existsSync(outsideMarkerPath)) {
            assert.equal(await fsp.readFile(outsideMarkerPath, 'utf8'), '{"enabled":false}\n');
        }
        assert.equal(fs.lstatSync(configPath).isSymbolicLink(), true);
    });
});

test('tool approval config route rejects existing toolApprovalConfig.json directory', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-tool-approval-config-dir-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    const configPath = path.join(projectRoot, 'toolApprovalConfig.json');
    await fsp.mkdir(configPath);

    await withMainConfigApp(projectRoot, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/tool-approval-config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: {
                    enabled: true,
                    approvalList: ['SciCalculator']
                }
            })
        });
        const body = await response.json();

        assert.equal(response.status, 409);
        assert.equal(body.code, 'tool_approval_config_non_regular_unsupported');
        assert.equal(fs.lstatSync(configPath).isDirectory(), true);
    });
});

test('tool approval config route rejects typo-only payloads instead of saving defaults', async () => {
    const writes = [];

    await withConfigApp({
        async readFile() {
            throw Object.assign(new Error('not needed'), { code: 'ENOENT' });
        },
        async writeFile(...args) {
            writes.push(args);
        }
    }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/tool-approval-config`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                config: {
                    enbaled: true
                }
            })
        });

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.error, 'Invalid tool approval configuration.');
        assert.deepEqual(body.details, [
            'unknown config keys: enbaled',
            'config must include at least one supported field'
        ]);
        assert.equal(writes.length, 0);
    });
});

test('main config route writes config.env through regular temp file and reloads plugins', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-main-config-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    await withMainConfigApp(projectRoot, async (baseUrl, pluginManager) => {
        const response = await fetch(`${baseUrl}/config/main`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'SAFE_VALUE=1\n' })
        });

        assert.equal(response.status, 200);
        assert.equal(await fsp.readFile(path.join(projectRoot, 'config.env'), 'utf8'), 'SAFE_VALUE=1\n');
        assert.equal(fs.lstatSync(path.join(projectRoot, 'config.env')).isFile(), true);
        assert.equal(pluginManager.loadCount, 1);
    });
});

test('main config route rejects existing config.env symlink without writing target', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-main-config-symlink-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    const configPath = path.join(projectRoot, 'config.env');
    const outsideConfigPath = path.join(projectRoot, 'outside-config.env');
    await fsp.writeFile(outsideConfigPath, 'OUTSIDE=old\n', 'utf8');
    try {
        fs.symlinkSync(outsideConfigPath, configPath);
    } catch (error) {
        try {
            const outsideConfigDir = path.join(projectRoot, 'outside-config-dir');
            await fsp.mkdir(outsideConfigDir);
            await fsp.writeFile(path.join(outsideConfigDir, 'marker.env'), 'OUTSIDE=old\n', 'utf8');
            fs.symlinkSync(outsideConfigDir, configPath, process.platform === 'win32' ? 'junction' : 'dir');
        } catch (fallbackError) {
            t.skip(`symlink unavailable in this environment: ${error.message}; fallback failed: ${fallbackError.message}`);
            return;
        }
    }

    await withMainConfigApp(projectRoot, async (baseUrl, pluginManager) => {
        const response = await fetch(`${baseUrl}/config/main`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'OUTSIDE=new\n' })
        });
        const body = await response.json();

        assert.equal(response.status, 409);
        assert.equal(body.code, 'main_config_env_symlink_unsupported');
        assert.equal(await fsp.readFile(outsideConfigPath, 'utf8'), 'OUTSIDE=old\n');
        const outsideMarkerPath = path.join(projectRoot, 'outside-config-dir', 'marker.env');
        if (fs.existsSync(outsideMarkerPath)) {
            assert.equal(await fsp.readFile(outsideMarkerPath, 'utf8'), 'OUTSIDE=old\n');
        }
        assert.equal(fs.lstatSync(configPath).isSymbolicLink(), true);
        assert.equal(pluginManager.loadCount, 0);
    });
});

test('main config route rejects existing config.env directory', async (t) => {
    const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcpt-main-config-dir-'));
    t.after(async () => {
        await fsp.rm(projectRoot, { recursive: true, force: true });
    });

    const configPath = path.join(projectRoot, 'config.env');
    await fsp.mkdir(configPath);

    await withMainConfigApp(projectRoot, async (baseUrl, pluginManager) => {
        const response = await fetch(`${baseUrl}/config/main`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'SAFE_VALUE=1\n' })
        });
        const body = await response.json();

        assert.equal(response.status, 409);
        assert.equal(body.code, 'main_config_env_non_regular_unsupported');
        assert.equal(fs.lstatSync(configPath).isDirectory(), true);
        assert.equal(pluginManager.loadCount, 0);
    });
});
