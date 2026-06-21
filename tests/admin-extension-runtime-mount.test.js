'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const path = require('path');
const test = require('node:test');

const {
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  buildAdminExtensionPlan
} = require('../modules/adminExtensionRegistry');
const {
  buildAndMountAdminExtensionRoutes,
  mountAdminExtensionRoutes
} = require('../modules/adminExtensionRuntimeMount');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_EXTENSION_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus');
const TARGET_ROUTE = '/admin_api/jenn-admin-status/status';

function scopedEnv() {
  return {
    [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
    [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
  };
}

async function startLocalServer(router) {
  const app = express();
  let authProbeHits = 0;
  app.use('/admin_api', (req, _res, next) => {
    authProbeHits += 1;
    req.adminAuthBoundaryReached = true;
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getAuthProbeHits: () => authProbeHits,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function fetchStatus(baseUrl, method = 'GET') {
  const response = await fetch(`${baseUrl}${TARGET_ROUTE}`, { method });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

test('Admin extension runtime mount is default-off with empty env', async () => {
  const router = express.Router();
  const summary = buildAndMountAdminExtensionRoutes(router, {
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {}
  });

  assert.strictEqual(summary.runtimeEnabled, false);
  assert.strictEqual(summary.attemptedRouteCount, 0);
  assert.strictEqual(summary.mountedRouteCount, 0);

  const server = await startLocalServer(router);
  try {
    const result = await fetchStatus(server.baseUrl);
    assert.strictEqual(result.status, 404);
  } finally {
    await server.close();
  }
});

test('Admin extension runtime mount attaches reviewed scoped read-only route', async () => {
  const router = express.Router();
  const summary = buildAndMountAdminExtensionRoutes(router, {
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: scopedEnv()
  });

  assert.strictEqual(summary.runtimeEnabled, true);
  assert.strictEqual(summary.attemptedRouteCount, 1);
  assert.strictEqual(summary.mountedRouteCount, 1);
  assert.strictEqual(summary.frontendRouteCountIgnored, 1);
  assert.strictEqual(summary.mountedRoutes[0].mountPath, '/jenn-admin-status');
  assert.deepStrictEqual(summary.mountedRoutes[0].methods, ['GET']);

  const server = await startLocalServer(router);
  try {
    const getResult = await fetchStatus(server.baseUrl);
    assert.strictEqual(getResult.status, 200);
    assert.strictEqual(getResult.body.ok, true);
    assert.strictEqual(getResult.body.extensionId, 'jenn.admin.status');
    assert.strictEqual(getResult.body.mode, 'read-only');
    assert.ok(server.getAuthProbeHits() > 0);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const writeResult = await fetchStatus(server.baseUrl, method);
      assert.strictEqual(writeResult.status, 404);
    }
  } finally {
    await server.close();
  }
});

test('Admin extension runtime mount rejects non-read-only route records', () => {
  const router = express.Router();
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: scopedEnv()
  });
  const unsafePlan = {
    ...plan,
    registeredRoutes: plan.registeredRoutes.map((route) => ({
      ...route,
      methods: ['GET', 'POST'],
      writeCapable: true
    }))
  };

  const summary = mountAdminExtensionRoutes(router, unsafePlan, {
    projectRoot: PROJECT_ROOT
  });

  assert.strictEqual(summary.runtimeEnabled, true);
  assert.strictEqual(summary.attemptedRouteCount, 1);
  assert.strictEqual(summary.mountedRouteCount, 0);
  assert.match(summary.diagnostics.map((item) => item.code).join(','), /admin_extension_runtime_route_not_mountable/);
});
