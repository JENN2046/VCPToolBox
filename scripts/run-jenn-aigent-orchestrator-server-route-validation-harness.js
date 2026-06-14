#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const STAGE85B_ARG = '--stage85b-bounded-server-route-proof';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_FILE = path.join(PROJECT_ROOT, 'server.js');
const ROUTE_FILE = path.join(PROJECT_ROOT, 'routes', 'admin', 'aiImageAgents.js');
const SERVER_DISPLAY = 'server.js';
const ROUTE_DISPLAY = 'routes/admin/aiImageAgents.js';

const APPROVED_FIELDS = Object.freeze([
  'result',
  'route',
  'mode',
  'server source inspected',
  'route source inspected',
  'server file',
  'route file',
  'server route mount found',
  'server route mount path exact',
  'route factory exported',
  'dry-run route present',
  'dry-run forceDryRun true',
  'execute route present',
  'execute route gated',
  'internal route mount observed',
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
  'Gate 86 started'
]);

function createProjection(mode = 'not selected') {
  return {
    result: 'BLOCKED',
    route: '85B',
    mode,
    'server source inspected': 'no',
    'route source inspected': 'no',
    'server file': SERVER_DISPLAY,
    'route file': ROUTE_DISPLAY,
    'server route mount found': 'no',
    'server route mount path exact': 'no',
    'route factory exported': 'no',
    'dry-run route present': 'no',
    'dry-run forceDryRun true': 'no',
    'execute route present': 'no',
    'execute route gated': 'no',
    'internal route mount observed': 'no',
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
    'exact sanitized blocker category': 'stage85 mode not selected',
    'exact sanitized branch': 'not selected',
    'retry started': 'no',
    'Gate 86 started': 'no'
  };
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sourceContains(source, pattern) {
  return typeof pattern === 'string'
    ? source.includes(pattern)
    : pattern.test(source);
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
    '85B',
    'not selected',
    'bounded-server-route',
    'none',
    'stage85 mode not selected',
    'invalid stage85 mode',
    'server source read failed',
    'route source read failed',
    'server route mount missing',
    'route factory missing',
    'dry-run route missing',
    'execute route gate missing',
    'bounded_server_route_static_proof',
    SERVER_DISPLAY,
    ROUTE_DISPLAY
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
  const hasStage85BArg = process.argv.includes(STAGE85B_ARG);
  return process.argv.length === 3 && hasStage85BArg ? 'bounded-server-route' : null;
}

function runStage85BStaticProof(projection) {
  let serverSource;
  let routeSource;

  try {
    serverSource = readUtf8(SERVER_FILE);
    projection['server source inspected'] = 'yes';
  } catch (_error) {
    projection['exact sanitized blocker category'] = 'server source read failed';
    return projection;
  }

  try {
    routeSource = readUtf8(ROUTE_FILE);
    projection['route source inspected'] = 'yes';
  } catch (_error) {
    projection['exact sanitized blocker category'] = 'route source read failed';
    return projection;
  }

  projection['server route mount found'] = sourceContains(
    serverSource,
    "app.use('/admin_api/ai-image-agents', createAiImageAgentsRouter(routeOptions))"
  ) ? 'yes' : 'no';
  projection['server route mount path exact'] = projection['server route mount found'];
  projection['internal route mount observed'] = sourceContains(
    serverSource,
    "app.use(\n        '/internal/ai-image-agents',"
  ) ? 'yes' : 'no';

  projection['route factory exported'] = sourceContains(routeSource, 'createAiImageAgentsRouter,')
    && sourceContains(routeSource, 'function createAiImageAgentsRouter(options = {})')
    ? 'yes'
    : 'no';
  projection['dry-run route present'] = sourceContains(routeSource, "router.post('/dry-run'")
    ? 'yes'
    : 'no';
  projection['dry-run forceDryRun true'] = sourceContains(routeSource, 'forceDryRun: true')
    ? 'yes'
    : 'no';
  projection['execute route present'] = sourceContains(routeSource, "router.post('/execute'")
    ? 'yes'
    : 'no';
  projection['execute route gated'] = sourceContains(routeSource, 'body.dryRun !== false')
    && sourceContains(routeSource, 'body.confirm !== true')
    && sourceContains(routeSource, 'operatorId')
    ? 'yes'
    : 'no';

  if (projection['server route mount found'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'server route mount missing';
    return projection;
  }
  if (projection['route factory exported'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'route factory missing';
    return projection;
  }
  if (projection['dry-run route present'] !== 'yes' || projection['dry-run forceDryRun true'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'dry-run route missing';
    return projection;
  }
  if (projection['execute route present'] !== 'yes' || projection['execute route gated'] !== 'yes') {
    projection['exact sanitized blocker category'] = 'execute route gate missing';
    return projection;
  }

  projection.result = 'PASS';
  projection['exact sanitized blocker category'] = 'none';
  projection['exact sanitized branch'] = 'bounded_server_route_static_proof';
  return projection;
}

function main() {
  const mode = determineMode();
  if (!mode) {
    process.stdout.write(buildProjectionOutput(createProjection()));
    process.exitCode = 1;
    return;
  }

  const projection = createProjection(mode);
  const finalProjection = runStage85BStaticProof(projection);
  process.stdout.write(buildProjectionOutput(finalProjection));
  process.exitCode = finalProjection.result === 'PASS' ? 0 : 1;
}

main();
