'use strict';

const path = require('path');

const {
  ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH,
  AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH,
  createAiImageAdapterDiagnosticsRouter
} = require('../routes/admin/aiImageAdapterDiagnostics');

const AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH = (
  AI_IMAGE_ADAPTER_DIAGNOSTIC_MOUNT_PATH.replace(/^\/admin_api(?=\/|$)/, '') || '/'
);

function createDiagnostic(code, fields = {}) {
  return {
    level: fields.level || 'warn',
    code,
    ...fields
  };
}

function isExpressRouter(router) {
  return Boolean(router)
    && typeof router.use === 'function'
    && typeof router.handle === 'function';
}

function isRouteEnabled(env = {}) {
  return env[ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE_ENV] === 'true';
}

function isRealExecutionEnabled(env = {}) {
  return env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true';
}

function hasAdminAuthBoundary(req) {
  return Boolean(req)
    && (
      req.adminAuthBoundaryReached === true
      || (typeof req.adminAuthUser === 'string' && req.adminAuthUser.trim() !== '')
    );
}

function buildDisabledSummary(env = {}) {
  return {
    routeEnabled: isRouteEnabled(env),
    realExecutionEnabled: isRealExecutionEnabled(env),
    attemptedRouteCount: isRouteEnabled(env) ? 1 : 0,
    mountedRouteCount: 0,
    mountedRoutes: [],
    diagnostics: []
  };
}

function buildAndMountAiImageAdapterDiagnosticRoute(adminApiRouter, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const env = options.env || process.env;
  const summary = buildDisabledSummary(env);

  if (!isExpressRouter(adminApiRouter)) {
    summary.diagnostics.push(createDiagnostic('ai_image_adapter_diagnostic_router_invalid'));
    return summary;
  }

  if (!summary.routeEnabled) {
    summary.diagnostics.push(createDiagnostic('ai_image_adapter_diagnostic_route_disabled', {
      level: 'info'
    }));
    return summary;
  }

  try {
    adminApiRouter.use(
      AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH,
      createAiImageAdapterDiagnosticsRouter({
        projectRoot,
        env,
        authorizeRequest: options.authorizeRequest || hasAdminAuthBoundary
      })
    );
    summary.mountedRouteCount = 1;
    summary.mountedRoutes = [{
      routeId: 'ai-image-adapter-diagnostics',
      mountPath: AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH,
      fullPath: AI_IMAGE_ADAPTER_DIAGNOSTIC_FULL_PATH,
      methods: ['GET'],
      requiresAuth: true,
      writeCapable: false
    }];
    return summary;
  } catch (error) {
    summary.diagnostics.push(createDiagnostic('ai_image_adapter_diagnostic_route_mount_failed', {
      errorCode: error && error.code ? error.code : 'UNKNOWN'
    }));
    return summary;
  }
}

module.exports = {
  AI_IMAGE_ADAPTER_DIAGNOSTIC_ADMIN_API_MOUNT_PATH,
  buildAndMountAiImageAdapterDiagnosticRoute,
  hasAdminAuthBoundary
};
