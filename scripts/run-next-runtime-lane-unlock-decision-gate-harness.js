#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { createAgentRootResolver } = require('../modules/agentRootResolver');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const CORE_AGENT_ROOT = path.join(CORE_ROOT, 'Agent');

const PACKAGE_ROOTS = Object.freeze({
  admin: path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus'),
  aiImage: path.join(EXTERNAL_ROOT, 'AIImageAdapters', 'JennImageProviderAdapter'),
  memory: path.join(EXTERNAL_ROOT, 'MemoryBridges', 'JennCodexMemoryBridge'),
  photoStudio: path.join(EXTERNAL_ROOT, 'PhotoStudioPackages', 'JennPhotoStudioPackage')
});

const RECEIPTS = Object.freeze({
  admin: path.join(CORE_ROOT, 'docs', 'governance', 'CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M31_ADMINPANEL_PERSISTENT_PACKAGE_GATE_RECEIPT_20260621.md'),
  aiImage: path.join(CORE_ROOT, 'docs', 'governance', 'CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M32_AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_RECEIPT_20260621.md'),
  memory: path.join(CORE_ROOT, 'docs', 'governance', 'CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M33_CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_RECEIPT_20260621.md'),
  photoStudio: path.join(CORE_ROOT, 'docs', 'governance', 'CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M34_PHOTOSTUDIO_SOURCE_PACKAGE_GATE_RECEIPT_20260621.md')
});

const RECEIPT_STATUS_MARKERS = Object.freeze({
  admin: 'Status: PASS_PERSISTENT_PACKAGE_NO_RUNTIME_REGISTRATION',
  aiImage: 'Status: PASS_PROVIDER_ADAPTER_PACKAGE_NO_PROVIDER_RUNTIME',
  memory: 'Status: PASS_MEMORY_BRIDGE_PACKAGE_NO_LIVE_WRITE',
  photoStudio: 'Status: PASS_PHOTOSTUDIO_SOURCE_PACKAGE_NO_AUTO_WRITE'
});

const AGENT_ENV_KEYS = Object.freeze([
  'VCP_AGENT_ALLOWED_ROOTS',
  'VCP_AGENT_DIRS',
  'VCP_AGENT_OVERRIDE_DIRS'
]);

const NON_AGENT_RUNTIME_ENV_KEYS = Object.freeze([
  'VCP_PLUGIN_ALLOWED_ROOTS',
  'VCP_PLUGIN_DIRS',
  'VCP_PLUGIN_INSTALL_DIR',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST',
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

const TRUE_FLAG_KEYS = Object.freeze([
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_CODEX_MEMORY_LIVE_WRITE',
  'ENABLE_PHOTOSTUDIO_AUTO_WRITE'
]);

const BLOCKED_PATH_PATTERNS = Object.freeze([
  /(^|[\\/])\.agent_board([\\/]|$)/i,
  /(^|[\\/])LocalState([\\/]|$)/i,
  /(^|[\\/])(cache|logs?|state|tmp|output|outputs|secrets|image)([\\/]|$)/i,
  /(^|[\\/])(\.env|config\.env)(\.|[\\/]|$)/i,
  /(secret|token|credential|password|auth)/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
]);

const SOURCE_REF_TARGETS = Object.freeze([
  'server.js',
  'modules',
  'routes',
  path.join('AdminPanel-Vue', 'src')
]);

const CANDIDATE_REF_NEEDLES = Object.freeze({
  admin: ['VCP_ADMIN_EXTENSION_DIRS'],
  aiImageAdapter: ['VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS', 'VCP_AI_IMAGE_ADAPTER_DIRS'],
  aiImageRealFlag: ['ENABLE_AI_IMAGE_REAL_EXECUTION'],
  memory: ['VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS', 'VCP_CODEX_MEMORY_BRIDGE_DIRS', 'ENABLE_CODEX_MEMORY_LIVE_WRITE'],
  photoStudioPackage: ['VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS', 'VCP_PHOTOSTUDIO_PACKAGE_DIRS', 'ENABLE_PHOTOSTUDIO_AUTO_WRITE'],
  photoStudioData: ['PHOTO_STUDIO_DATA_DIR'],
  localState: ['VCP_LOCAL_STATE_DIR']
});

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function countSetKeys(env, keys) {
  return keys.filter((key) => isSet(env, key)).length;
}

function readConfigSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      env: {},
      hash: 'missing',
      lineCounts: new Map()
    };
  }

  const raw = fs.readFileSync(CONFIG_ENV_PATH);
  const text = raw.toString('utf8');
  const lineCounts = new Map([...AGENT_ENV_KEYS, ...NON_AGENT_RUNTIME_ENV_KEYS].map((key) => {
    const matches = text.match(new RegExp(`^\\s*${key}\\s*=`, 'gm'));
    return [key, matches ? matches.length : 0];
  }));

  return {
    exists: true,
    env: dotenv.parse(raw),
    hash: crypto.createHash('sha256').update(raw).digest('hex'),
    lineCounts
  };
}

function toPosix(value) {
  return value.split(path.sep).join('/');
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
  return files.sort((left, right) => toPosix(left).localeCompare(toPosix(right)));
}

function scanPackagePaths(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return {
      exists: false,
      pathCount: 0,
      riskCount: 0,
      agentBoardCount: 0,
      localStateCount: 0
    };
  }

  const files = listFiles(rootPath);
  let riskCount = 0;
  let agentBoardCount = 0;
  let localStateCount = 0;

  for (const filePath of files) {
    const relative = toPosix(path.relative(EXTERNAL_ROOT, filePath));
    if (relative.split('/').includes('.agent_board')) agentBoardCount += 1;
    if (relative.split('/').includes('LocalState')) localStateCount += 1;
    if (BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(relative))) riskCount += 1;
  }

  return {
    exists: true,
    pathCount: files.length,
    riskCount,
    agentBoardCount,
    localStateCount
  };
}

function receiptHasMarker(receiptKey) {
  const receiptPath = RECEIPTS[receiptKey];
  if (!fs.existsSync(receiptPath)) return false;
  const text = fs.readFileSync(receiptPath, 'utf8');
  return text.includes(RECEIPT_STATUS_MARKERS[receiptKey]);
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

function evaluateAgentAdditiveCandidate(env) {
  const candidateEnv = {
    ...env,
    VCP_AGENT_ALLOWED_ROOTS: env.VCP_AGENT_ALLOWED_ROOTS || EXTERNAL_ROOT,
    VCP_AGENT_DIRS: path.join(EXTERNAL_ROOT, 'Agent'),
    VCP_AGENT_OVERRIDE_DIRS: env.VCP_AGENT_OVERRIDE_DIRS || path.join(EXTERNAL_ROOT, 'AgentOverrides')
  };
  const resolver = createAgentRootResolver({
    projectRoot: CORE_ROOT,
    env: candidateEnv,
    coreAgentRoot: CORE_AGENT_ROOT
  });
  const plan = resolver.getAgentFilePlanSync();
  return {
    additiveRootCount: plan.snapshot.externalAdditiveRoots.length,
    overrideRootCount: plan.snapshot.externalOverrideRoots.length,
    additiveFileCount: plan.additiveFiles.length,
    overrideFileCount: plan.overrideFiles.length,
    skippedFileCount: plan.skippedFiles.length,
    diagnosticCodes: countDiagnosticsByCode(plan.diagnostics),
    duplicateCoreCount: plan.skippedFiles.filter((file) => file.skippedReason === 'additive_duplicate_core_agent').length
  };
}

function sourceFiles() {
  const files = [];
  for (const target of SOURCE_REF_TARGETS) {
    const fullPath = path.join(CORE_ROOT, target);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      files.push(fullPath);
    } else if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    }
  }
  return files;
}

function countSourceRefs(needles) {
  let count = 0;
  for (const filePath of sourceFiles()) {
    const text = fs.readFileSync(filePath, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) count += 1;
    }
  }
  return count;
}

function packageGate(packageKey) {
  const scan = scanPackagePaths(PACKAGE_ROOTS[packageKey]);
  return {
    exists: scan.exists,
    pathCount: scan.pathCount,
    riskCount: scan.riskCount,
    agentBoardCount: scan.agentBoardCount,
    localStateCount: scan.localStateCount,
    receiptPass: receiptHasMarker(packageKey)
  };
}

function blockersText(items) {
  return items.length ? items.join(',') : 'none';
}

function main() {
  const config = readConfigSnapshot();
  const env = config.env;
  const lines = [];
  const failures = [];

  lines.push('M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE');
  lines.push(`CONFIG_ENV_EXISTS=${config.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push('CONFIG_ENV_FILE_MODIFIED=no');
  lines.push(`CONFIG_ENV_SHA256=${config.hash}`);

  if (!config.exists) failures.push('config_env_missing');

  for (const key of AGENT_ENV_KEYS) {
    lines.push(`${key}_LINE_COUNT=${config.lineCounts.get(key) || 0}`);
    lines.push(`ENV_${key}_SET=${isSet(env, key) ? 'yes' : 'no'}`);
  }
  lines.push(`REAL_ENV_AGENT_KEYS_SET_COUNT=${countSetKeys(env, AGENT_ENV_KEYS)}`);
  lines.push(`REAL_ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=${countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS)}`);

  if (!isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')) failures.push('agent_allowed_roots_unset');
  if (!isSet(env, 'VCP_AGENT_OVERRIDE_DIRS')) failures.push('agent_override_dirs_unset');
  if (isSet(env, 'VCP_AGENT_DIRS')) failures.push('agent_additive_dirs_must_remain_unset');
  if (countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS) > 0) failures.push('non_agent_runtime_keys_set');

  for (const key of TRUE_FLAG_KEYS) {
    lines.push(`ENV_${key}_TRUE=${isTruthy(env[key]) ? 'yes' : 'no'}`);
    if (isTruthy(env[key])) failures.push(`${key.toLowerCase()}_true`);
  }

  const currentOverrideOnly = isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')
    && isSet(env, 'VCP_AGENT_OVERRIDE_DIRS')
    && !isSet(env, 'VCP_AGENT_DIRS')
    && countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS) === 0;
  lines.push(`CURRENT_RUNTIME_STATE=${currentOverrideOnly ? 'agent-overrides-only' : 'unexpected'}`);

  const agentAdditive = evaluateAgentAdditiveCandidate(env);
  const agentAdditiveBlockers = [];
  if (agentAdditive.duplicateCoreCount > 0) agentAdditiveBlockers.push(`additive_duplicate_core_agent:${agentAdditive.duplicateCoreCount}`);
  if (agentAdditive.diagnosticCodes !== 'none') agentAdditiveBlockers.push(`diagnostics:${agentAdditive.diagnosticCodes}`);
  lines.push('AGENT_ADDITIVE_CANDIDATE_STATUS=BLOCK');
  lines.push(`AGENT_ADDITIVE_AUTO_UNLOCKABLE=no`);
  lines.push(`AGENT_ADDITIVE_ROOT_COUNT=${agentAdditive.additiveRootCount}`);
  lines.push(`AGENT_ADDITIVE_FILE_COUNT=${agentAdditive.additiveFileCount}`);
  lines.push(`AGENT_ADDITIVE_SKIPPED_FILE_COUNT=${agentAdditive.skippedFileCount}`);
  lines.push(`AGENT_ADDITIVE_DIAGNOSTIC_CODES=${agentAdditive.diagnosticCodes}`);
  lines.push(`AGENT_ADDITIVE_BLOCKERS=${blockersText(agentAdditiveBlockers)}`);
  if (agentAdditiveBlockers.length === 0) failures.push('agent_additive_candidate_unexpectedly_unblocked');

  const adminGate = packageGate('admin');
  const adminRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.admin);
  const adminBlockers = ['no_core_runtime_loader', 'requires_default_off_registration_design', 'real_env_not_enabled'];
  lines.push('ADMINPANEL_CANDIDATE_STATUS=DEFERRED');
  lines.push('ADMINPANEL_AUTO_UNLOCKABLE=no');
  lines.push(`ADMINPANEL_PACKAGE_PRESENT=${adminGate.exists ? 'yes' : 'no'}`);
  lines.push(`ADMINPANEL_PACKAGE_RECEIPT_PASS=${adminGate.receiptPass ? 'yes' : 'no'}`);
  lines.push(`ADMINPANEL_PACKAGE_PATH_RISK_COUNT=${adminGate.riskCount}`);
  lines.push(`ADMINPANEL_RUNTIME_LOADER_REF_COUNT=${adminRefs}`);
  lines.push(`ADMINPANEL_BLOCKERS=${blockersText(adminBlockers)}`);

  const aiGate = packageGate('aiImage');
  const aiAdapterRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.aiImageAdapter);
  const aiRealFlagRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.aiImageRealFlag);
  const aiBlockers = ['no_adapter_dir_loader', 'provider_auth_not_enabled', 'requires_no_provider_runtime_registration_design'];
  lines.push('AI_IMAGE_CANDIDATE_STATUS=DEFERRED');
  lines.push('AI_IMAGE_AUTO_UNLOCKABLE=no');
  lines.push(`AI_IMAGE_PACKAGE_PRESENT=${aiGate.exists ? 'yes' : 'no'}`);
  lines.push(`AI_IMAGE_PACKAGE_RECEIPT_PASS=${aiGate.receiptPass ? 'yes' : 'no'}`);
  lines.push(`AI_IMAGE_PACKAGE_PATH_RISK_COUNT=${aiGate.riskCount}`);
  lines.push(`AI_IMAGE_ADAPTER_DIR_LOADER_REF_COUNT=${aiAdapterRefs}`);
  lines.push(`AI_IMAGE_REAL_EXECUTION_REF_COUNT=${aiRealFlagRefs}`);
  lines.push(`AI_IMAGE_BLOCKERS=${blockersText(aiBlockers)}`);

  const memoryGate = packageGate('memory');
  const memoryRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.memory);
  const memoryBlockers = ['no_memory_bridge_runtime_loader', 'live_write_not_enabled', 'private_memory_gate_required'];
  lines.push('CODEX_MEMORY_CANDIDATE_STATUS=DEFERRED');
  lines.push('CODEX_MEMORY_AUTO_UNLOCKABLE=no');
  lines.push(`CODEX_MEMORY_PACKAGE_PRESENT=${memoryGate.exists ? 'yes' : 'no'}`);
  lines.push(`CODEX_MEMORY_PACKAGE_RECEIPT_PASS=${memoryGate.receiptPass ? 'yes' : 'no'}`);
  lines.push(`CODEX_MEMORY_PACKAGE_PATH_RISK_COUNT=${memoryGate.riskCount}`);
  lines.push(`CODEX_MEMORY_RUNTIME_LOADER_REF_COUNT=${memoryRefs}`);
  lines.push(`CODEX_MEMORY_BLOCKERS=${blockersText(memoryBlockers)}`);

  const photoGate = packageGate('photoStudio');
  const photoPackageRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.photoStudioPackage);
  const photoDataRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.photoStudioData);
  const photoBlockers = ['no_photostudio_package_loader', 'project_data_private_gate_required', 'auto_write_not_enabled'];
  lines.push('PHOTOSTUDIO_CANDIDATE_STATUS=DEFERRED');
  lines.push('PHOTOSTUDIO_AUTO_UNLOCKABLE=no');
  lines.push(`PHOTOSTUDIO_PACKAGE_PRESENT=${photoGate.exists ? 'yes' : 'no'}`);
  lines.push(`PHOTOSTUDIO_PACKAGE_RECEIPT_PASS=${photoGate.receiptPass ? 'yes' : 'no'}`);
  lines.push(`PHOTOSTUDIO_PACKAGE_PATH_RISK_COUNT=${photoGate.riskCount}`);
  lines.push(`PHOTOSTUDIO_PACKAGE_RUNTIME_LOADER_REF_COUNT=${photoPackageRefs}`);
  lines.push(`PHOTOSTUDIO_DATA_DIR_REF_COUNT=${photoDataRefs}`);
  lines.push(`PHOTOSTUDIO_BLOCKERS=${blockersText(photoBlockers)}`);

  const localStateRefs = countSourceRefs(CANDIDATE_REF_NEEDLES.localState);
  lines.push('LOCALSTATE_CANDIDATE_STATUS=BLOCK');
  lines.push('LOCALSTATE_AUTO_UNLOCKABLE=no');
  lines.push(`LOCALSTATE_RUNTIME_REF_COUNT=${localStateRefs}`);
  lines.push('LOCALSTATE_BLOCKERS=private_content_human_gate_required,agent_board_default_blocked');

  lines.push('UPSTREAM_PR_CANDIDATE_STATUS=DEFERRED');
  lines.push('UPSTREAM_PR_AUTO_UNLOCKABLE=no');
  lines.push('UPSTREAM_PR_BLOCKERS=current_turn_upstream_pr_authorization_missing,upstream_gate_deferred');

  for (const [key, gate] of Object.entries({ admin: adminGate, aiImage: aiGate, memory: memoryGate, photoStudio: photoGate })) {
    if (!gate.exists) failures.push(`${key}_package_missing`);
    if (!gate.receiptPass) failures.push(`${key}_receipt_pass_missing`);
    if (gate.riskCount !== 0) failures.push(`${key}_package_path_risk_present`);
    if (gate.agentBoardCount !== 0) failures.push(`${key}_agent_board_path_present`);
    if (gate.localStateCount !== 0) failures.push(`${key}_localstate_path_present`);
  }

  lines.push('NEXT_AUTO_UNLOCKABLE_LANE=none');
  lines.push('RECOMMENDED_NEXT_SAFE_MILESTONE=M47_ADMINPANEL_RUNTIME_REGISTRATION_TASKBOOK');
  lines.push('STOP_REQUIRED_AFTER_M46=yes');
  lines.push('STOP_REASON=next_step_requires_default_off_runtime_registration_design_or_human_env_authorization');
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push('CONFIG_ENV_FILE_MODIFIED=no');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M46_NEXT_RUNTIME_LANE_UNLOCK_DECISION_GATE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
