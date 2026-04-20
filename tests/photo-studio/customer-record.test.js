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

test('create_customer_record creates a customer with the frozen contract fields', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const result = await runPlugin(CUSTOMER_PLUGIN, {
        customer_name: 'Luna Studio',
        customer_type: 'individual',
        contact_phone: '+86 138-0000-0000',
        contact_wechat: 'luna-photo',
        contact_email: 'hello@luna.example',
        source: 'social_media',
        remark: 'Initial consultation completed.'
    }, env);

    assertSuccessEnvelope(result);
    assert.match(result.json.data.customer_id, /^cust_[a-z0-9]{8}$/);
    assert.equal(result.json.data.customer_name, 'Luna Studio');
    assert.equal(result.json.data.customer_type, 'individual');
    assert.equal(result.json.data.is_new, true);

    const store = await readStoreJson(workspace.dataDir, 'customers.json');
    assert.equal(store.records.length, 1);
    assert.equal(store.records[0].normalized_contact_phone, '+8613800000000');
    assert.equal(store.records[0].normalized_contact_wechat, 'luna-photo');
});

test('create_customer_record returns CONFLICT when name and phone match an existing customer', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    const payload = {
        customer_name: 'Luna Studio',
        customer_type: 'individual',
        contact_phone: '+86 138-0000-0000',
        source: 'referral'
    };

    const firstRun = await runPlugin(CUSTOMER_PLUGIN, payload, env);
    assertSuccessEnvelope(firstRun);

    const secondRun = await runPlugin(CUSTOMER_PLUGIN, {
        ...payload,
        contact_phone: '+86 138 0000 0000'
    }, env);

    assertFailureEnvelope(secondRun, 'CONFLICT');
    assert.equal(secondRun.json.data.customer_id, firstRun.json.data.customer_id);
    assert.equal(secondRun.json.data.is_new, false);
    assert.equal(secondRun.json.data.customer_name, 'Luna Studio');
});

test('create_customer_record rejects missing required fields', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const result = await runPlugin(CUSTOMER_PLUGIN, {
        customer_type: 'individual',
        contact_wechat: 'hello-photo'
    }, {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    });

    assertFailureEnvelope(result, 'MISSING_REQUIRED_FIELD');
    assert.equal(result.json.error.field, 'customer_name');
});

test('create_customer_record rejects invalid enum values', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const result = await runPlugin(CUSTOMER_PLUGIN, {
        customer_name: 'Luna Studio',
        customer_type: 'vip',
        source: 'douyin'
    }, {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    });

    assertFailureEnvelope(result, 'INVALID_INPUT');
    assert.equal(result.json.error.field, 'customer_type');
});
