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
const SELECTION_NOTICE_PLUGIN = 'Plugin/PhotoStudioSelectionNotice/PhotoStudioSelectionNotice.js';

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

test('create_selection_notice succeeds for a project in editing', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'editing', env);

    const result = await runPlugin(SELECTION_NOTICE_PLUGIN, {
        project_id: fixture.project_id,
        selection_deadline: '2026-05-21',
        selection_method: 'shared online gallery',
        note_to_client: 'Please prioritize hero images.',
        tone: 'friendly'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.project_id, fixture.project_id);
    assert.equal(result.json.data.customer_name, 'Northlight Studio');
    assert.equal(result.json.data.selection_deadline, '2026-05-21');
    assert.equal(result.json.data.selection_method, 'shared online gallery');
    assert.equal(result.json.meta.degraded, false);
    assert.equal(result.json.meta.project_status, 'editing');
    assert.match(result.json.data.notice_content, /May Wedding Story/);
    assert.match(result.json.data.notice_content, /2026-05-21/);
});

test('create_selection_notice succeeds for a project in reviewing and defaults the deadline', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'reviewing', env);

    const result = await runPlugin(SELECTION_NOTICE_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.selection_deadline, '2026-05-18');
    assert.equal(result.json.data.selection_method, 'online gallery review');
    assert.equal(result.json.meta.project_status, 'reviewing');
});

test('create_selection_notice rejects projects outside the allowed selection states', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const result = await runPlugin(SELECTION_NOTICE_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, ['editing', 'reviewing']);
});

test('create_selection_notice keeps degraded mode explicit when customer context is missing', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'editing', env);

    const customerStorePath = path.join(workspace.dataDir, 'customers.json');
    const customerStore = await readStoreJson(workspace.dataDir, 'customers.json');
    customerStore.records = [];
    await fs.writeFile(customerStorePath, JSON.stringify(customerStore, null, 2), 'utf8');

    const result = await runPlugin(SELECTION_NOTICE_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.meta.degraded, true);
    assert.equal(result.json.data.customer_name, '[瀹㈡埛濮撳悕]');
    assert.match(result.json.data.notice_content, /\[瀹㈡埛濮撳悕\]/);
});
