#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fsSync = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

const { AgentManager } = require('../modules/agentManager');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const CORE_AGENT_ROOT = path.join(CORE_ROOT, 'Agent');
const AGENT_MAP_PATH = path.join(CORE_ROOT, 'agent_map.json');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_AGENT_OVERRIDE_ROOT = path.join(EXTERNAL_ROOT, 'AgentOverrides');
const TARGET_ALIASES = Object.freeze(['Metis', 'Nova']);

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

function readConfigEnvSnapshot() {
  if (!fsSync.existsSync(CONFIG_ENV_PATH)) {
    return { exists: false, env: {}, hash: null };
  }

  const raw = fsSync.readFileSync(CONFIG_ENV_PATH);
  return {
    exists: true,
    env: dotenv.parse(raw),
    hash: crypto.createHash('sha256').update(raw).digest('hex')
  };
}

function isSet(env, key) {
  return typeof env[key] === 'string' && env[key].trim() !== '';
}

function countSetKeys(env, keys) {
  return keys.filter((key) => isSet(env, key)).length;
}

function isSubPath(childPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
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

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

async function main() {
  const snapshot = readConfigEnvSnapshot();
  const env = snapshot.env;
  const failures = [];
  const lines = [];

  lines.push('AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE');
  lines.push(`CONFIG_ENV_EXISTS=${snapshot.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${snapshot.hash || 'missing'}`);

  if (!snapshot.exists) failures.push('config_env_missing');
  if (!isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')) failures.push('vcp_agent_allowed_roots_unset');
  if (!isSet(env, 'VCP_AGENT_OVERRIDE_DIRS')) failures.push('vcp_agent_override_dirs_unset');
  if (isSet(env, 'VCP_AGENT_DIRS')) failures.push('vcp_agent_dirs_must_remain_unset');
  if (countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS) > 0) failures.push('non_agent_runtime_keys_set');

  lines.push(`ENV_VCP_AGENT_ALLOWED_ROOTS_SET=${isSet(env, 'VCP_AGENT_ALLOWED_ROOTS') ? 'yes' : 'no'}`);
  lines.push(`ENV_VCP_AGENT_OVERRIDE_DIRS_SET=${isSet(env, 'VCP_AGENT_OVERRIDE_DIRS') ? 'yes' : 'no'}`);
  lines.push(`ENV_VCP_AGENT_DIRS_SET=${isSet(env, 'VCP_AGENT_DIRS') ? 'yes' : 'no'}`);
  lines.push(`ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=${countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS)}`);

  const manager = new AgentManager(CORE_AGENT_ROOT, {
    projectRoot: CORE_ROOT,
    env
  });
  const agentMap = JSON.parse(fsSync.readFileSync(AGENT_MAP_PATH, 'utf8'));
  for (const alias of TARGET_ALIASES) {
    if (!agentMap[alias]) {
      failures.push(`agent_map_missing_${alias.toLowerCase()}`);
      continue;
    }
    manager.agentMap.set(alias, agentMap[alias]);
  }

  await manager.scanAgentFiles();
  const plan = manager.agentFilePlan;
  const diagnosticCodes = countDiagnosticsByCode(manager.agentDiagnostics);
  lines.push(`AGENT_EXTERNAL_ADDITIVE_ROOT_COUNT=${plan?.snapshot.externalAdditiveRoots.length ?? 0}`);
  lines.push(`AGENT_EXTERNAL_OVERRIDE_ROOT_COUNT=${plan?.snapshot.externalOverrideRoots.length ?? 0}`);
  lines.push(`AGENT_ADDITIVE_FILE_COUNT=${plan?.additiveFiles.length ?? 0}`);
  lines.push(`AGENT_OVERRIDE_FILE_COUNT=${plan?.overrideFiles.length ?? 0}`);
  lines.push(`AGENT_EFFECTIVE_FILE_COUNT=${manager.agentFiles.length}`);
  lines.push(`AGENT_DIAGNOSTIC_CODES=${diagnosticCodes}`);

  if (!plan) failures.push('agent_file_plan_missing');
  if ((plan?.snapshot.externalAdditiveRoots.length ?? -1) !== 0) failures.push('agent_additive_root_enabled');
  if ((plan?.snapshot.externalOverrideRoots.length ?? -1) !== 1) failures.push('agent_override_root_count_unexpected');
  if ((plan?.additiveFiles.length ?? -1) !== 0) failures.push('agent_additive_files_enabled');
  if ((plan?.overrideFiles.length ?? -1) !== TARGET_ALIASES.length) failures.push('agent_override_file_count_unexpected');
  if (diagnosticCodes !== 'none') failures.push('agent_diagnostics_present');

  const readPaths = [];
  const originalReadFile = fsPromises.readFile;
  fsPromises.readFile = async function patchedReadFile(filePath, ...args) {
    if (typeof filePath === 'string' || filePath instanceof String) {
      readPaths.push(path.resolve(String(filePath)));
    }
    return originalReadFile.call(this, filePath, ...args);
  };

  const promptHashMatches = [];
  const externalReadMatches = [];
  try {
    for (const alias of TARGET_ALIASES) {
      const fileName = agentMap[alias];
      const record = manager.resolveAgentFileRecord(fileName);
      const externalRecord = manager.resolveExternalAgentFileRecord(fileName);
      const expectedExternalPath = path.join(EXTERNAL_AGENT_OVERRIDE_ROOT, fileName);

      if (!record || record.source !== 'external' || record.lane !== 'override') {
        failures.push(`record_not_external_override_${alias.toLowerCase()}`);
      }
      if (!externalRecord || path.resolve(externalRecord.absolutePath) !== path.resolve(expectedExternalPath)) {
        failures.push(`external_record_path_unexpected_${alias.toLowerCase()}`);
      }
      if (!record || !isSubPath(record.absolutePath, EXTERNAL_AGENT_OVERRIDE_ROOT)) {
        failures.push(`record_not_under_override_root_${alias.toLowerCase()}`);
      }

      const beforeReadCount = readPaths.length;
      const prompt = await manager.getAgentPrompt(alias);
      const readPath = readPaths.slice(beforeReadCount).find((candidate) => (
        path.resolve(candidate) === path.resolve(expectedExternalPath)
      ));
      const externalContent = fsSync.readFileSync(expectedExternalPath, 'utf8');

      externalReadMatches.push(Boolean(readPath));
      promptHashMatches.push(sha256Text(prompt) === sha256Text(externalContent));
    }
  } finally {
    fsPromises.readFile = originalReadFile;
  }

  const readPathMatchAll = externalReadMatches.every(Boolean) && externalReadMatches.length === TARGET_ALIASES.length;
  const promptHashMatchAll = promptHashMatches.every(Boolean) && promptHashMatches.length === TARGET_ALIASES.length;
  if (!readPathMatchAll) failures.push('agent_prompt_read_path_not_external_override');
  if (!promptHashMatchAll) failures.push('agent_prompt_hash_not_external_override');

  lines.push(`TARGET_ALIAS_COUNT=${TARGET_ALIASES.length}`);
  lines.push(`TARGET_ALIASES=${TARGET_ALIASES.join(',')}`);
  lines.push(`LOCAL_PROMPT_READ_COUNT=${readPaths.length}`);
  lines.push(`READ_PATHS_MATCH_EXTERNAL_OVERRIDE=${readPathMatchAll ? 'yes' : 'no'}`);
  lines.push(`PROMPT_HASH_MATCHES_EXTERNAL_OVERRIDE=${promptHashMatchAll ? 'yes' : 'no'}`);
  lines.push('PROMPT_CONTENT_READ=yes');
  lines.push('PROMPT_CONTENT_PRINTED=no');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('HTTP_SERVER_STARTED=no');
  lines.push('ADMIN_ROUTE_USED=no');
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('AGENT_OVERRIDES_RUNTIME_ON_LOCAL_READ_SMOKE_BLOCK\n');
  process.stdout.write('PROMPT_CONTENT_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.code ? error.code : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
