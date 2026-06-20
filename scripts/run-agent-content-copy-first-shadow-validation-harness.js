const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CORE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_EXTERNAL_ROOT = path.resolve(CORE_ROOT, '..', 'VCPToolBox-JENN-Extensions');
const EXPECTED_EXTERNAL_COMMIT = 'bc287826d47e89204cba536c75e9374fd6db87ab';

const additiveAgentPaths = [
  'Agent/AIImageGenExpert.txt',
  'Agent/AuditMaster.txt',
  'Agent/MemoriaSorter.txt',
  'Agent/Muse.txt',
  'Agent/动力猛兽.txt',
  'Agent/小秋.txt',
  'Agent/诺宝.txt',
];

const overrideSourcePaths = [
  'Agent/Metis.txt',
  'Agent/Nova.txt',
];

const overrideTargetPaths = [
  'AgentOverrides/Metis.txt',
  'AgentOverrides/Nova.txt',
];

const expectedManifestAgentPaths = [
  ...additiveAgentPaths,
  'Agent/README.AGENTS_OS.md',
  ...overrideTargetPaths,
  'AgentOverrides/README.AGENTS_OS.md',
];

const runtimeFilesToInspect = [
  'modules/agentManager.js',
  'adminServer.js',
  'routes/admin/agents.js',
];

const riskPathPattern = /(^|[\\/])(\.env|config\.env|state|cache|logs?|DebugLog|image|output|outputs|secrets|\.agent_board)([\\/]|$)|secret|token|credential|auth|\.(sqlite|sqlite3|db|sqlite-shm|sqlite-wal|db-shm|db-wal|log)$/i;

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function normalizeForCompare(targetPath) {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertPathInside(root, relativePath) {
  const rootCompare = normalizeForCompare(root);
  const candidate = path.resolve(root, relativePath);
  const candidateCompare = normalizeForCompare(candidate);
  if (candidateCompare !== rootCompare && !candidateCompare.startsWith(rootCompare + path.sep)) {
    throw new Error(`path escapes root: ${relativePath}`);
  }
  return candidate;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function listPackagePaths(externalRoot) {
  const output = git(['ls-files', '-co', '--exclude-standard'], externalRoot);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readManifest(externalRoot) {
  const manifestPath = assertPathInside(externalRoot, 'manifests/MANIFEST.sha256');
  const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) {
      throw new Error(`bad manifest line: ${line}`);
    }
    return { hash: match[1], relativePath: match[2] };
  });
}

function verifyManifest(externalRoot) {
  const entries = readManifest(externalRoot);
  const failures = [];
  for (const entry of entries) {
    const filePath = assertPathInside(externalRoot, entry.relativePath);
    if (!fs.existsSync(filePath)) {
      failures.push(`missing:${entry.relativePath}`);
      continue;
    }
    const actual = sha256File(filePath);
    if (actual !== entry.hash) {
      failures.push(`mismatch:${entry.relativePath}`);
    }
  }
  if (failures.length) {
    throw new Error(`manifest verification failed: ${failures.join(', ')}`);
  }
  return entries;
}

function countRuntimeEnvReferences() {
  let count = 0;
  const hits = [];
  for (const relativePath of runtimeFilesToInspect) {
    const filePath = path.join(CORE_ROOT, relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const token of ['VCP_AGENT_DIRS', 'VCP_AGENT_OVERRIDE_DIRS']) {
      if (source.includes(token)) {
        count += 1;
        hits.push(`${relativePath}:${token}`);
      }
    }
  }
  return { count, hits };
}

function requireFiles(root, pathsToCheck) {
  const missing = [];
  for (const relativePath of pathsToCheck) {
    const filePath = assertPathInside(root, relativePath);
    if (!fs.existsSync(filePath)) {
      missing.push(relativePath);
    }
  }
  if (missing.length) {
    throw new Error(`missing files: ${missing.join(', ')}`);
  }
}

function riskMatches(pathsToCheck) {
  return pathsToCheck.filter((relativePath) => riskPathPattern.test(relativePath));
}

function isEnvSet(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '';
}

function main() {
  const externalRoot = path.resolve(getArg('--external-root', DEFAULT_EXTERNAL_ROOT));
  const expectedExternalCommit = getArg('--expected-external-commit', EXPECTED_EXTERNAL_COMMIT);

  if (!fs.existsSync(externalRoot)) {
    throw new Error(`external root does not exist: ${externalRoot}`);
  }

  const externalHead = git(['rev-parse', 'HEAD'], externalRoot);
  if (externalHead !== expectedExternalCommit) {
    throw new Error(`external HEAD mismatch: expected ${expectedExternalCommit}, got ${externalHead}`);
  }

  const packagePaths = listPackagePaths(externalRoot);
  const packageRiskPaths = riskMatches(packagePaths);
  if (packageRiskPaths.length) {
    throw new Error(`package risk paths detected: ${packageRiskPaths.join(', ')}`);
  }

  const contentTargetPaths = [...additiveAgentPaths, ...overrideTargetPaths];
  const contentRiskPaths = riskMatches(contentTargetPaths);
  if (contentRiskPaths.length) {
    throw new Error(`Agent content target risk paths detected: ${contentRiskPaths.join(', ')}`);
  }

  requireFiles(externalRoot, contentTargetPaths);
  requireFiles(CORE_ROOT, [...additiveAgentPaths, ...overrideSourcePaths]);

  const manifestEntries = verifyManifest(externalRoot);
  const manifestPathSet = new Set(manifestEntries.map((entry) => entry.relativePath));
  const missingManifestAgentPaths = expectedManifestAgentPaths.filter((relativePath) => !manifestPathSet.has(relativePath));
  if (missingManifestAgentPaths.length) {
    throw new Error(`expected Agent manifest entries missing: ${missingManifestAgentPaths.join(', ')}`);
  }

  if (isEnvSet('VCP_AGENT_DIRS') || isEnvSet('VCP_AGENT_OVERRIDE_DIRS')) {
    throw new Error('Agent external runtime env vars are set in this validation process');
  }

  const runtimeEnvReferences = countRuntimeEnvReferences();

  console.log('AGENT_COPY_FIRST_SHADOW_VALIDATION_PASS');
  console.log(`EXTERNAL_ROOT=${externalRoot}`);
  console.log(`EXTERNAL_HEAD=${externalHead}`);
  console.log(`AGENT_ADDITIVE_TARGET_COUNT=${additiveAgentPaths.length}`);
  console.log(`AGENT_OVERRIDE_TARGET_COUNT=${overrideTargetPaths.length}`);
  console.log(`AGENT_CONTENT_TARGET_PATH_COUNT=${contentTargetPaths.length}`);
  console.log(`AGENT_CONTENT_TARGET_RISK_PATH_COUNT=${contentRiskPaths.length}`);
  console.log(`PACKAGE_PATH_COUNT=${packagePaths.length}`);
  console.log(`PACKAGE_RISK_PATH_COUNT=${packageRiskPaths.length}`);
  console.log(`MANIFEST_VERIFY_PASS count=${manifestEntries.length}`);
  console.log(`MANIFEST_EXPECTED_AGENT_ENTRIES_PRESENT=${expectedManifestAgentPaths.length}`);
  console.log(`CORE_AGENT_SOURCE_FILES_STILL_PRESENT=${additiveAgentPaths.length + overrideSourcePaths.length}`);
  console.log(`ENV_VCP_AGENT_DIRS_SET=${isEnvSet('VCP_AGENT_DIRS') ? 'yes' : 'no'}`);
  console.log(`ENV_VCP_AGENT_OVERRIDE_DIRS_SET=${isEnvSet('VCP_AGENT_OVERRIDE_DIRS') ? 'yes' : 'no'}`);
  console.log(`RUNTIME_AGENT_ENV_REFERENCE_COUNT=${runtimeEnvReferences.count}`);
  if (runtimeEnvReferences.hits.length) {
    console.log(`RUNTIME_AGENT_ENV_REFERENCES=${runtimeEnvReferences.hits.join(',')}`);
  }
  console.log('NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes');
  console.log('NO_SERVICE_STARTUP_EXECUTED=yes');
  console.log('NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes');
}

try {
  main();
} catch (error) {
  console.error(`AGENT_COPY_FIRST_SHADOW_VALIDATION_FAIL: ${error.message}`);
  process.exitCode = 1;
}
