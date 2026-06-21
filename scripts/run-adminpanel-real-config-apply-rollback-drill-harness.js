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
const ADMIN_PANEL_ROUTES_PATH = path.join(CORE_ROOT, 'routes', 'adminPanelRoutes.js');
const ADMIN_ROUTES_DIR = path.join(CORE_ROOT, 'routes', 'admin');
const TARGET_ROUTE = '/admin_api/jenn-admin-status/status';

const ADMIN_ENV_KEYS = Object.freeze([
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV
]);

const CURRENTLY_ALLOWED_AGENT_RUNTIME_KEYS = Object.freeze([
  'VCP_AGENT_ALLOWED_ROOTS',
  'VCP_AGENT_OVERRIDE_DIRS'
]);

const BLOCKED_RUNTIME_ENV_KEYS = Object.freeze([
  'VCP_AGENT_DIRS',
  'VCP_PLUGIN_ALLOWED_ROOTS',
  'VCP_PLUGIN_DIRS',
  'VCP_PLUGIN_INSTALL_DIR',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST',
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

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readConfigSnapshot() {
  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  return {
    raw,
    text: raw.toString('utf8'),
    hash: sha256(raw),
    env: dotenv.parse(raw)
  };
}

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function countSetKeys(env, keys) {
  return keys.filter((key) => isSet(env, key)).length;
}

function removeAdminEnvKeys(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      return !match || !ADMIN_ENV_KEYS.includes(match[1]);
    })
    .join(text.includes('\r\n') ? '\r\n' : '\n')
    .replace(/(\r?\n)*$/, text.includes('\r\n') ? '\r\n' : '\n');
}

function captureAdminProcessEnv() {
  const snapshot = {};
  for (const key of ADMIN_ENV_KEYS) {
    snapshot[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }
  return snapshot;
}

function restoreAdminProcessEnv(snapshot) {
  for (const key of ADMIN_ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

function applyAdminProcessEnvFromConfig(env) {
  for (const key of ADMIN_ENV_KEYS) {
    if (isSet(env, key)) {
      process.env[key] = env[key];
    } else {
      delete process.env[key];
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

async function evaluateCurrentConfig(label) {
  const snapshot = readConfigSnapshot();
  applyAdminProcessEnvFromConfig(snapshot.env);
  const routerResult = createAdminPanelRouterWithStubs();
  const summary = summarizeRuntime(routerResult.router);
  const httpResult = await runHttpScenario(routerResult.router);

  return {
    label,
    hash: snapshot.hash,
    adminKeysSetCount: countSetKeys(snapshot.env, ADMIN_ENV_KEYS),
    allowedAgentRuntimeKeysSetCount: countSetKeys(snapshot.env, CURRENTLY_ALLOWED_AGENT_RUNTIME_KEYS),
    blockedRuntimeKeysSetCount: countSetKeys(snapshot.env, BLOCKED_RUNTIME_ENV_KEYS),
    stubbedModuleCount: routerResult.stubbedModuleCount,
    summary,
    httpResult
  };
}

function pushScenarioLines(lines, result) {
  const prefix = result.label;
  lines.push(`${prefix}_CONFIG_ENV_SHA256=${result.hash}`);
  lines.push(`${prefix}_ADMIN_KEYS_SET_COUNT=${result.adminKeysSetCount}`);
  lines.push(`${prefix}_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=${result.allowedAgentRuntimeKeysSetCount}`);
  lines.push(`${prefix}_BLOCKED_RUNTIME_KEYS_SET_COUNT=${result.blockedRuntimeKeysSetCount}`);
  lines.push(`${prefix}_ADMIN_ROUTE_SUBMODULES_STUBBED_COUNT=${result.stubbedModuleCount}`);
  lines.push(`${prefix}_RUNTIME_ENABLED=${result.summary.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`${prefix}_MOUNTED_ROUTE_COUNT=${result.summary.mountedRouteCount}`);
  lines.push(`${prefix}_FRONTEND_ROUTE_COUNT_IGNORED=${result.summary.frontendRouteCountIgnored}`);
  lines.push(`${prefix}_MOUNTED_FULL_PATHS=${result.summary.mountedFullPaths.join(',') || 'none'}`);
  lines.push(`${prefix}_GET_STATUS=${result.httpResult.getStatus}`);
  lines.push(`${prefix}_WRITE_METHOD_STATUS_CODES=${result.httpResult.writeStatuses.join(',')}`);
  lines.push(`${prefix}_BODY_OK=${result.httpResult.getBody?.ok === true ? 'yes' : 'no'}`);
  lines.push(`${prefix}_BODY_EXTENSION_ID=${result.httpResult.getBody?.extensionId || 'missing'}`);
  lines.push(`${prefix}_BODY_MODE=${result.httpResult.getBody?.mode || 'missing'}`);
  lines.push(`${prefix}_AUTH_PROBE_HIT_COUNT=${result.httpResult.authProbeHits}`);
  lines.push(`${prefix}_DIAGNOSTIC_CODES=${result.summary.diagnosticCodes}`);
}

async function main() {
  const lines = [];
  const failures = [];
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    lines.push('M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL');
    lines.push('CONFIG_ENV_VALUES_PRINTED=no');
    lines.push('M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_BLOCK');
    lines.push('BLOCK_REASONS=config_env_missing');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  const originalProcessEnv = captureAdminProcessEnv();
  const original = readConfigSnapshot();
  lines.push('M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL');
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`ORIGINAL_CONFIG_ENV_SHA256=${original.hash}`);

  let restoredFinalHash = 'missing';
  try {
    const applied = await evaluateCurrentConfig('APPLIED');
    pushScenarioLines(lines, applied);
    if (applied.adminKeysSetCount !== 3) failures.push('applied_admin_keys_not_exactly_three');
    if (applied.blockedRuntimeKeysSetCount !== 0) failures.push('applied_blocked_runtime_keys_set');
    if (!applied.summary.runtimeEnabled) failures.push('applied_runtime_not_enabled');
    if (applied.summary.mountedRouteCount !== 1) failures.push('applied_route_count_unexpected');
    if (!applied.summary.mountedFullPaths.includes('/admin_api/jenn-admin-status')) failures.push('applied_mount_path_unexpected');
    if (applied.summary.frontendRouteCountIgnored !== 1) failures.push('applied_frontend_count_unexpected');
    if (applied.httpResult.getStatus !== 200) failures.push('applied_get_failed');
    if (!applied.httpResult.writeStatuses.every((status) => status === 404)) failures.push('applied_write_methods_not_blocked');
    if (applied.httpResult.getBody?.extensionId !== 'jenn.admin.status') failures.push('applied_extension_id_unexpected');
    if (applied.httpResult.getBody?.mode !== 'read-only') failures.push('applied_mode_unexpected');
    if (applied.httpResult.authProbeHits < 1) failures.push('applied_auth_probe_not_hit');

    fs.writeFileSync(CONFIG_ENV_PATH, removeAdminEnvKeys(original.text), 'utf8');
    const removed = await evaluateCurrentConfig('ROLLBACK_REMOVED');
    pushScenarioLines(lines, removed);
    if (removed.adminKeysSetCount !== 0) failures.push('rollback_removed_admin_keys_present');
    if (removed.summary.runtimeEnabled) failures.push('rollback_removed_runtime_enabled');
    if (removed.summary.mountedRouteCount !== 0) failures.push('rollback_removed_routes_present');
    if (removed.httpResult.getStatus !== 404) failures.push('rollback_removed_route_reachable');

    fs.writeFileSync(CONFIG_ENV_PATH, original.text, 'utf8');
    const restored = await evaluateCurrentConfig('RESTORED');
    pushScenarioLines(lines, restored);
    restoredFinalHash = restored.hash;
    if (restored.hash !== original.hash) failures.push('restored_hash_mismatch');
    if (restored.adminKeysSetCount !== 3) failures.push('restored_admin_keys_not_exactly_three');
    if (!restored.summary.runtimeEnabled) failures.push('restored_runtime_not_enabled');
    if (restored.summary.mountedRouteCount !== 1) failures.push('restored_route_count_unexpected');
    if (restored.httpResult.getStatus !== 200) failures.push('restored_get_failed');
    if (!restored.httpResult.writeStatuses.every((status) => status === 404)) failures.push('restored_write_methods_not_blocked');
  } catch (error) {
    failures.push(error && error.code ? error.code : 'unexpected_error');
  } finally {
    fs.writeFileSync(CONFIG_ENV_PATH, original.text, 'utf8');
    restoredFinalHash = sha256(fs.readFileSync(CONFIG_ENV_PATH));
    restoreAdminProcessEnv(originalProcessEnv);
  }

  lines.push(`FINAL_CONFIG_ENV_SHA256=${restoredFinalHash}`);
  lines.push(`FINAL_CONFIG_ENV_HASH_RESTORED=${restoredFinalHash === original.hash ? 'yes' : 'no'}`);
  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('ADMINPANEL_BUILD_RUN=no');
  lines.push('ADMINPANEL_DIST_MODIFIED=no');
  lines.push('FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no');
  lines.push('DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (restoredFinalHash !== original.hash) failures.push('final_config_hash_not_restored');

  if (failures.length > 0) {
    lines.push('M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M54_ADMINPANEL_REAL_CONFIG_APPLY_ROLLBACK_DRILL_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
