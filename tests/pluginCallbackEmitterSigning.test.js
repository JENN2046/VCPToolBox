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

test('service callback emitters redact signed callback URLs before logging', () => {
    const agentAssistantSource = read('Plugin/AgentAssistant/AgentAssistant.js');
    const magiAgentSource = read('Plugin/MagiAgent/MagiAgent.js');

    for (const source of [agentAssistantSource, magiAgentSource]) {
        assert.match(source, /redactPluginCallbackUrlForLog/);
        assert.match(source, /const logCallbackUrl = redactPluginCallbackUrlForLog\(callbackUrl\);/);
    }
    assert.doesNotMatch(agentAssistantSource, /Sending callback for \$\{delegationId\} to \$\{callbackUrl\}/);
    assert.doesNotMatch(magiAgentSource, /Sending completion callback for meeting \$\{meeting\.id\} to \$\{callbackUrl\}/);
});

test('MagiAgent preserves configured public callback base before local fallback', () => {
    const magiAgentSource = read('Plugin/MagiAgent/MagiAgent.js');
    const configuredIndex = magiAgentSource.indexOf('serverConfig.CALLBACK_BASE_URL ||');
    const localFallbackIndex = magiAgentSource.indexOf('buildLocalPluginCallbackBaseUrl(serverConfig.PORT || process.env.PORT || process.env.SERVER_PORT)');

    assert.notEqual(configuredIndex, -1);
    assert.notEqual(localFallbackIndex, -1);
    assert.ok(configuredIndex < localFallbackIndex);
});

test('LinuxLogMonitor preserves configured callback base before local fallback', () => {
    const linuxLogMonitorSource = read('Plugin/LinuxLogMonitor/LinuxLogMonitor.js');
    const globalEnvConfiguredIndex = linuxLogMonitorSource.indexOf('process.env.CALLBACK_BASE_URL ||');
    const globalLocalFallbackIndex = linuxLogMonitorSource.indexOf('buildLocalPluginCallbackBaseUrl(process.env.SERVER_PORT || process.env.PORT)');
    const managerSource = linuxLogMonitorSource.slice(linuxLogMonitorSource.indexOf('function createMonitorManager()'));
    const configuredIndex = managerSource.indexOf('pluginConfig.CALLBACK_BASE_URL ||');
    const envConfiguredIndex = managerSource.indexOf('CALLBACK_BASE_URL ||');
    const localFallbackIndex = managerSource.indexOf('buildLocalPluginCallbackBaseUrl(process.env.SERVER_PORT || process.env.PORT)');

    assert.notEqual(globalEnvConfiguredIndex, -1);
    assert.notEqual(globalLocalFallbackIndex, -1);
    assert.notEqual(configuredIndex, -1);
    assert.notEqual(envConfiguredIndex, -1);
    assert.notEqual(localFallbackIndex, -1);
    assert.ok(globalEnvConfiguredIndex < globalLocalFallbackIndex);
    assert.ok(configuredIndex < localFallbackIndex);
    assert.ok(envConfiguredIndex < localFallbackIndex);
});

test('LinuxLogMonitor redacts signed callback query fields before logging', () => {
    const callbackTriggerSource = read('Plugin/LinuxLogMonitor/core/CallbackTrigger.js');
    const redactionFunctionIndex = callbackTriggerSource.indexOf('function redactCallbackUrlForLog');
    const logIndex = callbackTriggerSource.indexOf('this._log(`触发回调: ${redactCallbackUrlForLog(callbackUrl)}`);');
    const sendIndex = callbackTriggerSource.indexOf('this._sendRequest(callbackUrl, data)');

    assert.notEqual(redactionFunctionIndex, -1);
    assert.notEqual(logIndex, -1);
    assert.notEqual(sendIndex, -1);
    assert.match(callbackTriggerSource, /vcp_cb_sig/);
    assert.match(callbackTriggerSource, /vcp_cb_nonce/);
    assert.match(callbackTriggerSource, /vcp_cb_expires/);
    assert.ok(logIndex < sendIndex);
});

test('LinuxLogMonitor regenerates signed callback URL for each retry attempt', () => {
    const callbackTriggerSource = read('Plugin/LinuxLogMonitor/core/CallbackTrigger.js');
    const triggerSource = callbackTriggerSource.slice(
        callbackTriggerSource.indexOf('async trigger(taskId, data)'),
        callbackTriggerSource.indexOf('async retryFailedCallbacks()')
    );
    const loopIndex = triggerSource.indexOf('for (let attempt = 0; attempt <= this.maxRetries; attempt++)');
    const signedUrlIndex = triggerSource.indexOf('const callbackUrl = createSignedPluginCallbackUrl');
    const sendIndex = triggerSource.indexOf('this._sendRequest(callbackUrl, data)');

    assert.notEqual(loopIndex, -1);
    assert.notEqual(signedUrlIndex, -1);
    assert.notEqual(sendIndex, -1);
    assert.ok(loopIndex < signedUrlIndex);
    assert.ok(signedUrlIndex < sendIndex);
});

test('LinuxShellExecutor preserves configured callback base before local fallback', () => {
    const linuxShellExecutorSource = read('Plugin/LinuxShellExecutor/LinuxShellExecutor.js');
    const managerSource = linuxShellExecutorSource.slice(linuxShellExecutorSource.indexOf('this.monitorManager = new MonitorManager'));
    const configuredIndex = managerSource.indexOf('process.env.CALLBACK_BASE_URL ||');
    const localFallbackIndex = managerSource.indexOf('buildLocalPluginCallbackBaseUrl(process.env.SERVER_PORT || process.env.PORT)');

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

test('video generator redacts signed callback query fields before logging', () => {
    const videoGeneratorSource = read('Plugin/VideoGenerator/video_handler.py');
    const redactionFunctionIndex = videoGeneratorSource.indexOf('def redact_callback_url_for_log');
    const firstRedactedAssignmentIndex = videoGeneratorSource.indexOf('log_callback_url = redact_callback_url_for_log(callback_url)');
    const firstPostIndex = videoGeneratorSource.indexOf('requests.post(callback_url');

    assert.notEqual(redactionFunctionIndex, -1);
    assert.notEqual(firstRedactedAssignmentIndex, -1);
    assert.notEqual(firstPostIndex, -1);
    assert.match(videoGeneratorSource, /vcp_cb_sig/);
    assert.match(videoGeneratorSource, /vcp_cb_nonce/);
    assert.match(videoGeneratorSource, /vcp_cb_expires/);
    assert.doesNotMatch(videoGeneratorSource, /Callback to \{callback_url\}/);
    assert.doesNotMatch(videoGeneratorSource, /callback to \{callback_url\}/);
    assert.doesNotMatch(videoGeneratorSource, /PollingTimeout callback to \{callback_url\}/);
    assert.ok(firstRedactedAssignmentIndex < firstPostIndex);
});

test('plugin manager provides callback scoped signing secret to async plugins', () => {
    const pluginManagerSource = read('Plugin.js');
    const runtimeSandboxSource = read('modules/pluginRuntimeEnvSandbox.js');

    assert.match(pluginManagerSource, /CALLBACK_AUTH_SECRET/);
    assert.match(pluginManagerSource, /PLUGIN_CALLBACK_URL/);
    assert.match(pluginManagerSource, /createSignedPluginCallbackUrl/);
    assert.match(pluginManagerSource, /expiresAt:\s*Date\.now\(\)\s*\+\s*DEFAULT_MAX_FUTURE_MS/);
    assert.match(pluginManagerSource, /plugin\.pluginType === 'asynchronous'/);
    assert.match(runtimeSandboxSource, /CALLBACK_AUTH_SECRET/);
    assert.match(runtimeSandboxSource, /PLUGIN_CALLBACK_URL/);
});
