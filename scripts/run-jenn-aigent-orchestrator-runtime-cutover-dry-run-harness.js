#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STAGE86B_ARG = '--stage86b-runtime-cutover-shadow-proof';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLUGIN_NAME = 'JennAIGentOrchestrator';
const EXTERNAL_PLUGIN_PATH = path.resolve(
  PROJECT_ROOT,
  '..',
  'VCPToolBox-JENN-Extensions',
  'Plugin',
  PLUGIN_NAME
);
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const MANIFEST_PATH = path.join(EXTERNAL_PLUGIN_PATH, 'plugin-manifest.json');
const EXACT_RUNTIME_ALLOWLIST = `${PLUGIN_NAME}@${EXTERNAL_PLUGIN_PATH}`;
const EXPECTED_EXACT_RUNTIME_ALLOWLIST = String.raw`JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const NO_PROVIDER_RUNTIME_HARNESS = path.join(
  PROJECT_ROOT,
  'scripts',
  'run-jenn-aigent-orchestrator-no-provider-runtime-harness.js'
);
const GATE_86A_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'GATE_86A_AIGENT_ORCHESTRATOR_RUNTIME_CUTOVER_RFC_AND_DRY_RUN_HARNESS.md'
);

const PREREQ_DOCS = Object.freeze([
  {
    field: 'Gate 83B sealed',
    path: path.join(
      PROJECT_ROOT,
      'docs',
      'governance',
      'GATE_83B_AIGENT_ORCHESTRATOR_NO_PROVIDER_PLUGIN_EXECUTION_PROOF.md'
    ),
    needles: [
      'route: 83B',
      'result: PASS',
      'processToolCall called: yes',
      'executePlugin called: yes',
      'provider endpoint contact: no',
      'runtime cutover: no'
    ]
  },
  {
    field: 'Gate 83C sealed',
    path: path.join(
      PROJECT_ROOT,
      'docs',
      'governance',
      'GATE_83C_AIGENT_ORCHESTRATOR_PROVIDER_PRESERVING_PLUGIN_EXECUTION_PROOF.md'
    ),
    needles: [
      'route: 83C',
      'result: PASS',
      'mode: provider-preserving',
      'provider endpoint contact: no',
      'runtime cutover: no'
    ]
  },
  {
    field: 'Gate 84B sealed',
    path: path.join(
      PROJECT_ROOT,
      'docs',
      'governance',
      'GATE_84B_AIGENT_ORCHESTRATOR_LOCALSTATE_BOUNDED_PROOF.md'
    ),
    needles: [
      'route: 84B',
      'result: PASS',
      'write accepted: yes',
      'readback accepted: yes',
      'cleanup accepted: yes',
      'runtime cutover: no'
    ]
  },
  {
    field: 'Gate 85B sealed',
    path: path.join(
      PROJECT_ROOT,
      'docs',
      'governance',
      'GATE_85B_AIGENT_ORCHESTRATOR_SERVER_ROUTE_BOUNDED_PROOF.md'
    ),
    needles: [
      'route: 85B',
      'result: PASS',
      'server route mount found: yes',
      'dry-run route present: yes',
      'execute route gated: yes',
      'runtime cutover: no'
    ]
  }
]);

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'Gate 86A RFC present',
  'Gate 83B sealed',
  'Gate 83C sealed',
  'Gate 84B sealed',
  'Gate 85B sealed',
  'runtime harness source inspected',
  'runtime harness fail-closed default present',
  'dry-run request shape preserved',
  'exact external allowlist present',
  'external path resolved',
  'external path exact match',
  'external manifest identity matched',
  'core fallback false',
  'runtime cutover attempted',
  'runtime config modified',
  'server route activation',
  'http request sent',
  'listener started',
  'provider endpoint contact',
  'real image generation invoked',
  'image output produced',
  'LocalState write',
  'plugin execution attempted',
  'processToolCall called',
  'executePlugin called',
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
  'Gate 87 started'
]);

function createProjection(mode = 'not selected') {
  return {
    result: 'BLOCKED',
    route: '86B',
    mode,
    'Gate 86A RFC present': 'no',
    'Gate 83B sealed': 'no',
    'Gate 83C sealed': 'no',
    'Gate 84B sealed': 'no',
    'Gate 85B sealed': 'no',
    'runtime harness source inspected': 'no',
    'runtime harness fail-closed default present': 'no',
    'dry-run request shape preserved': 'no',
    'exact external allowlist present': 'no',
    'external path resolved': 'no',
    'external path exact match': 'no',
    'external manifest identity matched': 'no',
    'core fallback false': 'no',
    'runtime cutover attempted': 'no',
    'runtime config modified': 'no',
    'server route activation': 'no',
    'http request sent': 'no',
    'listener started': 'no',
    'provider endpoint contact': 'no',
    'real image generation invoked': 'no',
    'image output produced': 'no',
    'LocalState write': 'no',
    'plugin execution attempted': 'no',
    'processToolCall called': 'no',
    'executePlugin called': 'no',
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
    'exact sanitized blocker category': 'stage86 mode not selected',
    'exact sanitized branch': 'not selected',
    'retry started': 'no',
    'Gate 87 started': 'no'
  };
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fileContainsAll(filePath, needles) {
  try {
    const source = readUtf8(filePath);
    return needles.every((needle) => source.includes(needle));
  } catch (_error) {
    return false;
  }
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

function proveExternalPath(projection) {
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
    const manifest = JSON.parse(readUtf8(MANIFEST_PATH));
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

function proveRuntimeHarnessSource(projection) {
  let source;
  let thisHarnessSource;
  try {
    source = readUtf8(NO_PROVIDER_RUNTIME_HARNESS);
    thisHarnessSource = readUtf8(__filename);
    projection['runtime harness source inspected'] = 'yes';
  } catch (_error) {
    projection['exact sanitized blocker category'] = 'runtime harness source read failed';
    return false;
  }

  projection['runtime harness fail-closed default present'] = thisHarnessSource.includes('stage86 mode not selected')
    && thisHarnessSource.includes('process.exit(1)')
    ? 'yes'
    : 'no';

  projection['dry-run request shape preserved'] = source.includes('allowProvider: false')
    && source.includes('allowDownstream: false')
    && source.includes('allowExecution: false')
    && source.includes('PlanImagePipeline')
    ? 'yes'
    : 'no';

  projection['exact external allowlist present'] = EXACT_RUNTIME_ALLOWLIST === EXPECTED_EXACT_RUNTIME_ALLOWLIST
    && source.includes(EXPECTED_EXACT_RUNTIME_ALLOWLIST)
    ? 'yes'
    : 'no';

  if (projection['runtime harness fail-closed default present'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'runtime harness fail-closed default missing';
    return false;
  }
  if (projection['dry-run request shape preserved'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'dry-run request shape mismatch';
    return false;
  }
  if (projection['exact external allowlist present'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'exact external allowlist mismatch';
    return false;
  }
  return true;
}

function provePriorGates(projection) {
  for (const prereq of PREREQ_DOCS) {
    projection[prereq.field] = fileContainsAll(prereq.path, prereq.needles) ? 'yes' : 'no';
    if (projection[prereq.field] !== 'yes') {
      projection['exact sanitized blocker category'] = `${prereq.field} missing`;
      return false;
    }
  }
  return true;
}

function proveGate86ARfc(projection) {
  projection['Gate 86A RFC present'] = fileContainsAll(GATE_86A_DOC, [
    'route: 86A',
    'result: PASS',
    'classification: RUNTIME_CUTOVER_RFC_AND_DRY_RUN_HARNESS_READY',
    'scripts/run-jenn-aigent-orchestrator-runtime-cutover-dry-run-harness.js',
    '--stage86b-runtime-cutover-shadow-proof',
    'runtime cutover in 86A: no'
  ]) ? 'yes' : 'no';

  if (projection['Gate 86A RFC present'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'Gate 86A RFC missing';
    return false;
  }
  return true;
}

function runStage86BShadowProof(projection) {
  const checks = [
    proveGate86ARfc,
    provePriorGates,
    proveRuntimeHarnessSource,
    proveExternalPath,
    proveManifestIdentity
  ];

  for (const check of checks) {
    if (!check(projection)) return projection;
  }

  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'runtime_cutover_shadow_static_proof';
  return projection;
}

function determineMode() {
  const hasStage86BArg = process.argv.includes(STAGE86B_ARG);
  return process.argv.length === 3 && hasStage86BArg ? 'runtime-cutover-shadow' : null;
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
    '86B',
    'not selected',
    'runtime-cutover-shadow',
    'none',
    'stage86 mode not selected',
    'invalid stage86 mode',
    'Gate 86A RFC missing',
    'Gate 83B sealed missing',
    'Gate 83C sealed missing',
    'Gate 84B sealed missing',
    'Gate 85B sealed missing',
    'runtime harness source read failed',
    'runtime harness fail-closed default missing',
    'dry-run request shape mismatch',
    'exact external allowlist mismatch',
    'external path unresolved',
    'external path mismatch',
    'core fallback true',
    'manifest identity mismatch',
    'runtime_cutover_shadow_static_proof'
  ]);

  return Object.values(projection).every((value) => approvedValues.has(value));
}

function normalizeSanitizedProjection(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  if (!projectionHasOnlyApprovedFields(candidate)) return null;
  if (!projectionHasOnlyApprovedValues(candidate)) return null;
  return candidate;
}

function buildProjectionOutput(projection) {
  const safeProjection = normalizeSanitizedProjection(projection) || (() => {
    const blocked = createProjection();
    blocked['secret-like value printed'] = 'yes';
    blocked['sanitizer suspected forbidden output'] = 'yes';
    return blocked;
  })();

  const lines = APPROVED_FIELDS.map((field) => `${field}: ${safeProjection[field]}`).join('\n');
  return `${JSON.stringify(safeProjection, null, 2)}\n${lines}\n`;
}

function main() {
  const mode = determineMode();
  const projection = createProjection(mode || 'not selected');

  if (!mode) {
    if (process.argv.length !== 2) {
      projection['exact sanitized blocker category'] = 'invalid stage86 mode';
    }
    process.stdout.write(buildProjectionOutput(projection));
    process.exit(1);
  }

  runStage86BShadowProof(projection);
  process.stdout.write(buildProjectionOutput(projection));
  process.exit(projection.result === 'PASS' ? 0 : 1);
}

main();
