'use strict';

function normalizeString(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}

function normalizeExecutionContext(executionContext = null, options = {}) {
    const nullWhenMissing = options.nullWhenMissing === true;
    const defaultRequestSource = normalizeString(options.defaultRequestSource) || 'unknown';

    if (!executionContext || typeof executionContext !== 'object') {
        return nullWhenMissing
            ? null
            : {
                agentAlias: null,
                agentId: null,
                requestSource: defaultRequestSource
            };
    }

    return {
        agentAlias: normalizeString(executionContext.agentAlias),
        agentId: normalizeString(executionContext.agentId),
        requestSource: normalizeString(executionContext.requestSource) || defaultRequestSource
    };
}

module.exports = {
    normalizeExecutionContext
};
