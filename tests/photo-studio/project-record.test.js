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

async function createCustomer(env) {
    const customerResult = await runPlugin(CUSTOMER_PLUGIN, {
        customer_name: 'Aster Portrait',
        customer_type: 'individual',
        contact_phone: '+86 139-0000-0000'
    }, env);
    assertSuccessEnvelope(customerResult);
    return customerResult.json.data.customer_id;
}

test('create_project_record creates a project linked to an existing customer', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const customerId = await createCustomer(env);
    const result = await runPlugin(PROJECT_PLUGIN, {
        customer_id: customerId,
        project_name: 'Spring Portrait Session',
        project_type: 'portrait',
        start_date: '2026-05-02',
        due_date: '2026-05-10',
        budget: 8800,
        remark: 'Outdoor session'
    }, env);

    assertSuccessEnvelope(result);
    assert.match(result.json.data.project_id, /^proj_[a-z0-9]{8}$/);
    assert.equal(result.json.data.customer_id, customerId);
    assert.equal(result.json.data.project_type, 'portrait');
    assert.equal(result.json.data.status, 'inquiry');
    assert.equal(result.json.data.is_new, true);

    const store = await readStoreJson(workspace.dataDir, 'projects.json');
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].budget, 8800);
    assert.equal(store.records[0].status, 'inquiry');
});

test('create_project_record returns CONFLICT for duplicate project names under the same customer', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const customerId = await createCustomer(env);
    const payload = {
        customer_id: customerId,
        project_name: 'Spring Portrait Session',
        project_type: 'portrait'
    };

    const firstRun = await runPlugin(PROJECT_PLUGIN, payload, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(PROJECT_PLUGIN, {
        ...payload,
        project_name: '  Spring   Portrait Session  '
    }, env);

    assertFailureEnvelope(secondRun, 'CONFLICT');
    assert.equal(secondRun.json.data.project_id, firstRun.json.data.project_id);
    assert.equal(secondRun.json.data.is_new, false);
});

test('create_project_record rejects unknown customer_id', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const result = await runPlugin(PROJECT_PLUGIN, {
        customer_id: 'cust_missing',
        project_name: 'Unknown Customer Session',
        project_type: 'portrait'
    }, {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    });

    assertFailureEnvelope(result, 'RESOURCE_NOT_FOUND');
    assert.equal(result.json.error.field, 'customer_id');
});
