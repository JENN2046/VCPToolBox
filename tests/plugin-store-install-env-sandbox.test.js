const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
    ENABLE_DIRECT_DOWNLOAD_URL_INSTALL_ENV,
    NPM_LIFECYCLE_SCRIPT_CONFIRMATION,
    buildPluginInstallEnv,
    cleanupUploadedFiles,
    resolveDirectDownloadUrlInstallPolicy,
    resolveLifecycleScriptApproval,
    resolveSourcePluginInstallTarget,
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

function makeTempDir(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-plugin-store-install-'));
    t.after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}

function createSuccessfulFakeSpawn(capture) {
    return (command, args, options) => {
        capture.call = { command, args, options };
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

test('resolveLifecycleScriptApproval requires second confirmation for lifecycle scripts', () => {
    assert.deepEqual(
        resolveLifecycleScriptApproval({}),
        { ok: true, allowLifecycleScripts: false }
    );
    assert.deepEqual(
        resolveLifecycleScriptApproval({ allowLifecycleScripts: 'false' }),
        { ok: true, allowLifecycleScripts: false }
    );

    const denied = resolveLifecycleScriptApproval({ allowLifecycleScripts: true });
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 400);
    assert.equal(denied.code, 'plugin_store_lifecycle_scripts_confirmation_required');
    assert.match(denied.error, /ALLOW_NPM_LIFECYCLE_SCRIPTS/);

    assert.deepEqual(
        resolveLifecycleScriptApproval({
            allowLifecycleScripts: true,
            lifecycleScriptsConfirmation: NPM_LIFECYCLE_SCRIPT_CONFIRMATION,
        }),
        { ok: true, allowLifecycleScripts: true }
    );
    assert.deepEqual(
        resolveLifecycleScriptApproval({
            allowLifecycleScripts: 'true',
            confirmLifecycleScripts: NPM_LIFECYCLE_SCRIPT_CONFIRMATION,
        }),
        { ok: true, allowLifecycleScripts: true }
    );
});

test('cleanupUploadedFiles removes multipart uploads from rejected lifecycle approvals', async (t) => {
    const root = makeTempDir(t);
    const uploadedFile = path.join(root, 'uploaded-plugin.zip');
    const secondFile = path.join(root, 'uploaded-folder-file.js');
    fs.writeFileSync(uploadedFile, 'archive-bytes');
    fs.writeFileSync(secondFile, 'file-bytes');

    await cleanupUploadedFiles([
        { path: uploadedFile },
        { path: secondFile },
        { path: path.join(root, 'already-gone.zip') },
        {},
        null,
    ]);

    assert.equal(fs.existsSync(uploadedFile), false);
    assert.equal(fs.existsSync(secondFile), false);
});

test('resolveDirectDownloadUrlInstallPolicy disables direct downloadUrl installs by default', () => {
    for (const body of [
        { sourceId: 'official', pluginName: 'Demo', downloadUrl: 'https://example.test/demo.zip' },
        { githubUrl: 'https://github.com/acme/demo', downloadUrl: 'https://example.test/demo.zip' },
    ]) {
        const mixed = resolveDirectDownloadUrlInstallPolicy(body, {});
        assert.equal(mixed.ok, false);
        assert.equal(mixed.status, 400);
        assert.equal(mixed.code, 'plugin_store_download_url_mixed_target_unsupported');
    }

    const denied = resolveDirectDownloadUrlInstallPolicy({ downloadUrl: 'https://example.test/demo.zip' }, {});
    assert.equal(denied.ok, false);
    assert.equal(denied.status, 403);
    assert.equal(denied.code, 'plugin_store_direct_download_url_disabled');
    assert.match(denied.error, new RegExp(ENABLE_DIRECT_DOWNLOAD_URL_INSTALL_ENV));

    assert.deepEqual(
        resolveDirectDownloadUrlInstallPolicy(
            { downloadUrl: 'https://example.test/demo.zip' },
            { [ENABLE_DIRECT_DOWNLOAD_URL_INSTALL_ENV]: 'true' }
        ),
        { ok: true }
    );
    assert.equal(
        resolveDirectDownloadUrlInstallPolicy(
            { downloadUrl: 'https://example.test/demo.zip' },
            { [ENABLE_DIRECT_DOWNLOAD_URL_INSTALL_ENV]: '1' }
        ).ok,
        false
    );
});

test('resolveSourcePluginInstallTarget prefers registry download archives over GitHub subpaths', () => {
    const github = {
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        subpath: 'plugins/demo',
    };

    assert.deepEqual(
        resolveSourcePluginInstallTarget({
            name: 'DemoPlugin',
            downloadUrl: 'https://registry.example.test/demo.zip',
            github,
        }),
        {
            kind: 'download',
            downloadUrl: 'https://registry.example.test/demo.zip',
        }
    );

    assert.deepEqual(
        resolveSourcePluginInstallTarget({
            name: 'DemoPlugin',
            github,
        }),
        { kind: 'github', github }
    );

    assert.deepEqual(
        resolveSourcePluginInstallTarget({ name: 'BrokenPlugin' }),
        { kind: 'missing' }
    );
});

test('runNpmInstall disables lifecycle scripts by default and passes sanitized env', async (t) => {
    const cwd = makeTempDir(t);
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
        scripts: {
            preinstall: 'node steal-secrets.js',
            postinstall: 'node persist.js',
            test: 'node harmless-test.js'
        }
    }, null, 2));
    const capture = {};

    const task = makeTask();
    const rootInfo = {
        source: 'external',
        rootId: 'external:test',
        rootPath: path.dirname(cwd),
    };
    const result = await runNpmInstall(cwd, task, rootInfo, {
        spawn: createSuccessfulFakeSpawn(capture),
        baseEnv: makeBaseEnv({
            VCP_PLUGIN_STORE_INSTALL_ENV_ALLOWLIST: 'CUSTOM_BUILD_FLAG,OPENAI_API_KEY',
        }),
    });

    assert.equal(result.ok, true);
    assert.ok(capture.call);
    assert.match(capture.call.command, /^npm(\.cmd)?$/);
    assert.deepEqual(capture.call.args, ['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund']);
    assert.equal(capture.call.options.env.PATH, '/usr/bin');
    assert.equal(capture.call.options.env.CUSTOM_BUILD_FLAG, 'enabled');
    assert.equal(Object.prototype.hasOwnProperty.call(capture.call.options.env, 'AdminPassword'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(capture.call.options.env, 'OPENAI_API_KEY'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(capture.call.options.env, 'GITHUB_TOKEN'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(capture.call.options.env, 'npm_config_registry'), false);

    const serializedLogs = task.logs.join('\n');
    assert.equal(serializedLogs.includes('npm-output-token'), false);
    assert.equal(serializedLogs.includes('npm-output-secret'), false);
    assert.match(serializedLogs, /install target=\[external\]\//);
    assert.match(serializedLogs, /root=external:external:test/);
    assert.match(serializedLogs, /package\.json sha256=[a-f0-9]{64}/);
    assert.match(serializedLogs, /preinstall="node steal-secrets\.js"/);
    assert.match(serializedLogs, /postinstall="node persist\.js"/);
    assert.doesNotMatch(serializedLogs, /harmless-test/);
    assert.match(serializedLogs, /--ignore-scripts/);
    assert.match(serializedLogs, /lifecycle scripts 默认禁用/);
    assert.match(serializedLogs, /\[redacted\]/);
});

test('runNpmInstall only runs lifecycle scripts after explicit approval', async (t) => {
    const cwd = makeTempDir(t);
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({
        scripts: {
            prepare: 'node prepare.js'
        }
    }, null, 2));
    const capture = {};

    const task = makeTask();
    const result = await runNpmInstall(cwd, task, null, {
        spawn: createSuccessfulFakeSpawn(capture),
        allowLifecycleScripts: true,
        baseEnv: makeBaseEnv(),
    });

    assert.equal(result.ok, true);
    assert.ok(capture.call);
    assert.deepEqual(capture.call.args, ['install', '--omit=dev', '--no-audit', '--no-fund']);

    const serializedLogs = task.logs.join('\n');
    assert.match(serializedLogs, /prepare="node prepare\.js"/);
    assert.match(serializedLogs, /lifecycle scripts 已被显式允许执行/);
    assert.doesNotMatch(serializedLogs, /--ignore-scripts/);
});

test('scrubPluginStoreLog redacts token-like output, credential URLs, and absolute paths', () => {
    const input = [
        'Authorization: Bearer abc.def.ghi',
        'api_key=plain-secret',
        'download https://user:pass@example.test/plugin.zip',
        'download https://user:pass@example.test/private/plugin.zip?access_token=abc123&ok=1',
        'C:\\Users\\operator\\secret\\file.txt',
        '/home/operator/secret/file.txt',
    ].join('\n');

    const output = scrubPluginStoreLog(input);

    assert.equal(output.includes('abc.def.ghi'), false);
    assert.equal(output.includes('plain-secret'), false);
    assert.equal(output.includes('user:pass'), false);
    assert.equal(output.includes('abc123'), false);
    assert.equal(output.includes('C:\\Users\\operator'), false);
    assert.equal(output.includes('/home/operator'), false);
    assert.match(output, /\[redacted\]|\[credentials\]|\[path\]/);
});
