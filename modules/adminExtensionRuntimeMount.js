'use strict';

const Module = require('module');
const path = require('path');

const {
  buildAdminExtensionPlan
} = require('./adminExtensionRegistry');

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

function normalizeCoreModulePaths(projectRoot) {
  const root = path.resolve(projectRoot || path.join(__dirname, '..'));
  return {
    root,
    nodeModules: path.join(root, 'node_modules')
  };
}

function loadAdminExtensionRouteModule(route, options = {}) {
  const { root, nodeModules } = normalizeCoreModulePaths(options.projectRoot);
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function resolveWithCoreDependencies(request, parent, isMain, resolveOptions) {
    try {
      return originalResolveFilename.call(this, request, parent, isMain, resolveOptions);
    } catch (error) {
      const isBareModule = typeof request === 'string'
        && !request.startsWith('.')
        && !path.isAbsolute(request);
      if (!isBareModule || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
      return require.resolve(request, { paths: [root, nodeModules] });
    }
  };

  try {
    delete require.cache[require.resolve(route.absoluteModulePath)];
    const exported = require(route.absoluteModulePath);
    if (typeof exported === 'function' && typeof exported.use === 'function' && typeof exported.handle === 'function') {
      return exported;
    }
    if (typeof exported === 'function') {
      return exported({
        extensionId: route.extensionId,
        routeId: route.routeId,
        mode: 'read-only'
      });
    }
    return exported;
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }
}

function routeIsMountable(route) {
  return Boolean(route)
    && typeof route.mountPath === 'string'
    && route.mountPath.startsWith('/jenn-admin-')
    && route.requiresAuth === true
    && route.writeCapable === false
    && Array.isArray(route.methods)
    && route.methods.length > 0
    && route.methods.every((method) => method === 'GET')
    && typeof route.absoluteModulePath === 'string';
}

function mountAdminExtensionRoutes(adminApiRouter, plan, options = {}) {
  const diagnostics = [...(plan?.diagnostics || [])];
  const mountedRoutes = [];

  if (!isExpressRouter(adminApiRouter)) {
    diagnostics.push(createDiagnostic('admin_extension_runtime_router_invalid'));
    return {
      runtimeEnabled: Boolean(plan?.runtimeEnabled),
      attemptedRouteCount: plan?.registeredRoutes?.length || 0,
      mountedRouteCount: 0,
      mountedRoutes,
      frontendRouteCountIgnored: plan?.frontendRoutes?.length || 0,
      diagnostics
    };
  }

  for (const route of plan?.registeredRoutes || []) {
    if (!routeIsMountable(route)) {
      diagnostics.push(createDiagnostic('admin_extension_runtime_route_not_mountable', {
        extensionId: route?.extensionId || 'unknown',
        routeId: route?.routeId || 'unknown',
        mountPath: route?.mountPath || 'unknown'
      }));
      continue;
    }

    try {
      const routeModule = loadAdminExtensionRouteModule(route, options);
      if (!isExpressRouter(routeModule)) {
        diagnostics.push(createDiagnostic('admin_extension_runtime_route_module_invalid', {
          extensionId: route.extensionId,
          routeId: route.routeId,
          mountPath: route.mountPath
        }));
        continue;
      }

      adminApiRouter.use(route.mountPath, routeModule);
      mountedRoutes.push({
        extensionId: route.extensionId,
        routeId: route.routeId,
        mountPath: route.mountPath,
        methods: route.methods.slice(),
        requiresAuth: route.requiresAuth,
        writeCapable: route.writeCapable
      });
    } catch (error) {
      diagnostics.push(createDiagnostic('admin_extension_runtime_route_mount_failed', {
        extensionId: route.extensionId,
        routeId: route.routeId,
        mountPath: route.mountPath,
        errorCode: error.code || 'UNKNOWN'
      }));
    }
  }

  return {
    runtimeEnabled: Boolean(plan?.runtimeEnabled),
    attemptedRouteCount: plan?.registeredRoutes?.length || 0,
    mountedRouteCount: mountedRoutes.length,
    mountedRoutes,
    frontendRouteCountIgnored: plan?.frontendRoutes?.length || 0,
    diagnostics
  };
}

function buildAndMountAdminExtensionRoutes(adminApiRouter, options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const plan = buildAdminExtensionPlan({
    projectRoot,
    externalRoot: options.externalRoot,
    env: options.env,
    checksumManifestPath: options.checksumManifestPath,
    builtinAdminPrefixes: options.builtinAdminPrefixes
  });

  const summary = mountAdminExtensionRoutes(adminApiRouter, plan, {
    projectRoot
  });

  return {
    ...summary,
    plan
  };
}

module.exports = {
  buildAndMountAdminExtensionRoutes,
  loadAdminExtensionRouteModule,
  mountAdminExtensionRoutes
};
