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
const ARCHIVE_PLUGIN = 'Plugin/PhotoStudioAssetArchive/PhotoStudioAssetArchive.js';

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

test('archive_project_assets creates a local shadow archive record for a completed project', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const result = await runPlugin(ARCHIVE_PLUGIN, {
        project_id: fixture.project_id,
        archive_key: 'final-archive',
        archive_path: 'archive/photo-studio/may-wedding-story',
        archive_label: 'May Wedding Story final archive',
        archive_mode: 'copy',
        asset_summary: 'Final gallery, selects, and delivery package.'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.project_id, fixture.project_id);
    assert.equal(result.json.data.archive_key, 'final-archive');
    assert.equal(result.json.data.archive_path, 'archive/photo-studio/may-wedding-story');
    assert.equal(result.json.data.archive_mode, 'copy');
    assert.equal(result.json.meta.degraded, false);
    assert.equal(result.json.meta.duplicate, false);

    const archiveStore = await readStoreJson(workspace.dataDir, 'archive_assets.json');
    assert.equal(archiveStore.records.length, 1);
    assert.equal(archiveStore.records[0].archive_key, 'final-archive');
    assert.match(archiveStore.records[0].archive_description, /May Wedding Story final archive/);
});

test('archive_project_assets updates the existing record instead of duplicating it', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const firstRun = await runPlugin(ARCHIVE_PLUGIN, {
        project_id: fixture.project_id,
        archive_key: 'final-archive'
    }, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(ARCHIVE_PLUGIN, {
        project_id: fixture.project_id,
        archive_key: 'final-archive',
        archive_mode: 'move',
        note: 'Adjusted retention target.'
    }, env);

    assertSuccessEnvelope(secondRun);
    assert.equal(secondRun.json.data.is_new, false);
    assert.equal(secondRun.json.data.archive_mode, 'move');
    assert.equal(secondRun.json.meta.duplicate, true);

    const archiveStore = await readStoreJson(workspace.dataDir, 'archive_assets.json');
    assert.equal(archiveStore.records.length, 1);
    assert.equal(archiveStore.records[0].archive_asset_id, firstRun.json.data.archive_asset_id);
    assert.equal(archiveStore.records[0].archive_mode, 'move');
});

test('archive_project_assets rejects projects outside the archive window', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    const result = await runPlugin(ARCHIVE_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertFailureEnvelope(result, 'CONFLICT');
    assert.equal(result.json.error.field, 'project_id');
    assert.deepEqual(result.json.error.details.allowed_statuses, ['completed', 'archived']);
});

test('archive_project_assets keeps degraded mode explicit when customer context is missing', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const fixture = await createProjectFixture(env);
    await moveProjectToStatus(fixture.project_id, 'completed', env);

    const customerStorePath = path.join(workspace.dataDir, 'customers.json');
    const customerStore = await readStoreJson(workspace.dataDir, 'customers.json');
    customerStore.records = [];
    await fs.writeFile(customerStorePath, JSON.stringify(customerStore, null, 2), 'utf8');

    const result = await runPlugin(ARCHIVE_PLUGIN, {
        project_id: fixture.project_id
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.meta.degraded, true);
    assert.equal(result.json.data.customer_name, '[客户姓名]');
    assert.equal(result.json.data.archive_mode, 'shadow');
    assert.equal(result.json.data.archive_surface, 'local_shadow_archive');
});
