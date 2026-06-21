'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const path = require('path');
const test = require('node:test');

const {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV
} = require('../modules/aiImageAdapterRegistry');
const {
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH
} = require('../routes/admin/aiImageAdapterDiagnostics');
const {
  AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH,
  buildAndMountAiImageAdapterDiagnosticRoute,
  hasAdminAuthBoundary
} = require('../modules/aiImageAdapterDiagnosticRuntimeMount');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');

function scopedEnv(extra = {}) {
  return {
    [ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]: 'true',
    [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT,
    ...extra
  };
}

async function startAdminApiServer(router, options = {}) {
  const app = express();
  app.use('/admin_api', (req, _res, next) => {
    if (options.markAdminAuth !== false) {
      req.adminAuthBoundaryReached = true;
    }
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

async function fetchJson(server, options = {}) {
  const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, options);
  let body = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = null;
  }
  return { response, body };
}

function walk(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      visitor(key, nested);
      walk(nested, visitor);
    }
  }
}

function countAbsolutePathValues(value) {
  let count = 0;
  walk(value, (_key, nested) => {
    if (typeof nested === 'string' && /(?:[A-Za-z]:[\\/]|\\\\|\/AGENTS_OS_Workspace\/)/.test(nested)) {
      count += 1;
    }
  });
  return count;
}

function countForbiddenFieldNames(value) {
  const forbidden = new Set([
    'absolutePath',
    'packageRoot',
    'packageDisplayPath',
    'manifestPath',
    'manifestDisplayPath',
    'rawBinding',
    'sourceCode',
    'prompt',
    'outputPath',
    'providerEndpoint',
    'credentialRef',
    'token',
    'password',
    'cookie',
    'authorization',
    'authHeader'
  ]);
  let count = 0;
  walk(value, (key) => {
    if (forbidden.has(key)) count += 1;
  });
  return count;
}

test('AI Image diagnostic production-router mount is default-off', async () => {
  const router = express.Router();
  const summary = buildAndMountAiImageAdapterDiagnosticRoute(router, {
    projectRoot: PROJECT_ROOT,
    env: {}
  });

  assert.strictEqual(summary.routeEnabled, false);
  assert.strictEqual(summary.attemptedRouteCount, 0);
  assert.strictEqual(summary.mountedRouteCount, 0);
  assert.deepStrictEqual(summary.mountedRoutes, []);

  const server = await startAdminApiServer(router);
  try {
    const result = await fetchJson(server);
    assert.strictEqual(result.response.status, 404);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic production-router mount attaches scoped read-only route', async () => {
  const router = express.Router();
  const summary = buildAndMountAiImageAdapterDiagnosticRoute(router, {
    projectRoot: PROJECT_ROOT,
    env: scopedEnv()
  });

  assert.strictEqual(summary.routeEnabled, true);
  assert.strictEqual(summary.attemptedRouteCount, 1);
  assert.strictEqual(summary.mountedRouteCount, 1);
  assert.strictEqual(summary.mountedRoutes[0].mountPath, AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH);
  assert.strictEqual(summary.mountedRoutes[0].fullPath, AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH);
  assert.deepStrictEqual(summary.mountedRoutes[0].methods, ['GET']);
  assert.strictEqual(summary.mountedRoutes[0].requiresAuth, true);
  assert.strictEqual(summary.mountedRoutes[0].writeCapable, false);

  const server = await startAdminApiServer(router);
  try {
    const result = await fetchJson(server);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.ok, true);
    assert.strictEqual(result.body.adapterMetadataCount, 1);
    assert.strictEqual(result.body.executableAdapterCount, 0);
    assert.strictEqual(result.body.providerCallCount, 0);
    assert.strictEqual(result.body.imageGenerationCount, 0);
    assert.strictEqual(result.body.outputWriteCount, 0);
    assert.strictEqual(result.body.bridgeCallCount, 0);
    assert.strictEqual(result.body.localStateReadCount, 0);
    assert.strictEqual(countAbsolutePathValues(result.body), 0);
    assert.strictEqual(countForbiddenFieldNames(result.body), 0);

    const postResult = await fetchJson(server, { method: 'POST' });
    assert.strictEqual(postResult.response.status, 404);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic production-router mount requires admin-auth boundary marker', async () => {
  const router = express.Router();
  buildAndMountAiImageAdapterDiagnosticRoute(router, {
    projectRoot: PROJECT_ROOT,
    env: scopedEnv()
  });

  const server = await startAdminApiServer(router, { markAdminAuth: false });
  try {
    const result = await fetchJson(server);
    assert.strictEqual(result.response.status, 403);
    assert.strictEqual(result.body.status, 'ai_image_adapter_diagnostic_auth_required');
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic production-router mount blocks real execution env', async () => {
  const router = express.Router();
  buildAndMountAiImageAdapterDiagnosticRoute(router, {
    projectRoot: PROJECT_ROOT,
    env: scopedEnv({ ENABLE_AI_IMAGE_REAL_EXECUTION: 'true' })
  });

  const server = await startAdminApiServer(router);
  try {
    const result = await fetchJson(server);
    assert.strictEqual(result.response.status, 409);
    assert.strictEqual(result.body.status, 'ai_image_adapter_diagnostic_real_execution_not_allowed');
    assert.strictEqual(result.body.providerCallCount, 0);
    assert.strictEqual(result.body.imageGenerationCount, 0);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic production-router auth helper accepts only explicit admin markers', () => {
  assert.strictEqual(hasAdminAuthBoundary({}), false);
  assert.strictEqual(hasAdminAuthBoundary({ adminAuthBoundaryReached: true }), true);
  assert.strictEqual(hasAdminAuthBoundary({ adminAuthUser: 'admin' }), true);
  assert.strictEqual(hasAdminAuthBoundary({ adminAuthUser: '' }), false);
});
