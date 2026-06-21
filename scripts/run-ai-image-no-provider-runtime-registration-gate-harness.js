'use strict';

const path = require('path');

const {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV,
  buildAiImageAdapterRegistryPlan,
  summarizeDiagnosticsByCode
} = require('../modules/aiImageAdapterRegistry');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');

function addCheck(checks, label, ok, detail = 'ok') {
  checks.push({ label, ok: Boolean(ok), detail });
}

function firstAdapter(plan) {
  return plan.metadataAdapters[0] || null;
}

function main() {
  const checks = [];

  addCheck(
    checks,
    `${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV} unset in real process env`,
    !process.env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV],
    process.env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV] ? 'set' : 'unset'
  );
  addCheck(
    checks,
    `${VCP_AI_IMAGE_ADAPTER_DIRS_ENV} unset in real process env`,
    !process.env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV],
    process.env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV] ? 'set' : 'unset'
  );
  addCheck(
    checks,
    'ENABLE_AI_IMAGE_REAL_EXECUTION is not true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION !== 'true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION || 'unset'
  );
  addCheck(
    checks,
    'ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE is not true',
    process.env.ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE !== 'true',
    process.env.ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE || 'unset'
  );

  const defaultOffPlan = buildAiImageAdapterRegistryPlan({
    projectRoot: CORE_ROOT,
    env: {}
  });
  addCheck(checks, 'default-off metadata adapter count is zero', defaultOffPlan.metadataAdapters.length === 0, defaultOffPlan.metadataAdapters.length);
  addCheck(checks, 'default-off executable adapter count is zero', defaultOffPlan.executableAdapters.length === 0, defaultOffPlan.executableAdapters.length);

  const dirsOnlyPlan = buildAiImageAdapterRegistryPlan({
    projectRoot: CORE_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT
    }
  });
  addCheck(checks, 'dirs-only metadata adapter count is zero', dirsOnlyPlan.metadataAdapters.length === 0, dirsOnlyPlan.metadataAdapters.length);
  addCheck(checks, 'dirs-only executable adapter count is zero', dirsOnlyPlan.executableAdapters.length === 0, dirsOnlyPlan.executableAdapters.length);
  addCheck(
    checks,
    'dirs-only config is blocked by allow-root requirement',
    summarizeDiagnosticsByCode(dirsOnlyPlan.diagnostics).includes('ai_image_adapter_root_not_allowed:1'),
    summarizeDiagnosticsByCode(dirsOnlyPlan.diagnostics)
  );

  const scopedPlan = buildAiImageAdapterRegistryPlan({
    projectRoot: CORE_ROOT,
    env: {
      [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT
    }
  });
  const adapter = firstAdapter(scopedPlan);

  addCheck(checks, 'scoped env metadata adapter count is one', scopedPlan.metadataAdapters.length === 1, scopedPlan.metadataAdapters.length);
  addCheck(checks, 'scoped env executable adapter count is zero', scopedPlan.executableAdapters.length === 0, scopedPlan.executableAdapters.length);
  addCheck(checks, 'scoped env diagnostics are clean', summarizeDiagnosticsByCode(scopedPlan.diagnostics) === 'none', summarizeDiagnosticsByCode(scopedPlan.diagnostics));
  addCheck(checks, 'scoped env defaultEnabled remains false', adapter?.defaultEnabled === false, adapter?.defaultEnabled);
  addCheck(checks, 'scoped env secretsRequired remains true', adapter?.provider?.secretsRequired === true, adapter?.provider);
  addCheck(checks, 'scoped env runtime provider calls remain disabled', adapter?.provider?.runtimeProviderCallsAllowed === false, adapter?.provider);
  addCheck(checks, 'scoped env provider call count is zero', scopedPlan.providerCallCount === 0, scopedPlan.providerCallCount);
  addCheck(checks, 'scoped env image generation count is zero', scopedPlan.imageGenerationCount === 0, scopedPlan.imageGenerationCount);
  addCheck(checks, 'scoped env output write count is zero', scopedPlan.outputWriteCount === 0, scopedPlan.outputWriteCount);
  addCheck(checks, 'scoped env bridge call count is zero', scopedPlan.bridgeCallCount === 0, scopedPlan.bridgeCallCount);
  addCheck(checks, 'scoped env LocalState read count is zero', scopedPlan.localStateReadCount === 0, scopedPlan.localStateReadCount);

  const rollbackPlan = buildAiImageAdapterRegistryPlan({
    projectRoot: CORE_ROOT,
    env: {}
  });
  addCheck(checks, 'rollback default-off metadata adapter count is zero', rollbackPlan.metadataAdapters.length === 0, rollbackPlan.metadataAdapters.length);
  addCheck(checks, 'rollback default-off executable adapter count is zero', rollbackPlan.executableAdapters.length === 0, rollbackPlan.executableAdapters.length);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_GATE_PASS=yes');
  console.log(`EXTERNAL_ROOT=${EXTERNAL_ROOT}`);
  console.log(`AI_IMAGE_ADAPTERS_ROOT=${AI_IMAGE_ADAPTERS_ROOT}`);
  console.log(`DEFAULT_OFF_ADAPTER_COUNT=${defaultOffPlan.metadataAdapters.length}`);
  console.log(`DEFAULT_OFF_EXECUTABLE_ADAPTER_COUNT=${defaultOffPlan.executableAdapters.length}`);
  console.log(`DEFAULT_OFF_DIAGNOSTICS=${summarizeDiagnosticsByCode(defaultOffPlan.diagnostics)}`);
  console.log(`DIRS_ONLY_ADAPTER_METADATA_COUNT=${dirsOnlyPlan.metadataAdapters.length}`);
  console.log(`DIRS_ONLY_EXECUTABLE_ADAPTER_COUNT=${dirsOnlyPlan.executableAdapters.length}`);
  console.log(`DIRS_ONLY_DIAGNOSTICS=${summarizeDiagnosticsByCode(dirsOnlyPlan.diagnostics)}`);
  console.log(`SCOPED_ENV_ADAPTER_METADATA_COUNT=${scopedPlan.metadataAdapters.length}`);
  console.log(`SCOPED_ENV_EXECUTABLE_ADAPTER_COUNT=${scopedPlan.executableAdapters.length}`);
  console.log(`SCOPED_ENV_ADAPTER_ID=${adapter.adapterId}`);
  console.log(`SCOPED_ENV_DEFAULT_ENABLED=${adapter.defaultEnabled}`);
  console.log(`SCOPED_ENV_SECRETS_REQUIRED=${adapter.provider.secretsRequired}`);
  console.log(`SCOPED_ENV_RUNTIME_PROVIDER_CALLS_ALLOWED=${adapter.provider.runtimeProviderCallsAllowed}`);
  console.log(`SCOPED_ENV_PROVIDER_CALL_COUNT=${scopedPlan.providerCallCount}`);
  console.log(`SCOPED_ENV_IMAGE_GENERATION_COUNT=${scopedPlan.imageGenerationCount}`);
  console.log(`SCOPED_ENV_OUTPUT_WRITE_COUNT=${scopedPlan.outputWriteCount}`);
  console.log(`SCOPED_ENV_BRIDGE_CALL_COUNT=${scopedPlan.bridgeCallCount}`);
  console.log(`SCOPED_ENV_LOCALSTATE_READ_COUNT=${scopedPlan.localStateReadCount}`);
  console.log(`SCOPED_ENV_DIAGNOSTICS=${summarizeDiagnosticsByCode(scopedPlan.diagnostics)}`);
  console.log(`ROLLBACK_DEFAULT_OFF_ADAPTER_COUNT=${rollbackPlan.metadataAdapters.length}`);
  console.log(`ROLLBACK_DEFAULT_OFF_EXECUTABLE_ADAPTER_COUNT=${rollbackPlan.executableAdapters.length}`);
  console.log('REAL_CONFIG_ENV_MODIFIED=no');
  console.log(`ENABLE_AI_IMAGE_REAL_EXECUTION_TRUE=${process.env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true' ? 'yes' : 'no'}`);
  console.log('PRODUCTION_SERVER_STARTED=no');
  console.log('PROVIDER_CALL_EXECUTED=no');
  console.log('REAL_IMAGE_GENERATED=no');
  console.log('IMAGE_OUTPUT_WRITTEN=no');
  console.log('BRIDGE_WRITE_EXECUTED=no');
  console.log('LOCALSTATE_PRIVATE_READ=no');
  console.log('UPSTREAM_PR_OPENED=no');
}

main();
