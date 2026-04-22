const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const deliveryTasksPlugin = require('../../plugins/custom/delivery/create_delivery_tasks/src/index.js');
const projectTasksPlugin = require('../../plugins/custom/project/create_project_tasks/src/index.js');
const { createCoreFixture, initializeCorePlugins, makeTempDataRoot, moveProjectToStatus, store } = require('./helpers');

test('create_delivery_tasks creates deterministic delivery-stage tasks for retouching projects', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await deliveryTasksPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'retouching');

  const result = await deliveryTasksPlugin.processToolCall({
    project_id: fixture.project_id,
    delivery_mode: 'online gallery',
    delivery_deadline: '2026-05-25'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.created_count, 4);
  assert.equal(result.data.skipped_count, 0);
  assert.equal(result.data.delivery_mode, 'online gallery');
  assert.equal(result.data.delivery_deadline, '2026-05-25');
  assert.equal(result.meta.project_status, 'retouching');

  const taskStore = store.getTasksByProject(fixture.project_id);
  assert.equal(taskStore.length, 4);
  assert.ok(taskStore.every((task) => task.task_group === 'delivery_stage'));
  assert.ok(taskStore.every((task) => task.generated_by === 'create_delivery_tasks'));
});

test('create_delivery_tasks rerun skips existing delivery-stage tasks without override', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await deliveryTasksPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'retouching');

  const firstRun = await deliveryTasksPlugin.processToolCall({ project_id: fixture.project_id });
  assert.equal(firstRun.success, true);

  const secondRun = await deliveryTasksPlugin.processToolCall({ project_id: fixture.project_id });
  assert.equal(secondRun.success, true);
  assert.equal(secondRun.data.created_count, 0);
  assert.equal(secondRun.data.skipped_count, 4);

  const taskStore = store.getTasksByProject(fixture.project_id);
  assert.equal(taskStore.length, 4);
});

test('create_delivery_tasks override replaces only prior delivery-stage tasks', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await deliveryTasksPlugin.initialize(sharedConfig);
  await projectTasksPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  await moveProjectToStatus(fixture.project_id, 'retouching');

  const projectTasks = await projectTasksPlugin.processToolCall({
    project_id: fixture.project_id,
    task_template: 'wedding_standard'
  });
  assert.equal(projectTasks.success, true);

  const firstRun = await deliveryTasksPlugin.processToolCall({
    project_id: fixture.project_id,
    delivery_mode: 'online gallery'
  });
  assert.equal(firstRun.success, true);

  const secondRun = await deliveryTasksPlugin.processToolCall({
    project_id: fixture.project_id,
    override_existing: true,
    delivery_mode: 'usb handoff',
    delivery_deadline: '2026-05-30'
  });

  assert.equal(secondRun.success, true);
  assert.equal(secondRun.data.created_count, 4);

  const taskStore = store.getTasksByProject(fixture.project_id);
  const deliveryTasks = taskStore.filter((task) => task.generated_by === 'create_delivery_tasks');
  const projectTasksOnly = taskStore.filter((task) => !task.generated_by);
  assert.equal(deliveryTasks.length, 4);
  assert.equal(projectTasksOnly.length, 6);
  assert.ok(deliveryTasks.every((task) => task.delivery_mode === 'usb handoff'));
  assert.ok(deliveryTasks.every((task) => task.due_date === '2026-05-30'));
});

test('create_delivery_tasks rejects projects outside delivery-ready states', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const sharedConfig = await initializeCorePlugins(dataRoot);
  await deliveryTasksPlugin.initialize(sharedConfig);

  const fixture = await createCoreFixture();
  const result = await deliveryTasksPlugin.processToolCall({
    project_id: fixture.project_id
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CONFLICT');
  assert.equal(result.error.field, 'project_id');
  assert.deepEqual(result.error.details.allowed_statuses, ['retouching', 'delivering', 'completed']);
});
