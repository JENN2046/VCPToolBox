const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS,
} = require('../modules/aiImageNativeDelegateBindings');
const {
    createNativeDoubaoSecretlessRuntimeDelegate,
    SECRETLESS_SERUM_ALLOWED_SIZE,
} = require('../modules/nativeDoubaoSecretlessRuntimeDelegate');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('NativeDoubao delegate imports runtime metadata defaults and keeps size behavior local', () => {
    const source = read('modules/nativeDoubaoSecretlessRuntimeDelegate.js');

    assert.match(source, /SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS/);
    assert.doesNotMatch(source, /const\s+DEFAULT_REQUEST_SOURCE/);
    assert.doesNotMatch(source, /agent-image-lab-secretless-runtime/);
    assert.match(source, /const SECRETLESS_SERUM_ALLOWED_SIZE = '1920x1920'/);
    assert.match(source, /const SECRETLESS_SERUM_SIZE_OVERRIDE_KEYS = \[/);
    assert.match(source, /toolArgs\.size = SECRETLESS_SERUM_ALLOWED_SIZE/);
    assert.match(source, /pluginManager\.processToolCall\(\s*DOUBAO_TOOL_NAME,\s*toolArgs,\s*requestIp,\s*executionContext\s*\)/);
});

test('NativeDoubao delegate preserves explicit DoubaoGen model in tool args', async () => {
    const calls = [];
    const delegate = createNativeDoubaoSecretlessRuntimeDelegate({
        enabled: true,
        pluginManager: {
            async processToolCall(toolName, toolArgs, requestIp, executionContext) {
                calls.push({ toolName, toolArgs, requestIp, executionContext });
                return {
                    details: {
                        imageUrls: ['https://example.test/generated.png'],
                        model: toolArgs.model,
                    },
                };
            },
        },
    });

    const result = await delegate({
        toolName: 'DoubaoGen',
        toolArgs: {
            command: 'generate',
            prompt: 'seedream 5 passthrough',
            model: 'doubao-seedream-5-0-260128',
            resolution: '720x1280',
        },
        requestIp: '127.0.0.1',
        executionContext: {
            requestSource: 'ai-image-pipeline',
            taskId: 'AUTH-DRAFT-NATIVE-DOUBAO-SEEDREAM5-RETRY-20260526-003',
        },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].toolName, 'DoubaoGen');
    assert.equal(calls[0].toolArgs.model, 'doubao-seedream-5-0-260128');
    assert.equal(calls[0].toolArgs.command, 'generate');
    assert.equal(calls[0].toolArgs.size, SECRETLESS_SERUM_ALLOWED_SIZE);
    assert.equal(calls[0].toolArgs.resolution, undefined);
    assert.equal(
        calls[0].executionContext.requestSource,
        SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS.requestSource
    );
    assert.equal(
        calls[0].executionContext.providerBindingRefRedacted,
        SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS.providerBindingRefRedacted
    );
    assert.equal(
        calls[0].executionContext.bridgeId,
        SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS.bridgeId
    );
});

test('NativeDoubao delegate fixes secretless serum size and strips caller size overrides', async () => {
    const calls = [];
    const delegate = createNativeDoubaoSecretlessRuntimeDelegate({
        enabled: true,
        pluginManager: {
            async processToolCall(toolName, toolArgs, requestIp, executionContext) {
                calls.push({ toolName, toolArgs, requestIp, executionContext });
                return { details: { imageUrls: ['https://example.test/generated.png'] } };
            },
        },
    });

    const result = await delegate({
        toolName: 'DoubaoGen',
        toolArgs: {
            command: 'generate',
            prompt: 'seedream 5 fixed size',
            model: 'doubao-seedream-5-0-260128',
            resolution: '720x1280',
            Resolution: '1024x1024',
            size: '512x512',
            Size: '1K',
            image_size: '768x768',
            imageSize: 'adaptive',
        },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].toolArgs.size, SECRETLESS_SERUM_ALLOWED_SIZE);
    assert.equal(calls[0].toolArgs.resolution, undefined);
    assert.equal(calls[0].toolArgs.Resolution, undefined);
    assert.equal(calls[0].toolArgs.Size, undefined);
    assert.equal(calls[0].toolArgs.image_size, undefined);
    assert.equal(calls[0].toolArgs.imageSize, undefined);
});

test('NativeDoubao delegate fail-closed behavior remains unchanged', async () => {
    const disabled = createNativeDoubaoSecretlessRuntimeDelegate({
        enabled: false,
        pluginManager: {
            async processToolCall() {
                throw new Error('should_not_call_plugin_manager');
            },
        },
    });
    assert.deepEqual(await disabled({ toolArgs: { command: 'generate' } }), {
        ok: false,
        status: 'blocked',
        blocker: 'native_doubao_secretless_runtime_delegate_not_enabled',
        provider_contact_performed: false,
        plugin_call_performed: false,
        api_call_performed: false,
        image_generation_performed: false,
    });

    const missingPluginManager = createNativeDoubaoSecretlessRuntimeDelegate({
        enabled: true,
    });
    assert.equal(
        (await missingPluginManager({ toolArgs: { command: 'generate' } })).blocker,
        'native_doubao_secretless_runtime_delegate_plugin_manager_not_callable'
    );

    const delegate = createNativeDoubaoSecretlessRuntimeDelegate({
        enabled: true,
        pluginManager: {
            async processToolCall() {
                throw new Error('should_not_call_plugin_manager');
            },
        },
    });

    assert.equal(
        (await delegate({ toolName: 'OtherTool', toolArgs: { command: 'generate' } })).blocker,
        'native_doubao_secretless_runtime_delegate_tool_not_allowed'
    );
    assert.equal(
        (await delegate({ toolName: 'DoubaoGen', toolArgs: { command: 'delete' } })).blocker,
        'native_doubao_secretless_runtime_delegate_command_not_allowed'
    );
});
