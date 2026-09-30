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
