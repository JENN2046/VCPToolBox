function getClientIp(req) {
    let clientIp = req?.ip || null;
    if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.slice(7);
    }
    return clientIp;
}

async function executeToolCallWithContext({
    pluginManager,
    req,
    toolName,
    toolArgs = {},
    executionContext = null
}) {
    if (!pluginManager || typeof pluginManager.processToolCall !== 'function') {
        throw new Error('pluginManager is required');
    }

    return pluginManager.processToolCall(
        toolName,
        toolArgs,
        getClientIp(req),
        executionContext
    );
}

module.exports = {
    executeToolCallWithContext,
    getClientIp
};
