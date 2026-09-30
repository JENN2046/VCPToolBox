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
