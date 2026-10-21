'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { spawn: realSpawn } = require('node:child_process');
const { createSanitizedUserCommandEnv } = require('../modules/sensitiveEnv');

const pluginDir = path.join(__dirname, '../Plugin/LinuxShellExecutor');
const filename = path.join(pluginDir, 'LinuxShellExecutor.js');
const source = fs.readFileSync(filename, 'utf8');
const quiet = { log() {}, info() {}, warn() {}, error() {} };

// Evaluate the whole plugin with synthetic configuration, without loading any
// config.env, hosts file, logger, SSH, monitor, service or persistent state.
// runToolCall accepts an executor, so its ordinary validation path needs no init.
function loadPlugin({ lib64 = true, spawn = () => { throw new Error('Unexpected spawn'); } } = {}) {
    const env = { PATH: '/usr/bin:/bin', LANG: 'C', SANDBOX_BACKEND: 'bubblewrap' };
    const accessCalls = [];
    const fsStub = {
        readFileSync() { throw new Error('No runtime files in tests'); },
        promises: {
            async access(target) {
                accessCalls.push(target);
                assert.equal(target, '/lib64');
                if (!lib64) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
            }
        }
    };
    const context = {
        module: { exports: {} }, __dirname: pluginDir, Buffer, console: quiet,
        process: { env, platform: process.platform, stderr: { write() {} }, kill: process.kill.bind(process) },
        setTimeout, clearTimeout,
        require(name) {
            if (['path', 'crypto', 'util'].includes(name)) return require(name);
            if (name === 'fs') return fsStub;
            if (name === 'child_process') return { spawn };
            if (name === 'dotenv') return { config() {} };
            if (name === '../../modules/sensitiveEnv') {
                return { createSanitizedUserCommandEnv: () => createSanitizedUserCommandEnv(env) };
            }
            if (name === '../../modules/logger') return {};
            if (name === '../../modules/SSHManager') return { getSSHManager: () => null };
            if (name === './hosts.json') {
                return { defaultHost: 'local', hosts: {
                    local: { type: 'local', enabled: true, securityLevel: 'standard' }
                } };
            }
            if (['./whitelist.json', './graylist.json', './securityLevels.json', './presets.json'].includes(name)) {
                return JSON.parse(fs.readFileSync(path.join(pluginDir, name), 'utf8'));
            }
            throw new Error(`Unexpected dependency: ${name}`);
        }
    };
    vm.runInNewContext(source + '\nmodule.exports.testing = { SandboxManager, LinuxShellExecutor };', context, { filename });
    return { api: context.module.exports, accessCalls };
}

function expectedArgs(command, lib64) {
    return [
        '--ro-bind', '/usr', '/usr', '--ro-bind', '/bin', '/bin',
        ...(lib64 ? ['--ro-bind', '/lib64', '/lib64'] : []),
        '--ro-bind', '/lib', '/lib',
        '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--tmpfs', '/run',
        '--unshare-all', '--die-with-parent', '--new-session', '/bin/sh', '-c', command
    ];
}

for (const lib64 of [true, false]) {
    test(`bubblewrap arguments, resource wrapper and options (/lib64 ${lib64 ? 'present' : 'absent'})`, async () => {
        const { api, accessCalls } = loadPlugin({ lib64 });
        const manager = new api.testing.SandboxManager();
        const signal = new AbortController().signal;
        const calls = [];
        manager.spawnWithTimeout = async (...args) => { calls.push(args); return { code: 0 }; };
        await manager.execute('uname -a', { timeout: 1234, signal });
        assert.deepEqual(accessCalls, ['/lib64']);
        assert.equal(calls.length, 1);
        const [binary, args, timeout, passedSignal] = calls[0];
        assert.equal(binary, 'bwrap');
        assert.deepEqual(Array.from(args), expectedArgs(manager.rlimitManager.getUlimitPrefix() + 'uname -a', lib64));
        assert.equal(timeout, 1234);
        assert.equal(passedSignal, signal);
        assert.equal(args.filter(arg => arg === '/lib').length, 2); // source + one destination
        assert.ok(!args.includes('--symlink'));
        if (lib64) assert.ok(args.indexOf('/lib64') < args.indexOf('/bin/sh'));
        // Freeze the existing wrapper, including its existing zero-valued limits.
        assert.equal(manager.rlimitManager.getUlimitPrefix(), 'ulimit -t 30 -f 20480 -n 0 -v 0 2>/dev/null; ');
        Object.assign(manager.rlimitManager.limits, { cpu: 7, fsize: 4096, nofile: 64, as: 67108864 });
        assert.equal(manager.rlimitManager.getUlimitPrefix(), 'ulimit -t 7 -f 8 -n 64 -v 65536 -n 64 -v 65536 2>/dev/null; ');
        await manager.execute('pwd');
        assert.equal(calls[1][2], 30000);
        assert.equal(calls[1][1].at(-1), manager.rlimitManager.getUlimitPrefix() + 'pwd');
    });
}

function fakeChild() {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kills = [];
    child.kill = signal => child.kills.push(signal);
    return child;
}

test('initialization failure rejects through runToolCall with one bwrap spawn and no direct fallback', async () => {
    const calls = [];
    const signal = new AbortController().signal;
    let passedOptions;
    const { api } = loadPlugin({ spawn: (binary, args) => {
        calls.push([binary, Array.from(args)]);
        const child = fakeChild();
        queueMicrotask(() => {
            child.stderr.write('bwrap: synthetic initialization failure');
            child.emit('close', 1);
        });
        return child;
    } });
    const executor = new api.testing.LinuxShellExecutor();
    const spawnWithTimeout = executor.sandboxManager.spawnWithTimeout.bind(executor.sandboxManager);
    executor.sandboxManager.spawnWithTimeout = (binary, args, timeout, passedSignal) => {
        passedOptions = { timeout, signal: passedSignal };
        return spawnWithTimeout(binary, args, timeout, passedSignal);
    };
    executor.sandboxManager.executeDirectly = () => assert.fail('Must not downgrade to direct execution');
    await assert.rejects(api.runToolCall({ command: 'pwd', hostId: 'local', timeout: 1234 }, {
        executor, context: { signal }
    }), /synthetic initialization failure/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'bwrap');
    assert.deepEqual(passedOptions, { timeout: 1234, signal });
});

test('spawn startup error rejects without direct fallback', async () => {
    const calls = [];
    const { api } = loadPlugin({ spawn: binary => {
        calls.push(binary);
        const child = fakeChild();
        queueMicrotask(() => child.emit('error', new Error('synthetic ENOENT')));
        return child;
    } });
    const manager = new api.testing.SandboxManager();
    manager.executeDirectly = () => assert.fail('Must not downgrade to direct execution');
    await assert.rejects(manager.execute('pwd', { timeout: 1000 }), /synthetic ENOENT/);
    assert.deepEqual(calls, ['bwrap']);
});

for (const mode of ['timeout', 'abort', 'already-aborted']) {
    test(`bubblewrap ${mode} preserves cancellation behavior`, async () => {
        const children = [];
        let markStarted;
        const started = new Promise(resolve => { markStarted = resolve; });
        const { api } = loadPlugin({ spawn: () => {
            const child = fakeChild();
            children.push(child);
            markStarted();
            return child;
        } });
        const manager = new api.testing.SandboxManager();
        const controller = new AbortController();
        if (mode === 'already-aborted') controller.abort();
        const pending = manager.execute('pwd', { timeout: mode === 'timeout' ? 10 : 1000, signal: controller.signal });
        if (mode === 'abort') {
            await started;
            controller.abort();
        }
        await assert.rejects(pending, mode === 'timeout' ? /超时/ : /取消|abort/i);
        assert.equal(children.length, mode === 'already-aborted' ? 0 : 1);
        if (children.length) assert.deepEqual(children[0].kills, ['SIGKILL']);
    });
}

const smoke = process.env.LSE_BWRAP_SMOKE === '1';
const smokeSkip = !smoke ? 'NOT RUN: opt in with LSE_BWRAP_SMOKE=1 in an authorized Linux test environment'
    : process.platform !== 'linux' ? 'BLOCK: Linux required' : false;

test('Linux smoke: real directory /lib source retains the same sandbox destinations', { skip: smokeSkip }, async () => {
    const { api } = loadPlugin({ spawn: (binary, args, options) => realSpawn(binary, args, { ...options, cwd: '/' }) });
    const args = expectedArgs('pwd', fs.existsSync('/lib64'));
    const index = args.indexOf('/lib');
    const resolvedLib = fs.realpathSync('/lib');
    assert.ok(fs.lstatSync(resolvedLib).isDirectory());
    args[index] = resolvedLib; // exercise a directory source as well as the host's symlink source
    assert.equal(args[index + 1], '/lib');
    const result = await new api.testing.SandboxManager().spawnWithTimeout('bwrap', args, 5000);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, '/\n');
});

// Opt-in real namespace tests: minimal environment and cwd=/, no production
// configuration or business entrypoint. A missing bwrap/namespace is a failure,
// never a simulated pass or a reason to relax the sandbox.
for (const command of ['pwd', 'uname -a']) {
    for (const route of ['direct bwrap', 'SandboxManager', 'runToolCall']) {
        test(`Linux smoke: ${route}: ${command}`, { skip: smokeSkip }, async () => {
            const calls = [];
            const { api } = loadPlugin({
                lib64: fs.existsSync('/lib64'),
                spawn(binary, args, options) {
                    calls.push(binary);
                    return realSpawn(binary, args, { ...options, cwd: '/' });
                }
            });
            const manager = new api.testing.SandboxManager();
            let result;
            if (route === 'direct bwrap') {
                result = await manager.spawnWithTimeout('bwrap', expectedArgs(command, fs.existsSync('/lib64')), 5000);
            } else if (route === 'SandboxManager') {
                result = await manager.execute(command, { timeout: 5000 });
            } else {
                result = await api.runToolCall({ command, hostId: 'local', timeout: 5000, outputFormat: 'raw' }, {
                    executor: new api.testing.LinuxShellExecutor()
                });
                assert.equal(result.hostId, 'local');
                assert.equal(result.executionType, 'local');
            }
            assert.equal(result.code, 0);
            assert.match(result.stdout ?? result.output, command === 'pwd' ? /^\/\n$/ : /^Linux /);
            assert.deepEqual(calls, ['bwrap']);
        });
    }
}
