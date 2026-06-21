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

function hashObject(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
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

function processEnvUnchanged(before, keys) {
  const after = captureProcessEnv(keys);
  return keys.every((key) => before[key] === after[key]);
}

function planSnapshot(plan) {
  return {
    runtimeEnabled: plan.runtimeEnabled,
    allowedRootCount: plan.allowedRootCount,
    extensionDirCount: plan.extensionDirCount,
    allowlistCount: plan.allowlistCount,
    diagnosticCodes: summarizeDiagnosticsByCode(plan.diagnostics),
    discoveredExtensions: plan.discoveredExtensions.map((extension) => ({
      extensionId: extension.extensionId,
      allowlisted: extension.allowlisted,
      registered: extension.registered,
      routeCount: extension.routeCount,
      frontendRouteCount: extension.frontendRouteCount,
      riskCount: extension.packageScan?.riskCount || 0,
      symlinkCount: extension.packageScan?.symlinkCount || 0,
      missingChecksumCount: extension.packageScan?.missingChecksumCount || 0,
      mismatchedChecksumCount: extension.packageScan?.mismatchedChecksumCount || 0
    })),
    registeredRoutes: plan.registeredRoutes.map((route) => ({
      extensionId: route.extensionId,
      routeId: route.routeId,
      mountPath: route.mountPath,
      methods: route.methods,
      requiresAuth: route.requiresAuth,
      writeCapable: route.writeCapable
    })),
    frontendRoutes: plan.frontendRoutes.map((route) => ({
      extensionId: route.extensionId,
      routeName: route.routeName,
      path: route.path,
      showInSidebar: route.showInSidebar
    }))
  };
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

function buildPlan(env) {
  return buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env
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

  lines.push('M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL');
  lines.push(`CONFIG_ENV_EXISTS=${configBefore.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${configBefore.hash}`);
  for (const key of REAL_ENV_KEYS) {
    lines.push(`REAL_ENV_${key}_SET=${isSet(configBefore.env, key) ? 'yes' : 'no'}`);
    if (isSet(configBefore.env, key)) failures.push(`${key.toLowerCase()}_set_in_real_config`);
  }

  const scopedEnv = {
    [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
    [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
  };

  const offPlanA = buildPlan({});
  const offHttpA = await runHttpScenario(offPlanA);
  const onPlanA = buildPlan(scopedEnv);
  const onHttpA = await runHttpScenario(onPlanA);
  const offPlanRollback = buildPlan({});
  const offHttpRollback = await runHttpScenario(offPlanRollback);
  const onPlanReapply = buildPlan(scopedEnv);
  const onHttpReapply = await runHttpScenario(onPlanReapply);
  const partialPlanAfterRollback = buildPlan({
    [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT
  });
  const partialHttpAfterRollback = await runHttpScenario(partialPlanAfterRollback);

  const offSnapshotA = planSnapshot(offPlanA);
  const onSnapshotA = planSnapshot(onPlanA);
  const offSnapshotRollback = planSnapshot(offPlanRollback);
  const onSnapshotReapply = planSnapshot(onPlanReapply);
  const offSnapshotHashA = hashObject(offSnapshotA);
  const onSnapshotHashA = hashObject(onSnapshotA);
  const offSnapshotHashRollback = hashObject(offSnapshotRollback);
  const onSnapshotHashReapply = hashObject(onSnapshotReapply);
  const offStable = offSnapshotHashA === offSnapshotHashRollback;
  const onStable = onSnapshotHashA === onSnapshotHashReapply;

  lines.push('SCOPED_ENV_USED=yes');
  lines.push(`PROCESS_ENV_MODIFIED=${processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS) ? 'no' : 'yes'}`);
  lines.push('SHADOW_SEQUENCE=off_a,scoped_on_a,rollback_off,scoped_on_reapply,partial_env_after_rollback');
  lines.push(`OFF_A_RUNTIME_ENABLED=${offPlanA.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`OFF_A_REGISTERED_ROUTE_COUNT=${offPlanA.registeredRoutes.length}`);
  lines.push(`OFF_A_GET_STATUS=${offHttpA.getStatus}`);
  lines.push(`OFF_A_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(offPlanA.diagnostics)}`);
  lines.push(`SCOPED_ON_A_RUNTIME_ENABLED=${onPlanA.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`SCOPED_ON_A_DISCOVERED_COUNT=${onPlanA.discoveredExtensions.length}`);
  lines.push(`SCOPED_ON_A_REGISTERED_ROUTE_COUNT=${onPlanA.registeredRoutes.length}`);
  lines.push(`SCOPED_ON_A_FRONTEND_REGISTERED_ROUTE_COUNT=0`);
  lines.push(`SCOPED_ON_A_FRONTEND_METADATA_COUNT=${onPlanA.frontendRoutes.length}`);
  lines.push(`SCOPED_ON_A_GET_STATUS=${onHttpA.getStatus}`);
  lines.push(`SCOPED_ON_A_BODY_OK=${onHttpA.getBody?.ok === true ? 'yes' : 'no'}`);
  lines.push(`SCOPED_ON_A_BODY_EXTENSION_ID=${onHttpA.getBody?.extensionId || 'missing'}`);
  lines.push(`SCOPED_ON_A_BODY_MODE=${onHttpA.getBody?.mode || 'missing'}`);
  lines.push(`SCOPED_ON_A_WRITE_METHOD_STATUS_CODES=${onHttpA.writeStatuses.join(',')}`);
  lines.push(`ROLLBACK_OFF_RUNTIME_ENABLED=${offPlanRollback.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_OFF_REGISTERED_ROUTE_COUNT=${offPlanRollback.registeredRoutes.length}`);
  lines.push(`ROLLBACK_OFF_GET_STATUS=${offHttpRollback.getStatus}`);
  lines.push(`SCOPED_ON_REAPPLY_RUNTIME_ENABLED=${onPlanReapply.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`SCOPED_ON_REAPPLY_REGISTERED_ROUTE_COUNT=${onPlanReapply.registeredRoutes.length}`);
  lines.push(`SCOPED_ON_REAPPLY_GET_STATUS=${onHttpReapply.getStatus}`);
  lines.push(`SCOPED_ON_REAPPLY_BODY_OK=${onHttpReapply.getBody?.ok === true ? 'yes' : 'no'}`);
  lines.push(`SCOPED_ON_REAPPLY_WRITE_METHOD_STATUS_CODES=${onHttpReapply.writeStatuses.join(',')}`);
  lines.push(`PARTIAL_ENV_AFTER_ROLLBACK_RUNTIME_ENABLED=${partialPlanAfterRollback.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`PARTIAL_ENV_AFTER_ROLLBACK_REGISTERED_ROUTE_COUNT=${partialPlanAfterRollback.registeredRoutes.length}`);
  lines.push(`PARTIAL_ENV_AFTER_ROLLBACK_GET_STATUS=${partialHttpAfterRollback.getStatus}`);
  lines.push(`PARTIAL_ENV_AFTER_ROLLBACK_DIAGNOSTIC_CODES=${summarizeDiagnosticsByCode(partialPlanAfterRollback.diagnostics)}`);
  lines.push(`OFF_PLAN_SNAPSHOT_SHA256=${offSnapshotHashA}`);
  lines.push(`ROLLBACK_OFF_PLAN_SNAPSHOT_SHA256=${offSnapshotHashRollback}`);
  lines.push(`SCOPED_ON_PLAN_SNAPSHOT_SHA256=${onSnapshotHashA}`);
  lines.push(`SCOPED_ON_REAPPLY_PLAN_SNAPSHOT_SHA256=${onSnapshotHashReapply}`);
  lines.push(`OFF_PLAN_SNAPSHOT_STABLE=${offStable ? 'yes' : 'no'}`);
  lines.push(`SCOPED_ON_PLAN_SNAPSHOT_STABLE=${onStable ? 'yes' : 'no'}`);
  lines.push(`AUTH_PROBE_HIT_COUNT=${offHttpA.authProbeHits + onHttpA.authProbeHits + offHttpRollback.authProbeHits + onHttpReapply.authProbeHits + partialHttpAfterRollback.authProbeHits}`);
  lines.push('ROUTE_UNDER_ADMIN_API=yes');
  lines.push('BYPASS_ADMIN_AUTH=no');

  if (offPlanA.runtimeEnabled) failures.push('off_a_runtime_enabled');
  if (offPlanA.registeredRoutes.length !== 0) failures.push('off_a_registered_routes_present');
  if (offHttpA.getStatus !== 404) failures.push('off_a_route_reachable');
  if (!onPlanA.runtimeEnabled) failures.push('scoped_on_a_runtime_not_enabled');
  if (onPlanA.registeredRoutes.length !== 1) failures.push('scoped_on_a_registered_route_count_unexpected');
  if (onPlanA.frontendRoutes.length !== 1) failures.push('scoped_on_a_frontend_metadata_count_unexpected');
  if (summarizeDiagnosticsByCode(onPlanA.diagnostics) !== 'none') failures.push('scoped_on_a_diagnostics_present');
  if (onHttpA.getStatus !== 200) failures.push('scoped_on_a_get_failed');
  if (onHttpA.getBody?.ok !== true) failures.push('scoped_on_a_body_not_ok');
  if (onHttpA.getBody?.extensionId !== 'jenn.admin.status') failures.push('scoped_on_a_extension_id_unexpected');
  if (onHttpA.getBody?.mode !== 'read-only') failures.push('scoped_on_a_mode_unexpected');
  if (!onHttpA.writeStatuses.every((status) => status === 404)) failures.push('scoped_on_a_write_method_not_blocked');
  if (offPlanRollback.runtimeEnabled) failures.push('rollback_off_runtime_enabled');
  if (offPlanRollback.registeredRoutes.length !== 0) failures.push('rollback_off_registered_routes_present');
  if (offHttpRollback.getStatus !== 404) failures.push('rollback_off_route_reachable');
  if (!onPlanReapply.runtimeEnabled) failures.push('scoped_on_reapply_runtime_not_enabled');
  if (onPlanReapply.registeredRoutes.length !== 1) failures.push('scoped_on_reapply_registered_route_count_unexpected');
  if (onHttpReapply.getStatus !== 200) failures.push('scoped_on_reapply_get_failed');
  if (onHttpReapply.getBody?.ok !== true) failures.push('scoped_on_reapply_body_not_ok');
  if (!onHttpReapply.writeStatuses.every((status) => status === 404)) failures.push('scoped_on_reapply_write_method_not_blocked');
  if (partialPlanAfterRollback.runtimeEnabled) failures.push('partial_env_after_rollback_runtime_enabled');
  if (partialPlanAfterRollback.registeredRoutes.length !== 0) failures.push('partial_env_after_rollback_registered_routes_present');
  if (partialHttpAfterRollback.getStatus !== 404) failures.push('partial_env_after_rollback_route_reachable');
  if (!offStable) failures.push('off_plan_snapshot_changed_after_rollback');
  if (!onStable) failures.push('scoped_on_plan_snapshot_changed_after_reapply');

  const configAfter = readConfigSnapshot();
  const coreAfter = snapshotHashes(CORE_HASH_TARGETS);
  const externalAfter = snapshotHashes(externalPackageFiles);
  const configUnchanged = configBefore.hash === configAfter.hash;
  const coreUnchanged = hashesUnchanged(coreBefore, coreAfter);
  const externalUnchanged = hashesUnchanged(externalBefore, externalAfter);
  const envUnchanged = processEnvUnchanged(processEnvBefore, REAL_ENV_KEYS);
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
    lines.push('M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('M49_ADMINPANEL_BACKEND_REGISTRY_SHADOW_ROLLBACK_DRILL_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
