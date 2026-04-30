const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildToolApprovalEvidence } = require('../modules/toolApprovalEvidence');

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
        toolArgs: {
            command: 'Get-ChildItem',
            tool_password: 'SECRET_VALUE_SHOULD_NOT_APPEAR'
        }
    });

    assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'args'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(evidence, 'toolArgs'), false);
    assert.equal(JSON.stringify(evidence).includes('SECRET_VALUE_SHOULD_NOT_APPEAR'), false);
});

test('PluginManager approval request attaches approvalEvidence without removing args compatibility field', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'Plugin.js'), 'utf8');

    assert.match(source, /buildToolApprovalEvidence/);
    assert.match(source, /const approvalEvidence = buildToolApprovalEvidence/);
    assert.match(source, /approvalEvidence,/);
    assert.match(source, /args: pluginSpecificArgs/);
});
