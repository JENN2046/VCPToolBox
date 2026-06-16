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
const TARGET_MANIFEST = path.join(EXTERNAL_PLUGIN_ROOT, 'plugin-manifest.json');
const PRELOAD_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'harness',
  'aigentquality-server-smoke-preload.js',
);
const S2_DRY_RUNNER = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2.js',
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
const S2_DRY_RUN_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_MINIMAL_HARNESS_DRY_RUN_20260616.md',
);
const GUARDED_PLAN_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PLAN_20260616.md',
);
const THIS_SCRIPT = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-guarded-plan.js',
);

const EXPECTED_CORE_BASE = 'd4b3dd2e6c4b7eb4cb8eea73d2b598fc81e9f6c8';
const EXPECTED_EXTERNAL_HEAD = 'beb072b8ad1530dd62c526c71e4cc09930068685';
const TARGET_PLUGIN_NAME = 'JennAIGentQualityTrial';
const TARGET_ENTRYPOINT_TYPE = 'nodejs';
const TARGET_ENTRYPOINT = 'node AIGentQuality.js';
const EXACT_EXTERNAL_ALLOWLIST = `${TARGET_PLUGIN_NAME}@${EXTERNAL_PLUGIN_ROOT}`;
const STATUS_GIT_GLOBAL_ARGS = ['--no-optional-locks'];
const EXPECTED_COMMANDS = Object.freeze([
  'BuildRetryPlan',
  'HealthCheck',
  'InspectBatch',
  'InspectImage',
]);
const REQUIRED_CHILD_ENV_KEYS = Object.freeze([
  'TEMP',
  'TMP',
  'VCP_AIGENTQUALITY_S2_HARNESS_CONFIG',
  'PORT',
  'DebugMode',
  'CHAT_LOG_ENABLED',
  'API_URL',
  'API_Key',
  'Key',
  'Image_Key',
  'File_Key',
  'VCP_Key',
  'AdminUsername',
  'AdminPassword',
  'AGENT_DIR_PATH',
  'TVSTXT_DIR_PATH',
  'KNOWLEDGEBASE_ROOT_PATH',
  'CHANNELHUB_BASE_DIR',
  'ENABLE_AI_IMAGE_AGENTS_ROUTE',
  'ENABLE_AI_IMAGE_REAL_EXECUTION',
  'ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE',
  'VCP_PLUGIN_ALLOWED_ROOTS',
  'VCP_PLUGIN_DIRS',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST',
]);
const OPTIONAL_PLATFORM_CHILD_ENV_KEYS = Object.freeze([
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'PATH',
]);
const SECRET_LIKE_ENV_KEY = /(?:api[_-]?key|token|secret|password|passwd|credential|cookie|session|bearer|authorization|openai|anthropic|gemini|doubao)/i;
const ALLOWED_DEV_DIRTY_PATHS = Object.freeze([
  rel(S2_DRY_RUNNER),
  rel(THIS_SCRIPT),
  rel(path.join(PROJECT_ROOT, 'scripts', 'aigentquality-server-smoke-s2-preload-guards.js')),
  rel(path.join(PROJECT_ROOT, 'scripts', 'aigentquality-server-smoke-s2-guarded-preflight.js')),
  rel(GUARDED_PLAN_DOC),
  rel(path.join(PROJECT_ROOT, 'docs', 'governance', 'P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PREFLIGHT_20260617.md')),
  rel(PRELOAD_FILE),
]);
const IGNORED_RUNTIME_EXCLUDED_PATHS = Object.freeze([
  ':(exclude)node_modules',
  ':(exclude,glob)node_modules/**',
  ':(exclude,glob)**/node_modules',
  ':(exclude,glob)**/node_modules/**',
]);
const SENSITIVE_IGNORED_RUNTIME_PATHS = Object.freeze([
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
  ':/tmp',
  ':/tmp/**',
  ':/VCPTimedContacts',
  ':/VCPTimedContacts/**',
  ':/VCPTimedResults',
  ':/VCPTimedResults/**',
  ':/sarprompt.json',
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
]);

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
  const fallbackError =
    result.status === 0
      ? ''
      : `git exited with status ${result.status}; signal ${result.signal || 'none'}`;

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trimEnd(),
    stderr: stderr || errorMessage || fallbackError,
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

function normalizeStatusPath(statusPath) {
  let normalized = statusPath.trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1);
  }
  return normalized.replace(/\\/g, '/');
}

function statusEntries(statusShort) {
  if (!statusShort) return [];
  return statusShort
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      const payload = line.length > 3 ? line.slice(3) : '';
      const paths = payload.includes(' -> ')
        ? payload.split(' -> ').map(normalizeStatusPath)
        : [normalizeStatusPath(payload)];
      return { line, status, paths };
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

function hasAllMarkers(text, markers) {
  return markers.every((marker) => text.includes(marker));
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

function secretLikeChildEnvKeys(env) {
  return Object.keys(env).filter((key) => SECRET_LIKE_ENV_KEY.test(key));
}

function secretLikeParentEnvKeyCount() {
  return Object.keys(process.env).filter((key) => SECRET_LIKE_ENV_KEY.test(key))
    .length;
}

function sortedStringArray(values) {
  return [...values].sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  );
}

function sameStringArray(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function childEnvKeySetValidation(env) {
  const actualKeys = sortedStringArray(Object.keys(env || {}));
  const actualKeySet = new Set(actualKeys);
  const requiredKeySet = new Set(REQUIRED_CHILD_ENV_KEYS);
  const optionalLowerSet = new Set(
    OPTIONAL_PLATFORM_CHILD_ENV_KEYS.map((key) => key.toLowerCase()),
  );
  const optionalKeysPresent = actualKeys.filter((key) =>
    optionalLowerSet.has(key.toLowerCase()),
  );
  const expectedKeys = sortedStringArray([
    ...REQUIRED_CHILD_ENV_KEYS,
    ...optionalKeysPresent,
  ]);
  const missingRequiredKeys = sortedStringArray(
    REQUIRED_CHILD_ENV_KEYS.filter((key) => !actualKeySet.has(key)),
  );
  const unexpectedKeys = actualKeys.filter(
    (key) =>
      !requiredKeySet.has(key) && !optionalLowerSet.has(key.toLowerCase()),
  );

  return {
    ok:
      missingRequiredKeys.length === 0 &&
      unexpectedKeys.length === 0 &&
      sameStringArray(actualKeys, expectedKeys),
    actualKeys,
    expectedKeys,
    requiredKeys: [...REQUIRED_CHILD_ENV_KEYS],
    optionalPlatformKeys: [...OPTIONAL_PLATFORM_CHILD_ENV_KEYS],
    optionalKeysPresent,
    missingRequiredKeys,
    unexpectedKeys,
  };
}

function comparablePath(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function sameResolvedPath(left, right) {
  const leftPath = comparablePath(left);
  const rightPath = comparablePath(right);
  return Boolean(leftPath && rightPath && leftPath === rightPath);
}

function isPathUnder(childPath, parentPath) {
  if (!childPath || !parentPath) return false;
  const child = path.resolve(childPath);
  const parent = path.resolve(parentPath);
  const relativePath = path.relative(parent, child);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function childHarnessConfigValidation(childEnvPlan, plannedHarnessConfig, runRoot) {
  const envValue =
    childEnvPlan &&
    childEnvPlan.env &&
    childEnvPlan.env.VCP_AIGENTQUALITY_S2_HARNESS_CONFIG;
  const runRootPath =
    childEnvPlan &&
    childEnvPlan.runRootPaths &&
    childEnvPlan.runRootPaths.harnessConfig;
  const envMatchesExpected = sameResolvedPath(envValue, plannedHarnessConfig);
  const runRootPathMatchesExpected = sameResolvedPath(
    runRootPath,
    plannedHarnessConfig,
  );
  const envPathUnderRunRoot = isPathUnder(envValue, runRoot);

  return {
    ok:
      envMatchesExpected && runRootPathMatchesExpected && envPathUnderRunRoot,
    expectedHarnessConfig: plannedHarnessConfig,
    envValue,
    runRootPath,
    envMatchesExpected,
    runRootPathMatchesExpected,
    envPathUnderRunRoot,
  };
}

function buildReceipt() {
  const args = new Set(process.argv.slice(2));
  const jsonMode = args.has('--json');
  const strictClean = args.has('--strict-clean');
  const allowDevDirtyPlan = args.has('--allow-dev-dirty-plan');
  const executeServerRequested = args.has('--execute-server');
  const checks = [];
  const staticBlockedReasons = [];
  const guardedSmokeBlockedReasons = [
    'real guarded server smoke is not authorized by this plan gate',
  ];
  const plannedRunRoot = path.join(
    os.tmpdir(),
    'vcptoolbox-aigentquality-s2-guarded-smoke-PLAN-NOT-CREATED',
  );
  const plannedHarnessConfig = path.join(plannedRunRoot, 'harness-config.json');
  const coreGit = gitState(PROJECT_ROOT);
  const externalGit = gitState(EXTERNAL_PACKAGE_ROOT);
  const coreIgnoredRuntime = ignoredRuntimeState(PROJECT_ROOT);
  const externalIgnoredRuntime = ignoredRuntimeState(EXTERNAL_PACKAGE_ROOT);
  const coreStatusEntries = statusEntries(coreGit.statusShort);
  const externalStatusEntries = statusEntries(externalGit.statusShort);
  const coreIgnoredRuntimeStatusEntries = statusEntries(
    coreIgnoredRuntime.statusShort,
  );
  const externalIgnoredRuntimeStatusEntries = statusEntries(
    externalIgnoredRuntime.statusShort,
  );
  const allowedDirtySet = new Set(
    allowDevDirtyPlan ? ALLOWED_DEV_DIRTY_PATHS : [],
  );
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
  const s2DryRunText = fileExists(S2_DRY_RUN_DOC) ? readText(S2_DRY_RUN_DOC) : '';
  const manifestParse = tryReadJson(TARGET_MANIFEST);
  const manifest = manifestParse.value;
  const commandList = collectCommands(manifest);
  const requireBlockedReasons = [];
  let s2Runner = null;
  let preload = null;
  let childEnvPlan = null;
  let childSecretLikeKeys = [];
  let guardedPlanReceipt = null;
  let guardedPlanValidation = {
    ok: false,
    failures: ['guarded plan preload not loaded'],
  };

  if (!coreGit.statusOk) {
    requireBlockedReasons.push(`core git status failed: ${coreGit.statusError}`);
  }
  if (disallowedCoreStatusEntries.length > 0) {
    requireBlockedReasons.push(
      `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
        .map((entry) => entry.line)
        .join('; ')}`,
    );
  }

  if (requireBlockedReasons.length === 0) {
    try {
      s2Runner = require(S2_DRY_RUNNER);
      preload = require(PRELOAD_FILE);
      childEnvPlan = s2Runner.buildReviewedChildEnv(plannedRunRoot);
      childSecretLikeKeys = s2Runner.secretLikeChildEnvKeys
        ? s2Runner.secretLikeChildEnvKeys(childEnvPlan.env)
        : secretLikeChildEnvKeys(childEnvPlan.env);
      guardedPlanReceipt = preload.buildGuardedSmokePlanReceipt({
        projectRoot: PROJECT_ROOT,
        externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
        runRoot: plannedRunRoot,
        harnessConfigPath: plannedHarnessConfig,
      });
      guardedPlanValidation =
        preload.validateGuardedSmokePlanReceipt(guardedPlanReceipt);
    } catch (error) {
      guardedPlanValidation = {
        ok: false,
        failures: [error.message],
      };
    }
  } else {
    guardedPlanValidation = {
      ok: false,
      failures: [
        'guarded plan preload require skipped until core worktree dirty policy passes',
        ...requireBlockedReasons,
      ],
    };
  }
  const childEnvKeySet = childEnvKeySetValidation(
    childEnvPlan ? childEnvPlan.env : {},
  );
  const childHarnessConfig = childHarnessConfigValidation(
    childEnvPlan,
    plannedHarnessConfig,
    plannedRunRoot,
  );

  const s1Markers = [
    'S2 authorized: no',
    'load harness config from VCP_AIGENTQUALITY_S2_HARNESS_CONFIG',
    'install repository read guard before server.js loads',
    'directory read guard installed before startup modules loaded: yes',
    'ToolApprovalManager stub receipt: yes',
    'SemanticModelRouter stub receipt: yes',
    'adminPanelRoutes stub receipt: yes',
    'codexOAuthResponses stub receipt: yes',
    'taskScheduler real initialize: no',
    'WebSocketServer post-listen interception receipt: yes',
    'FileFetcherServer post-listen interception receipt: yes',
    'processToolCall invoked: no',
    'executePlugin invoked: no',
  ];
  const s2DryRunMarkers = [
    'realServerStartAuthorized: false',
    'harness files clean by default: true',
    'A real listen smoke remains a later explicit authorization boundary.',
  ];

  addCheck(checks, 'core git status read', coreGit.statusOk, coreGit.statusError || 'ok');
  addCheck(checks, 'core contains guarded-smoke base', coreContainsExpectedBase, EXPECTED_CORE_BASE);
  addCheck(checks, 'external git status read', externalGit.statusOk, externalGit.statusError || 'ok');
  addCheck(checks, 'external head matches reviewed AIGentQuality package', externalGit.head === EXPECTED_EXTERNAL_HEAD, externalGit.head);
  addCheck(checks, 'S0 evidence exists', fileExists(S0_DOC), rel(S0_DOC));
  addCheck(checks, 'S1 harness design exists', fileExists(S1_DOC), rel(S1_DOC));
  addCheck(checks, 'S1 still names guarded smoke blockers and receipts', hasAllMarkers(s1Text, s1Markers), s1Markers);
  addCheck(checks, 'S2 minimal dry-run doc exists', fileExists(S2_DRY_RUN_DOC), rel(S2_DRY_RUN_DOC));
  addCheck(checks, 'S2 minimal dry-run still forbids real start', hasAllMarkers(s2DryRunText, s2DryRunMarkers), s2DryRunMarkers);
  addCheck(checks, 'guarded plan doc exists', fileExists(GUARDED_PLAN_DOC), rel(GUARDED_PLAN_DOC));
  addCheck(checks, 'target external manifest exists', fileExists(TARGET_MANIFEST), TARGET_MANIFEST);
  addCheck(checks, 'target external manifest parses', Boolean(manifest) && !manifestParse.error, manifestParse.error || 'ok');
  addCheck(checks, 'manifest name matches target', manifest && manifest.name === TARGET_PLUGIN_NAME, manifest && manifest.name);
  addCheck(checks, 'manifest type is synchronous', manifest && manifest.pluginType === 'synchronous', manifest && manifest.pluginType);
  addCheck(checks, 'manifest entry point type is nodejs', manifest && manifest.entryPoint && manifest.entryPoint.type === TARGET_ENTRYPOINT_TYPE, manifest && manifest.entryPoint);
  addCheck(checks, 'manifest entry point command matches target', manifest && manifest.entryPoint && manifest.entryPoint.command === TARGET_ENTRYPOINT, manifest && manifest.entryPoint);
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
  addCheck(checks, 'child env builder loaded from reviewed dry-run runner', Boolean(childEnvPlan), rel(S2_DRY_RUNNER));
  addCheck(checks, 'child env external allowlist matches target', s2Runner && s2Runner.EXACT_EXTERNAL_ALLOWLIST === EXACT_EXTERNAL_ALLOWLIST, s2Runner && s2Runner.EXACT_EXTERNAL_ALLOWLIST);
  addCheck(checks, 'child env exact key set matches reviewed allowlist', childEnvKeySet.ok, childEnvKeySet);
  addCheck(checks, 'child harness config env value matches reviewed plan', childHarnessConfig.ok, childHarnessConfig);
  addCheck(checks, 'child env excludes extra secret-like keys', childSecretLikeKeys.length === 0, childSecretLikeKeys);
  addCheck(checks, 'guarded smoke plan validates', guardedPlanValidation.ok, guardedPlanValidation.failures);
  addCheck(checks, 'guarded smoke plan remains plan-only', guardedPlanReceipt && guardedPlanReceipt.guardInstallImplemented === false, guardedPlanReceipt && guardedPlanReceipt.guardInstallImplemented);
  addCheck(checks, 'real server execution not requested', !executeServerRequested, '--execute-server');

  if (!coreGit.statusOk) {
    staticBlockedReasons.push(`core git status failed: ${coreGit.statusError}`);
    guardedSmokeBlockedReasons.push('core git status failed');
  }
  if (!externalGit.statusOk) {
    staticBlockedReasons.push(
      `external git status failed: ${externalGit.statusError}`,
    );
    guardedSmokeBlockedReasons.push('external git status failed');
  }
  if (disallowedCoreStatusEntries.length > 0) {
    staticBlockedReasons.push(
      `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
        .map((entry) => entry.line)
        .join('; ')}`,
    );
  }
  if (externalStatusEntries.length > 0) {
    staticBlockedReasons.push('external package worktree is dirty');
    guardedSmokeBlockedReasons.push('external package worktree must be clean');
  }
  if (!coreIgnoredRuntime.ok) {
    staticBlockedReasons.push(
      `core ignored runtime inventory failed: ${coreIgnoredRuntime.error}`,
    );
    guardedSmokeBlockedReasons.push('core ignored runtime inventory failed');
  } else if (coreIgnoredRuntimeStatusEntries.length > 0) {
    guardedSmokeBlockedReasons.push(
      'core worktree has sensitive ignored runtime artifacts',
    );
    if (strictClean) {
      staticBlockedReasons.push(
        `core worktree has sensitive ignored runtime artifacts: ${coreIgnoredRuntimeStatusEntries
          .map((entry) => entry.line)
          .join('; ')}`,
      );
    }
  }
  if (!externalIgnoredRuntime.ok) {
    staticBlockedReasons.push(
      `external ignored runtime inventory failed: ${externalIgnoredRuntime.error}`,
    );
    guardedSmokeBlockedReasons.push(
      'external ignored runtime inventory failed',
    );
  } else if (externalIgnoredRuntimeStatusEntries.length > 0) {
    guardedSmokeBlockedReasons.push(
      'external package has sensitive ignored runtime artifacts',
    );
    if (strictClean) {
      staticBlockedReasons.push(
        `external package has sensitive ignored runtime artifacts: ${externalIgnoredRuntimeStatusEntries
          .map((entry) => entry.line)
          .join('; ')}`,
      );
    }
  }
  if (coreGit.statusOk && coreGit.statusShort) {
    guardedSmokeBlockedReasons.push('core worktree must be fully clean');
  }
  if (guardedPlanReceipt && guardedPlanReceipt.guardInstallImplemented === false) {
    guardedSmokeBlockedReasons.push(
      'preload guards are still a reviewed plan, not installed hooks',
    );
  }
  if (executeServerRequested) {
    staticBlockedReasons.push(
      '--execute-server is outside this guarded plan gate',
    );
  }
  for (const check of checks) {
    if (!check.ok) staticBlockedReasons.push(check.name);
  }

  const planPass = staticBlockedReasons.length === 0;
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'aigentquality-s2-guarded-smoke-plan',
    authorization: {
      planAuthorized: true,
      realServerStartAuthorized: false,
      executeServerRequested,
      strictClean,
      allowDevDirtyPlan,
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
      targetManifest: TARGET_MANIFEST,
      parentRunner: rel(THIS_SCRIPT),
      existingDryRunRunner: rel(S2_DRY_RUNNER),
      preload: rel(PRELOAD_FILE),
      guardedPlanDoc: rel(GUARDED_PLAN_DOC),
      plannedRunRoot,
      plannedHarnessConfig,
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
        statusEntries: coreStatusEntries,
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
        statusEntries: externalStatusEntries,
        ignoredRuntimeStatusShort: externalIgnoredRuntime.statusShort || '',
        ignoredRuntimeStatusEntries: externalIgnoredRuntimeStatusEntries,
        ignoredRuntimeInventoryError: externalIgnoredRuntime.error || '',
      },
    },
    dirtyWorktreePolicy: {
      statusGitGlobalArgs: STATUS_GIT_GLOBAL_ARGS,
      statusUntrackedMode: 'all',
      strictClean,
      allowDevDirtyPlan,
      reviewEvidenceUsable: !allowDevDirtyPlan && planPass,
      planFilesMustBeCleanByDefault: true,
      allowedDirtyPaths: [...allowedDirtySet],
      ignoredRuntimeArtifactsBlockPlanOnlyUnderStrictClean: true,
      sensitiveIgnoredRuntimePathspecs: SENSITIVE_IGNORED_RUNTIME_PATHS,
      ignoredRuntimeExcludedPathspecs: IGNORED_RUNTIME_EXCLUDED_PATHS,
    },
    childEnvPlan: childEnvPlan
      ? {
          builtWithoutSpreadingProcessEnv: true,
          keySet: childEnvKeySet.actualKeys,
          expectedKeySet: childEnvKeySet.expectedKeys,
          requiredKeySet: childEnvKeySet.requiredKeys,
          optionalPlatformKeySet: childEnvKeySet.optionalPlatformKeys,
          optionalPlatformKeysPresent: childEnvKeySet.optionalKeysPresent,
          missingRequiredKeys: childEnvKeySet.missingRequiredKeys,
          unexpectedKeys: childEnvKeySet.unexpectedKeys,
          exactKeySetMatches: childEnvKeySet.ok,
          harnessConfig: childHarnessConfig,
          secretLikeParentEnvKeyCount: secretLikeParentEnvKeyCount(),
          secretLikeChildEnvKeys: childSecretLikeKeys,
          valuesRedacted: true,
        }
      : null,
    manifest: {
      parsed: Boolean(manifest),
      parseError: manifestParse.error,
      name: manifest && manifest.name,
      pluginType: manifest && manifest.pluginType,
      entryPoint: manifest && manifest.entryPoint,
      communication: manifest && manifest.communication,
      commands: commandList,
    },
    guardedPlanReceipt,
    guardedPlanValidation,
    requirePolicy: {
      requireAllowed: requireBlockedReasons.length === 0,
      requireBlockedReasons,
      requiredBeforeRequire: [
        'core git status read',
        'core worktree dirty policy passes',
      ],
    },
    guardedSmokeReadiness: {
      ready: false,
      reason: 'this gate is a plan/preflight only; real guarded smoke still needs explicit authorization and installed guards',
      blockedReasons: guardedSmokeBlockedReasons,
    },
    checks,
    staticBlockedReasons,
    result: planPass
      ? 'S2_GUARDED_SMOKE_PLAN_READY'
      : 'S2_GUARDED_SMOKE_PLAN_BLOCKED',
    note:
      'This guarded plan does not import, spawn, or execute server.js. It only validates the reviewed guard/stub receipt shape for a future authorized S2 server smoke.',
  };

  return { receipt, jsonMode };
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
        `staticBlocked: ${
          receipt.staticBlockedReasons.length
            ? receipt.staticBlockedReasons.join('; ')
            : 'none'
        }`,
        `guardedSmokeReady: ${receipt.guardedSmokeReadiness.ready}`,
        '',
      ].join('\n'),
    );
  }
  process.exitCode =
    receipt.result === 'S2_GUARDED_SMOKE_PLAN_READY' ? 0 : 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReceipt,
  SENSITIVE_IGNORED_RUNTIME_PATHS,
  IGNORED_RUNTIME_EXCLUDED_PATHS,
};
