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
const THIS_SCRIPT = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-guarded-preflight.js',
);
const PREFLIGHT_DOC = path.join(
  PROJECT_ROOT,
  'docs',
  'governance',
  'P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PREFLIGHT_20260617.md',
);
const S2_DRY_RUNNER = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2.js',
);
const GUARDED_PLAN_RUNNER = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-guarded-plan.js',
);
const PRELOAD_GUARDS_RUNNER = path.join(
  PROJECT_ROOT,
  'scripts',
  'aigentquality-server-smoke-s2-preload-guards.js',
);

const EXPECTED_CORE_BASE = '8885e665a96485c653d8afe4a4c23abe87654959';
const EXPECTED_EXTERNAL_HEAD = 'beb072b8ad1530dd62c526c71e4cc09930068685';
const STATUS_GIT_GLOBAL_ARGS = Object.freeze(['--no-optional-locks']);
const REQUIRED_FALSE_SAFETY_ASSERTIONS = Object.freeze([
  'startedServer',
  'importedServer',
  'spawnedServer',
  'boundPort',
  'executedPlugin',
  'wroteRuntimeFiles',
  'networkOrProviderCalls',
]);
const KNOWN_ARGS = Object.freeze([
  '--json',
  '--strict-clean',
  '--allow-dev-dirty-preflight',
  '--execute-server',
  '--start-server',
  '--import-server',
  '--spawn-server',
]);
const FORBIDDEN_EXECUTION_ARGS = Object.freeze([
  '--execute-server',
  '--start-server',
  '--import-server',
  '--spawn-server',
]);
const DEVELOPMENT_ALLOWED_DIRTY_PATHS = Object.freeze([
  rel(S2_DRY_RUNNER),
  rel(GUARDED_PLAN_RUNNER),
  rel(PRELOAD_GUARDS_RUNNER),
  rel(THIS_SCRIPT),
  rel(PREFLIGHT_DOC),
]);
const CHILD_GATES = Object.freeze([
  {
    name: 'minimalHarnessDryRun',
    scriptPath: S2_DRY_RUNNER,
    expectedResult: 'S2_HARNESS_DRY_RUN_READY',
    devDirtyFlag: '--allow-dev-dirty-harness',
    strictCleanCapable: true,
    reviewEvidenceUsable(receipt) {
      return (
        receipt &&
        receipt.result === 'S2_HARNESS_DRY_RUN_READY' &&
        receipt.authorization &&
        receipt.authorization.allowDevDirtyHarness === false
      );
    },
  },
  {
    name: 'guardedSmokePlan',
    scriptPath: GUARDED_PLAN_RUNNER,
    expectedResult: 'S2_GUARDED_SMOKE_PLAN_READY',
    devDirtyFlag: '--allow-dev-dirty-plan',
    strictCleanCapable: true,
    reviewEvidenceUsable(receipt) {
      return Boolean(
        receipt &&
          receipt.dirtyWorktreePolicy &&
          receipt.dirtyWorktreePolicy.reviewEvidenceUsable === true,
      );
    },
  },
  {
    name: 'preloadGuardProbe',
    scriptPath: PRELOAD_GUARDS_RUNNER,
    expectedResult: 'S2_PRELOAD_GUARD_PROBE_READY',
    devDirtyFlag: '--allow-dev-dirty-guards',
    strictCleanCapable: false,
    reviewEvidenceUsable(receipt) {
      return Boolean(
        receipt &&
          receipt.dirtyWorktreePolicy &&
          receipt.dirtyWorktreePolicy.reviewEvidenceUsable === true,
      );
    },
  },
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

async function withProcessArgv(scriptPath, args, callback) {
  const originalArgv = process.argv;
  process.argv = [process.execPath, scriptPath, ...args];
  try {
    return await callback();
  } finally {
    process.argv = originalArgv;
  }
}

function childArgsFor(gate, options) {
  const args = ['--json'];
  if (options.strictClean && gate.strictCleanCapable) {
    args.push('--strict-clean');
  }
  if (options.allowDevDirtyPreflight) {
    args.push(gate.devDirtyFlag);
  }
  return args;
}

async function buildChildGateReceipt(gate, options) {
  const args = childArgsFor(gate, options);
  try {
    const childModule = require(gate.scriptPath);
    if (!childModule || typeof childModule.buildReceipt !== 'function') {
      throw new Error('child gate does not export buildReceipt');
    }

    const childResult = await withProcessArgv(gate.scriptPath, args, () =>
      childModule.buildReceipt(),
    );
    const receipt = childResult && childResult.receipt;

    return {
      name: gate.name,
      script: rel(gate.scriptPath),
      args,
      error: '',
      expectedResult: gate.expectedResult,
      result: receipt && receipt.result,
      ready: Boolean(receipt && receipt.result === gate.expectedResult),
      reviewEvidenceUsable: gate.reviewEvidenceUsable(receipt),
      safetyAssertionsAllFalse: safetyAssertionsAllFalse(receipt),
      safetyViolations: safetyViolations(receipt),
      receipt,
    };
  } catch (error) {
    return {
      name: gate.name,
      script: rel(gate.scriptPath),
      args,
      error: error && error.stack ? error.stack : String(error),
      expectedResult: gate.expectedResult,
      result: null,
      ready: false,
      reviewEvidenceUsable: false,
      safetyAssertionsAllFalse: false,
      safetyViolations: ['receipt unavailable'],
      receipt: null,
    };
  }
}

function safetyAssertionsAllFalse(receipt) {
  if (!receipt || !receipt.safetyAssertions) return false;
  return REQUIRED_FALSE_SAFETY_ASSERTIONS.every(
    (name) => receipt.safetyAssertions[name] === false,
  );
}

function safetyViolations(receipt) {
  if (!receipt || !receipt.safetyAssertions) return ['missing safetyAssertions'];
  return REQUIRED_FALSE_SAFETY_ASSERTIONS.filter(
    (name) => receipt.safetyAssertions[name] !== false,
  );
}

function hasForbiddenExecutionArg(args) {
  return FORBIDDEN_EXECUTION_ARGS.some((arg) => args.includes(arg));
}

async function buildReceipt() {
  const args = process.argv.slice(2);
  const argSet = new Set(args);
  const jsonMode = argSet.has('--json');
  const strictClean = argSet.has('--strict-clean');
  const allowDevDirtyPreflight = argSet.has('--allow-dev-dirty-preflight');
  const unknownArgs = args.filter((arg) => !KNOWN_ARGS.includes(arg));
  const forbiddenExecutionArgs = args.filter((arg) =>
    FORBIDDEN_EXECUTION_ARGS.includes(arg),
  );
  const checks = [];
  const blockedReasons = [];
  const guardedSmokeBlockedReasons = [
    'real guarded server smoke is not authorized by this preflight gate',
  ];
  const coreGit = gitState(PROJECT_ROOT);
  const externalGit = gitState(EXTERNAL_PACKAGE_ROOT);
  const coreStatusEntries = statusEntries(coreGit.statusShort);
  const externalStatusEntries = statusEntries(externalGit.statusShort);
  const allowedDirtySet = new Set(
    allowDevDirtyPreflight ? DEVELOPMENT_ALLOWED_DIRTY_PATHS : [],
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
  const childGates = [];

  if (!hasForbiddenExecutionArg(args)) {
    for (const gate of CHILD_GATES) {
      childGates.push(
        await buildChildGateReceipt(gate, {
          strictClean,
          allowDevDirtyPreflight,
        }),
      );
    }
  }

  const childResultsReady = childGates.every((gate) => gate.ready);
  const childSafetyAssertionsAllFalse = childGates.every(
    (gate) => gate.safetyAssertionsAllFalse,
  );
  const childReviewEvidenceUsable = childGates.every(
    (gate) => gate.reviewEvidenceUsable,
  );
  const guardedPlan = childGates.find(
    (gate) => gate.name === 'guardedSmokePlan',
  );
  const dryRun = childGates.find((gate) => gate.name === 'minimalHarnessDryRun');

  addCheck(checks, 'core git status read', coreGit.statusOk, coreGit.statusError || 'ok');
  addCheck(checks, 'external git status read', externalGit.statusOk, externalGit.statusError || 'ok');
  addCheck(checks, 'core contains preload guard base', coreContainsExpectedBase, EXPECTED_CORE_BASE);
  addCheck(checks, 'preflight script exists', fileExists(THIS_SCRIPT), rel(THIS_SCRIPT));
  addCheck(checks, 'preflight doc exists', fileExists(PREFLIGHT_DOC), rel(PREFLIGHT_DOC));
  addCheck(checks, 'no unknown args', unknownArgs.length === 0, unknownArgs);
  addCheck(checks, 'real server execution not requested', forbiddenExecutionArgs.length === 0, forbiddenExecutionArgs);
  addCheck(checks, 'child receipts collected', childGates.length === CHILD_GATES.length, childGates.map((gate) => gate.name));
  addCheck(checks, 'child gates report READY', childResultsReady, childGates.map((gate) => ({ name: gate.name, result: gate.result, error: gate.error })));
  addCheck(checks, 'child safety assertions remain false', childSafetyAssertionsAllFalse, childGates.map((gate) => ({ name: gate.name, violations: gate.safetyViolations })));
  addCheck(
    checks,
    'clean-mode child receipts are review evidence',
    allowDevDirtyPreflight || childReviewEvidenceUsable,
    childGates.map((gate) => ({
      name: gate.name,
      reviewEvidenceUsable: gate.reviewEvidenceUsable,
    })),
  );
  addCheck(
    checks,
    'minimal dry-run still withholds real server authorization',
    dryRun &&
      dryRun.receipt &&
      dryRun.receipt.authorization &&
      dryRun.receipt.authorization.realServerStartAuthorized === false,
    dryRun && dryRun.receipt && dryRun.receipt.authorization,
  );
  addCheck(
    checks,
    'guarded plan remains non-executing',
    guardedPlan &&
      guardedPlan.receipt &&
      guardedPlan.receipt.guardedSmokeReadiness &&
      guardedPlan.receipt.guardedSmokeReadiness.ready === false,
    guardedPlan &&
      guardedPlan.receipt &&
      guardedPlan.receipt.guardedSmokeReadiness,
  );

  if (unknownArgs.length > 0) {
    blockedReasons.push(`unknown args: ${unknownArgs.join(', ')}`);
  }
  if (forbiddenExecutionArgs.length > 0) {
    blockedReasons.push(
      `server execution args are outside this gate: ${forbiddenExecutionArgs.join(', ')}`,
    );
  }
  if (!coreGit.statusOk) {
    blockedReasons.push(`core git status failed: ${coreGit.statusError}`);
    guardedSmokeBlockedReasons.push('core git status failed');
  }
  if (!externalGit.statusOk) {
    blockedReasons.push(
      `external git status failed: ${externalGit.statusError}`,
    );
    guardedSmokeBlockedReasons.push('external git status failed');
  }
  if (disallowedCoreStatusEntries.length > 0) {
    blockedReasons.push(
      `core worktree has disallowed dirty paths: ${disallowedCoreStatusEntries
        .map((entry) => entry.line)
        .join('; ')}`,
    );
  }
  if (externalStatusEntries.length > 0) {
    blockedReasons.push('external package worktree is dirty');
    guardedSmokeBlockedReasons.push('external package worktree must be clean');
  }
  if (coreGit.statusOk && coreGit.statusShort) {
    guardedSmokeBlockedReasons.push('core worktree must be clean before real S2');
  }
  for (const gate of childGates) {
    if (gate.error) {
      blockedReasons.push(`${gate.name} receipt failed: ${gate.error}`);
    }
    if (!gate.ready) {
      blockedReasons.push(
        `${gate.name} expected ${gate.expectedResult} but got ${gate.result || 'no result'}`,
      );
    }
    if (!gate.safetyAssertionsAllFalse) {
      blockedReasons.push(
        `${gate.name} safety assertions not all false: ${gate.safetyViolations.join(', ')}`,
      );
    }
  }
  if (!allowDevDirtyPreflight && !childReviewEvidenceUsable) {
    blockedReasons.push('clean-mode child receipts are not review evidence');
  }
  for (const check of checks) {
    if (!check.ok) blockedReasons.push(check.name);
  }

  const pass = blockedReasons.length === 0;
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'aigentquality-s2-guarded-smoke-preflight',
    authorization: {
      preflightAuthorized: true,
      realServerStartAuthorized: false,
      serverImportAuthorized: false,
      serverSpawnAuthorized: false,
      executeServerRequested: forbiddenExecutionArgs.length > 0,
      strictClean,
      allowDevDirtyPreflight,
    },
    safetyAssertions: {
      startedServer: false,
      importedServer: false,
      spawnedServer: false,
      boundPort: false,
      executedPlugin: false,
      wroteRuntimeFiles: false,
      networkOrProviderCalls: false,
      requiredServerJs: false,
      spawnedReceiptProcesses: false,
    },
    paths: {
      projectRoot: PROJECT_ROOT,
      externalPackageRoot: EXTERNAL_PACKAGE_ROOT,
      preflightRunner: rel(THIS_SCRIPT),
      preflightDoc: rel(PREFLIGHT_DOC),
      childRunners: CHILD_GATES.map((gate) => rel(gate.scriptPath)),
    },
    expected: {
      coreBase: EXPECTED_CORE_BASE,
      externalHead: EXPECTED_EXTERNAL_HEAD,
      childResults: CHILD_GATES.map((gate) => ({
        name: gate.name,
        result: gate.expectedResult,
      })),
    },
    git: {
      core: {
        branch: coreGit.branch,
        head: coreGit.head,
        statusOk: coreGit.statusOk,
        statusError: coreGit.statusError,
        statusShort: coreGit.statusShort || '',
        statusEntries: coreStatusEntries,
        allowedDirtyPaths: [...allowedDirtySet],
        developmentAllowedDirtyPaths: DEVELOPMENT_ALLOWED_DIRTY_PATHS,
        disallowedCoreStatusEntries,
      },
      external: {
        branch: externalGit.branch,
        head: externalGit.head,
        statusOk: externalGit.statusOk,
        statusError: externalGit.statusError,
        statusShort: externalGit.statusShort || '',
        statusEntries: externalStatusEntries,
      },
    },
    dirtyWorktreePolicy: {
      statusGitGlobalArgs: STATUS_GIT_GLOBAL_ARGS,
      statusUntrackedMode: 'all',
      strictClean,
      allowDevDirtyPreflight,
      reviewEvidenceUsable:
        !allowDevDirtyPreflight && pass && childReviewEvidenceUsable,
      preflightFilesMustBeCleanByDefault: true,
      childReceiptDevModeUsed: allowDevDirtyPreflight,
      allowedDirtyPaths: [...allowedDirtySet],
    },
    childGateSummary: childGates.map((gate) => ({
      name: gate.name,
      script: gate.script,
      args: gate.args,
      expectedResult: gate.expectedResult,
      result: gate.result,
      ready: gate.ready,
      reviewEvidenceUsable: gate.reviewEvidenceUsable,
      safetyAssertionsAllFalse: gate.safetyAssertionsAllFalse,
      safetyViolations: gate.safetyViolations,
      error: gate.error,
    })),
    childReceipts: Object.fromEntries(
      childGates.map((gate) => [gate.name, gate.receipt]),
    ),
    guardedSmokeReadiness: {
      ready: false,
      reason:
        'this gate is preflight/receipt only; real guarded smoke still needs explicit authorization',
      blockedReasons: guardedSmokeBlockedReasons,
    },
    checks,
    blockedReasons,
    result: pass
      ? 'S2_GUARDED_SMOKE_PREFLIGHT_READY'
      : 'S2_GUARDED_SMOKE_PREFLIGHT_BLOCKED',
    note:
      'This preflight only aggregates reviewed dry-run, guarded-plan, and preload-guard receipts. It does not import, spawn, or execute server.js.',
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
        `core: ${receipt.git.core.branch}@${receipt.git.core.head}`,
        `external: ${receipt.git.external.branch}@${receipt.git.external.head}`,
        `startedServer: ${receipt.safetyAssertions.startedServer}`,
        `importedServer: ${receipt.safetyAssertions.importedServer}`,
        `spawnedServer: ${receipt.safetyAssertions.spawnedServer}`,
        `boundPort: ${receipt.safetyAssertions.boundPort}`,
        `checks: ${receipt.checks.filter((check) => check.ok).length}/${receipt.checks.length}`,
        `reviewEvidenceUsable: ${receipt.dirtyWorktreePolicy.reviewEvidenceUsable}`,
        `blocked: ${
          receipt.blockedReasons.length
            ? receipt.blockedReasons.join('; ')
            : 'none'
        }`,
        `guardedSmokeReady: ${receipt.guardedSmokeReadiness.ready}`,
        '',
      ].join('\n'),
    );
  }
  process.exitCode =
    receipt.result === 'S2_GUARDED_SMOKE_PREFLIGHT_READY' ? 0 : 1;
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
