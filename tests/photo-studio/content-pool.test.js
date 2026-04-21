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
const CONTENT_POOL_PLUGIN = 'Plugin/PhotoStudioContentPool/PhotoStudioContentPool.js';
const CONTENT_DRAFT_PLUGIN = 'Plugin/PhotoStudioCaseContentDraft/PhotoStudioCaseContentDraft.js';

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

test('push_project_to_content_pool creates a reusable content-pool candidate for a delivered project', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'delivered', env);

    const result = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id,
        theme: 'romantic wedding story',
        deliverables_summary: 'A polished gallery and social-ready highlights.'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.project_id, fixture.project_id);
    assert.equal(result.json.data.usage_status, 'candidate');
    assert.equal(result.json.meta.degraded, false);

    const contentStore = await readStoreJson(workspace.dataDir, 'content_pool.json');
    assert.equal(contentStore.records.length, 1);
    assert.equal(contentStore.records[0].project_id, fixture.project_id);
    assert.equal(contentStore.records[0].theme, 'romantic wedding story');
});

test('push_project_to_content_pool updates the existing record instead of duplicating it', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'delivered', env);

    const firstRun = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id,
        theme: 'updated content angle'
    }, env);
    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.is_new, false);
    assert.equal(secondRun.json.data.theme, 'updated content angle');

    const contentStore = await readStoreJson(workspace.dataDir, 'content_pool.json');
    assert.equal(contentStore.records.length, 1);
    assert.equal(contentStore.records[0].content_item_id, firstRun.json.data.content_item_id);
    assert.equal(contentStore.records[0].theme, 'updated content angle');
});

test('push_project_to_content_pool rejects projects that are not delivered or completed', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const result = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, ['delivered', 'completed']);
});

test('generate_case_content_draft returns structured copy from a content pool item', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const pushResult = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id
    }, env);
    assertSuccessEnvelope(pushResult);

    const draftResult = await runPlugin(CONTENT_DRAFT_PLUGIN, {
        content_item_id: pushResult.json.data.content_item_id,
        tone: 'friendly'
    }, env);

    assertSuccessEnvelope(draftResult);
    assert.equal(draftResult.json.data.content_item_id, pushResult.json.data.content_item_id);
    assert.equal(draftResult.json.data.project_id, fixture.project_id);
    assert.equal(draftResult.json.data.draft_variants.tone, 'friendly');
    assert.match(draftResult.json.data.draft_variants.short_case_summary, /May Wedding Story/);
    assert.equal(draftResult.json.meta.degraded, false);
});

test('generate_case_content_draft keeps degraded mode explicit when pool fields are incomplete', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const pushResult = await runPlugin(CONTENT_POOL_PLUGIN, {
        project_id: fixture.project_id
    }, env);
    assertSuccessEnvelope(pushResult);

    const contentStorePath = path.join(workspace.dataDir, 'content_pool.json');
    const contentStore = await readStoreJson(workspace.dataDir, 'content_pool.json');
    contentStore.records[0].customer_name = '';
    contentStore.records[0].theme = '';
    contentStore.records[0].deliverables_summary = '';
    await fs.writeFile(contentStorePath, JSON.stringify(contentStore, null, 2), 'utf8');

    const draftResult = await runPlugin(CONTENT_DRAFT_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(draftResult);
    assert.equal(draftResult.json.meta.degraded, true);
    assert.equal(draftResult.json.data.customer_name, '[客户姓名]');
    assert.equal(draftResult.json.data.theme, 'content case');
    assert.match(draftResult.json.data.draft_variants.short_case_summary, /\[客户姓名\]/);
});
