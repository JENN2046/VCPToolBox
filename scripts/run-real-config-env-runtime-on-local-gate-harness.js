#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { createAgentRootResolver } = require('../modules/agentRootResolver');
const { createPluginRootResolver } = require('../modules/pluginRootResolver');

function requirePluginManagerQuietly() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  try {
    console.log = () => {};
    console.warn = () => {};
    return require('../Plugin.js');
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

const pluginManager = requirePluginManagerQuietly();

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');

const RUNTIME_ENV_KEYS = Object.freeze([
  'VCP_PLUGIN_ALLOWED_ROOTS',
  'VCP_PLUGIN_DIRS',
  'VCP_PLUGIN_INSTALL_DIR',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST',
  'VCP_AGENT_ALLOWED_ROOTS',
  'VCP_AGENT_DIRS',
  'VCP_AGENT_OVERRIDE_DIRS',
  'VCP_ADMIN_EXTENSION_DIRS',
  'VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS',
  'VCP_AI_IMAGE_ADAPTER_DIRS',
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS',
  'VCP_CODEX_MEMORY_BRIDGE_DIRS',
  'ENABLE_CODEX_MEMORY_LIVE_WRITE',
  'VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS',
  'VCP_PHOTOSTUDIO_PACKAGE_DIRS',
  'ENABLE_PHOTOSTUDIO_AUTO_WRITE',
  'PHOTO_STUDIO_DATA_DIR',
  'VCP_LOCAL_STATE_DIR'
]);

const FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_CODEX_MEMORY_LIVE_WRITE',
  'ENABLE_PHOTOSTUDIO_AUTO_WRITE'
]);

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function readRealConfigEnv() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return { exists: false, env: {} };
  }

  const parsed = dotenv.parse(fs.readFileSync(CONFIG_ENV_PATH, 'utf8'));
  return { exists: true, env: parsed };
}

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function countDiagnosticsByCode(diagnostics) {
  const counts = new Map();
  for (const diagnostic of diagnostics || []) {
    const code = diagnostic?.code || 'unknown';
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}:${count}`)
    .join(',') || 'none';
}

function withScopedRuntimeEnv(env, run) {
  const keys = ['VCP_EXTERNAL_PLUGIN_ALLOWLIST'];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (isSet(env, key)) process.env[key] = env[key];
    else delete process.env[key];
  }

  try {
    return run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function evaluateExternalPluginRuntime(env) {
  const resolver = createPluginRootResolver({
    projectRoot: CORE_ROOT,
    env
  });
  const snapshot = resolver.getPluginRootSnapshotSync();
  const manifests = [];

  for (const rootInfo of snapshot.externalLegacyRoots) {
    const discovered = await pluginManager._discoverLegacyPluginManifestsFromDir(
      rootInfo.rootPath,
      rootInfo.source,
      rootInfo
    );
    manifests.push(...discovered);
  }

  const decisions = withScopedRuntimeEnv(env, () => manifests.map((manifest) => (
    pluginManager._evaluateExternalPluginRuntimeRegistration(manifest)
  )));
  const allowedCount = decisions.filter((decision) => decision.allowed).length;
  const blockedCount = decisions.length - allowedCount;
  const blockedCodes = countDiagnosticsByCode(decisions
    .filter((decision) => !decision.allowed)
    .map((decision) => ({ code: decision.code || 'external_runtime_registration_blocked' })));

  return {
    snapshot,
    manifestCount: manifests.length,
    allowedCount,
    blockedCount,
    blockedCodes
  };
}

function evaluateAgentRuntime(env) {
  const resolver = createAgentRootResolver({
    projectRoot: CORE_ROOT,
    env,
    coreAgentRoot: path.join(CORE_ROOT, 'Agent')
  });
  const plan = resolver.getAgentFilePlanSync();

  return {
    externalAdditiveRootCount: plan.snapshot.externalAdditiveRoots.length,
    externalOverrideRootCount: plan.snapshot.externalOverrideRoots.length,
    additiveFileCount: plan.additiveFiles.length,
    overrideFileCount: plan.overrideFiles.length,
    effectiveAgentCount: plan.effectiveAgents.length,
    skippedFileCount: plan.skippedFiles.length,
    diagnosticCodes: countDiagnosticsByCode(plan.diagnostics)
  };
}

function shutdownPluginManager() {
  if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
    pluginManager.toolApprovalManager.shutdown();
  }
}

async function main() {
  const { exists, env } = readRealConfigEnv();
  const lines = [];
  const failures = [];

  lines.push('REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE');
  lines.push(`CONFIG_ENV_EXISTS=${exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push('CONFIG_ENV_FILE_MODIFIED=no');

  if (!exists) {
    failures.push('config_env_missing');
  }

  for (const key of RUNTIME_ENV_KEYS) {
    lines.push(`ENV_${key}_SET=${isSet(env, key) ? 'yes' : 'no'}`);
  }

  for (const key of FORBIDDEN_TRUE_FLAGS) {
    if (isTruthy(env[key])) {
      failures.push(`${key.toLowerCase()}_true`);
    }
  }

  const pluginRuntime = await evaluateExternalPluginRuntime(env);
  lines.push(`PLUGIN_EXTERNAL_ROOT_COUNT=${pluginRuntime.snapshot.externalLegacyRoots.length}`);
  lines.push(`PLUGIN_ROOT_DIAGNOSTIC_CODES=${countDiagnosticsByCode(pluginRuntime.snapshot.diagnostics)}`);
  lines.push(`PLUGIN_EXTERNAL_MANIFEST_COUNT=${pluginRuntime.manifestCount}`);
  lines.push(`PLUGIN_RUNTIME_ALLOWED_COUNT=${pluginRuntime.allowedCount}`);
  lines.push(`PLUGIN_RUNTIME_BLOCKED_COUNT=${pluginRuntime.blockedCount}`);
  lines.push(`PLUGIN_RUNTIME_BLOCKED_CODES=${pluginRuntime.blockedCodes}`);

  const agentRuntime = evaluateAgentRuntime(env);
  lines.push(`AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=${agentRuntime.externalAdditiveRootCount}`);
  lines.push(`AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=${agentRuntime.externalOverrideRootCount}`);
  lines.push(`AGENT_ADDITIVE_FILE_COUNT=${agentRuntime.additiveFileCount}`);
  lines.push(`AGENT_OVERRIDE_FILE_COUNT=${agentRuntime.overrideFileCount}`);
  lines.push(`AGENT_EFFECTIVE_FILE_COUNT=${agentRuntime.effectiveAgentCount}`);
  lines.push(`AGENT_SKIPPED_FILE_COUNT=${agentRuntime.skippedFileCount}`);
  lines.push(`AGENT_DIAGNOSTIC_CODES=${agentRuntime.diagnosticCodes}`);

  const implementedRuntimeLaneEnabled = pluginRuntime.allowedCount > 0
    || agentRuntime.externalAdditiveRootCount > 0
    || agentRuntime.externalOverrideRootCount > 0;
  if (!implementedRuntimeLaneEnabled) {
    failures.push('no_implemented_runtime_lane_enabled_by_real_config_env');
  }
  if (pluginRuntime.snapshot.diagnostics.length > 0) {
    failures.push('plugin_root_diagnostics_present');
  }
  if (agentRuntime.diagnosticCodes !== 'none') {
    failures.push('agent_root_diagnostics_present');
  }

  lines.push('SERVER_STARTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('PHOTO_STUDIO_PROJECT_DATA_READ=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_BLOCK');
    lines.push(`BLOCK_REASONS=${failures.sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main()
  .catch((error) => {
    process.stdout.write('REAL_CONFIG_ENV_RUNTIME_ON_LOCAL_GATE_BLOCK\n');
    process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
    process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    shutdownPluginManager();
  });
