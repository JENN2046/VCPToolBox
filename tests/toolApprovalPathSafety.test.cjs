'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const filename = require.resolve('../modules/toolApprovalManager');
const source = fs.readFileSync(filename, 'utf8');
function loadManager(platform = process.platform) {
    const localRequire = createRequire(filename);
    const context = { module: { exports: {} }, process: { platform }, console: { log() {} }, require: name => {
        if (name === 'chokidar') return { watch() { throw new Error('No watchers in isolated tests'); } };
        return localRequire(name);
    } };
    vm.runInNewContext(source, context);
    return context.module.exports;
}
function createManager(config = {}, platform) {
    const manager = Object.create(loadManager(platform).prototype);
    manager.config = { enabled: true, approveAll: false, approvalList: [], whitelist: [], ...config };
    manager._ruleCache = {};
    return manager;
}
test('FileOperator source/destination aliases cannot bypass virtual Path approval', () => {
    const manager = createManager({ approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:Path:[H:/safe]'] });
    for (const key of ['source', 'destination', 'SOURCE', 'Destination', 'source2', 'destination3']) {
        assert.equal(manager.shouldApprove('FileOperator', { command: 'CopyFile', sourcePath: 'H:/safe/a', [key]: 'C:/Windows/system.ini' }), true, key);
    }
    assert.equal(manager.shouldApprove('FileOperator', { source: 'H:/safe/a', destination: 'H:/safe/b' }), false);
});

test('Windows ambiguous paths require approval and cannot receive path whitelist exemptions', () => {
    const manager = createManager({ approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:Path:[*]'] });
    for (const filePath of [String.raw`\Windows\system.ini`, String.raw`\\?\C:\Windows\system.ini`, String.raw`\\.\C:\Windows\system.ini`, 'C:Windows/system.ini', String.raw`\\?\Volume{test}\file`]) {
        assert.equal(manager.shouldApprove('FileOperator', { filePath }), true, filePath);
    }
});

test('Windows root-relative paths fail closed while POSIX paths remain unchanged', () => {
    for (const platform of ['win32', 'linux']) {
        const manager = createManager({ approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:Path:[*]'] }, platform);
        for (const filePath of ['/Windows/system.ini', 'Windows/system.ini']) {
            assert.equal(manager.shouldApprove('FileOperator', { filePath }), platform === 'win32');
        }
    }
});


test('FileOperator concrete path rules cover every equivalent operand alias', () => {
    const groups = [
        ['filePath', 'path', 'directoryPath', 'searchPath', 'url'],
        ['sourcePath', 'source'], ['destinationPath', 'destination'],
    ];
    for (const group of groups) for (const ruleKey of group.filter(key => key !== 'path')) {
        const manager = createManager({ approvalList: [`FileOperator:${ruleKey}:[C:]`] });
        for (const alias of group) for (const suffix of ['', '2']) {
            assert.equal(manager.shouldApprove('FileOperator', { [alias.toUpperCase() + suffix]: 'C:/Windows/system.ini' }), true, `${ruleKey}/${alias}${suffix}`);
        }
    }
    const unrelated = createManager({ approvalList: ['OtherPlugin:filePath:[C:]'] });
    assert.equal(unrelated.shouldApprove('OtherPlugin', { path: 'C:/x' }), false);
});

test('alias whitelist groups validate all equivalent values, never the other operand', () => {
    const manager = createManager({ approvalList: ['FileOperator:sourcePath:[C:]'], whitelist: ['FileOperator:source:[C:/safe]'] });
    assert.equal(manager.shouldApprove('FileOperator', { sourcePath: 'C:/safe/a' }), false);
    assert.equal(manager.shouldApprove('FileOperator', { source: 'C:/safe/a', sourcePath: 'C:/Windows/a' }), true);
    const other = createManager({ approvalList: ['FileOperator:destinationPath:[C:]'], whitelist: ['FileOperator:source:[H:/safe]'] });
    assert.equal(other.shouldApprove('FileOperator', { source: 'H:/safe/a', destination: 'C:/Windows/a' }), true);
});

test('virtual Path whitelist covers concrete path rules only in the safe direction', () => {
    for (const ruleKey of ['filePath', 'sourcePath', 'destinationPath']) {
        const manager = createManager({ approvalList: [`FileOperator:${ruleKey}:[C:]`], whitelist: ['FileOperator:Path:[C:/safe]'] });
        assert.equal(manager.shouldApprove('FileOperator', { [ruleKey]: 'C:/safe/a' }), false);
        assert.equal(manager.shouldApprove('FileOperator', { [ruleKey]: 'C:/safe/a', directoryPath: 'C:/Windows/b' }), true);
    }
    const reverse = createManager({ approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:filePath:[C:/safe]'] });
    assert.equal(reverse.shouldApprove('FileOperator', { filePath: 'C:/safe/a', destination: 'C:/Windows/b' }), true);
    const nonPath = createManager({ approvalList: ['FileOperator:command:[DeleteFile]'], whitelist: ['FileOperator:Path:[C:/safe]'] });
    assert.equal(nonPath.shouldApprove('FileOperator', { command: 'DeleteFile', path: 'C:/safe/a' }), true);
});


test('wildcard whitelist covers concrete rules only after all public argument values pass', () => {
    const manager = createManager({ approvalList: ['Demo:command:[git]'], whitelist: ['Demo:*:[git]'] });
    assert.equal(manager.shouldApprove('Demo', { command: 'git' }), false);
    assert.equal(manager.shouldApprove('Demo', { command: 'git', other: 'rm' }), true);
    assert.equal(manager.shouldApprove('Demo', { command: 'git', command2: 'rm' }), true);
    assert.equal(manager.shouldApprove('Demo', { command: 'git && rm' }), true);
    const internal = createManager({ approvalList: ['Demo:maid:[restricted]'], whitelist: ['Demo:*:[git]'] });
    assert.equal(internal.shouldApprove('Demo', { command: 'git', maid: 'restricted' }), true);
});

test('wildcard path coverage still normalizes FileOperator aliases and rejects uncertain paths', () => {
    const manager = createManager({ approvalList: ['FileOperator:filePath:[C:]'], whitelist: ['FileOperator:*:[C:/safe]'] });
    assert.equal(manager.shouldApprove('FileOperator', { url: 'C:/safe/a' }), false);
    assert.equal(manager.shouldApprove('FileOperator', { url: 'C:/safe/../Windows/a' }), true);
    assert.equal(manager.shouldApprove('FileOperator', { url: String.raw`\Windows\a` }), true);
    const reverse = createManager({ approvalList: ['Demo:*:[git]'], whitelist: ['Demo:command:[git]'] });
    assert.equal(reverse.shouldApprove('Demo', { command: 'git', other: 'git' }), true);
});

test('tool parser trims structural padding without stripping content indentation', () => {
    const Parser = require('../modules/vcpLoop/toolCallParser');
    for (const [start, end] of [['「始」', '「末」'], ['「始ESCAPE」', '「末ESCAPE」']]) {
        const fields = [
            ['command', ' \tDeleteFile\r\n ', 'DeleteFile'],
            ['command2', ' CopyFile ', 'CopyFile'],
            ['executionType', ' background\t ', 'background'],
            ['encoding', ' utf8 ', 'utf8'],
            ['mode', ' direct ', 'direct'],
            ['content', '\n    def run():\n        return 1\n', '    def run():\n        return 1'],
            ['inline_code', '  const a = 1;', '  const a = 1;'],
            ['prompt', '  preserve this indent', '  preserve this indent'],
        ];
        const block = fields.map(([key, value]) => `${key}:${start}${value}${end}`).join('\n') + '\ntool_name:「始」Demo「末」';
        const call = Parser.parseBlock(block);
        assert.equal(call.name, 'Demo');
        for (const [key, , expected] of fields) assert.equal(call.args[key], expected, `${start}/${key}`);
    }
});
