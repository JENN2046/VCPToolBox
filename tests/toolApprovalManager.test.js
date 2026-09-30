const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ToolApprovalManager = require('../modules/toolApprovalManager');

function createManager(config) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-approval-'));
    const configPath = path.join(dir, 'toolApprovalConfig.json');
    fs.writeFileSync(configPath, JSON.stringify({ enabled: true, ...config }), 'utf8');
    const manager = new ToolApprovalManager(configPath);
    manager.shutdown(); // 测试中无需文件监听，避免进程挂起
    return manager;
}

test('旧语法保持兼容：工具级 / 命令级 / SilentReject', () => {
    const m = createManager({
        approvalList: ['SciCalculator', 'FileOperator:DeleteFile', 'FileOperator:DeleteFile::SilentReject']
    });
    assert.equal(m.shouldApprove('SciCalculator', {}), true);
    assert.equal(m.shouldApprove('FileOperator', { command: 'ReadFile' }), false);
    const d = m.getApprovalDecision('FileOperator', { command: 'DeleteFile', filePath: 'H:/a.txt' });
    assert.equal(d.requiresApproval, true);
    assert.equal(d.notifyAiOnReject, false);
    assert.equal(d.matchedCommand, 'DeleteFile');
});

test('参数级路径规则：FileOperator:Path:[C:]', () => {
    const m = createManager({ approvalList: ['FileOperator:Path:[C:]'] });
    assert.equal(m.shouldApprove('FileOperator', { command: 'ReadFile', filePath: 'C:\\Windows\\win.ini' }), true);
    assert.equal(m.shouldApprove('FileOperator', { command: 'ReadFile', filePath: 'c:/Users/a.txt' }), true);
    assert.equal(m.shouldApprove('FileOperator', { command: 'CopyFile', sourcePath: 'H:/a', destinationPath: 'C:/b' }), true);
    assert.equal(m.shouldApprove('FileOperator', { command: 'ListDirectory', directoryPath: 'C:' }), true);
    assert.equal(m.shouldApprove('FileOperator', { command: 'ReadFile', filePath: 'H:\\VCP\\a.txt' }), false);
    assert.equal(m.shouldApprove('FileOperator', { command: 'ReadFile', filePath: 'file:///C:/x.txt' }), true);
});

test('路径规则：单字母盘符、路径边界、.. 折叠、通配', () => {
    const m = createManager({ approvalList: ['FileOperator:Path:[D]', 'FileOperator:Path:[H:\\work]', 'FileOperator:filePath:[*.env]'] });
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'D:/x' }), true);
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/work/a.txt' }), true);
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/work-old/a.txt' }), false);
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/other/../work/a.txt' }), true);
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/proj/config.env' }), true);
});

test('参数级优先于工具级；SilentReject 在参数级生效', () => {
    const m = createManager({ approvalList: ['FileOperator', 'FileOperator:Path:[C:]::SilentReject'] });
    const d = m.getApprovalDecision('FileOperator', { filePath: 'C:/a' });
    assert.equal(d.requiresApproval, true);
    assert.equal(d.notifyAiOnReject, false);
    assert.equal(m.getApprovalDecision('FileOperator', { filePath: 'H:/a' }).notifyAiOnReject, true);
});

test('白名单：PowerShellExecutor:command:[node] 免审核', () => {
    const m = createManager({
        approvalList: ['PowerShellExecutor'],
        whitelist: ['PowerShellExecutor:command:[node]']
    });
    const d = m.getApprovalDecision('PowerShellExecutor', { command: 'node server.js', executionType: 'blocking' });
    assert.equal(d.requiresApproval, false);
    assert.equal(d.whitelistedBy, 'PowerShellExecutor:command:[node]');
    assert.equal(m.shouldApprove('PowerShellExecutor', { command: 'Node -v' }), false);
    assert.equal(m.shouldApprove('PowerShellExecutor', { command: 'node' }), false);
    // 单词边界
    assert.equal(m.shouldApprove('PowerShellExecutor', { command: 'nodemon app.js' }), true);
    assert.equal(m.shouldApprove('PowerShellExecutor', { command: 'node-gyp rebuild' }), true);
    assert.equal(m.shouldApprove('PowerShellExecutor', { command: 'Remove-Item C:/x' }), true);
});

test('白名单防绕过：命令串联 / 子表达式 / 换行 / 批量命令', () => {
    const m = createManager({
        approvalList: ['PowerShellExecutor'],
        whitelist: ['PowerShellExecutor:command:[node]']
    });
    for (const cmd of [
        'node a.js; Remove-Item C:/x',
        'node a.js && del x',
        'node a.js | Out-File x',
        'node $(Remove-Item x)',
        'node -e "require(\'child_process\')"',
        'node a.js\nRemove-Item x',
        'node a.js > C:/Windows/x'
    ]) {
        assert.equal(m.shouldApprove('PowerShellExecutor', { command: cmd }), true, cmd);
    }
    assert.equal(m.shouldApprove('PowerShellExecutor', { command1: 'node a.js', command2: 'Remove-Item x' }), true);
    assert.equal(m.shouldApprove('PowerShellExecutor', { command1: 'node a.js', command2: 'node b.js' }), false);
});

test('白名单不能越级：工具级白名单无法豁免参数级审核', () => {
    const m = createManager({
        approvalList: ['FileOperator:Path:[C:]'],
        whitelist: ['FileOperator']
    });
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'C:/a' }), true);
});

test('路径白名单：所有路径参数都需在白名单内', () => {
    const m = createManager({
        approvalList: ['FileOperator:Path:[C:]', 'FileOperator:Path:[H:]'],
        whitelist: ['FileOperator:Path:[H:\\VCP\\workspace]']
    });
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/VCP/workspace/a.md' }), false);
    assert.equal(m.shouldApprove('FileOperator', { filePath: 'H:/VCP/workspace/../secret.txt' }), true);
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'H:/VCP/workspace/a', destinationPath: 'C:/b' }), true);
});

test('approveAll 下白名单依然可豁免', () => {
    const m = createManager({ approveAll: true, whitelist: ['SciCalculator'] });
    assert.equal(m.shouldApprove('SciCalculator', {}), false);
    assert.equal(m.shouldApprove('FileOperator', {}), true);
});

test('审核关闭时一律放行', () => {
    const m = createManager({ enabled: false, approvalList: ['FileOperator'] });
    assert.equal(m.shouldApprove('FileOperator', {}), false);
});

test('白名单不能豁免另一参数触发的审批，也不能遮盖并行审批规则', () => {
    const m = createManager({
        approvalList: ['FileOperator:Path:[C:]', 'FileOperator:sourcePath:[H:/safe]'],
        whitelist: ['FileOperator:sourcePath:[H:/safe]']
    });
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'H:/safe/a', destinationPath: 'C:/Windows/system.ini' }), true);
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'H:/safe/a' }), false);
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'H:/safe/a', destinationPath: 'H:/other/b' }), false);
});

test('同一虚拟路径组仅在所有路径值均获白名单覆盖时豁免', () => {
    const m = createManager({ approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:Path:[C:/safe]'] });
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'C:/safe/a', destinationPath: 'C:/Windows/b' }), true);
    assert.equal(m.shouldApprove('FileOperator', { sourcePath: 'C:/safe/a' }), false);
});

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

test('Windows root-relative and relative paths fail closed while POSIX absolute paths keep their semantics', () => {
    const vm = require('node:vm');
    const { createRequire } = require('node:module');
    const filename = require.resolve('../modules/toolApprovalManager');
    const source = fs.readFileSync(filename, 'utf8');
    for (const platform of ['win32', 'linux']) {
        const context = { module: { exports: {} }, require: createRequire(filename), process: { platform }, console };
        vm.runInNewContext(source, context);
        const manager = Object.create(context.module.exports.prototype);
        manager.config = { enabled: true, approveAll: false, approvalList: ['FileOperator:Path:[C:]'], whitelist: ['FileOperator:Path:[*]'] };
        manager._ruleCache = {};
        for (const filePath of ['/Windows/system.ini', 'Windows/system.ini']) {
            assert.equal(manager.shouldApprove('FileOperator', { filePath }), platform === 'win32', `${platform}: ${filePath}`);
        }
    }
});
