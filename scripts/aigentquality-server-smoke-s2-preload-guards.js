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
const PRELOAD_FILE = path.join(
  PROJECT_ROOT,
  'tests',
  'harness',
  'aigentquality-server-smoke-preload.js',
);
const GUARD_PLAN_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_PRELOAD_GUARDS_MINIMAL_20260616.md',
);
const THIS_SCRIPT = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-preload-guards.js',
);

const EXPECTED_CORE_BASE = '978fe3c505862ccf358b134d219d07e7bff58b7d';
const EXPECTED_EXTERNAL_HEAD = 'beb072b8ad1530dd62c526c71e4cc09930068685';
const STATUS_GIT_GLOBAL_ARGS = ['--no-optional-locks'];
const DEVELOPMENT_ALLOWED_DIRTY_PATHS = Object.freeze([
  rel(THIS_SCRIPT),
  rel(PRELOAD_FILE),
  rel(GUARD_PLAN_DOC),
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

function addCheck(checks, name, ok, details = null) {
  checks.push({ name, ok: Boolean(ok), details });
}

function probeBlockedEventApiNames(probeReceipt) {
  const events =
    probeReceipt &&
    probeReceipt.installReceiptAfterProbe &&
    Array.isArray(probeReceipt.installReceiptAfterProbe.blockedEvents)
      ? probeReceipt.installReceiptAfterProbe.blockedEvents
      : [];
  return events.map((event) => event.apiName);
}

function probeBlockedEvents(probeReceipt) {
  return probeReceipt &&
    probeReceipt.installReceiptAfterProbe &&
    Array.isArray(probeReceipt.installReceiptAfterProbe.blockedEvents)
    ? probeReceipt.installReceiptAfterProbe.blockedEvents
    : [];
}

function probeBlockedListenEvents(probeReceipt) {
  return probeBlockedEvents(probeReceipt).filter(
    (event) => event.apiName === 'http.Server.listen',
  );
}

async function buildReceipt() {
  const args = new Set(process.argv.slice(2));
  const jsonMode = args.has('--json');
  const allowDevDirtyGuards = args.has('--allow-dev-dirty-guards');
  const executeServerRequested = args.has('--execute-server');
  const checks = [];
  const blockedReasons = [];
  const plannedRunRoot = path.join(
    os.tmpdir(),
    'vcptoolbox-aigentquality-s2-preload-guards-PROBE-NOT-CREATED',
  );
  const plannedHarnessConfig = path.join(plannedRunRoot, 'harness-config.json');
  const coreGit = gitState(PROJECT_ROOT);
  const externalGit = gitState(EXTERNAL_PACKAGE_ROOT);
  const coreStatusEntries = statusEntries(coreGit.statusShort);
  const allowedDirtySet = new Set(
    allowDevDirtyGuards ? DEVELOPMENT_ALLOWED_DIRTY_PATHS : [],
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
  const requireBlockedReasons = [];
  let probeReceipt = null;
  let probeError = '';

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
      const preload = require(PRELOAD_FILE);
      probeReceipt = await preload.runPreloadGuardSyntheticProbe({
        projectRoot: PROJECT_ROOT,
        externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
        runRoot: plannedRunRoot,
        harnessConfigPath: plannedHarnessConfig,
        allowedReadRoots: [],
        allowedReadFiles: [],
      });
    } catch (error) {
      probeError = error && error.message ? error.message : String(error);
    }
  }

  const blockedEventApiNames = probeBlockedEventApiNames(probeReceipt);
  const blockedEvents = probeBlockedEvents(probeReceipt);
  const blockedListenEvents = probeBlockedListenEvents(probeReceipt);

  addCheck(checks, 'core git status read', coreGit.statusOk, coreGit.statusError || 'ok');
  addCheck(checks, 'core contains preload guard base', coreContainsExpectedBase, EXPECTED_CORE_BASE);
  addCheck(checks, 'external package git status read', externalGit.statusOk, externalGit.statusError || 'ok');
  addCheck(checks, 'external package head matches reviewed head', externalGit.head === EXPECTED_EXTERNAL_HEAD, externalGit.head);
  addCheck(checks, 'preload file exists', fileExists(PRELOAD_FILE), rel(PRELOAD_FILE));
  addCheck(checks, 'guard plan doc exists', fileExists(GUARD_PLAN_DOC), rel(GUARD_PLAN_DOC));
  addCheck(checks, 'preload require allowed', requireBlockedReasons.length === 0, requireBlockedReasons);
  addCheck(checks, 'synthetic guard probe runs', Boolean(probeReceipt) && !probeError, probeError);
  addCheck(checks, 'synthetic guard probe passes', probeReceipt && probeReceipt.result === 'PRELOAD_GUARD_PROBE_READY', probeReceipt && probeReceipt.result);
  addCheck(
    checks,
    'copy write destination guard observed',
    blockedEventApiNames.includes('fs.promises.copyFile:to'),
    blockedEventApiNames,
  );
  addCheck(
    checks,
    'runRoot symlink read escape guard observed',
    blockedEvents.some(
      (event) =>
        event.apiName === 'fs.readFileSync' &&
        event.reason === 'runRoot read target resolves outside allowed root',
    ),
    blockedEvents,
  );
  addCheck(
    checks,
    'symlink creation guard observed',
    blockedEventApiNames.includes('fs.symlinkSync') &&
      blockedEventApiNames.includes('fs.promises.symlink'),
    blockedEventApiNames,
  );
  addCheck(
    checks,
    'explicit localhost listen overload guards observed',
    [
      'listen host argument is not explicit',
      'listen host argument is not localhost',
      'listen options must specify TCP port and localhost host',
      'listen options host is not localhost',
      'listen options port is not explicit',
    ].every((reason) =>
      blockedListenEvents.some((event) => event.reason === reason),
    ),
    blockedListenEvents,
  );
  addCheck(checks, 'real server execution not requested', !executeServerRequested, '--execute-server');

  if (!coreGit.statusOk) {
    blockedReasons.push(`core git status failed: ${coreGit.statusError}`);
  }
  if (!externalGit.statusOk) {
    blockedReasons.push(`external git status failed: ${externalGit.statusError}`);
  }
  if (disallowedCoreStatusEntries.length > 0) {
    blockedReasons.push(
      `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
        .map((entry) => entry.line)
        .join('; ')}`,
    );
  }
  if (externalGit.statusOk && externalGit.statusShort) {
    blockedReasons.push('external package worktree is dirty');
  }
  if (executeServerRequested) {
    blockedReasons.push('--execute-server is outside this preload guard probe');
  }
  for (const check of checks) {
    if (!check.ok) blockedReasons.push(check.name);
  }

  const pass = blockedReasons.length === 0;
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'aigentquality-s2-preload-guard-probe',
    authorization: {
      preloadGuardProbeAuthorized: true,
      realServerStartAuthorized: false,
      executeServerRequested,
      allowDevDirtyGuards,
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
      parentRunner: rel(THIS_SCRIPT),
      preload: rel(PRELOAD_FILE),
      guardPlanDoc: rel(GUARD_PLAN_DOC),
      plannedRunRoot,
      plannedHarnessConfig,
    },
    expected: {
      coreBase: EXPECTED_CORE_BASE,
      externalHead: EXPECTED_EXTERNAL_HEAD,
    },
    git: {
      core: {
        branch: coreGit.branch,
        head: coreGit.head,
        statusOk: coreGit.statusOk,
        statusError: coreGit.statusError,
        statusShort: coreGit.statusShort || '',
        disallowedCoreStatusEntries,
      },
      external: {
        branch: externalGit.branch,
        head: externalGit.head,
        statusOk: externalGit.statusOk,
        statusError: externalGit.statusError,
        statusShort: externalGit.statusShort || '',
      },
    },
    dirtyWorktreePolicy: {
      statusGitGlobalArgs: STATUS_GIT_GLOBAL_ARGS,
      statusUntrackedMode: 'all',
      allowDevDirtyGuards,
      reviewEvidenceUsable: !allowDevDirtyGuards && pass,
      allowedDirtyPaths: [...allowedDirtySet],
      guardFilesMustBeCleanByDefault: true,
    },
    probeReceipt,
    probeError,
    checks,
    blockedReasons,
    result: pass
      ? 'S2_PRELOAD_GUARD_PROBE_READY'
      : 'S2_PRELOAD_GUARD_PROBE_BLOCKED',
    note:
      'This probe installs and uninstalls preload guard primitives in the current process only. It does not import, spawn, or execute server.js.',
  };

  return { receipt, jsonMode };
}

async function main() {
  const { receipt, jsonMode } = await buildReceipt();
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    process.stdout.write(
      [
        `mode: ${receipt.mode}`,
        `result: ${receipt.result}`,
        `checks: ${receipt.checks.filter((check) => check.ok).length}/${receipt.checks.length}`,
        `startedServer: ${receipt.safetyAssertions.startedServer}`,
        `importedServer: ${receipt.safetyAssertions.importedServer}`,
        `spawnedServer: ${receipt.safetyAssertions.spawnedServer}`,
        `blocked: ${
          receipt.blockedReasons.length
            ? receipt.blockedReasons.join('; ')
            : 'none'
        }`,
        '',
      ].join('\n'),
    );
  }
  process.exitCode =
    receipt.result === 'S2_PRELOAD_GUARD_PROBE_READY' ? 0 : 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildReceipt,
};
