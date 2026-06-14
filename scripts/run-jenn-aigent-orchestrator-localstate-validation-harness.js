#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const STAGE84B_ARG = '--stage84b-bounded-localstate-proof';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SANDBOX_ROOT = path.join(os.tmpdir(), 'vcp-gate-84b-localstate-sandbox');
const MARKER_FILE_NAME = 'gate84b-localstate-marker.json';

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'sandbox path configured',
  'sandbox path allowed',
  'sandbox path',
  'real LocalState path touched',
  'project runtime path touched',
  'write attempted',
  'write accepted',
  'readback accepted',
  'cleanup attempted',
  'cleanup accepted',
  'provider endpoint contact',
  'real image generation invoked',
  'image output produced',
  'plugin execution attempted',
  'processToolCall called',
  'executePlugin called',
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
  'Gate 85 started'
]);

function createProjection(mode = 'not selected') {
  return {
    result: 'BLOCKED',
    route: '84B',
    mode,
    'sandbox path configured': 'no',
    'sandbox path allowed': 'no',
    'sandbox path': DEFAULT_SANDBOX_ROOT,
    'real LocalState path touched': 'no',
    'project runtime path touched': 'no',
    'write attempted': 'no',
    'write accepted': 'no',
    'readback accepted': 'no',
    'cleanup attempted': 'no',
    'cleanup accepted': 'no',
    'provider endpoint contact': 'no',
    'real image generation invoked': 'no',
    'image output produced': 'no',
    'plugin execution attempted': 'no',
    'processToolCall called': 'no',
    'executePlugin called': 'no',
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
    'exact sanitized blocker category': 'stage84 mode not selected',
    'exact sanitized branch': 'not selected',
    'retry started': 'no',
    'Gate 85 started': 'no'
  };
}

function normalizeComparablePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSubPathOrEqual(candidate, parent) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedParent = path.resolve(parent);
  if (normalizeComparablePath(resolvedCandidate) === normalizeComparablePath(resolvedParent)) return true;
  const relative = path.relative(resolvedParent, resolvedCandidate);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function pathContainsForbiddenRuntimeName(candidatePath) {
  const normalized = path.resolve(candidatePath).replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/localstate')
    || normalized.includes('/state')
    || normalized.includes('/cache')
    || normalized.includes('/debuglog')
    || normalized.includes('/image')
    || normalized.includes('/plugin/');
}

function resolveSandboxPath() {
  const rawSandbox = process.env.GATE84_LOCALSTATE_SANDBOX_DIR || DEFAULT_SANDBOX_ROOT;
  return path.resolve(rawSandbox);
}

function sandboxPathIsAllowed(sandboxPath) {
  if (!sandboxPath || pathContainsForbiddenRuntimeName(sandboxPath)) return false;
  if (isSubPathOrEqual(sandboxPath, PROJECT_ROOT)) return false;
  return isSubPathOrEqual(sandboxPath, os.tmpdir());
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
    '84B',
    'not selected',
    'bounded-localstate',
    'none',
    'stage84 mode not selected',
    'invalid stage84 mode',
    'sandbox path rejected',
    'sandbox write failed',
    'sandbox readback failed',
    'sandbox cleanup failed',
    'bounded_localstate_sandbox_proof',
    DEFAULT_SANDBOX_ROOT
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

function determineMode() {
  const hasStage84BArg = process.argv.includes(STAGE84B_ARG);
  return process.argv.length === 3 && hasStage84BArg ? 'bounded-localstate' : null;
}

function writeReadAndCleanupSandbox(projection, sandboxPath) {
  const markerPath = path.join(sandboxPath, MARKER_FILE_NAME);
  const marker = {
    route: '84B',
    marker: 'bounded-localstate-sandbox-proof',
    provider: 'not-contacted',
    image: 'not-generated'
  };

  try {
    projection['write attempted'] = 'yes';
    fs.mkdirSync(sandboxPath, { recursive: true });
    fs.writeFileSync(markerPath, `${JSON.stringify(marker)}\n`, { encoding: 'utf8', flag: 'wx' });
    projection['write accepted'] = 'yes';

    const readback = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    projection['readback accepted'] = readback
      && readback.route === '84B'
      && readback.marker === 'bounded-localstate-sandbox-proof'
      ? 'yes'
      : 'no';
  } catch (_error) {
    projection['exact sanitized blocker category'] = projection['write accepted'] === 'yes'
      ? 'sandbox readback failed'
      : 'sandbox write failed';
    return projection;
  } finally {
    projection['cleanup attempted'] = 'yes';
    try {
      if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
      if (fs.existsSync(sandboxPath)) fs.rmdirSync(sandboxPath);
      projection['cleanup accepted'] = 'yes';
    } catch (_error) {
      projection['cleanup accepted'] = 'no';
    }
  }

  if (projection['cleanup accepted'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'sandbox cleanup failed';
    return projection;
  }
  if (projection['readback accepted'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'sandbox readback failed';
    return projection;
  }

  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'bounded_localstate_sandbox_proof';
  return projection;
}

function runStage84BProof(projection) {
  const sandboxPath = resolveSandboxPath();
  projection['sandbox path configured'] = 'yes';
  projection['sandbox path'] = sandboxPath;

  if (!sandboxPathIsAllowed(sandboxPath)) {
    projection['sandbox path allowed'] = 'no';
    projection['exact sanitized blocker category'] = 'sandbox path rejected';
    return projection;
  }

  projection['sandbox path allowed'] = 'yes';
  return writeReadAndCleanupSandbox(projection, sandboxPath);
}

function main() {
  const mode = determineMode();
  if (!mode) {
    process.stdout.write(buildProjectionOutput(createProjection()));
    process.exitCode = 1;
    return;
  }

  const projection = createProjection(mode);
  const finalProjection = runStage84BProof(projection);
  process.stdout.write(buildProjectionOutput(finalProjection));
  process.exitCode = finalProjection.result === 'PASS' ? 0 : 1;
}

main();
