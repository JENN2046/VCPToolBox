const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    buildLocalPluginCallbackBaseUrl,
    createSignedPluginCallbackUrl,
    hasPluginCallbackProxyHeaders,
    signPluginCallback,
    verifyPluginCallbackAuth,
    verifyPluginCallbackRequest
} = require('../modules/pluginCallbackAuth');

test('plugin callback auth accepts a valid signed request', () => {
    const secret = 'callback-secret';
    const now = 1_000;
    const expiresAt = String(now + 60_000);
    const nonce = 'nonce-1';
    const signature = signPluginCallback({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        expiresAt,
        nonce
    });

    const result = verifyPluginCallbackAuth({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        expiresAt,
        nonce,
        signature,
        now
    });

    assert.equal(result.ok, true);
    assert.equal(result.expiresAt, now + 60_000);
    assert.equal(result.nonce, nonce);
});

test('plugin callback helper builds loopback callback base only for numeric ports', () => {
    assert.equal(
        buildLocalPluginCallbackBaseUrl('5890'),
        'http://127.0.0.1:5890/plugin-callback'
    );
    assert.equal(buildLocalPluginCallbackBaseUrl(''), '');
    assert.equal(buildLocalPluginCallbackBaseUrl('5890/path'), '');
});

test('plugin callback helper signs generated callback URLs', () => {
    const callbackUrl = createSignedPluginCallbackUrl({
        baseUrl: 'https://callback.example.test/plugin-callback',
        pluginName: 'Wan2.1VideoGen',
        taskId: 'video-1',
        secret: 'callback-secret',
        expiresAt: 61_000,
        nonce: 'nonce-1'
    });
    const parsed = new URL(callbackUrl);

    assert.equal(parsed.origin + parsed.pathname, 'https://callback.example.test/plugin-callback/Wan2.1VideoGen/video-1');
    assert.equal(parsed.searchParams.get('vcp_cb_expires'), '61000');
    assert.equal(parsed.searchParams.get('vcp_cb_nonce'), 'nonce-1');
    assert.equal(verifyPluginCallbackAuth({
        secret: 'callback-secret',
        pluginName: 'Wan2.1VideoGen',
        taskId: 'video-1',
        expiresAt: parsed.searchParams.get('vcp_cb_expires'),
        nonce: parsed.searchParams.get('vcp_cb_nonce'),
        signature: parsed.searchParams.get('vcp_cb_sig'),
        now: 1_000
    }).ok, true);
});

test('plugin callback auth rejects missing, expired, and tampered signatures', () => {
    const secret = 'callback-secret';
    const now = 1_000;
    const expiresAt = String(now + 60_000);
    const nonce = 'nonce-1';
    const signature = signPluginCallback({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        expiresAt,
        nonce
    });

    assert.equal(verifyPluginCallbackAuth({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        expiresAt,
        nonce,
        signature: '',
        now
    }).code, 'plugin_callback_auth_missing');

    assert.equal(verifyPluginCallbackAuth({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'task-1',
        expiresAt: String(now - 1),
        nonce,
        signature,
        now
    }).code, 'plugin_callback_auth_expired');

    assert.equal(verifyPluginCallbackAuth({
        secret,
        pluginName: 'AgentAssistant',
        taskId: 'other-task',
        expiresAt,
        nonce,
        signature,
        now
    }).code, 'plugin_callback_auth_invalid');
});

test('plugin callback auth reads query or header fields from requests', () => {
    const secret = 'callback-secret';
    const now = 1_000;
    const expiresAt = String(now + 60_000);
    const nonce = 'nonce-1';
    const signature = signPluginCallback({
        secret,
        pluginName: 'MagiAgent',
        taskId: 'meeting-1',
        expiresAt,
        nonce
    });

    assert.equal(verifyPluginCallbackRequest({
        params: {
            pluginName: 'MagiAgent',
            taskId: 'meeting-1'
        },
        query: {
            vcp_cb_expires: expiresAt,
            vcp_cb_nonce: nonce,
            vcp_cb_sig: signature
        },
        headers: {}
    }, { secret, now }).ok, true);

    assert.equal(verifyPluginCallbackRequest({
        params: {
            pluginName: 'MagiAgent',
            taskId: 'meeting-1'
        },
        query: {},
        headers: {
            'x-vcp-callback-expires': expiresAt,
            'x-vcp-callback-nonce': nonce,
            'x-vcp-callback-signature': signature
        }
    }, { secret, now }).ok, true);
});

test('plugin callback auth detects reverse proxy headers for loopback requests', () => {
    assert.equal(hasPluginCallbackProxyHeaders({ headers: {} }), false);
    assert.equal(hasPluginCallbackProxyHeaders({
        headers: {
            'x-forwarded-for': '203.0.113.10'
        }
    }), true);
    assert.equal(hasPluginCallbackProxyHeaders({
        headers: {
            Forwarded: 'for=203.0.113.10;proto=https'
        }
    }), true);
    assert.equal(hasPluginCallbackProxyHeaders({
        headers: {
            'x-real-ip': '203.0.113.10'
        }
    }), true);
});

test('server gates plugin callbacks before authenticated body parsers', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const callbackAuthIndex = serverSource.indexOf(
        "app.use('/plugin-callback/:pluginName/:taskId', authorizePluginCallbackRequest);"
    );
    const defaultJsonParserIndex = serverSource.indexOf(
        'app.use(createAuthenticatedJsonParser(DEFAULT_AUTHENTICATED_BODY_LIMIT));'
    );
    const callbackRouteIndex = serverSource.indexOf(
        "app.post('/plugin-callback/:pluginName/:taskId'"
    );
    const nonceReplayGuardIndex = serverSource.indexOf('function consumePluginCallbackNonce');
    const authFunctionIndex = serverSource.indexOf('function authorizePluginCallbackRequest');
    const verificationIndex = serverSource.indexOf('const verification = verifyPluginCallbackRequest');

    assert.notEqual(callbackAuthIndex, -1);
    assert.notEqual(defaultJsonParserIndex, -1);
    assert.notEqual(callbackRouteIndex, -1);
    assert.notEqual(nonceReplayGuardIndex, -1);
    assert.notEqual(authFunctionIndex, -1);
    assert.notEqual(verificationIndex, -1);
    assert.equal(serverSource.includes('isTrustedLocalPluginCallbackRequest'), false);
    assert.ok(authFunctionIndex < verificationIndex);
    assert.ok(callbackAuthIndex < defaultJsonParserIndex);
    assert.ok(defaultJsonParserIndex < callbackRouteIndex);
});
