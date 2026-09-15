'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const matrixPath = path.join(
  __dirname,
  '..',
  'docs',
  'rebaseline',
  'vcptoolbox-upstream-tracking-rebaseline-r1.matrix.json'
);

function loadMatrix() {
  return JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
}

const EXPECTED_PACKAGES = [
  'P1_NATIVE_MANIFEST_SURFACE',
  'P2_EXTERNAL_PLUGIN_COMPOSITION',
  'P3_RESIDENT_HOST_CONTRACT',
  'P4_HUMAN_AUTHORIZATION_KERNEL',
  'P5_VEXUS_NATIVE_ABI_COMPAT',
  'P6_MEMORY_COLD_COMPATIBILITY'
];

const UPSTREAM_COMMIT = '9deadda698eb87b4ee2aef5c27ea7c01e8970a02';
const UPSTREAM_TREE = '83d9d49f626ea7f782203ba7ad24197dfbc909fc';

test('matrix is frozen on the exact current upstream baseline', () => {
  const matrix = loadMatrix();
  assert.equal(matrix.status, 'FROZEN');
  assert.equal(matrix.program, 'VCPTOOLBOX_UPSTREAM_TRACKING_REBASELINE_R1');
  assert.equal(matrix.upstream.repository, 'lioensky/VCPToolBox');
  assert.equal(matrix.upstream.branch, 'main');
  assert.equal(matrix.upstream.commit, UPSTREAM_COMMIT);
  assert.equal(matrix.upstream.tree, UPSTREAM_TREE);
  assert.equal(matrix.m1.base_commit, UPSTREAM_COMMIT);
});

test('matrix admits exactly six migration packages in frozen order', () => {
  const matrix = loadMatrix();
  assert.deepEqual(matrix.packages.map((pkg) => pkg.id), EXPECTED_PACKAGES);
  assert.equal(new Set(matrix.packages.map((pkg) => pkg.id)).size, 6);
});

test('every package is semantic-contract scoped and still pending M1 migration', () => {
  const matrix = loadMatrix();
  for (const pkg of matrix.packages) {
    assert.match(pkg.classification, /REQUIRED_/);
    assert.ok(Array.isArray(pkg.required_semantics));
    assert.ok(pkg.required_semantics.length > 0);
    assert.match(pkg.m1_status, /^PENDING_/);
    assert.ok(Array.isArray(pkg.explicit_exclusions));
    assert.ok(pkg.explicit_exclusions.length > 0);
  }
});

test('M1 is non-product and non-runtime by contract', () => {
  const matrix = loadMatrix();
  assert.equal(matrix.m1.name, 'CLEAN_UPSTREAM_BASELINE_AND_ACCEPTANCE_HARNESS');
  assert.equal(matrix.m1.product_code_changes, 'FORBIDDEN');
  assert.equal(matrix.m1.runtime_changes, 'FORBIDDEN');
  assert.deepEqual(matrix.m1.allowed_changes, [
    'frozen rebaseline matrix',
    'rebaseline acceptance harness',
    'M1 documentation'
  ]);
});

test('thick-fork replay and runtime cutover are explicitly excluded', () => {
  const matrix = loadMatrix();
  const exclusions = new Set(matrix.global_exclusions);
  assert.ok(exclusions.has('full-repository historical inventory beyond these six packages'));
  assert.ok(exclusions.has('wholesale cherry-pick of the thick fork'));
  assert.ok(exclusions.has('runtime activation or service restart'));
  assert.ok(exclusions.has('deployment or runtime cutover'));
  assert.ok(exclusions.has('database/memory state migration'));
});

test('Resident package freezes the exact six VCPToolBox host files', () => {
  const matrix = loadMatrix();
  const resident = matrix.packages.find((pkg) => pkg.id === 'P3_RESIDENT_HOST_CONTRACT');
  assert.deepEqual(resident.required_host_files, [
    'Plugin.js',
    'modules/chatCompletionHandler.js',
    'modules/handlers/nonStreamHandler.js',
    'modules/handlers/streamHandler.js',
    'modules/vcpLoop/toolExecutor.js',
    'modules/vcpLoop/residentPresentation.js'
  ]);
  assert.equal(resident.source_authority, 'JENN2046/Agents-OS/extensions/agents-os-resident');
});

test('Human Authorization preserves the frozen three-factor authority formula', () => {
  const matrix = loadMatrix();
  const authorization = matrix.packages.find((pkg) => pkg.id === 'P4_HUMAN_AUTHORIZATION_KERNEL');
  assert.equal(
    authorization.canonical_formula,
    'Trusted Client + Explicit Human Intent + Exact Pending Authority Target'
  );
});

test('Vexus migration rebuilds current source instead of carrying the historical binary', () => {
  const matrix = loadMatrix();
  const vexus = matrix.packages.find((pkg) => pkg.id === 'P5_VEXUS_NATIVE_ABI_COMPAT');
  assert.equal(vexus.migration_rule, 'REBUILD_CURRENT_UPSTREAM_SOURCE_DO_NOT_CARRY_OLD_BINARY');
  assert.ok(vexus.explicit_exclusions.some((value) => value.includes('August binary')));
});

test('Cold-memory package excludes tdbRecovery by default', () => {
  const matrix = loadMatrix();
  const cold = matrix.packages.find((pkg) => pkg.id === 'P6_MEMORY_COLD_COMPATIBILITY');
  assert.ok(cold.explicit_exclusions.includes('modules/tdbRecovery by default'));
  assert.ok(cold.required_semantics.some((value) => value.includes('L03 candidate dedup')));
});
