const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const deliveryQueuePlugin = require('../../plugins/custom/delivery/process_external_delivery_queue/src/index.js');
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

test('process_external_delivery_queue lists queueable records in priority order', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_ready: buildExportRecord({
      external_export_id: 'export_ready',
      export_key: 'queue:ready',
      delivery_state: 'ready_to_publish',
      export_text: 'ready'
    }),
    export_retry_due: buildExportRecord({
      external_export_id: 'export_retry_due',
      export_key: 'queue:retry_due',
      delivery_state: 'retry_scheduled',
      retry_after_date: '2026-05-04',
      delivery_error: 'Rate limit',
      export_text: 'retry due'
    }),
    export_retry_wait: buildExportRecord({
      external_export_id: 'export_retry_wait',
      export_key: 'queue:retry_wait',
      delivery_state: 'retry_scheduled',
      retry_after_date: '2026-05-07',
      delivery_error: 'Waiting for slot',
      export_text: 'retry wait'
    }),
    export_queued: buildExportRecord({
      external_export_id: 'export_queued',
      export_key: 'queue:queued',
      delivery_state: 'queued',
      export_text: 'queued'
    }),
    export_failed: buildExportRecord({
      external_export_id: 'export_failed',
      export_key: 'queue:failed',
      delivery_state: 'failed',
      delivery_error: 'Notion timeout',
      export_text: 'failed'
    }),
    export_delivered: buildExportRecord({
      external_export_id: 'export_delivered',
      export_key: 'queue:delivered',
      delivery_state: 'delivered',
      delivery_acknowledged: true,
      delivery_receipt_id: 'receipt-001',
      export_text: 'delivered'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'list_due',
    reference_date: '2026-05-06'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.queue_action, 'list_due');
  assert.equal(result.data.queue_summary.total_records, 6);
  assert.equal(result.data.queue_summary.queueable_records, 5);
  assert.equal(result.data.queue_summary.ready_to_publish_count, 1);
  assert.equal(result.data.queue_summary.queued_count, 1);
  assert.equal(result.data.queue_summary.retry_scheduled_count, 2);
  assert.equal(result.data.queue_summary.failed_count, 1);
  assert.equal(result.data.queue_summary.due_now_count, 4);
  assert.equal(result.data.queue_items.length, 5);
  assert.equal(result.data.queue_items[0].external_export_id, 'export_failed');
  assert.equal(result.data.queue_items[0].queue_bucket, 'failed');
  assert.equal(result.data.queue_items[1].external_export_id, 'export_retry_due');
  assert.equal(result.data.queue_items[1].queue_bucket, 'retry_due');
  assert.equal(result.data.queue_items[2].external_export_id, 'export_retry_wait');
  assert.equal(result.data.queue_items[2].queue_bucket, 'retry_waiting');
  assert.equal(result.data.queue_items[3].external_export_id, 'export_ready');
  assert.equal(result.data.queue_items[3].queue_bucket, 'ready');
  assert.equal(result.data.queue_items[4].external_export_id, 'export_queued');
  assert.equal(result.data.queue_items[4].queue_bucket, 'in_flight');
  assert.equal(result.data.queue_items[0].next_action, 'reschedule_retry');
  assert.equal(result.data.queue_items[3].next_action, 'mark_queued');

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 6);
});

test('process_external_delivery_queue supports ready -> queued -> delivered', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_ready: buildExportRecord({
      external_export_id: 'export_ready',
      export_key: 'queue:ready',
      delivery_state: 'ready_to_publish',
      export_text: 'ready'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const queuedResult = await deliveryQueuePlugin.processToolCall({
    action: 'mark_queued',
    export_key: 'queue:ready',
    reference_date: '2026-05-06'
  });

  assert.equal(queuedResult.success, true);
  assert.equal(queuedResult.data.previous_delivery_state, 'ready_to_publish');
  assert.equal(queuedResult.data.delivery_state, 'queued');
  assert.equal(queuedResult.data.delivery_attempts, 1);
  assert.equal(queuedResult.data.delivery_error, null);
  assert.equal(queuedResult.data.duplicate, false);

  const deliveredResult = await deliveryQueuePlugin.processToolCall({
    action: 'mark_delivered',
    export_key: 'queue:ready',
    delivery_receipt_id: 'receipt-9001',
    reference_date: '2026-05-06'
  });

  assert.equal(deliveredResult.success, true);
  assert.equal(deliveredResult.data.previous_delivery_state, 'queued');
  assert.equal(deliveredResult.data.delivery_state, 'delivered');
  assert.equal(deliveredResult.data.delivery_receipt_id, 'receipt-9001');
  assert.equal(deliveredResult.data.delivery_acknowledged, true);
  assert.equal(deliveredResult.data.duplicate, false);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports[0].delivery_state, 'delivered');
  assert.equal(externalExports[0].delivery_receipt_id, 'receipt-9001');
});

test('process_external_delivery_queue supports failed -> retry_scheduled -> queued and rejects invalid transitions', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_failed: buildExportRecord({
      external_export_id: 'export_failed',
      export_key: 'queue:failed',
      delivery_state: 'failed',
      delivery_attempts: 1,
      delivery_error: 'Notion timeout',
      export_text: 'failed'
    }),
    export_blocked: buildExportRecord({
      external_export_id: 'export_blocked',
      export_key: 'queue:blocked',
      delivery_state: 'failed',
      delivery_attempts: 1,
      delivery_error: 'Blocked',
      export_text: 'blocked'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const rescheduleResult = await deliveryQueuePlugin.processToolCall({
    action: 'reschedule_retry',
    export_key: 'queue:failed',
    reference_date: '2026-05-06',
    retry_after_days: 4
  });

  assert.equal(rescheduleResult.success, true);
  assert.equal(rescheduleResult.data.previous_delivery_state, 'failed');
  assert.equal(rescheduleResult.data.delivery_state, 'retry_scheduled');
  assert.equal(rescheduleResult.data.retry_after_date, '2026-05-10');

  const requeuedResult = await deliveryQueuePlugin.processToolCall({
    action: 'mark_queued',
    export_key: 'queue:failed',
    reference_date: '2026-05-06'
  });

  assert.equal(requeuedResult.success, true);
  assert.equal(requeuedResult.data.previous_delivery_state, 'retry_scheduled');
  assert.equal(requeuedResult.data.delivery_state, 'queued');
  assert.equal(requeuedResult.data.delivery_attempts, 2);
  assert.equal(requeuedResult.data.delivery_error, null);

  const invalidTransitionResult = await deliveryQueuePlugin.processToolCall({
    action: 'mark_delivered',
    export_key: 'queue:blocked',
    delivery_receipt_id: 'receipt-should-fail',
    reference_date: '2026-05-06'
  });

  assert.equal(invalidTransitionResult.success, false);
  assert.equal(invalidTransitionResult.error.code, 'INVALID_TRANSITION');
  assert.equal(invalidTransitionResult.error.field, 'action');

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.find((record) => record.export_key === 'queue:failed').delivery_state, 'queued');
  assert.equal(externalExports.find((record) => record.export_key === 'queue:failed').delivery_attempts, 2);
});
