'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const {
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED_ENV,
  buildAdminExtensionMetadataRegistry,
  buildAdminExtensionPlan,
  summarizeDiagnosticsByCode
} = require('../modules/adminExtensionRegistry');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_EXTENSION_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus');
const PAGE_API_EXTENSION_ROOTS = [
  path.join(EXTERNAL_ROOT, 'AdminExtensions', 'AiImageAgents'),
  path.join(EXTERNAL_ROOT, 'AdminExtensions', 'ChannelHub'),
  path.join(EXTERNAL_ROOT, 'AdminExtensions', 'CodexImagegenRelay'),
  path.join(EXTERNAL_ROOT, 'AdminExtensions', 'CodexMemoryMonitor'),
  path.join(EXTERNAL_ROOT, 'AdminExtensions', 'OAuthAuthCenter')
];
const PAGE_API_EXTENSION_IDS = [
  'jenn.admin.ai-image-agents',
  'jenn.admin.channel-hub',
  'jenn.admin.codex-imagegen-relay',
  'jenn.admin.codex-memory-monitor',
  'jenn.admin.oauth-auth-center'
];

test('AdminPanel extension registry is default-off when env is unset', () => {
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {}
  });

  assert.strictEqual(plan.runtimeEnabled, false);
  assert.strictEqual(plan.allowedRootCount, 0);
  assert.strictEqual(plan.extensionDirCount, 0);
  assert.strictEqual(plan.allowlistCount, 0);
  assert.strictEqual(plan.discoveredExtensions.length, 0);
  assert.strictEqual(plan.registeredRoutes.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /admin_extension_runtime_required_env_missing:1/);
});

test('AdminPanel extension registry does not register dirs-only config', () => {
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT
    }
  });

  assert.strictEqual(plan.runtimeEnabled, false);
  assert.strictEqual(plan.allowedRootCount, 0);
  assert.strictEqual(plan.extensionDirCount, 1);
  assert.strictEqual(plan.registeredRoutes.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /admin_extension_root_not_allowed:1/);
});

test('AdminPanel extension registry discovers but does not register when allowlist misses extension', () => {
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.other.extension'
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.discoveredExtensions.length, 1);
  assert.strictEqual(plan.discoveredExtensions[0].extensionId, 'jenn.admin.status');
  assert.strictEqual(plan.discoveredExtensions[0].allowlisted, false);
  assert.strictEqual(plan.discoveredExtensions[0].registered, false);
  assert.strictEqual(plan.registeredRoutes.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /admin_extension_not_allowlisted:1/);
});

test('AdminPanel extension registry rejects extension roots inside the core project', () => {
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: PROJECT_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: path.join(PROJECT_ROOT, 'AdminPanel-Vue'),
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.discoveredExtensions.length, 0);
  assert.strictEqual(plan.registeredRoutes.length, 0);
  assert.match(summarizeDiagnosticsByCode(plan.diagnostics), /admin_extension_root_unsafe:1/);
});

test('AdminPanel extension registry plans reviewed read-only route with scoped env', () => {
  const plan = buildAdminExtensionPlan({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: ADMIN_EXTENSION_ROOT,
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: 'jenn.admin.status'
    }
  });

  assert.strictEqual(plan.runtimeEnabled, true);
  assert.strictEqual(plan.discoveredExtensions.length, 1);
  assert.strictEqual(plan.discoveredExtensions[0].registered, true);
  assert.strictEqual(plan.registeredRoutes.length, 1);
  assert.strictEqual(plan.registeredRoutes[0].extensionId, 'jenn.admin.status');
  assert.strictEqual(plan.registeredRoutes[0].routeId, 'jenn-admin-status');
  assert.strictEqual(plan.registeredRoutes[0].mountPath, '/jenn-admin-status');
  assert.deepStrictEqual(plan.registeredRoutes[0].methods, ['GET']);
  assert.strictEqual(plan.registeredRoutes[0].requiresAuth, true);
  assert.strictEqual(plan.registeredRoutes[0].writeCapable, false);
  assert.strictEqual(plan.frontendRoutes.length, 1);
  assert.strictEqual(summarizeDiagnosticsByCode(plan.diagnostics), 'none');
});

test('AdminPanel page/API metadata registry stays default-off without explicit flag', () => {
  const registry = buildAdminExtensionMetadataRegistry({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: PAGE_API_EXTENSION_ROOTS.join(path.delimiter),
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: PAGE_API_EXTENSION_IDS.join(',')
    }
  });

  assert.strictEqual(registry.metadataRegistryEnabled, false);
  assert.strictEqual(registry.runtimeEnabled, false);
  assert.strictEqual(registry.metadataPackages.length, 0);
  assert.strictEqual(registry.frontendMetadataRoutes.length, 0);
  assert.match(summarizeDiagnosticsByCode(registry.diagnostics), /admin_extension_metadata_registry_disabled:1/);
});

test('AdminPanel page/API metadata registry exposes reviewed labels without runtime loading', () => {
  const registry = buildAdminExtensionMetadataRegistry({
    projectRoot: PROJECT_ROOT,
    externalRoot: EXTERNAL_ROOT,
    env: {
      [VCP_ADMIN_EXTENSION_METADATA_REGISTRY_ENABLED_ENV]: '1',
      [VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV]: EXTERNAL_ROOT,
      [VCP_ADMIN_EXTENSION_DIRS_ENV]: PAGE_API_EXTENSION_ROOTS.join(path.delimiter),
      [VCP_ADMIN_EXTENSION_ALLOWLIST_ENV]: PAGE_API_EXTENSION_IDS.join(',')
    }
  });

  assert.strictEqual(registry.metadataRegistryEnabled, true);
  assert.strictEqual(registry.runtimeEnabled, false);
  assert.strictEqual(registry.metadataPackages.length, 5);
  assert.strictEqual(registry.frontendMetadataRoutes.length, 5);
  assert.deepStrictEqual(
    registry.frontendMetadataRoutes.map((route) => route.routeId).sort(),
    [
      'ai-image-agents',
      'channel-hub',
      'codex-imagegen-relay',
      'codex-memory-monitor',
      'oauth-auth-center'
    ]
  );

  for (const metadataPackage of registry.metadataPackages) {
    assert.strictEqual(metadataPackage.metadataRegistered, true);
    assert.strictEqual(metadataPackage.defaultEnabled, false);
    assert.strictEqual(metadataPackage.runtimeEnabled, false);
    assert.strictEqual(metadataPackage.dynamicVueImport, false);
    assert.strictEqual(metadataPackage.copyFirstContentIncluded, true);
    assert.strictEqual(metadataPackage.plannedFrontendRouteCount, 1);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(metadataPackage, 'displayPath'), false);
  }

  for (const route of registry.frontendMetadataRoutes) {
    assert.strictEqual(route.runtimeEnabled, false);
    assert.strictEqual(route.dynamicVueImport, false);
    assert.strictEqual(route.contentCopied, true);
    assert.strictEqual(route.requiresAuth, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(route, 'component'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(route, 'apiModule'), false);
  }

  const oauthPackage = registry.metadataPackages.find((item) => item.extensionId === 'jenn.admin.oauth-auth-center');
  assert.ok(oauthPackage.reviewCompleted.includes('auth-oauth-display-guard'));
  assert.ok(oauthPackage.reviewRequired.includes('runtime-action-guard-before-mount'));
  assert.strictEqual(JSON.stringify(registry.frontendMetadataRoutes).includes('frontend/views'), false);
  assert.strictEqual(JSON.stringify(registry.frontendMetadataRoutes).includes('frontend/api'), false);
  assert.strictEqual(summarizeDiagnosticsByCode(registry.diagnostics), 'none');
});
