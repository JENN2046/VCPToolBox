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
const TASKS_PLUGIN = 'Plugin/PhotoStudioProjectTasks/PhotoStudioProjectTasks.js';
const REPLY_PLUGIN = 'Plugin/PhotoStudioReplyDraft/PhotoStudioReplyDraft.js';

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

test('update_project_status allows inquiry to quoted and records status_log', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const validUpdate = await runPlugin(STATUS_PLUGIN, {
        project_id: fixture.project_id,
        new_status: 'quoted',
        remark: 'Quotation sent.'
    }, env);

    assertSuccessEnvelope(validUpdate);
    assert.equal(validUpdate.json.data.previous_status, 'inquiry');
    assert.equal(validUpdate.json.data.new_status, 'quoted');

    const projectStore = await readStoreJson(workspace.dataDir, 'projects.json');
    const statusLogStore = await readStoreJson(workspace.dataDir, 'status_log.json');
    assert.equal(projectStore.records[0].status, 'quoted');
    assert.equal(statusLogStore.records.length, 1);
    assert.equal(statusLogStore.records[0].project_id, fixture.project_id);
});

test('update_project_status rejects invalid transitions with INVALID_TRANSITION', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const invalidUpdate = await runPlugin(STATUS_PLUGIN, {
        project_id: fixture.project_id,
        new_status: 'delivered'
    }, env);

    assertFailureEnvelope(invalidUpdate, 'INVALID_TRANSITION');
    assert.equal(invalidUpdate.json.error.field, 'new_status');
});

test('create_project_tasks uses the wedding template and skips reruns without override', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const firstRun = await runPlugin(TASKS_PLUGIN, {
        project_id: fixture.project_id,
        task_template: 'wedding_standard'
    }, env);

    assertSuccessEnvelope(firstRun);
    assert.equal(firstRun.json.data.created_count, 6);
    assert.equal(firstRun.json.data.skipped_count, 0);
    assert.equal(firstRun.json.data.created_tasks.length, 6);

    const secondRun = await runPlugin(TASKS_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.created_count, 0);
    assert.equal(secondRun.json.data.skipped_count, 6);

    const taskStore = await readStoreJson(workspace.dataDir, 'tasks.json');
    assert.equal(taskStore.records.length, 6);
});

test('generate_client_reply_draft returns a quotation draft and supports degraded fallback', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const normalDraft = await runPlugin(REPLY_PLUGIN, {
        project_id: fixture.project_id,
        context_type: 'quotation',
        tone: 'friendly',
        key_points: ['Need a two-stage payment plan.', 'Please confirm the selected package.']
    }, env);

    assertSuccessEnvelope(normalDraft);
    assert.equal(normalDraft.json.data.customer_name, 'Northlight Studio');
    assert.equal(normalDraft.json.data.context_type, 'quotation');
    assert.equal(normalDraft.json.meta.degraded, false);
    assert.match(normalDraft.json.data.draft_content, /May Wedding Story/);

    const customerStorePath = path.join(workspace.dataDir, 'customers.json');
    const customerStore = await readStoreJson(workspace.dataDir, 'customers.json');
    customerStore.records = [];
    await fs.writeFile(customerStorePath, JSON.stringify(customerStore, null, 2), 'utf8');

    const degradedDraft = await runPlugin(REPLY_PLUGIN, {
        project_id: fixture.project_id,
        context_type: 'delivery'
    }, env);

    assertSuccessEnvelope(degradedDraft);
    assert.equal(degradedDraft.json.meta.degraded, true);
    assert.equal(degradedDraft.json.data.customer_name, '[客户姓名]');
    assert.match(degradedDraft.json.data.draft_content, /\[客户姓名\]/);
});
