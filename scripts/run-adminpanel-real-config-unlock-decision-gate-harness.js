#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
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
const CHECKSUM_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifests', 'MANIFEST.sha256');

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

const FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_CODEX_MEMORY_LIVE_WRITE',
  'ENABLE_PHOTOSTUDIO_AUTO_WRITE'
]);

const BLOCKED_PATH_SEGMENTS = new Set([
  '.agent_board',
  'LocalState',
  'state',
  'cache',
  'log',
  'logs',
  'DebugLog',
  'image',
  'output',
  'outputs',
  'secrets',
  'private'
]);

const RISKY_PATH_PATTERNS = Object.freeze([
  /(^|[\\/])\.env($|[\\/])/i,
  /(^|[\\/])config\.env($|[\\/])/i,
  /(^|[\\/])code\.bin$/i,
  /secret/i,
  /token/i,
  /credential/i,
  /password/i,
  /auth/i,
  /\.(sqlite|sqlite3|db|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
]);

function readConfigSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      env: {},
      beforeHash: 'missing',
      afterHash: 'missing',
      hashUnchanged: true
    };
  }

  const before = fs.readFileSync(CONFIG_ENV_PATH);
  const env = dotenv.parse(before);
  const after = fs.readFileSync(CONFIG_ENV_PATH);
  const beforeHash = crypto.createHash('sha256').update(before).digest('hex');
  const afterHash = crypto.createHash('sha256').update(after).digest('hex');

  return {
    exists: true,
    env,
    beforeHash,
    afterHash,
    hashUnchanged: beforeHash === afterHash
  };
}

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function countSetKeys(env, keys) {
  return keys.filter((key) => isSet(env, key)).length;
}

function hasBlockedSegment(targetPath) {
  return path.resolve(targetPath)
    .split(/[\\/]+/)
    .some((segment) => BLOCKED_PATH_SEGMENTS.has(segment));
}

function scanPathRisk(rootPaths) {
  const result = {
    pathCount: 0,
    riskCount: 0,
    agentBoardPathCount: 0,
    localStatePathCount: 0,
    privatePathCount: 0
  };

  function visit(targetPath) {
    let entries;
    try {
      entries = fs.readdirSync(targetPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      const normalized = entryPath.replace(/\\/g, '/');
      const segments = normalized.split('/');
      result.pathCount += 1;

      if (segments.includes('.agent_board')) {
        result.agentBoardPathCount += 1;
        continue;
      }
      if (segments.includes('LocalState')) {
        result.localStatePathCount += 1;
        continue;
      }
      if (segments.includes('private')) {
        result.privatePathCount += 1;
        continue;
      }
      if (RISKY_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
        result.riskCount += 1;
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        visit(entryPath);
      }
    }
  }

  for (const rootPath of rootPaths) {
    if (fs.existsSync(rootPath) && !hasBlockedSegment(rootPath)) {
      visit(rootPath);
    }
  }

  return result;
}

function createAdminCandidateEnv(realEnv) {
  return {
    ...realEnv,
    [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
    [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
  };
}

function evaluateAdminPlan(env) {
  const plan = buildAdminExtensionPlan({
    projectRoot: CORE_ROOT,
    externalRoot: EXTERNAL_ROOT,
    checksumManifestPath: CHECKSUM_MANIFEST_PATH,
    env
  });

  return {
    runtimeEnabled: plan.runtimeEnabled,
    allowedRootCount: plan.allowedRootCount,
    extensionDirCount: plan.extensionDirCount,
    allowlistCount: plan.allowlistCount,
    discoveredCount: plan.discoveredExtensions.length,
    registeredRouteCount: plan.registeredRoutes.length,
    frontendRouteCount: plan.frontendRoutes.length,
    diagnosticCodes: summarizeDiagnosticsByCode(plan.diagnostics),
    mountedPath: plan.registeredRoutes[0]?.mountPath || 'none',
    routeMethods: (plan.registeredRoutes[0]?.methods || []).join(',') || 'none',
    routeRequiresAuth: plan.registeredRoutes[0]?.requiresAuth === true,
    routeWriteCapable: plan.registeredRoutes[0]?.writeCapable === true
  };
}

function adminEnvMode(realEnv) {
  const realAdminKeysSetCount = countSetKeys(realEnv, ADMIN_ENV_KEYS);
  if (realAdminKeysSetCount === 0) return 'pre-apply-decision';
  if (realAdminKeysSetCount === ADMIN_ENV_KEYS.length) return 'post-apply-validation';
  return 'partial-admin-env-block';
}

function main() {
  const failures = [];
  const lines = [];
  const snapshot = readConfigSnapshot();
  const realEnv = snapshot.env;
  const initialProcessAdminKeysSetCount = countSetKeys(process.env, ADMIN_ENV_KEYS);
  const realAdminKeysSetCount = countSetKeys(realEnv, ADMIN_ENV_KEYS);
  const existingAllowedAgentKeysSetCount = countSetKeys(realEnv, CURRENTLY_ALLOWED_AGENT_RUNTIME_KEYS);
  const blockedRuntimeKeysSetCount = countSetKeys(realEnv, BLOCKED_RUNTIME_ENV_KEYS);
  const mode = adminEnvMode(realEnv);

  lines.push('M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE');
  lines.push(`CONFIG_ENV_EXISTS=${snapshot.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push('CONFIG_ENV_EDIT_APPLIED=no');
  lines.push(`CONFIG_ENV_SHA256=${snapshot.beforeHash}`);
  lines.push(`CONFIG_ENV_HASH_UNCHANGED=${snapshot.hashUnchanged ? 'yes' : 'no'}`);
  lines.push(`GATE_MODE=${mode}`);
  lines.push(`REAL_ENV_ADMIN_KEYS_SET_COUNT=${realAdminKeysSetCount}`);
  lines.push(`INITIAL_PROCESS_ENV_ADMIN_KEYS_SET_COUNT=${initialProcessAdminKeysSetCount}`);
  lines.push(`REAL_ENV_ALLOWED_AGENT_RUNTIME_KEYS_SET_COUNT=${existingAllowedAgentKeysSetCount}`);
  lines.push(`REAL_ENV_BLOCKED_RUNTIME_KEYS_SET_COUNT=${blockedRuntimeKeysSetCount}`);

  if (!snapshot.exists) failures.push('config_env_missing');
  if (!snapshot.hashUnchanged) failures.push('config_env_hash_changed_during_gate');
  if (mode === 'partial-admin-env-block') failures.push('partial_admin_extension_env_keys_present');
  if (initialProcessAdminKeysSetCount > 0) failures.push('admin_extension_keys_set_in_initial_process_env');
  if (blockedRuntimeKeysSetCount > 0) failures.push('blocked_runtime_keys_set_in_real_config');
  for (const key of FORBIDDEN_TRUE_FLAGS) {
    if (isTruthy(realEnv[key])) {
      failures.push(`${key.toLowerCase()}_true`);
    }
  }

  const defaultOffPlan = evaluateAdminPlan(realEnv);
  lines.push(`REAL_ENV_ADMIN_RUNTIME_ENABLED=${defaultOffPlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`REAL_ENV_ADMIN_REGISTERED_ROUTE_COUNT=${defaultOffPlan.registeredRouteCount}`);
  lines.push(`REAL_ENV_ADMIN_DIAGNOSTIC_CODES=${defaultOffPlan.diagnosticCodes}`);

  if (mode === 'pre-apply-decision') {
    if (defaultOffPlan.runtimeEnabled) failures.push('real_env_admin_runtime_enabled_pre_apply');
    if (defaultOffPlan.registeredRouteCount !== 0) failures.push('real_env_admin_routes_registered_pre_apply');
  }

  const candidateEnv = mode === 'post-apply-validation'
    ? realEnv
    : createAdminCandidateEnv(realEnv);
  const candidateAdminKeysSetCount = countSetKeys(candidateEnv, ADMIN_ENV_KEYS);
  const candidateBlockedRuntimeKeysSetCount = countSetKeys(candidateEnv, BLOCKED_RUNTIME_ENV_KEYS);
  const pathRisk = scanPathRisk([ADMIN_EXTENSION_ROOT]);
  const candidatePlan = evaluateAdminPlan(candidateEnv);

  lines.push('SELECTED_UNLOCK_CANDIDATE=adminpanel-backend-readonly');
  lines.push('SELECTED_FRONTEND_RUNTIME=no');
  lines.push('SELECTED_PRODUCTION_SERVER_SMOKE=no');
  lines.push(`CANDIDATE_ADMIN_KEYS_SET_COUNT=${candidateAdminKeysSetCount}`);
  lines.push(`CANDIDATE_BLOCKED_RUNTIME_KEYS_SET_COUNT=${candidateBlockedRuntimeKeysSetCount}`);
  lines.push(`EXTERNAL_ROOT_EXISTS=${fs.existsSync(EXTERNAL_ROOT) ? 'yes' : 'no'}`);
  lines.push(`ADMIN_EXTENSION_ROOT_EXISTS=${fs.existsSync(ADMIN_EXTENSION_ROOT) ? 'yes' : 'no'}`);
  lines.push(`CHECKSUM_MANIFEST_EXISTS=${fs.existsSync(CHECKSUM_MANIFEST_PATH) ? 'yes' : 'no'}`);
  lines.push(`TARGET_PATH_SCAN_COUNT=${pathRisk.pathCount}`);
  lines.push(`TARGET_PATH_RISK_COUNT=${pathRisk.riskCount}`);
  lines.push(`TARGET_AGENT_BOARD_PATH_COUNT=${pathRisk.agentBoardPathCount}`);
  lines.push(`TARGET_LOCALSTATE_PATH_COUNT=${pathRisk.localStatePathCount}`);
  lines.push(`TARGET_PRIVATE_PATH_COUNT=${pathRisk.privatePathCount}`);
  lines.push(`CANDIDATE_RUNTIME_ENABLED=${candidatePlan.runtimeEnabled ? 'yes' : 'no'}`);
  lines.push(`CANDIDATE_ALLOWED_ROOT_COUNT=${candidatePlan.allowedRootCount}`);
  lines.push(`CANDIDATE_EXTENSION_DIR_COUNT=${candidatePlan.extensionDirCount}`);
  lines.push(`CANDIDATE_ALLOWLIST_COUNT=${candidatePlan.allowlistCount}`);
  lines.push(`CANDIDATE_DISCOVERED_EXTENSION_COUNT=${candidatePlan.discoveredCount}`);
  lines.push(`CANDIDATE_REGISTERED_ROUTE_COUNT=${candidatePlan.registeredRouteCount}`);
  lines.push(`CANDIDATE_FRONTEND_METADATA_COUNT=${candidatePlan.frontendRouteCount}`);
  lines.push(`CANDIDATE_DIAGNOSTIC_CODES=${candidatePlan.diagnosticCodes}`);
  lines.push(`CANDIDATE_MOUNT_PATH=${candidatePlan.mountedPath}`);
  lines.push(`CANDIDATE_ROUTE_METHODS=${candidatePlan.routeMethods}`);
  lines.push(`CANDIDATE_ROUTE_REQUIRES_AUTH=${candidatePlan.routeRequiresAuth ? 'yes' : 'no'}`);
  lines.push(`CANDIDATE_ROUTE_WRITE_CAPABLE=${candidatePlan.routeWriteCapable ? 'yes' : 'no'}`);

  if (candidateAdminKeysSetCount !== ADMIN_ENV_KEYS.length) failures.push('candidate_admin_keys_incomplete');
  if (candidateBlockedRuntimeKeysSetCount > 0) failures.push('candidate_blocked_runtime_keys_set');
  if (!fs.existsSync(EXTERNAL_ROOT)) failures.push('external_root_missing');
  if (!fs.existsSync(ADMIN_EXTENSION_ROOT)) failures.push('admin_extension_root_missing');
  if (!fs.existsSync(CHECKSUM_MANIFEST_PATH)) failures.push('checksum_manifest_missing');
  if (hasBlockedSegment(EXTERNAL_ROOT) || hasBlockedSegment(ADMIN_EXTENSION_ROOT)) {
    failures.push('candidate_admin_root_uses_blocked_private_segment');
  }
  if (pathRisk.riskCount > 0) failures.push('admin_extension_path_risk_present');
  if (pathRisk.agentBoardPathCount > 0) failures.push('admin_extension_agent_board_path_present');
  if (pathRisk.localStatePathCount > 0) failures.push('admin_extension_localstate_path_present');
  if (pathRisk.privatePathCount > 0) failures.push('admin_extension_private_path_present');
  if (!candidatePlan.runtimeEnabled) failures.push('candidate_runtime_not_enabled');
  if (candidatePlan.discoveredCount !== 1) failures.push('candidate_discovered_extension_count_unexpected');
  if (candidatePlan.registeredRouteCount !== 1) failures.push('candidate_registered_route_count_unexpected');
  if (candidatePlan.frontendRouteCount !== 1) failures.push('candidate_frontend_metadata_count_unexpected');
  if (candidatePlan.diagnosticCodes !== 'none') failures.push('candidate_admin_diagnostics_present');
  if (candidatePlan.mountedPath !== '/jenn-admin-status') failures.push('candidate_mount_path_unexpected');
  if (candidatePlan.routeMethods !== 'GET') failures.push('candidate_route_methods_unexpected');
  if (!candidatePlan.routeRequiresAuth) failures.push('candidate_route_requires_auth_false');
  if (candidatePlan.routeWriteCapable) failures.push('candidate_route_write_capable_true');

  lines.push('SERVER_STARTED=no');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('LOCAL_HTTP_TEST_SERVER_STARTED=no');
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

  if (failures.length > 0) {
    lines.push('M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M53_ADMINPANEL_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
