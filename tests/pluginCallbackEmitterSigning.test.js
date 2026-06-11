const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('known JavaScript plugin callback emitters generate signed callback URLs', () => {
    const agentAssistantSource = read('Plugin/AgentAssistant/AgentAssistant.js');
    const magiAgentSource = read('Plugin/MagiAgent/MagiAgent.js');
    const powerShellExecutorSource = read('Plugin/PowerShellExecutor/PowerShellExecutor.js');
    const callbackTriggerSource = read('Plugin/LinuxLogMonitor/core/CallbackTrigger.js');

    for (const source of [
        agentAssistantSource,
        magiAgentSource,
        powerShellExecutorSource,
        callbackTriggerSource
    ]) {
        assert.match(source, /createSignedPluginCallbackUrl/);
    }
});

test('service callback emitters use scoped callback secret before legacy server key', () => {
    const agentAssistantSource = read('Plugin/AgentAssistant/AgentAssistant.js');
    const magiAgentSource = read('Plugin/MagiAgent/MagiAgent.js');

    assert.match(
        agentAssistantSource,
        /secret:\s*process\.env\.CALLBACK_AUTH_SECRET\s*\|\|\s*process\.env\.PLUGIN_CALLBACK_SECRET\s*\|\|\s*VCP_SERVER_ACCESS_KEY/
    );
    assert.match(
        magiAgentSource,
        /secret:\s*process\.env\.CALLBACK_AUTH_SECRET\s*\|\|\s*process\.env\.PLUGIN_CALLBACK_SECRET\s*\|\|\s*serverConfig\.PLUGIN_CALLBACK_SECRET\s*\|\|\s*serverConfig\.Key/
    );
});

test('MagiAgent preserves configured public callback base before local fallback', () => {
    const magiAgentSource = read('Plugin/MagiAgent/MagiAgent.js');
    const configuredIndex = magiAgentSource.indexOf('serverConfig.CALLBACK_BASE_URL ||');
    const localFallbackIndex = magiAgentSource.indexOf('buildLocalPluginCallbackBaseUrl(serverConfig.PORT || process.env.PORT || process.env.SERVER_PORT)');

    assert.notEqual(configuredIndex, -1);
    assert.notEqual(localFallbackIndex, -1);
    assert.ok(configuredIndex < localFallbackIndex);
});

test('video generator signs async callback URLs with callback auth secret', () => {
    const videoGeneratorSource = read('Plugin/VideoGenerator/video_handler.py');

    assert.match(videoGeneratorSource, /def build_plugin_callback_url/);
    assert.match(videoGeneratorSource, /CALLBACK_AUTH_SECRET/);
    assert.match(videoGeneratorSource, /vcp_cb_expires/);
    assert.match(videoGeneratorSource, /vcp_cb_nonce/);
    assert.match(videoGeneratorSource, /vcp_cb_sig/);
});

test('plugin manager provides callback scoped signing secret to async plugins', () => {
    const pluginManagerSource = read('Plugin.js');
    const runtimeSandboxSource = read('modules/pluginRuntimeEnvSandbox.js');

    assert.match(pluginManagerSource, /CALLBACK_AUTH_SECRET/);
    assert.match(pluginManagerSource, /PLUGIN_CALLBACK_URL/);
    assert.match(pluginManagerSource, /createSignedPluginCallbackUrl/);
    assert.match(pluginManagerSource, /plugin\.pluginType === 'asynchronous'/);
    assert.match(runtimeSandboxSource, /CALLBACK_AUTH_SECRET/);
    assert.match(runtimeSandboxSource, /PLUGIN_CALLBACK_URL/);
});
