const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const schedulerPlugin = require('../../plugins/custom/reporting/generate_delivery_queue_schedule/src/index.js');
const priorityPlugin = require('../../plugins/custom/reporting/prioritize_pending_delivery_actions/src/index.js');
const { makeTempDataRoot, store } = require('./helpers');

function writeJson(dataRoot, fileName, payload) {
  fs.writeFileSync(path.join(dataRoot, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

function buildExportRecord(overrides = {}) {
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
        status: 'selection_pending',
        shoot_date: '2026-05-01',
        delivery_deadline: '2026-05-10',
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

test('generate_delivery_queue_schedule groups actionable items into schedule windows', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await schedulerPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_failed: buildExportRecord({
      external_export_id: 'export_failed',
      export_key: 'schedule:failed',
      delivery_state: 'failed',
      delivery_error: 'Notion timeout',
      export_text: 'failed'
    }),
    export_retry_due: buildExportRecord({
      external_export_id: 'export_retry_due',
      export_key: 'schedule:retry_due',
      delivery_state: 'retry_scheduled',
      retry_after_date: '2026-05-04',
      delivery_error: 'Rate limit',
      export_text: 'retry due'
    }),
    export_ready: buildExportRecord({
      external_export_id: 'export_ready',
      export_key: 'schedule:ready',
      delivery_state: 'ready_to_publish',
      export_text: 'ready'
    }),
    export_queued: buildExportRecord({
      external_export_id: 'export_queued',
      export_key: 'schedule:queued',
      delivery_state: 'queued',
      export_text: 'queued'
    }),
    export_future_retry: buildExportRecord({
      external_export_id: 'export_future_retry',
      export_key: 'schedule:future_retry',
      delivery_state: 'retry_scheduled',
      retry_after_date: '2026-05-10',
      delivery_error: 'Waiting slot',
      export_text: 'future retry'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await schedulerPlugin.processToolCall({
    reference_date: '2026-05-06'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.summary.total_records, 5);
  assert.equal(result.data.summary.actionable_records, 5);
  assert.equal(result.data.summary.immediate_actions_count, 4);
  assert.equal(result.data.summary.future_actions_count, 1);
  assert.equal(result.data.summary.failed_count, 1);
  assert.equal(result.data.summary.retry_due_count, 1);
  assert.equal(result.data.summary.ready_to_publish_count, 1);
  assert.equal(result.data.summary.queued_count, 1);
  assert.equal(result.data.schedule_rows[0].external_export_id, 'export_failed');
  assert.equal(result.data.schedule_rows[1].external_export_id, 'export_retry_due');
  assert.equal(result.data.schedule_rows[2].external_export_id, 'export_ready');
  assert.equal(result.data.schedule_rows[3].external_export_id, 'export_queued');
  assert.equal(result.data.schedule_rows[4].external_export_id, 'export_future_retry');
  assert.equal(result.data.schedule_windows[0].schedule_date, '2026-05-06');
  assert.equal(result.data.schedule_windows[1].schedule_date, '2026-05-10');
  assert.match(result.data.schedule_text, /Photo Studio delivery queue schedule/);
  assert.match(result.data.schedule_text, /Notion timeout/);
});

test('prioritize_pending_delivery_actions returns a bounded priority queue', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await priorityPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_failed: buildExportRecord({
      external_export_id: 'export_failed',
      export_key: 'priority:failed',
      project_id: 'proj_20000001',
      delivery_state: 'failed',
      delivery_error: 'Blocked',
      export_text: 'failed'
    }),
    export_ready: buildExportRecord({
      external_export_id: 'export_ready',
      export_key: 'priority:ready',
      project_id: 'proj_20000001',
      delivery_state: 'ready_to_publish',
      export_text: 'ready'
    }),
    export_queued: buildExportRecord({
      external_export_id: 'export_queued',
      export_key: 'priority:queued',
      project_id: 'proj_20000001',
      delivery_state: 'queued',
      export_text: 'queued'
    }),
    export_other_project: buildExportRecord({
      external_export_id: 'export_other_project',
      export_key: 'priority:other',
      project_id: 'proj_20000002',
      delivery_state: 'failed',
      delivery_error: 'Other blocked',
      export_rows: [
        {
          project_id: 'proj_20000002',
          customer_id: 'cust_10000002',
          customer_name: 'Sunrise Atelier',
          project_name: 'Portrait Session',
          project_type: 'portrait',
          status: 'failed',
          shoot_date: '2026-04-28',
          delivery_deadline: '2026-05-02',
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
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await priorityPlugin.processToolCall({
    project_id: 'proj_20000001',
    reference_date: '2026-05-06',
    max_items: 2
  });

  assert.equal(result.success, true);
  assert.equal(result.data.summary.total_records, 3);
  assert.equal(result.data.summary.priority_items, 2);
  assert.equal(result.data.summary.critical_count, 1);
  assert.equal(result.data.summary.high_count, 1);
  assert.equal(result.data.summary.watch_count, 0);
  assert.equal(result.data.priority_queue[0].external_export_id, 'export_failed');
  assert.equal(result.data.priority_queue[1].external_export_id, 'export_ready');
  assert.equal(result.data.priority_queue[0].recommended_action, 'reschedule_retry');
  assert.equal(result.data.priority_queue[1].recommended_action, 'mark_queued');
  assert.match(result.data.priority_text, /Photo Studio delivery queue schedule/);
  assert.match(result.data.priority_text, /Blocked/);
});
