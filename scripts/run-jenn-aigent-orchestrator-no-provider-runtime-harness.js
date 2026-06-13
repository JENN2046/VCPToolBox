#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXTERNAL_PACKAGE_ROOT = path.resolve(PROJECT_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXTERNAL_PLUGIN_ROOT = path.join(EXTERNAL_PACKAGE_ROOT, 'Plugin');
const TARGET_PLUGIN_PATH = path.join(EXTERNAL_PLUGIN_ROOT, 'JennAIGentOrchestrator');
const CORE_FALLBACK_PATH = path.join(PROJECT_ROOT, 'Plugin', 'AIGentOrchestrator');
const EXPECTED_EXTERNAL_HEAD = 'f7772c654c2d8d34698f2818fde02ec63df783cb';
const TARGET_PLUGIN_NAME = 'JennAIGentOrchestrator';
const TARGET_ENTRYPOINT_COMMAND = 'node AIGentOrchestrator.js';
const EXACT_RUNTIME_ALLOWLIST = `${TARGET_PLUGIN_NAME}@${TARGET_PLUGIN_PATH}`;
const REQUEST_ID = 'gate51b-jenn-aigent-orchestrator-bounded-stage1-identity';
const STAGE2_REQUEST_ID = 'gate55-jenn-aigent-orchestrator-bounded-stage2-direct-stdio';
const STAGE2_TIMEOUT_MS = 15000;
const STAGE2_MAX_OUTPUT_BYTES = 64 * 1024;
const STAGE2_ARG = '--stage2-direct-stdio-no-provider-probe';
const STAGE3_ARG = '--stage3-bounded-runtime-resolution-probe';
const STAGE3_TIMEOUT_MS = 15000;
const STAGE4_ARG = '--stage4-harness-only-resolution-guard';

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

function buildStage2Request() {
  return {
    ...buildRequest(),
    requestId: STAGE2_REQUEST_ID,
    user_input: 'Gate 55 bounded no-provider Stage 2 direct stdio probe request shape',
    requested_by: 'gate-55-bounded-stage2-no-provider-probe'
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

function buildStage2Receipt(stage1Receipt, request) {
  return {
    gate: 'Gate 55 AIGentOrchestrator bounded Stage 2 no-provider probe',
    stage: 'stage2_direct_stdio_no_provider_probe',
    coreHEAD: stage1Receipt.coreHEAD,
    coreOriginMain: stage1Receipt.coreOriginMain,
    coreWorktree: stage1Receipt.coreWorktree,
    externalHEAD: stage1Receipt.externalHEAD,
    externalOriginMain: stage1Receipt.externalOriginMain,
    externalWorktree: stage1Receipt.externalWorktree,
    externalOrigin: stage1Receipt.externalOrigin,
    exactExternalPluginPath: TARGET_PLUGIN_PATH,
    exactRuntimeAllowlist: EXACT_RUNTIME_ALLOWLIST,
    entrypointCommand: TARGET_ENTRYPOINT_COMMAND,
    workingDirectory: TARGET_PLUGIN_PATH,
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
    coreFallbackUsed: false,
    childProcessStarted: false,
    childTimeoutMs: STAGE2_TIMEOUT_MS,
    childTimedOut: false,
    childKilled: false,
    childExitCode: null,
    childSignal: null,
    stdoutJsonParse: 'not_started',
    responseStatus: null,
    responseSafety: null,
    filesModified: {
      coreWorktree: null,
      externalWorktree: null
    },
    result: 'BLOCKED'
  };
}

function buildStage3Receipt() {
  return {
    gate: 'Gate 59 AIGentOrchestrator bounded runtime resolution probe',
    stage: 'stage3_bounded_runtime_resolution_probe',
    coreHEAD: null,
    coreOriginMain: null,
    coreWorktree: null,
    externalHEAD: null,
    externalOriginMain: null,
    externalWorktree: null,
    externalOrigin: null,
    exactAllowlist: EXACT_RUNTIME_ALLOWLIST,
    resolvedPluginPath: null,
    pluginIdentity: null,
    manifestPath: null,
    coreFallbackUsed: null,
    broadPluginManagerLoadPluginsInvoked: false,
    processToolCallInvoked: false,
    providerCalls: 'not_called',
    downstreamDispatch: 'not_dispatched',
    localStateWrites: 'not_written',
    serverRouteActivation: 'not_started',
    realImageGeneration: 'not_started',
    runtimeDryRunExecuted: false,
    planImagePipelineExecuted: false,
    executionHandoffOccurred: false,
    childProcessStarted: false,
    childProcessResidual: false,
    timeoutMs: STAGE3_TIMEOUT_MS,
    timedOut: false,
    timeoutHangContainment: 'metadata_only_no_child_process_no_execution_handoff',
    filesModified: {
      coreWorktree: null,
      externalWorktree: null
    },
    result: 'BLOCKED'
  };
}

function buildStage4Receipt() {
  return {
    gate: 'Gate 64 AIGentOrchestrator harness-only resolution guard',
    stage: 'stage4-harness-only-resolution-guard',
    result: 'FAIL',
    classification: 'HARNESS_ONLY_RESOLUTION_GUARD_BLOCKED',
    coreHEAD: null,
    coreOriginMain: null,
    coreWorktree: null,
    externalHEAD: null,
    externalOriginMain: null,
    externalWorktree: null,
    externalOrigin: null,
    exactExternalAllowlist: EXACT_RUNTIME_ALLOWLIST,
    exactAllowlistParsed: false,
    allowlistType: null,
    wildcardAllowlistUsed: null,
    nameOnlyAllowlistUsed: null,
    packageRootAllowlistUsed: null,
    localStateRootAllowlistUsed: null,
    resolvedExternalPluginPath: null,
    externalPathResolved: false,
    resolvedPathIsExternalPackagePath: false,
    manifestPath: null,
    manifestIdentity: null,
    manifestIdentityMatched: false,
    coreFallback: null,
    executionHandoff: false,
    pluginManagerLoadPluginsInvoked: false,
    processToolCallInvoked: false,
    planImagePipelineExecuted: false,
    providerCalls: false,
    downstreamDispatch: false,
    localStateWrites: false,
    serverRouteActivation: false,
    imageGeneration: false,
    runtimeCutover: false,
    filesModified: {
      coreWorktree: null,
      externalWorktree: null
    }
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
  if (receipt.manifestEntrypoint !== TARGET_ENTRYPOINT_COMMAND) failures.push(`unexpected manifest entrypoint: ${receipt.manifestEntrypoint || '(missing)'}`);
  if (receipt.manifestPluginType !== 'synchronous') failures.push(`unexpected manifest plugin type: ${receipt.manifestPluginType || '(missing)'}`);
  if (receipt.manifestCommunicationProtocol !== 'stdio') failures.push(`unexpected manifest communication protocol: ${receipt.manifestCommunicationProtocol || '(missing)'}`);

  if (failures.length > 0) {
    throw new Error(`identity blocked: ${failures.join('; ')}`);
  }

  receipt.coreFallbackUsed = false;
}

function parseExactRuntimeAllowlist(allowlist) {
  const failures = [];
  const raw = String(allowlist || '');
  const parts = raw.split('@');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    failures.push('allowlist must be exact plugin-name@plugin-path form');
  }
  if (/[*?]/.test(raw)) {
    failures.push('wildcard allowlist is forbidden');
  }
  if (parts.length === 1 || !raw.includes('@')) {
    failures.push('name-only allowlist is forbidden');
  }

  const pluginName = parts[0] || '';
  const pluginPath = parts.slice(1).join('@');
  const resolvedPluginPath = pluginPath ? path.resolve(pluginPath) : '';
  const externalPackageRoot = path.resolve(EXTERNAL_PACKAGE_ROOT);
  const externalPluginRoot = path.resolve(EXTERNAL_PLUGIN_ROOT);
  const targetPluginPath = path.resolve(TARGET_PLUGIN_PATH);
  const coreFallbackPath = path.resolve(CORE_FALLBACK_PATH);

  if (raw !== String.raw`JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`) {
    failures.push('allowlist does not match sealed exact external value');
  }
  if (pluginName !== TARGET_PLUGIN_NAME) {
    failures.push(`allowlist plugin name mismatch: ${pluginName || '(missing)'}`);
  }
  if (resolvedPluginPath !== targetPluginPath) {
    failures.push('allowlist path does not resolve to sealed external plugin path');
  }
  if (resolvedPluginPath === externalPackageRoot || resolvedPluginPath === externalPluginRoot) {
    failures.push('package-root allowlist is forbidden');
  }
  if (/VCPToolBox-JENN-LocalState/i.test(resolvedPluginPath)) {
    failures.push('LocalState-root allowlist is forbidden');
  }
  if (resolvedPluginPath === coreFallbackPath) {
    failures.push('core fallback path is forbidden');
  }

  if (failures.length > 0) {
    throw new Error(`allowlist resolution blocked: ${failures.join('; ')}`);
  }

  return {
    pluginName,
    pluginPath,
    resolvedPluginPath
  };
}

function runStage3BoundedRuntimeResolutionProbe() {
  const receipt = buildStage3Receipt();

  try {
    assertCleanState(receipt);

    const parsedAllowlist = parseExactRuntimeAllowlist(EXACT_RUNTIME_ALLOWLIST);
    const manifestPath = path.join(parsedAllowlist.resolvedPluginPath, 'plugin-manifest.json');
    const sourcePath = path.join(parsedAllowlist.resolvedPluginPath, 'AIGentOrchestrator.js');

    receipt.resolvedPluginPath = parsedAllowlist.resolvedPluginPath;
    receipt.manifestPath = manifestPath;
    receipt.coreFallbackUsed = false;

    const failures = [];
    if (parsedAllowlist.pluginName !== TARGET_PLUGIN_NAME) {
      failures.push('resolved plugin identity does not match target');
    }
    if (!fs.existsSync(manifestPath)) {
      failures.push('manifest is missing under resolved external plugin path');
    }
    if (!fs.existsSync(sourcePath)) {
      failures.push('source is missing under resolved external plugin path');
    }
    if (path.resolve(parsedAllowlist.resolvedPluginPath) === path.resolve(CORE_FALLBACK_PATH)) {
      failures.push('resolved path fell back to core plugin path');
    }

    if (failures.length > 0) {
      throw new Error(`runtime resolution blocked: ${failures.join('; ')}`);
    }

    const manifest = readJsonFile(manifestPath);
    receipt.pluginIdentity = manifest.name || null;

    if (receipt.pluginIdentity !== TARGET_PLUGIN_NAME) {
      throw new Error(`manifest identity mismatch: ${receipt.pluginIdentity || '(missing)'}`);
    }

    receipt.filesModified.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
    receipt.filesModified.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);
    if (receipt.filesModified.coreWorktree || receipt.filesModified.externalWorktree) {
      throw new Error('worktree changed during Stage 3 resolution probe');
    }

    receipt.result = 'PASS';
  } catch (error) {
    receipt.error = error.message;
    receipt.result = 'BLOCKED';
    process.exitCode = 1;
  }

  return receipt;
}

function runStage4HarnessOnlyResolutionGuard() {
  const receipt = buildStage4Receipt();

  try {
    assertCleanState(receipt);

    const parsedAllowlist = parseExactRuntimeAllowlist(EXACT_RUNTIME_ALLOWLIST);
    receipt.exactAllowlistParsed = true;
    receipt.allowlistType = 'exact_path_entry_only';
    receipt.wildcardAllowlistUsed = false;
    receipt.nameOnlyAllowlistUsed = false;
    receipt.packageRootAllowlistUsed = false;
    receipt.localStateRootAllowlistUsed = false;
    receipt.resolvedExternalPluginPath = parsedAllowlist.resolvedPluginPath;
    receipt.externalPathResolved = true;
    receipt.resolvedPathIsExternalPackagePath = parsedAllowlist.resolvedPluginPath === path.resolve(TARGET_PLUGIN_PATH);
    receipt.coreFallback = parsedAllowlist.resolvedPluginPath === path.resolve(CORE_FALLBACK_PATH);

    const manifestPath = path.join(parsedAllowlist.resolvedPluginPath, 'plugin-manifest.json');
    receipt.manifestPath = manifestPath;

    const failures = [];
    if (parsedAllowlist.pluginName !== TARGET_PLUGIN_NAME) {
      failures.push('allowlist plugin name does not match target plugin');
    }
    if (!receipt.resolvedPathIsExternalPackagePath) {
      failures.push('resolved path is not the sealed external plugin path');
    }
    if (receipt.coreFallback) {
      failures.push('resolved path fell back to the core plugin path');
    }
    if (!fs.existsSync(manifestPath)) {
      failures.push('manifest is missing under resolved external plugin path');
    }

    if (failures.length > 0) {
      throw new Error(`harness-only resolution guard blocked: ${failures.join('; ')}`);
    }

    const manifest = readJsonFile(manifestPath);
    receipt.manifestIdentity = manifest.name || null;
    receipt.manifestIdentityMatched = receipt.manifestIdentity === TARGET_PLUGIN_NAME;

    if (!receipt.manifestIdentityMatched) {
      throw new Error(`manifest identity mismatch: ${receipt.manifestIdentity || '(missing)'}`);
    }

    receipt.filesModified.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
    receipt.filesModified.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);
    if (receipt.filesModified.coreWorktree || receipt.filesModified.externalWorktree) {
      throw new Error('worktree changed during Stage 4 harness-only resolution guard');
    }

    receipt.result = 'PASS';
    receipt.classification = 'HARNESS_ONLY_RESOLUTION_GUARD_PASS';
  } catch (error) {
    receipt.error = error.message;
    receipt.result = 'FAIL';
    receipt.classification = 'HARNESS_ONLY_RESOLUTION_GUARD_BLOCKED';
    process.exitCode = 1;
  }

  return receipt;
}

function collectBoundedOutput(current, chunk) {
  const next = current + chunk.toString();
  if (Buffer.byteLength(next, 'utf8') > STAGE2_MAX_OUTPUT_BYTES) {
    throw new Error(`child output exceeded ${STAGE2_MAX_OUTPUT_BYTES} bytes`);
  }
  return next;
}

function parsePluginStdoutJson(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) {
    throw new Error('child stdout was empty');
  }
  return JSON.parse(trimmed);
}

function runStage1IdentityProbe() {
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

  return receipt;
}

function runStage2DirectStdioNoProviderProbe(stage1Receipt = null) {
  const stage1 = stage1Receipt || runStage1IdentityProbe();
  if (stage1.result !== 'PASS') {
    return {
      ...stage1,
      gate: 'Gate 55 AIGentOrchestrator bounded Stage 2 no-provider probe',
      stage: 'stage2_direct_stdio_no_provider_probe',
      result: 'BLOCKED',
      error: `Stage 1 identity proof did not pass: ${stage1.error || 'unknown'}`
    };
  }

  const request = buildStage2Request();
  const receipt = buildStage2Receipt(stage1, request);

  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let child = null;

    function finish() {
      if (settled) return;
      settled = true;
      try {
        receipt.filesModified.coreWorktree = runGit(PROJECT_ROOT, ['status', '--short']);
        receipt.filesModified.externalWorktree = runGit(EXTERNAL_PACKAGE_ROOT, ['status', '--short']);
        if (receipt.filesModified.coreWorktree || receipt.filesModified.externalWorktree) {
          throw new Error('worktree changed during Stage 2 probe');
        }
        if (receipt.childTimedOut) {
          throw new Error(`Stage 2 child timed out after ${STAGE2_TIMEOUT_MS}ms`);
        }
        if (receipt.childExitCode !== 0) {
          throw new Error(`Stage 2 child exited with code ${receipt.childExitCode}`);
        }
        const parsed = parsePluginStdoutJson(stdout);
        receipt.stdoutJsonParse = 'pass';
        receipt.responseStatus = parsed?.status || null;
        receipt.responseSafety = parsed?.result?.safety || null;
        if (parsed?.status !== 'success') {
          throw new Error(`unexpected Stage 2 response status: ${parsed?.status || '(missing)'}`);
        }
        receipt.result = 'PASS';
      } catch (error) {
        receipt.error = error.message;
        if (receipt.stdoutJsonParse === 'not_started') receipt.stdoutJsonParse = 'blocked';
        receipt.result = 'BLOCKED';
      }
      resolve(receipt);
    }

    const timeoutId = setTimeout(() => {
      receipt.childTimedOut = true;
      if (child && child.exitCode === null) {
        receipt.childKilled = child.kill('SIGKILL');
      }
      finish();
    }, STAGE2_TIMEOUT_MS);

    try {
      child = spawn('node', ['AIGentOrchestrator.js'], {
        cwd: TARGET_PLUGIN_PATH,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AIGENT_ORCHESTRATOR_ALLOW_EXECUTION: 'false',
          AIGENT_ORCHESTRATOR_DEFAULT_MODE: 'dry-run'
        }
      });
      receipt.childProcessStarted = true;

      child.stdout.on('data', (chunk) => {
        try {
          stdout = collectBoundedOutput(stdout, chunk);
        } catch (error) {
          receipt.error = error.message;
          child.kill('SIGKILL');
        }
      });

      child.stderr.on('data', (chunk) => {
        try {
          stderr = collectBoundedOutput(stderr, chunk);
        } catch (error) {
          receipt.error = error.message;
          child.kill('SIGKILL');
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        receipt.error = error.message;
        receipt.stderr = stderr ? '[captured]' : '';
        finish();
      });

      child.on('exit', (code, signal) => {
        clearTimeout(timeoutId);
        receipt.childExitCode = code;
        receipt.childSignal = signal;
        receipt.stderr = stderr ? '[captured]' : '';
        finish();
      });

      child.stdin.end(`${JSON.stringify(request)}\n`);
    } catch (error) {
      clearTimeout(timeoutId);
      receipt.error = error.message;
      finish();
    }
  });
}

async function main() {
  if (process.argv.includes(STAGE4_ARG)) {
    const stage4Receipt = runStage4HarnessOnlyResolutionGuard();
    process.stdout.write(`${JSON.stringify(stage4Receipt, null, 2)}\n`);
    return;
  }

  if (process.argv.includes(STAGE3_ARG)) {
    const stage3Receipt = runStage3BoundedRuntimeResolutionProbe();
    process.stdout.write(`${JSON.stringify(stage3Receipt, null, 2)}\n`);
    return;
  }

  if (process.argv.includes(STAGE2_ARG)) {
    const stage2Receipt = await runStage2DirectStdioNoProviderProbe();
    if (stage2Receipt.result !== 'PASS') process.exitCode = 1;
    process.stdout.write(`${JSON.stringify(stage2Receipt, null, 2)}\n`);
    return;
  }

  const stage1Receipt = runStage1IdentityProbe();
  if (stage1Receipt.result !== 'PASS') process.exitCode = 1;
  process.stdout.write(`${JSON.stringify(stage1Receipt, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildRequest,
  buildStage2Request,
  assertRequestShape,
  buildBaseReceipt,
  buildStage2Receipt,
  assertExternalIdentity,
  parseExactRuntimeAllowlist,
  runStage1IdentityProbe,
  runStage2DirectStdioNoProviderProbe,
  runStage3BoundedRuntimeResolutionProbe,
  runStage4HarnessOnlyResolutionGuard,
  EXACT_RUNTIME_ALLOWLIST,
  STAGE2_ARG,
  STAGE2_TIMEOUT_MS,
  STAGE3_ARG,
  STAGE3_TIMEOUT_MS,
  STAGE4_ARG,
  TARGET_PLUGIN_NAME,
  TARGET_PLUGIN_PATH
};
