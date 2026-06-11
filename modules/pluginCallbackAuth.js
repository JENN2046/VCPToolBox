'use strict';

const crypto = require('crypto');

const DEFAULT_MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

function firstString(...values) {
    for (const value of values) {
        if (Array.isArray(value)) {
            const nested = firstString(...value);
            if (nested) return nested;
            continue;
        }
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return '';
    return firstString(headers[name], headers[name.toLowerCase()]);
}

function getCallbackAuthFields(req) {
    const query = req && req.query ? req.query : {};
    const headers = req && req.headers ? req.headers : {};
    return {
        expiresAt: firstString(
            query.vcp_cb_expires,
            query.expires,
            getHeader(headers, 'x-vcp-callback-expires')
        ),
        nonce: firstString(
            query.vcp_cb_nonce,
            query.nonce,
            getHeader(headers, 'x-vcp-callback-nonce')
        ),
        signature: firstString(
            query.vcp_cb_sig,
            query.sig,
            query.signature,
            getHeader(headers, 'x-vcp-callback-signature')
        )
    };
}

function buildPluginCallbackSigningPayload(pluginName, taskId, expiresAt, nonce) {
    return [
        String(pluginName || ''),
        String(taskId || ''),
        String(expiresAt || ''),
        String(nonce || '')
    ].join('\n');
}

function signPluginCallback({ secret, pluginName, taskId, expiresAt, nonce }) {
    if (!secret) {
        throw new Error('plugin callback secret is required');
    }
    return crypto
        .createHmac('sha256', String(secret))
        .update(buildPluginCallbackSigningPayload(pluginName, taskId, expiresAt, nonce))
        .digest('hex');
}

function safeEqualHex(left, right) {
    if (!/^[0-9a-f]{64}$/i.test(String(left || ''))) return false;
    if (!/^[0-9a-f]{64}$/i.test(String(right || ''))) return false;
    const leftBuffer = Buffer.from(String(left), 'hex');
    const rightBuffer = Buffer.from(String(right), 'hex');
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPluginCallbackAuth({
    secret,
    pluginName,
    taskId,
    expiresAt,
    nonce,
    signature,
    now = Date.now(),
    maxFutureMs = DEFAULT_MAX_FUTURE_MS
}) {
    if (!secret) {
        return {
            ok: false,
            status: 503,
            code: 'plugin_callback_secret_unconfigured',
            message: 'Plugin callback authentication secret is not configured.'
        };
    }

    if (!expiresAt || !nonce || !signature) {
        return {
            ok: false,
            status: 401,
            code: 'plugin_callback_auth_missing',
            message: 'Plugin callback authentication is required.'
        };
    }

    const expiresMs = Number(expiresAt);
    if (!Number.isFinite(expiresMs)) {
        return {
            ok: false,
            status: 401,
            code: 'plugin_callback_auth_bad_expiry',
            message: 'Plugin callback expiry is invalid.'
        };
    }

    if (expiresMs < now) {
        return {
            ok: false,
            status: 401,
            code: 'plugin_callback_auth_expired',
            message: 'Plugin callback authentication has expired.'
        };
    }

    if (expiresMs - now > maxFutureMs) {
        return {
            ok: false,
            status: 401,
            code: 'plugin_callback_auth_expiry_too_far',
            message: 'Plugin callback expiry is too far in the future.'
        };
    }

    const expectedSignature = signPluginCallback({ secret, pluginName, taskId, expiresAt, nonce });
    if (!safeEqualHex(signature, expectedSignature)) {
        return {
            ok: false,
            status: 401,
            code: 'plugin_callback_auth_invalid',
            message: 'Plugin callback authentication is invalid.'
        };
    }

    return {
        ok: true,
        expiresAt: expiresMs,
        nonce: String(nonce)
    };
}

function verifyPluginCallbackRequest(req, options = {}) {
    const fields = getCallbackAuthFields(req);
    return verifyPluginCallbackAuth({
        secret: options.secret,
        pluginName: req?.params?.pluginName,
        taskId: req?.params?.taskId,
        expiresAt: fields.expiresAt,
        nonce: fields.nonce,
        signature: fields.signature,
        now: options.now,
        maxFutureMs: options.maxFutureMs
    });
}

module.exports = {
    DEFAULT_MAX_FUTURE_MS,
    buildPluginCallbackSigningPayload,
    getCallbackAuthFields,
    signPluginCallback,
    verifyPluginCallbackAuth,
    verifyPluginCallbackRequest
};
