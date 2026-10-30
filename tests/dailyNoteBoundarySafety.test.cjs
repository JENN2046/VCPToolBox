'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fsModule = require('node:fs');
const fs = fsModule.promises;
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const filename = path.resolve(__dirname, '../Plugin/DailyNote/dailynote.js');
const source = fsModule.readFileSync(filename, 'utf8');
const dependencies = createRequire(filename);
const target = 'This is the original diary content to replace safely.';
const replacement = 'This is the updated diary content after safe replacement.';

async function fixture(t, wrap = value => value, { noFollow = true } = {}) {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-boundary-'));
    const root = path.join(temp, 'notes');
    await fs.mkdir(root);
    const logs = [];
    const module = { exports: {} };
    const io = wrap(fs, { root, temp });
    vm.runInNewContext(source, {
        module, exports: module.exports, __dirname: path.dirname(filename),
        require: name => name === 'dotenv' ? { config() {} }
            : name === 'fs' ? { promises: io, constants: noFollow ? fsModule.constants : { O_RDONLY: fsModule.constants.O_RDONLY } } : dependencies(name),
        process: { env: { KNOWLEDGEBASE_ROOT_PATH: root, DAILY_NOTE_FUZZY_DIFF: 'true', DebugMode: 'true' }, pid: process.pid },
        console: { log: (...v) => logs.push(v), warn: (...v) => logs.push(v), error: (...v) => logs.push(v) }, setTimeout
    }, { filename });
    const plugin = module.exports;
    t.after(async () => { await plugin.shutdown(); await fs.rm(temp, { recursive: true, force: true }); });
    const note = async (folder, content, name = 'note.txt') => {
        const file = path.join(root, folder, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, content);
        return file;
    };
    return { root, temp, logs, plugin, note, update: args => plugin.dispatchCommand({ command: 'update', target, replace: replacement, ...args }) };
}

test('owner fallback cannot write a different owner with the same textual prefix', async t => {
    const f = await fixture(t);
    const other = await f.note('novax的日记', target);
    await f.note('nova的日记', 'unrelated');
    assert.equal((await f.update({ maid: 'nova' })).status, 'error');
    assert.equal(await fs.readFile(other, 'utf8'), target);
});

test('fuzzy diagnostics cannot read a prefix-colliding private namespace', async t => {
    const f = await fixture(t);
    await f.note('nova的日记', 'unrelated');
    await f.note('novax的日记', 'This is the original diary PRIVATE_OTHER_OWNER content to replace safely.');
    const result = await f.update({ maid: 'nova' });
    assert.equal(result.status, 'error');
    assert.equal(JSON.stringify({ result, logs: f.logs }).includes('PRIVATE_OTHER_OWNER'), false);
    assert.equal(result.result?.fuzzyDiff, undefined);
});

test('public fallback does not include an owner whose name starts with public', async t => {
    const f = await fixture(t);
    await f.note('公共的知识', 'unrelated');
    const other = await f.note('公共Alice的日记', target);
    assert.equal((await f.update({ maid: 'nova', folder: '公共的知识' })).status, 'error');
    assert.equal(await fs.readFile(other, 'utf8'), target);
});

for (const args of [{ maid: 'nova', folder: 'other/的知识' }, { maid: 'no/va' },
    { maid: '[other\\的知识]nova' }, { maid: 'no\u200bva' }, { maid: 'nova', folder: 'nova/../other' }]) {
    test('path-like or invisible scope input is refused before alias lookup: ' + JSON.stringify(args), async t => {
        const f = await fixture(t);
        const file = await f.note(args.folder?.startsWith('other') ? 'other的知识' : 'nova的日记', target);
        assert.equal((await f.update(args)).status, 'error');
        assert.equal(await fs.readFile(file, 'utf8'), target);
    });
}

test('a fifteen-character target cannot normalize to a one-character write intent', async t => {
    const f = await fixture(t);
    const file = await f.note('nova的日记', 'x');
    assert.equal((await f.update({ maid: 'nova', target: ' '.repeat(14) + 'x' })).status, 'error');
    assert.equal(await fs.readFile(file, 'utf8'), 'x');
});

for (const noFollow of [true, false]) test(`transient symlink read cannot leak outside content, O_NOFOLLOW=${noFollow}`, async t => {
    let attempted = false;
    const f = await fixture(t, (real, { root, temp }) => {
        const file = path.join(root, 'nova的日记/note.txt'), outside = path.join(temp, 'outside.txt');
        async function swap(operation) {
            attempted = true;
            await real.rename(file, file + '.saved');
            await real.symlink(outside, file);
            try { return await operation(); }
            finally { await real.unlink(file); await real.rename(file + '.saved', file); }
        }
        return new Proxy(real, { get(object, key) {
            if (key === 'readFile' || key === 'open') return async (name, ...args) =>
                name === file && !attempted ? swap(() => object[key](name, ...args)) : object[key](name, ...args);
            return object[key];
        } });
    }, { noFollow });
    const file = await f.note('nova的日记', 'unrelated owner content');
    await fs.writeFile(path.join(f.temp, 'outside.txt'), 'This is the original diary PRIVATE_OUTSIDE_PAYLOAD content to replace safely.');
    const result = await f.update({ maid: 'nova' });
    assert.equal(attempted, true);
    assert.equal(result.status, 'error');
    assert.equal(JSON.stringify({ result, logs: f.logs }).includes('PRIVATE_OUTSIDE_PAYLOAD'), false);
    assert.equal(await fs.readFile(file, 'utf8'), 'unrelated owner content');
});

test('same-inode concurrent writes with restored size and mtime are not overwritten', async t => {
    let changed = false;
    const concurrent = 'C'.repeat(target.length);
    const f = await fixture(t, (real, { root }) => new Proxy(real, { get(object, key) {
        if (key === 'writeFile') return async (name, ...args) => {
            const value = await object.writeFile(name, ...args);
            if (!changed && typeof name === 'string' && name.endsWith('.tmp')) {
                changed = true;
                const file = path.join(root, 'nova的日记/note.txt');
                const stat = await real.stat(file);
                await real.writeFile(file, concurrent);
                await real.utimes(file, stat.atime, stat.mtime);
            }
            return value;
        };
        return object[key];
    } }));
    const file = await f.note('nova的日记', target);
    await fs.utimes(file, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
    const result = await f.update({ maid: 'nova' });
    assert.equal(changed, true);
    assert.equal(result.status, 'error');
    assert.equal(result.code, 'DAILY_NOTE_WRITE_CONFLICT');
    assert.equal(await fs.readFile(file, 'utf8'), concurrent);
    assert.equal((await fs.readdir(path.dirname(file))).some(name => name.endsWith('.tmp')), false);
});

test('resident FIFO and existing KBD coordination preserve dependent updates and cancellation', async t => {
    const f = await fixture(t);
    const file = await f.note('nova的日记', target);
    let active = 0, calls = 0;
    f.plugin.initialize({}, { knowledgeBaseManager: { async runExternalFileMutation(_owner, operation, options) {
        assert.equal(active, 0); active++; calls++;
        assert.equal(options.waitForIndex, false);
        try { return await operation(); } finally { active--; }
    } } });
    const first = f.plugin.processToolCall({ command: 'update', maid: 'nova', target, replace: replacement });
    const second = f.plugin.processToolCall({ command: 'update', maid: 'nova', target: replacement, replace: target });
    const controller = new AbortController(); controller.abort();
    const aborted = f.plugin.processToolCall({ command: 'update', maid: 'nova', target, replace: replacement }, { signal: controller.signal });
    const results = await Promise.all([first, second, aborted]);
    assert.deepEqual(results.map(result => result.status), ['success', 'success', 'error']);
    assert.equal(calls, 2);
    assert.equal(await fs.readFile(file, 'utf8'), target);
});


test('a hard link cannot inject out-of-scope content into update diagnostics', async t => {
    const f = await fixture(t);
    const outside = path.join(f.temp, 'outside.txt');
    await fs.writeFile(outside, 'This is the original diary PRIVATE_HARD_LINK content to replace safely.');
    await fs.mkdir(path.join(f.root, 'nova的日记'));
    await fs.link(outside, path.join(f.root, 'nova的日记/note.txt'));
    const result = await f.update({ maid: 'nova' });
    assert.equal(result.status, 'error');
    assert.equal(JSON.stringify({ result, logs: f.logs }).includes('PRIVATE_HARD_LINK'), false);
});

test('an unreadable candidate prevents committing another match because uniqueness is unknown', async t => {
    const f = await fixture(t, (real, { root }) => new Proxy(real, { get(object, key) {
        if (key === 'open') return async (name, ...args) => {
            if (name === path.join(root, 'nova的日记/unreadable.txt')) throw Object.assign(new Error('synthetic denied'), { code: 'EACCES' });
            return object.open(name, ...args);
        };
        return object[key];
    } }));
    const good = await f.note('nova的日记', target, 'good.txt');
    await f.note('nova的日记', 'unrelated', 'unreadable.txt');
    const result = await f.update({ maid: 'nova' });
    assert.equal(result.code, 'DAILY_NOTE_SCAN_INCOMPLETE');
    assert.equal(await fs.readFile(good, 'utf8'), target);
});

test('ambiguous normalized category aliases do not select any candidate', async t => {
    const f = await fixture(t);
    const first = await f.note('分 类', target);
    const second = await f.note('分类日记本', 'unrelated');
    const result = await f.update({ maid: 'nova', folder: '分类 日记本' });
    assert.equal(result.status, 'error');
    assert.match(result.error, /Ambiguous diary folder/);
    assert.equal(await fs.readFile(first, 'utf8'), target);
    assert.equal(await fs.readFile(second, 'utf8'), 'unrelated');
});
