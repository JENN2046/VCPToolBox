#!/usr/bin/env node
'use strict';

const path = require('path');

const REQUIRED_GUARD_GROUPS = Object.freeze([
  'repository-read-guard',
  'repository-directory-read-guard',
  'repository-write-watch-guard',
  'child-process-spawn-guard',
  'dotenv-config-guard',
  'http-listen-localhost-guard',
]);

const REQUIRED_STUB_MODULES = Object.freeze([
  './modules/logger.js',
  './modules/toolApprovalManager.js',
  './modules/semanticModelRouter.js',
  './modelRedirectHandler.js',
  './modules/agentManager.js',
  './modules/tvsManager.js',
  './modules/toolboxManager.js',
  './routes/adminPanelRoutes.js',
  './routes/codexOAuthResponses.js',
  './EmbeddingUtils.js',
  './routes/image-rating-api.js',
  './routes/taskScheduler.js',
  './modules/dynamicToolRegistry.js',
  './KnowledgeBaseManager.js',
  './modules/sarPromptManager.js',
  './WebSocketServer.js',
  './FileFetcherServer.js',
]);

const REQUIRED_PLUGIN_MANAGER_PATCHES = Object.freeze([
  '_loadPluginEnvConfig',
  '_discoverLegacyPluginManifestsFromDir',
  '_discoverModernPluginManifests',
  '_registerLocalPlugin',
  'initializeServices',
  'initializeStaticPlugins',
  'prewarmPythonPlugins',
  'processToolCall',
  'executePlugin',
  '_spawnPluginProcess',
]);

const REQUIRED_RECEIPT_FLAGS = Object.freeze([
  'startedServer',
  'importedServer',
  'spawnedServer',
  'boundPort',
  'executedPlugin',
  'networkOrProviderCalls',
  'repositoryWriteOutsideTemp',
  'operatorConfigRead',
]);

const REQUIRED_READ_GUARD_APIS = Object.freeze([
  'fs.readFile',
  'fs.readFileSync',
  'fs.open',
  'fs.openSync',
  'fs.createReadStream',
  'fs.readdir',
  'fs.readdirSync',
  'fs.opendir',
  'fs.opendirSync',
  'fs.stat',
  'fs.statSync',
  'fs.access',
  'fs.accessSync',
  'fs.existsSync',
  'fs.promises.readFile',
  'fs.promises.open',
  'fs.promises.readdir',
  'fs.promises.opendir',
  'fs.promises.stat',
  'fs.promises.access',
  'FileHandle.read',
  'FileHandle.readFile',
  'FileHandle.createReadStream',
  'Dir.read',
  'Dir.readSync',
  'Dir async iterator',
  'dotenv.config',
]);

const REQUIRED_WRITE_WATCH_GUARD_APIS = Object.freeze([
  'fs.writeFile',
  'fs.writeFileSync',
  'fs.appendFile',
  'fs.appendFileSync',
  'fs.mkdir',
  'fs.mkdirSync',
  'fs.rename',
  'fs.renameSync',
  'fs.unlink',
  'fs.unlinkSync',
  'fs.rm',
  'fs.rmSync',
  'fs.open',
  'fs.openSync',
  'fs.copyFile',
  'fs.copyFileSync',
  'fs.cp',
  'fs.cpSync',
  'fs.createWriteStream',
  'fs.watch',
  'fs.watchFile',
  'chokidar.watch',
  'fs.promises.writeFile',
  'fs.promises.appendFile',
  'fs.promises.mkdir',
  'fs.promises.rename',
  'fs.promises.unlink',
  'fs.promises.rm',
  'fs.promises.open',
  'fs.promises.copyFile',
  'fs.promises.cp',
  'FileHandle.write',
  'FileHandle.writeFile',
  'FileHandle.appendFile',
  'FileHandle.createWriteStream',
]);

const REQUIRED_GUARDED_SMOKE_EVIDENCE = Object.freeze([
  'core repo clean before and after',
  'external repo clean before and after',
  'server child cwd is temp and has no config.env',
  'child env built from clean allowlist',
  'child process spawned with replacement env object',
  'child env exact key set matches reviewed allowlist',
  'harness config loaded from explicit temp env path',
  'harness config path resolves under temp run root',
  'secret-like parent env inherited: no',
  'read guard installed before startup modules loaded',
  'directory read guard installed before startup modules loaded',
  'write/watch guard installed before startup modules loaded',
  'repository-root config.env read attempted: no',
  'plugin-level config.env read attempted: no',
  'dotenv resolved only against temp cwd',
  'ToolApprovalManager real config read/watch attempted: no',
  'SemanticModelRouter real config read/write/watch attempted: no',
  'adminPanelRoutes real construction attempted: no',
  'codexOAuthResponses real trace store read/write attempted: no',
  'EmbeddingUtils real fallback stats hydration attempted: no',
  'image-rating-api real module required: no',
  'taskScheduler real initialize: no',
  'WebSocketServer real initialize: no',
  'WebSocketServer post-listen interception receipt',
  'FileFetcherServer real initialize: no',
  'FileFetcherServer post-listen interception receipt',
  'processToolCall invoked: no',
  'executePlugin invoked: no',
  'server/plugin child_process.spawn invoked: no',
  'server reached app.listen',
  'provider/network/workflow/generation call: no',
  'operator image path read: no',
]);

function normalizePathForReceipt(value) {
  return value ? path.resolve(value) : null;
}

function buildPreloadContractReceipt(options = {}) {
  return {
    mode: 'aigentquality-s2-preload-contract-dry-run',
    contractOnly: true,
    installedInCurrentProcess: false,
    realServerStartAuthorized: false,
    projectRoot: normalizePathForReceipt(options.projectRoot),
    externalPackageRoot: normalizePathForReceipt(options.externalPackageRoot),
    runRoot: normalizePathForReceipt(options.runRoot),
    harnessConfigPath: normalizePathForReceipt(options.harnessConfigPath),
    requiredGuardGroups: [...REQUIRED_GUARD_GROUPS],
    requiredStubModules: [...REQUIRED_STUB_MODULES],
    requiredPluginManagerPatches: [...REQUIRED_PLUGIN_MANAGER_PATCHES],
    requiredReceiptFlags: [...REQUIRED_RECEIPT_FLAGS],
    postListenStubs: ['./WebSocketServer.js', './FileFetcherServer.js'],
    safetyAssertions: {
      startedServer: false,
      importedServer: false,
      spawnedServer: false,
      boundPort: false,
      executedPlugin: false,
      networkOrProviderCalls: false,
      repositoryWriteOutsideTemp: false,
      operatorConfigRead: false,
    },
    result: 'CONTRACT_READY',
  };
}

function validatePreloadContractReceipt(receipt) {
  const failures = [];
  const requiredGuardGroups =
    receipt && Array.isArray(receipt.requiredGuardGroups)
      ? receipt.requiredGuardGroups
      : [];
  const requiredStubModules =
    receipt && Array.isArray(receipt.requiredStubModules)
      ? receipt.requiredStubModules
      : [];
  const requiredPluginManagerPatches =
    receipt && Array.isArray(receipt.requiredPluginManagerPatches)
      ? receipt.requiredPluginManagerPatches
      : [];
  const requiredReceiptFlags =
    receipt && Array.isArray(receipt.requiredReceiptFlags)
      ? receipt.requiredReceiptFlags
      : [];
  const safetyAssertions =
    receipt && receipt.safetyAssertions && typeof receipt.safetyAssertions === 'object'
      ? receipt.safetyAssertions
      : {};

  if (!receipt || receipt.mode !== 'aigentquality-s2-preload-contract-dry-run') {
    failures.push('unexpected preload contract mode');
  }
  if (receipt && receipt.contractOnly !== true) {
    failures.push('dry-run contract must be marked contractOnly');
  }
  if (receipt && receipt.installedInCurrentProcess !== false) {
    failures.push('dry-run contract must not install preload hooks');
  }
  if (receipt && receipt.realServerStartAuthorized !== false) {
    failures.push('dry-run contract must not authorize real server start');
  }

  for (const group of REQUIRED_GUARD_GROUPS) {
    if (!requiredGuardGroups.includes(group)) {
      failures.push(`missing guard group: ${group}`);
    }
  }
  for (const modulePath of REQUIRED_STUB_MODULES) {
    if (!requiredStubModules.includes(modulePath)) {
      failures.push(`missing stub module: ${modulePath}`);
    }
  }
  for (const patch of REQUIRED_PLUGIN_MANAGER_PATCHES) {
    if (!requiredPluginManagerPatches.includes(patch)) {
      failures.push(`missing PluginManager patch: ${patch}`);
    }
  }
  for (const flag of REQUIRED_RECEIPT_FLAGS) {
    if (!requiredReceiptFlags.includes(flag)) {
      failures.push(`missing receipt flag: ${flag}`);
    }
    if (safetyAssertions[flag] !== false) {
      failures.push(`safety assertion must be false: ${flag}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function isPathUnder(childPath, parentPath) {
  const child = normalizePathForReceipt(childPath);
  const parent = normalizePathForReceipt(parentPath);
  if (!child || !parent) return false;
  const relativePath = path.relative(parent, child);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

function buildGuardedSmokePlanReceipt(options = {}) {
  const runRoot = normalizePathForReceipt(options.runRoot);
  const harnessConfigPath = normalizePathForReceipt(options.harnessConfigPath);

  return {
    mode: 'aigentquality-s2-guarded-smoke-plan',
    planOnly: true,
    contractOnly: true,
    installedInCurrentProcess: false,
    guardInstallImplemented: false,
    realServerStartAuthorized: false,
    projectRoot: normalizePathForReceipt(options.projectRoot),
    externalPackageRoot: normalizePathForReceipt(options.externalPackageRoot),
    runRoot,
    harnessConfigPath,
    harnessConfigPathUnderRunRoot: isPathUnder(harnessConfigPath, runRoot),
    requiredGuardGroups: [...REQUIRED_GUARD_GROUPS],
    requiredReadGuardApis: [...REQUIRED_READ_GUARD_APIS],
    requiredWriteWatchGuardApis: [...REQUIRED_WRITE_WATCH_GUARD_APIS],
    requiredStubModules: [...REQUIRED_STUB_MODULES],
    requiredPluginManagerPatches: [...REQUIRED_PLUGIN_MANAGER_PATCHES],
    requiredReceiptFlags: [...REQUIRED_RECEIPT_FLAGS],
    requiredGuardedSmokeEvidence: [...REQUIRED_GUARDED_SMOKE_EVIDENCE],
    postListenStubs: ['./WebSocketServer.js', './FileFetcherServer.js'],
    implementationSequence: [
      'load explicit harness config from temp env path',
      'install read and directory guards before server.js loads',
      'install write/watch and child_process guards before startup modules load',
      'stub startup modules with receipt-only replacements',
      'patch PluginManager for manifest-only Jenn registration',
      'constrain http listen to localhost-only evidence',
      'record post-listen WebSocketServer and FileFetcherServer stubs',
      'exit before plugin command execution',
    ],
    safetyAssertions: {
      startedServer: false,
      importedServer: false,
      spawnedServer: false,
      boundPort: false,
      executedPlugin: false,
      networkOrProviderCalls: false,
      repositoryWriteOutsideTemp: false,
      operatorConfigRead: false,
    },
    result: 'GUARDED_SMOKE_PLAN_READY',
  };
}

function validateGuardedSmokePlanReceipt(receipt) {
  const contractCompatibleReceipt = receipt
    ? {
        ...receipt,
        mode: 'aigentquality-s2-preload-contract-dry-run',
      }
    : null;
  const failures = validatePreloadContractReceipt(
    contractCompatibleReceipt,
  ).failures;
  const requiredReadGuardApis =
    receipt && Array.isArray(receipt.requiredReadGuardApis)
      ? receipt.requiredReadGuardApis
      : [];
  const requiredWriteWatchGuardApis =
    receipt && Array.isArray(receipt.requiredWriteWatchGuardApis)
      ? receipt.requiredWriteWatchGuardApis
      : [];
  const requiredGuardedSmokeEvidence =
    receipt && Array.isArray(receipt.requiredGuardedSmokeEvidence)
      ? receipt.requiredGuardedSmokeEvidence
      : [];
  const implementationSequence =
    receipt && Array.isArray(receipt.implementationSequence)
      ? receipt.implementationSequence
      : [];

  if (!receipt || receipt.mode !== 'aigentquality-s2-guarded-smoke-plan') {
    failures.push('unexpected guarded smoke plan mode');
  }
  if (receipt && receipt.planOnly !== true) {
    failures.push('guarded smoke plan must be marked planOnly');
  }
  if (receipt && receipt.guardInstallImplemented !== false) {
    failures.push('guarded smoke plan must not claim guards are implemented');
  }
  if (receipt && receipt.harnessConfigPathUnderRunRoot !== true) {
    failures.push('harness config path must resolve under run root');
  }

  for (const api of REQUIRED_READ_GUARD_APIS) {
    if (!requiredReadGuardApis.includes(api)) {
      failures.push(`missing read guard API: ${api}`);
    }
  }
  for (const api of REQUIRED_WRITE_WATCH_GUARD_APIS) {
    if (!requiredWriteWatchGuardApis.includes(api)) {
      failures.push(`missing write/watch guard API: ${api}`);
    }
  }
  for (const evidence of REQUIRED_GUARDED_SMOKE_EVIDENCE) {
    if (!requiredGuardedSmokeEvidence.includes(evidence)) {
      failures.push(`missing guarded smoke evidence: ${evidence}`);
    }
  }
  for (const phase of [
    'install read and directory guards before server.js loads',
    'stub startup modules with receipt-only replacements',
    'record post-listen WebSocketServer and FileFetcherServer stubs',
    'exit before plugin command execution',
  ]) {
    if (!implementationSequence.includes(phase)) {
      failures.push(`missing implementation phase: ${phase}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function installPreloadGuards() {
  throw new Error(
    'AIGentQuality S2 preload is contract-only in this gate; real server preload is not authorized',
  );
}

function failClosedIfAccidentalServerPreload() {
  if (process.env.VCP_AIGENTQUALITY_S2_HARNESS_CONFIG) {
    throw new Error(
      'AIGentQuality S2 preload contract refuses real server startup in this dry-run gate',
    );
  }
}

function main() {
  const receipt = buildPreloadContractReceipt();
  const validation = validatePreloadContractReceipt(receipt);
  const output = {
    ...receipt,
    validation,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = validation.ok ? 0 : 1;
}

failClosedIfAccidentalServerPreload();

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_GUARD_GROUPS,
  REQUIRED_STUB_MODULES,
  REQUIRED_PLUGIN_MANAGER_PATCHES,
  REQUIRED_RECEIPT_FLAGS,
  REQUIRED_READ_GUARD_APIS,
  REQUIRED_WRITE_WATCH_GUARD_APIS,
  REQUIRED_GUARDED_SMOKE_EVIDENCE,
  buildPreloadContractReceipt,
  validatePreloadContractReceipt,
  buildGuardedSmokePlanReceipt,
  validateGuardedSmokePlanReceipt,
  installPreloadGuards,
};
