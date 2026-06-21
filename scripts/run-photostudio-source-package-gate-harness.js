'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const PACKAGE_ROOT_DIR = path.join(EXTERNAL_ROOT, 'PhotoStudioPackages');
const PACKAGE_ROOT = path.join(PACKAGE_ROOT_DIR, 'JennPhotoStudioPackage');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'photo-studio-package-manifest.json');
const CHECKSUM_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifests', 'MANIFEST.sha256');

const EXPECTED_PACKAGE_ID = 'jenn.photo-studio.package';
const EXPECTED_PACKAGE_FILES = [
  'PhotoStudioPackages/README.AGENTS_OS.md',
  'PhotoStudioPackages/JennPhotoStudioPackage/README.AGENTS_OS.md',
  'PhotoStudioPackages/JennPhotoStudioPackage/fixtures/no-auto-write/expected-result.json',
  'PhotoStudioPackages/JennPhotoStudioPackage/fixtures/no-auto-write/request.redacted.json',
  'PhotoStudioPackages/JennPhotoStudioPackage/photo-studio-package-manifest.json',
  'PhotoStudioPackages/JennPhotoStudioPackage/schemas/package-request.schema.json',
  'PhotoStudioPackages/JennPhotoStudioPackage/src/index.js',
  'PhotoStudioPackages/JennPhotoStudioPackage/templates/noAutoWriteTemplates.js'
];

const CORE_RUNTIME_FILES = [
  'modules/photoStudio/runtime.js',
  'modules/photoStudio/constants.js',
  'modules/photoStudio/store.js',
  'modules/photoStudio/projectService.js',
  'modules/photoStudio/externalSyncService.js',
  'Plugin/PhotoStudioProjectRecord/PhotoStudioProjectRecord.js',
  'Plugin/PhotoStudioExternalSync/PhotoStudioExternalSync.js'
];

const PHOTOSTUDIO_ENV_NAMES = [
  'VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS',
  'VCP_PHOTOSTUDIO_PACKAGE_DIRS'
];

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.agent_board(\/|$)/i,
  /(^|\/)localstate(\/|$)/i,
  /(^|\/)plugins\/custom\/shared\/photo_studio_data(\/|$)/i,
  /(^|\/)photo_studio_data(\/|$)/i,
  /(^|\/)(cache|logs?|state|tmp|output|outputs|secrets|image|media|exports|generated|delivery|archive_assets)(\/|$)/i,
  /(^|\/)(\.env|config\.env)(\.|$)/i,
  /(secret|token|password|auth|oauth|cookie|webhook|credential)/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|index|parquet|pem|key|pfx|p12|jks|kdbx|log|png|jpg|jpeg|gif|webp)$/i
];

const FORBIDDEN_SOURCE_PATTERN = /process\.env|require\(['"]fs['"]\)|require\(['"]https?['"]\)|require\(['"]child_process['"]\)|axios|fetch\s*\(|PluginManager|processToolCall|writeFile|appendFile|readFile|createWriteStream|createReadStream|listen\s*\(/;

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
    EXPECTED_PACKAGE_ID,
    'JennPhotoStudioPackage',
    'VCP_PHOTOSTUDIO_PACKAGE_DIRS'
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

function validateEnvOff(checks) {
  for (const name of PHOTOSTUDIO_ENV_NAMES) {
    addCheck(checks, `${name} unset`, !process.env[name], process.env[name] ? 'set' : 'unset');
  }
  addCheck(
    checks,
    'ENABLE_PHOTOSTUDIO_AUTO_WRITE is not true',
    process.env.ENABLE_PHOTOSTUDIO_AUTO_WRITE !== 'true',
    process.env.ENABLE_PHOTOSTUDIO_AUTO_WRITE || 'unset'
  );
}

function checkJavaScriptSources(checks, sourcePaths) {
  for (const relativePath of sourcePaths) {
    const fullPath = path.join(PACKAGE_ROOT, relativePath);
    const nodeCheck = spawnSync(process.execPath, ['--check', fullPath], { encoding: 'utf8' });
    addCheck(checks, `node --check passes: ${relativePath}`, nodeCheck.status === 0, nodeCheck.stderr || nodeCheck.stdout || 'ok');
    const source = readText(fullPath);
    addCheck(checks, `source side-effect references absent: ${relativePath}`, !FORBIDDEN_SOURCE_PATTERN.test(source), 'side-effect scan');
  }
}

function main() {
  const checks = [];

  addCheck(checks, 'external root exists', fs.existsSync(EXTERNAL_ROOT), EXTERNAL_ROOT);
  addCheck(checks, 'PhotoStudio package root exists', fs.existsSync(PACKAGE_ROOT), PACKAGE_ROOT);
  validateEnvOff(checks);

  const targetFiles = fs.existsSync(PACKAGE_ROOT_DIR)
    ? listFiles(PACKAGE_ROOT_DIR).map((filePath) => toPosix(path.relative(EXTERNAL_ROOT, filePath)))
    : [];
  const riskPaths = targetFiles.filter((relativePath) => BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath)));

  addCheck(
    checks,
    'expected PhotoStudioPackages files match',
    JSON.stringify(targetFiles) === JSON.stringify(sortRelativePaths(EXPECTED_PACKAGE_FILES)),
    targetFiles
  );
  addCheck(checks, 'PhotoStudioPackages path risk count is zero', riskPaths.length === 0, riskPaths);

  let manifest = null;
  try {
    manifest = readJson(MANIFEST_PATH);
    addCheck(checks, 'manifest parses', true);
  } catch (error) {
    addCheck(checks, 'manifest parses', false, error.message);
  }

  addCheck(checks, 'manifest schemaVersion is 1', manifest?.schemaVersion === 1, manifest?.schemaVersion);
  addCheck(checks, 'manifest packageId matches target', manifest?.packageId === EXPECTED_PACKAGE_ID, manifest?.packageId);
  addCheck(checks, 'manifest defaultEnabled is false', manifest?.defaultEnabled === false, manifest?.defaultEnabled);
  addCheck(checks, 'permissions forbid project data reads', manifest?.permissions?.projectDataReads === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid project data writes', manifest?.permissions?.projectDataWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid external writes', manifest?.permissions?.externalWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid provider calls', manifest?.permissions?.providerCalls === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid bridge calls', manifest?.permissions?.bridgeCalls === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid local state reads', manifest?.permissions?.localStateReads === false, manifest?.permissions);
  addCheck(checks, 'runtime registration disabled', manifest?.activation?.runtimeRegistrationAllowed === false, manifest?.activation);
  addCheck(checks, 'auto write disabled', manifest?.activation?.autoWriteAllowed === false, manifest?.activation);
  addCheck(checks, 'entry path is relative safe', isRelativeSafe(manifest?.entry), manifest?.entry);

  const entryPath = path.join(PACKAGE_ROOT, manifest?.entry || '');
  addCheck(checks, 'entry file exists', fs.existsSync(entryPath), entryPath);

  const sourceTemplatePaths = Array.isArray(manifest?.source?.templates) ? manifest.source.templates : [];
  addCheck(checks, 'manifest includes one sanitized template', sourceTemplatePaths.length === 1, sourceTemplatePaths);
  for (const relativePath of sourceTemplatePaths) {
    addCheck(checks, `template path safe: ${relativePath}`, isRelativeSafe(relativePath), relativePath);
    addCheck(checks, `template file exists: ${relativePath}`, fs.existsSync(path.join(PACKAGE_ROOT, relativePath)), relativePath);
  }
  addCheck(checks, 'manifest has no copied plugins', Array.isArray(manifest?.source?.plugins) && manifest.source.plugins.length === 0, manifest?.source?.plugins);
  addCheck(checks, 'manifest has no copied services', Array.isArray(manifest?.source?.services) && manifest.source.services.length === 0, manifest?.source?.services);

  const schemaPaths = Object.values(manifest?.schemas || {});
  addCheck(checks, 'schema paths exist in manifest', schemaPaths.length === 1, schemaPaths);
  for (const relativePath of schemaPaths) {
    addCheck(checks, `schema path safe: ${relativePath}`, isRelativeSafe(relativePath), relativePath);
    const schemaPath = path.join(PACKAGE_ROOT, relativePath);
    addCheck(checks, `schema file exists: ${relativePath}`, fs.existsSync(schemaPath), relativePath);
    try {
      const schema = fs.existsSync(schemaPath) ? readJson(schemaPath) : null;
      addCheck(checks, `schema parses: ${relativePath}`, Boolean(schema), relativePath);
      addCheck(checks, `schema forbids additional properties: ${relativePath}`, schema?.additionalProperties === false, schema);
    } catch (error) {
      addCheck(checks, `schema parses: ${relativePath}`, false, error.message);
    }
  }

  const fixturePaths = Object.values(manifest?.fixtures || {});
  addCheck(checks, 'fixture paths exist in manifest', fixturePaths.length === 2, fixturePaths);
  for (const relativePath of fixturePaths) {
    addCheck(checks, `fixture path safe: ${relativePath}`, isRelativeSafe(relativePath), relativePath);
    addCheck(checks, `fixture file exists: ${relativePath}`, fs.existsSync(path.join(PACKAGE_ROOT, relativePath)), relativePath);
  }

  checkJavaScriptSources(checks, [manifest?.entry, ...sourceTemplatePaths].filter(Boolean));

  let noAutoWriteResult = null;
  try {
    const pkg = require(entryPath);
    const request = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.noAutoWriteRequest));
    const expected = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.expectedResult));
    noAutoWriteResult = pkg.validateNoAutoWriteDryRun(request);
    addCheck(checks, 'no-auto-write result matches ok/mode', noAutoWriteResult.ok === expected.ok && noAutoWriteResult.mode === expected.mode, noAutoWriteResult);
    addCheck(checks, 'no-auto-write result packageId matches', noAutoWriteResult.packageId === expected.packageId, noAutoWriteResult.packageId);
    addCheck(checks, 'no-auto-write decision matches expected', noAutoWriteResult.decision === expected.decision, noAutoWriteResult.decision);
    addCheck(checks, 'project data read count is zero', noAutoWriteResult.projectDataReads === 0, noAutoWriteResult);
    addCheck(checks, 'project data write count is zero', noAutoWriteResult.projectDataWrites === 0, noAutoWriteResult);
    addCheck(checks, 'external write count is zero', noAutoWriteResult.externalWrites === 0, noAutoWriteResult);
    addCheck(checks, 'provider call count is zero', noAutoWriteResult.providerCalls === 0, noAutoWriteResult);
    addCheck(checks, 'bridge call count is zero', noAutoWriteResult.bridgeCalls === 0, noAutoWriteResult);
    addCheck(checks, 'local state read count is zero', noAutoWriteResult.localStateReads === 0, noAutoWriteResult);
    delete require.cache[require.resolve(entryPath)];
  } catch (error) {
    addCheck(checks, 'no-auto-write dry run executes', false, error.message);
  }

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
  addCheck(checks, 'PhotoStudioPackages checksum entries exist', checksumMissing.length === 0, checksumMissing);
  addCheck(checks, 'PhotoStudioPackages checksum entries match files', checksumMismatched.length === 0, checksumMismatched);

  const registrationRefCount = countCoreRegistrationRefs();
  addCheck(checks, 'core PhotoStudio runtime registration references absent', registrationRefCount === 0, registrationRefCount);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('PHOTOSTUDIO_SOURCE_PACKAGE_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('PHOTOSTUDIO_SOURCE_PACKAGE_GATE_PASS');
  console.log(`EXTERNAL_ROOT=${EXTERNAL_ROOT}`);
  console.log(`ENV_VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS_SET=${process.env.VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS ? 'yes' : 'no'}`);
  console.log(`ENV_VCP_PHOTOSTUDIO_PACKAGE_DIRS_SET=${process.env.VCP_PHOTOSTUDIO_PACKAGE_DIRS ? 'yes' : 'no'}`);
  console.log(`ENABLE_PHOTOSTUDIO_AUTO_WRITE_TRUE=${process.env.ENABLE_PHOTOSTUDIO_AUTO_WRITE === 'true' ? 'yes' : 'no'}`);
  console.log(`PHOTO_STUDIO_DATA_DIR_SET=${process.env.PHOTO_STUDIO_DATA_DIR ? 'yes' : 'no'}`);
  console.log(`PHOTOSTUDIO_PACKAGE_PATH=${PACKAGE_ROOT}`);
  console.log(`TARGET_PATH_COUNT=${targetFiles.length}`);
  console.log(`TARGET_RISK_PATH_COUNT=${riskPaths.length}`);
  console.log('MANIFEST_SCHEMA_PASS=yes');
  console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
  console.log(`MANIFEST_PACKAGE_ID=${manifest.packageId}`);
  console.log(`MANIFEST_RUNTIME_REGISTRATION_ALLOWED=${manifest.activation.runtimeRegistrationAllowed}`);
  console.log(`MANIFEST_AUTO_WRITE_ALLOWED=${manifest.activation.autoWriteAllowed}`);
  console.log(`PERMISSION_PROJECT_DATA_READS=${manifest.permissions.projectDataReads}`);
  console.log(`PERMISSION_PROJECT_DATA_WRITES=${manifest.permissions.projectDataWrites}`);
  console.log(`PERMISSION_EXTERNAL_WRITES=${manifest.permissions.externalWrites}`);
  console.log(`PERMISSION_PROVIDER_CALLS=${manifest.permissions.providerCalls}`);
  console.log(`PERMISSION_BRIDGE_CALLS=${manifest.permissions.bridgeCalls}`);
  console.log(`PHOTOSTUDIO_CHECKSUM_ENTRY_COUNT=${EXPECTED_PACKAGE_FILES.length}`);
  console.log(`CHECKSUM_MANIFEST_SHA256=${sha256File(CHECKSUM_MANIFEST_PATH)}`);
  console.log('SOURCE_NODE_CHECK_PASS=yes');
  console.log('NO_AUTO_WRITE_DRY_RUN_PASS=yes');
  console.log(`PROJECT_DATA_READ_COUNT=${noAutoWriteResult.projectDataReads}`);
  console.log(`PROJECT_DATA_WRITE_COUNT=${noAutoWriteResult.projectDataWrites}`);
  console.log(`EXTERNAL_WRITE_COUNT=${noAutoWriteResult.externalWrites}`);
  console.log(`PROVIDER_CALL_COUNT=${noAutoWriteResult.providerCalls}`);
  console.log(`BRIDGE_CALL_COUNT=${noAutoWriteResult.bridgeCalls}`);
  console.log(`LOCALSTATE_READ_COUNT=${noAutoWriteResult.localStateReads}`);
  console.log(`RUNTIME_PHOTOSTUDIO_PACKAGE_REGISTRATION_REFERENCE_COUNT=${registrationRefCount}`);
  console.log('NO_PHOTOSTUDIO_PROJECT_DATA_READ=yes');
  console.log('NO_PHOTOSTUDIO_PROJECT_DATA_WRITTEN=yes');
  console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
  console.log('NO_EXTERNAL_SYNC_PROVIDER_OR_BRIDGE_WRITES_EXECUTED=yes');
  console.log('PRODUCTION_DEPLOY_OR_SERVICE_STARTUP_EXECUTED=no');
  console.log('LIVE_EXTERNAL_WRITE_EXECUTED=no');
}

main();
