'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADMIN_ROOT = path.join(EXTERNAL_ROOT, 'AdminExtensions');
const PACKAGE_ROOT = path.join(ADMIN_ROOT, 'JennAdminStatus');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'admin-extension-manifest.json');
const CHECKSUM_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifests', 'MANIFEST.sha256');

const EXPECTED_EXTENSION_ID = 'jenn.admin.status';
const EXPECTED_PACKAGE_FILES = [
  'AdminExtensions/README.AGENTS_OS.md',
  'AdminExtensions/JennAdminStatus/README.AGENTS_OS.md',
  'AdminExtensions/JennAdminStatus/admin-extension-manifest.json',
  'AdminExtensions/JennAdminStatus/backend/routes/status.js',
  'AdminExtensions/JennAdminStatus/frontend/views/JennAdminStatusView.vue'
];

const CORE_RUNTIME_FILES = [
  'routes/adminPanelRoutes.js',
  'AdminPanel-Vue/src/app/routes/manifest.ts',
  'AdminPanel-Vue/src/components/layout/Sidebar.vue'
];

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.agent_board(\/|$)/i,
  /(^|\/)localstate(\/|$)/i,
  /(^|\/)(cache|logs?|state|tmp|output|outputs|secrets)(\/|$)/i,
  /(^|\/)(\.env|config\.env)(\.|$)/i,
  /(secret|token|credential|password|auth)/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
];

function sortRelativePaths(paths) {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listFiles(rootPath) {
  const files = [];
  const stack = [rootPath];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((a, b) => toPosix(path.relative(EXTERNAL_ROOT, a)).localeCompare(toPosix(path.relative(EXTERNAL_ROOT, b))));
}

function parseChecksumManifest() {
  const entries = new Map();
  for (const line of readText(CHECKSUM_MANIFEST_PATH).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64})\s\s(.+)$/i);
    if (!match) {
      throw new Error(`invalid checksum manifest line: ${line}`);
    }
    entries.set(match[2].replace(/\\/g, '/'), match[1].toLowerCase());
  }
  return entries;
}

function isRelativeSafe(relativePath) {
  return Boolean(relativePath)
    && !path.isAbsolute(relativePath)
    && !relativePath.split(/[\\/]+/).includes('..');
}

function addCheck(checks, label, ok, detail = 'ok') {
  checks.push({ label, ok: Boolean(ok), detail });
}

function countCoreRegistrationRefs() {
  const needles = [
    'jenn.admin.status',
    'jenn-admin-status',
    'JennAdminStatus',
    'JennAdminStatusView'
  ];
  let count = 0;
  for (const relativePath of CORE_RUNTIME_FILES) {
    const fullPath = path.join(CORE_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    const text = readText(fullPath);
    for (const needle of needles) {
      if (text.includes(needle)) {
        count += 1;
      }
    }
  }
  return count;
}

function main() {
  const checks = [];

  addCheck(checks, 'external root exists', fs.existsSync(EXTERNAL_ROOT), EXTERNAL_ROOT);
  addCheck(checks, 'admin package root exists', fs.existsSync(PACKAGE_ROOT), PACKAGE_ROOT);
  addCheck(checks, 'VCP_ADMIN_EXTENSION_DIRS unset', !process.env.VCP_ADMIN_EXTENSION_DIRS, process.env.VCP_ADMIN_EXTENSION_DIRS ? 'set' : 'unset');

  const targetFiles = fs.existsSync(ADMIN_ROOT)
    ? listFiles(ADMIN_ROOT).map((filePath) => toPosix(path.relative(EXTERNAL_ROOT, filePath)))
    : [];
  const riskPaths = targetFiles.filter((relativePath) => BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath)));

  addCheck(
    checks,
    'expected AdminExtensions files match',
    JSON.stringify(targetFiles) === JSON.stringify(sortRelativePaths(EXPECTED_PACKAGE_FILES)),
    targetFiles
  );
  addCheck(checks, 'AdminExtensions path risk count is zero', riskPaths.length === 0, riskPaths);

  let manifest = null;
  try {
    manifest = readJson(MANIFEST_PATH);
    addCheck(checks, 'manifest parses', true);
  } catch (error) {
    addCheck(checks, 'manifest parses', false, error.message);
  }

  const backendRoutes = Array.isArray(manifest?.backend?.routes) ? manifest.backend.routes : [];
  const frontendRoutes = Array.isArray(manifest?.frontend?.routes) ? manifest.frontend.routes : [];
  const backendRoute = backendRoutes[0] || {};
  const frontendRoute = frontendRoutes[0] || {};

  addCheck(checks, 'manifest schemaVersion is 1', manifest?.schemaVersion === 1, manifest?.schemaVersion);
  addCheck(checks, 'manifest extensionId matches target', manifest?.extensionId === EXPECTED_EXTENSION_ID, manifest?.extensionId);
  addCheck(checks, 'manifest defaultEnabled is false', manifest?.defaultEnabled === false, manifest?.defaultEnabled);
  addCheck(checks, 'manifest has one backend route', backendRoutes.length === 1, backendRoutes.length);
  addCheck(checks, 'manifest has one frontend route', frontendRoutes.length === 1, frontendRoutes.length);
  addCheck(checks, 'backend route is read-only GET', backendRoute.methods?.length === 1 && backendRoute.methods[0] === 'GET' && backendRoute.writeCapable === false, backendRoute);
  addCheck(checks, 'backend route requires auth', backendRoute.requiresAuth === true, backendRoute.requiresAuth);
  addCheck(checks, 'backend route path is namespaced', typeof backendRoute.mountPath === 'string' && backendRoute.mountPath.startsWith('/jenn-admin-'), backendRoute.mountPath);
  addCheck(checks, 'backend module path is relative safe', isRelativeSafe(backendRoute.module), backendRoute.module);
  addCheck(checks, 'frontend component path is relative safe', isRelativeSafe(frontendRoute.component), frontendRoute.component);
  addCheck(checks, 'permissions forbid external writes', manifest?.permissions?.externalWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid provider calls', manifest?.permissions?.providerCalls === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid bridge calls', manifest?.permissions?.bridgeCalls === false, manifest?.permissions);

  const backendModulePath = path.join(PACKAGE_ROOT, backendRoute.module || '');
  const frontendComponentPath = path.join(PACKAGE_ROOT, frontendRoute.component || '');
  addCheck(checks, 'backend route file exists', fs.existsSync(backendModulePath), backendModulePath);
  addCheck(checks, 'frontend view file exists', fs.existsSync(frontendComponentPath), frontendComponentPath);

  const nodeCheck = fs.existsSync(backendModulePath)
    ? spawnSync(process.execPath, ['--check', backendModulePath], { encoding: 'utf8' })
    : { status: 1, stderr: 'missing backend module' };
  addCheck(checks, 'backend node --check passes', nodeCheck.status === 0, nodeCheck.stderr || nodeCheck.stdout || 'ok');

  const frontendText = fs.existsSync(frontendComponentPath) ? readText(frontendComponentPath) : '';
  addCheck(checks, 'frontend static template exists', frontendText.includes('<template>') && frontendText.includes('</template>'));
  addCheck(checks, 'frontend static script setup exists', frontendText.includes('<script setup>') && frontendText.includes("name: 'JennAdminStatusView'"));

  let checksumEntries = new Map();
  try {
    checksumEntries = parseChecksumManifest();
    addCheck(checks, 'checksum manifest parses', true);
  } catch (error) {
    addCheck(checks, 'checksum manifest parses', false, error.message);
  }

  const checksumMissing = [];
  const checksumMismatched = [];
  for (const relativePath of EXPECTED_PACKAGE_FILES) {
    const expectedHash = checksumEntries.get(relativePath);
    if (!expectedHash) {
      checksumMissing.push(relativePath);
      continue;
    }
    const actualHash = sha256File(path.join(EXTERNAL_ROOT, ...relativePath.split('/')));
    if (actualHash !== expectedHash) {
      checksumMismatched.push(relativePath);
    }
  }
  addCheck(checks, 'AdminExtensions checksum entries exist', checksumMissing.length === 0, checksumMissing);
  addCheck(checks, 'AdminExtensions checksum entries match files', checksumMismatched.length === 0, checksumMismatched);

  const registrationRefCount = countCoreRegistrationRefs();
  addCheck(checks, 'core AdminPanel runtime registration references absent', registrationRefCount === 0, registrationRefCount);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('ADMINPANEL_PERSISTENT_PACKAGE_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('ADMINPANEL_PERSISTENT_PACKAGE_GATE_PASS');
  console.log(`EXTERNAL_ROOT=${EXTERNAL_ROOT}`);
  console.log(`ENV_VCP_ADMIN_EXTENSION_DIRS_SET=${process.env.VCP_ADMIN_EXTENSION_DIRS ? 'yes' : 'no'}`);
  console.log(`ADMIN_PACKAGE_PATH=${PACKAGE_ROOT}`);
  console.log(`TARGET_PATH_COUNT=${targetFiles.length}`);
  console.log(`TARGET_RISK_PATH_COUNT=${riskPaths.length}`);
  console.log(`MANIFEST_SCHEMA_PASS=yes`);
  console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
  console.log(`MANIFEST_BACKEND_ROUTE_COUNT=${backendRoutes.length}`);
  console.log(`MANIFEST_FRONTEND_ROUTE_COUNT=${frontendRoutes.length}`);
  console.log(`ADMIN_EXTENSION_CHECKSUM_ENTRY_COUNT=${EXPECTED_PACKAGE_FILES.length}`);
  console.log(`CHECKSUM_MANIFEST_SHA256=${sha256File(CHECKSUM_MANIFEST_PATH)}`);
  console.log(`BACKEND_NODE_CHECK_PASS=yes`);
  console.log(`FRONTEND_STATIC_CHECK_PASS=yes`);
  console.log(`ADMINPANEL_BUILD_RUN=no`);
  console.log(`RUNTIME_ADMIN_REGISTRATION_REFERENCE_COUNT=${registrationRefCount}`);
  console.log(`NO_ADMINPANEL_RUNTIME_FILES_MODIFIED=yes`);
  console.log(`NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes`);
  console.log(`NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes`);
  console.log(`PRODUCTION_DEPLOY_OR_SERVICE_STARTUP_EXECUTED=no`);
  console.log(`LIVE_EXTERNAL_WRITE_EXECUTED=no`);
}

main();
