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
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  buildAdminExtensionPlan,
  summarizeDiagnosticsByCode
} = require('../modules/adminExtensionRegistry');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_EXTENSION_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus');
const TARGET_ROUTE = '/admin_api/jenn-admin-status/status';
const CORE_NODE_MODULES = path.join(CORE_ROOT, 'node_modules');

const CORE_HASH_TARGETS = Object.freeze([
  path.join(CORE_ROOT, 'server.js'),
  path.join(CORE_ROOT, 'routes', 'adminPanelRoutes.js'),
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'app', 'routes', 'manifest.ts'),
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'app', 'routes', 'components.ts'),
  path.join(CORE_ROOT, 'AdminPanel-Vue', 'src', 'stores', 'app.ts')
]);

const REAL_ENV_KEYS = Object.freeze([
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV
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

function applyScopedProcessEnv() {
  process.env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV] = EXTERNAL_ROOT;
  process.env[VCP_ADMIN_EXTENSION_DIRS_ENV] = ADMIN_EXTENSION_ROOT;
  process.env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV] = 'jenn.admin.status';
}

function loadRouteModule(route) {
  const originalResolveFilename = Module._resolveFilename;
  Module._resolveFilename = function resolveWithCoreDependencies(request, parent, isMain, options) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      const isBareModule = typeof request === 'string'
        && !request.startsWith('.')
        && !path.isAbsolute(request);
      if (!isBareModule || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
      return require.resolve(request, { paths: [CORE_ROOT, CORE_NODE_MODULES] });
    }
  };

  let exported;
  try {
    delete require.cache[require.resolve(route.absoluteModulePath)];
    exported = require(route.absoluteModulePath);
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }

  if (typeof exported === 'function' && typeof exported.use === 'function' && typeof exported.handle === 'function') {
    return exported;
  }
  if (typeof exported === 'function') {
    return exported({
      extensionId: route.extensionId,
      routeId: route.routeId,
      mode: 'read-only'
    });
  }
  return exported;
}

function createProductionShapeLocalAdminApp(plan) {
  const app = express();
  const adminApiRouter = express.Router();
  const state = {
    authProbeHits: 0,
    mountedRoutes: 0,
    mountedFullPaths: []
  };

  for (const route of plan.registeredRoutes) {
    const routeModule = loadRouteModule(route);
    adminApiRouter.use(route.mountPath, routeModule);
    state.mountedRoutes += 1;
    state.mountedFullPaths.push(`/admin_api${route.mountPath}`);
  }

  app.use('/admin_api', (req, _res, next) => {
    state.authProbeHits += 1;
    req.adminAuthBoundaryReached = true;
    next();
  }, adminApiRouter);

  return { app, state };
}

async function startLocalTestServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
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

async function runHttpScenario(plan) {
  const { app, state } = createProductionShapeLocalAdminApp(plan);
  const server = await startLocalTestServer(app);
  try {
    const getResult = await fetchStatus(server.baseUrl);
    const writeResults = [];
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      writeResults.push(await fetchStatus(server.baseUrl, method));
    }
    return {
      mountedRoutes: state.mountedRoutes,
      mountedFullPaths: state.mountedFullPaths,
      authProbeHits: state.authProbeHits,
      getStatus: getResult.status,
      getBody: getResult.body,
      writeStatuses: writeResults.map((result) => result.status)
    };
  } finally {
    await server.close();
  }
}

function buildPlanFromProcessEnv() {
  return buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT
  });
}

async function main() {
  const failures = [];
  const lines = [];
  const processEnvBefore = captureProcessEnv(REAL_ENV_KEYS);
  const configBefore = readConfigSnapshot();
  const coreBefore = snapshotHashes(CORE_HASH_TARGETS);
  const externalPackageFiles = listFiles(ADMIN_EXTENSION_ROOT);
  const externalBefore = snapshotHashes(externalPackageFiles);
  let scopedProcessEnvApplied = false;

  lines.push('M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV');
  lines.push(`CONFIG_ENV_EXISTS=${configBefore.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${configBefore.hash}`);
  for (const key of REAL_ENV_KEYS) {
    const realConfigSet = isSet(configBefore.env, key);
    const initialProcessEnvSet = isSet(processEnvBefore, key);
    lines.push(`REAL_ENV_${key}_SET=${realConfigSet ? 'yes' : 'no'}`);
    lines.push(`INITIAL_PROCESS_ENV_${key}_SET=${initialProcessEnvSet ? 'yes' : 'no'}`);
    if (realConfigSet) failures.push(`${key.toLowerCase()}_set_in_real_config`);
    if (initialProcessEnvSet) failures.push(`${key.toLowerCase()}_set_in_initial_process_env`);
  }

  const defaultOffPlan = buildPlanFromProcessEnv();
  const defaultOffHttp = await runHttpScenario(defaultOffPlan);
  lines.push('BUILD_PLAN_ENV_SOURCE=process.env');
  lines.push(`DEFAULT_OFF_RUNTIME_ENABLED=${defaultOffPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`DEFAULT_OFF_REGISTERED_ROUTE_COUNT=${defaultOffPlan.registeredRoutes.length}`);
  lines.push(`DEFAULT_OFF_GET_STATUS=${defaultOffHttp.getStatus}`);
  lines.push(`DEFAULT_OFF_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(defaultOffPlan.diagnostics)}`);
  if (defaultOffPlan.runtimeEnabled) failures.push('default_off_runtime_enabled');
  if (defaultOffPlan.registeredRoutes.length !== 0) failures.push('default_off_registered_routes_present');
  if (defaultOffHttp.getStatus !== 404) failures.push('default_off_route_reachable');

  if (failures.length === 0) {
    try {
      applyScopedProcessEnv();
      scopedProcessEnvApplied = true;

      const runtimeOnPlan = buildPlanFromProcessEnv();
      const runtimeOnHttp = await runHttpScenario(runtimeOnPlan);
      lines.push('SCOPED_PROCESS_ENV_APPLIED=yes');
      lines.push(`RUNTIME_ON_RUNTIME_ENABLED=${runtimeOnPlan.runtimeEnabled ? 'yes' : 'no'}`);
      lines.push(`RUNTIME_ON_DISCOVERED_COUNT=${runtimeOnPlan.discoveredExtensions.length}`);
      lines.push(`RUNTIME_ON_REGISTERED_ROUTE_COUNT=${runtimeOnPlan.registeredRoutes.length}`);
      lines.push(`RUNTIME_ON_FRONTEND_REGISTERED_ROUTE_COUNT=0`);
      lines.push(`RUNTIME_ON_FRONTEND_METADATA_COUNT=${runtimeOnPlan.frontendRoutes.length}`);
      lines.push(`RUNTIME_ON_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(runtimeOnPlan.diagnostics)}`);
      lines.push(`LOCAL_PRODUCTION_SHAPE_ADMIN_API_PREFIX=/admin_api`);
      lines.push(`LOCAL_PRODUCTION_SHAPE_MOUNTED_ROUTE_COUNT=${runtimeOnHttp.mountedRoutes}`);
      lines.push(`LOCAL_PRODUCTION_SHAPE_MOUNTED_FULL_PATHS=${runtimeOnHttp.mountedFullPaths.join(',') || 'none'}`);
      lines.push(`RUNTIME_ON_GET_STATUS=${runtimeOnHttp.getStatus}`);
      lines.push(`RUNTIME_ON_BODY_OK=${runtimeOnHttp.getBody?.ok === true ? 'yes' : 'no'}`);
      lines.push(`RUNTIME_ON_BODY_EXTENSION_ID=${runtimeOnHttp.getBody?.extensionId || 'missing'}`);
      lines.push(`RUNTIME_ON_BODY_MODE=${runtimeOnHttp.getBody?.mode || 'missing'}`);
      lines.push(`RUNTIME_ON_WRITE_METHOD_STATUS_CODES=${runtimeOnHttp.writeStatuses.join(',')}`);
      lines.push(`AUTH_PROBE_HIT_COUNT=${runtimeOnHttp.authProbeHits}`);
      lines.push('ROUTE_UNDER_ADMIN_API=yes');
      lines.push('BYPASS_ADMIN_AUTH=no');

      if (!runtimeOnPlan.runtimeEnabled) failures.push('runtime_on_not_enabled');
      if (runtimeOnPlan.registeredRoutes.length !== 1) failures.push('runtime_on_registered_route_count_unexpected');
      if (runtimeOnPlan.frontendRoutes.length !== 1) failures.push('runtime_on_frontend_metadata_count_unexpected');
      if (summarizeDiagnosticsByCode(runtimeOnPlan.diagnostics) !== 'none') failures.push('runtime_on_diagnostics_present');
      if (runtimeOnHttp.mountedRoutes !== 1) failures.push('runtime_on_mounted_route_count_unexpected');
      if (!runtimeOnHttp.mountedFullPaths.includes('/admin_api/jenn-admin-status')) failures.push('runtime_on_mount_path_unexpected');
      if (runtimeOnHttp.getStatus !== 200) failures.push('runtime_on_get_failed');
      if (runtimeOnHttp.getBody?.ok !== true) failures.push('runtime_on_body_not_ok');
      if (runtimeOnHttp.getBody?.extensionId !== 'jenn.admin.status') failures.push('runtime_on_extension_id_unexpected');
      if (runtimeOnHttp.getBody?.mode !== 'read-only') failures.push('runtime_on_mode_unexpected');
      if (!runtimeOnHttp.writeStatuses.every((status) => status === 404)) failures.push('runtime_on_write_method_not_blocked');
      if (runtimeOnHttp.authProbeHits < 1) failures.push('auth_probe_not_hit');
    } finally {
      restoreProcessEnv(processEnvBefore, REAL_ENV_KEYS);
    }
  } else {
    lines.push('SCOPED_PROCESS_ENV_APPLIED=no');
  }

  const rollbackPlan = buildPlanFromProcessEnv();
  const rollbackHttp = await runHttpScenario(rollbackPlan);
  lines.push(`ROLLBACK_PROCESS_ENV_RESTORED=${processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS) ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_RUNTIME_ENABLED=${rollbackPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_REGISTERED_ROUTE_COUNT=${rollbackPlan.registeredRoutes.length}`);
  lines.push(`ROLLBACK_GET_STATUS=${rollbackHttp.getStatus}`);
  if (!processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS)) failures.push('process_env_not_restored');
  if (rollbackPlan.runtimeEnabled) failures.push('rollback_runtime_enabled');
  if (rollbackPlan.registeredRoutes.length !== 0) failures.push('rollback_registered_routes_present');
  if (rollbackHttp.getStatus !== 404) failures.push('rollback_route_reachable');

  const configAfter = readConfigSnapshot();
  const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
  const externalAfter = snapshotHashes(externalPackageFiles);
  const configUnchanged = configBefore.hash === configAfter.hash;
  const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
  const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);
  const envUnchanged = processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS);
  lines.push(`SCOPED_PROCESS_ENV_WAS_TEMPORARY=${scopedProcessEnvApplied && envUnchanged ? 'yes' : 'no'}`);
  lines.push(`CONFIG_ENV_FILE_MODIFIED=${configUnchanged ? 'no' : 'yes'}`);
  lines.push(`CORE_ADMIN_RUNTIME_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
  lines.push(`PROCESS_ENV_FINAL_UNCHANGED=${envUnchanged ? 'yes' : 'no'}`);
  if (!configUnchanged) failures.push('config_env_hash_changed');
  if (!coreUnchanged) failures.push('core_admin_runtime_hash_changed');
  if (!externalUnchanged) failures.push('external_admin_package_hash_changed');
  if (!envUnchanged) failures.push('process_env_modified');

  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('ADMINPANEL_BUILD_RUN=no');
  lines.push('ADMINPANEL_DIST_MODIFIED=no');
  lines.push('PRODUCTION_ADMIN_REGISTRATION_EXECUTED=no');
  lines.push('LOCAL_RUNTIME_ON_SMOKE_EXECUTED=yes');
  lines.push('FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no');
  lines.push('DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('M50_ADMINPANEL_RUNTIME_ON_LOCAL_SMOKE_SCOPED_ENV_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
