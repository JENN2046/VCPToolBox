'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  atomicWriteFilePreserveSymlink,
  resolveSymlinkTarget,
  resolveSymlinkTargetSync
} = require('../modules/symlinkSafeAtomicWrite');

test('atomic write preserves a state symlink', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcp-state-bind-'));
  try {
    const stateDir = path.join(root, 'state');
    const runtimeDir = path.join(root, 'runtime');
    await fsp.mkdir(stateDir);
    await fsp.mkdir(runtimeDir);
    const target = path.join(stateDir, 'data.json');
    const logical = path.join(runtimeDir, 'data.json');
    await fsp.writeFile(target, '{"value":1}\n', 'utf8');
    await fsp.symlink(target, logical);
    await atomicWriteFilePreserveSymlink(logical, '{"value":2}\n', 'utf8');

    assert.equal((await fsp.lstat(logical)).isSymbolicLink(), true);
    assert.equal(await fsp.readFile(target, 'utf8'), '{"value":2}\n');
    assert.equal(await fsp.readlink(logical), target);
    assert.equal(await resolveSymlinkTarget(logical), target);
    assert.equal(resolveSymlinkTargetSync(logical), target);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('atomic write also works for an ordinary file', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcp-state-file-'));
  try {
    const target = path.join(root, 'data.json');
    await fsp.writeFile(target, 'old', 'utf8');
    await atomicWriteFilePreserveSymlink(target, 'new', 'utf8');
    assert.equal((await fsp.lstat(target)).isSymbolicLink(), false);
    assert.equal(await fsp.readFile(target, 'utf8'), 'new');
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test('P7 atomic writers are wired to the helper', async () => {
  const repositoryRoot = path.resolve(__dirname, '..');
  const expected = [
    ['Plugin/VCPTimeLine/VCPTimeLine.js', 'atomicWriteFilePreserveSymlink'],
    ['Plugin/PlaceholderExplorer/modules/indexStore.js', 'atomicWriteFilePreserveSymlink'],
    ['Plugin/PlaceholderExplorer/modules/editor.js', 'resolveSymlinkTarget'],
    ['Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js', 'atomicWriteFilePreserveSymlink'],
    ['Plugin/RAGDiaryPlugin/SemanticGroupManager.js', 'atomicWriteFilePreserveSymlink'],
    ['Plugin/VCPTaskAssistant/vcp-task-assistant.js', 'resolveSymlinkTargetSync'],
    ['routes/admin/rag.js', 'atomicWriteFilePreserveSymlink']
  ];
  for (const [relative, marker] of expected) {
    const content = await fsp.readFile(path.join(repositoryRoot, relative), 'utf8');
    assert.match(content, new RegExp(marker));
  }
});

test('FoldingStore keeps a DB state symlink intact under a read-only runtime directory', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'vcp-folding-state-'));
  const stateDir = path.join(root, 'state');
  const runtimeDir = path.join(root, 'runtime');
  await fsp.mkdir(stateDir);
  await fsp.mkdir(runtimeDir);

  const target = path.join(stateDir, 'folding_store.db');
  const logical = path.join(runtimeDir, 'folding_store.db');
  await fsp.symlink(target, logical);
  await fsp.chmod(runtimeDir, 0o555);

  let store;
  try {
    const FoldingStore = require('../Plugin/RAGDiaryPlugin/FoldingStore');
    store = new FoldingStore(logical, { maxEntries: 10, evictCount: 2 });

    assert.equal(store.getStats().available, true);
    assert.equal((await fsp.lstat(logical)).isSymbolicLink(), true);
    assert.equal((await fsp.stat(target)).isFile(), true);
    assert.equal(await fsp.readlink(logical), target);
  } finally {
    if (store) store.shutdown();
    await fsp.chmod(runtimeDir, 0o755).catch(() => undefined);
    await fsp.rm(root, { recursive: true, force: true });
  }
});
