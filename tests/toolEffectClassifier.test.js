const assert = require('node:assert/strict');
const test = require('node:test');

const { classifyToolEffect } = require('../modules/toolEffectClassifier');

test('ServerSearchController defaults to read_local', () => {
    const result = classifyToolEffect({
        toolName: 'ServerSearchController',
        approvalDecision: {
            requestedToolName: 'ServerSearchController',
            canonicalToolName: 'ServerSearchController'
        },
        toolArgs: {}
    });

    assert.equal(result.effectClass, 'read_local');
    assert.equal(result.effectConfidence, 'explicit');
    assert.deepEqual(result.effectEvidenceSources, ['tool_default:ServerSearchController']);
});

test('ServerCodeSearcher defaults to read_local', () => {
    const result = classifyToolEffect({
        toolName: 'ServerCodeSearcher',
        approvalDecision: {
            requestedToolName: 'ServerCodeSearcher',
            canonicalToolName: 'ServerCodeSearcher'
        },
        toolArgs: {}
    });

    assert.equal(result.effectClass, 'read_local');
    assert.equal(result.effectConfidence, 'explicit');
    assert.deepEqual(result.effectEvidenceSources, ['tool_default:ServerCodeSearcher']);
});

test('ServerPowerShellExecutor remains execute_shell even for Get-ChildItem', () => {
    const result = classifyToolEffect({
        toolName: 'ServerPowerShellExecutor',
        approvalDecision: {
            requestedToolName: 'PowerShellExecutor',
            canonicalToolName: 'ServerPowerShellExecutor'
        },
        toolArgs: {
            command: 'Get-ChildItem'
        }
    });

    assert.equal(result.effectClass, 'execute_shell');
    assert.equal(result.effectConfidence, 'explicit');
    assert.equal(result.command, 'Get-ChildItem');
});

test('ServerFileOperator command overrides classify known operations explicitly', () => {
    const readResult = classifyToolEffect({
        toolName: 'ServerFileOperator',
        approvalDecision: {
            requestedToolName: 'FileOperator',
            canonicalToolName: 'ServerFileOperator'
        },
        toolArgs: {
            command: 'ReadFile'
        }
    });
    const writeResult = classifyToolEffect({
        toolName: 'ServerFileOperator',
        approvalDecision: {
            requestedToolName: 'FileOperator',
            canonicalToolName: 'ServerFileOperator'
        },
        toolArgs: {
            command: 'WriteFile'
        }
    });
    const deleteResult = classifyToolEffect({
        toolName: 'ServerFileOperator',
        approvalDecision: {
            requestedToolName: 'FileOperator',
            canonicalToolName: 'ServerFileOperator'
        },
        toolArgs: {
            command: 'DeleteFile'
        }
    });

    assert.equal(readResult.effectClass, 'read_local');
    assert.equal(writeResult.effectClass, 'write_local');
    assert.equal(deleteResult.effectClass, 'delete_or_destructive');
});

test('unmapped ServerFileOperator commands stay conservative', () => {
    const result = classifyToolEffect({
        toolName: 'ServerFileOperator',
        approvalDecision: {
            requestedToolName: 'FileOperator',
            canonicalToolName: 'ServerFileOperator'
        },
        toolArgs: {
            command: 'UnmappedCommand'
        }
    });

    assert.equal(result.effectClass, 'delete_or_destructive');
    assert.equal(result.effectConfidence, 'derived');
    assert.deepEqual(result.effectEvidenceSources, ['tool_family_default:ServerFileOperator']);
});

test('numbered commands are classified and keep destructive batch operations conservative', () => {
    const result = classifyToolEffect({
        toolName: 'FileOperator',
        approvalDecision: {
            requestedToolName: 'FileOperator',
            canonicalToolName: 'ServerFileOperator'
        },
        toolArgs: {
            command1: 'ReadFile',
            command2: 'DeleteFile'
        }
    });

    assert.equal(result.command, 'DeleteFile');
    assert.equal(result.effectClass, 'delete_or_destructive');
    assert.equal(result.effectConfidence, 'explicit');
    assert.deepEqual(result.effectEvidenceSources, ['command_override:ServerFileOperator:DeleteFile']);
});

test('numbered PowerShell commands still classify as execute_shell', () => {
    const result = classifyToolEffect({
        toolName: 'PowerShellExecutor',
        approvalDecision: {
            requestedToolName: 'PowerShellExecutor',
            canonicalToolName: 'ServerPowerShellExecutor'
        },
        toolArgs: {
            command1: 'Get-ChildItem'
        }
    });

    assert.equal(result.command, 'Get-ChildItem');
    assert.equal(result.effectClass, 'execute_shell');
    assert.equal(result.effectConfidence, 'explicit');
});

test('unknown tools fall back to unknown conservatively', () => {
    const result = classifyToolEffect({
        toolName: 'UnknownTool',
        approvalDecision: {
            requestedToolName: 'UnknownTool',
            canonicalToolName: 'UnknownTool'
        },
        toolArgs: {
            command: 'Whatever'
        }
    });

    assert.equal(result.effectClass, 'unknown');
    assert.equal(result.effectConfidence, 'unknown');
    assert.deepEqual(result.effectEvidenceSources, ['fallback:unknown']);
});
