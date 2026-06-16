#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(
  PROJECT_ROOT,
  '..',
  'VCPToolBox-JENN-Extensions',
);
const EXTERNAL_PLUGIN_ROOT = path.join(
  EXTERNAL_PACKAGE_ROOT,
  'Plugin',
  'JennAIGentQualityTrial',
);
const CORE_PLUGIN_ROOT = path.join(PROJECT_ROOT, 'Plugin', 'AIGentQuality');
const TARGET_MANIFEST = path.join(EXTERNAL_PLUGIN_ROOT, 'plugin-manifest.json');
const PRELOAD_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'harness',
  'aigentquality-server-smoke-preload.js',
);
const S2_IMPLEMENTATION_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_MINIMAL_HARNESS_DRY_RUN_20260616.md',
);
const S0_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S0_PREFLIGHT_EVIDENCE_20260615.md',
);
const S1_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S1_HARNESS_DESIGN_20260615.md',
);
const S2_PREPLAN_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_DRY_RUN_HARNESS_PREPLAN_20260615.md',
);

const EXPECTED_BRANCH = 'codex/aigentquality-s2-harness-dry-run';
const EXPECTED_CORE_BASE = '7ec538fe76bcfb54d20c025ef6a5d8833b415d0e';
const EXPECTED_EXTERNAL_HEAD = 'beb072b8ad1530dd62c526c71e4cc09930068685';
const TARGET_PLUGIN_NAME = 'JennAIGentQualityTrial';
const TARGET_ENTRYPOINT = 'node AIGentQuality.js';
const EXACT_EXTERNAL_ALLOWLIST = `${TARGET_PLUGIN_NAME}@${EXTERNAL_PLUGIN_ROOT}`;
const STATUS_GIT_GLOBAL_ARGS = ['--no-optional-locks'];
const IGNORED_RUNTIME_EXCLUDED_PATHS = [
  ':(exclude)node_modules',
  ':(exclude,glob)node_modules/**',
  ':(exclude,glob)**/node_modules',
  ':(exclude,glob)**/node_modules/**',
];
const SENSITIVE_IGNORED_RUNTIME_PATHS = [
  ':/.env',
  ':/.env.local',
  ':/.env.development.local',
  ':/.env.test.local',
  ':/.env.production.local',
  ':(glob).env.*.local',
  ':(glob)**/.env',
  ':(glob)**/.env.local',
  ':(glob)**/.env.development.local',
  ':(glob)**/.env.test.local',
  ':(glob)**/.env.production.local',
  ':(glob)**/.env.*.local',
  ':/config.env',
  ':/config.env.local',
  ':(glob)**/config.env',
  ':(glob)**/config.env.local',
  ':/ModelRedirect.json',
  ':/agent_map.json',
  ':/preprocessor_order.json',
  ':/tag-processor-config.env',
  ':/SemanticModelRouter.local.json',
  ':/state',
  ':/.cache',
  ':/.cache/**',
  ':/cache',
  ':/cache/**',
  ':/output',
  ':/output/**',
  ':/outputs',
  ':/outputs/**',
  ':/logs',
  ':/logs/**',
  ':/secrets',
  ':/secrets/**',
  ':/DebugLog',
  ':/ip_blacklist.json',
  ':/VectorStore',
  ':/image/fluxgen',
  ':/image/fluxgen/**',
  ':/image/gptimagegen',
  ':/image/gptimagegen/**',
  ':/image/bilibili',
  ':/image/bilibili/**',
  ':/Plugin/EmojiListGenerator/generated_lists',
  ':(glob)Plugin/**/.cache',
  ':(glob)Plugin/**/.cache/**',
  ':(glob)Plugin/**/.cache*',
  ':(glob)Plugin/**/.cache*/**',
  ':(glob)Plugin/**/cache',
  ':(glob)Plugin/**/cache/**',
  ':(glob)Plugin/**/output',
  ':(glob)Plugin/**/output/**',
  ':(glob)Plugin/**/outputs',
  ':(glob)Plugin/**/outputs/**',
  ':(glob)Plugin/**/logs',
  ':(glob)Plugin/**/logs/**',
  ':(glob)Plugin/**/secrets',
  ':(glob)Plugin/**/secrets/**',
  ':/Plugin/UserAuth/code.bin',
  ':(glob)Plugin/**/state',
  ':(glob)Plugin/**/state/**',
  ':(glob)Plugin/**/*.log',
  ':(glob)Plugin/**/*.sqlite',
  ':(glob)Plugin/**/*.sqlite-shm',
  ':(glob)Plugin/**/*.sqlite-wal',
  ':(glob)Plugin/**/*.db',
  ':/Plugin/OneRing/data',
  ':/Plugin/ProjectAnalyst/database',
  ':/ToolConfigs/dynamic_tool_catalog.json',
  ':/ToolConfigs/dynamic_tool_categories.json',
];

const EXPECTED_COMMANDS = Object.freeze([
  'BuildRetryPlan',
  'HealthCheck',
  'InspectBatch',
  'InspectImage',
]);

const ALLOWED_DIRTY_PATHS = Object.freeze([
  rel(PRELOAD_FILE),
  rel(path.join(PROJECT_ROOT, 'scripts', 'aigentquality-server-smoke-s2.js')),
  rel(S2_IMPLEMENTATION_DOC),
]);

const ALLOWED_SECRET_LIKE_CHILD_ENV_KEYS = Object.freeze([
  'AdminPassword',
  'AdminUsername',
  'API_Key',
  'API_URL',
  'File_Key',
  'Image_Key',
  'Key',
  'ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE',
  'VCP_Key',
]);

const SECRET_LIKE_ENV_KEY = /(?:api[_-]?key|token|secret|password|passwd|credential|cookie|session|bearer|authorization|openai|anthropic|gemini|doubao)/i;

function rel(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/');
}

function runGit(cwd, gitArgs) {
  const effectiveArgs =
    gitArgs[0] === 'status' ? [...STATUS_GIT_GLOBAL_ARGS, ...gitArgs] : gitArgs;
  const result = spawnSync('git', effectiveArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    timeout: 15000,
    windowsHide: true,
  });
  const stderr = (result.stderr || '').trimEnd();
  const errorMessage =
    result.error && result.error.message ? result.error.message : '';
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trimEnd(),
    stderr: stderr || errorMessage,
  };
}

function gitState(cwd) {
  const branch = runGit(cwd, ['branch', '--show-current']);
  const head = runGit(cwd, ['rev-parse', 'HEAD']);
  const status = runGit(cwd, [
    'status',
    '--short',
    '--untracked-files=all',
  ]);
  return {
    branch: branch.ok ? branch.stdout : null,
    branchOk: branch.ok,
    branchError: branch.ok ? '' : branch.stderr,
    head: head.ok ? head.stdout : null,
    headOk: head.ok,
    headError: head.ok ? '' : head.stderr,
    statusShort: status.ok ? status.stdout : null,
    statusOk: status.ok,
    statusError: status.ok ? '' : status.stderr,
  };
}

function ignoredRuntimeState(cwd) {
  const result = runGit(cwd, [
    'status',
    '--short',
    '--ignored',
    '--untracked-files=normal',
    '--',
    ...SENSITIVE_IGNORED_RUNTIME_PATHS,
    ...IGNORED_RUNTIME_EXCLUDED_PATHS,
  ]);

  return {
    ok: result.ok,
    statusShort: result.ok ? result.stdout : '',
    error: result.ok ? '' : result.stderr,
  };
}

function statusEntries(statusShort) {
  if (!statusShort) return [];
  return statusShort
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const paths = line
        .slice(3)
        .split(' -> ')
        .map((item) => item.replace(/^"|"$/g, '').replace(/\\/g, '/'));
      return { line, paths };
    });
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_error) {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function tryReadJson(filePath) {
  if (!fileExists(filePath)) {
    return { value: null, error: 'file missing' };
  }
  try {
    return { value: readJson(filePath), error: '' };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function addCheck(checks, name, ok, details = null) {
  checks.push({ name, ok: Boolean(ok), details });
}

function collectCommands(manifest) {
  const commands =
    manifest &&
    manifest.capabilities &&
    Array.isArray(manifest.capabilities.invocationCommands)
      ? manifest.capabilities.invocationCommands
      : [];

  return commands
    .map((item) => item && item.commandIdentifier)
    .filter((value) => typeof value === 'string')
    .sort();
}

function hasAllMarkers(source, markers) {
  return markers.every((marker) => source.includes(marker));
}

function getEnvValueCaseInsensitive(env, requestedKey) {
  const foundKey = Object.keys(env).find(
    (key) => key.toLowerCase() === requestedKey.toLowerCase(),
  );
  return foundKey ? { key: foundKey, value: env[foundKey] } : null;
}

function putIfPresent(target, env, key) {
  const found = getEnvValueCaseInsensitive(env, key);
  if (found && typeof found.value === 'string' && found.value) {
    target[found.key] = found.value;
  }
}

function buildReviewedChildEnv(runRoot) {
  const env = {};
  const tempRoot = path.join(runRoot, 'tmp');
  const runRootPaths = {
    agentDir: path.join(runRoot, 'Agent'),
    tvsTxtDir: path.join(runRoot, 'TVStxt'),
    knowledgeBaseRoot: path.join(runRoot, 'dailynote'),
    channelHubBaseDir: path.join(runRoot, 'channelHub'),
    cwd: path.join(runRoot, 'cwd'),
    harnessConfig: path.join(runRoot, 'harness-config.json'),
  };

  putIfPresent(env, process.env, 'SystemRoot');
  putIfPresent(env, process.env, 'ComSpec');
  putIfPresent(env, process.env, 'PATHEXT');
  putIfPresent(env, process.env, 'PATH');
  putIfPresent(env, process.env, 'Path');
  env.TEMP = tempRoot;
  env.TMP = tempRoot;

  Object.assign(env, {
    VCP_AIGENTQUALITY_S2_HARNESS_CONFIG: runRootPaths.harnessConfig,
    PORT: '61264',
    DebugMode: 'false',
    CHAT_LOG_ENABLED: 'false',
    API_URL: 'http://127.0.0.1:9',
    API_Key: 'fake-local-only',
    Key: 'fake-local-only',
    Image_Key: 'fake-local-only',
    File_Key: 'fake-local-only',
    VCP_Key: 'fake-local-only',
    AdminUsername: 'fake-local-only',
    AdminPassword: 'fake-local-only',
    AGENT_DIR_PATH: runRootPaths.agentDir,
    TVSTXT_DIR_PATH: runRootPaths.tvsTxtDir,
    KNOWLEDGEBASE_ROOT_PATH: runRootPaths.knowledgeBaseRoot,
    CHANNELHUB_BASE_DIR: runRootPaths.channelHubBaseDir,
    ENABLE_AI_IMAGE_AGENTS_ROUTE: 'false',
    ENABLE_AI_IMAGE_REAL_EXECUTION: 'false',
    ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE: 'false',
    VCP_PLUGIN_ALLOWED_ROOTS: EXTERNAL_PACKAGE_ROOT,
    VCP_PLUGIN_DIRS: path.join(EXTERNAL_PACKAGE_ROOT, 'Plugin'),
    VCP_EXTERNAL_PLUGIN_ALLOWLIST: EXACT_EXTERNAL_ALLOWLIST,
  });

  return {
    env,
    runRootPaths,
  };
}

function secretLikeChildEnvKeys(env) {
  return Object.keys(env)
    .filter((key) => SECRET_LIKE_ENV_KEY.test(key))
    .filter((key) => !ALLOWED_SECRET_LIKE_CHILD_ENV_KEYS.includes(key));
}

function secretLikeParentEnvKeyCount() {
  return Object.keys(process.env).filter((key) => SECRET_LIKE_ENV_KEY.test(key))
    .length;
}

function requirePreloadContract() {
  return require(PRELOAD_FILE);
}

function buildReceipt() {
  const checks = [];
  const dryRunBlockedReasons = [];
  const realS2BlockedReasons = [
    'real server smoke is not authorized by this dry-run harness gate',
  ];
  const args = new Set(process.argv.slice(2));
  const executeServerRequested = args.has('--execute-server');
  const jsonMode = args.has('--json');
  const strictClean = args.has('--strict-clean');
  const plannedRunRoot = path.join(
    os.tmpdir(),
    'vcptoolbox-aigentquality-server-smoke-DRYRUN-NOT-CREATED',
  );
  const childEnvPlan = buildReviewedChildEnv(plannedRunRoot);

  const coreGit = gitState(PROJECT_ROOT);
  const externalGit = gitState(EXTERNAL_PACKAGE_ROOT);
  const coreIgnoredRuntime = ignoredRuntimeState(PROJECT_ROOT);
  const externalIgnoredRuntime = ignoredRuntimeState(EXTERNAL_PACKAGE_ROOT);
  const coreStatusEntries = statusEntries(coreGit.statusShort);
  const coreIgnoredRuntimeStatusEntries = statusEntries(
    coreIgnoredRuntime.statusShort,
  );
  const externalIgnoredRuntimeStatusEntries = statusEntries(
    externalIgnoredRuntime.statusShort,
  );
  const allowedDirtySet = new Set(ALLOWED_DIRTY_PATHS);
  const disallowedCoreStatusEntries = coreStatusEntries.filter((entry) =>
    entry.paths.some((statusPath) => !allowedDirtySet.has(statusPath)),
  );
  const coreContainsExpectedBase = runGit(PROJECT_ROOT, [
    'merge-base',
    '--is-ancestor',
    EXPECTED_CORE_BASE,
    'HEAD',
  ]).ok;

  const s0Text = fileExists(S0_DOC) ? readText(S0_DOC) : '';
  const s1Text = fileExists(S1_DOC) ? readText(S1_DOC) : '';
  const s2PreplanText = fileExists(S2_PREPLAN_DOC) ? readText(S2_PREPLAN_DOC) : '';
  const manifestParse = tryReadJson(TARGET_MANIFEST);
  const manifest = manifestParse.value;
  const commandList = collectCommands(manifest);
  const childSecretLikeKeys = secretLikeChildEnvKeys(childEnvPlan.env);

  let preloadContract = null;
  let preloadValidation = {
    ok: false,
    failures: ['preload contract not loaded'],
  };
  try {
    const preload = requirePreloadContract();
    preloadContract = preload.buildPreloadContractReceipt({
      projectRoot: PROJECT_ROOT,
      externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
      runRoot: plannedRunRoot,
      harnessConfigPath: childEnvPlan.runRootPaths.harnessConfig,
    });
    preloadValidation = preload.validatePreloadContractReceipt(preloadContract);
  } catch (error) {
    preloadValidation = {
      ok: false,
      failures: [error.message],
    };
  }

  addCheck(checks, 'core branch is S2 harness branch', coreGit.branch === EXPECTED_BRANCH, coreGit.branch);
  addCheck(checks, 'core git status read', coreGit.statusOk, coreGit.statusError || 'ok');
  addCheck(checks, 'core ignored runtime inventory read', coreIgnoredRuntime.ok, coreIgnoredRuntime.error || 'ok');
  addCheck(checks, 'core contains merged S2 preplan base', coreContainsExpectedBase, EXPECTED_CORE_BASE);
  addCheck(checks, 'external package git status read', externalGit.statusOk, externalGit.statusError || 'ok');
  addCheck(checks, 'external ignored runtime inventory read', externalIgnoredRuntime.ok, externalIgnoredRuntime.error || 'ok');
  addCheck(checks, 'external package head matches reviewed head', externalGit.head === EXPECTED_EXTERNAL_HEAD, externalGit.head);
  addCheck(checks, 'target external manifest exists', fileExists(TARGET_MANIFEST), TARGET_MANIFEST);
  addCheck(checks, 'target external manifest parses', Boolean(manifest) && !manifestParse.error, manifestParse.error || 'ok');
  addCheck(checks, 'core AIGentQuality plugin remains present', fs.existsSync(CORE_PLUGIN_ROOT), CORE_PLUGIN_ROOT);
  addCheck(checks, 'S0 evidence exists', fileExists(S0_DOC), rel(S0_DOC));
  addCheck(checks, 'S1 design exists', fileExists(S1_DOC), rel(S1_DOC));
  addCheck(checks, 'S2 preplan exists', fileExists(S2_PREPLAN_DOC), rel(S2_PREPLAN_DOC));
  addCheck(checks, 'S2 implementation doc exists', fileExists(S2_IMPLEMENTATION_DOC), rel(S2_IMPLEMENTATION_DOC));
  addCheck(checks, 'S1 still marked not authorized for S2', s1Text.includes('S2 authorized: no'), 'S2 authorized: no');
  addCheck(checks, 'S2 preplan names future runner', s2PreplanText.includes('scripts/aigentquality-server-smoke-s2.js'), rel(__filename));
  addCheck(checks, 'S2 preplan names future preload', s2PreplanText.includes('tests/harness/aigentquality-server-smoke-preload.js'), rel(PRELOAD_FILE));
  addCheck(checks, 'manifest name matches target', manifest && manifest.name === TARGET_PLUGIN_NAME, manifest && manifest.name);
  addCheck(checks, 'manifest type is synchronous', manifest && manifest.pluginType === 'synchronous', manifest && manifest.pluginType);
  addCheck(checks, 'manifest entry point is node stdio command', manifest && manifest.entryPoint && manifest.entryPoint.command === TARGET_ENTRYPOINT, manifest && manifest.entryPoint);
  addCheck(checks, 'manifest protocol is stdio', manifest && manifest.communication && manifest.communication.protocol === 'stdio', manifest && manifest.communication);
  addCheck(
    checks,
    'manifest external vision default is false',
    manifest &&
      manifest.configSchema &&
      manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION &&
      manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION.default === false,
    manifest &&
      manifest.configSchema &&
      manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION,
  );
  addCheck(checks, 'manifest command set matches expected', JSON.stringify(commandList) === JSON.stringify([...EXPECTED_COMMANDS]), commandList);
  addCheck(checks, 'child env is replacement allowlist only', childSecretLikeKeys.length === 0, childSecretLikeKeys);
  addCheck(checks, 'child env excludes VCP_PLUGIN_INSTALL_DIR', !Object.prototype.hasOwnProperty.call(childEnvPlan.env, 'VCP_PLUGIN_INSTALL_DIR'), null);
  addCheck(checks, 'preload contract validates', preloadValidation.ok, preloadValidation.failures);
  addCheck(checks, 'dry-run does not request real server execution', !executeServerRequested, '--execute-server');

  if (!coreGit.statusOk) {
    dryRunBlockedReasons.push(`core git status failed: ${coreGit.statusError}`);
  }
  if (!externalGit.statusOk) {
    dryRunBlockedReasons.push(`external package git status failed: ${externalGit.statusError}`);
  }
  if (disallowedCoreStatusEntries.length > 0) {
    dryRunBlockedReasons.push(
      `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
        .map((entry) => entry.line)
        .join('; ')}`,
    );
  }
  if (!coreIgnoredRuntime.ok) {
    dryRunBlockedReasons.push(
      `core ignored runtime inventory failed: ${coreIgnoredRuntime.error}`,
    );
    realS2BlockedReasons.push('core ignored runtime inventory failed');
  } else if (coreIgnoredRuntimeStatusEntries.length > 0) {
    realS2BlockedReasons.push(
      'core worktree has sensitive ignored runtime artifacts',
    );
    if (strictClean) {
      dryRunBlockedReasons.push(
        `core worktree has sensitive ignored runtime artifacts: ${coreIgnoredRuntimeStatusEntries
          .map((entry) => entry.line)
          .join('; ')}`,
      );
    }
  }
  if (!externalIgnoredRuntime.ok) {
    dryRunBlockedReasons.push(
      `external ignored runtime inventory failed: ${externalIgnoredRuntime.error}`,
    );
    realS2BlockedReasons.push('external ignored runtime inventory failed');
  } else if (externalIgnoredRuntimeStatusEntries.length > 0) {
    realS2BlockedReasons.push(
      'external package has sensitive ignored runtime artifacts',
    );
    if (strictClean) {
      dryRunBlockedReasons.push(
        `external package has sensitive ignored runtime artifacts: ${externalIgnoredRuntimeStatusEntries
          .map((entry) => entry.line)
          .join('; ')}`,
      );
    }
  }
  if (externalGit.statusOk && externalGit.statusShort) {
    dryRunBlockedReasons.push('external package worktree is dirty');
  }
  for (const check of checks) {
    if (!check.ok) dryRunBlockedReasons.push(check.name);
  }

  if (coreGit.statusOk && coreGit.statusShort) {
    realS2BlockedReasons.push('core worktree must be fully clean before real S2');
  }
  if (externalGit.statusOk && externalGit.statusShort) {
    realS2BlockedReasons.push('external package worktree must be clean before real S2');
  }

  const dryRunPass = dryRunBlockedReasons.length === 0;
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'aigentquality-s2-minimal-harness-dry-run',
    authorization: {
      dryRunAuthorized: true,
      realServerStartAuthorized: false,
      executeServerRequested,
      strictClean,
    },
    safetyAssertions: {
      startedServer: false,
      importedServer: false,
      spawnedServer: false,
      boundPort: false,
      executedPlugin: false,
      wroteRuntimeFiles: false,
      networkOrProviderCalls: false,
    },
    paths: {
      projectRoot: PROJECT_ROOT,
      externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
      externalPluginRoot: EXTERNAL_PLUGIN_ROOT,
      corePluginRoot: CORE_PLUGIN_ROOT,
      targetManifest: TARGET_MANIFEST,
      parentRunner: rel(__filename),
      preload: rel(PRELOAD_FILE),
      implementationDoc: rel(S2_IMPLEMENTATION_DOC),
      plannedRunRoot,
      plannedCwd: childEnvPlan.runRootPaths.cwd,
      plannedHarnessConfig: childEnvPlan.runRootPaths.harnessConfig,
    },
    expected: {
      coreBase: EXPECTED_CORE_BASE,
      externalHead: EXPECTED_EXTERNAL_HEAD,
      targetPluginName: TARGET_PLUGIN_NAME,
      exactExternalAllowlist: EXACT_EXTERNAL_ALLOWLIST,
      commands: EXPECTED_COMMANDS,
    },
    git: {
      core: {
        branch: coreGit.branch,
        head: coreGit.head,
        statusOk: coreGit.statusOk,
        statusError: coreGit.statusError,
        statusShort: coreGit.statusShort || '',
        allowedDirtyPaths: ALLOWED_DIRTY_PATHS,
        disallowedCoreStatusEntries,
        ignoredRuntimeStatusShort: coreIgnoredRuntime.statusShort || '',
        ignoredRuntimeStatusEntries: coreIgnoredRuntimeStatusEntries,
        ignoredRuntimeInventoryError: coreIgnoredRuntime.error || '',
      },
      external: {
        branch: externalGit.branch,
        head: externalGit.head,
        statusOk: externalGit.statusOk,
        statusError: externalGit.statusError,
        statusShort: externalGit.statusShort || '',
        ignoredRuntimeStatusShort: externalIgnoredRuntime.statusShort || '',
        ignoredRuntimeStatusEntries: externalIgnoredRuntimeStatusEntries,
        ignoredRuntimeInventoryError: externalIgnoredRuntime.error || '',
      },
    },
    dirtyWorktreePolicy: {
      statusGitGlobalArgs: STATUS_GIT_GLOBAL_ARGS,
      statusUntrackedMode: 'all',
      strictClean,
      ignoredRuntimeArtifactsBlockDryRunOnlyUnderStrictClean: true,
      sensitiveIgnoredRuntimePathspecs: SENSITIVE_IGNORED_RUNTIME_PATHS,
      ignoredRuntimeExcludedPathspecs: IGNORED_RUNTIME_EXCLUDED_PATHS,
    },
    realS2Readiness: {
      ready: realS2BlockedReasons.length === 0,
      coreNormalStatusClean: coreGit.statusOk && !coreGit.statusShort,
      coreIgnoredRuntimeClean:
        coreIgnoredRuntime.ok && coreIgnoredRuntimeStatusEntries.length === 0,
      externalNormalStatusClean:
        externalGit.statusOk && !externalGit.statusShort,
      externalIgnoredRuntimeClean:
        externalIgnoredRuntime.ok &&
        externalIgnoredRuntimeStatusEntries.length === 0,
    },
    childEnvPlan: {
      builtWithoutSpreadingProcessEnv: true,
      keySet: Object.keys(childEnvPlan.env).sort((a, b) =>
        a.localeCompare(b, 'en', { sensitivity: 'base' }),
      ),
      secretLikeParentEnvKeyCount: secretLikeParentEnvKeyCount(),
      secretLikeChildEnvKeys: childSecretLikeKeys,
      valuesRedacted: true,
    },
    manifest: {
      parsed: Boolean(manifest),
      name: manifest && manifest.name,
      pluginType: manifest && manifest.pluginType,
      entryPoint: manifest && manifest.entryPoint,
      communication: manifest && manifest.communication,
      commands: commandList,
    },
    preloadContract,
    preloadValidation,
    checks,
    dryRunBlockedReasons,
    realS2BlockedReasons,
    result: dryRunPass ? 'S2_HARNESS_DRY_RUN_READY' : 'S2_HARNESS_DRY_RUN_BLOCKED',
    note:
      'This dry-run runner does not import or spawn server.js. The preload is contract-only and fail-closed for accidental server startup.',
  };

  return {
    receipt,
    jsonMode,
  };
}

function main() {
  const { receipt, jsonMode } = buildReceipt();
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `mode: ${receipt.mode}`,
        `result: ${receipt.result}`,
        `core: ${receipt.git.core.branch}@${receipt.git.core.head}`,
        `external: ${receipt.git.external.branch}@${receipt.git.external.head}`,
        `startedServer: ${receipt.safetyAssertions.startedServer}`,
        `importedServer: ${receipt.safetyAssertions.importedServer}`,
        `spawnedServer: ${receipt.safetyAssertions.spawnedServer}`,
        `boundPort: ${receipt.safetyAssertions.boundPort}`,
        `checks: ${receipt.checks.filter((check) => check.ok).length}/${receipt.checks.length}`,
        `dryRunBlocked: ${
          receipt.dryRunBlockedReasons.length
            ? receipt.dryRunBlockedReasons.join('; ')
            : 'none'
        }`,
        `realS2Blocked: ${receipt.realS2BlockedReasons.join('; ')}`,
        '',
      ].join('\n'),
    );
  }
  process.exitCode = receipt.result === 'S2_HARNESS_DRY_RUN_READY' ? 0 : 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReceipt,
  buildReviewedChildEnv,
  secretLikeChildEnvKeys,
  EXPECTED_BRANCH,
  EXACT_EXTERNAL_ALLOWLIST,
};
