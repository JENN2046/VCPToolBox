#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STAGE8_NO_PROVIDER_ARG = '--stage8-no-provider-external-plugin-execution-proof';
const STAGE8_PROVIDER_PRESERVING_ARG = '--stage8-provider-preserving-plugin-execution-proof';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PLUGIN_PATH = path.resolve(
  PROJECT_ROOT,
  '..',
  'VCPToolBox-JENN-Extensions',
  'Plugin',
  'JennAIGentOrchestrator'
);
const EXTERNAL_PLUGIN_ROOT_PATH = path.dirname(EXTERNAL_PLUGIN_PATH);
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const MANIFEST_PATH = path.join(EXTERNAL_PLUGIN_PATH, 'plugin-manifest.json');
const PLUGIN_NAME = 'JennAIGentOrchestrator';
const HARNESS_TIMEOUT_MS = 75000;
const TIMEOUT_BLOCKER_CATEGORY = 'HARNESS_TIMEOUT_NO_SANITIZED_PROJECTION_PREVENTED';
const TIMEOUT_BRANCH = 'no_provider_plugin_execution_harness_timeout_guard';
const EXTERNAL_ALLOWLIST_ENV = 'VCP_EXTERNAL_PLUGIN_ALLOWLIST';
const EXACT_EXTERNAL_ALLOWLIST_ENTRY = `${PLUGIN_NAME}@${EXTERNAL_PLUGIN_PATH}`;
const ORIGINAL_STDOUT_WRITE = process.stdout.write.bind(process.stdout);
const ORIGINAL_STDERR_WRITE = process.stderr.write.bind(process.stderr);

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'external path resolved',
  'external path exact match',
  'external path',
  'core fallback false',
  'external manifest identity matched',
  'external plugin module loaded',
  'plugin execution attempted',
  'processToolCall called',
  'executePlugin called',
  'plugin handler reached',
  'plugin result sanitized',
  'plugin execution result accepted',
  'provider endpoint contact',
  'real image generation invoked',
  'image output produced',
  'LocalState write',
  'server route activation',
  'runtime cutover',
  'core copy removal',
  'credential value printed',
  'token value printed',
  'raw authorization header printed',
  'provider response body printed',
  'request body printed',
  'raw image bytes printed',
  'base64 image data printed',
  'secret-like value printed',
  'sanitizer suspected forbidden output',
  'exact sanitized blocker category',
  'exact sanitized branch',
  'retry started',
  'Gate 84 started'
]);

function createProjection(mode = 'not selected') {
  return {
    result: 'BLOCKED',
    route: '83B',
    mode,
    'external path resolved': 'no',
    'external path exact match': 'no',
    'external path': EXTERNAL_PLUGIN_PATH,
    'core fallback false': 'no',
    'external manifest identity matched': 'no',
    'external plugin module loaded': 'no',
    'plugin execution attempted': 'no',
    'processToolCall called': 'no',
    'executePlugin called': 'no',
    'plugin handler reached': 'no',
    'plugin result sanitized': 'no',
    'plugin execution result accepted': 'no',
    'provider endpoint contact': 'no',
    'real image generation invoked': 'no',
    'image output produced': 'no',
    'LocalState write': 'no',
    'server route activation': 'no',
    'runtime cutover': 'no',
    'core copy removal': 'no',
    'credential value printed': 'no',
    'token value printed': 'no',
    'raw authorization header printed': 'no',
    'provider response body printed': 'no',
    'request body printed': 'no',
    'raw image bytes printed': 'no',
    'base64 image data printed': 'no',
    'secret-like value printed': 'no',
    'sanitizer suspected forbidden output': 'no',
    'exact sanitized blocker category': 'stage8 mode not selected',
    'exact sanitized branch': 'not selected',
    'retry started': 'no',
    'Gate 84 started': 'no'
  };
}

function normalizeComparablePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function comparePath(value, expectedValue) {
  const actual = normalizeComparablePath(value);
  const expected = normalizeComparablePath(expectedValue);
  return Boolean(actual && expected && actual === expected);
}

function resolveFreshRealPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const realpathSync = fs.realpathSync.native || fs.realpathSync;
    return path.resolve(realpathSync(path.resolve(value)));
  } catch (_error) {
    return null;
  }
}

function proveExternalResolution(projection) {
  const targetResolved = path.resolve(EXTERNAL_PLUGIN_PATH);
  const targetReal = resolveFreshRealPath(EXTERNAL_PLUGIN_PATH);
  const fallbackResolved = path.resolve(CORE_FALLBACK_PATH);
  const fallbackReal = resolveFreshRealPath(CORE_FALLBACK_PATH);

  if (!targetReal) {
    projection['exact sanitized blocker category'] = 'external path unresolved';
    return false;
  }

  projection['external path resolved'] = 'yes';
  projection['external path exact match'] = comparePath(targetResolved, EXTERNAL_PLUGIN_PATH)
    && comparePath(targetReal, EXTERNAL_PLUGIN_PATH)
    ? 'yes'
    : 'no';

  const coreFallback = comparePath(targetResolved, fallbackResolved)
    || (fallbackReal ? comparePath(targetReal, fallbackReal) : false);
  projection['core fallback false'] = coreFallback ? 'no' : 'yes';

  if (projection['external path exact match'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'external path mismatch';
    return false;
  }
  if (projection['core fallback false'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'core fallback true';
    return false;
  }
  return true;
}

function proveManifestIdentity(projection) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    projection['external manifest identity matched'] = manifest?.name === PLUGIN_NAME ? 'yes' : 'no';
  } catch (_error) {
    projection['external manifest identity matched'] = 'no';
  }

  if (projection['external manifest identity matched'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'manifest identity mismatch';
    return false;
  }
  return true;
}

function resultIsSanitizedHealthCheck(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value.result && typeof value.result === 'object' ? value.result : value;
  const status = value.status || 'success';
  const agents = result?.agent_roles || result?.agents;
  return status === 'success'
    && result
    && typeof result === 'object'
    && result.allow_execution === false
    && result.default_mode === 'dry-run'
    && agents
    && typeof agents === 'object';
}

function projectionHasOnlyApprovedFields(projection) {
  const keys = Object.keys(projection);
  return keys.length === APPROVED_FIELDS.length
    && APPROVED_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(projection, field));
}

function projectionHasOnlyApprovedValues(projection) {
  const approvedValues = new Set([
    'yes',
    'no',
    'PASS',
    'BLOCKED',
    '83B',
    'not selected',
    'no-provider',
    'provider-preserving',
    'stage8 mode not selected',
    'invalid stage8 mode',
    'external path unresolved',
    'external path mismatch',
    'core fallback true',
    'manifest identity mismatch',
    'plugin registry load failed',
    'plugin not registered',
    'registered plugin is not sealed external source',
    'plugin execution error',
    'plugin result sanitizer rejected',
    TIMEOUT_BLOCKER_CATEGORY,
    TIMEOUT_BRANCH,
    EXTERNAL_PLUGIN_PATH
  ]);

  return Object.values(projection).every((value) => approvedValues.has(value));
}

function normalizeSanitizedProjection(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  if (!projectionHasOnlyApprovedFields(candidate)) return null;
  if (!projectionHasOnlyApprovedValues(candidate)) return null;
  return candidate;
}

function formatSanitizedKeyValueProjection(projection) {
  const safeProjection = normalizeSanitizedProjection(projection);
  if (!safeProjection) return null;
  return APPROVED_FIELDS
    .map((field) => `${field}: ${safeProjection[field]}`)
    .join('\n');
}

function buildProjectionOutput(projection) {
  const safeProjection = normalizeSanitizedProjection(projection) || (() => {
    const blocked = createProjection();
    blocked['secret-like value printed'] = 'yes';
    blocked['sanitizer suspected forbidden output'] = 'yes';
    return blocked;
  })();

  const keyValueProjection = formatSanitizedKeyValueProjection(safeProjection);
  return `${JSON.stringify(safeProjection, null, 2)}\n${keyValueProjection ? `${keyValueProjection}\n` : ''}`;
}

function finishWithProjection(projection) {
  const safeProjection = normalizeSanitizedProjection(projection) || createProjection();
  const exitCode = safeProjection.result === 'PASS' ? 0 : 1;
  const output = buildProjectionOutput(safeProjection);
  const forceExitTimer = setTimeout(() => process.exit(exitCode), 1000);
  if (typeof forceExitTimer.unref === 'function') forceExitTimer.unref();
  ORIGINAL_STDOUT_WRITE(output, () => process.exit(exitCode));
}

function determineMode() {
  const hasNoProviderArg = process.argv.includes(STAGE8_NO_PROVIDER_ARG);
  const hasProviderPreservingArg = process.argv.includes(STAGE8_PROVIDER_PRESERVING_ARG);
  const argsAreExact = process.argv.length === 3 && (hasNoProviderArg || hasProviderPreservingArg);

  if (!argsAreExact) return null;
  return hasNoProviderArg ? 'no-provider' : 'provider-preserving';
}

function createCleanupState() {
  return {
    pluginManager: null,
    originalSpawnPluginProcess: null,
    childProcesses: new Set(),
    originalEnv: {
      VCP_PLUGIN_DIRS: process.env.VCP_PLUGIN_DIRS,
      VCP_PLUGIN_ALLOWED_ROOTS: process.env.VCP_PLUGIN_ALLOWED_ROOTS,
      VCP_EXTERNAL_PLUGIN_ALLOWLIST: process.env[EXTERNAL_ALLOWLIST_ENV]
    }
  };
}

function splitPathListForHarness(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return [];
  return rawValue
    .split(/[;\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pathListIncludesPath(entries, targetPath) {
  return entries.some((entry) => comparePath(entry, targetPath));
}

function appendPathListEntry(rawValue, targetPath) {
  const entries = splitPathListForHarness(rawValue);
  if (!pathListIncludesPath(entries, targetPath)) entries.push(targetPath);
  return entries.join(';');
}

function configureExternalPluginEnvironment(cleanupState) {
  cleanupState.originalEnv.VCP_PLUGIN_DIRS = process.env.VCP_PLUGIN_DIRS;
  cleanupState.originalEnv.VCP_PLUGIN_ALLOWED_ROOTS = process.env.VCP_PLUGIN_ALLOWED_ROOTS;
  process.env.VCP_PLUGIN_DIRS = appendPathListEntry(process.env.VCP_PLUGIN_DIRS, EXTERNAL_PLUGIN_ROOT_PATH);
  process.env.VCP_PLUGIN_ALLOWED_ROOTS = appendPathListEntry(
    process.env.VCP_PLUGIN_ALLOWED_ROOTS,
    EXTERNAL_PLUGIN_ROOT_PATH
  );
  process.env[EXTERNAL_ALLOWLIST_ENV] = appendPathListEntry(
    process.env[EXTERNAL_ALLOWLIST_ENV],
    EXACT_EXTERNAL_ALLOWLIST_ENTRY
  );
}

function restoreExternalPluginEnvironment(cleanupState) {
  for (const [key, value] of Object.entries(cleanupState.originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function silenceRawProcessOutput() {
  process.stdout.write = function silentStdoutWrite(_chunk, encoding, callback) {
    const cb = typeof encoding === 'function' ? encoding : callback;
    if (typeof cb === 'function') process.nextTick(cb);
    return true;
  };
  process.stderr.write = function silentStderrWrite(_chunk, encoding, callback) {
    const cb = typeof encoding === 'function' ? encoding : callback;
    if (typeof cb === 'function') process.nextTick(cb);
    return true;
  };
}

function trackPluginProcess(cleanupState, childProcess) {
  if (!childProcess || typeof childProcess !== 'object') return childProcess;
  cleanupState.childProcesses.add(childProcess);
  const forget = () => cleanupState.childProcesses.delete(childProcess);
  if (typeof childProcess.once === 'function') {
    childProcess.once('exit', forget);
    childProcess.once('close', forget);
    childProcess.once('error', forget);
  }
  return childProcess;
}

function installSpawnTracker(pluginManager, cleanupState) {
  if (!pluginManager || typeof pluginManager._spawnPluginProcess !== 'function') return;
  if (cleanupState.originalSpawnPluginProcess) return;

  cleanupState.pluginManager = pluginManager;
  cleanupState.originalSpawnPluginProcess = pluginManager._spawnPluginProcess;
  pluginManager._spawnPluginProcess = function trackedSpawnPluginProcess(...args) {
    const childProcess = cleanupState.originalSpawnPluginProcess.apply(this, args);
    return trackPluginProcess(cleanupState, childProcess);
  };
}

function cleanupTrackedProcesses(cleanupState) {
  if (cleanupState.pluginManager && cleanupState.originalSpawnPluginProcess) {
    cleanupState.pluginManager._spawnPluginProcess = cleanupState.originalSpawnPluginProcess;
  }
  restoreExternalPluginEnvironment(cleanupState);

  for (const childProcess of cleanupState.childProcesses) {
    const stillRunning = childProcess
      && childProcess.exitCode === null
      && childProcess.signalCode === null
      && childProcess.killed !== true;
    if (!stillRunning) continue;
    try {
      childProcess.kill('SIGKILL');
    } catch (_error) {
      // Best-effort cleanup only; sanitized projection remains the authority.
    }
  }
  cleanupState.childProcesses.clear();
}

function markTimeoutProjection(projection) {
  projection.result = 'BLOCKED';
  projection['exact sanitized blocker category'] = TIMEOUT_BLOCKER_CATEGORY;
  projection['exact sanitized branch'] = TIMEOUT_BRANCH;
  projection['plugin execution result accepted'] = 'no';
  projection['provider endpoint contact'] = 'no';
  projection['real image generation invoked'] = 'no';
  projection['image output produced'] = 'no';
  projection['LocalState write'] = 'no';
  projection['server route activation'] = 'no';
  projection['runtime cutover'] = 'no';
  projection['core copy removal'] = 'no';
  projection['retry started'] = 'no';
  projection['Gate 84 started'] = 'no';
  return projection;
}

function runProofWithTimeout(proofPromise, projection, cleanupState) {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupTrackedProcesses(cleanupState);
      resolve(markTimeoutProjection(projection));
    }, HARNESS_TIMEOUT_MS);

    proofPromise.then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        projection['exact sanitized blocker category'] = 'plugin execution error';
        resolve(projection);
      }
    );
  });
}

async function runStage8Proof(projection, cleanupState) {
  if (!proveExternalResolution(projection)) return projection;
  if (!proveManifestIdentity(projection)) return projection;

  let pluginManager;
  try {
    pluginManager = require(path.join(PROJECT_ROOT, 'Plugin.js'));
    installSpawnTracker(pluginManager, cleanupState);
    await pluginManager.loadPlugins();
  } catch (_error) {
    projection['exact sanitized blocker category'] = 'plugin registry load failed';
    return projection;
  }

  const plugin = pluginManager.plugins && pluginManager.plugins.get(PLUGIN_NAME);
  if (!plugin) {
    projection['exact sanitized blocker category'] = 'plugin not registered';
    return projection;
  }

  if (plugin.pluginSource !== 'external' || !comparePath(plugin.basePath, EXTERNAL_PLUGIN_PATH)) {
    projection['exact sanitized blocker category'] = 'registered plugin is not sealed external source';
    return projection;
  }

  projection['external plugin module loaded'] = 'yes';

  const originalProcessToolCall = pluginManager.processToolCall.bind(pluginManager);
  const originalExecutePlugin = pluginManager.executePlugin.bind(pluginManager);
  pluginManager.processToolCall = async (...args) => {
    projection['processToolCall called'] = 'yes';
    return originalProcessToolCall(...args);
  };
  pluginManager.executePlugin = async (...args) => {
    projection['executePlugin called'] = 'yes';
    return originalExecutePlugin(...args);
  };

  try {
    projection['plugin execution attempted'] = 'yes';
    const result = await pluginManager.processToolCall(
      PLUGIN_NAME,
      { action: 'HealthCheck' },
      null,
      { requestSource: 'gate83b-validation-harness' }
    );
    projection['plugin handler reached'] = 'yes';
    projection['plugin result sanitized'] = resultIsSanitizedHealthCheck(result) ? 'yes' : 'no';
    projection['plugin execution result accepted'] = projection['plugin result sanitized'];
  } catch (_error) {
    projection['exact sanitized blocker category'] = 'plugin execution error';
    return projection;
  }

  if (projection['plugin result sanitized'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'plugin result sanitizer rejected';
    return projection;
  }

  if (
    projection['external path resolved'] === 'yes'
    && projection['external path exact match'] === 'yes'
    && projection['core fallback false'] === 'yes'
    && projection['external manifest identity matched'] === 'yes'
    && projection['external plugin module loaded'] === 'yes'
    && projection['plugin execution attempted'] === 'yes'
    && projection['processToolCall called'] === 'yes'
    && projection['executePlugin called'] === 'yes'
    && projection['plugin handler reached'] === 'yes'
    && projection['plugin result sanitized'] === 'yes'
    && projection['plugin execution result accepted'] === 'yes'
    && projection['provider endpoint contact'] === 'no'
    && projection['real image generation invoked'] === 'no'
    && projection['image output produced'] === 'no'
    && projection['LocalState write'] === 'no'
    && projection['server route activation'] === 'no'
    && projection['runtime cutover'] === 'no'
    && projection['core copy removal'] === 'no'
  ) {
    projection.result = 'PASS';
  }

  return projection;
}

async function main() {
  const mode = determineMode();
  if (!mode) {
    finishWithProjection(createProjection());
    return;
  }

  const projection = createProjection(mode);
  const cleanupState = createCleanupState();
  configureExternalPluginEnvironment(cleanupState);
  silenceRawProcessOutput();
  const finalProjection = await runProofWithTimeout(
    runStage8Proof(projection, cleanupState),
    projection,
    cleanupState
  );
  cleanupTrackedProcesses(cleanupState);
  finishWithProjection(finalProjection);
}

main().catch(() => {
  const projection = createProjection();
  projection['exact sanitized blocker category'] = 'plugin execution error';
  finishWithProjection(projection);
});
