'use strict';

const express = require('express');
const path = require('path');

const {
  buildAiImageAdapterRegistryPlan,
  summarizeDiagnosticsByCode
} = require('../../modules/aiImageAdapterRegistry');

const ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV = 'ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE';
const AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH = '/admin_api/ai-image-adapter-registry';
const AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_PATH = '/diagnostics';
const AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH = `${AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH}${AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_PATH}`;

function isRouteEnabled(env = {}) {
  return env[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV] === 'true';
}

function isRealExecutionEnabled(env = {}) {
  return env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true';
}

function sanitizeFileRecord(record = {}) {
  return {
    relativePath: record.relativePath || null,
    exists: record.exists === true,
    safeFile: record.safeFile === true
  };
}

function sanitizeFixtures(fixtures = {}) {
  const result = {};
  for (const [name, record] of Object.entries(fixtures)) {
    result[name] = sanitizeFileRecord(record);
  }
  return result;
}

function sanitizeAdapter(adapter = {}) {
  return {
    adapterId: adapter.adapterId || null,
    displayName: adapter.displayName || null,
    description: adapter.description || '',
    schemaVersion: adapter.schemaVersion || null,
    defaultEnabled: adapter.defaultEnabled === true,
    metadataRegistered: adapter.metadataRegistered === true,
    executable: adapter.executable === true,
    executionBlockedReason: adapter.executionBlockedReason || null,
    provider: {
      providerId: adapter.provider?.providerId || null,
      providerSpecific: adapter.provider?.providerSpecific === true,
      secretsRequired: adapter.provider?.secretsRequired === true,
      runtimeProviderCallsAllowed: adapter.provider?.runtimeProviderCallsAllowed === true
    },
    capabilities: Array.isArray(adapter.capabilities) ? [...adapter.capabilities] : [],
    permissions: {
      providerCalls: adapter.permissions?.providerCalls === true,
      imageGeneration: adapter.permissions?.imageGeneration === true,
      externalWrites: adapter.permissions?.externalWrites === true,
      bridgeCalls: adapter.permissions?.bridgeCalls === true,
      localStateReads: adapter.permissions?.localStateReads === true
    },
    entry: sanitizeFileRecord(adapter.entry),
    bindings: Array.isArray(adapter.bindings)
      ? adapter.bindings.map((binding) => ({
        bindingId: binding.bindingId || null,
        redacted: binding.redacted === true,
        relativePath: binding.relativePath || null,
        exists: binding.exists === true,
        safeFile: binding.safeFile === true
      }))
      : [],
    fixtures: sanitizeFixtures(adapter.fixtures)
  };
}

function buildDisabledPayload(env = {}) {
  return {
    ok: false,
    status: 'ai_image_adapter_diagnostic_route_disabled',
    mode: 'default_off_metadata_diagnostics',
    routeEnabled: false,
    metadataRegistryEnabled: false,
    allowedRootCount: 0,
    adapterDirCount: 0,
    adapterMetadataCount: 0,
    executableAdapterCount: 0,
    providerCallCount: 0,
    imageGenerationCount: 0,
    outputWriteCount: 0,
    bridgeCallCount: 0,
    localStateReadCount: 0,
    diagnosticsSummary: 'route_disabled',
    realExecutionEnabled: isRealExecutionEnabled(env),
    productionProviderRuntimeEnabled: false,
    adapters: []
  };
}

function buildBlockedRealExecutionPayload(env = {}) {
  return {
    ...buildDisabledPayload(env),
    status: 'ai_image_adapter_diagnostic_real_execution_not_allowed',
    routeEnabled: true,
    diagnosticsSummary: 'real_execution_enabled'
  };
}

function buildAiImageAdapterDiagnosticPayload(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..', '..'));
  const env = options.env || {};

  if (!isRouteEnabled(env)) {
    return {
      statusCode: 404,
      body: buildDisabledPayload(env)
    };
  }

  if (isRealExecutionEnabled(env)) {
    return {
      statusCode: 409,
      body: buildBlockedRealExecutionPayload(env)
    };
  }

  const plan = buildAiImageAdapterRegistryPlan({ projectRoot, env });
  return {
    statusCode: 200,
    body: {
      ok: true,
      status: 'ai_image_adapter_diagnostic_route_ready',
      mode: 'default_off_metadata_diagnostics',
      routeEnabled: true,
      metadataRegistryEnabled: plan.metadataRegistryEnabled === true,
      allowedRootCount: plan.allowedRootCount,
      adapterDirCount: plan.adapterDirCount,
      adapterMetadataCount: plan.metadataAdapters.length,
      executableAdapterCount: plan.executableAdapters.length,
      providerCallCount: plan.providerCallCount,
      imageGenerationCount: plan.imageGenerationCount,
      outputWriteCount: plan.outputWriteCount,
      bridgeCallCount: plan.bridgeCallCount,
      localStateReadCount: plan.localStateReadCount,
      diagnosticsSummary: summarizeDiagnosticsByCode(plan.diagnostics),
      realExecutionEnabled: false,
      productionProviderRuntimeEnabled: false,
      adapters: plan.metadataAdapters.map((adapter) => sanitizeAdapter(adapter))
    }
  };
}

async function isAuthorized(req, authorizeRequest) {
  if (typeof authorizeRequest !== 'function') {
    return false;
  }

  try {
    return await authorizeRequest(req) === true;
  } catch {
    return false;
  }
}

function createAiImageAdapterDiagnosticsRouter(options = {}) {
  const router = express.Router();
  const env = options.env || {};

  router.get(AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_PATH, async (req, res) => {
    if (!isRouteEnabled(env)) {
      const payload = buildAiImageAdapterDiagnosticPayload(options);
      return res.status(payload.statusCode).json(payload.body);
    }

    if (!await isAuthorized(req, options.authorizeRequest)) {
      return res.status(403).json({
        ok: false,
        status: 'ai_image_adapter_diagnostic_auth_required',
        mode: 'default_off_metadata_diagnostics',
        routeEnabled: true
      });
    }

    const payload = buildAiImageAdapterDiagnosticPayload(options);
    return res.status(payload.statusCode).json(payload.body);
  });

  return router;
}

module.exports = {
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH,
  buildAiImageAdapterDiagnosticPayload,
  createAiImageAdapterDiagnosticsRouter
};
