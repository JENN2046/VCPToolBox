'use strict';

const assert = require('assert');
const path = require('path');
const test = require('node:test');

const {
  VCP_ADMIN_EXTENSION_ALLOWED_ROOTS_ENV,
  VCP_ADMIN_EXTENSION_DIRS_ENV,
  VCP_ADMIN_EXTENSION_ALLOWLIST_ENV,
  buildAdminExtensionPlan,
  summarizeDiagnosticsByCode
} = require('../modules/adminExtensionRegistry');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_EXTENSION_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions', 'JennAdminStatus');

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
