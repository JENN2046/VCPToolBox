const test = require('node:test');
const assert = require('node:assert/strict');
const {
    assertFailureEnvelope,
    assertSuccessEnvelope,
    cleanupWorkspace,
    createTempWorkspace,
    readStoreJson,
    runPlugin
} = require('./helpers');

const CUSTOMER_PLUGIN = 'Plugin/PhotoStudioCustomerRecord/PhotoStudioCustomerRecord.js';
const PROJECT_PLUGIN = 'Plugin/PhotoStudioProjectRecord/PhotoStudioProjectRecord.js';
const STATUS_PLUGIN = 'Plugin/PhotoStudioProjectStatus/PhotoStudioProjectStatus.js';
const PROJECT_TASKS_PLUGIN = 'Plugin/PhotoStudioProjectTasks/PhotoStudioProjectTasks.js';
const DELIVERY_TASKS_PLUGIN = 'Plugin/PhotoStudioDeliveryTasks/PhotoStudioDeliveryTasks.js';

async function createProjectFixture(env) {
    const customerResult = await runPlugin(CUSTOMER_PLUGIN, {
        customer_name: 'Northlight Studio',
        customer_type: 'individual',
        contact_wechat: 'northlight-photo'
    }, env);
    assertSuccessEnvelope(customerResult);

    const projectResult = await runPlugin(PROJECT_PLUGIN, {
        customer_id: customerResult.json.data.customer_id,
        project_name: 'May Wedding Story',
        project_type: 'wedding',
        start_date: '2026-05-04',
        due_date: '2026-05-18',
        budget: 28800
    }, env);
    assertSuccessEnvelope(projectResult);

    return {
        customer_id: customerResult.json.data.customer_id,
        project_id: projectResult.json.data.project_id
    };
}

async function moveProjectToStatus(projectId, targetStatus, env) {
    const transitionPath = ['quoted', 'confirmed', 'preparing', 'shooting', 'editing', 'reviewing', 'delivered', 'completed'];

    for (const nextStatus of transitionPath) {
        const result = await runPlugin(STATUS_PLUGIN, {
            project_id: projectId,
            new_status: nextStatus
        }, env);
        assertSuccessEnvelope(result);

        if (nextStatus === targetStatus) {
            return;
        }
    }

    throw new Error(`Unsupported target status in test helper: ${targetStatus}`);
}

test('create_delivery_tasks creates deterministic delivery-stage tasks for reviewing projects', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const result = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id,
        delivery_mode: 'online gallery',
        delivery_deadline: '2026-05-25'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.created_count, 4);
    assert.equal(result.json.data.skipped_count, 0);
    assert.equal(result.json.data.delivery_mode, 'online gallery');
    assert.equal(result.json.data.delivery_deadline, '2026-05-25');
    assert.equal(result.json.meta.project_status, 'reviewing');

    const taskStore = await readStoreJson(workspace.dataDir, 'tasks.json');
    assert.equal(taskStore.records.length, 4);
    assert.ok(taskStore.records.every((task) => task.task_group === 'delivery_stage'));
    assert.ok(taskStore.records.every((task) => task.generated_by === 'create_delivery_tasks'));
});

test('create_delivery_tasks rerun skips existing delivery-stage tasks without override', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const firstRun = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id
    }, env);
    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.created_count, 0);
    assert.equal(secondRun.json.data.skipped_count, 4);

    const taskStore = await readStoreJson(workspace.dataDir, 'tasks.json');
    assert.equal(taskStore.records.length, 4);
});

test('create_delivery_tasks override replaces only prior delivery-stage tasks', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const projectTasks = await runPlugin(PROJECT_TASKS_PLUGIN, {
        project_id: fixture.project_id,
        task_template: 'wedding_standard'
    }, env);
    assertSuccessEnvelope(projectTasks);

    const firstRun = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id,
        delivery_mode: 'online gallery'
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id,
        override_existing: true,
        delivery_mode: 'usb handoff',
        delivery_deadline: '2026-05-30'
    }, env);

    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.created_count, 4);

    const taskStore = await readStoreJson(workspace.dataDir, 'tasks.json');
    assert.equal(taskStore.records.length, 10);

    const deliveryTasks = taskStore.records.filter((task) => task.generated_by === 'create_delivery_tasks');
    const projectTasksOnly = taskStore.records.filter((task) => !task.generated_by);
    assert.equal(deliveryTasks.length, 4);
    assert.equal(projectTasksOnly.length, 6);
    assert.ok(deliveryTasks.every((task) => task.delivery_mode === 'usb handoff'));
    assert.ok(deliveryTasks.every((task) => task.due_date === '2026-05-30'));
});

test('create_delivery_tasks rejects projects outside delivery-ready states', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const result = await runPlugin(DELIVERY_TASKS_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, ['reviewing', 'delivered', 'completed']);
});
