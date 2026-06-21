'use strict';

const fs = require('fs');
const path = require('path');

const {
  splitPathList,
  isSubPath,
  pathKey,
  toDisplayPath
} = require('./pluginRootResolver');

const VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV = 'VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS';
const VCP_AI_IMAGE_ADAPTER_DIRS_ENV = 'VCP_AI_IMAGE_ADAPTER_DIRS';

const AI_IMAGE_ADAPTER_MANIFEST_FILE = 'ai-image-adapter-manifest.json';

const BLOCKED_PATH_SEGMENTS = new Set([
  '.git',
  '.agent_board',
  'node_modules',
  'localstate',
  'state',
  'cache',
  'log',
  'logs',
  'debuglog',
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
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log|png|jpg|jpeg|gif|webp)$/i
]);

const REQUIRED_FALSE_PERMISSIONS = Object.freeze([
  'providerCalls',
  'imageGeneration',
  'externalWrites',
  'bridgeCalls',
  'localStateReads'
]);

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

function hasBlockedPathSegment(targetPath) {
  return String(targetPath || '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .some((segment) => BLOCKED_PATH_SEGMENTS.has(segment.toLowerCase()));
}

function isRelativeSafe(relativePath) {
  return Boolean(relativePath)
    && typeof relativePath === 'string'
    && relativePath.trim() === relativePath
    && !path.isAbsolute(relativePath)
    && !relativePath.split(/[\\/]+/).includes('..')
    && !hasBlockedPathSegment(relativePath)
    && !BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
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
    const stat = lstatFile(filePath);
    if (!stat.exists || !stat.safeFile) {
      addDiagnostic(diagnostics, 'ai_image_adapter_manifest_path_unsafe', {
        ...context,
        errorCode: stat.errorCode || null
      });
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addDiagnostic(diagnostics, error instanceof SyntaxError
      ? 'ai_image_adapter_manifest_json_invalid'
      : 'ai_image_adapter_manifest_read_error', {
      ...context,
      errorCode: error.code || null
    });
    return null;
  }
}

function getUnsafeAdapterRootReason(projectRoot, adapterRoot) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedRoot = path.resolve(adapterRoot);

  if (isSubPath(resolvedRoot, resolvedProjectRoot)) {
    return 'AI Image adapter root must not be inside project root';
  }

  if (hasBlockedPathSegment(resolvedRoot)) {
    return 'AI Image adapter root must not be inside blocked runtime/private paths';
  }

  return null;
}

function pathExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function lstatFile(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    return {
      exists: true,
      safeFile: stat.isFile() && !stat.isSymbolicLink()
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        exists: false,
        safeFile: false
      };
    }
    return {
      exists: true,
      safeFile: false,
      errorCode: error.code || null
    };
  }
}

function buildFileRecord(packageRoot, relativePath) {
  const absolutePath = path.join(packageRoot, relativePath);
  const stat = lstatFile(absolutePath);
  return {
    relativePath,
    absolutePath,
    exists: stat.exists,
    safeFile: stat.safeFile
  };
}

function validateManifestPath(packageRoot, relativePath, diagnostics, context) {
  if (!isRelativeSafe(relativePath)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_path_unsafe', {
      ...context,
      relativePath
    });
    return false;
  }

  const fullPath = path.join(packageRoot, relativePath);
  if (!isSubPath(fullPath, packageRoot)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_path_unsafe', {
      ...context,
      relativePath
    });
    return false;
  }

  const stat = lstatFile(fullPath);
  if (!stat.exists) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_path_missing', {
      ...context,
      relativePath
    });
    return false;
  }

  if (!stat.safeFile) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_path_unsafe', {
      ...context,
      relativePath,
      errorCode: stat.errorCode || null
    });
    return false;
  }

  return true;
}

function validateBinding(binding, packageRoot, diagnostics, context) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'bindings'
    });
    return null;
  }

  const bindingId = typeof binding.bindingId === 'string' ? binding.bindingId.trim() : '';
  const relativePath = binding.path;
  const ok = bindingId
    && binding.redacted === true
    && validateManifestPath(packageRoot, relativePath, diagnostics, {
      ...context,
      field: 'bindings.path'
    });

  if (!ok) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'bindings'
    });
    return null;
  }

  return {
    bindingId,
    redacted: true,
    ...buildFileRecord(packageRoot, relativePath)
  };
}

function validateFixtures(fixtures, packageRoot, diagnostics, context) {
  if (!fixtures || typeof fixtures !== 'object' || Array.isArray(fixtures)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'fixtures'
    });
    return null;
  }

  const records = {};
  let ok = true;
  for (const [name, relativePath] of Object.entries(fixtures)) {
    if (!validateManifestPath(packageRoot, relativePath, diagnostics, {
      ...context,
      field: `fixtures.${name}`
    })) {
      ok = false;
      continue;
    }
    records[name] = buildFileRecord(packageRoot, relativePath);
  }

  return ok ? records : null;
}

function validatePermissions(permissions, diagnostics, context) {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'permissions'
    });
    return null;
  }

  const result = {};
  for (const key of REQUIRED_FALSE_PERMISSIONS) {
    if (permissions[key] !== false) {
      addDiagnostic(diagnostics, 'ai_image_adapter_manifest_runtime_forbidden', {
        ...context,
        field: `permissions.${key}`
      });
      return null;
    }
    result[key] = false;
  }
  return result;
}

function buildMetadataAdapter(packageRoot, manifestPath, manifest, diagnostics, context) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'manifest'
    });
    return null;
  }

  const adapterId = typeof manifest.adapterId === 'string' ? manifest.adapterId.trim() : '';
  const displayName = typeof manifest.displayName === 'string' ? manifest.displayName.trim() : '';
  const provider = manifest.provider;
  const providerId = typeof provider?.providerId === 'string' ? provider.providerId.trim() : '';
  const capabilities = Array.isArray(manifest.capabilities)
    ? manifest.capabilities.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];

  if (manifest.schemaVersion !== 1) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'schemaVersion'
    });
    return null;
  }

  if (!adapterId || !displayName || !providerId || capabilities.length === 0) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'identity'
    });
    return null;
  }

  if (manifest.defaultEnabled !== false) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_runtime_forbidden', {
      ...context,
      field: 'defaultEnabled'
    });
    return null;
  }

  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'provider'
    });
    return null;
  }

  if (provider.providerSpecific !== true || provider.secretsRequired !== true || provider.runtimeProviderCallsAllowed !== false) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_runtime_forbidden', {
      ...context,
      field: 'provider'
    });
    return null;
  }

  if (!validateManifestPath(packageRoot, manifest.entry, diagnostics, {
    ...context,
    field: 'entry'
  })) {
    return null;
  }

  const bindings = Array.isArray(manifest.bindings)
    ? manifest.bindings.map((binding) => validateBinding(binding, packageRoot, diagnostics, context)).filter(Boolean)
    : null;
  if (!bindings || bindings.length !== manifest.bindings.length || bindings.length === 0) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_invalid', {
      ...context,
      field: 'bindings'
    });
    return null;
  }

  const fixtures = validateFixtures(manifest.fixtures, packageRoot, diagnostics, context);
  if (!fixtures) return null;

  const permissions = validatePermissions(manifest.permissions, diagnostics, context);
  if (!permissions) return null;

  return {
    adapterId,
    displayName,
    description: typeof manifest.description === 'string' ? manifest.description : '',
    packageRoot,
    packageDisplayPath: toDisplayPath(context.projectRoot, packageRoot, 'external'),
    manifestPath,
    manifestDisplayPath: toDisplayPath(context.projectRoot, manifestPath, 'external'),
    schemaVersion: 1,
    defaultEnabled: false,
    provider: {
      providerId,
      providerSpecific: true,
      secretsRequired: true,
      runtimeProviderCallsAllowed: false
    },
    capabilities,
    entry: buildFileRecord(packageRoot, manifest.entry),
    bindings,
    fixtures,
    permissions,
    metadataRegistered: true,
    executable: false,
    executionBlockedReason: 'no_provider_default_off'
  };
}

function discoverCandidatePackageRoots(adapterDir, diagnostics, context) {
  const manifestPath = path.join(adapterDir, AI_IMAGE_ADAPTER_MANIFEST_FILE);
  if (pathExists(manifestPath)) {
    return [adapterDir];
  }

  let entries;
  try {
    entries = fs.readdirSync(adapterDir, { withFileTypes: true });
  } catch (error) {
    addDiagnostic(diagnostics, 'ai_image_adapter_dir_read_error', {
      ...context,
      errorCode: error.code || null
    });
    return [];
  }

  const packageRoots = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packageRoot = path.join(adapterDir, entry.name);
    if (!isSubPath(packageRoot, adapterDir)) {
      addDiagnostic(diagnostics, 'ai_image_adapter_path_outside_root', {
        ...context,
        folder: entry.name
      });
      continue;
    }
    if (pathExists(path.join(packageRoot, AI_IMAGE_ADAPTER_MANIFEST_FILE))) {
      packageRoots.push(packageRoot);
    }
  }

  if (packageRoots.length === 0) {
    addDiagnostic(diagnostics, 'ai_image_adapter_manifest_missing', context);
  }

  return packageRoots;
}

function summarizeDiagnosticsByCode(diagnostics = []) {
  if (!diagnostics.length) return 'none';

  const counts = new Map();
  for (const diagnostic of diagnostics) {
    const code = diagnostic?.code || 'unknown';
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
}

function buildAiImageAdapterRegistryPlan(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || path.join(__dirname, '..'));
  const env = options.env || process.env;
  const diagnostics = [];
  const allowedRoots = resolvePathList(env[VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV], projectRoot);
  const adapterDirs = resolvePathList(env[VCP_AI_IMAGE_ADAPTER_DIRS_ENV], projectRoot);
  const metadataRegistryEnabled = allowedRoots.length > 0 && adapterDirs.length > 0;
  const discoveredAdapters = [];
  const metadataAdapters = [];
  const seenPackageRoots = new Set();

  if (allowedRoots.length === 0 && adapterDirs.length === 0) {
    addDiagnostic(diagnostics, 'ai_image_adapter_runtime_required_env_missing');
  } else if (adapterDirs.length === 0) {
    addDiagnostic(diagnostics, 'ai_image_adapter_runtime_required_env_missing', {
      missing: VCP_AI_IMAGE_ADAPTER_DIRS_ENV
    });
  }

  for (let index = 0; index < adapterDirs.length; index += 1) {
    const adapterDir = adapterDirs[index];
    const rootId = `external:${index + 1}`;
    const rootContext = {
      projectRoot,
      rootId,
      root: toDisplayPath(projectRoot, adapterDir, 'external')
    };

    const unsafeReason = getUnsafeAdapterRootReason(projectRoot, adapterDir);
    if (unsafeReason) {
      addDiagnostic(diagnostics, 'ai_image_adapter_root_unsafe', {
        ...rootContext,
        message: unsafeReason
      });
      continue;
    }

    if (allowedRoots.length === 0 || !allowedRoots.some((allowedRoot) => isSubPath(adapterDir, allowedRoot))) {
      addDiagnostic(diagnostics, 'ai_image_adapter_root_not_allowed', rootContext);
      continue;
    }

    for (const packageRoot of discoverCandidatePackageRoots(adapterDir, diagnostics, rootContext)) {
      const packageKey = pathKey(packageRoot);
      if (seenPackageRoots.has(packageKey)) continue;
      seenPackageRoots.add(packageKey);

      const packageContext = {
        ...rootContext,
        packageRoot: toDisplayPath(projectRoot, packageRoot, 'external')
      };

      const packageUnsafeReason = getUnsafeAdapterRootReason(projectRoot, packageRoot);
      if (packageUnsafeReason) {
        addDiagnostic(diagnostics, 'ai_image_adapter_root_unsafe', {
          ...packageContext,
          message: packageUnsafeReason
        });
        continue;
      }

      if (!allowedRoots.some((allowedRoot) => isSubPath(packageRoot, allowedRoot))) {
        addDiagnostic(diagnostics, 'ai_image_adapter_root_not_allowed', packageContext);
        continue;
      }

      const manifestPath = path.join(packageRoot, AI_IMAGE_ADAPTER_MANIFEST_FILE);
      const manifest = readJsonFile(manifestPath, diagnostics, packageContext);
      if (!manifest) continue;

      const metadataAdapter = buildMetadataAdapter(packageRoot, manifestPath, manifest, diagnostics, packageContext);
      if (!metadataAdapter) continue;

      discoveredAdapters.push(metadataAdapter);
      metadataAdapters.push(metadataAdapter);
    }
  }

  return {
    runtimeEnabled: metadataRegistryEnabled,
    metadataRegistryEnabled,
    allowedRootCount: allowedRoots.length,
    adapterDirCount: adapterDirs.length,
    discoveredAdapters,
    metadataAdapters,
    executableAdapters: [],
    providerCallCount: 0,
    imageGenerationCount: 0,
    outputWriteCount: 0,
    bridgeCallCount: 0,
    localStateReadCount: 0,
    diagnostics
  };
}

module.exports = {
  VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_ENV,
  VCP_AI_IMAGE_ADAPTER_DIRS_ENV,
  AI_IMAGE_ADAPTER_MANIFEST_FILE,
  buildAiImageAdapterRegistryPlan,
  summarizeDiagnosticsByCode,
  isRelativeSafe
};
