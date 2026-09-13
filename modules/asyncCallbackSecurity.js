'use strict';

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const CALLBACK_COMPATIBILITY_DEADLINE_ISO = '2026-08-05T23:59:59+08:00';
const CALLBACK_COMPATIBILITY_DEADLINE_MS = Date.parse(CALLBACK_COMPATIBILITY_DEADLINE_ISO);
const CALLBACK_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

// Only callbacks emitted by built-in plugins during the migration window may
// use the unauthenticated compatibility path. A matching manifest is still
// required by the HTTP handler before any file is written.
const BUILTIN_LEGACY_CALLBACK_PLUGINS = new Set([
    'AgentAssistant',
    'AgentMessage',
    'AgnesVideoGen',
    'ChromeBridge',
    'LinuxLogMonitor',
    'MagiAgent',
    'PowerShellExecutor',
    'RAGDiaryPlugin',
    'VCPTavern',
    'Wan2.1VideoGen'
]);

const compatibilityMetrics = {
    accepted: 0,
    rejected: 0,
    lastAcceptedAt: null,
    lastRejectedAt: null,
    rejectionReasons: Object.create(null)
};

function isValidCallbackId(value) {
    if (typeof value !== 'string' || !CALLBACK_ID_PATTERN.test(value)) {
        return false;
    }

    // These names are valid according to the character allowlist but have
    // special path semantics on every supported platform.
    return value !== '.' && value !== '..';
}

function validateCallbackParams(pluginName, taskId) {
    const errors = [];
    if (!isValidCallbackId(pluginName)) errors.push('invalid_plugin_name');
    if (!isValidCallbackId(taskId)) errors.push('invalid_task_id');

    return {
        ok: errors.length === 0,
        errors
    };
}

function isPathInsideRoot(candidatePath, rootPath) {
    const relative = path.relative(rootPath, candidatePath);
    return relative !== ''
        && relative !== '..'
        && !relative.startsWith(`..${path.sep}`)
        && !path.isAbsolute(relative);
}

function resolveCallbackResultPath(resultsDir, pluginName, taskId) {
    const validation = validateCallbackParams(pluginName, taskId);
    if (!validation.ok) {
        const error = new Error(`Invalid callback identifier: ${validation.errors.join(', ')}`);
        error.code = 'INVALID_CALLBACK_IDENTIFIER';
        error.validationErrors = validation.errors;
        throw error;
    }

    const resolvedRoot = path.resolve(resultsDir);
    const resolvedPath = path.resolve(resolvedRoot, `${pluginName}-${taskId}.json`);
    if (!isPathInsideRoot(resolvedPath, resolvedRoot)) {
        const error = new Error('Callback result path escapes the configured result directory.');
        error.code = 'CALLBACK_PATH_ESCAPE';
        throw error;
    }

    return resolvedPath;
}

function safeTokenEquals(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string' || !expected) {
        return false;
    }

    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function recordCompatibilityRejection(reason, nowMs) {
    compatibilityMetrics.rejected += 1;
    compatibilityMetrics.lastRejectedAt = new Date(nowMs).toISOString();
    compatibilityMetrics.rejectionReasons[reason] =
        (compatibilityMetrics.rejectionReasons[reason] || 0) + 1;
}

function authorizeCallback({
    authorization,
    serverKey,
    pluginName,
    taskId,
    now = Date.now(),
    knownLegacyPlugins = BUILTIN_LEGACY_CALLBACK_PLUGINS
}) {
    const nowMs = now instanceof Date ? now.getTime() : Number(now);
    const validation = validateCallbackParams(pluginName, taskId);
    if (!validation.ok) {
        return {
            allowed: false,
            statusCode: 400,
            mode: 'rejected',
            reason: validation.errors.join(',')
        };
    }

    const bearerPrefix = 'Bearer ';
    const bearerValue = typeof authorization === 'string' && authorization.startsWith(bearerPrefix)
        ? authorization.slice(bearerPrefix.length)
        : null;

    if (bearerValue !== null && safeTokenEquals(bearerValue, serverKey)) {
        return {
            allowed: true,
            statusCode: 200,
            mode: 'bearer',
            deprecated: false
        };
    }

    // Invalid credentials must never be silently downgraded to the legacy
    // path. Only a completely missing Authorization header is eligible.
    if (authorization) {
        recordCompatibilityRejection('invalid_authorization', nowMs);
        return {
            allowed: false,
            statusCode: 401,
            mode: 'rejected',
            reason: 'invalid_authorization'
        };
    }

    if (nowMs > CALLBACK_COMPATIBILITY_DEADLINE_MS) {
        recordCompatibilityRejection('compatibility_window_expired', nowMs);
        return {
            allowed: false,
            statusCode: 401,
            mode: 'rejected',
            reason: 'compatibility_window_expired'
        };
    }

    if (!knownLegacyPlugins.has(pluginName)) {
        recordCompatibilityRejection('unknown_legacy_plugin', nowMs);
        return {
            allowed: false,
            statusCode: 401,
            mode: 'rejected',
            reason: 'unknown_legacy_plugin'
        };
    }

    compatibilityMetrics.accepted += 1;
    compatibilityMetrics.lastAcceptedAt = new Date(nowMs).toISOString();
    return {
        allowed: true,
        statusCode: 200,
        mode: 'legacy_compatibility',
        deprecated: true,
        deadline: CALLBACK_COMPATIBILITY_DEADLINE_ISO
    };
}

async function atomicWriteJson(targetPath, value) {
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });

    const tempName = `.${path.basename(targetPath)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    const tempPath = path.join(targetDir, tempName);
    let handle;

    try {
        handle = await fs.open(tempPath, 'wx', 0o600);
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await handle.sync();
        await handle.close();
        handle = null;
        await fs.rename(tempPath, targetPath);
    } catch (error) {
        if (handle) {
            await handle.close().catch(() => {});
        }
        await fs.unlink(tempPath).catch(() => {});
        throw error;
    }
}

function getCallbackCompatibilityMetrics() {
    return {
        accepted: compatibilityMetrics.accepted,
        rejected: compatibilityMetrics.rejected,
        lastAcceptedAt: compatibilityMetrics.lastAcceptedAt,
        lastRejectedAt: compatibilityMetrics.lastRejectedAt,
        rejectionReasons: { ...compatibilityMetrics.rejectionReasons },
        deadline: CALLBACK_COMPATIBILITY_DEADLINE_ISO,
        expired: Date.now() > CALLBACK_COMPATIBILITY_DEADLINE_MS
    };
}

function resetCallbackCompatibilityMetricsForTests() {
    compatibilityMetrics.accepted = 0;
    compatibilityMetrics.rejected = 0;
    compatibilityMetrics.lastAcceptedAt = null;
    compatibilityMetrics.lastRejectedAt = null;
    compatibilityMetrics.rejectionReasons = Object.create(null);
}

module.exports = {
    CALLBACK_COMPATIBILITY_DEADLINE_ISO,
    CALLBACK_COMPATIBILITY_DEADLINE_MS,
    BUILTIN_LEGACY_CALLBACK_PLUGINS,
    isValidCallbackId,
    validateCallbackParams,
    resolveCallbackResultPath,
    authorizeCallback,
    atomicWriteJson,
    getCallbackCompatibilityMetrics,
    resetCallbackCompatibilityMetricsForTests
};
