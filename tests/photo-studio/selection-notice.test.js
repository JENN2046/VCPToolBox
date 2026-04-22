const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const selectionNoticePlugin = require('../../plugins/custom/delivery/create_selection_notice/src/index.js');
const { createCoreFixture, initializeCorePlugins, makeTempDataRoot, moveProjectToStatus, store } = require('./helpers');

test('create_selection_notice succeeds for a project in selection_pending', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await selectionNoticePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'selection_pending');

  const result = await selectionNoticePlugin.processToolCall({
    project_id: fixture.project_id,
    selection_deadline: '2026-05-21',
    selection_method: 'shared online gallery',
    note_to_client: 'Please prioritize hero images.',
    tone: 'friendly'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.project_id, fixture.project_id);
  assert.equal(result.data.customer_name, 'Northlight Studio');
  assert.equal(result.data.selection_deadline, '2026-05-21');
  assert.equal(result.data.selection_method, 'shared online gallery');
  assert.equal(result.meta.degraded, false);
  assert.equal(result.meta.project_status, 'selection_pending');
  assert.match(result.data.draft_body, /May Wedding Story/);
  assert.match(result.data.draft_body, /2026-05-21/);
});

test('create_selection_notice rejects projects outside the allowed selection states', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await selectionNoticePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  const result = await selectionNoticePlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CONFLICT');
  assert.equal(result.error.field, 'project_id');
  assert.deepEqual(result.error.details.allowed_statuses, ['shot', 'selection_pending']);
});

test('create_selection_notice keeps degraded mode explicit when customer context is missing', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await selectionNoticePlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'shot');

  fs.writeFileSync(path.join(dataRoot, 'customers.json'), JSON.stringify({}, null, 2), 'utf8');
  store.clearCache().configureDataRoot(dataRoot);

  const result = await selectionNoticePlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, true);
  assert.equal(result.meta.degraded, true);
  assert.equal(result.data.customer_name, '[客户姓名]');
  assert.match(result.data.draft_body, /\[客户姓名\]/);
});
