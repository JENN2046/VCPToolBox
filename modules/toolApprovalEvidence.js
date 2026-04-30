'use strict';

const { normalizeExecutionContext } = require('./toolExecutionContext');

function normalizeString(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}

function buildToolApprovalEvidence(input = {}) {
    const approvalDecision = input.approvalDecision || {};
    const executionContext = normalizeExecutionContext(input.executionContext);
    const requestedToolName = normalizeString(approvalDecision.requestedToolName)
        || normalizeString(input.toolName);
    const canonicalToolName = normalizeString(approvalDecision.canonicalToolName)
        || requestedToolName;

    return {
        requestedToolName,
        canonicalToolName,
        matchedRule: normalizeString(approvalDecision.matchedRule),
        matchedCommand: normalizeString(approvalDecision.matchedCommand),
        wasAlias: approvalDecision.wasAlias === true,
        requestSource: executionContext.requestSource,
        agentAlias: executionContext.agentAlias,
        agentId: executionContext.agentId,
        requiresApproval: approvalDecision.requiresApproval === true,
        notifyAiOnReject: approvalDecision.notifyAiOnReject !== false
    };
}

module.exports = {
    buildToolApprovalEvidence
};
