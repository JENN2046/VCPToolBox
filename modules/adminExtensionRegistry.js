'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  splitPathList,
  isSubPath,
  pathKey,
  toDisplayPath
} = require('./pluginRootResolver');

const VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV = 'VCP_ADMIN_EXTENSION_ALLOWED_ROOTS';
const VCP_ADMIN_EXTENSION_DIRS_ENV = 'VCP_ADMIN_EXTENSION_DIRS';
const VCP_ADMIN_EXTENSION_ALLOWLIST_ENV = 'VCP_ADMIN_EXTENSION_ALLOWLIST';
const VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED_ENV = 'VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED';

const ADMIN_EXTENSION_MANIFEST_FILE = 'admin-extension-manifest.json';

const DEFAULT_BUILTIN_ADMIN_PREFIXES = Object.freeze([
  '/agent-assistant',
  '/agents',
  '/available-clusters',
  '/cache',
  '/codex-imagegen',
  '/config',
  '/dailyhot',
  '/dailynotes',
  '/dream-logs',
  '/dream-operation',
  '/dynamic-tools',
  '/emojis',
  '/final-context',
  '/logs',
  '/multimodal-cache',
  '/newapi-monitor',
  '/onering-config',
  '/placeholder',
  '/placeholders',
  '/plugin-store',
  '/plugins',
  '/preprocessors',
  '/rag-params',
  '/rag-tags',
  '/sarprompts',
  '/schedules',
  '/semantic-groups',
  '/semantic-router',
  '/server',
  '/server-log',
  '/system-monitor',
  '/task-assistant',
  '/thinking-chains',
  '/tool-approval-config',
  '/tool-list',
  '/toolbox',
  '/tvsvars',
  '/user-auth-code',
  '/vcptavern',
  '/verify-login',
  '/weather'
]);

const BLOCKED_PATH_SEGMENTS = new Set([
  '.git',
  '.agent_board',
  'node_modules',
  'LocalState',
  'state',
  'cache',
  'log',
  'logs',
  'DebugLog',
  'image',
  'output',
  'outputs',
  'secrets',
  'private'
]);

const BLOCKED_FILE_PATTERNS = Object.freeze([
  /(^|[\\/])(\.env|config\.env)(\.|[\\/]|$)/i,
  /secret/i,
  /token/i,
  /credential/i,
  /password/i,
  /auth/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
]);

const HARD_METADATA_REFERENCE_PATTERNS = Object.freeze([
  /(^|[\\/])(\.env|config\.env)(\.|[\\/]|$)/i,
  /secret/i,
  /token/i,
  /credential/i,
  /password/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
]);

function isTruthyFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function uniqueByResolvedPath(paths) {
  const seen = new Set();
  const result = [];
  for (const value of paths) {
    if (!value) continue;
    const resolved = path.resolve(value);
    const key = pathKey(resolved);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

function realpathOrResolveSync(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

function resolvePathList(rawValue, projectRoot) {
  return uniqueByResolvedPath(
    splitPathList(rawValue).map((item) => {
      const normalized = path.normalize(item);
      return path.isAbsolute(normalized)
        ? normalized
        : path.resolve(projectRoot, normalized);
    })
  ).map((targetPath) => realpathOrResolveSync(targetPath));
}

function parseAllowlist(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return new Set();

  const values = rawValue
    .split(/[;,\n\r]+/)
    .flatMap((item) => item.split(path.delimiter))
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(values);
}

function hasBlockedPathSegment(targetPath) {
  return path.resolve(targetPath)
    .split(/[\\/]+/)
    .some((segment) => BLOCKED_PATH_SEGMENTS.has(segment));
}

function isRelativeSafe(relativePath) {
  return Boolean(relativePath)
    && typeof relativePath === 'string'
    && !path.isAbsolute(relativePath)
    && !relativePath.split(/[\\/]+/).includes('..')
    && !hasBlockedPathSegment(relativePath)
    && !BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function isRelativeMetadataReferenceSafe(relativePath) {
  return Boolean(relativePath)
    && typeof relativePath === 'string'
    && !path.isAbsolute(relativePath)
    && !relativePath.split(/[\\/]+/).includes('..')
    && !hasBlockedPathSegment(relativePath)
    && !HARD_METADATA_REFERENCE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function normalizeMountPath(mountPath) {
  if (typeof mountPath !== 'string') return '';
  const trimmed = mountPath.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function isNamespacedMountPath(mountPath) {
  return /^\/jenn-admin-[a-z0-9-]+(?:\/|$)/.test(mountPath);
}

function sameOrNestedPath(left, right) {
  const normalizedLeft = normalizeMountPath(left);
  const normalizedRight = normalizeMountPath(right);
  return normalizedLeft === normalizedRight
    || normalizedLeft.startsWith(`${normalizedRight}/`)
    || normalizedRight.startsWith(`${normalizedLeft}/`);
}

function isBlockedByBuiltinPrefix(mountPath, builtinAdminPrefixes) {
  return builtinAdminPrefixes.some((prefix) => sameOrNestedPath(mountPath, prefix));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseChecksumManifest(checksumManifestPath) {
  const entries = new Map();
  if (!checksumManifestPath || !fs.existsSync(checksumManifestPath)) {
    return entries;
  }

  for (const line of fs.readFileSync(checksumManifestPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64})\s\s(.+)$/i);
    if (!match) continue;
    entries.set(match[2].replace(/\\/g, '/'), match[1].toLowerCase());
  }
  return entries;
}

function listFiles(rootPath) {
  const files = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        files.push({ path: fullPath, symbolicLink: true });
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push({ path: fullPath, symbolicLink: false });
      }
    }
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function addDiagnostic(diagnostics, code, fields = {}) {
  diagnostics.push({
    level: fields.level || 'warn',
    code,
    ...fields
  });
}

function readJsonFile(filePath, diagnostics, context) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addDiagnostic(diagnostics, error instanceof SyntaxError ? 'admin_extension_manifest_json_invalid' : 'admin_extension_manifest_read_error', {
      ...context,
      errorCode: error.code || null
    });
    return null;
  }
}

function getUnsafeExtensionRootReason(projectRoot, extensionRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedRoot = path.resolve(extensionRoot);

  if (isSubPath(resolvedRoot, resolvedProjectRoot)) {
    return 'admin extension root must not be inside project root';
  }

  if (hasBlockedPathSegment(resolvedRoot)) {
    return 'admin extension root must not be inside blocked runtime/private paths';
  }

  return null;
}

function validatePackageFiles(extensionRoot, externalRoot, checksumManifestPath, diagnostics, context) {
  const checksumEntries = parseChecksumManifest(checksumManifestPath);
  const files = listFiles(extensionRoot);
  let riskCount = 0;
  let symlinkCount = 0;
  let missingChecksumCount = 0;
  let mismatchedChecksumCount = 0;

  for (const file of files) {
    const relativeToExtension = path.relative(extensionRoot, file.path).replace(/\\/g, '/');
    const relativeToExternal = externalRoot
      ? path.relative(externalRoot, file.path).replace(/\\/g, '/')
      : relativeToExtension;

    if (file.symbolicLink) {
      symlinkCount += 1;
      continue;
    }
    if (!isRelativeSafe(relativeToExtension)) {
      riskCount += 1;
    }

    if (checksumEntries.size > 0) {
      const expectedHash = checksumEntries.get(relativeToExternal);
      if (!expectedHash) {
        missingChecksumCount += 1;
      } else if (sha256File(file.path) !== expectedHash) {
        mismatchedChecksumCount += 1;
      }
    }
  }

  if (riskCount > 0) addDiagnostic(diagnostics, 'admin_extension_package_path_risk_present', { ...context, count: riskCount });
  if (symlinkCount > 0) addDiagnostic(diagnostics, 'admin_extension_package_symlink_unsupported', { ...context, count: symlinkCount });
  if (checksumEntries.size === 0) addDiagnostic(diagnostics, 'admin_extension_checksum_manifest_missing', context);
  if (missingChecksumCount > 0) addDiagnostic(diagnostics, 'admin_extension_checksum_entry_missing', { ...context, count: missingChecksumCount });
  if (mismatchedChecksumCount > 0) addDiagnostic(diagnostics, 'admin_extension_checksum_mismatch', { ...context, count: mismatchedChecksumCount });

  return {
    fileCount: files.filter((file) => !file.symbolicLink).length,
    riskCount,
    symlinkCount,
    missingChecksumCount,
    mismatchedChecksumCount
  };
}

function validateManifest(manifest, extensionRoot, options) {
  const diagnostics = [];
  const routes = [];
  const frontendRoutes = [];
  const context = {
    extensionRoot: toDisplayPath(options.projectRoot, extensionRoot, 'external')
  };

  if (!manifest || typeof manifest !== 'object') {
    addDiagnostic(diagnostics, 'admin_extension_manifest_missing_or_invalid', context);
    return { diagnostics, routes, frontendRoutes };
  }

  const extensionId = typeof manifest.extensionId === 'string' ? manifest.extensionId.trim() : '';
  if (manifest.schemaVersion !== 1) addDiagnostic(diagnostics, 'admin_extension_schema_version_invalid', context);
  if (!extensionId) addDiagnostic(diagnostics, 'admin_extension_id_missing', context);
  if (manifest.defaultEnabled !== false) addDiagnostic(diagnostics, 'admin_extension_default_enabled_must_be_false', { ...context, extensionId });

  const permissions = manifest.permissions || {};
  if (permissions.externalWrites !== false) addDiagnostic(diagnostics, 'admin_extension_external_writes_not_false', { ...context, extensionId });
  if (permissions.providerCalls !== false) addDiagnostic(diagnostics, 'admin_extension_provider_calls_not_false', { ...context, extensionId });
  if (permissions.bridgeCalls !== false) addDiagnostic(diagnostics, 'admin_extension_bridge_calls_not_false', { ...context, extensionId });

  const backendRoutes = Array.isArray(manifest.backend?.routes) ? manifest.backend.routes : [];
  const routeIds = new Set();
  const mountPaths = new Set();
  for (const route of backendRoutes) {
    const routeId = typeof route.routeId === 'string' ? route.routeId.trim() : '';
    const mountPath = normalizeMountPath(route.mountPath);
    const modulePath = typeof route.module === 'string' ? route.module.trim() : '';
    const methods = Array.isArray(route.methods) ? route.methods.map((method) => String(method).toUpperCase()) : [];
    const routeContext = { ...context, extensionId, routeId: routeId || 'unknown', mountPath: mountPath || 'unknown' };

    if (!routeId) addDiagnostic(diagnostics, 'admin_extension_route_id_missing', routeContext);
    if (routeIds.has(routeId)) addDiagnostic(diagnostics, 'admin_extension_route_id_duplicate', routeContext);
    routeIds.add(routeId);

    if (!mountPath || mountPath === '/') addDiagnostic(diagnostics, 'admin_extension_mount_path_invalid', routeContext);
    if (!isNamespacedMountPath(mountPath)) addDiagnostic(diagnostics, 'admin_extension_mount_path_not_namespaced', routeContext);
    if (mountPaths.has(mountPath)) addDiagnostic(diagnostics, 'admin_extension_mount_path_duplicate', routeContext);
    mountPaths.add(mountPath);
    if (isBlockedByBuiltinPrefix(mountPath, options.builtinAdminPrefixes)) {
      addDiagnostic(diagnostics, 'admin_extension_mount_path_collides_builtin', routeContext);
    }

    if (methods.length === 0) addDiagnostic(diagnostics, 'admin_extension_methods_missing', routeContext);
    if (methods.some((method) => method !== 'GET')) addDiagnostic(diagnostics, 'admin_extension_write_method_blocked', { ...routeContext, methods: methods.join(',') });
    if (route.writeCapable !== false) addDiagnostic(diagnostics, 'admin_extension_write_capable_not_false', routeContext);
    if (route.requiresAuth !== true) addDiagnostic(diagnostics, 'admin_extension_requires_auth_not_true', routeContext);
    if (!isRelativeSafe(modulePath)) addDiagnostic(diagnostics, 'admin_extension_module_path_unsafe', routeContext);

    const absoluteModulePath = path.resolve(extensionRoot, modulePath);
    if (!isSubPath(absoluteModulePath, extensionRoot)) {
      addDiagnostic(diagnostics, 'admin_extension_module_path_escape', routeContext);
    } else if (!fs.existsSync(absoluteModulePath)) {
      addDiagnostic(diagnostics, 'admin_extension_module_missing', routeContext);
    } else {
      const stat = fs.lstatSync(absoluteModulePath);
      if (stat.isSymbolicLink()) {
        addDiagnostic(diagnostics, 'admin_extension_module_symlink_unsupported', routeContext);
      } else if (!stat.isFile()) {
        addDiagnostic(diagnostics, 'admin_extension_module_not_file', routeContext);
      }
    }

    routes.push({
      extensionId,
      routeId,
      mountPath,
      methods,
      module: modulePath,
      absoluteModulePath,
      requiresAuth: route.requiresAuth === true,
      writeCapable: route.writeCapable === true
    });
  }

  const manifestFrontendRoutes = Array.isArray(manifest.frontend?.routes) ? manifest.frontend.routes : [];
  const frontendRouteNames = new Set();
  const frontendPaths = new Set();
  for (const route of manifestFrontendRoutes) {
    const routeName = typeof route.routeName === 'string' ? route.routeName.trim() : '';
    const routePath = normalizeMountPath(route.path);
    const componentPath = typeof route.component === 'string' ? route.component.trim() : '';
    const routeContext = { ...context, extensionId, routeName: routeName || 'unknown', path: routePath || 'unknown' };

    if (!routeName) addDiagnostic(diagnostics, 'admin_extension_frontend_route_name_missing', routeContext);
    if (frontendRouteNames.has(routeName)) addDiagnostic(diagnostics, 'admin_extension_frontend_route_name_duplicate', routeContext);
    frontendRouteNames.add(routeName);

    if (!routePath) addDiagnostic(diagnostics, 'admin_extension_frontend_path_missing', routeContext);
    if (frontendPaths.has(routePath)) addDiagnostic(diagnostics, 'admin_extension_frontend_path_duplicate', routeContext);
    frontendPaths.add(routePath);
    if (!isRelativeSafe(componentPath)) addDiagnostic(diagnostics, 'admin_extension_frontend_component_path_unsafe', routeContext);

    frontendRoutes.push({
      extensionId,
      routeName,
      path: routePath,
      component: componentPath,
      showInSidebar: route.showInSidebar === true
    });
  }

  return { diagnostics, routes, frontendRoutes, extensionId };
}

function sanitizeMetadataString(value, maxLength = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeStringList(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeMetadataString(item, 80))
    .filter(Boolean)
    .slice(0, maxItems);
}

function validateMetadataManifest(manifest, extensionRoot, options) {
  const diagnostics = [];
  const plannedFrontendRoutes = [];
  const context = {
    extensionRoot: toDisplayPath(options.projectRoot, extensionRoot, 'external')
  };

  if (!manifest || typeof manifest !== 'object') {
    addDiagnostic(diagnostics, 'admin_extension_metadata_manifest_missing_or_invalid', context);
    return { diagnostics, plannedFrontendRoutes, extensionId: '' };
  }

  const extensionId = sanitizeMetadataString(manifest.extensionId, 120);
  if (manifest.schemaVersion !== 1) addDiagnostic(diagnostics, 'admin_extension_metadata_schema_version_invalid', context);
  if (!extensionId) addDiagnostic(diagnostics, 'admin_extension_metadata_id_missing', context);
  if (manifest.defaultEnabled !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_default_enabled_must_be_false', { ...context, extensionId });
  if (manifest.runtimeEnabled !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_runtime_enabled_must_be_false', { ...context, extensionId });
  if (manifest.dynamicVueImport !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_dynamic_vue_import_must_be_false', { ...context, extensionId });

  const permissions = manifest.permissions || {};
  if (!Array.isArray(permissions.adminApi) || permissions.adminApi.length !== 0) {
    addDiagnostic(diagnostics, 'admin_extension_metadata_admin_api_permissions_must_be_empty', { ...context, extensionId });
  }
  if (permissions.externalWrites !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_external_writes_not_false', { ...context, extensionId });
  if (permissions.providerCalls !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_provider_calls_not_false', { ...context, extensionId });
  if (permissions.bridgeCalls !== false) addDiagnostic(diagnostics, 'admin_extension_metadata_bridge_calls_not_false', { ...context, extensionId });

  const routes = Array.isArray(manifest.frontend?.plannedRoutes) ? manifest.frontend.plannedRoutes : [];
  const routeIds = new Set();
  for (const route of routes) {
    const routeId = sanitizeMetadataString(route?.routeId, 80);
    const routeName = sanitizeMetadataString(route?.routeName, 80);
    const title = sanitizeMetadataString(route?.title || routeName || routeId, 120);
    const navGroup = sanitizeMetadataString(route?.navGroup, 80);
    const componentRef = typeof route?.component === 'string' ? route.component.trim() : '';
    const apiModuleRef = typeof route?.apiModule === 'string' ? route.apiModule.trim() : '';
    const routeContext = { ...context, extensionId, routeId: routeId || 'unknown' };

    if (!routeId) addDiagnostic(diagnostics, 'admin_extension_metadata_route_id_missing', routeContext);
    if (routeIds.has(routeId)) addDiagnostic(diagnostics, 'admin_extension_metadata_route_id_duplicate', routeContext);
    routeIds.add(routeId);
    if (!routeName) addDiagnostic(diagnostics, 'admin_extension_metadata_route_name_missing', routeContext);
    if (!title) addDiagnostic(diagnostics, 'admin_extension_metadata_route_title_missing', routeContext);
    if (!navGroup) addDiagnostic(diagnostics, 'admin_extension_metadata_nav_group_missing', routeContext);
    if (route.requiresAuth !== true) addDiagnostic(diagnostics, 'admin_extension_metadata_requires_auth_not_true', routeContext);
    if (route.contentCopied !== true) addDiagnostic(diagnostics, 'admin_extension_metadata_content_copied_not_true', routeContext);
    if (componentRef && !isRelativeMetadataReferenceSafe(componentRef)) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_component_ref_unsafe', routeContext);
    }
    if (apiModuleRef && !isRelativeMetadataReferenceSafe(apiModuleRef)) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_api_module_ref_unsafe', routeContext);
    }

    plannedFrontendRoutes.push({
      extensionId,
      routeId,
      routeName,
      title,
      navGroup,
      showInSidebar: route.showInSidebar === true,
      requiresAuth: route.requiresAuth === true,
      contentCopied: route.contentCopied === true,
      componentRefPresent: Boolean(componentRef),
      apiModuleRefPresent: Boolean(apiModuleRef),
      runtimeEnabled: false,
      dynamicVueImport: false
    });
  }

  return { diagnostics, plannedFrontendRoutes, extensionId };
}

function buildAdminExtensionMetadataRegistry(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const env = options.env || process.env;
  const externalRoot = options.externalRoot ? path.resolve(options.externalRoot) : path.resolve(projectRoot, '..', 'VCPToolBox-JENN-Extensions');

  const metadataRegistryEnabled = options.metadataRegistryEnabled === true
    || isTruthyFlag(env[VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED_ENV]);
  const diagnostics = [];

  if (!metadataRegistryEnabled) {
    addDiagnostic(diagnostics, 'admin_extension_metadata_registry_disabled', { level: 'info' });
    return {
      metadataRegistryEnabled: false,
      runtimeEnabled: false,
      projectRoot,
      externalRoot,
      allowedRootCount: 0,
      extensionDirCount: 0,
      allowlistCount: 0,
      metadataPackages: [],
      frontendMetadataRoutes: [],
      diagnostics
    };
  }

  const requiredEnvPresent = Boolean(env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV])
    && Boolean(env[VCP_ADMIN_EXTENSION_DIRS_ENV])
    && Boolean(env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]);

  const allowedRoots = resolvePathList(env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV], projectRoot);
  const extensionDirs = resolvePathList(env[VCP_ADMIN_EXTENSION_DIRS_ENV], projectRoot);
  const allowlist = parseAllowlist(env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]);

  if (!requiredEnvPresent) {
    addDiagnostic(diagnostics, 'admin_extension_metadata_required_env_missing', { level: 'info' });
  }

  const metadataPackages = [];
  const frontendMetadataRoutes = [];

  for (const extensionDir of extensionDirs) {
    const context = {
      root: toDisplayPath(projectRoot, extensionDir, 'external')
    };
    const unsafeReason = getUnsafeExtensionRootReason(projectRoot, extensionDir);
    if (unsafeReason) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_root_unsafe', { ...context, message: unsafeReason });
      continue;
    }
    if (allowedRoots.length === 0 || !allowedRoots.some((root) => isSubPath(extensionDir, root))) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_root_not_allowed', context);
      continue;
    }

    const manifestPath = path.join(extensionDir, ADMIN_EXTENSION_MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_manifest_missing', context);
      continue;
    }
    if (fs.lstatSync(manifestPath).isSymbolicLink()) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_manifest_symlink_unsupported', context);
      continue;
    }

    const manifest = readJsonFile(manifestPath, diagnostics, context);
    const validation = validateMetadataManifest(manifest, extensionDir, { projectRoot });
    diagnostics.push(...validation.diagnostics);

    const extensionId = validation.extensionId || manifest?.extensionId || '';
    const allowlisted = allowlist.has(extensionId);
    if (!allowlisted) {
      addDiagnostic(diagnostics, 'admin_extension_metadata_not_allowlisted', { ...context, extensionId, level: 'info' });
    }

    const hasBlockingDiagnostics = diagnostics.some((diagnostic) => (
      diagnostic.level !== 'info'
      && diagnostic.extensionId === extensionId
      && (!diagnostic.root || diagnostic.root === context.root)
    ));
    const metadataRegistered = requiredEnvPresent && allowlisted && !hasBlockingDiagnostics;

    metadataPackages.push({
      extensionId,
      displayName: sanitizeMetadataString(manifest?.displayName || extensionId, 120),
      description: sanitizeMetadataString(manifest?.description || '', 240),
      sourcePackage: sanitizeMetadataString(manifest?.sourcePackage || '', 80),
      defaultEnabled: manifest?.defaultEnabled === true,
      runtimeEnabled: false,
      dynamicVueImport: false,
      copyFirstContentIncluded: manifest?.copyFirstContentIncluded === true,
      reviewRequired: sanitizeStringList(manifest?.reviewRequired),
      reviewCompleted: sanitizeStringList(manifest?.reviewCompleted),
      plannedFrontendRouteCount: validation.plannedFrontendRoutes.length,
      allowlisted,
      metadataRegistered
    });

    if (metadataRegistered) {
      frontendMetadataRoutes.push(...validation.plannedFrontendRoutes);
    }
  }

  return {
    metadataRegistryEnabled: true,
    runtimeEnabled: false,
    projectRoot,
    externalRoot,
    allowedRootCount: allowedRoots.length,
    extensionDirCount: extensionDirs.length,
    allowlistCount: allowlist.size,
    metadataPackages,
    frontendMetadataRoutes,
    diagnostics
  };
}

function buildAdminExtensionPlan(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const env = options.env || process.env;
  const externalRoot = options.externalRoot ? path.resolve(options.externalRoot) : path.resolve(projectRoot, '..', 'VCPToolBox-JENN-Extensions');
  const checksumManifestPath = options.checksumManifestPath || path.join(externalRoot, 'manifests', 'MANIFEST.sha256');
  const builtinAdminPrefixes = options.builtinAdminPrefixes || DEFAULT_BUILTIN_ADMIN_PREFIXES;

  const diagnostics = [];
  const requiredEnvPresent = Boolean(env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV])
    && Boolean(env[VCP_ADMIN_EXTENSION_DIRS_ENV])
    && Boolean(env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]);

  const allowedRoots = resolvePathList(env[VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV], projectRoot);
  const extensionDirs = resolvePathList(env[VCP_ADMIN_EXTENSION_DIRS_ENV], projectRoot);
  const allowlist = parseAllowlist(env[VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]);

  if (!requiredEnvPresent) {
    addDiagnostic(diagnostics, 'admin_extension_runtime_required_env_missing', {
      level: 'info'
    });
  }

  const discoveredExtensions = [];
  const registeredRoutes = [];
  const frontendRoutes = [];

  for (const extensionDir of extensionDirs) {
    const context = {
      root: toDisplayPath(projectRoot, extensionDir, 'external')
    };
    const unsafeReason = getUnsafeExtensionRootReason(projectRoot, extensionDir);
    if (unsafeReason) {
      addDiagnostic(diagnostics, 'admin_extension_root_unsafe', { ...context, message: unsafeReason });
      continue;
    }
    if (allowedRoots.length === 0 || !allowedRoots.some((root) => isSubPath(extensionDir, root))) {
      addDiagnostic(diagnostics, 'admin_extension_root_not_allowed', context);
      continue;
    }

    const manifestPath = path.join(extensionDir, ADMIN_EXTENSION_MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
      addDiagnostic(diagnostics, 'admin_extension_manifest_missing', context);
      continue;
    }
    if (fs.lstatSync(manifestPath).isSymbolicLink()) {
      addDiagnostic(diagnostics, 'admin_extension_manifest_symlink_unsupported', context);
      continue;
    }

    const manifest = readJsonFile(manifestPath, diagnostics, context);
    const validation = validateManifest(manifest, extensionDir, {
      projectRoot,
      builtinAdminPrefixes
    });
    diagnostics.push(...validation.diagnostics);

    const extensionId = validation.extensionId || manifest?.extensionId || '';
    const packageScan = validatePackageFiles(extensionDir, externalRoot, checksumManifestPath, diagnostics, {
      ...context,
      extensionId
    });
    const allowlisted = allowlist.has(extensionId);
    if (!allowlisted) {
      addDiagnostic(diagnostics, 'admin_extension_not_allowlisted', { ...context, extensionId, level: 'info' });
    }

    const hasBlockingDiagnostics = diagnostics.some((diagnostic) => (
      diagnostic.level !== 'info'
      && diagnostic.extensionId === extensionId
      && (!diagnostic.root || diagnostic.root === context.root)
    ));
    const registered = requiredEnvPresent && allowlisted && !hasBlockingDiagnostics;

    discoveredExtensions.push({
      extensionId,
      extensionRoot: extensionDir,
      manifestPath,
      displayPath: context.root,
      allowlisted,
      registered,
      routeCount: validation.routes.length,
      frontendRouteCount: validation.frontendRoutes.length,
      packageScan
    });

    if (registered) {
      registeredRoutes.push(...validation.routes.map((route) => ({
        ...route,
        extensionRoot: extensionDir,
        displayPath: `${context.root}:${route.mountPath}`
      })));
      frontendRoutes.push(...validation.frontendRoutes);
    }
  }

  return {
    runtimeEnabled: requiredEnvPresent,
    projectRoot,
    externalRoot,
    allowedRootCount: allowedRoots.length,
    extensionDirCount: extensionDirs.length,
    allowlistCount: allowlist.size,
    discoveredExtensions,
    registeredRoutes,
    frontendRoutes,
    diagnostics
  };
}

function summarizeDiagnosticsByCode(diagnostics) {
  const counts = new Map();
  for (const diagnostic of diagnostics || []) {
    const code = diagnostic?.code || 'unknown';
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}:${count}`)
    .join(',') || 'none';
}

module.exports = {
  ADMIN_EXTENSION_MANIFEST_FILE,
  DEFAULT_BUILTIN_ADMIN_PREFIXES,
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED_ENV,
  buildAdminExtensionMetadataRegistry,
  buildAdminExtensionPlan,
  parseAllowlist,
  summarizeDiagnosticsByCode
};
