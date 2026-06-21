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
  AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH,
  buildAiImageAdapterDiagnosticPayload,
  createAiImageAdapterDiagnosticsRouter
} = require('../routes/admin/aiImageAdapterDiagnostics');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');
const AUTH_HEADER = 'x-test-admin-auth';

function scopedEnv(extra = {}) {
  return {
    [ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]: 'true',
    [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT,
    ...extra
  };
}

async function startTestServer(options = {}) {
  const app = express();
  app.use(
    AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
    createAiImageAdapterDiagnosticsRouter({
      projectRoot: PROJECT_ROOT,
      authorizeRequest: (req) => req.headers[AUTH_HEADER] === 'ok',
      ...options
    })
  );

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

async function readJson(response) {
  return JSON.parse(await response.text());
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

test('AI Image diagnostic payload is default-off when route env is unset', () => {
  const payload = buildAiImageAdapterDiagnosticPayload({
    projectRoot: PROJECT_ROOT,
    env: {}
  });

  assert.strictEqual(payload.statusCode, 404);
  assert.strictEqual(payload.body.ok, false);
  assert.strictEqual(payload.body.routeEnabled, false);
  assert.strictEqual(payload.body.adapterMetadataCount, 0);
  assert.strictEqual(payload.body.executableAdapterCount, 0);
  assert.deepStrictEqual(payload.body.adapters, []);
});

test('AI Image diagnostic route is 404 when route env is unset', async () => {
  const server = await startTestServer({ env: {} });
  try {
    const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, {
      headers: { [AUTH_HEADER]: 'ok' }
    });
    const body = await readJson(response);

    assert.strictEqual(response.status, 404);
    assert.strictEqual(body.status, 'ai_image_adapter_diagnostic_route_disabled');
    assert.strictEqual(body.routeEnabled, false);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic route requires test-only auth when scoped route is enabled', async () => {
  const server = await startTestServer({ env: scopedEnv() });
  try {
    const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`);
    const body = await readJson(response);

    assert.strictEqual(response.status, 403);
    assert.strictEqual(body.status, 'ai_image_adapter_diagnostic_auth_required');
    assert.strictEqual(body.routeEnabled, true);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic route returns sanitized metadata under scoped env', async () => {
  const server = await startTestServer({ env: scopedEnv() });
  try {
    const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, {
      headers: { [AUTH_HEADER]: 'ok' }
    });
    const body = await readJson(response);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.status, 'ai_image_adapter_diagnostic_route_ready');
    assert.strictEqual(body.mode, 'default_off_metadata_diagnostics');
    assert.strictEqual(body.routeEnabled, true);
    assert.strictEqual(body.metadataRegistryEnabled, true);
    assert.strictEqual(body.adapterMetadataCount, 1);
    assert.strictEqual(body.executableAdapterCount, 0);
    assert.strictEqual(body.providerCallCount, 0);
    assert.strictEqual(body.imageGenerationCount, 0);
    assert.strictEqual(body.outputWriteCount, 0);
    assert.strictEqual(body.bridgeCallCount, 0);
    assert.strictEqual(body.localStateReadCount, 0);
    assert.strictEqual(body.realExecutionEnabled, false);
    assert.strictEqual(body.productionProviderRuntimeEnabled, false);
    assert.strictEqual(body.diagnosticsSummary, 'none');

    const adapter = body.adapters[0];
    assert.strictEqual(adapter.adapterId, 'jenn.ai-image.provider-adapter');
    assert.strictEqual(adapter.defaultEnabled, false);
    assert.strictEqual(adapter.metadataRegistered, true);
    assert.strictEqual(adapter.executable, false);
    assert.strictEqual(adapter.provider.providerSpecific, true);
    assert.strictEqual(adapter.provider.secretsRequired, true);
    assert.strictEqual(adapter.provider.runtimeProviderCallsAllowed, false);
    assert.strictEqual(adapter.permissions.providerCalls, false);
    assert.strictEqual(adapter.permissions.imageGeneration, false);
    assert.strictEqual(adapter.permissions.externalWrites, false);
    assert.strictEqual(adapter.permissions.bridgeCalls, false);
    assert.strictEqual(adapter.permissions.localStateReads, false);
    assert.strictEqual(adapter.entry.relativePath, 'src/index.js');
    assert.strictEqual(adapter.entry.exists, true);
    assert.strictEqual(adapter.entry.safeFile, true);
    assert.strictEqual(adapter.bindings[0].redacted, true);
    assert.strictEqual(adapter.bindings[0].relativePath, 'bindings/redacted-provider-binding.json');
    assert.strictEqual(adapter.fixtures.noProviderDryRunPlan.relativePath, 'fixtures/no-provider/dry-run-plan.json');
    assert.strictEqual(countAbsolutePathValues(body), 0);
    assert.strictEqual(countForbiddenFieldNames(body), 0);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic route rejects real execution env even in scoped harness', async () => {
  const server = await startTestServer({
    env: scopedEnv({ ENABLE_AI_IMAGE_REAL_EXECUTION: 'true' })
  });
  try {
    const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, {
      headers: { [AUTH_HEADER]: 'ok' }
    });
    const body = await readJson(response);

    assert.strictEqual(response.status, 409);
    assert.strictEqual(body.status, 'ai_image_adapter_diagnostic_real_execution_not_allowed');
    assert.strictEqual(body.adapterMetadataCount, 0);
    assert.strictEqual(body.executableAdapterCount, 0);
  } finally {
    await server.close();
  }
});

test('AI Image diagnostic route does not expose write methods', async () => {
  const server = await startTestServer({ env: scopedEnv() });
  try {
    const response = await fetch(`${server.baseUrl}${AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH}`, {
      method: 'POST',
      headers: { [AUTH_HEADER]: 'ok' }
    });

    assert.strictEqual(response.status, 404);
  } finally {
    await server.close();
  }
});
