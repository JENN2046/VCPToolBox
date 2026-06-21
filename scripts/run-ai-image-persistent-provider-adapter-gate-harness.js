'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const ADAPTER_ROOT = path.join(EXTERNAL_ROOT, 'AIImageAdapters');
const PACKAGE_ROOT = path.join(ADAPTER_ROOT, 'JennImageProviderAdapter');
const MANIFEST_PATH = path.join(PACKAGE_ROOT, 'ai-image-adapter-manifest.json');
const CHECKSUM_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifests', 'MANIFEST.sha256');

const EXPECTED_ADAPTER_ID = 'jenn.ai-image.provider-adapter';
const EXPECTED_PACKAGE_FILES = [
  'AIImageAdapters/README.AGENTS_OS.md',
  'AIImageAdapters/JennImageProviderAdapter/README.AGENTS_OS.md',
  'AIImageAdapters/JennImageProviderAdapter/ai-image-adapter-manifest.json',
  'AIImageAdapters/JennImageProviderAdapter/bindings/redacted-provider-binding.json',
  'AIImageAdapters/JennImageProviderAdapter/fixtures/no-provider/dry-run-plan.json',
  'AIImageAdapters/JennImageProviderAdapter/fixtures/no-provider/expected-result.json',
  'AIImageAdapters/JennImageProviderAdapter/src/index.js'
];

const CORE_RUNTIME_FILES = [
  'server.js',
  'routes/admin/aiImageAgents.js',
  'modules/aiImageExecutionAdapter.js',
  'modules/nativeImageDelegateRegistry.js'
];

const AI_IMAGE_ENV_NAMES = [
  'VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS',
  'VCP_AI_IMAGE_ADAPTER_DIRS'
];

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.agent_board(\/|$)/i,
  /(^|\/)localstate(\/|$)/i,
  /(^|\/)(cache|logs?|state|tmp|output|outputs|secrets|image)(\/|$)/i,
  /(^|\/)(\.env|config\.env)(\.|$)/i,
  /(secret|token|password|auth)/i,
  /\.(sqlite|sqlite3|db|db3|duckdb|faiss|parquet|pem|key|pfx|p12|jks|kdbx|log|png|jpg|jpeg|gif|webp)$/i
];

const FORBIDDEN_ADAPTER_SOURCE_PATTERN = /process\.env|require\(['"]fs['"]\)|require\(['"]https?['"]\)|axios|fetch\s*\(|PluginManager|processToolCall|writeFile|readFile|createWriteStream|listen\s*\(/;

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
    'jenn.ai-image.provider-adapter',
    'JennImageProviderAdapter',
    'VCP_AI_IMAGE_ADAPTER_DIRS'
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
  for (const name of AI_IMAGE_ENV_NAMES) {
    addCheck(checks, `${name} unset`, !process.env[name], process.env[name] ? 'set' : 'unset');
  }
  addCheck(
    checks,
    'ENABLE_AI_IMAGE_REAL_EXECUTION is not true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION !== 'true',
    process.env.ENABLE_AI_IMAGE_REAL_EXECUTION || 'unset'
  );
}

function main() {
  const checks = [];

  addCheck(checks, 'external root exists', fs.existsSync(EXTERNAL_ROOT), EXTERNAL_ROOT);
  addCheck(checks, 'AI Image package root exists', fs.existsSync(PACKAGE_ROOT), PACKAGE_ROOT);
  validateEnvOff(checks);

  const targetFiles = fs.existsSync(ADAPTER_ROOT)
    ? listFiles(ADAPTER_ROOT).map((filePath) => toPosix(path.relative(EXTERNAL_ROOT, filePath)))
    : [];
  const riskPaths = targetFiles.filter((relativePath) => BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath)));

  addCheck(
    checks,
    'expected AIImageAdapters files match',
    JSON.stringify(targetFiles) === JSON.stringify(sortRelativePaths(EXPECTED_PACKAGE_FILES)),
    targetFiles
  );
  addCheck(checks, 'AIImageAdapters path risk count is zero', riskPaths.length === 0, riskPaths);

  let manifest = null;
  try {
    manifest = readJson(MANIFEST_PATH);
    addCheck(checks, 'manifest parses', true);
  } catch (error) {
    addCheck(checks, 'manifest parses', false, error.message);
  }

  addCheck(checks, 'manifest schemaVersion is 1', manifest?.schemaVersion === 1, manifest?.schemaVersion);
  addCheck(checks, 'manifest adapterId matches target', manifest?.adapterId === EXPECTED_ADAPTER_ID, manifest?.adapterId);
  addCheck(checks, 'manifest defaultEnabled is false', manifest?.defaultEnabled === false, manifest?.defaultEnabled);
  addCheck(checks, 'manifest provider is provider-specific', manifest?.provider?.providerSpecific === true, manifest?.provider);
  addCheck(checks, 'manifest declares secrets required but not included', manifest?.provider?.secretsRequired === true, manifest?.provider);
  addCheck(checks, 'manifest runtime provider calls disabled', manifest?.provider?.runtimeProviderCallsAllowed === false, manifest?.provider);
  addCheck(checks, 'permissions forbid provider calls', manifest?.permissions?.providerCalls === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid image generation', manifest?.permissions?.imageGeneration === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid external writes', manifest?.permissions?.externalWrites === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid bridge calls', manifest?.permissions?.bridgeCalls === false, manifest?.permissions);
  addCheck(checks, 'permissions forbid local state reads', manifest?.permissions?.localStateReads === false, manifest?.permissions);
  addCheck(checks, 'entry path is relative safe', isRelativeSafe(manifest?.entry), manifest?.entry);

  const entryPath = path.join(PACKAGE_ROOT, manifest?.entry || '');
  addCheck(checks, 'entry file exists', fs.existsSync(entryPath), entryPath);

  const bindings = Array.isArray(manifest?.bindings) ? manifest.bindings : [];
  addCheck(checks, 'manifest has one redacted binding', bindings.length === 1 && bindings[0].redacted === true, bindings);
  const bindingPath = bindings[0]?.path;
  addCheck(checks, 'binding path is relative safe', isRelativeSafe(bindingPath), bindingPath);
  const bindingFilePath = path.join(PACKAGE_ROOT, bindingPath || '');
  addCheck(checks, 'binding file exists', fs.existsSync(bindingFilePath), bindingFilePath);

  let binding = null;
  try {
    binding = fs.existsSync(bindingFilePath) ? readJson(bindingFilePath) : null;
    addCheck(checks, 'binding parses', Boolean(binding), binding);
  } catch (error) {
    addCheck(checks, 'binding parses', false, error.message);
  }
  addCheck(checks, 'binding is redacted', binding?.redacted === true, binding);
  addCheck(checks, 'binding contains no secret', binding?.containsSecret === false, binding);
  addCheck(checks, 'binding runtime provider calls disabled', binding?.runtimeProviderCallsAllowed === false, binding);
  addCheck(checks, 'binding credential is not in package', binding?.credentialRef === 'not-in-package', binding);
  addCheck(checks, 'binding endpoint is not in package', binding?.providerEndpointRef === 'not-in-package', binding);

  const fixturePaths = Object.values(manifest?.fixtures || {});
  addCheck(checks, 'fixture paths exist in manifest', fixturePaths.length === 2, fixturePaths);
  for (const relativePath of fixturePaths) {
    addCheck(checks, `fixture path safe: ${relativePath}`, isRelativeSafe(relativePath), relativePath);
    addCheck(checks, `fixture file exists: ${relativePath}`, fs.existsSync(path.join(PACKAGE_ROOT, relativePath)), relativePath);
  }

  const nodeCheck = fs.existsSync(entryPath)
    ? spawnSync(process.execPath, ['--check', entryPath], { encoding: 'utf8' })
    : { status: 1, stderr: 'missing adapter entry' };
  addCheck(checks, 'adapter node --check passes', nodeCheck.status === 0, nodeCheck.stderr || nodeCheck.stdout || 'ok');

  const adapterSource = fs.existsSync(entryPath) ? readText(entryPath) : '';
  addCheck(checks, 'adapter source side-effect references absent', !FORBIDDEN_ADAPTER_SOURCE_PATTERN.test(adapterSource), 'side-effect scan');

  let noProviderResult = null;
  try {
    const adapter = require(entryPath);
    const plan = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.noProviderDryRunPlan));
    const expected = readJson(path.join(PACKAGE_ROOT, manifest.fixtures.expectedResult));
    noProviderResult = adapter.validateNoProviderDryRun(plan);
    addCheck(checks, 'no-provider result matches ok/mode', noProviderResult.ok === expected.ok && noProviderResult.mode === expected.mode, noProviderResult);
    addCheck(checks, 'no-provider result adapterId matches', noProviderResult.adapterId === expected.adapterId, noProviderResult.adapterId);
    addCheck(checks, 'provider call count is zero', noProviderResult.providerCalls === 0, noProviderResult);
    addCheck(checks, 'image generation count is zero', noProviderResult.imageGeneration === 0, noProviderResult);
    addCheck(checks, 'output write count is zero', noProviderResult.outputWrites === 0, noProviderResult);
    addCheck(checks, 'bridge call count is zero', noProviderResult.bridgeCalls === 0, noProviderResult);
    addCheck(checks, 'local state read count is zero', noProviderResult.localStateReads === 0, noProviderResult);
    delete require.cache[require.resolve(entryPath)];
  } catch (error) {
    addCheck(checks, 'no-provider dry run executes', false, error.message);
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
  addCheck(checks, 'AIImageAdapters checksum entries exist', checksumMissing.length === 0, checksumMissing);
  addCheck(checks, 'AIImageAdapters checksum entries match files', checksumMismatched.length === 0, checksumMismatched);

  const registrationRefCount = countCoreRegistrationRefs();
  addCheck(checks, 'core AI Image runtime registration references absent', registrationRefCount === 0, registrationRefCount);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error('AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_FAIL');
    for (const check of failed) {
      console.error(`FAIL ${check.label}: ${JSON.stringify(check.detail)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_PASS');
  console.log(`EXTERNAL_ROOT=${EXTERNAL_ROOT}`);
  console.log(`ENV_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_SET=${process.env.VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS ? 'yes' : 'no'}`);
  console.log(`ENV_VCP_AI_IMAGE_ADAPTER_DIRS_SET=${process.env.VCP_AI_IMAGE_ADAPTER_DIRS ? 'yes' : 'no'}`);
  console.log(`ENABLE_AI_IMAGE_REAL_EXECUTION_TRUE=${process.env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true' ? 'yes' : 'no'}`);
  console.log(`AI_IMAGE_ADAPTER_PACKAGE_PATH=${PACKAGE_ROOT}`);
  console.log(`TARGET_PATH_COUNT=${targetFiles.length}`);
  console.log(`TARGET_RISK_PATH_COUNT=${riskPaths.length}`);
  console.log('MANIFEST_SCHEMA_PASS=yes');
  console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
  console.log(`MANIFEST_PROVIDER_ID=${manifest.provider.providerId}`);
  console.log(`MANIFEST_SECRETS_REQUIRED=${manifest.provider.secretsRequired}`);
  console.log(`MANIFEST_RUNTIME_PROVIDER_CALLS_ALLOWED=${manifest.provider.runtimeProviderCallsAllowed}`);
  console.log(`PERMISSION_PROVIDER_CALLS=${manifest.permissions.providerCalls}`);
  console.log(`PERMISSION_IMAGE_GENERATION=${manifest.permissions.imageGeneration}`);
  console.log(`AI_IMAGE_ADAPTER_CHECKSUM_ENTRY_COUNT=${EXPECTED_PACKAGE_FILES.length}`);
  console.log(`CHECKSUM_MANIFEST_SHA256=${sha256File(CHECKSUM_MANIFEST_PATH)}`);
  console.log('ADAPTER_NODE_CHECK_PASS=yes');
  console.log('NO_PROVIDER_DRY_RUN_PASS=yes');
  console.log(`PROVIDER_CALL_COUNT=${noProviderResult.providerCalls}`);
  console.log(`IMAGE_GENERATION_COUNT=${noProviderResult.imageGeneration}`);
  console.log(`OUTPUT_WRITE_COUNT=${noProviderResult.outputWrites}`);
  console.log(`BRIDGE_CALL_COUNT=${noProviderResult.bridgeCalls}`);
  console.log(`LOCALSTATE_READ_COUNT=${noProviderResult.localStateReads}`);
  console.log(`RUNTIME_AI_IMAGE_ADAPTER_REGISTRATION_REFERENCE_COUNT=${registrationRefCount}`);
  console.log('NO_IMAGE_OUTPUT_WRITTEN=yes');
  console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
  console.log('NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes');
  console.log('PRODUCTION_DEPLOY_OR_SERVICE_STARTUP_EXECUTED=no');
  console.log('LIVE_EXTERNAL_WRITE_EXECUTED=no');
}

main();
