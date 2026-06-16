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
  buildPreloadContractReceipt,
  validatePreloadContractReceipt,
  installPreloadGuards,
};
