const assert = require('node:assert/strict');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CORE_ROOT = path.resolve(__dirname, '..');
const AI_IMAGE_ENV_NAMES = [
  'VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS',
  'VCP_AI_IMAGE_ADAPTER_DIRS',
];
const M23_TASKBOOK = path.join(
  CORE_ROOT,
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md'
);
const TRACKER = path.join(
  CORE_ROOT,
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md'
);

const runtimeFilesToInspect = [
  'server.js',
  'routes/admin/aiImageAgents.js',
  'modules/aiImageExecutionAdapter.js',
];

const riskPathPattern = /(^|[\\/])(\.env|config\.env|LocalState|state|cache|logs?|DebugLog|image|output|outputs|secrets|\.agent_board|private-memory|project-data|VectorStore|VCPLog)([\\/]|$)|secret|token|credential|auth|\.(sqlite|sqlite3|db|sqlite-shm|sqlite-wal|db-shm|db-wal|log)$/i;
const forbiddenAdapterSourcePattern = /process\.env|require\(['"]fs['"]\)|require\(['"]https?['"]\)|axios|fetch\s*\(|PluginManager|processToolCall|writeFile|readFile|createWriteStream|listen\s*\(/;

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

function readCoreText(relativePath) {
  return fs.readFileSync(path.join(CORE_ROOT, relativePath), 'utf8');
}

function readFixtureJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(assertPathInside(root, relativePath), 'utf8'));
}

function assertM23Pass() {
  const taskbook = fs.readFileSync(M23_TASKBOOK, 'utf8');
  const tracker = fs.readFileSync(TRACKER, 'utf8');
  assert.match(taskbook, /Status: TASKBOOK_READY_NO_PROVIDER_RUNTIME_CHANGE/);
  assert.match(taskbook, /VCP_AI_IMAGE_ADAPTER_DIRS/);
  assert.match(taskbook, /M24 No-Provider Shadow Validation Plan/);
  assert.match(tracker, /\| \[x\] \| M23 \| 0 \| AI Image adapter externalization planning \| PASS \|/);
  assert.match(
    tracker,
    /\| \[( |x)\] \| M24 \| 0 \| AI Image no-provider shadow validation \| (TODO|PASS) \|/
  );
}

function assertEnvOff() {
  for (const name of AI_IMAGE_ENV_NAMES) {
    assert.equal(process.env[name], undefined, `${name} must be unset for M24 shadow validation`);
  }
  assert.notEqual(process.env.ENABLE_AI_IMAGE_REAL_EXECUTION, 'true', 'ENABLE_AI_IMAGE_REAL_EXECUTION must not be true');
}

function assertNoAdapterRuntimeRegistration() {
  const hits = [];
  for (const relativePath of runtimeFilesToInspect) {
    const source = readCoreText(relativePath);
    for (const token of ['VCP_AI_IMAGE_ADAPTER_DIRS', 'jenn.example.ai-image-adapter.fixture']) {
      if (source.includes(token)) {
        hits.push(`${relativePath}:${token}`);
      }
    }
  }
  assert.deepEqual(hits, [], `AI Image adapter runtime registration references must stay absent: ${hits.join(',')}`);
}

function createFixture(fixtureRoot) {
  const manifest = {
    schemaVersion: 1,
    adapterId: 'jenn.example.ai-image-adapter.fixture',
    displayName: 'Jenn Example AI Image Adapter Fixture',
    description: 'Reviewed no-provider AI Image adapter fixture for M24 shadow validation.',
    defaultEnabled: false,
    provider: {
      providerId: 'fixture-only',
      providerSpecific: true,
      secretsRequired: false,
      runtimeProviderCallsAllowed: false,
    },
    capabilities: ['generate_image'],
    entry: 'src/index.js',
    bindings: [
      {
        bindingId: 'fixture-redacted-binding',
        path: 'bindings/redacted-provider-binding.json',
        redacted: true,
      },
    ],
    fixtures: {
      noProviderDryRunPlan: 'fixtures/no-provider/dry-run-plan.json',
      expectedResult: 'fixtures/no-provider/expected-result.json',
    },
    permissions: {
      providerCalls: false,
      imageGeneration: false,
      externalWrites: false,
      bridgeCalls: false,
      localStateReads: false,
    },
  };

  writeFile(fixtureRoot, 'README.AGENTS_OS.md', '# Jenn Example AI Image Adapter Fixture\n\nM24 no-provider fixture only. Not a runtime adapter.\n');
  writeFile(fixtureRoot, 'ai-image-adapter-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(
    fixtureRoot,
    'bindings/redacted-provider-binding.json',
    `${JSON.stringify({
      bindingId: 'fixture-redacted-binding',
      providerId: 'fixture-only',
      redacted: true,
      credentialRef: null,
      providerEndpointRef: null,
    }, null, 2)}\n`
  );
  writeFile(
    fixtureRoot,
    'fixtures/no-provider/dry-run-plan.json',
    `${JSON.stringify({
      requestId: 'm24-no-provider-shadow-validation',
      mode: 'no_provider_dry_run',
      steps: [
        {
          type: 'generate_image',
          capability: 'generate_image',
          prompt: 'fixture-only no-provider validation',
        },
      ],
    }, null, 2)}\n`
  );
  writeFile(
    fixtureRoot,
    'fixtures/no-provider/expected-result.json',
    `${JSON.stringify({
      ok: true,
      mode: 'no_provider_dry_run',
      providerCalls: 0,
      imageGeneration: 0,
      outputWrites: 0,
      bridgeCalls: 0,
      localStateReads: 0,
    }, null, 2)}\n`
  );
  writeFile(
    fixtureRoot,
    'src/index.js',
    [
      "'use strict';",
      '',
      'function validateNoProviderDryRun(plan = {}) {',
      '  const steps = Array.isArray(plan.steps) ? plan.steps : [];',
      '  return {',
      '    ok: true,',
      "    mode: 'no_provider_dry_run',",
      "    adapterId: 'jenn.example.ai-image-adapter.fixture',",
      '    steps: steps.length,',
      '    providerCalls: 0,',
      '    imageGeneration: 0,',
      '    outputWrites: 0,',
      '    bridgeCalls: 0,',
      '    localStateReads: 0,',
      '  };',
      '}',
      '',
      'module.exports = Object.freeze({ validateNoProviderDryRun });',
      '',
    ].join('\n')
  );
}

function validateManifest(fixtureRoot) {
  const manifest = readFixtureJson(fixtureRoot, 'ai-image-adapter-manifest.json');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.adapterId, 'jenn.example.ai-image-adapter.fixture');
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(manifest.provider.secretsRequired, false);
  assert.equal(manifest.provider.runtimeProviderCallsAllowed, false);
  assert.deepEqual(manifest.capabilities, ['generate_image']);
  assert.equal(manifest.permissions.providerCalls, false);
  assert.equal(manifest.permissions.imageGeneration, false);
  assert.equal(manifest.permissions.externalWrites, false);
  assert.equal(manifest.permissions.bridgeCalls, false);
  assert.equal(manifest.permissions.localStateReads, false);

  const entryPath = assertPathInside(fixtureRoot, manifest.entry);
  assert.equal(fs.existsSync(entryPath), true, 'entry must exist');

  for (const binding of manifest.bindings) {
    assert.equal(binding.redacted, true);
    assertPathInside(fixtureRoot, binding.path);
    assert.equal(fs.existsSync(path.join(fixtureRoot, binding.path)), true, `binding must exist: ${binding.path}`);
  }

  for (const relativePath of Object.values(manifest.fixtures)) {
    assertPathInside(fixtureRoot, relativePath);
    assert.equal(fs.existsSync(path.join(fixtureRoot, relativePath)), true, `fixture must exist: ${relativePath}`);
  }

  return manifest;
}

function main() {
  assertM23Pass();
  assertEnvOff();
  assertNoAdapterRuntimeRegistration();

  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'vcp-ai-image-m24-'));
  const externalRoot = path.join(tempBase, 'VCPToolBox-JENN-Extensions');
  const fixtureRoot = path.join(externalRoot, 'AIImageAdapters', 'JennExampleAIImageAdapter');

  try {
    assertNoBlockedPrivateSegments(tempBase);
    assertNoBlockedPrivateSegments(externalRoot);
    fs.mkdirSync(fixtureRoot, { recursive: true });
    createFixture(fixtureRoot);

    const fixturePaths = listFiles(fixtureRoot);
    const riskPaths = riskMatches(fixturePaths);
    assert.deepEqual(riskPaths, [], `fixture risk paths detected: ${riskPaths.join(',')}`);

    const manifest = validateManifest(fixtureRoot);
    const adapterEntry = path.join(fixtureRoot, manifest.entry);
    const adapterSource = fs.readFileSync(adapterEntry, 'utf8');
    assert.equal(forbiddenAdapterSourcePattern.test(adapterSource), false, 'adapter fixture source must stay side-effect-free');
    execFileSync(process.execPath, ['--check', adapterEntry], { encoding: 'utf8' });

    const adapter = require(adapterEntry);
    const plan = readFixtureJson(fixtureRoot, manifest.fixtures.noProviderDryRunPlan);
    const expected = readFixtureJson(fixtureRoot, manifest.fixtures.expectedResult);
    const result = adapter.validateNoProviderDryRun(plan);
    assert.equal(result.ok, expected.ok);
    assert.equal(result.mode, expected.mode);
    assert.equal(result.providerCalls, expected.providerCalls);
    assert.equal(result.imageGeneration, expected.imageGeneration);
    assert.equal(result.outputWrites, expected.outputWrites);
    assert.equal(result.bridgeCalls, expected.bridgeCalls);
    assert.equal(result.localStateReads, expected.localStateReads);
    assert.equal(result.steps, 1);

    const checksums = fixturePaths.map((relativePath) => `${sha256File(path.join(fixtureRoot, relativePath))}  ${relativePath}`);
    const checksumManifestHash = sha256Text(`${checksums.join('\n')}\n`);

    delete require.cache[require.resolve(adapterEntry)];
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixtureRoot), false, 'rollback must remove temp fixture root');

    console.log('AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_PASS');
    console.log(`TEMP_EXTERNAL_ROOT=${externalRoot}`);
    console.log(`FIXTURE_ROOT=${fixtureRoot}`);
    console.log('M23_STATUS=PASS');
    console.log('ENV_VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS_SET=no');
    console.log('ENV_VCP_AI_IMAGE_ADAPTER_DIRS_SET=no');
    console.log(`ENABLE_AI_IMAGE_REAL_EXECUTION_TRUE=${process.env.ENABLE_AI_IMAGE_REAL_EXECUTION === 'true' ? 'yes' : 'no'}`);
    console.log('MANIFEST_SCHEMA_PASS=yes');
    console.log(`MANIFEST_DEFAULT_ENABLED=${manifest.defaultEnabled}`);
    console.log(`PERMISSION_PROVIDER_CALLS=${manifest.permissions.providerCalls}`);
    console.log(`PERMISSION_IMAGE_GENERATION=${manifest.permissions.imageGeneration}`);
    console.log(`FIXTURE_PATH_COUNT=${fixturePaths.length}`);
    console.log(`FIXTURE_RISK_PATH_COUNT=${riskPaths.length}`);
    console.log(`FIXTURE_CHECKSUM_ENTRY_COUNT=${checksums.length}`);
    console.log(`FIXTURE_CHECKSUM_MANIFEST_SHA256=${checksumManifestHash}`);
    console.log('ADAPTER_NODE_CHECK_PASS=yes');
    console.log('NO_PROVIDER_DRY_RUN_PASS=yes');
    console.log(`PROVIDER_CALL_COUNT=${result.providerCalls}`);
    console.log(`IMAGE_GENERATION_COUNT=${result.imageGeneration}`);
    console.log(`OUTPUT_WRITE_COUNT=${result.outputWrites}`);
    console.log(`BRIDGE_CALL_COUNT=${result.bridgeCalls}`);
    console.log(`LOCALSTATE_READ_COUNT=${result.localStateReads}`);
    console.log('RUNTIME_AI_IMAGE_ADAPTER_REGISTRATION_REFERENCE_COUNT=0');
    console.log('ROLLBACK_TEMP_FIXTURE_REMOVED=yes');
    console.log('NO_IMAGE_OUTPUT_WRITTEN=yes');
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
  console.error(`AI_IMAGE_NO_PROVIDER_SHADOW_VALIDATION_FAIL: ${error.message}`);
  process.exitCode = 1;
}
