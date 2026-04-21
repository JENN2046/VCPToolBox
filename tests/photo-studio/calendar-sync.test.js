const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');
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
const CALENDAR_PLUGIN = 'Plugin/PhotoStudioCalendarSync/PhotoStudioCalendarSync.js';

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
    const transitionPath = ['quoted', 'confirmed', 'preparing', 'shooting', 'editing', 'reviewing'];

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

test('sync_calendar_event creates a local shadow coordination record for a reviewing project', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const result = await runPlugin(CALENDAR_PLUGIN, {
        project_id: fixture.project_id,
        event_type: 'follow_up',
        event_key: 'client-review-1',
        event_date: '2026-05-16',
        event_time: '09:30',
        event_title: 'Client review checkpoint',
        note: 'Confirm the final selection list before delivery.',
        calendar_surface: 'local_shadow_calendar'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.project_id, fixture.project_id);
    assert.equal(result.json.data.event_type, 'follow_up');
    assert.equal(result.json.data.event_key, 'client-review-1');
    assert.equal(result.json.data.event_date, '2026-05-16');
    assert.equal(result.json.data.event_time, '09:30');
    assert.equal(result.json.data.calendar_surface, 'local_shadow_calendar');
    assert.equal(result.json.data.sync_state, 'local_shadow');
    assert.equal(result.json.meta.degraded, false);
    assert.equal(result.json.meta.duplicate, false);

    const calendarStore = await readStoreJson(workspace.dataDir, 'calendar_events.json');
    assert.equal(calendarStore.records.length, 1);
    assert.equal(calendarStore.records[0].event_key, 'client-review-1');
    assert.equal(calendarStore.records[0].event_title, 'Client review checkpoint');
});

test('sync_calendar_event updates the existing shadow record instead of duplicating it', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const firstRun = await runPlugin(CALENDAR_PLUGIN, {
        project_id: fixture.project_id,
        event_key: 'shooting-day',
        event_type: 'milestone',
        event_date: '2026-05-08'
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(CALENDAR_PLUGIN, {
        project_id: fixture.project_id,
        event_key: 'shooting-day',
        event_type: 'milestone',
        event_date: '2026-05-09',
        note: 'Shifted one day later.'
    }, env);

    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.is_new, false);
    assert.equal(secondRun.json.data.event_date, '2026-05-09');
    assert.equal(secondRun.json.meta.duplicate, true);

    const calendarStore = await readStoreJson(workspace.dataDir, 'calendar_events.json');
    assert.equal(calendarStore.records.length, 1);
    assert.equal(calendarStore.records[0].calendar_event_id, firstRun.json.data.calendar_event_id);
    assert.equal(calendarStore.records[0].event_date, '2026-05-09');
});

test('sync_calendar_event rejects projects outside the coordination window', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const result = await runPlugin(CALENDAR_PLUGIN, {
        project_id: fixture.project_id,
        event_type: 'deadline'
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, [
        'quoted',
        'confirmed',
        'preparing',
        'shooting',
        'editing',
        'reviewing',
        'delivered',
        'completed'
    ]);
});

test('sync_calendar_event keeps degraded mode explicit when customer context is missing', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'confirmed', env);

    const customerStorePath = path.join(workspace.dataDir, 'customers.json');
    const customerStore = await readStoreJson(workspace.dataDir, 'customers.json');
    customerStore.records = [];
    await fs.writeFile(customerStorePath, JSON.stringify(customerStore, null, 2), 'utf8');

    const result = await runPlugin(CALENDAR_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.meta.degraded, true);
    assert.equal(result.json.data.customer_name, '[客户姓名]');
    assert.equal(result.json.data.event_type, 'milestone');
    assert.equal(result.json.data.calendar_surface, 'local_shadow_calendar');
});
