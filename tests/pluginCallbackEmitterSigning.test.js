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
    assert.match(pluginManagerSource, /plugin\.pluginType === 'asynchronous'/);
    assert.match(runtimeSandboxSource, /CALLBACK_AUTH_SECRET/);
});
