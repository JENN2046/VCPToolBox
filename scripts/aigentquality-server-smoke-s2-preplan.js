#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(
  PROJECT_ROOT,
  '..',
  'VCPToolBox-JENN-Extensions',
);
const TARGET_PLUGIN_ROOT = path.join(
  EXTERNAL_PACKAGE_ROOT,
  'Plugin',
  'JennAIGentQualityTrial',
);
const TARGET_MANIFEST = path.join(TARGET_PLUGIN_ROOT, 'plugin-manifest.json');
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
const FUTURE_PARENT_RUNNER = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2.js',
);
const FUTURE_PRELOAD = path.join(
  PROJECT_ROOT,
  'tests',
  'harness',
  'aigentquality-server-smoke-preload.js',
);
const S2_PREPLAN_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_DRY_RUN_HARNESS_PREPLAN_20260615.md',
);
const S2_PREPLAN_SCRIPT = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-preplan.js',
);

const EXPECTED_CORE_BASE = '7b283ca704c541ba69270a9e86b2cd8606a71aaf';
const EXPECTED_EXTERNAL_HEAD = 'beb072b8ad1530dd62c526c71e4cc09930068685';
const EXPECTED_COMMANDS = [
  'InspectImage',
  'InspectBatch',
  'BuildRetryPlan',
  'HealthCheck',
];
const SENSITIVE_IGNORED_RUNTIME_PATHS = [
  ':/config.env',
  ':/config.env.local',
  ':(glob)**/config.env',
  ':/ModelRedirect.json',
  ':/agent_map.json',
  ':/preprocessor_order.json',
  ':/tag-processor-config.env',
  ':/SemanticModelRouter.local.json',
  ':/state',
  ':/DebugLog',
  ':/ip_blacklist.json',
  ':/VectorStore',
  ':/Plugin/EmojiListGenerator/generated_lists',
  ':(glob)Plugin/**/state',
  ':(glob)Plugin/**/*.sqlite',
  ':(glob)Plugin/**/*.sqlite-shm',
  ':(glob)Plugin/**/*.sqlite-wal',
  ':(glob)Plugin/**/*.db',
  ':/Plugin/OneRing/data',
  ':/Plugin/ProjectAnalyst/database',
  ':/ToolConfigs/dynamic_tool_catalog.json',
  ':/ToolConfigs/dynamic_tool_categories.json',
];

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const strictClean = args.has('--strict-clean');

function rel(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/');
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

function runGit(cwd, gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    timeout: 15000,
    windowsHide: true,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trimEnd(),
    stderr: (result.stderr || '').trimEnd(),
  };
}

function gitValue(cwd, gitArgs) {
  const result = runGit(cwd, gitArgs);
  return result.ok ? result.stdout : null;
}

function gitState(cwd) {
  return {
    branch: gitValue(cwd, ['branch', '--show-current']),
    head: gitValue(cwd, ['rev-parse', 'HEAD']),
    statusShort: gitValue(cwd, ['status', '--short']),
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
  if (!statusShort) {
    return [];
  }

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

function hasAllMarkers(text, markers) {
  return markers.every((marker) => text.includes(marker));
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

function addCheck(checks, name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

const checks = [];
const staticBlockedReasons = [];
const realS2BlockedReasons = [];
const defaultAllowedDirtyPaths = new Set([
  rel(S2_PREPLAN_DOC),
  rel(S2_PREPLAN_SCRIPT),
]);

const coreGit = gitState(PROJECT_ROOT);
const coreIgnoredRuntime = ignoredRuntimeState(PROJECT_ROOT);
const coreContainsExpectedBase = runGit(PROJECT_ROOT, [
  'merge-base',
  '--is-ancestor',
  EXPECTED_CORE_BASE,
  'HEAD',
]).ok;
const externalGit = fileExists(TARGET_MANIFEST)
  ? gitState(EXTERNAL_PACKAGE_ROOT)
  : { branch: null, head: null, statusShort: null };

const s0Exists = fileExists(S0_DOC);
const s1Exists = fileExists(S1_DOC);
const s0Text = s0Exists ? readText(S0_DOC) : '';
const s1Text = s1Exists ? readText(S1_DOC) : '';

const s0Markers = [
  'Status: S0 evidence only.',
  'Not allowed in this gate:',
  '`node server.js`;',
  'importing `server.js`, because it calls `startServer()` at module top level;',
];
const s1Markers = [
  'Status: S1 design only.',
  'S2 authorized: no',
  'server started: no',
  'tests/harness/aigentquality-server-smoke-preload.js',
  'scripts/aigentquality-server-smoke-s2.js',
  'ToolApprovalManager stub receipt: yes',
  'SemanticModelRouter stub receipt: yes',
  'adminPanelRoutes stub receipt: yes',
  'codexOAuthResponses stub receipt: yes',
  'fs.readdir / readdirSync',
  'fs.promises.readdir',
  'WebSocketServer post-listen interception receipt: yes',
  'FileFetcherServer post-listen interception receipt: yes',
];

let manifest = null;
let manifestError = null;
if (fileExists(TARGET_MANIFEST)) {
  try {
    manifest = JSON.parse(readText(TARGET_MANIFEST));
  } catch (error) {
    manifestError = error.message;
  }
}

const commandList = collectCommands(manifest);
const expectedCommandList = [...EXPECTED_COMMANDS].sort();
const manifestChecks = {
  name: manifest && manifest.name === 'JennAIGentQualityTrial',
  pluginType: manifest && manifest.pluginType === 'synchronous',
  entryPointType:
    manifest && manifest.entryPoint && manifest.entryPoint.type === 'nodejs',
  entryPointCommand:
    manifest &&
    manifest.entryPoint &&
    manifest.entryPoint.command === 'node AIGentQuality.js',
  protocol:
    manifest &&
    manifest.communication &&
    manifest.communication.protocol === 'stdio',
  externalVisionDefault:
    manifest &&
    manifest.configSchema &&
    manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION &&
    manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION.default === false,
  commands:
    JSON.stringify(commandList) === JSON.stringify(expectedCommandList),
};
const manifestCheckDetails = {
  name: manifest && manifest.name,
  pluginType: manifest && manifest.pluginType,
  entryPointType: manifest && manifest.entryPoint && manifest.entryPoint.type,
  entryPointCommand:
    manifest && manifest.entryPoint && manifest.entryPoint.command,
  protocol:
    manifest && manifest.communication && manifest.communication.protocol,
  externalVisionDefault:
    manifest &&
    manifest.configSchema &&
    manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION &&
    manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION.default,
  commands: commandList,
};

const futureParentRunnerExists = fileExists(FUTURE_PARENT_RUNNER);
const futurePreloadExists = fileExists(FUTURE_PRELOAD);
const coreStatusEntries = statusEntries(coreGit.statusShort);
const disallowedCoreStatusEntries = coreStatusEntries.filter((entry) =>
  entry.paths.some((statusPath) => !defaultAllowedDirtyPaths.has(statusPath)),
);
const ignoredRuntimeStatusEntries = statusEntries(
  coreIgnoredRuntime.statusShort,
);

addCheck(checks, 'core git head observed', Boolean(coreGit.head), coreGit.head);
addCheck(
  checks,
  'core branch is S2 dry-run branch',
  coreGit.branch === 'codex/aigentquality-s2-server-smoke-dry-run',
  coreGit.branch,
);
addCheck(
  checks,
  'core branch contains expected base main',
  coreContainsExpectedBase,
  { expectedBase: EXPECTED_CORE_BASE, currentHead: coreGit.head },
);
addCheck(
  checks,
  'external package head observed',
  externalGit.head === EXPECTED_EXTERNAL_HEAD,
  externalGit.head,
);
addCheck(checks, 'S0 evidence doc exists', s0Exists, rel(S0_DOC));
addCheck(checks, 'S1 harness design doc exists', s1Exists, rel(S1_DOC));
addCheck(
  checks,
  'S2 preplan doc exists',
  fileExists(S2_PREPLAN_DOC),
  rel(S2_PREPLAN_DOC),
);
addCheck(
  checks,
  'S2 preplan script exists',
  fileExists(S2_PREPLAN_SCRIPT),
  rel(S2_PREPLAN_SCRIPT),
);
addCheck(
  checks,
  'S0 doc still forbids server activation',
  s0Exists && hasAllMarkers(s0Text, s0Markers),
  s0Markers,
);
addCheck(
  checks,
  'S1 doc still forbids S2 and names required guards',
  s1Exists && hasAllMarkers(s1Text, s1Markers),
  s1Markers,
);
addCheck(
  checks,
  'target external manifest exists',
  fileExists(TARGET_MANIFEST),
  TARGET_MANIFEST,
);
addCheck(
  checks,
  'target external manifest parses',
  Boolean(manifest) && !manifestError,
  manifestError,
);

for (const [name, ok] of Object.entries(manifestChecks)) {
  addCheck(checks, `manifest ${name}`, ok, manifestCheckDetails[name]);
}

addCheck(
  checks,
  'future S2 parent runner not created in preplan gate',
  !futureParentRunnerExists,
  rel(FUTURE_PARENT_RUNNER),
);
addCheck(
  checks,
  'future S2 preload not created in preplan gate',
  !futurePreloadExists,
  rel(FUTURE_PRELOAD),
);

if (strictClean && coreGit.statusShort) {
  staticBlockedReasons.push('core worktree is dirty under --strict-clean');
}

if (disallowedCoreStatusEntries.length > 0) {
  staticBlockedReasons.push(
    `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
      .map((entry) => entry.line)
      .join('; ')}`,
  );
}

if (!coreIgnoredRuntime.ok) {
  staticBlockedReasons.push(
    `sensitive ignored runtime inventory failed: ${coreIgnoredRuntime.error}`,
  );
  realS2BlockedReasons.push('sensitive ignored runtime inventory failed');
} else if (ignoredRuntimeStatusEntries.length > 0) {
  staticBlockedReasons.push(
    `core worktree has sensitive ignored runtime artifacts: ${ignoredRuntimeStatusEntries
      .map((entry) => entry.line)
      .join('; ')}`,
  );
  realS2BlockedReasons.push(
    'core worktree has sensitive ignored runtime artifacts',
  );
}

if (coreGit.statusShort) {
  realS2BlockedReasons.push('core worktree must be clean before real S2');
}

if (externalGit.statusShort) {
  staticBlockedReasons.push('external package worktree is dirty');
  realS2BlockedReasons.push('external package worktree must be clean before real S2');
}

for (const check of checks) {
  if (!check.ok) {
    staticBlockedReasons.push(check.name);
    realS2BlockedReasons.push(check.name);
  }
}

const criticalPass =
  checks.every((check) => check.ok) && staticBlockedReasons.length === 0;

const receipt = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: 's2-preplan-static-only',
  authorization: {
    s2Authorized: false,
    realServerStartAuthorized: false,
  },
  safetyAssertions: {
    startedServer: false,
    importedServer: false,
    spawnedServer: false,
    boundPort: false,
    executedPlugin: false,
    wroteFiles: false,
    networkOrProviderCalls: false,
  },
  paths: {
    projectRoot: PROJECT_ROOT,
    externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
    targetManifest: TARGET_MANIFEST,
    s0Doc: rel(S0_DOC),
    s1Doc: rel(S1_DOC),
    s2PreplanDoc: rel(S2_PREPLAN_DOC),
    s2PreplanScript: rel(S2_PREPLAN_SCRIPT),
    futureParentRunner: rel(FUTURE_PARENT_RUNNER),
    futurePreload: rel(FUTURE_PRELOAD),
  },
  expected: {
    coreBaseMain: EXPECTED_CORE_BASE,
    externalHead: EXPECTED_EXTERNAL_HEAD,
    commands: EXPECTED_COMMANDS,
  },
  git: {
    core: {
      branch: coreGit.branch,
      head: coreGit.head,
      worktreeClean: !coreGit.statusShort,
      statusShort: coreGit.statusShort || '',
    },
    external: {
      branch: externalGit.branch,
      head: externalGit.head,
      worktreeClean: !externalGit.statusShort,
      statusShort: externalGit.statusShort || '',
    },
  },
  dirtyWorktreePolicy: {
    strictClean,
    defaultAllowedCoreDirtyPaths: [...defaultAllowedDirtyPaths],
    coreStatusEntries,
    disallowedCoreStatusEntries,
    sensitiveIgnoredRuntimePathspecs: SENSITIVE_IGNORED_RUNTIME_PATHS,
    ignoredRuntimeStatusShort: coreIgnoredRuntime.statusShort || '',
    ignoredRuntimeStatusEntries,
    ignoredRuntimeInventoryError: coreIgnoredRuntime.error || '',
  },
  manifest: {
    path: TARGET_MANIFEST,
    parsed: Boolean(manifest) && !manifestError,
    parseError: manifestError,
    name: manifest && manifest.name,
    pluginType: manifest && manifest.pluginType,
    entryPoint: manifest && manifest.entryPoint,
    communication: manifest && manifest.communication,
    externalVisionDefault:
      manifest &&
      manifest.configSchema &&
      manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION &&
      manifest.configSchema.AIGENT_QUALITY_EXTERNAL_VISION.default,
    commands: commandList,
  },
  futureArtifacts: {
    parentRunnerExists: futureParentRunnerExists,
    preloadExists: futurePreloadExists,
  },
  checks,
  staticBlockedReasons,
  realS2BlockedReasons,
  result: criticalPass
    ? 'PREPLAN_STATIC_READY'
    : 'PREPLAN_STATIC_BLOCKED',
  note:
    'This script is read-only and does not import, spawn, or execute server.js or JennAIGentQualityTrial.',
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
} else {
  process.stdout.write(
    [
      `mode: ${receipt.mode}`,
      `result: ${receipt.result}`,
      `core: ${coreGit.branch}@${coreGit.head}`,
      `external: ${externalGit.branch}@${externalGit.head}`,
      `startedServer: ${receipt.safetyAssertions.startedServer}`,
      `importedServer: ${receipt.safetyAssertions.importedServer}`,
      `spawnedServer: ${receipt.safetyAssertions.spawnedServer}`,
      `executedPlugin: ${receipt.safetyAssertions.executedPlugin}`,
      `checks: ${checks.filter((check) => check.ok).length}/${checks.length}`,
      `staticBlocked: ${
        staticBlockedReasons.length ? staticBlockedReasons.join('; ') : 'none'
      }`,
      `realS2Blocked: ${
        realS2BlockedReasons.length
          ? realS2BlockedReasons.join('; ')
          : 'none'
      }`,
      '',
    ].join('\n'),
  );
}

process.exitCode = criticalPass ? 0 : 1;
