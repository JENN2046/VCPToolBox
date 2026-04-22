const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const calendarSyncPlugin = require('../../plugins/custom/project/sync_calendar_event/src/index.js');
const { createCoreFixture, initializeCorePlugins, makeTempDataRoot, moveProjectToStatus, store } = require('./helpers');

test('sync_calendar_event creates a local shadow calendar record for an eligible project', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await calendarSyncPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'retouching');

  const result = await calendarSyncPlugin.processToolCall({
    project_id: fixture.project_id,
    event_type: 'follow_up',
    event_key: 'client-review-1',
    event_date: '2026-05-16',
    event_time: '09:30',
    event_title: 'Client review checkpoint',
    note: 'Confirm the final selection list before delivery.',
    calendar_surface: 'local_shadow_calendar'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.project_id, fixture.project_id);
  assert.equal(result.data.event_type, 'follow_up');
  assert.equal(result.data.event_key, 'client-review-1');
  assert.equal(result.data.event_date, '2026-05-16');
  assert.equal(result.data.event_time, '09:30');
  assert.equal(result.data.calendar_surface, 'local_shadow_calendar');
  assert.equal(result.data.sync_state, 'local_shadow');
  assert.equal(result.meta.degraded, false);
  assert.equal(result.meta.duplicate, false);

  const calendarStore = store.getCalendarEventsByProject(fixture.project_id);
  assert.equal(calendarStore.length, 1);
  assert.equal(calendarStore[0].event_key, 'client-review-1');
  assert.equal(calendarStore[0].event_title, 'Client review checkpoint');
});

test('sync_calendar_event updates the existing shadow record instead of duplicating it', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await calendarSyncPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'retouching');

  const firstRun = await calendarSyncPlugin.processToolCall({
    project_id: fixture.project_id,
    event_key: 'shooting-day',
    event_type: 'milestone',
    event_date: '2026-05-08'
  });
  assert.equal(firstRun.success, true);

  const secondRun = await calendarSyncPlugin.processToolCall({
    project_id: fixture.project_id,
    event_key: 'shooting-day',
    event_type: 'milestone',
    event_date: '2026-05-09',
    note: 'Shifted one day later.'
  });

  assert.equal(secondRun.success, true);
  assert.equal(secondRun.data.is_new, false);
  assert.equal(secondRun.data.event_date, '2026-05-09');
  assert.equal(secondRun.meta.duplicate, true);

  const calendarStore = store.getCalendarEventsByProject(fixture.project_id);
  assert.equal(calendarStore.length, 1);
  assert.equal(calendarStore[0].calendar_event_id, firstRun.data.calendar_event_id);
  assert.equal(calendarStore[0].event_date, '2026-05-09');
});

test('sync_calendar_event rejects projects outside the coordination window', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await calendarSyncPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  const result = await calendarSyncPlugin.processToolCall({
    project_id: fixture.project_id,
    event_type: 'deadline'
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CONFLICT');
  assert.equal(result.error.field, 'project_id');
  assert.deepEqual(result.error.details.allowed_statuses, [
    'quoted',
    'confirmed',
    'preparing',
    'shot',
    'selection_pending',
    'retouching',
    'delivering',
    'completed'
  ]);
});

test('sync_calendar_event keeps degraded mode explicit when customer context is missing', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await calendarSyncPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'confirmed');

  fs.writeFileSync(path.join(dataRoot, 'customers.json'), JSON.stringify({}, null, 2), 'utf8');
  store.clearCache().configureDataRoot(dataRoot);

  const result = await calendarSyncPlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, true);
  assert.equal(result.meta.degraded, true);
  assert.equal(result.data.customer_name, '[客户姓名]');
  assert.equal(result.data.event_type, 'milestone');
  assert.equal(result.data.calendar_surface, 'local_shadow_calendar');
});
