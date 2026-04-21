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
const FOLLOWUP_REMINDER_PLUGIN = 'Plugin/PhotoStudioFollowupReminder/PhotoStudioFollowupReminder.js';

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
    const transitionPath = ['quoted', 'confirmed', 'preparing', 'shooting', 'editing', 'reviewing', 'delivered', 'completed', 'archived'];

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

test('create_followup_reminder writes reminders.json and defaults quotation followup due_date from project start_date', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'quoted', env);

    const result = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'quotation_followup'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.customer_id, fixture.customer_id);
    assert.equal(result.json.data.reminder_type, 'quotation_followup');
    assert.equal(result.json.data.due_date, '2026-05-04');
    assert.equal(result.json.data.status, 'pending');
    assert.equal(result.json.data.is_new, true);

    const reminderStore = await readStoreJson(workspace.dataDir, 'reminders.json');
    assert.equal(reminderStore.records.length, 1);
    assert.equal(reminderStore.records[0].project_id, fixture.project_id);
});

test('create_followup_reminder accepts explicit due_date and note for delivery followup', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'delivered', env);

    const result = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'delivery_followup',
        due_date: '2026-05-28',
        note: 'Confirm the gallery access and final receipt.'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.due_date, '2026-05-28');
    assert.equal(result.json.data.note, 'Confirm the gallery access and final receipt.');
    assert.equal(result.json.meta.project_status, 'delivered');
});

test('create_followup_reminder reuses an existing pending reminder of the same type', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'delivered', env);

    const firstRun = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'delivery_followup'
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'delivery_followup'
    }, env);

    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.is_new, false);
    assert.equal(secondRun.json.meta.duplicate, true);
    assert.equal(secondRun.json.data.reminder_id, firstRun.json.data.reminder_id);

    const reminderStore = await readStoreJson(workspace.dataDir, 'reminders.json');
    assert.equal(reminderStore.records.length, 1);
});

test('create_followup_reminder computes revisit due_date from project due_date plus 30 days', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const result = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'revisit'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.due_date, '2026-06-17');
    assert.equal(result.json.meta.project_status, 'completed');
});

test('create_followup_reminder rejects reminder types that do not match the current project status', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'delivered', env);

    const result = await runPlugin(FOLLOWUP_REMINDER_PLUGIN, {
        project_id: fixture.project_id,
        reminder_type: 'revisit'
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, ['completed', 'archived']);
});
