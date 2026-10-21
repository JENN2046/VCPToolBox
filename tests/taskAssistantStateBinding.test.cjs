const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const sourcePath = path.join(__dirname, '../Plugin/VCPTaskAssistant/vcp-task-assistant.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const disabledData = (limit = 200) => JSON.stringify({ version: 1, globalEnabled: false,
    settings: { maxHistory: limit }, tasks: [], history: [] }, null, 2);

function fixture(primary, backup, aliases = true) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-state-regression-'));
    const plugin = path.join(root, 'runtime', 'Plugin', 'VCPTaskAssistant');
    const state = aliases ? path.join(root, 'state') : plugin;
    fs.mkdirSync(plugin, { recursive: true }); fs.mkdirSync(state, { recursive: true });
    const mainPath = path.join(state, 'task-center-data.json');
    const backupPath = mainPath + '.bak';
    if (primary !== undefined) fs.writeFileSync(mainPath, primary);
    if (backup !== undefined) fs.writeFileSync(backupPath, backup);
    if (aliases) {
        fs.symlinkSync(mainPath, path.join(plugin, 'task-center-data.json'));
        fs.symlinkSync(backupPath, path.join(plugin, 'task-center-data.json.bak'));
    }
    const renames = [], messages = [];
    const fixtureFs = { ...fs, promises: { ...fs.promises, async rename(from, to) {
        renames.push({ from, to }); return fs.promises.rename(from, to);
    } } };
    const requireFixture = name => {
        if (name === 'fs') return fixtureFs;
        if (name === 'path') return path;
        if (name === 'node-schedule') return { scheduleJob() { throw new Error('Disabled fixture must not schedule'); } };
        if (name === './lib/forum-engine') return class {};
        if (name === '../AgentAssistant/AgentAssistant.js') return { processToolCall() { throw new Error('No provider calls allowed'); } };
        throw new Error('Unexpected fixture import: ' + name);
    };
    const mod = { exports: {} };
    const consoleFixture = Object.fromEntries(['log', 'warn', 'error'].map(k => [k, (...args) => messages.push(args)]));
    vm.runInNewContext(source + '\nmodule.exports.fixtureHooks = { loadData, saveData, locked:()=>saveDisabled, setLimit:n=>taskCenterData.settings.maxHistory=n, enabled:()=>taskCenterData.globalEnabled };', {
        require: requireFixture, module: mod, exports: mod.exports, __dirname: plugin,
        __filename: sourcePath, console: consoleFixture, process: { env: {} }
    }, { filename: sourcePath });
    return { ...mod.exports.fixtureHooks, root, plugin, state, mainPath, backupPath, renames,
        close() { fs.rmSync(root, { recursive: true, force: true }); } };
}

test('atomic saves preserve runtime aliases and write the canonical disabled state', async () => {
    const f = fixture(disabledData(), disabledData());
    try {
        await f.loadData(); f.setLimit(77); assert.equal(await f.saveData(), true);
        assert.equal(f.enabled(), false); assert.equal(f.locked(), false);
        assert.equal(fs.lstatSync(path.join(f.plugin, 'task-center-data.json')).isSymbolicLink(), true);
        assert.equal(fs.lstatSync(path.join(f.plugin, 'task-center-data.json.bak')).isSymbolicLink(), true);
        assert.equal(JSON.parse(fs.readFileSync(f.mainPath, 'utf8')).settings.maxHistory, 77);
        assert.equal(f.renames[0].to, f.mainPath);
        assert.equal(path.dirname(f.renames[0].from), f.state);
    } finally { f.close(); }
});

for (const [name, original] of [['missing', undefined], ['blank', ' \n'], ['corrupt', '{bad json']]) {
    test(`${name} canonical primary recovers from backup without destroying the valid backup`, async () => {
        const good = disabledData(88); const f = fixture(original, good);
        try {
            await f.loadData(); assert.equal(f.locked(), false); assert.equal(f.enabled(), false);
            assert.equal(await f.saveData(), true);
            assert.equal(fs.readFileSync(f.mainPath, 'utf8'), good);
            assert.equal(fs.readFileSync(f.backupPath, 'utf8'), good);
            assert.equal(fs.lstatSync(path.join(f.plugin, 'task-center-data.json')).isSymbolicLink(), true);
        } finally { f.close(); }
    });
}

test('invalid primary and backup retain the write protection and original bytes', async () => {
    const f = fixture('{bad main', '{bad backup');
    try {
        await f.loadData(); assert.equal(f.locked(), true); await f.saveData();
        assert.equal(fs.readFileSync(f.mainPath, 'utf8'), '{bad main');
        assert.equal(fs.readFileSync(f.backupPath, 'utf8'), '{bad backup');
        assert.equal(f.renames.length, 0);
    } finally { f.close(); }
});

test('standalone first initialization still defaults to disabled', async () => {
    const f = fixture(undefined, undefined, false);
    try {
        await f.loadData(); assert.equal(f.locked(), false); assert.equal(f.enabled(), false);
        assert.equal(JSON.parse(fs.readFileSync(f.mainPath, 'utf8')).globalEnabled, false);
    } finally { f.close(); }
});

test('large-file empty-overwrite protection still applies to the canonical target', async () => {
    const f = fixture(disabledData(), disabledData());
    try {
        await f.loadData(); const large = 'x'.repeat(11000); fs.writeFileSync(f.mainPath, large);
        assert.equal(await f.saveData(), false); assert.equal(f.locked(), true);
        assert.equal(fs.readFileSync(f.mainPath, 'utf8'), large);
        assert.equal(fs.readFileSync(f.backupPath, 'utf8'), disabledData());
    } finally { f.close(); }
});
