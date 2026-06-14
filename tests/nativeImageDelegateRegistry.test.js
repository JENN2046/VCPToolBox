const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const bindings = require('../modules/aiImageNativeDelegateBindings');
const {
    createNativeImageDelegateRegistry,
    registerSerumBottleSecretlessDoubaoDelegate,
    SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
    SERUM_BOTTLE_SECRETLESS_PROVIDER_ID,
    SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
    SERUM_BOTTLE_SECRETLESS_API_ID,
    SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND,
    SERUM_BOTTLE_SECRETLESS_ALLOWED_COMMANDS,
} = require('../modules/nativeImageDelegateRegistry');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('AI image native delegate bindings are frozen side-effect-free static data', () => {
    const source = read('modules/aiImageNativeDelegateBindings.js');
    const bindingAggregate = bindings.AI_IMAGE_NATIVE_DELEGATE_BINDINGS;
    const metadataAggregate = bindings.AI_IMAGE_NATIVE_DELEGATE_RUNTIME_METADATA_DEFAULTS;
    const binding = bindings.SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING;
    const runtimeMetadataDefaults =
        bindings.SERUM_BOTTLE_SECRETLESS_DOUBAO_RUNTIME_METADATA_DEFAULTS;

    assert.equal(Object.isFrozen(bindings), true);
    assert.equal(Object.isFrozen(bindingAggregate), true);
    assert.equal(Object.isFrozen(metadataAggregate), true);
    assert.equal(Object.isFrozen(binding), true);
    assert.equal(Object.isFrozen(binding.allowedCommands), true);
    assert.equal(Object.isFrozen(runtimeMetadataDefaults), true);
    assert.equal(bindingAggregate.serumBottleSecretlessDoubao, binding);
    assert.equal(
        metadataAggregate.serumBottleSecretlessDoubao,
        runtimeMetadataDefaults
    );
    assert.equal(binding.delegateId, 'serum_bottle_secretless_doubao_v1');
    assert.equal(binding.providerId, 'doubao');
    assert.equal(binding.pluginId, 'DoubaoGen');
    assert.equal(binding.apiId, 'generate_image');
    assert.equal(binding.internalCommand, 'generate');
    assert.deepEqual(binding.allowedCommands, ['generate', 'edit', 'compose', 'group']);
    assert.deepEqual(runtimeMetadataDefaults, {
        requestSource: 'agent-image-lab-secretless-runtime',
        bridgeId: 'native_doubao_secretless_runtime_delegate',
        providerBindingRefRedacted: true,
    });
    assert.match(source, /Core adapter binding data/);
    assert.match(source, /external AI Image adapter layer/);
    assert.doesNotMatch(
        source,
        /process\.env|require\('fs'\)|require\("fs"\)|PluginManager|processToolCall|express|listen|writeFile|readFile|1920x1920|SECRETLESS_SERUM_ALLOWED_SIZE/
    );
});

test('native image delegate registry imports Jenn binding data instead of defining literals', () => {
    const source = read('modules/nativeImageDelegateRegistry.js');

    assert.match(source, /require\('\.\/aiImageNativeDelegateBindings'\)/);
    assert.doesNotMatch(source, /'serum_bottle_secretless_doubao_v1'/);
    assert.doesNotMatch(source, /'doubao'/);
    assert.doesNotMatch(source, /'DoubaoGen'/);
    assert.doesNotMatch(source, /'generate_image'/);
    assert.doesNotMatch(source, /const\s+SERUM_BOTTLE_SECRETLESS/);
});

test('native image delegate registry keeps backward-compatible Jenn binding exports', () => {
    const binding = bindings.SERUM_BOTTLE_SECRETLESS_DOUBAO_BINDING;

    assert.equal(SERUM_BOTTLE_SECRETLESS_DELEGATE_ID, binding.delegateId);
    assert.equal(SERUM_BOTTLE_SECRETLESS_PROVIDER_ID, binding.providerId);
    assert.equal(SERUM_BOTTLE_SECRETLESS_PLUGIN_ID, binding.pluginId);
    assert.equal(SERUM_BOTTLE_SECRETLESS_API_ID, binding.apiId);
    assert.equal(SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND, binding.internalCommand);
    assert.equal(SERUM_BOTTLE_SECRETLESS_ALLOWED_COMMANDS, binding.allowedCommands);
});

test('registerSerumBottleSecretlessDoubaoDelegate behavior remains unchanged', async () => {
    const calls = [];
    const registry = createNativeImageDelegateRegistry();
    registerSerumBottleSecretlessDoubaoDelegate(
        registry,
        async (request) => {
            calls.push(request);
            return {
                ok: true,
                status: 'completed',
                result: { details: { imageUrls: ['https://example.test/one.png'] } },
                provider_contact_performed: true,
                plugin_call_performed: true,
                api_call_performed: true,
                image_generation_performed: true,
            };
        },
        { enabled: true }
    );

    assert.equal(registry.hasCallable(SERUM_BOTTLE_SECRETLESS_DELEGATE_ID), true);

    const result = await registry.invokeBoundDelegate({
        delegateId: SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
        providerId: SERUM_BOTTLE_SECRETLESS_PROVIDER_ID,
        pluginId: SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
        apiId: SERUM_BOTTLE_SECRETLESS_API_ID,
        internalCommand: SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND,
    }, {
        toolArgs: { command: SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(result.delegateEvidence, {
        delegateId: SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
        providerId: SERUM_BOTTLE_SECRETLESS_PROVIDER_ID,
        pluginId: SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
        apiId: SERUM_BOTTLE_SECRETLESS_API_ID,
        internalCommand: SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND,
    });
});

test('native image delegate registry mismatch checks still fail closed', async () => {
    let callCount = 0;
    const registry = createNativeImageDelegateRegistry();
    registerSerumBottleSecretlessDoubaoDelegate(
        registry,
        async () => {
            callCount += 1;
            return { ok: true };
        },
        { enabled: true }
    );

    const result = await registry.invokeBoundDelegate({
        delegateId: SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
        providerId: 'wrong-provider',
        pluginId: SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
    }, {
        toolArgs: { command: SERUM_BOTTLE_SECRETLESS_INTERNAL_COMMAND },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 'blocked');
    assert.equal(result.blocker, 'native_image_delegate_registry_binding_mismatch');
    assert.deepEqual(result.mismatches, ['providerId']);
    assert.equal(callCount, 0);
});

test('native image delegate registry allowed commands behavior remains unchanged', async () => {
    const calls = [];
    const registry = createNativeImageDelegateRegistry();
    registerSerumBottleSecretlessDoubaoDelegate(
        registry,
        async (request) => {
            calls.push(request);
            return { ok: true, status: 'completed' };
        },
        { enabled: true }
    );

    const allowed = await registry.invokeBoundDelegate({
        delegateId: SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
        providerId: SERUM_BOTTLE_SECRETLESS_PROVIDER_ID,
        pluginId: SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
    }, {
        toolArgs: { command: 'edit' },
    });

    const blocked = await registry.invokeBoundDelegate({
        delegateId: SERUM_BOTTLE_SECRETLESS_DELEGATE_ID,
        providerId: SERUM_BOTTLE_SECRETLESS_PROVIDER_ID,
        pluginId: SERUM_BOTTLE_SECRETLESS_PLUGIN_ID,
    }, {
        toolArgs: { command: 'unknown' },
    });

    assert.equal(allowed.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.blocker, 'native_image_delegate_registry_command_not_allowed');
    assert.deepEqual(blocked.allowedCommands, ['generate', 'edit', 'compose', 'group']);
});
