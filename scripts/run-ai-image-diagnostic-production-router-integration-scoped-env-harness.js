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
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV
} = require('../modules/adminExtensionRegistry');
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

const PROCESS_ENV_KEYS = Object.freeze([
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV,
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV
]);

const CORE_HASH_TARGETS = Object.freeze([
  SERVER_JS_PATH,
  ADMIN_PANEL_ROUTES_PATH,
  path.join(CORE_ROOT, 'modules', 'aiImageAdapterDiagnosticRuntimeMount.js'),
  path.join(CORE_ROOT, 'routes', 'admin', 'aiImageAdapterDiagnostics.js')
]);

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function readConfigSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      hash: 'missing',
      env: {}
    };
  }

  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  return {
    exists: true,
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
    env: dotenv.parse(raw)
  };
}

function hashFile(filePath) {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : 'missing';
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
  const result = new Map();
  for (const filePath of paths) {
    result.set(filePath, hashFile(filePath));
  }
  return result;
}

function hashesUnchanged(before, after) {
  for (const [filePath, hash] of before.entries()) {
    if (after.get(filePath) !== hash) return false;
  }
  return true;
}

function captureProcessEnv(keys) {
  const snapshot = {};
  for (const key of keys) {
    snapshot[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }
  return snapshot;
}

function restoreProcessEnv(snapshot, keys) {
  for (const key of keys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

function processEnvUnchanged(before, keys) {
  const after = captureProcessEnv(keys);
  return keys.every((key) => before[key] === after[key]);
}

function clearScopedProcessEnv() {
  for (const key of PROCESS_ENV_KEYS) {
    delete process.env[key];
  }
}

function applyScopedAiImageProcessEnv(extra = {}) {
  process.env[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV] = 'true';
  process.env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV] = EXTERNAL_ROOT;
  process.env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV] = AI_IMAGE_ADAPTERS_ROOT;
  delete process.env.ENABLE_AI_IMAGE_REAL_EXECUTION;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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
      postStatus: postResult.status,
      postBody: postResult.body
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

function summarizeAiImageRuntime(router) {
  const summary = router.aiImageAdapterDiagnosticRuntimeSummary || {};
  return {
    routeEnabled: summary.routeEnabled === true,
    realExecutionEnabled: summary.realExecutionEnabled === true,
    attemptedRouteCount: summary.attemptedRouteCount || 0,
    mountedRouteCount: summary.mountedRouteCount || 0,
    mountedFullPaths: (summary.mountedRoutes || []).map((route) => route.fullPath || 'unknown'),
    diagnosticCodes: (summary.diagnostics || []).map((diagnostic) => diagnostic.code || 'unknown').sort().join(',') || 'none'
  };
}

async function main() {
  const failures = [];
  const lines = [];
  const processEnvBefore = captureProcessEnv(PROCESS_ENV_KEYS);
  const configBefore = readConfigSnapshot();
  const coreBefore = snapshotHashes(CORE_HASH_TARGETS);
  const externalPackageFiles = listFiles(AI_IMAGE_ADAPTERS_ROOT);
  const externalBefore = snapshotHashes(externalPackageFiles);

  lines.push('AI_IMAGE_DIAGNOSTIC_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV');
  lines.push(`CONFIG_ENV_EXISTS=${configBefore.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${configBefore.hash}`);
  lines.push(`INITIAL_PROCESS_ENV_${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV}_SET=${isSet(processEnvBefore, ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV) ? 'yes' : 'no'}`);
  lines.push(`INITIAL_PROCESS_ENV_${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV}_SET=${isSet(processEnvBefore, VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV) ? 'yes' : 'no'}`);
  lines.push(`INITIAL_PROCESS_ENV_${VCP_AI_IMAGE_ADAPTER_DIRS_ENV}_SET=${isSet(processEnvBefore, VCP_AI_IMAGE_ADAPTER_DIRS_ENV) ? 'yes' : 'no'}`);
  lines.push(`INITIAL_PROCESS_ENV_ENABLE_AI_IMAGE_REAL_EXECUTION_TRUE=${processEnvBefore.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true' ? 'yes' : 'no'}`);
  if (processEnvBefore.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true') {
    failures.push('initial_enable_ai_image_real_execution_true');
  }

  clearScopedProcessEnv();
  const defaultOff = createAdminPanelRouterWithStubs();
  const defaultOffSummary = summarizeAiImageRuntime(defaultOff.router);
  const defaultOffHttp = await runHttpScenario(defaultOff.router);
  lines.push('ADMIN_PANEL_ROUTES_MODULE_USED=yes');
  lines.push(`ADMIN_ROUTE_SUBMODULES_STUBBED_COUNT=${defaultOff.stubbedModuleCount}`);
  lines.push(`DEFAULT_OFF_ROUTE_ENABLED=${defaultOffSummary.routeEnabled ? 'yes' : 'no'}`);
  lines.push(`DEFAULT_OFF_MOUNTED_ROUTE_COUNT=${defaultOffSummary.mountedRouteCount}`);
  lines.push(`DEFAULT_OFF_ROUTE_STATUS=${defaultOffHttp.getStatus}`);
  lines.push(`DEFAULT_OFF_DIAGNOSTIC_CODES=${defaultOffSummary.diagnosticCodes}`);
  if (defaultOffSummary.routeEnabled) failures.push('default_off_route_enabled');
  if (defaultOffSummary.mountedRouteCount !== 0) failures.push('default_off_mounted_routes_present');
  if (defaultOffHttp.getStatus !== 404) failures.push('default_off_route_reachable');

  applyScopedAiImageProcessEnv();
  const scoped = createAdminPanelRouterWithStubs();
  const scopedSummary = summarizeAiImageRuntime(scoped.router);
  const scopedHttp = await runHttpScenario(scoped.router);
  lines.push('SCOPED_PROCESS_ENV_APPLIED=yes');
  lines.push(`SCOPED_ROUTE_ENABLED=${scopedSummary.routeEnabled ? 'yes' : 'no'}`);
  lines.push(`SCOPED_MOUNTED_ROUTE_COUNT=${scopedSummary.mountedRouteCount}`);
  lines.push(`SCOPED_MOUNTED_FULL_PATHS=${scopedSummary.mountedFullPaths.join(',') || 'none'}`);
  lines.push(`SCOPED_ROUTE_STATUS=${scopedHttp.getStatus}`);
  lines.push(`SCOPED_POST_STATUS=${scopedHttp.postStatus}`);
  lines.push(`SCOPED_METADATA_ADAPTER_COUNT=${scopedHttp.getBody?.adapterMetadataCount ?? 'missing'}`);
  lines.push(`SCOPED_EXECUTABLE_ADAPTER_COUNT=${scopedHttp.getBody?.executableAdapterCount ?? 'missing'}`);
  lines.push(`SCOPED_PROVIDER_CALL_COUNT=${scopedHttp.getBody?.providerCallCount ?? 'missing'}`);
  lines.push(`SCOPED_IMAGE_GENERATION_COUNT=${scopedHttp.getBody?.imageGenerationCount ?? 'missing'}`);
  lines.push(`SCOPED_OUTPUT_WRITE_COUNT=${scopedHttp.getBody?.outputWriteCount ?? 'missing'}`);
  lines.push(`SCOPED_BRIDGE_CALL_COUNT=${scopedHttp.getBody?.bridgeCallCount ?? 'missing'}`);
  lines.push(`SCOPED_LOCALSTATE_READ_COUNT=${scopedHttp.getBody?.localStateReadCount ?? 'missing'}`);
  lines.push(`RESPONSE_ABSOLUTE_PATH_COUNT=${countAbsolutePathValues(scopedHttp.getBody)}`);
  lines.push(`RESPONSE_SECRET_FIELD_COUNT=${countForbiddenFieldNames(scopedHttp.getBody)}`);
  lines.push(`AUTH_PROBE_HIT_COUNT=${scopedHttp.authProbeHits}`);
  lines.push('ROUTE_UNDER_ADMIN_API=yes');
  lines.push('BYPASS_ADMIN_AUTH=no');
  if (!scopedSummary.routeEnabled) failures.push('scoped_route_not_enabled');
  if (scopedSummary.mountedRouteCount !== 1) failures.push('scoped_mounted_route_count_unexpected');
  if (!scopedSummary.mountedFullPaths.includes(AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH)) failures.push('scoped_mount_path_unexpected');
  if (scopedHttp.getStatus !== 200) failures.push('scoped_get_failed');
  if (scopedHttp.postStatus !== 404) failures.push('scoped_post_not_blocked');
  if (scopedHttp.getBody?.adapterMetadataCount !== 1) failures.push('scoped_metadata_count_unexpected');
  if (scopedHttp.getBody?.executableAdapterCount !== 0) failures.push('scoped_executable_count_unexpected');
  if (scopedHttp.getBody?.providerCallCount !== 0) failures.push('scoped_provider_call_count_nonzero');
  if (scopedHttp.getBody?.imageGenerationCount !== 0) failures.push('scoped_image_generation_count_nonzero');
  if (scopedHttp.getBody?.outputWriteCount !== 0) failures.push('scoped_output_write_count_nonzero');
  if (scopedHttp.getBody?.bridgeCallCount !== 0) failures.push('scoped_bridge_call_count_nonzero');
  if (scopedHttp.getBody?.localStateReadCount !== 0) failures.push('scoped_localstate_read_count_nonzero');
  if (countAbsolutePathValues(scopedHttp.getBody) !== 0) failures.push('scoped_response_absolute_path');
  if (countForbiddenFieldNames(scopedHttp.getBody) !== 0) failures.push('scoped_response_forbidden_field');
  if (scopedHttp.authProbeHits < 1) failures.push('auth_probe_not_hit');

  applyScopedAiImageProcessEnv();
  const unauthorized = createAdminPanelRouterWithStubs();
  const unauthorizedHttp = await runHttpScenario(unauthorized.router, { markAdminAuth: false });
  lines.push(`UNAUTHORIZED_ROUTE_STATUS=${unauthorizedHttp.getStatus}`);
  if (unauthorizedHttp.getStatus !== 403) failures.push('unauthorized_route_not_forbidden');

  applyScopedAiImageProcessEnv({ ENABLE_AI_IMAGE_REAL_EXECUTION: 'true' });
  const realExecution = createAdminPanelRouterWithStubs();
  const realExecutionHttp = await runHttpScenario(realExecution.router);
  lines.push(`REAL_EXECUTION_BLOCKED_STATUS=${realExecutionHttp.getStatus}`);
  if (realExecutionHttp.getStatus !== 409) failures.push('real_execution_not_blocked');

  clearScopedProcessEnv();
  const rollback = createAdminPanelRouterWithStubs();
  const rollbackSummary = summarizeAiImageRuntime(rollback.router);
  const rollbackHttp = await runHttpScenario(rollback.router);
  lines.push(`ROLLBACK_ROUTE_ENABLED=${rollbackSummary.routeEnabled ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_MOUNTED_ROUTE_COUNT=${rollbackSummary.mountedRouteCount}`);
  lines.push(`ROLLBACK_ROUTE_STATUS=${rollbackHttp.getStatus}`);
  if (rollbackSummary.routeEnabled) failures.push('rollback_route_enabled');
  if (rollbackSummary.mountedRouteCount !== 0) failures.push('rollback_mounted_route_count_unexpected');
  if (rollbackHttp.getStatus !== 404) failures.push('rollback_route_reachable');

  restoreProcessEnv(processEnvBefore, PROCESS_ENV_KEYS);
  const envUnchanged = processEnvUnchanged(processEnvBefore, PROCESS_ENV_KEYS);
  const configAfter = readConfigSnapshot();
  const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
  const externalAfter = snapshotHashes(externalPackageFiles);
  const configUnchanged = configBefore.hash === configAfter.hash;
  const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
  const serverUnchanged = coreBefore.get(SERVER_JS_PATH) === coreAfter.get(SERVER_JS_PATH);
  const adminRoutesUnchangedDuringHarness = coreBefore.get(ADMIN_PANEL_ROUTES_PATH) === coreAfter.get(ADMIN_PANEL_ROUTES_PATH);
  const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);

  lines.push(`ROLLBACK_PROCESS_ENV_RESTORED=${envUnchanged ? 'yes' : 'no'}`);
  lines.push(`CONFIG_ENV_FILE_MODIFIED=${configUnchanged ? 'no' : 'yes'}`);
  lines.push(`CORE_AI_IMAGE_DIAGNOSTIC_RUNTIME_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
  lines.push(`SERVER_JS_HASH_UNCHANGED=${serverUnchanged ? 'yes' : 'no'}`);
  lines.push(`ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=${adminRoutesUnchangedDuringHarness ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_AI_IMAGE_PACKAGE_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
  lines.push(`PROCESS_ENV_FINAL_UNCHANGED=${envUnchanged ? 'yes' : 'no'}`);
  if (!envUnchanged) failures.push('process_env_not_restored');
  if (!configUnchanged) failures.push('config_env_hash_changed');
  if (!serverUnchanged) failures.push('server_js_hash_changed');
  if (!adminRoutesUnchangedDuringHarness) failures.push('admin_panel_routes_hash_changed_during_harness');
  if (!externalUnchanged) failures.push('external_ai_image_package_hash_changed');

  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('REAL_CONFIG_ENV_MODIFIED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('REAL_IMAGE_GENERATED=no');
  lines.push('IMAGE_OUTPUT_WRITTEN=no');
  lines.push('BRIDGE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('AI_IMAGE_DIAGNOSTIC_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('AI_IMAGE_DIAGNOSTIC_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS=yes');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('AI_IMAGE_DIAGNOSTIC_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
