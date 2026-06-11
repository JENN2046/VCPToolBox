const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const pluginManager = require('../Plugin.js');
const {
    buildExternalPluginRuntimeEnv,
    isPluginRuntimeEnvKeyDenied
} = require('../modules/pluginRuntimeEnvSandbox');

after(() => {
    if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
        pluginManager.toolApprovalManager.shutdown();
    }
});

function makeBaseEnv(overrides = {}) {
    return {
        PATH: '/usr/bin',
        Path: 'C:\\Windows\\System32',
        HOME: '/home/operator',
        USERPROFILE: 'C:\\Users\\operator',
        TEMP: 'C:\\Temp',
        TMP: 'C:\\Tmp',
        TMPDIR: '/tmp',
        SystemRoot: 'C:\\Windows',
        windir: 'C:\\Windows',
        ComSpec: 'C:\\Windows\\System32\\cmd.exe',
        NO_COLOR: '1',
        CI: 'true',
        AdminPassword: 'admin-secret',
        Key: 'generic-key',
        OPENAI_API_KEY: 'openai-secret',
        GITHUB_TOKEN: 'github-token',
        GH_TOKEN: 'gh-token',
        COOKIE: 'cookie-secret',
        SESSION_TOKEN: 'session-secret',
        PRIVATE_KEY: 'private-key',
        CUSTOM_BASE_FLAG: 'drop-me',
        ...overrides
    };
}

function makeExternalPlugin(name, overrides = {}) {
    return {
        name,
        displayName: name,
        pluginSource: 'external',
        pluginRootId: 'external:test',
        pluginRootDisplayPath: '[external]/runtime-env',
        pluginType: 'synchronous',
        communication: { protocol: 'stdio', timeout: 1000 },
        entryPoint: { command: 'node fixture.js' },
        basePath: __dirname,
        configSchema: {
            SAFE_SETTING: 'string',
            SECRET_TOKEN: 'string',
            CALLBACK_BASE_URL: 'string'
        },
        pluginSpecificEnvConfig: {
            SAFE_SETTING: 'enabled',
            SECRET_TOKEN: 'plugin-secret',
            CALLBACK_BASE_URL: 'https://callback.example.test'
        },
        ...overrides
    };
}

function makeCorePlugin(name, overrides = {}) {
    return {
        ...makeExternalPlugin(name, overrides),
        pluginSource: 'legacy',
        pluginRootId: 'core:legacy',
        pluginRootDisplayPath: '[core]/Plugin'
    };
}

function makeFakeChild(stdoutPayload = '') {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
        write() {},
        end() {}
    };
    child.kill = () => {};
    child.stdout.setEncoding = () => {};
    child.stderr.setEncoding = () => {};
    process.nextTick(() => {
        if (stdoutPayload) child.stdout.emit('data', stdoutPayload);
        child.emit('exit', 0, null);
    });
    return child;
}

async function withPluginManagerState(run) {
    const originalPlugins = pluginManager.plugins;
    const originalSpawn = pluginManager._spawnPluginProcess;
    const originalGetDecryptedAuthCode = pluginManager._getDecryptedAuthCode;
    const originalProjectBasePath = pluginManager.projectBasePath;
    const originalDebugMode = pluginManager.debugMode;
    const originalEnv = {
        PATH: process.env.PATH,
        CUSTOM_BASE_FLAG: process.env.CUSTOM_BASE_FLAG,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        Key: process.env.Key,
        PORT: process.env.PORT
    };

    pluginManager.plugins = new Map();
    pluginManager.projectBasePath = 'A:\\ProjectBase';
    process.env.CUSTOM_BASE_FLAG = 'drop-me';
    process.env.OPENAI_API_KEY = 'openai-secret';
    process.env.GITHUB_TOKEN = 'github-secret';
    process.env.Key = 'global-key';
    process.env.PORT = '5890';

    try {
        await run();
    } finally {
        pluginManager.plugins = originalPlugins;
        pluginManager._spawnPluginProcess = originalSpawn;
        pluginManager._getDecryptedAuthCode = originalGetDecryptedAuthCode;
        pluginManager.projectBasePath = originalProjectBasePath;
        pluginManager.debugMode = originalDebugMode;
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('runtime env sandbox preserves operational keys and removes base secrets', () => {
    const env = buildExternalPluginRuntimeEnv(makeBaseEnv(), {}, {});

    assert.equal(env.PATH, '/usr/bin');
    assert.equal(env.Path, 'C:\\Windows\\System32');
    assert.equal(env.HOME, '/home/operator');
    assert.equal(env.USERPROFILE, 'C:\\Users\\operator');
    assert.equal(env.TEMP, 'C:\\Temp');
    assert.equal(env.TMP, 'C:\\Tmp');
    assert.equal(env.TMPDIR, '/tmp');
    assert.equal(env.SystemRoot, 'C:\\Windows');
    assert.equal(env.windir, 'C:\\Windows');
    assert.equal(env.ComSpec, 'C:\\Windows\\System32\\cmd.exe');
    assert.equal(env.NO_COLOR, '1');
    assert.equal(env.CI, 'true');

    assert.equal(Object.prototype.hasOwnProperty.call(env, 'CUSTOM_BASE_FLAG'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'OPENAI_API_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'GITHUB_TOKEN'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'Key'), false);
});

test('runtime env sandbox filters plugin config and runtime injected secrets', () => {
    const env = buildExternalPluginRuntimeEnv(
        makeBaseEnv(),
        {
            SAFE_SETTING: 'enabled',
            SECRET_TOKEN: 'plugin-secret',
            API_KEY: 'plugin-api-key'
        },
        {
            PROJECT_BASE_PATH: 'A:\\ProjectBase',
            SERVER_PORT: '5890',
            VCP_REQUEST_SOURCE: 'node-test',
            PYTHONIOENCODING: 'utf-8',
            DECRYPTED_AUTH_CODE: 'auth-secret',
            IMAGESERVER_IMAGE_KEY: 'image-secret',
            SSH_MANAGER_TOKEN: 'ssh-secret'
        }
    );

    assert.equal(env.SAFE_SETTING, 'enabled');
    assert.equal(env.PROJECT_BASE_PATH, 'A:\\ProjectBase');
    assert.equal(env.SERVER_PORT, '5890');
    assert.equal(env.VCP_REQUEST_SOURCE, 'node-test');
    assert.equal(env.PYTHONIOENCODING, 'utf-8');
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'SECRET_TOKEN'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'API_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'DECRYPTED_AUTH_CODE'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'IMAGESERVER_IMAGE_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'SSH_MANAGER_TOKEN'), false);
});

test('runtime env deny matcher covers secret-like names', () => {
    for (const key of ['AdminPassword', 'OPENAI_API_KEY', 'SESSION_TOKEN', 'PRIVATE_KEY', 'DECRYPTED_AUTH_CODE']) {
        assert.equal(isPluginRuntimeEnvKeyDenied(key), true, `${key} should be denied`);
    }
    assert.equal(isPluginRuntimeEnvKeyDenied('SAFE_SETTING'), false);
});

test('external stdio plugin spawn receives sanitized env', async () => {
    await withPluginManagerState(async () => {
        const pluginName = 'ExternalRuntimeEnvFixture';
        const plugin = makeExternalPlugin(pluginName);
        let spawnCall = null;

        pluginManager.plugins.set(pluginName, plugin);
        pluginManager._spawnPluginProcess = (command, args, options) => {
            spawnCall = { command, args, options };
            return makeFakeChild('{"status":"success","result":"ok"}\n');
        };

        const result = await pluginManager.executePlugin(pluginName, '{}', '127.0.0.1', {
            requestSource: 'node-test',
            agentAlias: 'agent-a'
        });

        assert.equal(result.status, 'success');
        assert.ok(spawnCall);
        assert.equal(spawnCall.options.env.SAFE_SETTING, 'enabled');
        assert.equal(spawnCall.options.env.CALLBACK_BASE_URL, 'https://callback.example.test');
        assert.equal(spawnCall.options.env.PROJECT_BASE_PATH, 'A:\\ProjectBase');
        assert.equal(spawnCall.options.env.SERVER_PORT, '5890');
        assert.equal(spawnCall.options.env.VCP_REQUEST_IP, '127.0.0.1');
        assert.equal(spawnCall.options.env.VCP_REQUEST_SOURCE, 'node-test');
        assert.equal(spawnCall.options.env.VCP_AGENT_ALIAS, 'agent-a');
        assert.equal(spawnCall.options.env.PYTHONIOENCODING, 'utf-8');
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'OPENAI_API_KEY'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'GITHUB_TOKEN'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'Key'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'SECRET_TOKEN'), false);
    });
});

test('external static plugin spawn receives sanitized env', async () => {
    await withPluginManagerState(async () => {
        const plugin = makeExternalPlugin('ExternalStaticRuntimeEnvFixture', {
            pluginType: 'static',
            entryPoint: { command: 'node static-fixture.js' }
        });
        let spawnCall = null;

        pluginManager._spawnPluginProcess = (command, args, options) => {
            spawnCall = { command, args, options };
            return makeFakeChild('static output');
        };

        const output = await pluginManager._executeStaticPluginCommand(plugin);

        assert.equal(output, 'static output');
        assert.ok(spawnCall);
        assert.equal(spawnCall.options.env.SAFE_SETTING, 'enabled');
        assert.equal(spawnCall.options.env.PROJECT_BASE_PATH, 'A:\\ProjectBase');
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'OPENAI_API_KEY'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'SECRET_TOKEN'), false);
    });
});

test('core stdio plugin keeps legacy full process env behavior', async () => {
    await withPluginManagerState(async () => {
        const pluginName = 'CoreRuntimeEnvFixture';
        const plugin = makeCorePlugin(pluginName);
        let spawnCall = null;

        pluginManager.plugins.set(pluginName, plugin);
        pluginManager._spawnPluginProcess = (command, args, options) => {
            spawnCall = { command, args, options };
            return makeFakeChild('{"status":"success","result":"ok"}\n');
        };

        const result = await pluginManager.executePlugin(pluginName, '{}');

        assert.equal(result.status, 'success');
        assert.ok(spawnCall);
        assert.equal(spawnCall.options.env.OPENAI_API_KEY, 'openai-secret');
        assert.equal(spawnCall.options.env.GITHUB_TOKEN, 'github-secret');
        assert.equal(spawnCall.options.env.Key, 'global-key');
        assert.equal(spawnCall.options.env.SECRET_TOKEN, 'plugin-secret');
    });
});

test('core async plugin debug log never prints runtime env secret values', async () => {
    await withPluginManagerState(async () => {
        const pluginName = 'CoreAsyncRuntimeEnvFixture';
        const plugin = makeCorePlugin(pluginName, { pluginType: 'asynchronous' });
        const logs = [];
        const originalLog = console.log;

        pluginManager.debugMode = true;
        pluginManager.plugins.set(pluginName, plugin);
        pluginManager._spawnPluginProcess = () => makeFakeChild('{"status":"success","result":"ok"}\n');
        console.log = (...args) => logs.push(args.map(arg => String(arg)).join(' '));

        try {
            const result = await pluginManager.executePlugin(pluginName, '{}');
            assert.equal(result.status, 'success');
        } finally {
            console.log = originalLog;
        }

        const logText = logs.join('\n');
        assert.match(logText, /Core async plugin CoreAsyncRuntimeEnvFixture runtime env keys:/);
        assert.doesNotMatch(logText, /Final ENV/);
        for (const forbidden of [
            'openai-secret',
            'github-secret',
            'global-key',
            'plugin-secret',
            'OPENAI_API_KEY',
            'GITHUB_TOKEN',
            'SECRET_TOKEN'
        ]) {
            assert.equal(logText.includes(forbidden), false, `${forbidden} should not be logged`);
        }
        assert.match(logText, /redacted \d+ sensitive keys/);
    });
});

test('external admin-required stdio plugin is denied before auth env injection', async () => {
    await withPluginManagerState(async () => {
        const pluginName = 'ExternalAdminRuntimeEnvFixture';
        const plugin = makeExternalPlugin(pluginName, { requiresAdmin: true });
        let authRead = false;

        pluginManager.plugins.set(pluginName, plugin);
        pluginManager._getDecryptedAuthCode = async () => {
            authRead = true;
            return 'auth-secret';
        };

        await assert.rejects(
            () => pluginManager.executePlugin(pluginName, '{}'),
            /cannot receive admin authentication/
        );
        assert.equal(authRead, false);
    });
});
