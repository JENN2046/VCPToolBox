#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

function withSuppressedConsole(callback) {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return callback();
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
}

const pluginManager = withSuppressedConsole(() => require('../Plugin.js'));

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SANDBOX_ROOT = path.join(PROJECT_ROOT, '.tmp', 'gate-92f-reissue-3-loader-patch-proof');
const SYNTHETIC_PLUGIN_FOLDER = 'SyntheticAIGentOrchestrator';
const SYNTHETIC_PLUGIN_ROOT = path.join(SANDBOX_ROOT, 'Plugin');
const SYNTHETIC_PLUGIN_PATH = path.join(SYNTHETIC_PLUGIN_ROOT, SYNTHETIC_PLUGIN_FOLDER);
const SYNTHETIC_MANIFEST_PATH = path.join(SYNTHETIC_PLUGIN_PATH, 'plugin-manifest.json');
const SYNTHETIC_DISABLED_MARKER_PATH = path.join(SYNTHETIC_PLUGIN_PATH, '.disabled');
const EXTERNAL_PLUGIN_PATH = String.raw`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const EXTERNAL_MANIFEST_PATH = path.join(EXTERNAL_PLUGIN_PATH, 'plugin-manifest.json');

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'disabled absent case proved loadable',
  'disabled present case proved skipped',
  'plugin directory retained',
  'plugin manifest retained',
  'residual sandbox artifact retained',
  'external plugin path exists',
  'external manifest exists',
  'external plugin remains available',
  'server started',
  'route activated',
  'HTTP request issued',
  'provider endpoint contact',
  'real image generation invoked',
  'LocalState write performed',
  'real core disabled marker created',
  'core copy disabled',
  'core copy removed',
  'Plugin/AIGentOrchestrator source changed',
  'Plugin/AIGentOrchestrator/plugin-manifest.json changed',
  'approved fields only',
  'proof output sanitized',
  'secret-like value exposure',
  'raw output passthrough introduced',
  'fail-closed behavior verified',
  'exact sanitized blocker category',
  'exact sanitized branch'
]);

function createProjection() {
  return {
    result: 'BLOCKED',
    route: '92F-Reissue-3',
    mode: 'bounded-reversible-disable-loader-patch-proof',
    'disabled absent case proved loadable': 'no',
    'disabled present case proved skipped': 'no',
    'plugin directory retained': 'no',
    'plugin manifest retained': 'no',
    'residual sandbox artifact retained': 'unknown',
    'external plugin path exists': 'no',
    'external manifest exists': 'no',
    'external plugin remains available': 'no',
    'server started': 'no',
    'route activated': 'no',
    'HTTP request issued': 'no',
    'provider endpoint contact': 'no',
    'real image generation invoked': 'no',
    'LocalState write performed': 'no',
    'real core disabled marker created': 'no',
    'core copy disabled': 'no',
    'core copy removed': 'no',
    'Plugin/AIGentOrchestrator source changed': 'no',
    'Plugin/AIGentOrchestrator/plugin-manifest.json changed': 'no',
    'approved fields only': 'no',
    'proof output sanitized': 'no',
    'secret-like value exposure': 'no',
    'raw output passthrough introduced': 'no',
    'fail-closed behavior verified': 'no',
    'exact sanitized blocker category': 'not evaluated',
    'exact sanitized branch': 'not selected'
  };
}

function isSubPath(child, parent) {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch (_error) {
    return false;
  }
}

function ensureSandboxPath(targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedWorkspaceTmp = path.join(PROJECT_ROOT, '.tmp');
  if (resolvedTarget !== SANDBOX_ROOT && !isSubPath(resolvedTarget, SANDBOX_ROOT)) {
    throw new Error('sandbox path escaped');
  }
  if (!isSubPath(resolvedTarget, resolvedWorkspaceTmp) && resolvedTarget !== SANDBOX_ROOT) {
    throw new Error('sandbox path outside workspace temp');
  }
}

function resetSandbox() {
  ensureSandboxPath(SANDBOX_ROOT);
  fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  fs.mkdirSync(SYNTHETIC_PLUGIN_PATH, { recursive: true });
}

function writeSyntheticManifest() {
  const manifest = {
    manifestVersion: '1.0.0',
    name: 'SyntheticAIGentOrchestrator',
    displayName: 'Synthetic AIGent Orchestrator',
    version: '0.0.0',
    description: 'Synthetic bounded proof fixture.',
    pluginType: 'synchronous',
    entryPoint: {
      type: 'nodejs',
      command: 'node SyntheticAIGentOrchestrator.js'
    },
    communication: {
      protocol: 'stdio',
      timeout: 1000
    }
  };
  fs.writeFileSync(SYNTHETIC_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function discoverSyntheticManifests() {
  return pluginManager._discoverLegacyPluginManifestsFromDir(
    SYNTHETIC_PLUGIN_ROOT,
    'gate-92f-reissue-3-synthetic',
    {
      source: 'gate-92f-reissue-3-synthetic',
      rootPath: SYNTHETIC_PLUGIN_ROOT,
      rootId: 'gate-92f-reissue-3-synthetic',
      displayPath: 'synthetic',
      allowConfigEnv: false
    }
  );
}

async function proveAccessErrorFailsClosed() {
  const originalAccess = fsp.access;
  fsp.access = async function patchedAccess(targetPath, ...args) {
    if (path.basename(targetPath) === '.disabled') {
      const error = new Error('synthetic disabled marker access error');
      error.code = 'EACCES';
      throw error;
    }
    return originalAccess.call(this, targetPath, ...args);
  };
  try {
    const manifests = await discoverSyntheticManifests();
    return manifests.length === 0;
  } finally {
    fsp.access = originalAccess;
  }
}

async function runProof(projection) {
  resetSandbox();
  writeSyntheticManifest();

  const absentManifests = await discoverSyntheticManifests();
  projection['disabled absent case proved loadable'] = absentManifests.length === 1
    && absentManifests[0].name === 'SyntheticAIGentOrchestrator'
    ? 'yes'
    : 'no';
  if (projection['disabled absent case proved loadable'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'disabled absent case failed';
    return projection;
  }

  fs.writeFileSync(SYNTHETIC_DISABLED_MARKER_PATH, 'disabled\n', 'utf8');
  const presentManifests = await discoverSyntheticManifests();
  projection['disabled present case proved skipped'] = presentManifests.length === 0 ? 'yes' : 'no';
  if (projection['disabled present case proved skipped'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'disabled present case failed';
    return projection;
  }

  fs.rmSync(SYNTHETIC_DISABLED_MARKER_PATH, { force: true });
  projection['fail-closed behavior verified'] = await proveAccessErrorFailsClosed() ? 'yes' : 'no';
  if (projection['fail-closed behavior verified'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'fail closed behavior failed';
    return projection;
  }

  projection['plugin directory retained'] = pathExists(SYNTHETIC_PLUGIN_PATH) ? 'yes' : 'no';
  projection['plugin manifest retained'] = pathExists(SYNTHETIC_MANIFEST_PATH) ? 'yes' : 'no';
  projection['external plugin path exists'] = pathExists(EXTERNAL_PLUGIN_PATH) ? 'yes' : 'no';
  projection['external manifest exists'] = pathExists(EXTERNAL_MANIFEST_PATH) ? 'yes' : 'no';
  projection['external plugin remains available'] = projection['external plugin path exists'] === 'yes'
    && projection['external manifest exists'] === 'yes'
    ? 'yes'
    : 'no';

  if (projection['plugin directory retained'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'synthetic plugin directory missing';
    return projection;
  }
  if (projection['plugin manifest retained'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'synthetic plugin manifest missing';
    return projection;
  }
  if (projection['external plugin remains available'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'external plugin unavailable';
    return projection;
  }

  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'synthetic_legacy_loader_disabled_marker_proof';
  return projection;
}

function cleanupSandbox(projection) {
  try {
    ensureSandboxPath(SANDBOX_ROOT);
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
    projection['residual sandbox artifact retained'] = pathExists(SANDBOX_ROOT) ? 'yes' : 'no';
  } catch (_error) {
    projection['residual sandbox artifact retained'] = 'yes';
    if (projection.result === 'PASS') {
      projection.result = 'BLOCKED';
      projection['exact sanitized blocker category'] = 'sandbox cleanup failed';
    }
  }
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
    '92F-Reissue-3',
    'bounded-reversible-disable-loader-patch-proof',
    'unknown',
    'none',
    'not evaluated',
    'not selected',
    'disabled absent case failed',
    'disabled present case failed',
    'fail closed behavior failed',
    'synthetic plugin directory missing',
    'synthetic plugin manifest missing',
    'external plugin unavailable',
    'sandbox cleanup failed',
    'unexpected proof error',
    'synthetic_legacy_loader_disabled_marker_proof'
  ]);
  return Object.values(projection).every((value) => approvedValues.has(value));
}

function normalizeSanitizedProjection(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  candidate['approved fields only'] = projectionHasOnlyApprovedFields(candidate) ? 'yes' : 'no';
  if (candidate['approved fields only'] !== 'yes') return null;
  if (!projectionHasOnlyApprovedValues(candidate)) return null;
  candidate['proof output sanitized'] = 'yes';
  return candidate;
}

function buildProjectionOutput(projection) {
  const safeProjection = normalizeSanitizedProjection(projection) || (() => {
    const blocked = createProjection();
    blocked['secret-like value exposure'] = 'yes';
    blocked['raw output passthrough introduced'] = 'yes';
    blocked['exact sanitized blocker category'] = 'unexpected proof error';
    return blocked;
  })();

  const lines = APPROVED_FIELDS.map((field) => `${field}: ${safeProjection[field]}`).join('\n');
  return `${JSON.stringify(safeProjection, null, 2)}\n${lines}\n`;
}

async function main() {
  const projection = createProjection();
  try {
    await runProof(projection);
  } catch (_error) {
    projection.result = 'BLOCKED';
    projection['exact sanitized blocker category'] = 'unexpected proof error';
  } finally {
    cleanupSandbox(projection);
  }

  process.stdout.write(buildProjectionOutput(projection));
  process.exit(projection.result === 'PASS' ? 0 : 1);
}

main();
