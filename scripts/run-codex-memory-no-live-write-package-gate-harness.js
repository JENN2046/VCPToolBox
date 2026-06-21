'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const BRIDGE_ROOT = path.join(EXTERNAL_ROOT, 'MemoryBridges');
const PACKAGE_ROOT = path.join(BRIDGE_ROOT, 'JennCodexMemoryBridge');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'memory-bridge-manifest.json');
const CHECKSUM_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifests', 'MANIFEST.sha256');

const EXPECTED_BRIDGE_ID = 'jenn.codex-memory.bridge';
const EXPECTED_PACKAGE_FILES = [
  'MemoryBridges/README.AGENTS_OS.md',
  'MemoryBridges/JennCodexMemoryBridge/README.AGENTS_OS.md',
  'MemoryBridges/JennCodexMemoryBridge/fixtures/no-live-write/expected-decision.json',
  'MemoryBridges/JennCodexMemoryBridge/fixtures/no-live-write/write-request.redacted.json',
  'MemoryBridges/JennCodexMemoryBridge/memory-bridge-manifest.json',
  'MemoryBridges/JennCodexMemoryBridge/schemas/recall-request.schema.json',
  'MemoryBridges/JennCodexMemoryBridge/schemas/write-request.schema.json',
  'MemoryBridges/JennCodexMemoryBridge/src/index.js'
];

const CORE_RUNTIME_FILES = [
  'Plugin/CodexMemoryBridge/codex-memory-bridge.js',
  'routes/admin/codexMemory.js',
  'routes/codexMemoryMcp.js',
  'modules/codexMemoryConstants.js',
  'modules/codexMemorySearch.js',
  'modules/codexMemoryOverview.js',
  'modules/codexMemoryAdaptive.js'
];

const CODEX_MEMORY_ENV_NAMES = [
  'VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS',
  'VCP_CODEX_MEMORY_BRIDGE_DIRS'
];

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.agent_board(\/|$)/i,
  /(^|\/)localstate(\/|$)/i,
  /(^|\/)dailynote(\/|$)/i,
  /(^|\/)(cache|logs?|state|tmp|output|outputs|secrets|image)(\/|$)/i,
  /(^|\/)rag_params\.json$/i,
  /(^|\/)(\.env|config\.env)(\.|$)/i,
  /(secret|token|password|auth|oauth|cookie)/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|index|parquet|pem|key|pfx|p12|jks|kdbx|log)$/i
];

const FORBIDDEN_BRIDGE_SOURCE_PATTERN = /process\.env|require\(['"]fs['"]\)|require\(['"]https?['"]\)|require\(['"]child_process['"]\)|axios|fetch\s*\(|PluginManager|processToolCall|writeFile|appendFile|readFile|createWriteStream|createReadStream|listen\s*\(/;

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
    EXPECTED_BRIDGE_ID,
    'JennCodexMemoryBridge',
    'VCP_CODEX_MEMORY_BRIDGE_DIRS'
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
  for (const name of CODEX_MEMORY_ENV_NAMES) {
    addCheck(checks, `${name} unset`, !process.env[name], process.env[name] ? 'set' : 'unset');
  }
  addCheck(
    checks,
    'ENABLE_CODEX_MEMORY_LIVE_WRITE is not true',
    process.env.ENABLE_CODEX_MEMORY_LIVE_WRITE !== 'true',
    process.env.ENABLE_CODEX_MEMORY_LIVE_WRITE || 'unset'
  );
}

function main() {
  const checks = [];

  addCheck(checks, 'external root exists', fs.existsSync(EXTERNAL_ROOT), EXTERNAL_ROOT);
  addCheck(checks, 'Memory bridge package root exists', fs.existsSync(PACKAGE_ROOT), PACKAGE_ROOT);
  validateEnvOff(checks);

  const targetFiles = fs.existsSync(BRIDGE_ROOT)
    ? listFiles(BRIDGE_ROOT).map((filePath) => toPosix(path.relative(EXTERNAL_ROOT, filePath)))
    : [];
  const riskPaths = targetFiles.filter((relativePath) => BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath)));

  addCheck(
    checks,
    'expected MemoryBridges files match',
    JSON.stringify(targetFiles) === JSON.stringify(sortRelativePaths(EXPECTED_PACKAGE_FILES)),
    targetFiles
  );
  addCheck(checks, 'MemoryBridges path risk count is zero', riskPaths.length === 0, riskPaths);

  let manifest = null;
  try {
    manifest = readJson(MANIFEST_PATH);
    addCheck(checks, 'manifest parses', true);
  } catch (error) {
    addCheck(checks, 'manifest parses', false, error.message);
  }

  addCheck(checks, 'manifest schemaVersion is 1', manifest?.schemaVersion === 1, manifest?.schemaVersion);
  addCheck(checks, 'manifest bridgeId matches target', manifest?.bridgeId === EXPECTED_BRIDGE_ID, manifest?.bridgeId);
  addCheck(checks, 'manifest defaultEnabled is false', manifest?.defaultEnabled === false, manifest?.defaultEnabled);
  addCheck(checks, 'manifest has dry-run capabilities', Array.isArray(manifest?.capabilities) && manifest.capabilities.every((item) => item.endsWith('.dryRun')), manifest?.capabilities);
  addCheck(checks, 'permissions forbid bridge writes', manifest?.permissions?.bridgeWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid private memory reads', manifest?.permissions?.privateMemoryReads === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid local state reads', manifest?.permissions?.localStateReads === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid external writes', manifest?.permissions?.externalWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid provider calls', manifest?.permissions?.providerCalls === false, manifest?.permissions);
  addCheck(checks, 'runtime registration disabled', manifest?.activation?.runtimeRegistrationAllowed === false, manifest?.activation);
  addCheck(checks, 'live write activation disabled', manifest?.activation?.liveWriteActivationAllowed === false, manifest?.activation);
  addCheck(checks, 'entry path is relative safe', isRelativeSafe(manifest?.entry), manifest?.entry);

  const entryPath = path.join(PACKAGE_ROOT, manifest?.entry || '');
  addCheck(checks, 'entry file exists', fs.existsSync(entryPath), entryPath);

  const schemaPaths = Object.values(manifest?.schemas || {});
  addCheck(checks, 'schema paths exist in manifest', schemaPaths.length === 2, schemaPaths);
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

  const nodeCheck = fs.existsSync(entryPath)
    ? spawnSync(process.execPath, ['--check', entryPath], { encoding: 'utf8' })
    : { status: 1, stderr: 'missing bridge entry' };
  addCheck(checks, 'bridge node --check passes', nodeCheck.status === 0, nodeCheck.stderr || nodeCheck.stdout || 'ok');

  const bridgeSource = fs.existsSync(entryPath) ? readText(entryPath) : '';
  addCheck(checks, 'bridge source side-effect references absent', !FORBIDDEN_BRIDGE_SOURCE_PATTERN.test(bridgeSource), 'side-effect scan');

  let noLiveWriteResult = null;
  try {
    const bridge = require(entryPath);
    const request = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.noLiveWriteRequest));
    const expected = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.expectedDecision));
    noLiveWriteResult = bridge.validateNoLiveWriteDryRun(request);
    addCheck(checks, 'no-live-write result matches ok/mode', noLiveWriteResult.ok === expected.ok && noLiveWriteResult.mode === expected.mode, noLiveWriteResult);
    addCheck(checks, 'no-live-write result bridgeId matches', noLiveWriteResult.bridgeId === expected.bridgeId, noLiveWriteResult.bridgeId);
    addCheck(checks, 'no-live-write decision matches expected', noLiveWriteResult.decision === expected.decision, noLiveWriteResult.decision);
    addCheck(checks, 'bridge write count is zero', noLiveWriteResult.bridgeWrites === 0, noLiveWriteResult);
    addCheck(checks, 'private memory read count is zero', noLiveWriteResult.privateMemoryReads === 0, noLiveWriteResult);
    addCheck(checks, 'local state read count is zero', noLiveWriteResult.localStateReads === 0, noLiveWriteResult);
    addCheck(checks, 'external write count is zero', noLiveWriteResult.externalWrites === 0, noLiveWriteResult);
    addCheck(checks, 'provider call count is zero', noLiveWriteResult.providerCalls === 0, noLiveWriteResult);
    delete require.cache[require.resolve(entryPath)];
  } catch (error) {
    addCheck(checks, 'no-live-write dry run executes', false, error.message);
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
  addCheck(checks, 'MemoryBridges checksum entries exist', checksumMissing.length === 0, checksumMissing);
  addCheck(checks, 'MemoryBridges checksum entries match files', checksumMismatched.length === 0, checksumMismatched);

  const registrationRefCount = countCoreRegistrationRefs();
  addCheck(checks, 'core Codex/Memory runtime registration references absent', registrationRefCount === 0, registrationRefCount);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_PASS');
  console.log(`EXTERNAL_ROOT=${EXTERNAL_ROOT}`);
  console.log(`ENV_VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS_SET=${process.env.VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS ? 'yes' : 'no'}`);
  console.log(`ENV_VCP_CODEX_MEMORY_BRIDGE_DIRS_SET=${process.env.VCP_CODEX_MEMORY_BRIDGE_DIRS ? 'yes' : 'no'}`);
  console.log(`ENABLE_CODEX_MEMORY_LIVE_WRITE_TRUE=${process.env.ENABLE_CODEX_MEMORY_LIVE_WRITE === 'true' ? 'yes' : 'no'}`);
  console.log(`MEMORY_BRIDGE_PACKAGE_PATH=${PACKAGE_ROOT}`);
  console.log(`TARGET_PATH_COUNT=${targetFiles.length}`);
  console.log(`TARGET_RISK_PATH_COUNT=${riskPaths.length}`);
  console.log('MANIFEST_SCHEMA_PASS=yes');
  console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
  console.log(`MANIFEST_BRIDGE_ID=${manifest.bridgeId}`);
  console.log(`MANIFEST_RUNTIME_REGISTRATION_ALLOWED=${manifest.activation.runtimeRegistrationAllowed}`);
  console.log(`MANIFEST_LIVE_WRITE_ACTIVATION_ALLOWED=${manifest.activation.liveWriteActivationAllowed}`);
  console.log(`PERMISSION_BRIDGE_WRITES=${manifest.permissions.bridgeWrites}`);
  console.log(`PERMISSION_PRIVATE_MEMORY_READS=${manifest.permissions.privateMemoryReads}`);
  console.log(`PERMISSION_LOCALSTATE_READS=${manifest.permissions.localStateReads}`);
  console.log(`PERMISSION_EXTERNAL_WRITES=${manifest.permissions.externalWrites}`);
  console.log(`MEMORY_BRIDGE_CHECKSUM_ENTRY_COUNT=${EXPECTED_PACKAGE_FILES.length}`);
  console.log(`CHECKSUM_MANIFEST_SHA256=${sha256File(CHECKSUM_MANIFEST_PATH)}`);
  console.log('BRIDGE_NODE_CHECK_PASS=yes');
  console.log('NO_LIVE_WRITE_DRY_RUN_PASS=yes');
  console.log(`BRIDGE_WRITE_COUNT=${noLiveWriteResult.bridgeWrites}`);
  console.log(`PRIVATE_MEMORY_READ_COUNT=${noLiveWriteResult.privateMemoryReads}`);
  console.log(`LOCALSTATE_READ_COUNT=${noLiveWriteResult.localStateReads}`);
  console.log(`EXTERNAL_WRITE_COUNT=${noLiveWriteResult.externalWrites}`);
  console.log(`PROVIDER_CALL_COUNT=${noLiveWriteResult.providerCalls}`);
  console.log(`RUNTIME_CODEX_MEMORY_BRIDGE_REGISTRATION_REFERENCE_COUNT=${registrationRefCount}`);
  console.log('NO_REAL_MEMORY_CONTENT_READ=yes');
  console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
  console.log('NO_BRIDGE_OR_LIVE_EXTERNAL_WRITES_EXECUTED=yes');
  console.log('PRODUCTION_DEPLOY_OR_SERVICE_STARTUP_EXECUTED=no');
  console.log('LIVE_EXTERNAL_WRITE_EXECUTED=no');
}

main();
