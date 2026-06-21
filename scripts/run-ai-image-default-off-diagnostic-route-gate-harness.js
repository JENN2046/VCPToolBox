'use strict';

const express = require('express');
const http = require('http');
const path = require('path');

const {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV
} = require('../modules/aiImageAdapterRegistry');
const {
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH,
  createAiImageAdapterDiagnosticsRouter
} = require('../routes/admin/aiImageAdapterDiagnostics');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const AI_IMAGE_ADAPTERS_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');
const AUTH_HEADER = 'x-test-admin-auth';

function addCheck(checks, label, ok, detail = 'ok') {
  checks.push({ label, ok: Boolean(ok), detail });
}

function scopedEnv(extra = {}) {
  return {
    [ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV]: 'true',
    [VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
    [VCP_AI_IMAGE_ADAPTER_DIRS_ENV]: AI_IMAGE_ADAPTERS_ROOT,
    ...extra
  };
}

async function startServer(env) {
  const app = express();
  app.use(
    AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
    createAiImageAdapterDiagnosticsRouter({
      projectRoot: CORE_ROOT,
      env,
      authorizeRequest: (req) => req.headers[AUTH_HEADER] === 'ok'
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

async function main() {
  const checks = [];

  addCheck(
    checks,
    `${ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV} unset in real process env`,
    !process.env[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV],
    process.env[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV] ? 'set' : 'unset'
  );
  addCheck(
    checks,
    `${VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV} unset in real process env`,
    !process.env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV],
    process.env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV] ? 'set' : 'unset'
  );
  addCheck(
    checks,
    `${VCP_AI_IMAGE_ADAPTER_DIRS_ENV} unset in real process env`,
    !process.env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV],
    process.env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV] ? 'set' : 'unset'
  );
  addCheck(
    checks,
    'ENABLE_AI_IMAGE_REAL_EXECUTION is not true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION !== 'true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION || 'unset'
  );

  let defaultOffStatus = null;
  let unauthorizedStatus = null;
  let scopedStatus = null;
  let postStatus = null;
  let realExecutionBlockedStatus = null;
  let scopedBody = null;

  const defaultServer = await startServer({});
  try {
    const result = await fetchJson(defaultServer, { headers: { [AUTH_HEADER]: 'ok' } });
    defaultOffStatus = result.response.status;
    addCheck(checks, 'default-off route returns 404', defaultOffStatus === 404, defaultOffStatus);
    addCheck(checks, 'default-off route reports disabled', result.body?.status === 'ai_image_adapter_diagnostic_route_disabled', result.body);
  } finally {
    await defaultServer.close();
  }

  const scopedServer = await startServer(scopedEnv());
  try {
    const unauthorized = await fetchJson(scopedServer);
    unauthorizedStatus = unauthorized.response.status;
    addCheck(checks, 'scoped route rejects unauthenticated request', unauthorizedStatus === 403, unauthorizedStatus);

    const scoped = await fetchJson(scopedServer, { headers: { [AUTH_HEADER]: 'ok' } });
    scopedStatus = scoped.response.status;
    scopedBody = scoped.body;
    addCheck(checks, 'scoped route returns 200', scopedStatus === 200, scopedStatus);
    addCheck(checks, 'scoped route metadata count is one', scopedBody?.adapterMetadataCount === 1, scopedBody?.adapterMetadataCount);
    addCheck(checks, 'scoped route executable count is zero', scopedBody?.executableAdapterCount === 0, scopedBody?.executableAdapterCount);
    addCheck(checks, 'scoped provider call count is zero', scopedBody?.providerCallCount === 0, scopedBody?.providerCallCount);
    addCheck(checks, 'scoped image generation count is zero', scopedBody?.imageGenerationCount === 0, scopedBody?.imageGenerationCount);
    addCheck(checks, 'scoped output write count is zero', scopedBody?.outputWriteCount === 0, scopedBody?.outputWriteCount);
    addCheck(checks, 'scoped bridge call count is zero', scopedBody?.bridgeCallCount === 0, scopedBody?.bridgeCallCount);
    addCheck(checks, 'scoped LocalState read count is zero', scopedBody?.localStateReadCount === 0, scopedBody?.localStateReadCount);
    addCheck(checks, 'scoped diagnostics are clean', scopedBody?.diagnosticsSummary === 'none', scopedBody?.diagnosticsSummary);
    addCheck(checks, 'scoped response absolute path count is zero', countAbsolutePathValues(scopedBody) === 0, countAbsolutePathValues(scopedBody));
    addCheck(checks, 'scoped response forbidden field count is zero', countForbiddenFieldNames(scopedBody) === 0, countForbiddenFieldNames(scopedBody));

    const post = await fetchJson(scopedServer, {
      method: 'POST',
      headers: { [AUTH_HEADER]: 'ok' }
    });
    postStatus = post.response.status;
    addCheck(checks, 'scoped route rejects POST as not found', postStatus === 404, postStatus);
  } finally {
    await scopedServer.close();
  }

  const realExecutionServer = await startServer(scopedEnv({ ENABLE_AI_IMAGE_REAL_EXECUTION: 'true' }));
  try {
    const result = await fetchJson(realExecutionServer, { headers: { [AUTH_HEADER]: 'ok' } });
    realExecutionBlockedStatus = result.response.status;
    addCheck(checks, 'real execution env is blocked', realExecutionBlockedStatus === 409, realExecutionBlockedStatus);
  } finally {
    await realExecutionServer.close();
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_GATE_PASS=yes');
  console.log(`DEFAULT_OFF_ROUTE_STATUS=${defaultOffStatus}`);
  console.log(`UNAUTHORIZED_ROUTE_STATUS=${unauthorizedStatus}`);
  console.log(`SCOPED_ROUTE_STATUS=${scopedStatus}`);
  console.log(`SCOPED_POST_STATUS=${postStatus}`);
  console.log(`REAL_EXECUTION_BLOCKED_STATUS=${realExecutionBlockedStatus}`);
  console.log(`SCOPED_METADATA_ADAPTER_COUNT=${scopedBody.adapterMetadataCount}`);
  console.log(`SCOPED_EXECUTABLE_ADAPTER_COUNT=${scopedBody.executableAdapterCount}`);
  console.log(`SCOPED_PROVIDER_CALL_COUNT=${scopedBody.providerCallCount}`);
  console.log(`SCOPED_IMAGE_GENERATION_COUNT=${scopedBody.imageGenerationCount}`);
  console.log(`SCOPED_OUTPUT_WRITE_COUNT=${scopedBody.outputWriteCount}`);
  console.log(`SCOPED_BRIDGE_CALL_COUNT=${scopedBody.bridgeCallCount}`);
  console.log(`SCOPED_LOCALSTATE_READ_COUNT=${scopedBody.localStateReadCount}`);
  console.log(`RESPONSE_ABSOLUTE_PATH_COUNT=${countAbsolutePathValues(scopedBody)}`);
  console.log(`RESPONSE_SECRET_FIELD_COUNT=${countForbiddenFieldNames(scopedBody)}`);
  console.log('REAL_CONFIG_ENV_MODIFIED=no');
  console.log('PRODUCTION_SERVER_STARTED=no');
  console.log('PROVIDER_CALL_EXECUTED=no');
  console.log('REAL_IMAGE_GENERATED=no');
  console.log('IMAGE_OUTPUT_WRITTEN=no');
  console.log('BRIDGE_WRITE_EXECUTED=no');
  console.log('LOCALSTATE_PRIVATE_READ=no');
  console.log('UPSTREAM_PR_OPENED=no');
}

main().catch((error) => {
  console.error('AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_GATE_FAIL');
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
});
