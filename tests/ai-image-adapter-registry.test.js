'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV,
  buildAiImageAdapterRegistryPlan,
  summarizeDiagnosticsByCode
} = require('../modules/aiImageAdapterRegistry');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');
const PACKAGE_ROOT = path.join(AI_IMAGE_ADAPTERS_ROOT, 'JennImageProviderAdapter');

test('AI Image adapter registry is default-off when env is unset', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {}
  });

  assert.strictEqual(plan.runtimeEnabled, false);
  assert.strictEqual(plan.metadataRegistryEnabled, false);
  assert.strictEqual(plan.allowedRootCount, 0);
  assert.strictEqual(plan.adapterDirCount, 0);
  assert.strictEqual(plan.discoveredAdapters.length, 0);
  assert.strictEqual(plan.metadataAdapters.length, 0);
  assert.strictEqual(plan.executableAdapters.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /ai_image_adapter_runtime_required_env_missing:1/);
});

test('AI Image adapter registry does not register dirs-only config', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT
    }
  });

  assert.strictEqual(plan.runtimeEnabled, false);
  assert.strictEqual(plan.metadataRegistryEnabled, false);
  assert.strictEqual(plan.allowedRootCount, 0);
  assert.strictEqual(plan.adapterDirCount, 1);
  assert.strictEqual(plan.metadataAdapters.length, 0);
  assert.strictEqual(plan.executableAdapters.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /ai_image_adapter_root_not_allowed:1/);
});

test('AI Image adapter registry rejects adapter roots inside the core project', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: PROJECT_ROOT,
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: path.join(PROJECT_ROOT, 'modules')
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.metadataAdapters.length, 0);
  assert.strictEqual(plan.executableAdapters.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /ai_image_adapter_root_unsafe:1/);
});

test('AI Image adapter registry discovers reviewed metadata from adapter parent root', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.metadataRegistryEnabled, true);
  assert.strictEqual(plan.allowedRootCount, 1);
  assert.strictEqual(plan.adapterDirCount, 1);
  assert.strictEqual(plan.discoveredAdapters.length, 1);
  assert.strictEqual(plan.metadataAdapters.length, 1);
  assert.strictEqual(plan.executableAdapters.length, 0);

  const adapter = plan.metadataAdapters[0];
  assert.strictEqual(adapter.adapterId, 'jenn.ai-image.provider-adapter');
  assert.strictEqual(adapter.displayName, 'Jenn AI Image Provider Adapter');
  assert.strictEqual(adapter.defaultEnabled, false);
  assert.strictEqual(adapter.provider.providerSpecific, true);
  assert.strictEqual(adapter.provider.secretsRequired, true);
  assert.strictEqual(adapter.provider.runtimeProviderCallsAllowed, false);
  assert.deepStrictEqual(adapter.capabilities, ['generate_image']);
  assert.strictEqual(adapter.entry.relativePath, 'src/index.js');
  assert.strictEqual(adapter.entry.exists, true);
  assert.strictEqual(adapter.entry.safeFile, true);
  assert.strictEqual(adapter.bindings.length, 1);
  assert.strictEqual(adapter.bindings[0].redacted, true);
  assert.strictEqual(adapter.bindings[0].safeFile, true);
  assert.strictEqual(adapter.fixtures.noProviderDryRunPlan.exists, true);
  assert.strictEqual(adapter.fixtures.noProviderDryRunPlan.safeFile, true);
  assert.strictEqual(adapter.fixtures.expectedResult.exists, true);
  assert.strictEqual(adapter.fixtures.expectedResult.safeFile, true);
  assert.strictEqual(adapter.metadataRegistered, true);
  assert.strictEqual(adapter.executable, false);
  assert.strictEqual(adapter.executionBlockedReason, 'no_provider_default_off');
  assert.strictEqual(plan.providerCallCount, 0);
  assert.strictEqual(plan.imageGenerationCount, 0);
  assert.strictEqual(plan.outputWriteCount, 0);
  assert.strictEqual(plan.bridgeCallCount, 0);
  assert.strictEqual(plan.localStateReadCount, 0);
  assert.strictEqual(summarizeDiagnosticsByCode(plan.diagnostics), 'none');
});

test('AI Image adapter registry discovers reviewed metadata from package root', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: PACKAGE_ROOT
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.metadataAdapters.length, 1);
  assert.strictEqual(plan.metadataAdapters[0].adapterId, 'jenn.ai-image.provider-adapter');
  assert.strictEqual(plan.executableAdapters.length, 0);
  assert.strictEqual(summarizeDiagnosticsByCode(plan.diagnostics), 'none');
});

test('AI Image adapter registry keeps metadata non-executable under scoped env', () => {
  const plan = buildAiImageAdapterRegistryPlan({
    projectRoot: PROJECT_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT
    }
  });

  assert.strictEqual(plan.metadataAdapters.length, 1);
  assert.deepStrictEqual(plan.executableAdapters, []);
  assert.strictEqual(plan.metadataAdapters[0].permissions.providerCalls, false);
  assert.strictEqual(plan.metadataAdapters[0].permissions.imageGeneration, false);
  assert.strictEqual(plan.metadataAdapters[0].permissions.externalWrites, false);
  assert.strictEqual(plan.metadataAdapters[0].permissions.bridgeCalls, false);
  assert.strictEqual(plan.metadataAdapters[0].permissions.localStateReads, false);
});
