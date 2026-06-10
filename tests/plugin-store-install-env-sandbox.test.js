const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function loadWithRouteDependencyStubs(request, parent, isMain) {
    if (request === 'express') {
        return { Router: () => ({ get() {}, post() {}, delete() {} }) };
    }
    if (request === 'multer') {
        const multer = () => ({ array: () => [] });
        multer.diskStorage = () => ({});
        return multer;
    }
    if (request === 'extract-zip') {
        return async () => {};
    }
    if (request === 'tar') {
        return { x: async () => {} };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let pluginStoreRouter;
try {
    pluginStoreRouter = require('../routes/admin/pluginStore');
} finally {
    Module._load = originalLoad;
}

const {
    buildPluginInstallEnv,
    runNpmInstall,
    scrubPluginStoreLog,
} = pluginStoreRouter._test;

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
        npm_config_registry: 'https://registry.example.test/',
        CUSTOM_BUILD_FLAG: 'enabled',
        ...overrides,
    };
}

function makeTask() {
    return {
        logs: [],
        bus: new EventEmitter(),
    };
}

test('buildPluginInstallEnv preserves safe operational keys only', () => {
    const env = buildPluginInstallEnv(makeBaseEnv());

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

    assert.equal(Object.prototype.hasOwnProperty.call(env, 'CUSTOM_BUILD_FLAG'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'npm_config_registry'), false);
});

test('buildPluginInstallEnv removes secret-like keys', () => {
    const env = buildPluginInstallEnv(makeBaseEnv());

    for (const key of [
        'AdminPassword',
        'Key',
        'OPENAI_API_KEY',
        'GITHUB_TOKEN',
        'GH_TOKEN',
        'COOKIE',
        'SESSION_TOKEN',
        'PRIVATE_KEY',
    ]) {
        assert.equal(Object.prototype.hasOwnProperty.call(env, key), false, `${key} should be removed`);
    }
});

test('buildPluginInstallEnv optional allowlist is additive and deny patterns still win', () => {
    const baseEnv = makeBaseEnv({
        VCP_PLUGIN_STORE_INSTALL_ENV_ALLOWLIST: 'CUSTOM_BUILD_FLAG,OPENAI_API_KEY,CUSTOM_*',
    });
    const env = buildPluginInstallEnv(baseEnv);

    assert.equal(env.CUSTOM_BUILD_FLAG, 'enabled');
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'OPENAI_API_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(env, 'CUSTOM_*'), false);
});

test('runNpmInstall passes sanitized env to spawned npm process', async () => {
    let spawnCall = null;
    const fakeSpawn = (command, args, options) => {
        spawnCall = { command, args, options };
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        process.nextTick(() => {
            child.stdout.emit('data', 'Bearer npm-output-token\n');
            child.stderr.emit('data', 'api_key=npm-output-secret\n');
            child.emit('close', 0);
        });
        return child;
    };

    const task = makeTask();
    const result = await runNpmInstall('C:\\repo\\Plugin\\ExternalCandidate', task, null, {
        spawn: fakeSpawn,
        baseEnv: makeBaseEnv({
            VCP_PLUGIN_STORE_INSTALL_ENV_ALLOWLIST: 'CUSTOM_BUILD_FLAG,OPENAI_API_KEY',
        }),
    });

    assert.equal(result.ok, true);
    assert.ok(spawnCall);
    assert.match(spawnCall.command, /^npm(\.cmd)?$/);
    assert.deepEqual(spawnCall.args, ['install', '--omit=dev', '--no-audit', '--no-fund']);
    assert.equal(spawnCall.options.env.PATH, '/usr/bin');
    assert.equal(spawnCall.options.env.CUSTOM_BUILD_FLAG, 'enabled');
    assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'AdminPassword'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'OPENAI_API_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'GITHUB_TOKEN'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(spawnCall.options.env, 'npm_config_registry'), false);

    const serializedLogs = task.logs.join('\n');
    assert.equal(serializedLogs.includes('npm-output-token'), false);
    assert.equal(serializedLogs.includes('npm-output-secret'), false);
    assert.match(serializedLogs, /\[redacted\]/);
});

test('scrubPluginStoreLog redacts token-like output, credential URLs, and absolute paths', () => {
    const input = [
        'Authorization: Bearer abc.def.ghi',
        'api_key=plain-secret',
        'download https://user:pass@example.test/plugin.zip',
        'C:\\Users\\operator\\secret\\file.txt',
        '/home/operator/secret/file.txt',
    ].join('\n');

    const output = scrubPluginStoreLog(input);

    assert.equal(output.includes('abc.def.ghi'), false);
    assert.equal(output.includes('plain-secret'), false);
    assert.equal(output.includes('user:pass'), false);
    assert.equal(output.includes('C:\\Users\\operator'), false);
    assert.equal(output.includes('/home/operator'), false);
    assert.match(output, /\[redacted\]|\[credentials\]|\[path\]/);
});
