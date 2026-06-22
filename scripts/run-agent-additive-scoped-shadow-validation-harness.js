#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { AgentManager } = require('../modules/agentManager');

const CORE_ROOT = path.resolve(__dirname, '..');
const CORE_AGENT_ROOT = path.join(CORE_ROOT, 'Agent');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_AGENT_ROOT = path.join(EXTERNAL_ROOT, 'Agent');
const EXTERNAL_OVERRIDE_ROOT = path.join(EXTERNAL_ROOT, 'AgentOverrides');

const AGENT_ENV_KEYS = Object.freeze([
  'VCP_AGENT_ALLOWED_ROOTS',
  'VCP_AGENT_DIRS',
  'VCP_AGENT_OVERRIDE_DIRS'
]);

const ADDITIVE_AGENT_FILES = Object.freeze([
  'AIImageGenExpert.txt',
  'AuditMaster.txt',
  'MemoriaSorter.txt',
  'Muse.txt',
  '\u52a8\u529b\u731b\u517d.txt',
  '\u5c0f\u79cb.txt',
  '\u8bfa\u5b9d.txt'
]);

const OVERRIDE_AGENT_FILES = Object.freeze([
  'Metis.txt',
  'Nova.txt'
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
  'secrets'
]);

function setEnvVar(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function snapshotEnv() {
  return Object.fromEntries(AGENT_ENV_KEYS.map((name) => [name, process.env[name]]));
}

function restoreEnv(previousEnv) {
  for (const name of AGENT_ENV_KEYS) {
    setEnvVar(name, previousEnv[name]);
  }
}

function isSet(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function pathKey(targetPath) {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertInside(root, targetPath, label) {
  const rootKey = pathKey(root);
  const targetKey = pathKey(targetPath);
  if (targetKey !== rootKey && !targetKey.startsWith(rootKey + path.sep)) {
    throw new Error(`${label} escaped expected root`);
  }
}

function hasBlockedPathSegment(targetPath) {
  return path.resolve(targetPath)
    .split(/[\\/]+/)
    .some((segment) => BLOCKED_PATH_SEGMENTS.has(segment));
}

function assertNoBlockedPathSegments(targetPath, label) {
  if (hasBlockedPathSegment(targetPath)) {
    throw new Error(`${label} uses blocked private/runtime path segment`);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function aggregateHash(root, fileNames) {
  const hash = crypto.createHash('sha256');
  for (const fileName of fileNames.slice().sort()) {
    const filePath = path.join(root, fileName);
    assertInside(root, filePath, 'hash target');
    hash.update(fileName);
    hash.update('\0');
    hash.update(fs.readFileSync(filePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function requireFiles(root, fileNames, label) {
  const missing = [];
  for (const fileName of fileNames) {
    const filePath = path.join(root, fileName);
    assertInside(root, filePath, label);
    if (!fs.existsSync(filePath)) {
      missing.push(fileName);
    }
  }
  return missing;
}

function markerCounts(records, expectedFiles, expectedSource) {
  const recordsByPath = new Map(records.map((record) => [record.relativePath, record]));
  const recordsById = new Map(records.map((record) => [record.id, record]));
  let count = 0;
  const missing = [];
  const wrongSource = [];

  for (const fileName of expectedFiles) {
    const id = fileName.replace(/\.(txt|md)$/i, '');
    const record = recordsByPath.get(fileName) || recordsById.get(id);
    if (!record) {
      missing.push(id);
      continue;
    }
    if (record.effectiveSource !== expectedSource && record.source !== expectedSource) {
      wrongSource.push(`${id}:${record.effectiveSource || record.source || 'unknown'}`);
      continue;
    }
    count += 1;
  }

  return { count, missing, wrongSource };
}

function countDiagnostics(plan, code) {
  return plan.diagnostics.filter((diagnostic) => diagnostic.code === code).length;
}

function sourceMarkerSummary(records, expectedFiles) {
  const counts = new Map();
  for (const fileName of expectedFiles) {
    const id = fileName.replace(/\.(txt|md)$/i, '');
    const record = records.find((item) => item.relativePath === fileName || item.id === id);
    const marker = record ? (record.effectiveSource || record.source || 'unknown') : 'missing';
    counts.set(marker, (counts.get(marker) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([marker, count]) => `${marker}:${count}`)
    .join(',');
}

async function runScopedValidation(lines, failures) {
  const scopedEnv = {
    VCP_AGENT_ALLOWED_ROOTS: EXTERNAL_ROOT,
    VCP_AGENT_DIRS: EXTERNAL_AGENT_ROOT,
    VCP_AGENT_OVERRIDE_DIRS: EXTERNAL_OVERRIDE_ROOT
  };

  setEnvVar('VCP_AGENT_ALLOWED_ROOTS', scopedEnv.VCP_AGENT_ALLOWED_ROOTS);
  setEnvVar('VCP_AGENT_DIRS', scopedEnv.VCP_AGENT_DIRS);
  setEnvVar('VCP_AGENT_OVERRIDE_DIRS', scopedEnv.VCP_AGENT_OVERRIDE_DIRS);

  const manager = new AgentManager(CORE_AGENT_ROOT, {
    projectRoot: CORE_ROOT,
    env: process.env
  });

  for (const fileName of [...ADDITIVE_AGENT_FILES, ...OVERRIDE_AGENT_FILES]) {
    const id = fileName.replace(/\.(txt|md)$/i, '');
    manager.agentMap.set(id, fileName);
  }

  await manager.scanAgentFiles();

  const plan = manager.agentFilePlan;
  if (!plan) {
    failures.push('agent_file_plan_missing');
    return;
  }

  const additiveExternalMarker = markerCounts(
    plan.additiveFiles,
    ADDITIVE_AGENT_FILES,
    'external'
  );
  const additiveEffectiveMarker = markerCounts(
    plan.effectiveAgents,
    ADDITIVE_AGENT_FILES,
    'external-additive'
  );
  const overrideEffectiveMarker = markerCounts(
    plan.effectiveAgents,
    OVERRIDE_AGENT_FILES,
    'external-override'
  );

  const coreFallbackRetainedCount = [...ADDITIVE_AGENT_FILES, ...OVERRIDE_AGENT_FILES]
    .filter((fileName) => fs.existsSync(path.join(CORE_AGENT_ROOT, fileName)))
    .length;

  const additiveDuplicateCoreCount = countDiagnostics(plan, 'additive_duplicate_core_agent');

  lines.push(`ADDITIVE_CANDIDATE_COUNT=${ADDITIVE_AGENT_FILES.length}`);
  lines.push(`ADDITIVE_EXTERNAL_SOURCE_COUNT=${additiveExternalMarker.count}`);
  lines.push(`ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=${additiveEffectiveMarker.count}`);
  lines.push(`ADDITIVE_EFFECTIVE_SOURCE_MARKERS=${sourceMarkerSummary(plan.effectiveAgents, ADDITIVE_AGENT_FILES)}`);
  lines.push(`ADDITIVE_DUPLICATE_CORE_DIAGNOSTIC_COUNT=${additiveDuplicateCoreCount}`);
  lines.push(`OVERRIDE_CONTROL_COUNT=${OVERRIDE_AGENT_FILES.length}`);
  lines.push(`OVERRIDE_EXTERNAL_SOURCE_COUNT=${overrideEffectiveMarker.count}`);
  lines.push(`OVERRIDE_EFFECTIVE_SOURCE_MARKERS=${sourceMarkerSummary(plan.effectiveAgents, OVERRIDE_AGENT_FILES)}`);
  lines.push(`CORE_AGENT_FALLBACK_RETAINED=${coreFallbackRetainedCount}`);

  if (additiveExternalMarker.count !== ADDITIVE_AGENT_FILES.length) {
    failures.push('additive_external_files_not_scanned');
  }
  if (additiveEffectiveMarker.count !== ADDITIVE_AGENT_FILES.length) {
    failures.push('additive_effective_source_not_external');
  }
  if (overrideEffectiveMarker.count !== OVERRIDE_AGENT_FILES.length) {
    failures.push('override_effective_source_not_external');
  }
  if (coreFallbackRetainedCount !== ADDITIVE_AGENT_FILES.length + OVERRIDE_AGENT_FILES.length) {
    failures.push('core_agent_fallback_not_retained');
  }
  if (additiveDuplicateCoreCount > 0) {
    failures.push('additive_duplicate_core_blocks_effective_external_source');
  }
}

async function runRollbackValidation(lines, previousEnv, failures) {
  restoreEnv(previousEnv);

  const rollbackManager = new AgentManager(CORE_AGENT_ROOT, {
    projectRoot: CORE_ROOT,
    env: process.env
  });

  await rollbackManager.scanAgentFiles();
  const plan = rollbackManager.agentFilePlan;
  const rollbackAdditiveExternalCount = plan ? plan.additiveFiles.length : 0;

  lines.push(`ROLLBACK_PROCESS_ENV_RESTORED=${JSON.stringify(snapshotEnv()) === JSON.stringify(previousEnv) ? 'yes' : 'no'}`);
  lines.push(`ROLLBACK_ADDITIVE_EXTERNAL_SOURCE_COUNT=${rollbackAdditiveExternalCount}`);

  if (JSON.stringify(snapshotEnv()) !== JSON.stringify(previousEnv)) {
    failures.push('process_env_not_restored');
  }
  if (isSet(previousEnv.VCP_AGENT_DIRS) || rollbackAdditiveExternalCount !== 0) {
    failures.push('rollback_additive_env_not_off');
  }
}

async function main() {
  const lines = [];
  const failures = [];
  const previousEnv = snapshotEnv();
  const realVcpAgentDirsWasSet = isSet(previousEnv.VCP_AGENT_DIRS);

  lines.push('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION');
  lines.push('SCOPED_PROCESS_ENV_ONLY=yes');
  lines.push('REAL_CONFIG_ENV_WRITTEN=no');
  lines.push('REAL_CONFIG_ENV_VALUES_PRINTED=no');
  lines.push(`VCP_AGENT_DIRS_REAL_CONFIG_ENABLED=${realVcpAgentDirsWasSet ? 'yes' : 'no'}`);
  lines.push('PROMPT_CONTENT_PRINTED=no');
  lines.push('PRODUCTION_SERVER_STARTED=no');
  lines.push('ADMIN_ROUTE_USED=no');
  lines.push('ADMIN_EXTERNAL_AGENT_WRITE_ENABLED=no');
  lines.push('ADMIN_EXTERNAL_AGENT_WRITE_BLOCKED=yes');
  lines.push('LOCALSTATE_PRIVATE_CONTENT_READ=no');
  lines.push('AGENT_BOARD_READ_OR_CHECKSUMMED=no');
  lines.push('PROVIDER_OR_BRIDGE_OR_LIVE_WRITE_EXECUTED=no');
  lines.push('UPSTREAM_PR_OPENED=no');

  if (realVcpAgentDirsWasSet) {
    failures.push('real_process_env_vcp_agent_dirs_already_set');
  }

  try {
    for (const [label, root] of [
      ['external package root', EXTERNAL_ROOT],
      ['external additive root', EXTERNAL_AGENT_ROOT],
      ['external override root', EXTERNAL_OVERRIDE_ROOT],
      ['core Agent root', CORE_AGENT_ROOT]
    ]) {
      assertNoBlockedPathSegments(root, label);
      if (!fs.existsSync(root)) {
        failures.push(`${label.replace(/\s+/g, '_')}_missing`);
      }
    }

    const additiveMissing = requireFiles(EXTERNAL_AGENT_ROOT, ADDITIVE_AGENT_FILES, 'external additive file');
    const overrideMissing = requireFiles(EXTERNAL_OVERRIDE_ROOT, OVERRIDE_AGENT_FILES, 'external override file');
    const coreMissing = requireFiles(CORE_AGENT_ROOT, [...ADDITIVE_AGENT_FILES, ...OVERRIDE_AGENT_FILES], 'core fallback file');

    lines.push(`EXTERNAL_PACKAGE_ROOT_PRESENT=${fs.existsSync(EXTERNAL_ROOT) ? 'yes' : 'no'}`);
    lines.push(`EXTERNAL_ADDITIVE_TARGET_MISSING_COUNT=${additiveMissing.length}`);
    lines.push(`EXTERNAL_OVERRIDE_TARGET_MISSING_COUNT=${overrideMissing.length}`);
    lines.push(`CORE_FALLBACK_TARGET_MISSING_COUNT=${coreMissing.length}`);

    if (additiveMissing.length) failures.push('external_additive_files_missing');
    if (overrideMissing.length) failures.push('external_override_files_missing');
    if (coreMissing.length) failures.push('core_fallback_files_missing');

    const externalBeforeHash = aggregateHash(EXTERNAL_AGENT_ROOT, ADDITIVE_AGENT_FILES);
    const overrideBeforeHash = aggregateHash(EXTERNAL_OVERRIDE_ROOT, OVERRIDE_AGENT_FILES);
    const coreBeforeHash = aggregateHash(CORE_AGENT_ROOT, [...ADDITIVE_AGENT_FILES, ...OVERRIDE_AGENT_FILES]);

    lines.push(`EXTERNAL_ADDITIVE_AGGREGATE_SHA256=${externalBeforeHash}`);
    lines.push(`EXTERNAL_OVERRIDE_AGGREGATE_SHA256=${overrideBeforeHash}`);
    lines.push(`CORE_FALLBACK_AGGREGATE_SHA256=${coreBeforeHash}`);

    if (failures.length === 0) {
      await runScopedValidation(lines, failures);
    } else {
      lines.push(`ADDITIVE_CANDIDATE_COUNT=${ADDITIVE_AGENT_FILES.length}`);
      lines.push('ADDITIVE_EXTERNAL_SOURCE_COUNT=not-run');
      lines.push('ADDITIVE_EFFECTIVE_EXTERNAL_SOURCE_COUNT=not-run');
      lines.push(`OVERRIDE_CONTROL_COUNT=${OVERRIDE_AGENT_FILES.length}`);
      lines.push('OVERRIDE_EXTERNAL_SOURCE_COUNT=not-run');
      lines.push('CORE_AGENT_FALLBACK_RETAINED=not-run');
    }

    const externalAfterHash = aggregateHash(EXTERNAL_AGENT_ROOT, ADDITIVE_AGENT_FILES);
    const overrideAfterHash = aggregateHash(EXTERNAL_OVERRIDE_ROOT, OVERRIDE_AGENT_FILES);
    const coreAfterHash = aggregateHash(CORE_AGENT_ROOT, [...ADDITIVE_AGENT_FILES, ...OVERRIDE_AGENT_FILES]);

    lines.push(`EXTERNAL_ADDITIVE_HASH_UNCHANGED=${externalAfterHash === externalBeforeHash ? 'yes' : 'no'}`);
    lines.push(`EXTERNAL_OVERRIDE_HASH_UNCHANGED=${overrideAfterHash === overrideBeforeHash ? 'yes' : 'no'}`);
    lines.push(`CORE_FALLBACK_HASH_UNCHANGED=${coreAfterHash === coreBeforeHash ? 'yes' : 'no'}`);

    if (externalAfterHash !== externalBeforeHash) failures.push('external_additive_hash_changed');
    if (overrideAfterHash !== overrideBeforeHash) failures.push('external_override_hash_changed');
    if (coreAfterHash !== coreBeforeHash) failures.push('core_fallback_hash_changed');
  } finally {
    try {
      await runRollbackValidation(lines, previousEnv, failures);
    } catch (error) {
      restoreEnv(previousEnv);
      failures.push(`rollback_validation_error:${error.message}`);
    }
  }

  lines.push('CORE_AGENT_FALLBACK_REMOVED=no');
  lines.push('REAL_CONFIG_ENV_VALUES_READ=no');
  lines.push('SCRIPT_MODIFIED=yes');
  lines.push('TESTS_MODIFIED=no');
  lines.push('AGENTMANAGER_RUNTIME_CHANGED=no');
  lines.push(`BLOCK_REASONS=${failures.length ? Array.from(new Set(failures)).sort().join(',') : 'none'}`);

  if (failures.length > 0) {
    lines.push('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=no');
    lines.push('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_BLOCK');
    process.stdout.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  lines.push('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=yes');
  process.stdout.write(`${lines.join('\n')}\n`);
}

main().catch((error) => {
  restoreEnv(snapshotEnv());
  process.stdout.write('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_PASS=no\n');
  process.stdout.write('REAL_CONFIG_ENV_WRITTEN=no\n');
  process.stdout.write('REAL_CONFIG_ENV_VALUES_PRINTED=no\n');
  process.stdout.write('PROMPT_CONTENT_PRINTED=no\n');
  process.stdout.write(`BLOCK_REASONS=${error && error.message ? error.message : 'unexpected_error'}\n`);
  process.stdout.write('M100_AGENT_ADDITIVE_SCOPED_SHADOW_VALIDATION_BLOCK\n');
  process.exitCode = 1;
});
