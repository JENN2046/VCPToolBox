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
const LOCAL_STATE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-LocalState');
const EXPECTED_EXTERNAL_HEAD = 'f7772c654c2d8d34698f2818fde02ec63df783cb';
const TARGET_PLUGIN_NAME = 'JennAIGentOrchestrator';
const EXACT_RUNTIME_ALLOWLIST = `${TARGET_PLUGIN_NAME}@${TARGET_PLUGIN_PATH}`;
const REQUEST_ID = 'gate51-jenn-aigent-orchestrator-no-provider-runtime-harness';

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }

  return String(result.stdout || '').trim();
}

function listFilesSnapshot(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const records = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        records.push({
          relativePath: path.relative(rootPath, fullPath),
          size: stat.size,
          mtimeMs: Math.trunc(stat.mtimeMs)
        });
      }
    }
  }

  return records.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildRequest() {
  return {
    action: 'PlanImagePipeline',
    requestId: REQUEST_ID,
    user_input: 'Gate 51 inert no-provider runtime harness product image planning prompt',
    dryRun: true,
    allowProvider: false,
    allowDownstream: false,
    allowExecution: false,
    include_style_training: false,
    execute_pipeline: false,
    confirm_external_effects: false,
    requested_by: 'gate-51-no-provider-runtime-harness'
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

function applyProcessLocalRuntimeEnv() {
  process.env.VCP_PLUGIN_ALLOWED_ROOTS = EXTERNAL_PACKAGE_ROOT;
  process.env.VCP_PLUGIN_DIRS = EXTERNAL_PLUGIN_ROOT;
  process.env.VCP_EXTERNAL_PLUGIN_ALLOWLIST = EXACT_RUNTIME_ALLOWLIST;
  process.env.AIGENT_ORCHESTRATOR_ALLOW_EXECUTION = 'false';
  process.env.AIGENT_ORCHESTRATOR_DEFAULT_MODE = 'dry-run';
}

function buildBaseReceipt(request) {
  return {
    gate: 'Gate 51 AIGentOrchestrator no-provider runtime harness',
    coreHEAD: null,
    coreOriginMain: null,
    externalHEAD: null,
    externalOriginMain: null,
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
    providerCalls: 'blocked_by_request_and_unobserved',
    downstreamDispatch: 'blocked_by_request_and_unobserved',
    localStateWrites: 'unverified',
    serverRouteActivation: 'not_started',
    realImageGeneration: 'blocked_by_request_and_unobserved',
    processToolCallCount: 0,
    pluginResolvedFromExternalPath: false,
    coreFallbackUsed: null,
    planImagePipelineInvoked: false,
    planRetryPipelineInvoked: false,
    healthCheckFallbackInvoked: false,
    filesModified: {
      coreWorktree: null,
      externalWorktree: null
    },
    result: 'BLOCKED'
  };
}

function assertCleanState(receipt) {
  receipt.coreHEAD = runGit(PROJECT_ROOT, ['rev-parse', 'HEAD']);
  receipt.coreOriginMain = runGit(PROJECT_ROOT, ['rev-parse', 'origin/main']);
  receipt.externalHEAD = runGit(EXTERNAL_PACKAGE_ROOT, ['rev-parse', 'HEAD']);
  receipt.externalOriginMain = runGit(EXTERNAL_PACKAGE_ROOT, ['rev-parse', 'origin/main']);
  receipt.filesModified.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
  receipt.filesModified.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);

  const failures = [];
  if (receipt.filesModified.coreWorktree) failures.push('core worktree is dirty');
  if (receipt.filesModified.externalWorktree) failures.push('external worktree is dirty');
  if (receipt.externalHEAD !== EXPECTED_EXTERNAL_HEAD) failures.push('external HEAD does not match expected Gate 51 value');
  if (receipt.externalOriginMain !== EXPECTED_EXTERNAL_HEAD) failures.push('external origin/main does not match expected Gate 51 value');
  if (!fs.existsSync(path.join(TARGET_PLUGIN_PATH, 'plugin-manifest.json'))) failures.push('target external plugin manifest is missing');
  if (!fs.existsSync(path.join(TARGET_PLUGIN_PATH, 'AIGentOrchestrator.js'))) failures.push('target external plugin source is missing');

  if (failures.length > 0) {
    throw new Error(`preflight blocked: ${failures.join('; ')}`);
  }
}

function assertResolvedExternalPlugin(plugin) {
  if (!plugin) {
    throw new Error('target plugin was not registered');
  }

  const resolvedBasePath = path.resolve(plugin.basePath || '');
  const resolvedTarget = path.resolve(TARGET_PLUGIN_PATH);
  const resolvedCoreFallback = path.resolve(CORE_FALLBACK_PATH);

  if (plugin.name !== TARGET_PLUGIN_NAME) {
    throw new Error(`unexpected plugin name: ${plugin.name || '(missing)'}`);
  }
  if (plugin.pluginSource !== 'external') {
    throw new Error(`target plugin source is not external: ${plugin.pluginSource || '(missing)'}`);
  }
  if (resolvedBasePath !== resolvedTarget) {
    throw new Error(`target plugin resolved from unexpected path: ${resolvedBasePath}`);
  }
  if (resolvedBasePath === resolvedCoreFallback) {
    throw new Error('target plugin resolved to core fallback path');
  }

  return {
    resolvedBasePath,
    coreFallbackUsed: false
  };
}

async function main() {
  const request = buildRequest();
  const receipt = buildBaseReceipt(request);
  const beforeLocalState = listFilesSnapshot(LOCAL_STATE_ROOT);

  try {
    assertRequestShape(request);
    assertCleanState(receipt);
    applyProcessLocalRuntimeEnv();

    const pluginManager = require('../Plugin');
    await pluginManager.loadPlugins();

    const plugin = pluginManager.plugins.get(TARGET_PLUGIN_NAME);
    const resolution = assertResolvedExternalPlugin(plugin);
    receipt.pluginResolvedFromExternalPath = resolution.resolvedBasePath;
    receipt.coreFallbackUsed = resolution.coreFallbackUsed;

    const originalProcessToolCall = pluginManager.processToolCall.bind(pluginManager);
    pluginManager.processToolCall = async (...args) => {
      receipt.processToolCallCount += 1;
      return originalProcessToolCall(...args);
    };

    const result = await pluginManager.processToolCall(TARGET_PLUGIN_NAME, request, '127.0.0.1', {
      source: 'gate-51-no-provider-runtime-harness',
      dryRun: true,
      allowProvider: false,
      allowDownstream: false,
      allowExecution: false
    });

    receipt.planImagePipelineInvoked = true;
    receipt.planRetryPipelineInvoked = false;
    receipt.healthCheckFallbackInvoked = false;
    receipt.pluginResultStatus = result?.status || null;
    receipt.pluginResultSafety = result?.result?.safety || null;

    const afterLocalState = listFilesSnapshot(LOCAL_STATE_ROOT);
    receipt.localStateWrites = snapshotsEqual(beforeLocalState, afterLocalState) ? 'none_observed' : 'changed';
    if (receipt.localStateWrites !== 'none_observed') {
      throw new Error('LocalState changed during harness execution');
    }

    receipt.filesModified.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
    receipt.filesModified.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);
    if (receipt.filesModified.coreWorktree || receipt.filesModified.externalWorktree) {
      throw new Error('worktree changed during harness execution');
    }

    if (receipt.processToolCallCount !== 1) {
      throw new Error(`unexpected processToolCall count: ${receipt.processToolCallCount}`);
    }

    receipt.result = 'PASS';
  } catch (error) {
    receipt.error = error.message;
    receipt.result = 'BLOCKED';
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  } finally {
    try {
      const pluginManager = require.cache[require.resolve('../Plugin')]?.exports;
      if (pluginManager && typeof pluginManager.shutdownAllPlugins === 'function') {
        await pluginManager.shutdownAllPlugins();
      }
    } catch (error) {
      receipt.shutdownError = error.message;
      if (receipt.result === 'PASS') {
        receipt.result = 'BLOCKED';
        process.exitCode = 1;
      }
    }
  }

  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRequest,
  assertRequestShape,
  EXACT_RUNTIME_ALLOWLIST,
  TARGET_PLUGIN_NAME,
  TARGET_PLUGIN_PATH
};
