const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
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

    assert.notEqual(callbackAuthIndex, -1);
    assert.notEqual(defaultJsonParserIndex, -1);
    assert.notEqual(callbackRouteIndex, -1);
    assert.notEqual(nonceReplayGuardIndex, -1);
    assert.ok(callbackAuthIndex < defaultJsonParserIndex);
    assert.ok(defaultJsonParserIndex < callbackRouteIndex);
});
