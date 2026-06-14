#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STAGE88_ARG = '--stage88-rollback-drill-proof';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PLUGIN_ROOT = String.raw`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin`;
const EXACT_ALLOWLIST = String.raw`JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const ENV_KEYS = Object.freeze([
  'VCP_PLUGIN_DIRS',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST'
]);
const GATE_86B_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'GATE_86B_AIGENT_ORCHESTRATOR_RUNTIME_CUTOVER_SHADOW_PROOF.md'
);
const GATE_87_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'GATE_87_AIGENT_ORCHESTRATOR_BOUNDED_RUNTIME_CUTOVER_PREFLIGHT_BLOCKED.md'
);

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'Gate 86B sealed',
  'Gate 87 preflight block sealed',
  'rollback target values exact',
  'process-only env overlay built',
  'process env mutated',
  'overlay rollback performed',
  'overlay rollback accepted',
  '.env read',
  '.env modified',
  'config.env read',
  'config.env modified',
  'Plugin.js modified',
  'Plugin directory modified',
  'external package modified',
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
  'runtime cutover performed',
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
  'Gate 89 started'
]);

function createProjection(mode = 'not selected') {
  return {
    result: 'BLOCKED',
    route: '88',
    mode,
    'Gate 86B sealed': 'no',
    'Gate 87 preflight block sealed': 'no',
    'rollback target values exact': 'no',
    'process-only env overlay built': 'no',
    'process env mutated': 'no',
    'overlay rollback performed': 'no',
    'overlay rollback accepted': 'no',
    '.env read': 'no',
    '.env modified': 'no',
    'config.env read': 'no',
    'config.env modified': 'no',
    'Plugin.js modified': 'no',
    'Plugin directory modified': 'no',
    'external package modified': 'no',
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
    'runtime cutover performed': 'no',
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
    'exact sanitized blocker category': 'stage88 mode not selected',
    'exact sanitized branch': 'not selected',
    'retry started': 'no',
    'Gate 89 started': 'no'
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

function provePriorGates(projection) {
  projection['Gate 86B sealed'] = fileContainsAll(GATE_86B_DOC, [
    'route: 86B',
    'result: PASS',
    'runtime cutover performed: no',
    'core fallback false: yes'
  ]) ? 'yes' : 'no';
  if (projection['Gate 86B sealed'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'Gate 86B seal missing';
    return false;
  }

  projection['Gate 87 preflight block sealed'] = fileContainsAll(GATE_87_DOC, [
    'route: 87',
    'result: BLOCKED',
    'classification: BOUNDED_RUNTIME_CUTOVER_PRE_MUTATION_BLOCKED',
    'runtime selection modified: no'
  ]) ? 'yes' : 'no';
  if (projection['Gate 87 preflight block sealed'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'Gate 87 preflight block missing';
    return false;
  }
  return true;
}

function buildProcessOnlyOverlay(baseEnv) {
  return {
    ...baseEnv,
    VCP_PLUGIN_DIRS: EXTERNAL_PLUGIN_ROOT,
    VCP_EXTERNAL_PLUGIN_ALLOWLIST: EXACT_ALLOWLIST
  };
}

function proveRollbackDrill(projection) {
  const before = {};
  for (const key of ENV_KEYS) before[key] = process.env[key];

  const overlay = buildProcessOnlyOverlay(process.env);
  projection['process-only env overlay built'] = overlay.VCP_PLUGIN_DIRS === EXTERNAL_PLUGIN_ROOT
    && overlay.VCP_EXTERNAL_PLUGIN_ALLOWLIST === EXACT_ALLOWLIST
    ? 'yes'
    : 'no';
  projection['rollback target values exact'] = projection['process-only env overlay built'];
  projection['process env mutated'] = ENV_KEYS.some((key) => process.env[key] !== before[key]) ? 'yes' : 'no';

  for (const key of ENV_KEYS) delete overlay[key];
  projection['overlay rollback performed'] = 'yes';
  projection['overlay rollback accepted'] = ENV_KEYS.every((key) => !Object.prototype.hasOwnProperty.call(overlay, key))
    && ENV_KEYS.every((key) => process.env[key] === before[key])
    ? 'yes'
    : 'no';

  if (projection['rollback target values exact'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'rollback target mismatch';
    return false;
  }
  if (projection['process env mutated'] !== 'no') {
    projection['exact sanitized blocker category'] = 'process env mutated';
    return false;
  }
  if (projection['overlay rollback accepted'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'overlay rollback failed';
    return false;
  }
  return true;
}

function runStage88RollbackDrill(projection) {
  if (!provePriorGates(projection)) return projection;
  if (!proveRollbackDrill(projection)) return projection;

  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'rollback_drill_process_only_overlay';
  return projection;
}

function determineMode() {
  const hasStage88Arg = process.argv.includes(STAGE88_ARG);
  return process.argv.length === 3 && hasStage88Arg ? 'rollback-drill-static' : null;
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
    '88',
    'not selected',
    'rollback-drill-static',
    'none',
    'stage88 mode not selected',
    'invalid stage88 mode',
    'Gate 86B seal missing',
    'Gate 87 preflight block missing',
    'rollback target mismatch',
    'process env mutated',
    'overlay rollback failed',
    'rollback_drill_process_only_overlay'
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
      projection['exact sanitized blocker category'] = 'invalid stage88 mode';
    }
    process.stdout.write(buildProjectionOutput(projection));
    process.exit(1);
  }

  runStage88RollbackDrill(projection);
  process.stdout.write(buildProjectionOutput(projection));
  process.exit(projection.result === 'PASS' ? 0 : 1);
}

main();
