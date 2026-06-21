const assert = require('node:assert/strict');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CORE_ROOT = path.resolve(__dirname, '..');
const ADMIN_ENV_NAME = 'VCP_ADMIN_EXTENSION_DIRS';
const M21_TASKBOOK = path.join(
  CORE_ROOT,
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M21_ADMINPANEL_EXTENSION_MANIFEST_TASKBOOK_20260621.md'
);
const TRACKER = path.join(
  CORE_ROOT,
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md'
);

const runtimeFilesToInspect = [
  'routes/adminPanelRoutes.js',
  'AdminPanel-Vue/src/app/routes/manifest.ts',
  'AdminPanel-Vue/src/components/layout/Sidebar.vue',
];

const riskPathPattern = /(^|[\\/])(\.env|config\.env|LocalState|state|cache|logs?|DebugLog|image|output|outputs|secrets|\.agent_board|private-memory|project-data|VectorStore|VCPLog)([\\/]|$)|secret|token|credential|auth|\.(sqlite|sqlite3|db|sqlite-shm|sqlite-wal|db-shm|db-wal|log)$/i;

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeForCompare(targetPath) {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertPathInside(root, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`absolute path is not allowed: ${relativePath}`);
  }
  const rootCompare = normalizeForCompare(root);
  const candidate = path.resolve(root, relativePath);
  const candidateCompare = normalizeForCompare(candidate);
  if (candidateCompare !== rootCompare && !candidateCompare.startsWith(rootCompare + path.sep)) {
    throw new Error(`path escapes root: ${relativePath}`);
  }
  return candidate;
}

function assertNoBlockedPrivateSegments(targetPath) {
  const blocked = new Set([
    '.agent_board',
    'LocalState',
    'state',
    'cache',
    'logs',
    'DebugLog',
    'image',
    'output',
    'outputs',
    'secrets',
    'private-memory',
    'project-data',
    'VectorStore',
    'VCPLog',
  ]);
  const segments = path.resolve(targetPath).split(/[\\/]+/);
  for (const segment of segments) {
    assert.equal(blocked.has(segment), false, `blocked private/runtime segment used in fixture path: ${segment}`);
  }
}

function writeFile(root, relativePath, content) {
  const filePath = assertPathInside(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function listFiles(root, current = root) {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, absolutePath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolutePath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

function riskMatches(pathsToCheck) {
  return pathsToCheck.filter((relativePath) => riskPathPattern.test(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(CORE_ROOT, relativePath), 'utf8');
}

function assertM21Pass() {
  const taskbook = fs.readFileSync(M21_TASKBOOK, 'utf8');
  const tracker = fs.readFileSync(TRACKER, 'utf8');
  assert.match(taskbook, /Status: TASKBOOK_READY_NO_ADMIN_RUNTIME_CHANGE/);
  assert.match(taskbook, /VCP_ADMIN_EXTENSION_DIRS/);
  assert.match(taskbook, /M22 Fixture \/ Shadow Validation Plan/);
  assert.match(tracker, /\| \[x\] \| M21 \| 0 \| AdminPanel extension manifest route planning \| PASS \|/);
  assert.match(
    tracker,
    /\| \[( |x)\] \| M22 \| 0 \| AdminPanel extension build \/ shadow validation \| (TODO|PASS) \|/
  );
}

function assertMountPath(value, fieldName) {
  assert.equal(typeof value, 'string', `${fieldName} must be a string`);
  assert.ok(value.startsWith('/jenn-example'), `${fieldName} must stay under reviewed /jenn-example namespace`);
  assert.equal(value.includes('..'), false, `${fieldName} must not contain path escapes`);
  assert.equal(value.includes('\\'), false, `${fieldName} must not contain backslashes`);
}

function assertRouteId(value, seen, fieldName) {
  assert.equal(typeof value, 'string', `${fieldName} must be a string`);
  assert.match(value, /^jenn-example-[a-z0-9-]+$/, `${fieldName} must use reviewed jenn-example prefix`);
  assert.equal(seen.has(value), false, `${fieldName} must be unique: ${value}`);
  seen.add(value);
}

function validateManifest(fixtureRoot) {
  const manifestPath = assertPathInside(fixtureRoot, 'admin-extension-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.extensionId, 'jenn.example.admin-extension.fixture');
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(manifest.permissions.externalWrites, false);
  assert.equal(manifest.permissions.providerCalls, false);
  assert.equal(manifest.permissions.bridgeCalls, false);
  assert.ok(Array.isArray(manifest.permissions.adminApi));

  const routeIds = new Set();
  assert.ok(Array.isArray(manifest.backend.routes));
  assert.equal(manifest.backend.routes.length, 1);
  for (const route of manifest.backend.routes) {
    assertRouteId(route.routeId, routeIds, 'backend.routeId');
    assertMountPath(route.mountPath, 'backend.mountPath');
    assert.ok(Array.isArray(route.methods), 'backend.methods must be an array');
    assert.deepEqual(route.methods, ['GET']);
    assert.equal(route.requiresAuth, true);
    assert.equal(route.writeCapable, false);
    const modulePath = assertPathInside(fixtureRoot, route.module);
    assert.equal(fs.existsSync(modulePath), true, `backend module must exist: ${route.module}`);
  }

  assert.ok(Array.isArray(manifest.frontend.routes));
  assert.equal(manifest.frontend.routes.length, 1);
  for (const route of manifest.frontend.routes) {
    assertRouteId(route.routeId, routeIds, 'frontend.routeId');
    assertMountPath(route.path, 'frontend.path');
    assert.equal(route.requiresAuth, true);
    assert.equal(typeof route.showInSidebar, 'boolean');
    const componentPath = assertPathInside(fixtureRoot, route.component);
    assert.equal(fs.existsSync(componentPath), true, `frontend component must exist: ${route.component}`);
  }

  return manifest;
}

function assertAdminPanelNotRegistered() {
  const hits = [];
  for (const relativePath of runtimeFilesToInspect) {
    const source = readText(relativePath);
    for (const token of [ADMIN_ENV_NAME, 'jenn.example.admin-extension.fixture', 'jenn-example-status']) {
      if (source.includes(token)) {
        hits.push(`${relativePath}:${token}`);
      }
    }
  }
  assert.deepEqual(hits, [], `AdminPanel runtime registration references must stay absent: ${hits.join(',')}`);
}

function assertAdminPanelBuildScriptPresentButNotRun() {
  const packageJson = JSON.parse(readText('AdminPanel-Vue/package.json'));
  assert.equal(typeof packageJson.scripts.build, 'string', 'AdminPanel-Vue build script must exist');
}

function createFixture(fixtureRoot) {
  const manifest = {
    schemaVersion: 1,
    extensionId: 'jenn.example.admin-extension.fixture',
    displayName: 'Jenn Example Admin Extension Fixture',
    description: 'Reviewed AdminPanel extension fixture for M22 shadow validation.',
    defaultEnabled: false,
    backend: {
      routes: [
        {
          routeId: 'jenn-example-status',
          mountPath: '/jenn-example/status',
          module: 'backend/routes/status.js',
          methods: ['GET'],
          requiresAuth: true,
          writeCapable: false,
        },
      ],
    },
    frontend: {
      routes: [
        {
          routeId: 'jenn-example-view',
          routeName: 'JennExampleView',
          path: '/jenn-example',
          title: 'Jenn Example',
          icon: 'extension',
          navGroup: 'toolsPlugins',
          component: 'frontend/views/JennExampleView.vue',
          showInSidebar: true,
          requiresAuth: true,
        },
      ],
    },
    permissions: {
      adminApi: ['read:jenn-example-status'],
      externalWrites: false,
      providerCalls: false,
      bridgeCalls: false,
    },
  };

  writeFile(fixtureRoot, 'README.AGENTS_OS.md', '# Jenn Example Admin Extension Fixture\n\nM22 fixture-only package. Not a runtime registration.\n');
  writeFile(fixtureRoot, 'admin-extension-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(
    fixtureRoot,
    'backend/routes/status.js',
    [
      "'use strict';",
      '',
      "const express = require('express');",
      '',
      'const router = express.Router();',
      '',
      "router.get('/status', (req, res) => {",
      "  res.json({ ok: true, source: 'm22-admin-extension-fixture' });",
      '});',
      '',
      'module.exports = router;',
      '',
    ].join('\n')
  );
  writeFile(
    fixtureRoot,
    'frontend/views/JennExampleView.vue',
    [
      '<template>',
      '  <section data-admin-extension-fixture="jenn-example">',
      '    <h1>Jenn Example</h1>',
      '  </section>',
      '</template>',
      '',
      '<script setup lang="ts">',
      "const statusLabel = 'Fixture only';",
      '</script>',
      '',
    ].join('\n')
  );
}

function main() {
  assertM21Pass();
  assert.equal(process.env[ADMIN_ENV_NAME], undefined, `${ADMIN_ENV_NAME} must be unset for M22 shadow validation`);
  assertAdminPanelNotRegistered();
  assertAdminPanelBuildScriptPresentButNotRun();

  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-admin-m22-'));
  const externalRoot = path.join(tempBase, 'VCPToolBox-JENN-Extensions');
  const fixtureRoot = path.join(externalRoot, 'AdminExtensions', 'JennExampleAdminExtension');

  try {
    assertNoBlockedPrivateSegments(tempBase);
    assertNoBlockedPrivateSegments(externalRoot);
    fs.mkdirSync(fixtureRoot, { recursive: true });
    createFixture(fixtureRoot);

    const fixturePaths = listFiles(fixtureRoot);
    const riskPaths = riskMatches(fixturePaths);
    assert.deepEqual(riskPaths, [], `fixture risk paths detected: ${riskPaths.join(',')}`);

    const manifest = validateManifest(fixtureRoot);
    const backendRoute = path.join(fixtureRoot, manifest.backend.routes[0].module);
    execFileSync(process.execPath, ['--check', backendRoute], { encoding: 'utf8' });

    const frontendComponent = fs.readFileSync(path.join(fixtureRoot, manifest.frontend.routes[0].component), 'utf8');
    assert.match(frontendComponent, /<template>/);
    assert.match(frontendComponent, /<script setup lang="ts">/);

    const checksums = fixturePaths.map((relativePath) => `${sha256File(path.join(fixtureRoot, relativePath))}  ${relativePath}`);
    const checksumManifestHash = sha256Text(`${checksums.join('\n')}\n`);

    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixtureRoot), false, 'rollback must remove temp fixture root');

    console.log('ADMIN_EXTENSION_MANIFEST_SHADOW_VALIDATION_PASS');
    console.log(`TEMP_EXTERNAL_ROOT=${externalRoot}`);
    console.log(`FIXTURE_ROOT=${fixtureRoot}`);
    console.log('M21_STATUS=PASS');
    console.log(`ENV_${ADMIN_ENV_NAME}_SET=no`);
    console.log('MANIFEST_SCHEMA_PASS=yes');
    console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
    console.log(`MANIFEST_BACKEND_ROUTE_COUNT=${manifest.backend.routes.length}`);
    console.log(`MANIFEST_FRONTEND_ROUTE_COUNT=${manifest.frontend.routes.length}`);
    console.log(`FIXTURE_PATH_COUNT=${fixturePaths.length}`);
    console.log(`FIXTURE_RISK_PATH_COUNT=${riskPaths.length}`);
    console.log(`FIXTURE_CHECKSUM_ENTRY_COUNT=${checksums.length}`);
    console.log(`FIXTURE_CHECKSUM_MANIFEST_SHA256=${checksumManifestHash}`);
    console.log('BACKEND_NODE_CHECK_PASS=yes');
    console.log('FRONTEND_STATIC_CHECK_PASS=yes');
    console.log('ADMINPANEL_BUILD_SCRIPT_PRESENT=yes');
    console.log('ADMINPANEL_BUILD_RUN=no');
    console.log('RUNTIME_ADMIN_REGISTRATION_REFERENCE_COUNT=0');
    console.log('ROLLBACK_TEMP_FIXTURE_REMOVED=yes');
    console.log('NO_ADMINPANEL_RUNTIME_FILES_MODIFIED=yes');
    console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
    console.log('NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes');
    console.log('PRODUCTION_DEPLOY_OR_SERVICE_STARTUP_EXECUTED=no');
    console.log('LIVE_EXTERNAL_WRITE_EXECUTED=no');
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`ADMIN_EXTENSION_MANIFEST_SHADOW_VALIDATION_FAIL: ${error.message}`);
  process.exitCode = 1;
}
