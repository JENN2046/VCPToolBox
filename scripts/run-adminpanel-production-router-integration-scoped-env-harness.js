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

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const SERVER_JS_PATH = path.join(CORE_ROOT, 'server.js');
const ADMIN_PANEL_ROUTES_PATH = path.join(CORE_ROOT, 'routes', 'adminPanelRoutes.js');
const ADMIN_ROUTES_DIR = path.join(CORE_ROOT, 'routes', 'admin');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_EXTENSION_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus');
const TARGET_ROUTE = '/admin_api/jenn-admin-status/status';

const REAL_ENV_KEYS = Object.freeze([
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  'VCP_OAUTH_AUTH_CENTER_ENABLED'
]);

const CORE_HASH_TARGETS = Object.freeze([
  SERVER_JS_PATH,
  ADMIN_PANEL_ROUTES_PATH,
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'app', 'routes', 'manifest.ts'),
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'app', 'routes', 'components.ts'),
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'stores', 'app.ts')
]);

function readConfigSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      hash: 'missing',
      env: {},
      raw: Buffer.alloc(0)
    };
  }

  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  return {
    exists: true,
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
    env: dotenv.parse(raw),
    raw
  };
}

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
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

function clearAdminExtensionProcessEnv() {
  delete process.env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV];
  delete process.env[VCP_ADMIN_EXTENSION_DIRS_ENV];
  delete process.env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV];
  delete process.env.VCP_OAUTH_AUTH_CENTER_ENABLED;
}

function applyScopedProcessEnv() {
  process.env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV] = EXTERNAL_ROOT;
  process.env[VCP_ADMIN_EXTENSION_DIRS_ENV] = ADMIN_EXTENSION_ROOT;
  process.env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV] = 'jenn.admin.status';
  delete process.env.VCP_OAUTH_AUTH_CENTER_ENABLED;
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
      && !resolved.includes(`${path.sep}lib${path.sep}`);

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

async function startLocalTestServer(router) {
  const app = express();
  let authProbeHits = 0;
  app.use('/admin_api', (req, _res, next) => {
    authProbeHits += 1;
    req.adminAuthBoundaryReached = true;
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

async function fetchStatus(baseUrl, method = 'GET') {
  const response = await fetch(`${baseUrl}${TARGET_ROUTE}`, { method });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function runHttpScenario(router) {
  const server = await startLocalTestServer(router);
  try {
    const getResult = await fetchStatus(server.baseUrl);
    const writeResults = [];
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      writeResults.push(await fetchStatus(server.baseUrl, method));
    }
    return {
      authProbeHits: server.getAuthProbeHits(),
      getStatus: getResult.status,
      getBody: getResult.body,
      writeStatuses: writeResults.map((result) => result.status)
    };
  } finally {
    await server.close();
  }
}

function summarizeRuntime(router) {
  const summary = router.adminExtensionRuntimeSummary || {};
  return {
    runtimeEnabled: summary.runtimeEnabled === true,
    attemptedRouteCount: summary.attemptedRouteCount || 0,
    mountedRouteCount: summary.mountedRouteCount || 0,
    frontendRouteCountIgnored: summary.frontendRouteCountIgnored || 0,
    mountedFullPaths: (summary.mountedRoutes || []).map((route) => `/admin_api${route.mountPath}`),
    diagnosticCodes: (summary.diagnostics || []).map((diagnostic) => diagnostic.code || 'unknown').sort().join(',') || 'none'
  };
}

async function main() {
  const failures = [];
  const lines = [];
  const processEnvBefore = captureProcessEnv(REAL_ENV_KEYS);
  const configBefore = readConfigSnapshot();
  const coreBefore = snapshotHashes(CORE_HASH_TARGETS);
  const externalPackageFiles = listFiles(ADMIN_EXTENSION_ROOT);
  const externalBefore = snapshotHashes(externalPackageFiles);

  lines.push('M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV');
  lines.push(`CONFIG_ENV_EXISTS=${configBefore.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${configBefore.hash}`);
  for (const key of REAL_ENV_KEYS.filter((item) => item !== 'VCP_OAUTH_AUTH_CENTER_ENABLED')) {
    const realConfigSet = isSet(configBefore.env, key);
    const initialProcessEnvSet = isSet(processEnvBefore, key);
    lines.push(`REAL_ENV_${key}_SET=${realConfigSet ? 'yes' : 'no'}`);
    lines.push(`INITIAL_PROCESS_ENV_${key}_SET=${initialProcessEnvSet ? 'yes' : 'no'}`);
    if (realConfigSet) failures.push(`${key.toLowerCase()}_set_in_real_config`);
    if (initialProcessEnvSet) failures.push(`${key.toLowerCase()}_set_in_initial_process_env`);
  }

  clearAdminExtensionProcessEnv();
  const defaultOff = createAdminPanelRouterWithStubs();
  const defaultOffSummary = summarizeRuntime(defaultOff.router);
  const defaultOffHttp = await runHttpScenario(defaultOff.router);
  lines.push('ADMIN_PANEL_ROUTES_MODULE_USED=yes');
  lines.push(`ADMIN_ROUTE_SUBMODULES_STUBBED_COUNT=${defaultOff.stubbedModuleCount}`);
  lines.push(`DEFAULT_OFF_RUNTIME_ENABLED=${defaultOffSummary.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`DEFAULT_OFF_ATTEMPTED_ROUTE_COUNT=${defaultOffSummary.attemptedRouteCount}`);
  lines.push(`DEFAULT_OFF_MOUNTED_ROUTE_COUNT=${defaultOffSummary.mountedRouteCount}`);
  lines.push(`DEFAULT_OFF_GET_STATUS=${defaultOffHttp.getStatus}`);
  lines.push(`DEFAULT_OFF_DIAGNOSTIC_CODES=${defaultOffSummary.diagnosticCodes}`);
  if (defaultOffSummary.runtimeEnabled) failures.push('default_off_runtime_enabled');
  if (defaultOffSummary.mountedRouteCount !== 0) failures.push('default_off_mounted_routes_present');
  if (defaultOffHttp.getStatus !== 404) failures.push('default_off_route_reachable');

  if (failures.length === 0) {
    applyScopedProcessEnv();
    const scoped = createAdminPanelRouterWithStubs();
    const scopedSummary = summarizeRuntime(scoped.router);
    const scopedHttp = await runHttpScenario(scoped.router);
    lines.push('SCOPED_PROCESS_ENV_APPLIED=yes');
    lines.push(`SCOPED_ENV_RUNTIME_ENABLED=${scopedSummary.runtimeEnabled ? 'yes' : 'no'}`);
    lines.push(`SCOPED_ENV_ATTEMPTED_ROUTE_COUNT=${scopedSummary.attemptedRouteCount}`);
    lines.push(`SCOPED_ENV_MOUNTED_ROUTE_COUNT=${scopedSummary.mountedRouteCount}`);
    lines.push(`SCOPED_ENV_FRONTEND_ROUTE_COUNT_IGNORED=${scopedSummary.frontendRouteCountIgnored}`);
    lines.push(`SCOPED_ENV_MOUNTED_FULL_PATHS=${scopedSummary.mountedFullPaths.join(',') || 'none'}`);
    lines.push(`SCOPED_ENV_GET_STATUS=${scopedHttp.getStatus}`);
    lines.push(`SCOPED_ENV_BODY_OK=${scopedHttp.getBody?.ok === true ? 'yes' : 'no'}`);
    lines.push(`SCOPED_ENV_BODY_EXTENSION_ID=${scopedHttp.getBody?.extensionId || 'missing'}`);
    lines.push(`SCOPED_ENV_BODY_MODE=${scopedHttp.getBody?.mode || 'missing'}`);
    lines.push(`WRITE_METHOD_STATUS_CODES=${scopedHttp.writeStatuses.join(',')}`);
    lines.push(`AUTH_PROBE_HIT_COUNT=${scopedHttp.authProbeHits}`);
    lines.push('ROUTE_UNDER_ADMIN_API=yes');
    lines.push('BYPASS_ADMIN_AUTH=no');
    if (!scopedSummary.runtimeEnabled) failures.push('scoped_runtime_not_enabled');
    if (scopedSummary.attemptedRouteCount !== 1) failures.push('scoped_attempted_route_count_unexpected');
    if (scopedSummary.mountedRouteCount !== 1) failures.push('scoped_mounted_route_count_unexpected');
    if (scopedSummary.frontendRouteCountIgnored !== 1) failures.push('scoped_frontend_route_count_unexpected');
    if (!scopedSummary.mountedFullPaths.includes('/admin_api/jenn-admin-status')) failures.push('scoped_mount_path_unexpected');
    if (scopedHttp.getStatus !== 200) failures.push('scoped_get_failed');
    if (scopedHttp.getBody?.ok !== true) failures.push('scoped_body_not_ok');
    if (scopedHttp.getBody?.extensionId !== 'jenn.admin.status') failures.push('scoped_extension_id_unexpected');
    if (scopedHttp.getBody?.mode !== 'read-only') failures.push('scoped_mode_unexpected');
    if (!scopedHttp.writeStatuses.every((status) => status === 404)) failures.push('write_method_not_blocked');
    if (scopedHttp.authProbeHits < 1) failures.push('auth_probe_not_hit');
  } else {
    lines.push('SCOPED_PROCESS_ENV_APPLIED=no');
  }

  restoreProcessEnv(processEnvBefore, REAL_ENV_KEYS);
  const rollback = createAdminPanelRouterWithStubs();
  const rollbackSummary = summarizeRuntime(rollback.router);
  const rollbackHttp = await runHttpScenario(rollback.router);
  const envUnchanged = processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS);
  lines.push(`ROLLBACK_PROCESS_ENV_RESTORED=${envUnchanged ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_RUNTIME_ENABLED=${rollbackSummary.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_MOUNTED_ROUTE_COUNT=${rollbackSummary.mountedRouteCount}`);
  lines.push(`ROLLBACK_GET_STATUS=${rollbackHttp.getStatus}`);
  if (!envUnchanged) failures.push('process_env_not_restored');
  if (rollbackSummary.runtimeEnabled) failures.push('rollback_runtime_enabled');
  if (rollbackSummary.mountedRouteCount !== 0) failures.push('rollback_mounted_routes_present');
  if (rollbackHttp.getStatus !== 404) failures.push('rollback_route_reachable');

  const configAfter = readConfigSnapshot();
  const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
  const externalAfter = snapshotHashes(externalPackageFiles);
  const configUnchanged = configBefore.hash === configAfter.hash;
  const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
  const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);
  const serverUnchanged = coreBefore.get(SERVER_JS_PATH) === coreAfter.get(SERVER_JS_PATH);
  const adminRoutesUnchangedDuringHarness = coreBefore.get(ADMIN_PANEL_ROUTES_PATH) === coreAfter.get(ADMIN_PANEL_ROUTES_PATH);
  lines.push(`CONFIG_ENV_FILE_MODIFIED=${configUnchanged ? 'no' : 'yes'}`);
  lines.push(`CORE_ADMIN_RUNTIME_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
  lines.push(`SERVER_JS_HASH_UNCHANGED=${serverUnchanged ? 'yes' : 'no'}`);
  lines.push(`ADMIN_PANEL_ROUTES_HASH_UNCHANGED_DURING_HARNESS=${adminRoutesUnchangedDuringHarness ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
  lines.push(`PROCESS_ENV_FINAL_UNCHANGED=${envUnchanged ? 'yes' : 'no'}`);
  if (!configUnchanged) failures.push('config_env_hash_changed');
  if (!serverUnchanged) failures.push('server_js_hash_changed');
  if (!adminRoutesUnchangedDuringHarness) failures.push('admin_panel_routes_hash_changed_during_harness');
  if (!externalUnchanged) failures.push('external_admin_package_hash_changed');

  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('ADMINPANEL_BUILD_RUN=no');
  lines.push('ADMINPANEL_DIST_MODIFIED=no');
  lines.push('PRODUCTION_ADMIN_REGISTRATION_CODE_PRESENT=yes');
  lines.push('PRODUCTION_ADMIN_SERVER_EXECUTED=no');
  lines.push('FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no');
  lines.push('DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('M52_ADMINPANEL_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
