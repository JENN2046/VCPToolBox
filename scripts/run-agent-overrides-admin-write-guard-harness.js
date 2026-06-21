#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const express = require('express');
const fsSync = require('fs');
const fsPromises = require('fs').promises;
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

const agentManagerSingleton = require('../modules/agentManager');

const CORE_ROOT = path.resolve(__dirname, '..');
const CONFIG_ENV_PATH = path.join(CORE_ROOT, 'config.env');
const CORE_AGENT_ROOT = path.join(CORE_ROOT, 'Agent');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_AGENT_OVERRIDE_ROOT = path.join(EXTERNAL_ROOT, 'AgentOverrides');
const TARGET_FILES = Object.freeze(['Metis.txt', 'Nova.txt']);

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

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fsSync.readFileSync(filePath)).digest('hex');
}

function snapshotTargetHashes(rootPath) {
  const result = new Map();
  for (const fileName of TARGET_FILES) {
    const filePath = path.join(rootPath, fileName);
    result.set(fileName, fsSync.existsSync(filePath) ? hashFile(filePath) : 'missing');
  }
  return result;
}

function hashesEqual(left, right) {
  for (const [key, value] of left.entries()) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

function setScopedProcessEnv(env) {
  const scopedKeys = [...AGENT_ENV_KEYS, ...NON_AGENT_RUNTIME_ENV_KEYS];
  const previous = new Map(scopedKeys.map((key) => [key, process.env[key]]));

  for (const key of scopedKeys) {
    delete process.env[key];
  }
  if (isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')) {
    process.env.VCP_AGENT_ALLOWED_ROOTS = env.VCP_AGENT_ALLOWED_ROOTS;
  }
  if (isSet(env, 'VCP_AGENT_OVERRIDE_DIRS')) {
    process.env.VCP_AGENT_OVERRIDE_DIRS = env.VCP_AGENT_OVERRIDE_DIRS;
  }

  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
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

async function main() {
  const snapshot = readConfigEnvSnapshot();
  const env = snapshot.env;
  const failures = [];
  const lines = [];

  lines.push('AGENT_OVERRIDES_ADMIN_WRITE_GUARD');
  lines.push(`CONFIG_ENV_EXISTS=${snapshot.exists ? 'yes' : 'no'}`);
  lines.push('CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`CONFIG_ENV_SHA256=${snapshot.hash || 'missing'}`);
  lines.push(`ENV_VCP_AGENT_ALLOWED_ROOTS_SET=${isSet(env, 'VCP_AGENT_ALLOWED_ROOTS') ? 'yes' : 'no'}`);
  lines.push(`ENV_VCP_AGENT_OVERRIDE_DIRS_SET=${isSet(env, 'VCP_AGENT_OVERRIDE_DIRS') ? 'yes' : 'no'}`);
  lines.push(`ENV_VCP_AGENT_DIRS_SET=${isSet(env, 'VCP_AGENT_DIRS') ? 'yes' : 'no'}`);
  lines.push(`ENV_NON_AGENT_RUNTIME_KEYS_SET_COUNT=${countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS)}`);

  if (!snapshot.exists) failures.push('config_env_missing');
  if (!isSet(env, 'VCP_AGENT_ALLOWED_ROOTS')) failures.push('vcp_agent_allowed_roots_unset');
  if (!isSet(env, 'VCP_AGENT_OVERRIDE_DIRS')) failures.push('vcp_agent_override_dirs_unset');
  if (isSet(env, 'VCP_AGENT_DIRS')) failures.push('vcp_agent_dirs_must_remain_unset');
  if (countSetKeys(env, NON_AGENT_RUNTIME_ENV_KEYS) > 0) failures.push('non_agent_runtime_keys_set');

  const coreBefore = snapshotTargetHashes(CORE_AGENT_ROOT);
  const externalBefore = snapshotTargetHashes(EXTERNAL_AGENT_OVERRIDE_ROOT);
  const previousAgentDir = agentManagerSingleton.agentDir;
  const previousAgentEnv = agentManagerSingleton.env;
  const restoreProcessEnv = setScopedProcessEnv(env);
  const originalWriteFile = fsPromises.writeFile;
  const trappedWrites = [];
  let serverHandle = null;

  fsPromises.writeFile = async function writeGuard(filePath, ...args) {
    trappedWrites.push(path.resolve(String(filePath)));
    throw new Error('admin_write_guard_trap');
  };

  try {
    if (failures.length === 0) {
      const createAgentsRouter = require('../routes/admin/agents');
      const app = express();
      app.use(express.json());
      app.use(createAgentsRouter({
        agentDirPath: CORE_AGENT_ROOT,
        DEBUG_MODE: false
      }));
      serverHandle = await startLocalTestServer(app);

      const getStatuses = [];
      const getExternalFlags = [];
      const getLanes = [];
      const postStatuses = [];
      const postExternalSources = [];
      const postExternalLanes = [];

      for (const fileName of TARGET_FILES) {
        const encodedFileName = encodeURIComponent(fileName);
        const getResponse = await fetch(`${serverHandle.baseUrl}/agents/${encodedFileName}`);
        getStatuses.push(getResponse.status);
        const getBody = await getResponse.json();
        getExternalFlags.push(getBody.external === true);
        getLanes.push(getBody.lane || 'none');

        const postResponse = await fetch(`${serverHandle.baseUrl}/agents/${encodedFileName}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: 'blocked-admin-write-guard' })
        });
        postStatuses.push(postResponse.status);
        const postBody = await postResponse.json();
        postExternalSources.push(postBody.source || 'none');
        postExternalLanes.push(postBody.lane || 'none');
      }

      lines.push(`TARGET_FILE_COUNT=${TARGET_FILES.length}`);
      lines.push(`TARGET_FILES=${TARGET_FILES.join(',')}`);
      lines.push(`ADMIN_GET_STATUS_CODES=${getStatuses.join(',')}`);
      lines.push(`ADMIN_GET_EXTERNAL_FLAGS=${getExternalFlags.map(Boolean).join(',')}`);
      lines.push(`ADMIN_GET_LANES=${getLanes.join(',')}`);
      lines.push(`ADMIN_POST_STATUS_CODES=${postStatuses.join(',')}`);
      lines.push(`ADMIN_POST_SOURCES=${postExternalSources.join(',')}`);
      lines.push(`ADMIN_POST_LANES=${postExternalLanes.join(',')}`);

      if (!getStatuses.every((status) => status === 200)) failures.push('admin_get_external_override_failed');
      if (!getExternalFlags.every(Boolean)) failures.push('admin_get_not_external');
      if (!getLanes.every((lane) => lane === 'override')) failures.push('admin_get_lane_not_override');
      if (!postStatuses.every((status) => status === 403)) failures.push('admin_post_external_write_not_forbidden');
      if (!postExternalSources.every((source) => source === 'external')) failures.push('admin_post_source_not_external');
      if (!postExternalLanes.every((lane) => lane === 'override')) failures.push('admin_post_lane_not_override');
    } else {
      lines.push(`TARGET_FILE_COUNT=${TARGET_FILES.length}`);
      lines.push(`TARGET_FILES=${TARGET_FILES.join(',')}`);
      lines.push('ADMIN_GET_STATUS_CODES=not-run');
      lines.push('ADMIN_GET_EXTERNAL_FLAGS=not-run');
      lines.push('ADMIN_GET_LANES=not-run');
      lines.push('ADMIN_POST_STATUS_CODES=not-run');
      lines.push('ADMIN_POST_SOURCES=not-run');
      lines.push('ADMIN_POST_LANES=not-run');
    }
  } finally {
    if (serverHandle) await serverHandle.close();
    fsPromises.writeFile = originalWriteFile;
    agentManagerSingleton.setAgentDir(previousAgentDir);
    agentManagerSingleton.setEnvironment(previousAgentEnv);
    restoreProcessEnv();
  }

  const coreAfter = snapshotTargetHashes(CORE_AGENT_ROOT);
  const externalAfter = snapshotTargetHashes(EXTERNAL_AGENT_OVERRIDE_ROOT);
  const coreUnchanged = hashesEqual(coreBefore, coreAfter);
  const externalUnchanged = hashesEqual(externalBefore, externalAfter);

  if (trappedWrites.length > 0) failures.push('admin_route_attempted_write');
  if (!coreUnchanged) failures.push('core_agent_hash_changed');
  if (!externalUnchanged) failures.push('external_agent_hash_changed');

  lines.push(`WRITE_TRAP_TRIGGERED=${trappedWrites.length > 0 ? 'yes' : 'no'}`);
  lines.push(`WRITE_TRAP_COUNT=${trappedWrites.length}`);
  lines.push(`CORE_AGENT_HASH_UNCHANGED=${coreUnchanged ? 'yes' : 'no'}`);
  lines.push(`EXTERNAL_AGENT_HASH_UNCHANGED=${externalUnchanged ? 'yes' : 'no'}`);
  lines.push('PROMPT_CONTENT_READ=yes');
  lines.push('PROMPT_CONTENT_PRINTED=no');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push(`LOCAL_HTTP_TEST_SERVER_STARTED=${serverHandle ? 'yes' : 'no'}`);
  lines.push('PLUGIN_EXECUTION_ATTEMPTED=no');
  lines.push('PROVIDER_CALL_EXECUTED=no');
  lines.push('BRIDGE_LIVE_WRITE_EXECUTED=no');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (failures.length > 0) {
    lines.push('AGENT_OVERRIDES_ADMIN_WRITE_GUARD_BLOCK');
    lines.push(`BLOCK_REASONS=${Array.from(new Set(failures)).sort().join(',')}`);
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('AGENT_OVERRIDES_ADMIN_WRITE_GUARD_PASS');
  lines.push('BLOCK_REASONS=none');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  process.stdout.write('AGENT_OVERRIDES_ADMIN_WRITE_GUARD_BLOCK\n');
  process.stdout.write('CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write('PROMPT_CONTENT_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.message ? error.message : 'unexpected_error'}\n`);
  process.exitCode = 1;
});
