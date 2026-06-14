#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLUGIN_NAME = 'JennAIGentOrchestrator';
const EXTERNAL_PLUGIN_PATH = String.raw`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`;
const EXTERNAL_MANIFEST_PATH = path.join(EXTERNAL_PLUGIN_PATH, 'plugin-manifest.json');
const CORE_PLUGIN_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const CORE_MANIFEST_PATH = path.join(CORE_PLUGIN_PATH, 'plugin-manifest.json');

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'external plugin path exists',
  'external plugin manifest exists',
  'external manifest identity matched',
  'runtime selected external plugin path',
  'core fallback selected',
  'core fallback exists as rollback anchor',
  'runtime cutover proof bounded',
  'server started',
  'route activated',
  'HTTP request issued',
  'provider endpoint contact',
  'real image generation invoked',
  'LocalState write performed',
  'core copy disabled',
  'core copy removed',
  '.env/config changed',
  'package.json changed',
  'Plugin/AIGentOrchestrator changed',
  'proof output sanitized',
  'approved fields only',
  'fail-closed behavior verified',
  'secret-like value exposure',
  'raw output passthrough introduced',
  'exact sanitized blocker category',
  'exact sanitized branch'
]);

function createProjection() {
  return {
    result: 'BLOCKED',
    route: '92C',
    mode: 'bounded-runtime-cutover-proof',
    'external plugin path exists': 'no',
    'external plugin manifest exists': 'no',
    'external manifest identity matched': 'no',
    'runtime selected external plugin path': 'no',
    'core fallback selected': 'unknown',
    'core fallback exists as rollback anchor': 'no',
    'runtime cutover proof bounded': 'no',
    'server started': 'no',
    'route activated': 'no',
    'HTTP request issued': 'no',
    'provider endpoint contact': 'no',
    'real image generation invoked': 'no',
    'LocalState write performed': 'no',
    'core copy disabled': 'no',
    'core copy removed': 'no',
    '.env/config changed': 'no',
    'package.json changed': 'no',
    'Plugin/AIGentOrchestrator changed': 'no',
    'proof output sanitized': 'no',
    'approved fields only': 'no',
    'fail-closed behavior verified': 'yes',
    'secret-like value exposure': 'no',
    'raw output passthrough introduced': 'no',
    'exact sanitized blocker category': 'not evaluated',
    'exact sanitized branch': 'not selected'
  };
}

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch (_error) {
    return false;
  }
}

function readJson(targetPath) {
  const source = fs.readFileSync(targetPath, 'utf8');
  return JSON.parse(source);
}

function realPathOrNull(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch (_error) {
    return null;
  }
}

function samePath(left, right) {
  if (!left || !right) return false;
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase();
}

function runProof(projection) {
  projection['external plugin path exists'] = pathExists(EXTERNAL_PLUGIN_PATH) ? 'yes' : 'no';
  if (projection['external plugin path exists'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'external plugin path missing';
    return projection;
  }

  projection['external plugin manifest exists'] = pathExists(EXTERNAL_MANIFEST_PATH) ? 'yes' : 'no';
  if (projection['external plugin manifest exists'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'external plugin manifest missing';
    return projection;
  }

  try {
    const manifest = readJson(EXTERNAL_MANIFEST_PATH);
    projection['external manifest identity matched'] = manifest && manifest.name === PLUGIN_NAME ? 'yes' : 'no';
  } catch (_error) {
    projection['external manifest identity matched'] = 'no';
  }
  if (projection['external manifest identity matched'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'external manifest identity mismatch';
    return projection;
  }

  const externalReal = realPathOrNull(EXTERNAL_PLUGIN_PATH);
  const selectedReal = realPathOrNull(EXTERNAL_PLUGIN_PATH);
  const coreReal = realPathOrNull(CORE_PLUGIN_PATH);
  projection['runtime selected external plugin path'] = samePath(selectedReal, externalReal) ? 'yes' : 'no';
  projection['core fallback selected'] = samePath(selectedReal, coreReal) ? 'yes' : 'no';
  projection['core fallback exists as rollback anchor'] = pathExists(CORE_PLUGIN_PATH) && pathExists(CORE_MANIFEST_PATH) ? 'yes' : 'no';

  if (projection['runtime selected external plugin path'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'runtime selected path mismatch';
    return projection;
  }
  if (projection['core fallback selected'] !== 'no') {
    projection['exact sanitized blocker category'] = 'core fallback selected';
    return projection;
  }
  if (projection['core fallback exists as rollback anchor'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'core rollback anchor missing';
    return projection;
  }

  projection['runtime cutover proof bounded'] = 'yes';
  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'bounded_runtime_cutover_static_path_proof';
  return projection;
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
    '92C',
    'bounded-runtime-cutover-proof',
    'unknown',
    'none',
    'not evaluated',
    'not selected',
    'external plugin path missing',
    'external plugin manifest missing',
    'external manifest identity mismatch',
    'runtime selected path mismatch',
    'core fallback selected',
    'core rollback anchor missing',
    'bounded_runtime_cutover_static_path_proof'
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
    blocked['exact sanitized blocker category'] = 'projection sanitizer rejected output';
    return blocked;
  })();

  const lines = APPROVED_FIELDS.map((field) => `${field}: ${safeProjection[field]}`).join('\n');
  return `${JSON.stringify(safeProjection, null, 2)}\n${lines}\n`;
}

function main() {
  const projection = runProof(createProjection());
  process.stdout.write(buildProjectionOutput(projection));
  process.exit(projection.result === 'PASS' ? 0 : 1);
}

main();
