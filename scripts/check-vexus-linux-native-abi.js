'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const binaryPath = path.join(
  repositoryRoot,
  'rust-vexus-lite',
  'vexus-lite.linux-x64-gnu.node'
);
const maximumAllowed = process.env.MAX_ALLOWED_GLIBC || '2.35';

function versionParts(value) {
  if (!/^\d+(?:\.\d+)+$/u.test(value)) {
    throw new Error(`invalid GLIBC version: ${value}`);
  }
  return value.split('.').map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function requiredGlibcVersions(file) {
  const symbols = execFileSync('objdump', ['-T', file], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  return [...symbols.matchAll(/GLIBC_(\d+(?:\.\d+)+)/gu)]
    .map(match => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort(compareVersions);
}

function assertFunctionSurface(value, names, label) {
  const missing = names.filter(name => typeof value[name] !== 'function');
  if (missing.length > 0) {
    throw new Error(`${label} functions missing: ${missing.join(', ')}`);
  }
}

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('this gate requires Linux x64');
}
if (!fs.statSync(binaryPath).isFile()) {
  throw new Error('Linux x64 GNU native binary is missing');
}

const versions = requiredGlibcVersions(binaryPath);
const maximumObserved = versions.at(-1);
if (!maximumObserved || compareVersions(maximumObserved, maximumAllowed) > 0) {
  throw new Error(
    `GLIBC requirement ${maximumObserved || 'unknown'} exceeds ${maximumAllowed}`
  );
}

const nativeModule = require(path.join(repositoryRoot, 'rust-vexus-lite'));
assertFunctionSurface(nativeModule, [
  'VexusIndex',
  'VexusWatcher',
  'clearRivermemoTopologyV3Cache',
  'rerankRivermemoTopologyV3'
], 'native module');
assertFunctionSurface(nativeModule.VexusIndex, ['load'], 'VexusIndex static');
assertFunctionSurface(nativeModule.VexusIndex.prototype, [
  'add',
  'addBatch',
  'clearMemoRuntime',
  'computeEpaBasis',
  'computeHandshakes',
  'computeIntrinsicResiduals',
  'computeOrthogonalProjection',
  'computePairwiseSimilarities',
  'computeSvd',
  'fuseMemoContext',
  'memoRuntimeStats',
  'project',
  'projectDualWeighted',
  'publishEpaBasisCache',
  'rebuildMemoArtifact',
  'recoverFromSqlite',
  'remove',
  'rerankMemoDtsc',
  'rerankRivermemoTopologyV3',
  'runMemoPipeline',
  'save',
  'search',
  'senseMemoQuery',
  'stats',
], 'VexusIndex');
assertFunctionSurface(nativeModule.VexusWatcher.prototype, [
  'startWatch',
  'stopWatch'
], 'VexusWatcher');

const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vexus-native-abi-'));
try {
  const index = new nativeModule.VexusIndex(4, 16);
  index.add(1, new Float32Array([1, 0, 0, 0]));
  index.add(2, new Float32Array([0, 1, 0, 0]));
  const firstSearch = index.search(new Float32Array([1, 0, 0, 0]), 2);
  if (!Array.isArray(firstSearch) || firstSearch[0]?.id !== 1) {
    throw new Error('VexusIndex add/search smoke failed');
  }

  const scratchIndex = path.join(scratchRoot, 'minimal.usearch');
  index.save(scratchIndex);
  const loaded = nativeModule.VexusIndex.load(scratchIndex, null, 4, 16);
  const secondSearch = loaded.search(new Float32Array([0, 1, 0, 0]), 2);
  if (!Array.isArray(secondSearch) || secondSearch[0]?.id !== 2) {
    throw new Error('VexusIndex save/load smoke failed');
  }
  loaded.clearMemoRuntime();
  index.clearMemoRuntime();

  process.env.KNOWLEDGEBASE_ROOT_PATH = path.join(scratchRoot, 'diary');
  process.env.KNOWLEDGEBASE_STORE_PATH = path.join(scratchRoot, 'vector');
  process.env.VECTORDB_DIMENSION = '4';
  const manager = require(path.join(repositoryRoot, 'KnowledgeBaseManager.js'));
  assertFunctionSurface(manager, ['initialize', 'shutdown'], 'KnowledgeBaseManager');

  console.log(JSON.stringify({
    abiContract: 'PASS',
    directNodeLoad: 'PASS',
    exportSurface: 'PASS',
    knowledgeBaseManagerLoad: 'PASS',
    maximumAllowedGlibc: maximumAllowed,
    maximumObservedGlibc: maximumObserved,
    vexusMinimalSmoke: 'PASS'
  }));
} finally {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
}

// KnowledgeBaseManager constructs dormant timers at module load. The smoke has
// deliberately not initialized it, so terminate without touching runtime state.
process.exit(0);
