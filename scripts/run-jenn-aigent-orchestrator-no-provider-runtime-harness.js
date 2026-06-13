#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_PLUGIN_ROOT = path.join(EXTERNAL_PACKAGE_ROOT, 'Plugin');
const TARGET_PLUGIN_PATH = path.join(EXTERNAL_PLUGIN_ROOT, 'JennAIGentOrchestrator');
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const EXPECTED_EXTERNAL_HEAD = 'f7772c654c2d8d34698f2818fde02ec63df783cb';
const TARGET_PLUGIN_NAME = 'JennAIGentOrchestrator';
const EXACT_RUNTIME_ALLOWLIST = `${TARGET_PLUGIN_NAME}@${TARGET_PLUGIN_PATH}`;
const REQUEST_ID = 'gate51b-jenn-aigent-orchestrator-bounded-stage1-identity';

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true
  });

  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }

  return String(result.stdout || '').trim();
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`failed to read json ${filePath}: ${error.message}`);
  }
}

function buildRequest() {
  return {
    action: 'PlanImagePipeline',
    requestId: REQUEST_ID,
    user_input: 'Gate 51B bounded no-provider Stage 1 identity probe request shape',
    dryRun: true,
    allowProvider: false,
    allowDownstream: false,
    allowExecution: false,
    include_style_training: false,
    execute_pipeline: false,
    confirm_external_effects: false,
    requested_by: 'gate-51b-bounded-no-provider-harness'
  };
}

function assertRequestShape(request) {
  const failures = [];
  if (!request.requestId) failures.push('requestId is required');
  if (!request.user_input) failures.push('top-level user_input is required');
  if (Object.prototype.hasOwnProperty.call(request, 'input')) failures.push('input must be absent');
  if (Object.prototype.hasOwnProperty.call(request, 'description')) failures.push('description must be absent');
  if (request.dryRun !== true) failures.push('dryRun must be true');
  if (request.allowProvider !== false) failures.push('allowProvider must be false');
  if (request.allowDownstream !== false) failures.push('allowDownstream must be false');
  if (request.allowExecution !== false) failures.push('allowExecution must be false');
  if (request.include_style_training !== false) failures.push('include_style_training must be false');
  if (request.execute_pipeline !== false) failures.push('execute_pipeline must be false');
  if (request.confirm_external_effects !== false) failures.push('confirm_external_effects must be false');

  for (const key of ['provider', 'model', 'outputPath', 'output_path', 'output_directory', 'LocalState', 'dataset_path']) {
    if (Object.prototype.hasOwnProperty.call(request, key)) {
      failures.push(`${key} must be absent`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`request shape blocked: ${failures.join('; ')}`);
  }
}

function buildBaseReceipt(request) {
  return {
    gate: 'Gate 51B AIGentOrchestrator bounded no-provider harness',
    stage: 'stage1_external_identity_probe',
    coreHEAD: null,
    coreOriginMain: null,
    coreWorktree: null,
    externalHEAD: null,
    externalOriginMain: null,
    externalWorktree: null,
    externalOrigin: null,
    exactExternalPluginPath: TARGET_PLUGIN_PATH,
    manifestName: null,
    manifestEntrypoint: null,
    manifestPluginType: null,
    manifestCommunicationProtocol: null,
    exactRuntimeAllowlist: EXACT_RUNTIME_ALLOWLIST,
    commandInvoked: 'node scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js',
    requestShape: {
      command: request.action,
      requestId: request.requestId,
      userInputPresent: Boolean(request.user_input),
      inputPresent: Object.prototype.hasOwnProperty.call(request, 'input'),
      descriptionPresent: Object.prototype.hasOwnProperty.call(request, 'description'),
      dryRun: request.dryRun,
      allowProvider: request.allowProvider,
      allowDownstream: request.allowDownstream,
      allowExecution: request.allowExecution
    },
    pluginManagerLoaded: false,
    processToolCallInvoked: false,
    providerCalls: 'not_called',
    downstreamDispatch: 'not_dispatched',
    localStateWrites: 'not_written',
    serverRouteActivation: 'not_started',
    realImageGeneration: 'not_started',
    runtimeDryRunExecuted: false,
    coreFallbackUsed: null,
    timeoutHangContainment: 'bounded_sync_stage1_only_with_git_timeout',
    result: 'BLOCKED'
  };
}

function assertCleanState(receipt) {
  receipt.coreHEAD = runGit(PROJECT_ROOT, ['rev-parse', 'HEAD']);
  receipt.coreOriginMain = runGit(PROJECT_ROOT, ['rev-parse', 'origin/main']);
  receipt.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
  receipt.externalHEAD = runGit(EXTERNAL_PACKAGE_ROOT, ['rev-parse', 'HEAD']);
  receipt.externalOriginMain = runGit(EXTERNAL_PACKAGE_ROOT, ['rev-parse', 'origin/main']);
  receipt.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);
  receipt.externalOrigin = runGit(EXTERNAL_PACKAGE_ROOT, ['remote', 'get-url', '--all', 'origin']);

  const failures = [];
  if (receipt.coreWorktree) failures.push('core worktree is dirty');
  if (receipt.externalWorktree) failures.push('external worktree is dirty');
  if (receipt.externalHEAD !== EXPECTED_EXTERNAL_HEAD) failures.push('external HEAD does not match expected Gate 51B value');
  if (receipt.externalOriginMain !== EXPECTED_EXTERNAL_HEAD) failures.push('external origin/main does not match expected Gate 51B value');
  if (!fs.existsSync(EXTERNAL_PACKAGE_ROOT)) failures.push('external package root is missing');
  if (!fs.existsSync(TARGET_PLUGIN_PATH)) failures.push('target external plugin path is missing');

  if (failures.length > 0) {
    throw new Error(`preflight blocked: ${failures.join('; ')}`);
  }
}

function assertExternalIdentity(receipt) {
  const manifestPath = path.join(TARGET_PLUGIN_PATH, 'plugin-manifest.json');
  const sourcePath = path.join(TARGET_PLUGIN_PATH, 'AIGentOrchestrator.js');
  const failures = [];

  if (!fs.existsSync(manifestPath)) failures.push('target external plugin manifest is missing');
  if (!fs.existsSync(sourcePath)) failures.push('target external plugin source is missing');
  if (path.resolve(TARGET_PLUGIN_PATH) === path.resolve(CORE_FALLBACK_PATH)) {
    failures.push('target external plugin path resolves to core fallback path');
  }
  if (EXACT_RUNTIME_ALLOWLIST !== String.raw`JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`) {
    failures.push('exact runtime allowlist does not match authorized value');
  }

  if (failures.length > 0) {
    throw new Error(`identity preflight blocked: ${failures.join('; ')}`);
  }

  const manifest = readJsonFile(manifestPath);
  receipt.manifestName = manifest.name || null;
  receipt.manifestEntrypoint = manifest.entryPoint?.command || null;
  receipt.manifestPluginType = manifest.pluginType || null;
  receipt.manifestCommunicationProtocol = manifest.communication?.protocol || null;

  if (receipt.manifestName !== TARGET_PLUGIN_NAME) failures.push(`unexpected manifest name: ${receipt.manifestName || '(missing)'}`);
  if (receipt.manifestEntrypoint !== 'node AIGentOrchestrator.js') failures.push(`unexpected manifest entrypoint: ${receipt.manifestEntrypoint || '(missing)'}`);
  if (receipt.manifestPluginType !== 'synchronous') failures.push(`unexpected manifest plugin type: ${receipt.manifestPluginType || '(missing)'}`);
  if (receipt.manifestCommunicationProtocol !== 'stdio') failures.push(`unexpected manifest communication protocol: ${receipt.manifestCommunicationProtocol || '(missing)'}`);

  if (failures.length > 0) {
    throw new Error(`identity blocked: ${failures.join('; ')}`);
  }

  receipt.coreFallbackUsed = false;
}

function main() {
  const request = buildRequest();
  const receipt = buildBaseReceipt(request);

  try {
    assertRequestShape(request);
    assertCleanState(receipt);
    assertExternalIdentity(receipt);
    receipt.result = 'PASS';
  } catch (error) {
    receipt.error = error.message;
    receipt.result = 'BLOCKED';
    process.exitCode = 1;
  }

  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRequest,
  assertRequestShape,
  buildBaseReceipt,
  assertExternalIdentity,
  EXACT_RUNTIME_ALLOWLIST,
  TARGET_PLUGIN_NAME,
  TARGET_PLUGIN_PATH
};
