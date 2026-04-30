'use strict';

const COMMAND_EFFECT_OVERRIDES = Object.freeze({
    'ServerFileOperator:ReadFile': {
        effectClass: 'read_local',
        confidence: 'explicit',
        reasons: ['explicit command override for local file read'],
        evidenceSources: ['command_override:ServerFileOperator:ReadFile']
    },
    'ServerFileOperator:WriteFile': {
        effectClass: 'write_local',
        confidence: 'explicit',
        reasons: ['explicit command override for local file write'],
        evidenceSources: ['command_override:ServerFileOperator:WriteFile']
    },
    'ServerFileOperator:DeleteFile': {
        effectClass: 'delete_or_destructive',
        confidence: 'explicit',
        reasons: ['explicit command override for destructive file delete'],
        evidenceSources: ['command_override:ServerFileOperator:DeleteFile']
    }
});

const TOOL_EFFECT_DEFAULTS = Object.freeze({
    ServerSearchController: {
        effectClass: 'read_local',
        confidence: 'explicit',
        reasons: ['explicit tool default for local search'],
        evidenceSources: ['tool_default:ServerSearchController']
    },
    ServerCodeSearcher: {
        effectClass: 'read_local',
        confidence: 'explicit',
        reasons: ['explicit tool default for code search'],
        evidenceSources: ['tool_default:ServerCodeSearcher']
    },
    ServerPowerShellExecutor: {
        effectClass: 'execute_shell',
        confidence: 'explicit',
        reasons: ['shell execution surface remains powerful even for read-like commands'],
        evidenceSources: ['tool_default:ServerPowerShellExecutor']
    }
});

function normalizeString(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}

function buildResult(input = {}) {
    const requestedToolName = normalizeString(input.requestedToolName) || '';
    const canonicalToolName = normalizeString(input.canonicalToolName) || requestedToolName;
    const command = normalizeString(input.command);
    const effectClass = normalizeString(input.effectClass) || 'unknown';
    const confidence = normalizeString(input.confidence) || 'unknown';
    const reasons = Array.isArray(input.reasons) ? [...input.reasons] : [];
    const evidenceSources = Array.isArray(input.evidenceSources) ? [...input.evidenceSources] : [];

    return {
        requestedToolName,
        canonicalToolName,
        command,
        effectClass,
        effectConfidence: confidence,
        effectReasons: reasons,
        effectEvidenceSources: evidenceSources
    };
}

function classifyToolEffect(input = {}) {
    const approvalDecision = input.approvalDecision || {};
    const requestedToolName = normalizeString(approvalDecision.requestedToolName)
        || normalizeString(input.toolName)
        || '';
    const canonicalToolName = normalizeString(approvalDecision.canonicalToolName)
        || requestedToolName;
    const command = normalizeString(input.toolArgs?.command);

    const commandKey = command ? `${canonicalToolName}:${command}` : null;
    if (commandKey && Object.prototype.hasOwnProperty.call(COMMAND_EFFECT_OVERRIDES, commandKey)) {
        const match = COMMAND_EFFECT_OVERRIDES[commandKey];
        return buildResult({
            requestedToolName,
            canonicalToolName,
            command,
            effectClass: match.effectClass,
            confidence: match.confidence,
            reasons: match.reasons,
            evidenceSources: match.evidenceSources
        });
    }

    if (canonicalToolName === 'ServerFileOperator' && command) {
        return buildResult({
            requestedToolName,
            canonicalToolName,
            command,
            effectClass: 'delete_or_destructive',
            confidence: 'derived',
            reasons: ['unmapped ServerFileOperator command remains conservative by default'],
            evidenceSources: ['tool_family_default:ServerFileOperator']
        });
    }

    if (Object.prototype.hasOwnProperty.call(TOOL_EFFECT_DEFAULTS, canonicalToolName)) {
        const match = TOOL_EFFECT_DEFAULTS[canonicalToolName];
        return buildResult({
            requestedToolName,
            canonicalToolName,
            command,
            effectClass: match.effectClass,
            confidence: match.confidence,
            reasons: match.reasons,
            evidenceSources: match.evidenceSources
        });
    }

    return buildResult({
        requestedToolName,
        canonicalToolName,
        command,
        effectClass: 'unknown',
        confidence: 'unknown',
        reasons: ['no explicit effect mapping for canonical tool or command'],
        evidenceSources: ['fallback:unknown']
    });
}

module.exports = {
    classifyToolEffect
};
