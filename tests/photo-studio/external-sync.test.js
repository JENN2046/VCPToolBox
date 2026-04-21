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

const EXTERNAL_SYNC_PLUGIN = 'Plugin/PhotoStudioExternalSync/PhotoStudioExternalSync.js';

async function writeStore(dataDir, fileName, records) {
    const payload = {
        version: 1,
        updated_at: '2026-04-21T00:00:00.000Z',
        records
    };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('sync_to_external_sheet_or_notion exports a full project inventory shadow record', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', [
        {
            customer_id: 'cust_10000001',
            customer_name: 'Northlight Studio'
        }
    ]);

    await writeStore(workspace.dataDir, 'projects.json', [
        {
            project_id: 'proj_20000001',
            customer_id: 'cust_10000001',
            project_name: 'May Wedding Story',
            project_type: 'wedding',
            start_date: '2026-05-01',
            due_date: '2026-05-10',
            budget: 28000,
            status: 'reviewing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'may wedding story'
        },
        {
            project_id: 'proj_20000002',
            customer_id: 'cust_10000001',
            project_name: 'Studio Portraits',
            project_type: 'portrait',
            start_date: '2026-04-20',
            due_date: '2026-05-01',
            budget: 9600,
            status: 'shooting',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'studio portraits'
        },
        {
            project_id: 'proj_20000003',
            customer_id: 'cust_missing',
            project_name: 'Archive Closed Case',
            project_type: 'commercial',
            start_date: '2026-04-12',
            due_date: '2026-04-30',
            budget: 12000,
            status: 'completed',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'archive closed case'
        }
    ]);

    const result = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        reference_date: '2026-05-05',
        upcoming_days: 7,
        delivery_state: 'queued',
        delivery_attempts: 1,
        delivery_acknowledged: false,
        note: 'Weekly sync export'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.target_type, 'sheet');
    assert.equal(result.json.data.target_name, 'photo_studio_project_inventory');
    assert.equal(result.json.data.export_scope, 'all_projects');
    assert.equal(result.json.data.export_row_count, 3);
    assert.equal(result.json.data.export_summary.total_projects, 3);
    assert.equal(result.json.data.export_summary.active_projects, 2);
    assert.equal(result.json.data.export_summary.closed_projects, 1);
    assert.equal(result.json.data.export_summary.overdue_projects, 1);
    assert.equal(result.json.data.export_summary.due_soon_projects, 1);
    assert.equal(result.json.data.delivery_state, 'queued');
    assert.equal(result.json.data.delivery_attempts, 1);
    assert.equal(result.json.data.delivery_acknowledged, false);
    assert.equal(result.json.meta.degraded, true);
    assert.match(result.json.data.export_text, /Delivery state: queued \| attempts 1/);
    assert.match(result.json.data.export_text, /Photo Studio external sync export/);
    assert.match(result.json.data.export_text, /Weekly sync export/);
    assert.equal(result.json.data.export_rows[0].status, 'completed');
    assert.equal(result.json.data.export_rows[0].customer_name, '[瀹㈡埛濮撳悕]');

    const externalExports = await readStoreJson(workspace.dataDir, 'external_exports.json');
    assert.equal(externalExports.records.length, 1);
    assert.equal(externalExports.records[0].export_key.includes('sync_to_external_sheet_or_notion:sheet:photo_studio_project_inventory:all_projects:all:include_closed'), true);
    assert.equal(externalExports.records[0].delivery_state, 'queued');
    assert.equal(externalExports.records[0].delivery_attempts, 1);
    assert.equal(externalExports.records[0].delivery_acknowledged, false);
    assert.equal(externalExports.records[0].delivery_channel, 'local_shadow_outbox');
});

test('sync_to_external_sheet_or_notion updates the same export record for the same target key', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', [
        {
            customer_id: 'cust_10000001',
            customer_name: 'Northlight Studio'
        }
    ]);

    await writeStore(workspace.dataDir, 'projects.json', [
        {
            project_id: 'proj_20000001',
            customer_id: 'cust_10000001',
            project_name: 'May Wedding Story',
            project_type: 'wedding',
            start_date: '2026-05-01',
            due_date: '2026-05-10',
            budget: 28000,
            status: 'reviewing',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-21T08:00:00.000Z',
            normalized_project_name: 'may wedding story'
        }
    ]);

    const firstResult = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        target_type: 'notion',
        target_name: 'Client Board',
        project_id: 'proj_20000001',
        reference_date: '2026-05-05',
        delivery_state: 'retry_scheduled',
        delivery_error: 'Notion rate limit',
        retry_after_days: 3,
        delivery_attempts: 2
    }, env);

    assertSuccessEnvelope(firstResult);
    assert.equal(firstResult.json.data.export_scope, 'single_project');
    assert.equal(firstResult.json.data.export_rows.length, 1);
    assert.equal(firstResult.json.data.export_rows[0].target_type, 'notion');
    assert.equal(firstResult.json.data.export_rows[0].target_name, 'Client Board');
    assert.equal(firstResult.json.data.delivery_state, 'retry_scheduled');
    assert.equal(firstResult.json.data.delivery_attempts, 2);
    assert.equal(firstResult.json.data.retry_after_date, '2026-05-08');

    await writeStore(workspace.dataDir, 'projects.json', [
        {
            project_id: 'proj_20000001',
            customer_id: 'cust_10000001',
            project_name: 'May Wedding Story',
            project_type: 'wedding',
            start_date: '2026-05-01',
            due_date: '2026-05-12',
            budget: 30000,
            status: 'delivered',
            created_at: '2026-04-21T08:00:00.000Z',
            updated_at: '2026-04-22T08:00:00.000Z',
            normalized_project_name: 'may wedding story'
        }
    ]);

    const secondResult = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        target_type: 'notion',
        target_name: 'Client Board',
        project_id: 'proj_20000001',
        reference_date: '2026-05-05',
        delivery_state: 'delivered',
        delivery_receipt_id: 'receipt-001',
        delivery_acknowledged: true,
        delivery_attempts: 3
    }, env);

    assertSuccessEnvelope(secondResult);
    assert.equal(secondResult.json.data.external_export_id, firstResult.json.data.external_export_id);
    assert.equal(secondResult.json.data.export_rows.length, 1);
    assert.equal(secondResult.json.data.export_rows[0].status, 'delivered');
    assert.equal(secondResult.json.data.export_summary.total_projects, 1);
    assert.equal(secondResult.json.data.export_summary.closed_projects, 0);
    assert.equal(secondResult.json.data.delivery_state, 'delivered');
    assert.equal(secondResult.json.data.delivery_receipt_id, 'receipt-001');
    assert.equal(secondResult.json.data.delivery_acknowledged, true);
    assert.equal(secondResult.json.meta.degraded, false);

    const externalExports = await readStoreJson(workspace.dataDir, 'external_exports.json');
    assert.equal(externalExports.records.length, 1);
    assert.equal(externalExports.records[0].export_rows[0].status, 'delivered');
    assert.equal(externalExports.records[0].delivery_state, 'delivered');
    assert.equal(externalExports.records[0].delivery_receipt_id, 'receipt-001');
});

test('sync_to_external_sheet_or_notion rejects invalid targets, missing projects, and failed deliveries without errors', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'customers.json', []);
    await writeStore(workspace.dataDir, 'projects.json', []);

    const invalidTargetResult = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        target_type: 'spreadsheet'
    }, env);

    assertFailureEnvelope(invalidTargetResult, 'INVALID_INPUT');
    assert.equal(invalidTargetResult.json.error.field, 'target_type');

    const missingProjectResult = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        project_id: 'proj_missing'
    }, env);

    assertFailureEnvelope(missingProjectResult, 'RESOURCE_NOT_FOUND');
    assert.equal(missingProjectResult.json.error.field, 'project_id');

    const failedDeliveryResult = await runPlugin(EXTERNAL_SYNC_PLUGIN, {
        delivery_state: 'failed'
    }, env);

    assertFailureEnvelope(failedDeliveryResult, 'MISSING_REQUIRED_FIELD');
    assert.equal(failedDeliveryResult.json.error.field, 'delivery_error');
});
