const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const archivePlugin = require('../../plugins/custom/delivery/archive_project_assets/src/index.js');
const { createCoreFixture, initializeCorePlugins, makeTempDataRoot, moveProjectToStatus, store } = require('./helpers');

test('archive_project_assets creates a local shadow archive record for a completed project', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await archivePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'completed');

  const result = await archivePlugin.processToolCall({
    project_id: fixture.project_id,
    archive_key: 'final-archive',
    archive_path: 'archive/photo-studio/may-wedding-story',
    archive_label: 'May Wedding Story final archive',
    archive_mode: 'copy',
    asset_summary: 'Final gallery, selects, and delivery package.'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.project_id, fixture.project_id);
  assert.equal(result.data.archive_key, 'final-archive');
  assert.equal(result.data.archive_path, 'archive/photo-studio/may-wedding-story');
  assert.equal(result.data.archive_mode, 'copy');
  assert.equal(result.meta.degraded, false);
  assert.equal(result.meta.duplicate, false);

  const archiveStore = store.getArchiveAssetsByProject(fixture.project_id);
  assert.equal(archiveStore.length, 1);
  assert.equal(archiveStore[0].archive_key, 'final-archive');
  assert.match(archiveStore[0].archive_description, /May Wedding Story final archive/);
});

test('archive_project_assets updates the existing record instead of duplicating it', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await archivePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'completed');

  const firstRun = await archivePlugin.processToolCall({
    project_id: fixture.project_id,
    archive_key: 'final-archive'
  });
  assert.equal(firstRun.success, true);

  const secondRun = await archivePlugin.processToolCall({
    project_id: fixture.project_id,
    archive_key: 'final-archive',
    archive_mode: 'move',
    note: 'Adjusted retention target.'
  });

  assert.equal(secondRun.success, true);
  assert.equal(secondRun.data.is_new, false);
  assert.equal(secondRun.data.archive_mode, 'move');
  assert.equal(secondRun.meta.duplicate, true);

  const archiveStore = store.getArchiveAssetsByProject(fixture.project_id);
  assert.equal(archiveStore.length, 1);
  assert.equal(archiveStore[0].archive_asset_id, firstRun.data.archive_asset_id);
  assert.equal(archiveStore[0].archive_mode, 'move');
});

test('archive_project_assets rejects projects outside the archive window', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await archivePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  const result = await archivePlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CONFLICT');
  assert.equal(result.error.field, 'project_id');
  assert.deepEqual(result.error.details.allowed_statuses, ['completed', 'archived']);
});

test('archive_project_assets keeps degraded mode explicit when customer context is missing', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await archivePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'completed');

  fs.writeFileSync(path.join(dataRoot, 'customers.json'), JSON.stringify({}, null, 2), 'utf8');
  store.clearCache().configureDataRoot(dataRoot);

  const result = await archivePlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, true);
  assert.equal(result.meta.degraded, true);
  assert.equal(result.data.customer_name, '[客户姓名]');
  assert.equal(result.data.archive_mode, 'shadow');
  assert.equal(result.data.archive_surface, 'local_shadow_archive');
});
