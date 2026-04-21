const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');
const {
    assertSuccessEnvelope,
    cleanupWorkspace,
    createTempWorkspace,
    runPlugin
} = require('./helpers');

const REPORT_PLUGIN = 'Plugin/PhotoStudioDeliveryOperatorReport/PhotoStudioDeliveryOperatorReport.js';
const AUDIT_PLUGIN = 'Plugin/PhotoStudioDeliveryAuditTrail/PhotoStudioDeliveryAuditTrail.js';

async function writeStore(dataDir, fileName, records) {
    const payload = {
        version: 1,
        updated_at: '2026-04-21T00:00:00.000Z',
        records
    };

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

function buildExportRecord(overrides) {
    return {
        external_export_id: 'export_seed',
        export_key: 'sync_to_external_sheet_or_notion:sheet:photo_studio_project_inventory:all_projects:all:include_closed',
        target_type: 'sheet',
        target_name: 'photo_studio_project_inventory',
        export_scope: 'all_projects',
        project_id: null,
        reference_date: '2026-05-05',
        upcoming_days: 14,
        include_closed_projects: true,
        delivery_state: 'ready_to_publish',
        delivery_attempts: 1,
        delivery_acknowledged: false,
        delivery_receipt_id: null,
        delivery_error: null,
        retry_after_days: 2,
        retry_after_date: null,
        delivery_channel: 'local_shadow_outbox',
        export_row_count: 1,
        export_summary: {
            total_projects: 1,
            active_projects: 1,
            closed_projects: 0,
            overdue_projects: 0,
            due_soon_projects: 0,
            missing_due_date_count: 0,
            missing_customer_count: 0
        },
        export_rows: [
            {
                project_id: 'proj_20000001',
                customer_id: 'cust_10000001',
                customer_name: 'Northlight Studio',
                project_name: 'May Wedding Story',
                project_type: 'wedding',
                status: 'reviewing',
                start_date: '2026-05-01',
                due_date: '2026-05-10',
                budget: 28000,
                days_until_due: 5,
                attention_state: 'due_soon',
                target_type: 'sheet',
                target_name: 'photo_studio_project_inventory',
                export_surface: 'local_shadow_external_export',
                sync_state: 'local_shadow'
            }
        ],
        export_text: 'seed',
        export_surface: 'local_shadow_external_export',
        sync_state: 'local_shadow',
        note: null,
        created_at: '2026-04-21T00:00:00.000Z',
        updated_at: '2026-04-21T00:00:00.000Z',
        normalized_target_name: 'photo_studio_project_inventory',
        ...overrides
    };
}

test('generate_delivery_operator_report summarizes queue health and alerts', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'external_exports.json', [
        buildExportRecord({
            external_export_id: 'export_ready',
            export_key: 'report:ready',
            delivery_state: 'ready_to_publish',
            export_text: 'ready'
        }),
        buildExportRecord({
            external_export_id: 'export_retry_due',
            export_key: 'report:retry_due',
            delivery_state: 'retry_scheduled',
            retry_after_date: '2026-05-04',
            delivery_error: 'Rate limit',
            export_text: 'retry due'
        }),
        buildExportRecord({
            external_export_id: 'export_queued',
            export_key: 'report:queued',
            delivery_state: 'queued',
            export_text: 'queued'
        }),
        buildExportRecord({
            external_export_id: 'export_failed',
            export_key: 'report:failed',
            delivery_state: 'failed',
            delivery_error: 'Notion timeout',
            export_text: 'failed'
        }),
        buildExportRecord({
            external_export_id: 'export_delivered',
            export_key: 'report:delivered',
            delivery_state: 'delivered',
            delivery_acknowledged: false,
            delivery_receipt_id: 'receipt-001',
            export_text: 'delivered'
        })
    ]);

    const result = await runPlugin(REPORT_PLUGIN, {
        reference_date: '2026-05-06'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.summary.total_records, 5);
    assert.equal(result.json.data.summary.ready_to_publish_count, 1);
    assert.equal(result.json.data.summary.retry_due_count, 1);
    assert.equal(result.json.data.summary.failed_count, 1);
    assert.equal(result.json.data.summary.delivered_count, 1);
    assert.equal(result.json.data.summary.awaiting_confirmation_count, 1);
    assert.equal(result.json.data.summary.stalled_count, 3);
    assert.equal(result.json.data.operator_alerts[0].operator_status, 'failed');
    assert.equal(result.json.data.operator_alerts[0].action_hint, 'reschedule_retry');
    assert.equal(result.json.data.operator_alerts[1].operator_status, 'retry_due');
    assert.match(result.json.data.report_text, /PhotoStudio delivery operator report/);
    assert.match(result.json.data.report_text, /Notion timeout/);
});

test('inspect_delivery_audit_trail builds a derived timeline for a project', async (t) => {
    const workspace = await createTempWorkspace();
    t.after(() => cleanupWorkspace(workspace.workspaceRoot));

    const env = {
        PROJECT_BASE_PATH: workspace.workspaceRoot,
        PHOTO_STUDIO_DATA_DIR: workspace.dataDir
    };

    await writeStore(workspace.dataDir, 'external_exports.json', [
        buildExportRecord({
            external_export_id: 'export_target',
            export_key: 'audit:target',
            project_id: 'proj_20000001',
            delivery_state: 'retry_scheduled',
            created_at: '2026-05-01T08:00:00.000Z',
            updated_at: '2026-05-03T09:00:00.000Z',
            retry_after_date: '2026-05-06',
            delivery_error: 'Waiting for slot',
            export_text: 'target'
        }),
        buildExportRecord({
            external_export_id: 'export_other',
            export_key: 'audit:other',
            project_id: 'proj_20000002',
            delivery_state: 'delivered',
            created_at: '2026-05-02T08:00:00.000Z',
            updated_at: '2026-05-04T09:00:00.000Z',
            delivery_acknowledged: true,
            delivery_receipt_id: 'receipt-777',
            export_rows: [
                {
                    project_id: 'proj_20000002',
                    customer_id: 'cust_10000002',
                    customer_name: 'Sunrise Atelier',
                    project_name: 'Portrait Session',
                    project_type: 'portrait',
                    status: 'delivered',
                    start_date: '2026-04-28',
                    due_date: '2026-05-02',
                    budget: 12000,
                    days_until_due: -4,
                    attention_state: 'closed',
                    target_type: 'sheet',
                    target_name: 'photo_studio_project_inventory',
                    export_surface: 'local_shadow_external_export',
                    sync_state: 'local_shadow'
                }
            ],
            export_text: 'other'
        })
    ]);

    const result = await runPlugin(AUDIT_PLUGIN, {
        project_id: 'proj_20000001',
        reference_date: '2026-05-06'
    }, env);

    assertSuccessEnvelope(result);
    assert.equal(result.json.data.audit_scope.projectId, 'proj_20000001');
    assert.equal(result.json.data.audit_summary.total_records, 1);
    assert.equal(result.json.data.audit_summary.total_events, 3);
    assert.equal(result.json.data.audit_rows[0].event_type, 'retry_window_scheduled');
    assert.equal(result.json.data.audit_rows[1].event_type, 'current_state_snapshot');
    assert.equal(result.json.data.audit_rows[2].event_type, 'record_created');
    assert.match(result.json.data.audit_text, /PhotoStudio delivery audit trail/);
    assert.match(result.json.data.audit_text, /May Wedding Story/);
});
