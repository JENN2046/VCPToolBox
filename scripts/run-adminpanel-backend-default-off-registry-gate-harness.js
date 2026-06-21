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

function createLocalAdminApp(plan) {
  const app = express();
  const registryRouter = express.Router();
  const state = {
    authProbeHits: 0,
    mountedRoutes: 0
  };

  for (const route of plan.registeredRoutes) {
    const routeModule = loadRouteModule(route);
    registryRouter.use(route.mountPath, routeModule);
    state.mountedRoutes += 1;
  }

  app.use('/admin_api', (req, _res, next) => {
    state.authProbeHits += 1;
    req.adminAuthBoundaryReached = true;
    next();
  }, registryRouter);

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
  const { app, state } = createLocalAdminApp(plan);
  const server = await startLocalTestServer(app);
  try {
    const getResult = await fetchStatus(server.baseUrl);
    const writeResults = [];
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      writeResults.push(await fetchStatus(server.baseUrl, method));
    }
    return {
      mountedRoutes: state.mountedRoutes,
      authProbeHits: state.authProbeHits,
      getStatus: getResult.status,
      getBody: getResult.body,
      writeStatuses: writeResults.map((result) => result.status)
    };
  } finally {
    await server.close();
  }
}

async function main() {
  const failures = [];
  const lines = [];
  const configBefore = readConfigSnapshot();
  const coreBefore = snapshotHashes(CORE_HASH_TARGETS);
  const externalPackageFiles = listFiles(ADMIN_EXTENSION_ROOT);
  const externalBefore = snapshotHashes(externalPackageFiles);

  lines.push('M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE');
  lines.push(`CONFIG_ENV_EXISTS=${configBefore.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${configBefore.hash}`);
  for (const key of REAL_ENV_KEYS) {
    lines.push(`REAL_ENV_${key}_SET=${isSet(configBefore.env, key) ? 'yes' : 'no'}`);
    if (isSet(configBefore.env, key)) failures.push(`${key.toLowerCase()}_set_in_real_config`);
  }

  const defaultOffPlan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {}
  });
  const defaultOffHttp = await runHttpScenario(defaultOffPlan);
  lines.push(`DEFAULT_OFF_RUNTIME_ENABLED=${defaultOffPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`DEFAULT_OFF_REGISTERED_ROUTE_COUNT=${defaultOffPlan.registeredRoutes.length}`);
  lines.push(`DEFAULT_OFF_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(defaultOffPlan.diagnostics)}`);
  lines.push(`DEFAULT_OFF_GET_STATUS=${defaultOffHttp.getStatus}`);
  if (defaultOffPlan.runtimeEnabled) failures.push('default_off_runtime_enabled');
  if (defaultOffPlan.registeredRoutes.length !== 0) failures.push('default_off_registered_routes_present');
  if (defaultOffHttp.getStatus !== 404) failures.push('default_off_route_reachable');

  const dirsOnlyPlan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT
    }
  });
  lines.push(`DIRS_ONLY_RUNTIME_ENABLED=${dirsOnlyPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`DIRS_ONLY_REGISTERED_ROUTE_COUNT=${dirsOnlyPlan.registeredRoutes.length}`);
  lines.push(`DIRS_ONLY_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(dirsOnlyPlan.diagnostics)}`);
  if (dirsOnlyPlan.runtimeEnabled) failures.push('dirs_only_runtime_enabled');
  if (dirsOnlyPlan.registeredRoutes.length !== 0) failures.push('dirs_only_registered_routes_present');

  const allowlistMissingPlan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.other.extension'
    }
  });
  lines.push(`ALLOWLIST_MISSING_DISCOVERED_COUNT=${allowlistMissingPlan.discoveredExtensions.length}`);
  lines.push(`ALLOWLIST_MISSING_REGISTERED_ROUTE_COUNT=${allowlistMissingPlan.registeredRoutes.length}`);
  lines.push(`ALLOWLIST_MISSING_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(allowlistMissingPlan.diagnostics)}`);
  if (allowlistMissingPlan.discoveredExtensions.length !== 1) failures.push('allowlist_missing_discovery_unexpected');
  if (allowlistMissingPlan.registeredRoutes.length !== 0) failures.push('allowlist_missing_registered_routes_present');

  const scopedEnv = {
    [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
    [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
  };
  const envOnPlan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: scopedEnv
  });
  const envOnHttp = await runHttpScenario(envOnPlan);
  lines.push('SCOPED_ENV_USED=yes');
  lines.push('PROCESS_ENV_MODIFIED=no');
  lines.push(`ENV_ON_RUNTIME_ENABLED=${envOnPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`ENV_ON_DISCOVERED_COUNT=${envOnPlan.discoveredExtensions.length}`);
  lines.push(`ENV_ON_REGISTERED_ROUTE_COUNT=${envOnPlan.registeredRoutes.length}`);
  lines.push(`ENV_ON_FRONTEND_REGISTERED_ROUTE_COUNT=0`);
  lines.push(`ENV_ON_FRONTEND_METADATA_COUNT=${envOnPlan.frontendRoutes.length}`);
  lines.push(`ENV_ON_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(envOnPlan.diagnostics)}`);
  lines.push(`ENV_ON_LOCAL_TEST_MOUNTED_ROUTE_COUNT=${envOnHttp.mountedRoutes}`);
  lines.push(`ENV_ON_GET_STATUS=${envOnHttp.getStatus}`);
  lines.push(`ENV_ON_BODY_OK=${envOnHttp.getBody?.ok === true ? 'yes' : 'no'}`);
  lines.push(`ENV_ON_BODY_EXTENSION_ID=${envOnHttp.getBody?.extensionId || 'missing'}`);
  lines.push(`ENV_ON_BODY_MODE=${envOnHttp.getBody?.mode || 'missing'}`);
  lines.push(`AUTH_PROBE_HIT_COUNT=${envOnHttp.authProbeHits}`);
  lines.push(`ROUTE_UNDER_ADMIN_API=yes`);
  lines.push(`BYPASS_ADMIN_AUTH=no`);
  lines.push(`WRITE_METHOD_STATUS_CODES=${envOnHttp.writeStatuses.join(',')}`);
  if (!envOnPlan.runtimeEnabled) failures.push('env_on_runtime_not_enabled_in_scoped_plan');
  if (envOnPlan.registeredRoutes.length !== 1) failures.push('env_on_registered_route_count_unexpected');
  if (envOnPlan.frontendRoutes.length !== 1) failures.push('env_on_frontend_metadata_count_unexpected');
  if (summarizeDiagnosticsByCode(envOnPlan.diagnostics) !== 'none') failures.push('env_on_diagnostics_present');
  if (envOnHttp.getStatus !== 200) failures.push('env_on_get_failed');
  if (envOnHttp.getBody?.ok !== true) failures.push('env_on_body_not_ok');
  if (envOnHttp.getBody?.extensionId !== 'jenn.admin.status') failures.push('env_on_extension_id_unexpected');
  if (envOnHttp.getBody?.mode !== 'read-only') failures.push('env_on_mode_unexpected');
  if (envOnHttp.authProbeHits < 1) failures.push('auth_probe_not_hit');
  if (!envOnHttp.writeStatuses.every((status) => status === 404)) failures.push('write_method_not_blocked');

  const rollbackPlan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {}
  });
  const rollbackHttp = await runHttpScenario(rollbackPlan);
  lines.push(`ROLLBACK_REGISTERED_ROUTE_COUNT=${rollbackPlan.registeredRoutes.length}`);
  lines.push(`ROLLBACK_GET_STATUS=${rollbackHttp.getStatus}`);
  if (rollbackPlan.registeredRoutes.length !== 0) failures.push('rollback_registered_routes_present');
  if (rollbackHttp.getStatus !== 404) failures.push('rollback_route_reachable');

  const configAfter = readConfigSnapshot();
  const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
  const externalAfter = snapshotHashes(externalPackageFiles);
  const configUnchanged = configBefore.hash === configAfter.hash;
  const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
  const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);
  lines.push(`CONFIG_ENV_FILE_MODIFIED=${configUnchanged ? 'no' : 'yes'}`);
  lines.push(`CORE_ADMIN_RUNTIME_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_ADMIN_PACKAGE_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
  if (!configUnchanged) failures.push('config_env_hash_changed');
  if (!coreUnchanged) failures.push('core_admin_runtime_hash_changed');
  if (!externalUnchanged) failures.push('external_admin_package_hash_changed');

  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=yes');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('ADMINPANEL_BUILD_RUN=no');
  lines.push('ADMINPANEL_DIST_MODIFIED=no');
  lines.push('PRODUCTION_ADMIN_REGISTRATION_EXECUTED=no');
  lines.push('LOCAL_TEST_ADMIN_REGISTRATION_EXECUTED=yes');
  lines.push('FRONTEND_RUNTIME_REGISTRATION_EXECUTED=no');
  lines.push('DYNAMIC_EXTERNAL_VUE_IMPORT_EXECUTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('M48_ADMINPANEL_BACKEND_DEFAULT_OFF_REGISTRY_GATE_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
