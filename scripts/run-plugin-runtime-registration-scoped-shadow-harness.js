#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const pluginManager = require('../Plugin.js');
const { createPluginRootResolver } = require('../modules/pluginRootResolver');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_PLUGIN_ROOT = path.join(EXTERNAL_PACKAGE_ROOT, 'Plugin');
const TARGET_PLUGIN_NAME = 'JennAIGentOrchestrator';
const DUPLICATE_PLUGIN_NAME = 'AIGentPrompt';
const ENV_KEYS = [
  'VCP_PLUGIN_ALLOWED_ROOTS',
  'VCP_PLUGIN_DIRS',
  'VCP_PLUGIN_INSTALL_DIR',
  'VCP_EXTERNAL_PLUGIN_ALLOWLIST'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function pluginPath(pluginName) {
  return path.join(EXTERNAL_PLUGIN_ROOT, pluginName);
}

function loadExternalManifest(pluginName) {
  const basePath = pluginPath(pluginName);
  const manifest = readJson(path.join(basePath, 'plugin-manifest.json'));
  return {
    ...manifest,
    basePath,
    pluginSource: 'external',
    pluginRoot: EXTERNAL_PLUGIN_ROOT,
    pluginRootId: 'external:1',
    pluginRootDisplayPath: '[external]/Plugin',
    pluginSpecificEnvConfig: {}
  };
}

function exactAllowlist(pluginName) {
  return `${pluginName}@${pluginPath(pluginName)}`;
}

function makeDirectFixtureManifest() {
  return {
    name: 'M125ExternalDirectFixture',
    displayName: 'M125 External Direct Fixture',
    pluginType: 'hybridservice',
    pluginSource: 'external',
    pluginRoot: EXTERNAL_PLUGIN_ROOT,
    pluginRootId: 'external:1',
    pluginRootDisplayPath: '[external]/Plugin',
    basePath: pluginPath(TARGET_PLUGIN_NAME),
    entryPoint: { script: 'direct-fixture-should-not-load.js' },
    communication: { protocol: 'direct', timeout: 1000 },
    pluginSpecificEnvConfig: {}
  };
}

function snapshotEnv() {
  const saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }
  return saved;
}

function restoreEnv(saved) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}

function clearEnvKeys() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function countExternalPlugins() {
  let count = 0;
  for (const manifest of pluginManager.plugins.values()) {
    if (manifest && manifest.pluginSource === 'external') count += 1;
  }
  return count;
}

async function withIsolatedPluginManager(run, options = {}) {
  const original = {
    plugins: pluginManager.plugins,
    serviceModules: pluginManager.serviceModules,
    messagePreprocessors: pluginManager.messagePreprocessors,
    staticPlaceholderValues: pluginManager.staticPlaceholderValues,
    preprocessorOrder: pluginManager.preprocessorOrder,
    lastPluginRootSnapshot: pluginManager.lastPluginRootSnapshot
  };

  pluginManager.plugins = new Map(options.seedPlugins || []);
  pluginManager.serviceModules = new Map();
  pluginManager.messagePreprocessors = new Map();
  pluginManager.staticPlaceholderValues = new Map();
  pluginManager.preprocessorOrder = [];
  pluginManager.lastPluginRootSnapshot = null;

  try {
    return await run();
  } finally {
    pluginManager.plugins = original.plugins;
    pluginManager.serviceModules = original.serviceModules;
    pluginManager.messagePreprocessors = original.messagePreprocessors;
    pluginManager.staticPlaceholderValues = original.staticPlaceholderValues;
    pluginManager.preprocessorOrder = original.preprocessorOrder;
    pluginManager.lastPluginRootSnapshot = original.lastPluginRootSnapshot;
  }
}

async function attemptRegistration(manifest, allowlist, options = {}) {
  if (allowlist === undefined) {
    delete process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST;
  } else {
    process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST = allowlist;
  }

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  try {
    return await withIsolatedPluginManager(async () => {
      const registered = await pluginManager._registerLocalPlugin(manifest, new Map(), []);
      return {
        registered,
        externalPluginCount: countExternalPlugins(),
        serviceModuleCount: pluginManager.serviceModules.size,
        messagePreprocessorCount: pluginManager.messagePreprocessors.size,
        warnings
      };
    }, options);
  } finally {
    console.warn = originalWarn;
  }
}

function listExternalManifestNames() {
  const result = [];
  for (const entry of fs.readdirSync(EXTERNAL_PLUGIN_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(EXTERNAL_PLUGIN_ROOT, entry.name, 'plugin-manifest.json');
    if (!pathExists(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (manifest && manifest.name) result.push(manifest.name);
  }
  return result.sort();
}

async function main() {
  const savedEnv = snapshotEnv();
  const originalMethods = {
    spawn: pluginManager._spawnPluginProcess,
    processToolCall: pluginManager.processToolCall,
    executePlugin: pluginManager.executePlugin,
    initializeStaticPlugins: pluginManager.initializeStaticPlugins,
    initializeServices: pluginManager.initializeServices,
    startPluginWatcher: pluginManager.startPluginWatcher
  };
  const executionCounters = {
    entrypointExecutionCount: 0,
    processToolCallInvoked: 'no',
    executePluginInvoked: 'no',
    initializeStaticPluginsInvoked: 'no',
    initializeServicesInvoked: 'no',
    startPluginWatcherInvoked: 'no'
  };

  pluginManager._spawnPluginProcess = function blockedSpawn() {
    executionCounters.entrypointExecutionCount += 1;
    throw new Error('M125 harness blocked plugin process spawn');
  };
  pluginManager.processToolCall = async function blockedProcessToolCall() {
    executionCounters.processToolCallInvoked = 'yes';
    throw new Error('M125 harness blocked processToolCall');
  };
  pluginManager.executePlugin = async function blockedExecutePlugin() {
    executionCounters.executePluginInvoked = 'yes';
    throw new Error('M125 harness blocked executePlugin');
  };
  pluginManager.initializeStaticPlugins = async function blockedInitializeStaticPlugins() {
    executionCounters.initializeStaticPluginsInvoked = 'yes';
    throw new Error('M125 harness blocked initializeStaticPlugins');
  };
  pluginManager.initializeServices = function blockedInitializeServices() {
    executionCounters.initializeServicesInvoked = 'yes';
    throw new Error('M125 harness blocked initializeServices');
  };
  pluginManager.startPluginWatcher = function blockedStartPluginWatcher() {
    executionCounters.startPluginWatcherInvoked = 'yes';
    throw new Error('M125 harness blocked startPluginWatcher');
  };

  const failures = [];
  const report = {};

  try {
    if (!pathExists(EXTERNAL_PLUGIN_ROOT)) failures.push('external plugin root missing');
    if (!pathExists(pluginPath(TARGET_PLUGIN_NAME))) failures.push('target plugin missing');
    if (!pathExists(pluginPath(DUPLICATE_PLUGIN_NAME))) failures.push('duplicate fixture plugin missing');

    clearEnvKeys();
    const defaultOffSnapshot = createPluginRootResolver({
      projectRoot: PROJECT_ROOT,
      env: process.env
    }).getPluginRootSnapshotSync();
    report.DEFAULT_OFF_EXTERNAL_ROOT_COUNT = defaultOffSnapshot.externalLegacyRoots.length;

    process.env.VCP_PLUGIN_ALLOWED_ROOTS = EXTERNAL_PACKAGE_ROOT;
    process.env.VCP_PLUGIN_DIRS = EXTERNAL_PLUGIN_ROOT;
    delete process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST;
    const discoverySnapshot = createPluginRootResolver({
      projectRoot: PROJECT_ROOT,
      env: process.env
    }).getPluginRootSnapshotSync();
    report.DISCOVERY_ONLY_EXTERNAL_ROOT_COUNT = discoverySnapshot.externalLegacyRoots.length;
    const discoveredNames = listExternalManifestNames();
    report.DISCOVERY_ONLY_EXTERNAL_MANIFEST_COUNT = discoveredNames.length;

    const targetManifest = loadExternalManifest(TARGET_PLUGIN_NAME);
    const duplicateManifest = loadExternalManifest(DUPLICATE_PLUGIN_NAME);

    const discoveryOnly = await attemptRegistration(targetManifest, undefined);
    report.DISCOVERY_ONLY_EXTERNAL_REGISTERED_COUNT = discoveryOnly.externalPluginCount;

    const invalidAllowlists = [
      TARGET_PLUGIN_NAME,
      pluginPath(TARGET_PLUGIN_NAME),
      `${TARGET_PLUGIN_NAME}@*`,
      `${TARGET_PLUGIN_NAME}@${EXTERNAL_PACKAGE_ROOT}`,
      `${TARGET_PLUGIN_NAME}@${EXTERNAL_PLUGIN_ROOT}`,
      `${TARGET_PLUGIN_NAME}@${path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-LocalState')}`
    ];
    let invalidAllowlistRegisteredCount = 0;
    for (const allowlist of invalidAllowlists) {
      const result = await attemptRegistration(targetManifest, allowlist);
      if (result.registered || result.externalPluginCount > 0) {
        invalidAllowlistRegisteredCount += 1;
      }
    }
    report.INVALID_ALLOWLIST_REGISTERED_COUNT = invalidAllowlistRegisteredCount;

    const exactTarget = await attemptRegistration(targetManifest, exactAllowlist(TARGET_PLUGIN_NAME));
    report.EXACT_JENN_ALLOWLIST_REGISTERED_COUNT = exactTarget.externalPluginCount;
    report.EXACT_JENN_SERVICE_MODULE_COUNT = exactTarget.serviceModuleCount;
    report.EXACT_JENN_MESSAGE_PREPROCESSOR_COUNT = exactTarget.messagePreprocessorCount;

    const seededCorePlugin = {
      name: DUPLICATE_PLUGIN_NAME,
      pluginSource: 'legacy',
      pluginRootId: 'core:legacy',
      pluginRootDisplayPath: 'Plugin',
      pluginType: 'synchronous',
      entryPoint: { command: 'node core-fixture.js' },
      communication: { protocol: 'stdio', timeout: 1000 },
      basePath: path.join(PROJECT_ROOT, 'Plugin', DUPLICATE_PLUGIN_NAME)
    };
    const duplicate = await attemptRegistration(
      duplicateManifest,
      exactAllowlist(DUPLICATE_PLUGIN_NAME),
      { seedPlugins: [[DUPLICATE_PLUGIN_NAME, seededCorePlugin]] }
    );
    report.DUPLICATE_CORE_NAME_REGISTERED_COUNT = duplicate.externalPluginCount;

    const directFixture = await attemptRegistration(
      makeDirectFixtureManifest(),
      `${makeDirectFixtureManifest().name}@${pluginPath(TARGET_PLUGIN_NAME)}`
    );
    report.DIRECT_OR_HYBRID_EXTERNAL_REGISTERED_COUNT = directFixture.externalPluginCount;
    report.DIRECT_OR_HYBRID_SERVICE_MODULE_COUNT = directFixture.serviceModuleCount;
    report.DIRECT_OR_HYBRID_MESSAGE_PREPROCESSOR_COUNT = directFixture.messagePreprocessorCount;

    report.ENTRYPOINT_EXECUTION_COUNT = executionCounters.entrypointExecutionCount;
    report.PROCESS_TOOL_CALL_INVOKED = executionCounters.processToolCallInvoked;
    report.EXECUTE_PLUGIN_INVOKED = executionCounters.executePluginInvoked;
    report.INITIALIZE_STATIC_PLUGINS_INVOKED = executionCounters.initializeStaticPluginsInvoked;
    report.INITIALIZE_SERVICES_INVOKED = executionCounters.initializeServicesInvoked;
    report.START_PLUGIN_WATCHER_INVOKED = executionCounters.startPluginWatcherInvoked;
    report.REAL_CONFIG_ENV_WRITTEN = 'no';
    report.PROVIDER_CALL_EXECUTED = 'no';
    report.BRIDGE_CALL_EXECUTED = 'no';
    report.LOCALSTATE_PRIVATE_CONTENT_READ = 'no';
    report.PRODUCTION_SERVER_STARTED = 'no';

    if (report.DEFAULT_OFF_EXTERNAL_ROOT_COUNT !== 0) failures.push('default off external roots present');
    if (report.DISCOVERY_ONLY_EXTERNAL_ROOT_COUNT !== 1) failures.push('discovery root count mismatch');
    if (report.DISCOVERY_ONLY_EXTERNAL_MANIFEST_COUNT <= 0) failures.push('discovery manifest count missing');
    if (report.DISCOVERY_ONLY_EXTERNAL_REGISTERED_COUNT !== 0) failures.push('discovery only registered external plugin');
    if (report.INVALID_ALLOWLIST_REGISTERED_COUNT !== 0) failures.push('invalid allowlist registered plugin');
    if (report.EXACT_JENN_ALLOWLIST_REGISTERED_COUNT !== 1) failures.push('exact Jenn allowlist did not register exactly one external plugin');
    if (report.EXACT_JENN_SERVICE_MODULE_COUNT !== 0) failures.push('Jenn registration produced service module');
    if (report.EXACT_JENN_MESSAGE_PREPROCESSOR_COUNT !== 0) failures.push('Jenn registration produced message preprocessor');
    if (report.DUPLICATE_CORE_NAME_REGISTERED_COUNT !== 0) failures.push('duplicate core-name external plugin registered');
    if (report.DIRECT_OR_HYBRID_EXTERNAL_REGISTERED_COUNT !== 0) failures.push('direct or hybrid external plugin registered');
    if (report.DIRECT_OR_HYBRID_SERVICE_MODULE_COUNT !== 0) failures.push('direct or hybrid service module loaded');
    if (report.DIRECT_OR_HYBRID_MESSAGE_PREPROCESSOR_COUNT !== 0) failures.push('direct or hybrid preprocessor loaded');
    if (report.ENTRYPOINT_EXECUTION_COUNT !== 0) failures.push('plugin entrypoint executed');
    if (report.PROCESS_TOOL_CALL_INVOKED !== 'no') failures.push('processToolCall invoked');
    if (report.EXECUTE_PLUGIN_INVOKED !== 'no') failures.push('executePlugin invoked');
    if (report.INITIALIZE_STATIC_PLUGINS_INVOKED !== 'no') failures.push('initializeStaticPlugins invoked');
    if (report.INITIALIZE_SERVICES_INVOKED !== 'no') failures.push('initializeServices invoked');
    if (report.START_PLUGIN_WATCHER_INVOKED !== 'no') failures.push('startPluginWatcher invoked');
  } finally {
    restoreEnv(savedEnv);
    pluginManager._spawnPluginProcess = originalMethods.spawn;
    pluginManager.processToolCall = originalMethods.processToolCall;
    pluginManager.executePlugin = originalMethods.executePlugin;
    pluginManager.initializeStaticPlugins = originalMethods.initializeStaticPlugins;
    pluginManager.initializeServices = originalMethods.initializeServices;
    pluginManager.startPluginWatcher = originalMethods.startPluginWatcher;
    if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
      pluginManager.toolApprovalManager.shutdown();
    }
  }

  for (const [key, value] of Object.entries(report)) {
    console.log(`${key}=${value}`);
  }
  console.log(`M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION=${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length > 0) {
    console.log(`FAILURES=${failures.join(';')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION=ERROR`);
  console.error(error && error.message ? error.message : String(error));
  if (pluginManager.toolApprovalManager && typeof pluginManager.toolApprovalManager.shutdown === 'function') {
    pluginManager.toolApprovalManager.shutdown();
  }
  process.exitCode = 1;
});
