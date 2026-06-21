#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const http = require('http');
const Module = require('module');
const path = require('path');
const dotenv = require('dotenv');

const {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV
} = require('../modules/aiImageAdapterRegistry');
const {
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH
} = require('../routes/admin/aiImageAdapterDiagnostics');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const SERVER_JS_PATH = path.join(CORE_ROOT, 'server.js');
const ADMIN_PANEL_ROUTES_PATH = path.join(CORE_ROOT, 'routes', 'adminPanelRoutes.js');
const ADMIN_ROUTES_DIR = path.join(CORE_ROOT, 'routes', 'admin');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');

const MANAGED_KEYS = Object.freeze([
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV
]);

const GUARD_KEYS = Object.freeze([
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_AI_IMAGE_AGENTS_ROUTE',
  'ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE',
  'VCP_AGENT_DIRS'
]);

const PROCESS_ENV_KEYS = Object.freeze([
  ...MANAGED_KEYS,
  ...GUARD_KEYS
]);

const CORE_HASH_TARGETS = Object.freeze([
  SERVER_JS_PATH,
  ADMIN_PANEL_ROUTES_PATH,
  path.join(CORE_ROOT, 'modules', 'aiImageAdapterDiagnosticRuntimeMount.js'),
  path.join(CORE_ROOT, 'routes', 'admin', 'aiImageAdapterDiagnostics.js')
]);

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hashFile(filePath) {
  return fs.existsSync(filePath)
    ? hashBuffer(fs.readFileSync(filePath))
    : 'missing';
}

function readRegularConfig() {
  const stat = fs.lstatSync(CONFIG_ENV_PATH);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error('config_env_not_regular_file');
    error.code = 'config_env_not_regular_file';
    throw error;
  }
  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  return {
    raw,
    hash: hashBuffer(raw),
    text: raw.toString('utf8')
  };
}

function parseEnvText(text) {
  return dotenv.parse(Buffer.from(text, 'utf8'));
}

function countKeyLines(text, key) {
  const pattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'm');
  return text.split(/\r?\n/).filter((line) => pattern.test(line)).length;
}

function countManagedKeyLines(text) {
  return Object.fromEntries(MANAGED_KEYS.map((key) => [key, countKeyLines(text, key)]));
}

function getLineEnding(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function buildAppliedConfigText(originalText) {
  const newline = getLineEnding(originalText);
  const withoutTrailingNewlines = originalText.replace(/(?:\r?\n)*$/, '');
  const prefix = withoutTrailingNewlines ? `${withoutTrailingNewlines}${newline}${newline}` : '';
  return [
    `${prefix}# M82 AI Image diagnostic metadata route gate`,
    `${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV}=true`,
    `${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV}=${EXTERNAL_ROOT}`,
    `${VCP_AI_IMAGE_ADAPTER_DIRS_ENV}=${AI_IMAGE_ADAPTERS_ROOT}`,
    ''
  ].join(newline);
}

function captureProcessEnv(keys) {
  return Object.fromEntries(keys.map((key) => [
    key,
    Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined
  ]));
}

function restoreProcessEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function applyConfigToProcessEnv(configEnv, extra = {}) {
  for (const key of PROCESS_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(configEnv, key)) {
      process.env[key] = configEnv[key];
    } else {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function listFiles(rootPath) {
  const files = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function snapshotHashes(paths) {
  return new Map(paths.map((filePath) => [filePath, hashFile(filePath)]));
}

function hashesUnchanged(before, after) {
  for (const [filePath, hash] of before.entries()) {
    if (after.get(filePath) !== hash) return false;
  }
  return true;
}

function createPluginManagerStub() {
  return {
    plugins: new Map(),
    getPlugin: () => null,
    getServiceModule: () => null,
    getPluginRootSnapshot: () => [],
    loadPlugins: async () => {},
    getPreprocessorOrder: () => [],
    hotReloadPluginsAndOrder: async () => [],
    getAllPlaceholderValues: () => ({}),
    getIndividualPluginDescriptions: () => ({}),
    getResolvedPluginConfigValue: () => null,
    getPlaceholderValue: () => null
  };
}

function withAdminSubmoduleStubs(callback) {
  const originalLoad = Module._load;
  let stubbedModuleCount = 0;

  Module._load = function loadWithAdminRouteStubs(request, parent, isMain) {
    let resolved;
    try {
      resolved = Module._resolveFilename(request, parent, isMain);
    } catch {
      return originalLoad.apply(this, arguments);
    }

    const isAdminRouteModule = resolved.startsWith(`${ADMIN_ROUTES_DIR}${path.sep}`)
      && resolved.endsWith('.js')
      && !resolved.includes(`${path.sep}lib${path.sep}`)
      && path.basename(resolved) !== 'aiImageAdapterDiagnostics.js';

    if (isAdminRouteModule) {
      stubbedModuleCount += 1;
      return function createStubbedAdminRoute() {
        return express.Router();
      };
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return callback(() => stubbedModuleCount);
  } finally {
    Module._load = originalLoad;
  }
}

function createAdminPanelRouterWithStubs() {
  delete require.cache[require.resolve(ADMIN_PANEL_ROUTES_PATH)];

  return withAdminSubmoduleStubs((getStubbedModuleCount) => {
    const createAdminPanelRoutes = require(ADMIN_PANEL_ROUTES_PATH);
    const router = createAdminPanelRoutes(
      false,
      path.join(CORE_ROOT, 'DailyNote'),
      createPluginManagerStub(),
      () => path.join(CORE_ROOT, 'DebugLog', 'server.log'),
      {},
      path.join(CORE_ROOT, 'Agent'),
      [],
      path.join(CORE_ROOT, 'TVStxt'),
      () => {},
      {},
      {},
      '',
      '',
      CORE_ROOT
    );
    return {
      router,
      stubbedModuleCount: getStubbedModuleCount()
    };
  });
}

async function startLocalTestServer(router, options = {}) {
  const app = express();
  let authProbeHits = 0;
  app.use('/admin_api', (req, _res, next) => {
    if (options.markAdminAuth !== false) {
      authProbeHits += 1;
      req.adminAuthBoundaryReached = true;
    }
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getAuthProbeHits: () => authProbeHits,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function fetchDiagnostic(baseUrl, options = {}) {
  const response = await fetch(`${baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, options);
  let body = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function runHttpScenario(router, options = {}) {
  const server = await startLocalTestServer(router, options);
  try {
    const getResult = await fetchDiagnostic(server.baseUrl);
    const postResult = await fetchDiagnostic(server.baseUrl, { method: 'POST' });
    return {
      authProbeHits: server.getAuthProbeHits(),
      getStatus: getResult.status,
      getBody: getResult.body,
      postStatus: postResult.status
    };
  } finally {
    await server.close();
  }
}

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      visitor(key, nested);
      walk(nested, visitor);
    }
  }
}

function countAbsolutePathValues(value) {
  let count = 0;
  walk(value, (_key, nested) => {
    if (typeof nested === 'string' && /(?:[A-Za-z]:[\\/]|\\\\|\/AGENTS_OS_Workspace\/)/.test(nested)) {
      count += 1;
    }
  });
  return count;
}

function countForbiddenFieldNames(value) {
  const forbidden = new Set([
    'absolutePath',
    'packageRoot',
    'packageDisplayPath',
    'manifestPath',
    'manifestDisplayPath',
    'rawBinding',
    'sourceCode',
    'prompt',
    'outputPath',
    'providerEndpoint',
    'credentialRef',
    'token',
    'password',
    'cookie',
    'authorization',
    'authHeader'
  ]);
  let count = 0;
  walk(value, (key) => {
    if (forbidden.has(key)) count += 1;
  });
  return count;
}

function summarizeRuntime(router) {
  const summary = router.aiImageAdapterDiagnosticRuntimeSummary || {};
  return {
    routeEnabled: summary.routeEnabled === true,
    mountedRouteCount: summary.mountedRouteCount || 0,
    diagnosticCodes: (summary.diagnostics || []).map((diagnostic) => diagnostic.code || 'unknown').sort().join(',') || 'none'
  };
}

function allCountsZero(counts) {
  return Object.values(counts).every((count) => count === 0);
}

async function main() {
  const lines = [];
  const failures = [];
  const processEnvBefore = captureProcessEnv(PROCESS_ENV_KEYS);
  let originalConfig = null;
  let appliedConfigHash = 'not_written';
  let finalConfigHash = 'missing';
  let finalCounts = {};
  let restoredOriginal = false;

  function restoreOriginalConfig() {
    if (originalConfig) {
      fs.writeFileSync(CONFIG_ENV_PATH, originalConfig.raw);
      restoredOriginal = hashFile(CONFIG_ENV_PATH) === originalConfig.hash;
    }
  }

  try {
    originalConfig = readRegularConfig();
    const initialCounts = countManagedKeyLines(originalConfig.text);
    const initialEnv = parseEnvText(originalConfig.text);
    const coreBefore = snapshotHashes(CORE_HASH_TARGETS);
    const externalPackageFiles = listFiles(AI_IMAGE_ADAPTERS_ROOT);
    const externalBefore = snapshotHashes(externalPackageFiles);

    lines.push('AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL');
    lines.push('M82_FINAL_STATE=OPTION_B_REMOVED_AFTER_ROLLBACK');
    lines.push('CONFIG_ENV_EXISTS=yes');
    lines.push('CONFIG_ENV_VALUES_PRINTED=no');
    lines.push(`CONFIG_ENV_INITIAL_SHA256=${originalConfig.hash}`);
    lines.push(`INITIAL_${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV}_LINE_COUNT=${initialCounts[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]}`);
    lines.push(`INITIAL_${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV}_LINE_COUNT=${initialCounts[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]}`);
    lines.push(`INITIAL_${VCP_AI_IMAGE_ADAPTER_DIRS_ENV}_LINE_COUNT=${initialCounts[VCP_AI_IMAGE_ADAPTER_DIRS_ENV]}`);
    lines.push(`INITIAL_ENABLE_AI_IMAGE_REAL_EXECUTION_LINE_COUNT=${countKeyLines(originalConfig.text, 'ENABLE_AI_IMAGE_REAL_EXECUTION')}`);

    if (!fs.existsSync(AI_IMAGE_ADAPTERS_ROOT)) failures.push('external_ai_image_adapters_root_missing');
    if (!allCountsZero(initialCounts)) failures.push('managed_keys_already_present_in_real_config');
    if (initialEnv.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true') failures.push('initial_real_execution_true_in_real_config');

    applyConfigToProcessEnv(initialEnv);
    const preApply = createAdminPanelRouterWithStubs();
    const preApplySummary = summarizeRuntime(preApply.router);
    const preApplyHttp = await runHttpScenario(preApply.router);
    lines.push(`PRE_APPLY_ROUTE_ENABLED=${preApplySummary.routeEnabled ? 'yes' : 'no'}`);
    lines.push(`PRE_APPLY_MOUNTED_ROUTE_COUNT=${preApplySummary.mountedRouteCount}`);
    lines.push(`PRE_APPLY_ROUTE_STATUS=${preApplyHttp.getStatus}`);
    lines.push(`PRE_APPLY_DIAGNOSTIC_CODES=${preApplySummary.diagnosticCodes}`);
    if (preApplySummary.routeEnabled) failures.push('pre_apply_route_enabled');
    if (preApplySummary.mountedRouteCount !== 0) failures.push('pre_apply_route_mounted');
    if (preApplyHttp.getStatus !== 404) failures.push('pre_apply_route_not_default_off');

    const appliedText = buildAppliedConfigText(originalConfig.text);
    fs.writeFileSync(CONFIG_ENV_PATH, appliedText, 'utf8');
    appliedConfigHash = hashFile(CONFIG_ENV_PATH);
    const appliedCounts = countManagedKeyLines(appliedText);
    const appliedEnv = parseEnvText(appliedText);
    lines.push('REAL_CONFIG_WRITE_EXECUTED=yes');
    lines.push(`CONFIG_ENV_AFTER_APPLY_SHA256=${appliedConfigHash}`);
    lines.push(`AFTER_APPLY_SHA_CHANGED=${appliedConfigHash !== originalConfig.hash ? 'yes' : 'no'}`);
    lines.push(`AFTER_APPLY_${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV}_LINE_COUNT=${appliedCounts[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]}`);
    lines.push(`AFTER_APPLY_${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV}_LINE_COUNT=${appliedCounts[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]}`);
    lines.push(`AFTER_APPLY_${VCP_AI_IMAGE_ADAPTER_DIRS_ENV}_LINE_COUNT=${appliedCounts[VCP_AI_IMAGE_ADAPTER_DIRS_ENV]}`);
    lines.push(`AFTER_APPLY_ENABLE_AI_IMAGE_REAL_EXECUTION_LINE_COUNT=${countKeyLines(appliedText, 'ENABLE_AI_IMAGE_REAL_EXECUTION')}`);
    if (appliedConfigHash === originalConfig.hash) failures.push('apply_hash_unchanged');
    if (appliedCounts[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV] !== 1) failures.push('diagnostic_route_key_not_applied_once');
    if (appliedCounts[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV] !== 1) failures.push('allowed_roots_key_not_applied_once');
    if (appliedCounts[VCP_AI_IMAGE_ADAPTER_DIRS_ENV] !== 1) failures.push('dirs_key_not_applied_once');
    if (countKeyLines(appliedText, 'ENABLE_AI_IMAGE_REAL_EXECUTION') !== 0) failures.push('real_execution_key_written');

    applyConfigToProcessEnv(appliedEnv);
    const applied = createAdminPanelRouterWithStubs();
    const appliedSummary = summarizeRuntime(applied.router);
    const appliedHttp = await runHttpScenario(applied.router);
    lines.push(`AFTER_APPLY_ROUTE_ENABLED=${appliedSummary.routeEnabled ? 'yes' : 'no'}`);
    lines.push(`AFTER_APPLY_MOUNTED_ROUTE_COUNT=${appliedSummary.mountedRouteCount}`);
    lines.push(`AFTER_APPLY_ROUTE_STATUS=${appliedHttp.getStatus}`);
    lines.push(`AFTER_APPLY_POST_STATUS=${appliedHttp.postStatus}`);
    lines.push(`AFTER_APPLY_METADATA_ADAPTER_COUNT=${appliedHttp.getBody?.adapterMetadataCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_EXECUTABLE_ADAPTER_COUNT=${appliedHttp.getBody?.executableAdapterCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_PROVIDER_CALL_COUNT=${appliedHttp.getBody?.providerCallCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_IMAGE_GENERATION_COUNT=${appliedHttp.getBody?.imageGenerationCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_OUTPUT_WRITE_COUNT=${appliedHttp.getBody?.outputWriteCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_BRIDGE_CALL_COUNT=${appliedHttp.getBody?.bridgeCallCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_LOCALSTATE_READ_COUNT=${appliedHttp.getBody?.localStateReadCount ?? 'missing'}`);
    lines.push(`AFTER_APPLY_RESPONSE_ABSOLUTE_PATH_COUNT=${countAbsolutePathValues(appliedHttp.getBody)}`);
    lines.push(`AFTER_APPLY_RESPONSE_SECRET_FIELD_COUNT=${countForbiddenFieldNames(appliedHttp.getBody)}`);
    lines.push(`AFTER_APPLY_AUTH_PROBE_HIT_COUNT=${appliedHttp.authProbeHits}`);
    if (!appliedSummary.routeEnabled) failures.push('after_apply_route_not_enabled');
    if (appliedSummary.mountedRouteCount !== 1) failures.push('after_apply_mounted_route_count_unexpected');
    if (appliedHttp.getStatus !== 200) failures.push('after_apply_get_not_ready');
    if (appliedHttp.postStatus !== 404) failures.push('after_apply_post_not_blocked');
    if (appliedHttp.getBody?.adapterMetadataCount !== 1) failures.push('after_apply_metadata_count_unexpected');
    if (appliedHttp.getBody?.executableAdapterCount !== 0) failures.push('after_apply_executable_count_unexpected');
    if (appliedHttp.getBody?.providerCallCount !== 0) failures.push('after_apply_provider_call_count_nonzero');
    if (appliedHttp.getBody?.imageGenerationCount !== 0) failures.push('after_apply_image_generation_count_nonzero');
    if (appliedHttp.getBody?.outputWriteCount !== 0) failures.push('after_apply_output_write_count_nonzero');
    if (appliedHttp.getBody?.bridgeCallCount !== 0) failures.push('after_apply_bridge_call_count_nonzero');
    if (appliedHttp.getBody?.localStateReadCount !== 0) failures.push('after_apply_localstate_read_count_nonzero');
    if (countAbsolutePathValues(appliedHttp.getBody) !== 0) failures.push('after_apply_response_absolute_path');
    if (countForbiddenFieldNames(appliedHttp.getBody) !== 0) failures.push('after_apply_response_forbidden_field');

    applyConfigToProcessEnv(appliedEnv);
    const unauthorized = createAdminPanelRouterWithStubs();
    const unauthorizedHttp = await runHttpScenario(unauthorized.router, { markAdminAuth: false });
    lines.push(`UNAUTHORIZED_ROUTE_STATUS=${unauthorizedHttp.getStatus}`);
    if (unauthorizedHttp.getStatus !== 403) failures.push('unauthorized_route_not_forbidden');

    applyConfigToProcessEnv(appliedEnv, { ENABLE_AI_IMAGE_REAL_EXECUTION: 'true' });
    const realExecution = createAdminPanelRouterWithStubs();
    const realExecutionHttp = await runHttpScenario(realExecution.router);
    lines.push(`REAL_EXECUTION_BLOCKED_STATUS=${realExecutionHttp.getStatus}`);
    if (realExecutionHttp.getStatus !== 409) failures.push('real_execution_not_blocked');

    restoreOriginalConfig();
    const rollbackConfig = readRegularConfig();
    finalConfigHash = rollbackConfig.hash;
    finalCounts = countManagedKeyLines(rollbackConfig.text);
    const rollbackEnv = parseEnvText(rollbackConfig.text);
    applyConfigToProcessEnv(rollbackEnv);
    const rollback = createAdminPanelRouterWithStubs();
    const rollbackSummary = summarizeRuntime(rollback.router);
    const rollbackHttp = await runHttpScenario(rollback.router);
    const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
    const externalAfter = snapshotHashes(externalPackageFiles);
    const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
    const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);

    lines.push(`ROLLBACK_${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV}_LINE_COUNT=${finalCounts[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]}`);
    lines.push(`ROLLBACK_${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV}_LINE_COUNT=${finalCounts[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]}`);
    lines.push(`ROLLBACK_${VCP_AI_IMAGE_ADAPTER_DIRS_ENV}_LINE_COUNT=${finalCounts[VCP_AI_IMAGE_ADAPTER_DIRS_ENV]}`);
    lines.push(`ROLLBACK_ROUTE_ENABLED=${rollbackSummary.routeEnabled ? 'yes' : 'no'}`);
    lines.push(`ROLLBACK_MOUNTED_ROUTE_COUNT=${rollbackSummary.mountedRouteCount}`);
    lines.push(`ROLLBACK_ROUTE_STATUS=${rollbackHttp.getStatus}`);
    lines.push(`CONFIG_ENV_FINAL_SHA256=${finalConfigHash}`);
    lines.push(`CONFIG_ENV_FINAL_SHA_RESTORED=${finalConfigHash === originalConfig.hash ? 'yes' : 'no'}`);
    lines.push(`CORE_AI_IMAGE_DIAGNOSTIC_RUNTIME_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
    lines.push(`SERVER_JS_HASH_UNCHANGED=${hashFile(SERVER_JS_PATH) === coreBefore.get(SERVER_JS_PATH) ? 'yes' : 'no'}`);
    lines.push(`ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=${hashFile(ADMIN_PANEL_ROUTES_PATH) === coreBefore.get(ADMIN_PANEL_ROUTES_PATH) ? 'yes' : 'no'}`);
    lines.push(`EXTERNAL_AI_IMAGE_PACKAGE_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
    if (!allCountsZero(finalCounts)) failures.push('rollback_managed_keys_still_present');
    if (rollbackSummary.routeEnabled) failures.push('rollback_route_enabled');
    if (rollbackSummary.mountedRouteCount !== 0) failures.push('rollback_route_mounted');
    if (rollbackHttp.getStatus !== 404) failures.push('rollback_route_not_default_off');
    if (finalConfigHash !== originalConfig.hash) failures.push('final_config_hash_not_restored');
    if (!coreUnchanged) failures.push('core_runtime_hash_changed');
    if (!externalUnchanged) failures.push('external_ai_image_package_hash_changed');
  } catch (error) {
    failures.push(error && error.code ? error.code : 'unexpected_error');
  } finally {
    restoreOriginalConfig();
    restoreProcessEnv(processEnvBefore);
    if (originalConfig) {
      finalConfigHash = hashFile(CONFIG_ENV_PATH);
      if (Object.keys(finalCounts).length === 0) {
        finalCounts = countManagedKeyLines(fs.readFileSync(CONFIG_ENV_PATH, 'utf8'));
      }
      if (!restoredOriginal || finalConfigHash !== originalConfig.hash) {
        failures.push('finally_config_restore_failed');
      }
    }
  }

  lines.push(`PROCESS_ENV_FINAL_UNCHANGED=${JSON.stringify(captureProcessEnv(PROCESS_ENV_KEYS)) === JSON.stringify(processEnvBefore) ? 'yes' : 'no'}`);
  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('REAL_CONFIG_ENV_MODIFIED=transient_only_final_restored');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('REAL_IMAGE_GENERATED=no');
  lines.push('IMAGE_OUTPUT_WRITTEN=no');
  lines.push('BRIDGE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_PASS=yes');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('AI_IMAGE_DIAGNOSTIC_REAL_CONFIG_APPLY_ROLLBACK_DRILL_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
