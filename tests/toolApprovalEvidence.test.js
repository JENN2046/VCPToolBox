const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    buildApprovalArgsPreview,
    buildToolApprovalEvidence,
    isSensitiveArgKey
} = require('../modules/toolApprovalEvidence');

test('buildToolApprovalEvidence carries resolved identity and normalized context', () => {
    const evidence = buildToolApprovalEvidence({
        toolName: 'PowerShellExecutor',
        approvalDecision: {
            requiresApproval: true,
            notifyAiOnReject: false,
            matchedRule: 'ServerPowerShellExecutor:Get-ChildItem',
            matchedCommand: 'Get-ChildItem',
            requestedToolName: 'PowerShellExecutor',
            canonicalToolName: 'ServerPowerShellExecutor',
            wasAlias: true
        },
        executionContext: {
            agentAlias: ' Codex ',
            agentId: ' codex-desktop ',
            requestSource: ' human-tool-route '
        }
    });

    assert.deepEqual(evidence, {
        requestedToolName: 'PowerShellExecutor',
        canonicalToolName: 'ServerPowerShellExecutor',
        matchedRule: 'ServerPowerShellExecutor:Get-ChildItem',
        matchedCommand: 'Get-ChildItem',
        wasAlias: true,
        requestSource: 'human-tool-route',
        agentAlias: 'Codex',
        agentId: 'codex-desktop',
        requiresApproval: true,
        notifyAiOnReject: false
    });
});

test('buildToolApprovalEvidence defaults missing context conservatively', () => {
    const evidence = buildToolApprovalEvidence({
        toolName: 'SciCalculator',
        approvalDecision: {
            requiresApproval: true,
            matchedRule: 'SciCalculator'
        }
    });

    assert.equal(evidence.requestedToolName, 'SciCalculator');
    assert.equal(evidence.canonicalToolName, 'SciCalculator');
    assert.equal(evidence.requestSource, 'unknown');
    assert.equal(evidence.agentAlias, null);
    assert.equal(evidence.agentId, null);
    assert.equal(evidence.notifyAiOnReject, true);
});

test('buildToolApprovalEvidence does not carry raw args or secret-like values', () => {
    const toolArgs = {
        command: 'Get-ChildItem',
        targetPath: 'C:\\safe',
        tool_password: 'SECRET_VALUE_SHOULD_NOT_APPEAR',
        nested: {
            apiKey: 'NESTED_SECRET_VALUE_SHOULD_NOT_APPEAR',
            harmless: 'visible'
        },
        entries: [
            {
                access_token: 'ARRAY_SECRET_VALUE_SHOULD_NOT_APPEAR',
                name: 'visible-entry'
            }
        ]
    };
    const evidence = buildToolApprovalEvidence({
        toolName: 'ServerPowerShellExecutor',
        approvalDecision: {
            requiresApproval: true,
            matchedRule: 'ServerPowerShellExecutor',
            requestedToolName: 'ServerPowerShellExecutor',
            canonicalToolName: 'ServerPowerShellExecutor'
        },
        executionContext: {
            requestSource: 'task-scheduler'
        },
        toolArgs
    });

    assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'args'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'toolArgs'), false);
    assert.deepEqual(evidence.argsPreview, {
        argumentType: 'object',
        argKeys: [
            'command',
            'targetPath',
            'tool_password',
            'nested',
            'nested.apiKey',
            'nested.harmless',
            'entries',
            'entries[].access_token',
            'entries[].name'
        ],
        redactedArgKeys: [
            'tool_password',
            'nested.apiKey',
            'entries[].access_token'
        ],
        containsSensitiveKeys: true,
        hasCommand: true,
        hasCircular: false,
        truncated: false
    });
    assert.equal(JSON.stringify(evidence).includes('SECRET_VALUE_SHOULD_NOT_APPEAR'), false);
    assert.equal(JSON.stringify(evidence).includes('C:\\safe'), false);
    assert.equal(JSON.stringify(evidence).includes('visible-entry'), false);
    assert.equal(toolArgs.tool_password, 'SECRET_VALUE_SHOULD_NOT_APPEAR');
    assert.equal(toolArgs.nested.apiKey, 'NESTED_SECRET_VALUE_SHOULD_NOT_APPEAR');
});

test('buildApprovalArgsPreview summarizes arg shape without mutating input', () => {
    const args = {
        command: 'DeleteFile',
        path: 'tmp.txt',
        options: {
            clientSecret: 'CLIENT_SECRET_VALUE_SHOULD_NOT_APPEAR'
        }
    };

    const preview = buildApprovalArgsPreview(args);

    assert.deepEqual(preview, {
        argumentType: 'object',
        argKeys: [
            'command',
            'path',
            'options',
            'options.clientSecret'
        ],
        redactedArgKeys: [
            'options.clientSecret'
        ],
        containsSensitiveKeys: true,
        hasCommand: true,
        hasCircular: false,
        truncated: false
    });
    assert.equal(args.options.clientSecret, 'CLIENT_SECRET_VALUE_SHOULD_NOT_APPEAR');
    assert.equal(JSON.stringify(preview).includes('DeleteFile'), false);
    assert.equal(JSON.stringify(preview).includes('tmp.txt'), false);
    assert.equal(JSON.stringify(preview).includes('CLIENT_SECRET_VALUE_SHOULD_NOT_APPEAR'), false);
});

test('buildApprovalArgsPreview handles circular values safely', () => {
    const args = {
        command: 'Get-ChildItem'
    };
    args.self = args;
    args.items = [];
    args.items.push(args.items);

    const preview = buildApprovalArgsPreview(args);

    assert.deepEqual(preview, {
        argumentType: 'object',
        argKeys: [
            'command',
            'self',
            'items'
        ],
        redactedArgKeys: [],
        containsSensitiveKeys: false,
        hasCommand: true,
        hasCircular: true,
        truncated: false
    });
});

test('buildApprovalArgsPreview keeps scanning sibling keys after truncating arrays', () => {
    const args = {
        rows: [
            { name: 'a' },
            { name: 'b' },
            { name: 'c' },
            { name: 'd' },
            { name: 'e' },
            { name: 'f' }
        ],
        password: 'SECRET_VALUE_SHOULD_NOT_APPEAR'
    };

    const preview = buildApprovalArgsPreview(args);

    assert.equal(preview.truncated, true);
    assert.equal(preview.containsSensitiveKeys, true);
    assert.deepEqual(preview.redactedArgKeys, ['password']);
    assert.equal(JSON.stringify(preview).includes('SECRET_VALUE_SHOULD_NOT_APPEAR'), false);
});

test('isSensitiveArgKey detects common secret-like arg keys', () => {
    assert.equal(isSensitiveArgKey('api_key'), true);
    assert.equal(isSensitiveArgKey('access_token'), true);
    assert.equal(isSensitiveArgKey('clientSecret'), true);
    assert.equal(isSensitiveArgKey('targetPath'), false);
});

test('PluginManager approval request attaches approvalEvidence without removing args compatibility field', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Plugin.js'), 'utf8');

    assert.match(source, /buildToolApprovalEvidence/);
    assert.match(source, /const approvalEvidence = buildToolApprovalEvidence/);
    assert.match(source, /toolArgs: pluginSpecificArgs/);
    assert.match(source, /approvalEvidence,/);
    assert.match(source, /args: pluginSpecificArgs/);
});
