#!/usr/bin/env node
'use strict';

const path = require('path');
const { fileURLToPath } = require('url');
const fs = require('fs');
const childProcess = require('child_process');
const http = require('http');
const https = require('https');
const Module = require('module');

const GUARD_BLOCKED_ERROR_CODE = 'AIGENTQUALITY_S2_GUARD_BLOCKED';
const ALLOWED_LISTEN_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

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

function normalizeMaybePath(value) {
  if (!value) return null;
  if (typeof value === 'string') return path.resolve(value);
  if (Buffer.isBuffer(value)) return path.resolve(value.toString());
  if (value instanceof URL && value.protocol === 'file:') {
    return path.resolve(fileURLToPath(value));
  }
  return null;
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

function isWriteOpenFlag(flags) {
  if (typeof flags === 'number') {
    const constants = fs.constants || {};
    const writeMask =
      (constants.O_WRONLY || 0) |
      (constants.O_RDWR || 0) |
      (constants.O_CREAT || 0) |
      (constants.O_TRUNC || 0) |
      (constants.O_APPEND || 0);
    return (flags & writeMask) !== 0;
  }
  const flagText = typeof flags === 'string' ? flags : 'r';
  return /[wa+]/.test(flagText);
}

function createGuardBlockedError(apiName, targetPath, reason) {
  const error = new Error(
    `AIGentQuality S2 preload guard blocked ${apiName}: ${reason}`,
  );
  error.code = GUARD_BLOCKED_ERROR_CODE;
  error.apiName = apiName;
  error.targetPath = targetPath;
  error.guardReason = reason;
  return error;
}

function parseExplicitListenHost(args) {
  if (args.length === 0) {
    return {
      host: null,
      allowed: false,
      reason: 'listen host is not explicit',
    };
  }

  const [firstArg, secondArg] = args;
  if (
    firstArg &&
    typeof firstArg === 'object' &&
    !(firstArg instanceof Number) &&
    !(firstArg instanceof String)
  ) {
    const hasHost = Object.prototype.hasOwnProperty.call(firstArg, 'host');
    const hasPort = Object.prototype.hasOwnProperty.call(firstArg, 'port');
    const hasPath = Object.prototype.hasOwnProperty.call(firstArg, 'path');
    const hasFd = Object.prototype.hasOwnProperty.call(firstArg, 'fd');
    const host =
      hasHost && typeof firstArg.host === 'string' ? firstArg.host : null;
    const isExplicitTcpHost =
      hasPort && !hasPath && !hasFd && host && ALLOWED_LISTEN_HOSTS.has(host);
    return {
      host,
      allowed: Boolean(isExplicitTcpHost),
      reason: isExplicitTcpHost
        ? 'explicit listen options host'
        : host
          ? 'listen options host is not localhost'
          : 'listen options must specify TCP port and localhost host',
    };
  }

  if (typeof firstArg === 'number') {
    const host = typeof secondArg === 'string' ? secondArg : null;
    const isExplicitHost = host && ALLOWED_LISTEN_HOSTS.has(host);
    return {
      host,
      allowed: Boolean(isExplicitHost),
      reason: isExplicitHost
        ? 'explicit listen host argument'
        : host
          ? 'listen host argument is not localhost'
          : 'listen host argument is not explicit',
    };
  }

  return {
    host: null,
    allowed: false,
    reason: 'listen overload has no explicit TCP localhost host',
  };
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

function createGuardState(options = {}) {
  const projectRoot = normalizePathForReceipt(options.projectRoot);
  const externalPackageRoot = normalizePathForReceipt(
    options.externalPackageRoot,
  );
  const runRoot = normalizePathForReceipt(options.runRoot);
  const harnessConfigPath = normalizePathForReceipt(options.harnessConfigPath);
  const allowedReadRoots = (options.allowedReadRoots || []).map(
    normalizePathForReceipt,
  );
  const allowedReadFiles = new Set(
    (options.allowedReadFiles || []).map(normalizePathForReceipt),
  );
  const failures = [];

  if (!projectRoot) failures.push('projectRoot is required');
  if (!externalPackageRoot) failures.push('externalPackageRoot is required');
  if (!runRoot) failures.push('runRoot is required');
  if (!harnessConfigPath) failures.push('harnessConfigPath is required');
  if (harnessConfigPath && runRoot && !isPathUnder(harnessConfigPath, runRoot)) {
    failures.push('harnessConfigPath must resolve under runRoot');
  }

  if (failures.length > 0) {
    const error = new Error(failures.join('; '));
    error.code = 'AIGENTQUALITY_S2_GUARD_CONFIG_INVALID';
    throw error;
  }

  return {
    projectRoot,
    externalPackageRoot,
    runRoot,
    harnessConfigPath,
    allowedReadRoots,
    allowedReadFiles,
    events: [],
    blocked: [],
    allowed: [],
    installed: [],
    uninstalled: false,
  };
}

function recordGuardEvent(state, entry) {
  const event = {
    at: new Date().toISOString(),
    ...entry,
  };
  state.events.push(event);
  if (event.decision === 'blocked') state.blocked.push(event);
  if (event.decision === 'allowed') state.allowed.push(event);
}

function isAllowedReadTarget(state, targetPath) {
  if (!targetPath) return false;
  if (isPathUnder(targetPath, state.runRoot)) return true;
  if (state.allowedReadFiles.has(path.resolve(targetPath))) return true;
  return state.allowedReadRoots.some((root) => isPathUnder(targetPath, root));
}

function guardPathAccess(state, apiName, target, accessKind) {
  const targetPath = normalizeMaybePath(target);
  if (!targetPath) {
    recordGuardEvent(state, {
      apiName,
      accessKind,
      targetPath: null,
      decision: 'blocked',
      reason: 'target path could not be resolved',
    });
    throw createGuardBlockedError(
      apiName,
      null,
      'target path could not be resolved',
    );
  }

  const underProjectRoot = isPathUnder(targetPath, state.projectRoot);
  const underExternalPackageRoot = isPathUnder(
    targetPath,
    state.externalPackageRoot,
  );

  if (accessKind === 'read' || accessKind === 'directory-read') {
    if (isAllowedReadTarget(state, targetPath)) {
      recordGuardEvent(state, {
        apiName,
        accessKind,
        targetPath,
        decision: 'allowed',
        reason: 'allowed read target',
      });
      return targetPath;
    }
    if (underProjectRoot || underExternalPackageRoot) {
      recordGuardEvent(state, {
        apiName,
        accessKind,
        targetPath,
        decision: 'blocked',
        reason: 'repository read target is not allowlisted',
      });
      throw createGuardBlockedError(
        apiName,
        targetPath,
        'repository read target is not allowlisted',
      );
    }
  }

  if (accessKind === 'write' || accessKind === 'watch') {
    if (isPathUnder(targetPath, state.runRoot)) {
      recordGuardEvent(state, {
        apiName,
        accessKind,
        targetPath,
        decision: 'allowed',
        reason: 'allowed temp run root target',
      });
      return targetPath;
    }
    recordGuardEvent(state, {
      apiName,
      accessKind,
      targetPath,
      decision: 'blocked',
      reason: 'write/watch target is outside runRoot',
    });
    throw createGuardBlockedError(
      apiName,
      targetPath,
      'write/watch target is outside runRoot',
    );
  }

  recordGuardEvent(state, {
    apiName,
    accessKind,
    targetPath,
    decision: 'allowed',
    reason: 'outside guarded repository roots',
  });
  return targetPath;
}

function wrapMethod(restores, target, methodName, replacementFactory) {
  const original = target && target[methodName];
  if (typeof original !== 'function') return false;
  target[methodName] = replacementFactory(original);
  restores.push(() => {
    target[methodName] = original;
  });
  return true;
}

function installFsReadGuards(state, restores) {
  for (const methodName of ['readFile', 'readFileSync', 'createReadStream']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsRead(firstArg, ...rest) {
          guardPathAccess(state, `fs.${methodName}`, firstArg, 'read');
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['stat', 'statSync', 'access', 'accessSync', 'existsSync']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsMetadata(firstArg, ...rest) {
          guardPathAccess(state, `fs.${methodName}`, firstArg, 'read');
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['readdir', 'readdirSync', 'opendir', 'opendirSync']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsDirectory(firstArg, ...rest) {
          guardPathAccess(
            state,
            `fs.${methodName}`,
            firstArg,
            'directory-read',
          );
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of [
    'readFile',
    'stat',
    'access',
    'readdir',
    'opendir',
  ]) {
    if (
      fs.promises &&
      wrapMethod(restores, fs.promises, methodName, (original) =>
        function guardedFsPromisesRead(firstArg, ...rest) {
          const accessKind =
            methodName === 'readdir' || methodName === 'opendir'
              ? 'directory-read'
              : 'read';
          guardPathAccess(
            state,
            `fs.promises.${methodName}`,
            firstArg,
            accessKind,
          );
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.promises.${methodName}`);
    }
  }

  if (fs.promises) {
    wrapMethod(restores, fs.promises, 'open', (original) =>
      async function guardedFsPromisesOpen(firstArg, flags, ...rest) {
        guardPathAccess(
          state,
          'fs.promises.open',
          firstArg,
          isWriteOpenFlag(flags) ? 'write' : 'read',
        );
        const handle = await original.call(this, firstArg, flags, ...rest);
        return createGuardedFileHandle(state, firstArg, handle);
      },
    );
    state.installed.push('fs.promises.open');
  }
}

function createGuardedFileHandle(state, filePath, handle) {
  if (!handle || typeof handle !== 'object') return handle;
  return new Proxy(handle, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (['read', 'readFile', 'createReadStream'].includes(property)) {
        return function guardedHandleRead(...args) {
          guardPathAccess(
            state,
            `FileHandle.${String(property)}`,
            filePath,
            'read',
          );
          return value.apply(target, args);
        };
      }
      if (
        ['write', 'writeFile', 'appendFile', 'createWriteStream'].includes(
          property,
        )
      ) {
        return function guardedHandleWrite(...args) {
          guardPathAccess(
            state,
            `FileHandle.${String(property)}`,
            filePath,
            'write',
          );
          return value.apply(target, args);
        };
      }
      return value.bind(target);
    },
  });
}

function installFsWriteWatchGuards(state, restores) {
  const writeMethods = [
    'writeFile',
    'writeFileSync',
    'appendFile',
    'appendFileSync',
    'mkdir',
    'mkdirSync',
    'unlink',
    'unlinkSync',
    'rm',
    'rmSync',
    'createWriteStream',
  ];

  for (const methodName of writeMethods) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsWrite(firstArg, ...rest) {
          guardPathAccess(state, `fs.${methodName}`, firstArg, 'write');
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['rename', 'renameSync']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsRename(fromPath, toPath, ...rest) {
          guardPathAccess(state, `fs.${methodName}:from`, fromPath, 'write');
          guardPathAccess(state, `fs.${methodName}:to`, toPath, 'write');
          return original.call(this, fromPath, toPath, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['copyFile', 'copyFileSync', 'cp', 'cpSync']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsCopy(fromPath, toPath, ...rest) {
          guardPathAccess(state, `fs.${methodName}:from`, fromPath, 'read');
          guardPathAccess(state, `fs.${methodName}:to`, toPath, 'write');
          return original.call(this, fromPath, toPath, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['open', 'openSync']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsOpen(firstArg, flags, ...rest) {
          guardPathAccess(
            state,
            `fs.${methodName}`,
            firstArg,
            isWriteOpenFlag(flags) ? 'write' : 'read',
          );
          return original.call(this, firstArg, flags, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  for (const methodName of ['watch', 'watchFile']) {
    if (
      wrapMethod(restores, fs, methodName, (original) =>
        function guardedFsWatch(firstArg, ...rest) {
          guardPathAccess(state, `fs.${methodName}`, firstArg, 'watch');
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.${methodName}`);
    }
  }

  const promiseWriteMethods = [
    'writeFile',
    'appendFile',
    'mkdir',
    'unlink',
    'rm',
  ];
  for (const methodName of promiseWriteMethods) {
    if (
      fs.promises &&
      wrapMethod(restores, fs.promises, methodName, (original) =>
        function guardedFsPromisesWrite(firstArg, ...rest) {
          guardPathAccess(
            state,
            `fs.promises.${methodName}`,
            firstArg,
            'write',
          );
          return original.call(this, firstArg, ...rest);
        },
      )
    ) {
      state.installed.push(`fs.promises.${methodName}`);
    }
  }

  if (fs.promises) {
    for (const methodName of ['rename']) {
      if (
        wrapMethod(restores, fs.promises, methodName, (original) =>
          function guardedFsPromisesRename(fromPath, toPath, ...rest) {
            guardPathAccess(
              state,
              `fs.promises.${methodName}:from`,
              fromPath,
              'write',
            );
            guardPathAccess(
              state,
              `fs.promises.${methodName}:to`,
              toPath,
              'write',
            );
            return original.call(this, fromPath, toPath, ...rest);
          },
        )
      ) {
        state.installed.push(`fs.promises.${methodName}`);
      }
    }

    for (const methodName of ['copyFile', 'cp']) {
      if (
        wrapMethod(restores, fs.promises, methodName, (original) =>
          function guardedFsPromisesCopy(fromPath, toPath, ...rest) {
            guardPathAccess(
              state,
              `fs.promises.${methodName}:from`,
              fromPath,
              'read',
            );
            guardPathAccess(
              state,
              `fs.promises.${methodName}:to`,
              toPath,
              'write',
            );
            return original.call(this, fromPath, toPath, ...rest);
          },
        )
      ) {
        state.installed.push(`fs.promises.${methodName}`);
      }
    }
  }
}

function installProcessAndListenGuards(state, restores) {
  for (const methodName of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ]) {
    if (
      wrapMethod(restores, childProcess, methodName, (original) =>
        function guardedChildProcess(...args) {
          recordGuardEvent(state, {
            apiName: `child_process.${methodName}`,
            accessKind: 'child-process',
            targetPath: null,
            decision: 'blocked',
            reason: 'child process execution is forbidden in preload guard',
          });
          throw createGuardBlockedError(
            `child_process.${methodName}`,
            null,
            'child process execution is forbidden in preload guard',
          );
        },
      )
    ) {
      state.installed.push(`child_process.${methodName}`);
    }
  }

  const guardListen = (protocol, original) =>
    function guardedListen(...args) {
      const listenTarget = parseExplicitListenHost(args);
      recordGuardEvent(state, {
        apiName: `${protocol}.Server.listen`,
        accessKind: 'listen',
        targetPath: null,
        decision: listenTarget.allowed ? 'allowed' : 'blocked',
        reason: listenTarget.allowed
          ? 'localhost-only listen target'
          : listenTarget.reason,
        host: listenTarget.host,
      });
      if (!listenTarget.allowed) {
        throw createGuardBlockedError(
          `${protocol}.Server.listen`,
          null,
          listenTarget.reason,
        );
      }
      return original.apply(this, args);
    };

  if (wrapMethod(restores, http.Server.prototype, 'listen', (original) => guardListen('http', original))) {
    state.installed.push('http.Server.listen');
  }
  if (wrapMethod(restores, https.Server.prototype, 'listen', (original) => guardListen('https', original))) {
    state.installed.push('https.Server.listen');
  }
}

function installModuleLoadGuards(state, restores) {
  const originalLoad = Module._load;
  Module._load = function guardedModuleLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request === 'chokidar' && loaded && typeof loaded.watch === 'function') {
      return {
        ...loaded,
        watch(firstArg, ...rest) {
          guardPathAccess(state, 'chokidar.watch', firstArg, 'watch');
          return loaded.watch.call(this, firstArg, ...rest);
        },
      };
    }
    if (request === 'dotenv' && loaded && typeof loaded.config === 'function') {
      return {
        ...loaded,
        config(options = {}) {
          const dotenvPath =
            options && options.path
              ? options.path
              : path.join(process.cwd(), '.env');
          guardPathAccess(state, 'dotenv.config', dotenvPath, 'read');
          return loaded.config.call(this, options);
        },
      };
    }
    return loaded;
  };
  restores.push(() => {
    Module._load = originalLoad;
  });
  state.installed.push('Module._load chokidar/dotenv guard');
}

function buildPreloadGuardInstallReceipt(state) {
  return {
    mode: 'aigentquality-s2-preload-guard-install',
    installedInCurrentProcess: !state.uninstalled,
    realServerStartAuthorized: false,
    projectRoot: state.projectRoot,
    externalPackageRoot: state.externalPackageRoot,
    runRoot: state.runRoot,
    harnessConfigPath: state.harnessConfigPath,
    requiredGuardGroups: [...REQUIRED_GUARD_GROUPS],
    installedGuardApis: [...state.installed],
    blockedEvents: [...state.blocked],
    allowedEvents: [...state.allowed],
    eventCount: state.events.length,
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
  };
}

function installPreloadGuards(options = {}) {
  const state = createGuardState(options);
  const restores = [];

  installFsReadGuards(state, restores);
  installFsWriteWatchGuards(state, restores);
  installProcessAndListenGuards(state, restores);
  installModuleLoadGuards(state, restores);

  return {
    receipt() {
      return buildPreloadGuardInstallReceipt(state);
    },
    uninstall() {
      while (restores.length > 0) {
        const restore = restores.pop();
        restore();
      }
      state.uninstalled = true;
      return buildPreloadGuardInstallReceipt(state);
    },
    _state: state,
  };
}

async function expectGuardBlock(receipt, name, action) {
  try {
    await action();
    receipt.probes.push({
      name,
      ok: false,
      blocked: false,
      errorCode: '',
    });
  } catch (error) {
    receipt.probes.push({
      name,
      ok: error && error.code === GUARD_BLOCKED_ERROR_CODE,
      blocked: error && error.code === GUARD_BLOCKED_ERROR_CODE,
      errorCode: error && error.code ? error.code : '',
    });
  }
}

async function runPreloadGuardSyntheticProbe(options = {}) {
  const controller = installPreloadGuards(options);
  const receipt = {
    mode: 'aigentquality-s2-preload-guard-synthetic-probe',
    startedServer: false,
    importedServer: false,
    spawnedServer: false,
    boundPort: false,
    executedPlugin: false,
    networkOrProviderCalls: false,
    wroteRuntimeFiles: false,
    probes: [],
    installReceiptBeforeProbe: controller.receipt(),
    installReceiptAfterProbe: null,
    uninstallReceipt: null,
    result: 'PRELOAD_GUARD_PROBE_BLOCKED',
  };

  const projectRoot = options.projectRoot;
  const externalPackageRoot = options.externalPackageRoot;

  try {
    await expectGuardBlock(receipt, 'block repository config read', () =>
      fs.readFileSync(path.join(projectRoot, 'config.env'), 'utf8'),
    );
    await expectGuardBlock(receipt, 'block repository directory read', () =>
      fs.readdirSync(projectRoot),
    );
    await expectGuardBlock(receipt, 'block repository write', () =>
      fs.writeFileSync(path.join(projectRoot, 'tmp', 'guard-probe.txt'), 'x'),
    );
    await expectGuardBlock(receipt, 'block promises copy destination write', () =>
      fs.promises.copyFile(
        path.join(options.runRoot, 'missing-source.txt'),
        path.join(projectRoot, 'tmp', 'guard-copy.txt'),
      ),
    );
    await expectGuardBlock(receipt, 'block repository watch', () =>
      fs.watch(projectRoot, () => {}),
    );
    await expectGuardBlock(receipt, 'block child process spawn', () =>
      childProcess.spawnSync(process.execPath, ['--version']),
    );
    await expectGuardBlock(receipt, 'block implicit listen host', () => {
      const server = http.createServer();
      try {
        server.listen(0);
      } finally {
        server.close();
      }
    });
    await expectGuardBlock(receipt, 'block non-localhost listen', () => {
      const server = http.createServer();
      try {
        server.listen(0, '0.0.0.0');
      } finally {
        server.close();
      }
    });
    await expectGuardBlock(receipt, 'block options implicit listen host', () => {
      const server = http.createServer();
      try {
        server.listen({ port: 0 });
      } finally {
        server.close();
      }
    });
    await expectGuardBlock(receipt, 'block options non-localhost listen', () => {
      const server = http.createServer();
      try {
        server.listen({ port: 0, host: '0.0.0.0' });
      } finally {
        server.close();
      }
    });
  } finally {
    receipt.installReceiptAfterProbe = controller.receipt();
    receipt.uninstallReceipt = controller.uninstall();
  }

  const probesOk = receipt.probes.every((probe) => probe.ok);
  receipt.result = probesOk
    ? 'PRELOAD_GUARD_PROBE_READY'
    : 'PRELOAD_GUARD_PROBE_BLOCKED';
  return receipt;
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
  runPreloadGuardSyntheticProbe,
};
