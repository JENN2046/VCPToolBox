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
const EXTERNAL_AGENT_ROOT = path.join(EXTERNAL_ROOT, 'Agent');
const EXTERNAL_AGENT_OVERRIDE_ROOT = path.join(EXTERNAL_ROOT, 'AgentOverrides');

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

const FORBIDDEN_TRUE_FLAGS = Object.freeze([
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_CODEX_MEMORY_LIVE_WRITE',
  'ENABLE_PHOTOSTUDIO_AUTO_WRITE'
]);

const BLOCKED_PRIVATE_SEGMENTS = new Set([
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
  /\.(sqlite|sqlite3|db|duckdb|ldb|log)$/i
]);

function readConfigEnvSnapshot() {
  if (!fs.existsSync(CONFIG_ENV_PATH)) {
    return {
      exists: false,
      env: {},
      beforeHash: null,
      afterHash: null,
      hashUnchanged: true
    };
  }

  const before = fs.readFileSync(CONFIG_ENV_PATH);
  const parsed = dotenv.parse(before);
  const after = fs.readFileSync(CONFIG_ENV_PATH);

  const beforeHash = crypto.createHash('sha256').update(before).digest('hex');
  const afterHash = crypto.createHash('sha256').update(after).digest('hex');
  return {
    exists: true,
    env: parsed,
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

function hasBlockedSegment(targetPath) {
  return path.resolve(targetPath)
    .split(/[\\/]+/)
    .some((segment) => BLOCKED_PRIVATE_SEGMENTS.has(segment));
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
      result.pathCount += 1;

      if (normalized.split('/').includes('.agent_board')) {
        result.agentBoardPathCount += 1;
        continue;
      }
      if (normalized.split('/').includes('LocalState')) {
        result.localStatePathCount += 1;
        continue;
      }
      if (normalized.split('/').includes('private')) {
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

function evaluateAgentCandidate(candidateEnv) {
  const resolver = createAgentRootResolver({
    projectRoot: CORE_ROOT,
    env: candidateEnv,
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

function isExpectedPostApplyAgentConfig(env) {
  return isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')
    && !isSet(env, 'VCP_AGENT_DIRS')
    && isSet(env, 'VCP_AGENT_OVERRIDE_DIRS');
}

function main() {
  const snapshot = readConfigEnvSnapshot();
  const realEnv = snapshot.env;
  const failures = [];
  const lines = [];

  lines.push('AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE');
  lines.push(`CONFIG_ENV_EXISTS=${snapshot.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push('CONFIG_ENV_EDIT_APPLIED=no');
  lines.push(`CONFIG_ENV_HASH_UNCHANGED=${snapshot.hashUnchanged ? 'yes' : 'no'}`);

  if (!snapshot.exists) {
    failures.push('config_env_missing');
  }
  if (!snapshot.hashUnchanged) {
    failures.push('config_env_hash_changed_during_gate');
  }

  const realAgentKeysSetCount = countSetKeys(realEnv, AGENT_ENV_KEYS);
  const realNonAgentKeysSetCount = countSetKeys(realEnv, NON_AGENT_RUNTIME_ENV_KEYS);
  lines.push(`REAL_ENV_AGENT_KEYS_SET_COUNT=${realAgentKeysSetCount}`);
  lines.push(`REAL_ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=${realNonAgentKeysSetCount}`);

  const postApplyMode = isExpectedPostApplyAgentConfig(realEnv);
  const preApplyMode = realAgentKeysSetCount === 0;
  lines.push(`GATE_MODE=${postApplyMode ? 'post-apply-validation' : 'pre-apply-decision'}`);
  lines.push(`REAL_ENV_AGENT_ADDITIVE_ENABLED=${isSet(realEnv, 'VCP_AGENT_DIRS') ? 'yes' : 'no'}`);
  lines.push(`REAL_ENV_AGENT_OVERRIDE_ENABLED=${isSet(realEnv, 'VCP_AGENT_OVERRIDE_DIRS') ? 'yes' : 'no'}`);
  if (!preApplyMode && !postApplyMode) {
    failures.push('real_agent_runtime_keys_not_expected_override_only_shape');
  }
  if (realNonAgentKeysSetCount > 0) {
    failures.push('real_non_agent_runtime_keys_set');
  }
  for (const key of FORBIDDEN_TRUE_FLAGS) {
    if (isTruthy(realEnv[key])) {
      failures.push(`${key.toLowerCase()}_true`);
    }
  }

  const candidateEnv = postApplyMode
    ? { ...realEnv }
    : {
        ...realEnv,
        VCP_AGENT_ALLOWED_ROOTS: EXTERNAL_ROOT,
        VCP_AGENT_OVERRIDE_DIRS: EXTERNAL_AGENT_OVERRIDE_ROOT
      };

  const candidateAgentKeysSetCount = countSetKeys(candidateEnv, AGENT_ENV_KEYS);
  const candidateNonAgentKeysSetCount = countSetKeys(candidateEnv, NON_AGENT_RUNTIME_ENV_KEYS);
  lines.push('CANDIDATE_UNLOCK_LANE=agent-overrides');
  lines.push('CANDIDATE_AGENT_ADDITIVE_ENABLED=no');
  lines.push('CANDIDATE_AGENT_OVERRIDE_ENABLED=yes');
  lines.push(`CANDIDATE_AGENT_KEYS_SET_COUNT=${candidateAgentKeysSetCount}`);
  lines.push(`CANDIDATE_NON_AGENT_RUNTIME_KEYS_SET_COUNT=${candidateNonAgentKeysSetCount}`);
  lines.push(`EXTERNAL_ROOT_EXISTS=${fs.existsSync(EXTERNAL_ROOT) ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_AGENT_ROOT_EXISTS=${fs.existsSync(EXTERNAL_AGENT_ROOT) ? 'yes' : 'no'}`);
  lines.push('EXTERNAL_AGENT_ROOT_SELECTED=no');
  lines.push(`EXTERNAL_AGENT_OVERRIDE_ROOT_EXISTS=${fs.existsSync(EXTERNAL_AGENT_OVERRIDE_ROOT) ? 'yes' : 'no'}`);
  lines.push('EXTERNAL_AGENT_OVERRIDE_ROOT_SELECTED=yes');

  if (candidateAgentKeysSetCount !== 2) {
    failures.push('candidate_agent_keys_incomplete');
  }
  if (candidateNonAgentKeysSetCount > 0) {
    failures.push('candidate_non_agent_runtime_keys_set');
  }
  for (const targetPath of [EXTERNAL_ROOT, EXTERNAL_AGENT_OVERRIDE_ROOT]) {
    if (!fs.existsSync(targetPath)) {
      failures.push('candidate_agent_root_missing');
      break;
    }
    if (hasBlockedSegment(targetPath)) {
      failures.push('candidate_agent_root_uses_blocked_private_segment');
      break;
    }
  }

  const pathRisk = scanPathRisk([EXTERNAL_AGENT_OVERRIDE_ROOT]);
  lines.push(`TARGET_PATH_SCAN_COUNT=${pathRisk.pathCount}`);
  lines.push(`TARGET_PATH_RISK_COUNT=${pathRisk.riskCount}`);
  lines.push(`TARGET_AGENT_BOARD_PATH_COUNT=${pathRisk.agentBoardPathCount}`);
  lines.push(`TARGET_LOCALSTATE_PATH_COUNT=${pathRisk.localStatePathCount}`);
  lines.push(`TARGET_PRIVATE_PATH_COUNT=${pathRisk.privatePathCount}`);

  if (pathRisk.riskCount > 0) failures.push('candidate_agent_path_risk_present');
  if (pathRisk.agentBoardPathCount > 0) failures.push('candidate_agent_board_path_present');
  if (pathRisk.localStatePathCount > 0) failures.push('candidate_localstate_path_present');
  if (pathRisk.privatePathCount > 0) failures.push('candidate_private_path_present');

  const agentCandidate = evaluateAgentCandidate(candidateEnv);
  lines.push(`AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=${agentCandidate.externalAdditiveRootCount}`);
  lines.push(`AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=${agentCandidate.externalOverrideRootCount}`);
  lines.push(`AGENT_ADDITIVE_FILE_COUNT=${agentCandidate.additiveFileCount}`);
  lines.push(`AGENT_OVERRIDE_FILE_COUNT=${agentCandidate.overrideFileCount}`);
  lines.push(`AGENT_EFFECTIVE_FILE_COUNT=${agentCandidate.effectiveAgentCount}`);
  lines.push(`AGENT_SKIPPED_FILE_COUNT=${agentCandidate.skippedFileCount}`);
  lines.push(`AGENT_DIAGNOSTIC_CODES=${agentCandidate.diagnosticCodes}`);

  if (agentCandidate.externalAdditiveRootCount !== 0) failures.push('candidate_additive_root_count_unexpected');
  if (agentCandidate.externalOverrideRootCount !== 1) failures.push('candidate_override_root_count_unexpected');
  if (agentCandidate.additiveFileCount !== 0) failures.push('candidate_additive_files_unexpected');
  if (agentCandidate.overrideFileCount < 1) failures.push('candidate_override_files_missing');
  if (agentCandidate.skippedFileCount !== 0) failures.push('candidate_agent_skipped_files_present');
  if (agentCandidate.diagnosticCodes !== 'none') failures.push('candidate_agent_diagnostics_present');

  lines.push('AGENT_PROMPT_CONTENT_READ=no');
  lines.push('SERVER_STARTED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('PHOTO_STUDIO_PROJECT_DATA_READ=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('AGENT_REAL_CONFIG_UNLOCK_DECISION_GATE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main();
