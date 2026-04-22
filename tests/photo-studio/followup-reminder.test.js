const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const followupReminderPlugin = require('../../plugins/custom/crm/create_followup_reminder/src/index.js');
const { createCoreFixture, initializeCorePlugins, makeTempDataRoot, moveProjectToStatus, store } = require('./helpers');

test('create_followup_reminder writes reminders.json and defaults quotation followup due_date from project shoot_date', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await followupReminderPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'quoted');

  const result = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'quotation_followup'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.customer_id, fixture.customer_id);
  assert.equal(result.data.reminder_type, 'quotation_followup');
  assert.equal(result.data.due_date, '2026-05-04');
  assert.equal(result.data.status, 'pending');
  assert.equal(result.data.is_new, true);

  const reminders = store.getRemindersByProject(fixture.project_id);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].project_id, fixture.project_id);
});

test('create_followup_reminder accepts explicit due_date and note for delivery followup', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await followupReminderPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'delivering');

  const result = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'delivery_followup',
    due_date: '2026-05-28',
    note: 'Confirm the gallery access and final receipt.'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.due_date, '2026-05-28');
  assert.equal(result.data.note, 'Confirm the gallery access and final receipt.');
  assert.equal(result.meta.project_status, 'delivering');
});

test('create_followup_reminder reuses an existing pending reminder of the same type', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await followupReminderPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'delivering');

  const firstRun = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'delivery_followup'
  });
  assert.equal(firstRun.success, true);

  const secondRun = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'delivery_followup'
  });

  assert.equal(secondRun.success, true);
  assert.equal(secondRun.data.is_new, false);
  assert.equal(secondRun.meta.duplicate, true);
  assert.equal(secondRun.data.reminder_id, firstRun.data.reminder_id);

  const reminders = store.getRemindersByProject(fixture.project_id);
  assert.equal(reminders.length, 1);
});

test('create_followup_reminder computes revisit due_date from delivery_deadline plus 30 days', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await followupReminderPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'completed');

  const result = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'revisit'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.due_date, '2026-06-17');
  assert.equal(result.meta.project_status, 'completed');
});

test('create_followup_reminder rejects reminder types that do not match the current project status', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await followupReminderPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'delivering');

  const result = await followupReminderPlugin.processToolCall({
    project_id: fixture.project_id,
    reminder_type: 'revisit'
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CONFLICT');
  assert.equal(result.error.field, 'project_id');
  assert.deepEqual(result.error.details.allowed_statuses, ['completed', 'archived']);
});
