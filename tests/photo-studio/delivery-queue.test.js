const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const deliveryQueuePlugin = require('../../plugins/custom/delivery/process_external_delivery_queue/src/index.js');
const dingTalkAITablePublishAdapter = require('../../plugins/custom/shared/photo_studio_data/DingTalkAITablePublishAdapter');
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

test('process_external_delivery_queue supports publish_record dry_run without mutating the local shadow record', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const commandCalls = [];
  const fakeCommandRunner = async (command, args) => {
    commandCalls.push({ command, args });

    if (args[0] === 'auth' && args[1] === 'status') {
      return {
        ok: true,
        payload: {
          authenticated: true,
          token_valid: true
        }
      };
    }

    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot,
    DingTalkBaseId: 'base_001',
    DingTalkTableId: 'table_001',
    DingTalkFieldMap: JSON.stringify({
      fldTitle: 'export_rows.0.project_id',
      fldSummary: 'export_text',
      fldProjectCount: 'export_summary.total_projects'
    }),
    DingTalkCommandRunner: fakeCommandRunner
  });

  writeJson(dataRoot, 'external_exports.json', {
    export_sheet: buildExportRecord({
      external_export_id: 'export_sheet',
      export_key: 'queue:dingtalk_dry_run',
      target_type: 'sheet',
      target_name: 'photo_studio_project_inventory',
      delivery_state: 'ready_to_publish',
      export_text: 'dry run dingtalk export'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:dingtalk_dry_run',
    reference_date: '2026-05-06',
    execution_mode: 'dry_run'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'dry_run_preview');
  assert.equal(result.data.preview_only, true);
  assert.equal(result.data.record_unchanged, true);
  assert.equal(result.data.delivery_state, 'ready_to_publish');
  assert.equal(result.data.request_preview.provider, 'dingtalk_ai_table');
  assert.equal(result.data.request_preview.base_id, 'base_001');
  assert.equal(result.data.request_preview.table_id, 'table_001');
  assert.equal(result.data.request_preview.command_preview.command, 'dws');
  assert.equal(result.data.request_preview.command_preview.args.includes('--records'), true);
  assert.equal(result.data.request_preview.records_preview[0].cells.fldTitle, 'proj_20000001');
  assert.equal(result.data.request_preview.records_preview[0].cells.fldProjectCount, 1);
  assert.equal(commandCalls.length, 1);
  assert.deepEqual(commandCalls[0], {
    command: 'dws',
    args: ['auth', 'status', '--format', 'json']
  });

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].delivery_state, 'ready_to_publish');
  assert.equal(externalExports[0].delivery_receipt_id, null);
});

test('process_external_delivery_queue publish_record live mode publishes a notion child page and persists delivery metadata', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  let capturedRequest = null;
  const fakeFetch = async (url, options) => {
    capturedRequest = {
      url,
      options: {
        ...options,
        headers: { ...options.headers },
        body: JSON.parse(options.body)
      }
    };

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: 'notion-page-123',
          url: 'https://www.notion.so/notion-page-123'
        };
      }
    };
  };

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot,
    NotionApiKey: 'secret_notion_key',
    NotionParentPageId: 'parent-page-001',
    ExternalPublishFetch: fakeFetch
  });

  writeJson(dataRoot, 'external_exports.json', {
    export_notion: buildExportRecord({
      external_export_id: 'export_notion',
      export_key: 'queue:notion_live',
      target_type: 'notion',
      target_name: 'Client Board',
      delivery_state: 'ready_to_publish',
      export_text: 'line 1\nline 2'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:notion_live',
    reference_date: '2026-05-06',
    execution_mode: 'live'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'live_published');
  assert.equal(result.data.published, true);
  assert.equal(result.data.delivery_state, 'delivered');
  assert.equal(result.data.delivery_acknowledged, true);
  assert.equal(result.data.delivery_receipt_id, 'notion-page-123');
  assert.equal(result.data.external_reference_url, 'https://www.notion.so/notion-page-123');
  assert.equal(result.data.delivery_channel, 'notion_page');

  assert.equal(capturedRequest.url, 'https://api.notion.com/v1/pages');
  assert.equal(capturedRequest.options.method, 'POST');
  assert.equal(capturedRequest.options.headers.Authorization, 'Bearer secret_notion_key');
  assert.equal(capturedRequest.options.headers['Notion-Version'], '2022-06-28');
  assert.equal(capturedRequest.options.body.parent.page_id, 'parent-page-001');
  assert.equal(Array.isArray(capturedRequest.options.body.children), true);
  assert.equal(capturedRequest.options.body.children.length >= 1, true);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].delivery_state, 'delivered');
  assert.equal(externalExports[0].delivery_receipt_id, 'notion-page-123');
  assert.equal(externalExports[0].external_reference_url, 'https://www.notion.so/notion-page-123');
});

test('process_external_delivery_queue publish_record live mode creates a DingTalk AI table record and persists delivery metadata', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const commandCalls = [];
  const fakeCommandRunner = async (command, args) => {
    commandCalls.push({ command, args });

    if (args[0] === 'auth' && args[1] === 'status') {
      return {
        ok: true,
        payload: {
          authenticated: true,
          token_valid: true
        }
      };
    }

    if (args[0] === 'aitable' && args[1] === 'record' && args[2] === 'create') {
      return {
        ok: true,
        payload: {
          data: {
            newRecordIds: [
              'rec_dingtalk_001'
            ]
          }
        }
      };
    }

    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot,
    DingTalkBaseId: 'base_001',
    DingTalkTableId: 'table_001',
    DingTalkFieldMap: {
      fldTitle: 'export_rows.0.project_id',
      fldSummary: 'export_text',
      fldTargetName: 'target_name'
    },
    DingTalkCommandRunner: fakeCommandRunner
  });

  writeJson(dataRoot, 'external_exports.json', {
    export_sheet: buildExportRecord({
      external_export_id: 'export_sheet',
      export_key: 'queue:dingtalk_live',
      target_type: 'sheet',
      target_name: 'photo_studio_project_inventory',
      delivery_state: 'ready_to_publish',
      export_text: 'live dingtalk export'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:dingtalk_live',
    reference_date: '2026-05-06',
    execution_mode: 'live'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'live_published');
  assert.equal(result.data.published, true);
  assert.equal(result.data.delivery_state, 'delivered');
  assert.equal(result.data.delivery_acknowledged, true);
  assert.equal(result.data.delivery_receipt_id, 'rec_dingtalk_001');
  assert.equal(result.data.external_reference_url, 'https://alidocs.dingtalk.com/i/nodes/base_001');
  assert.equal(result.data.delivery_channel, 'dingtalk_ai_table');
  assert.equal(commandCalls.length, 2);
  assert.equal(commandCalls[1].command, 'dws');
  assert.deepEqual(commandCalls[1].args.slice(0, 7), [
    'aitable',
    'record',
    'create',
    '--base-id',
    'base_001',
    '--table-id',
    'table_001'
  ]);
  assert.equal(commandCalls[1].args.includes('--records'), true);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].delivery_state, 'delivered');
  assert.equal(externalExports[0].delivery_receipt_id, 'rec_dingtalk_001');
  assert.equal(externalExports[0].external_reference_url, 'https://alidocs.dingtalk.com/i/nodes/base_001');
});

test('process_external_delivery_queue publish_record dry_run supports literal DingTalk field values', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const commandCalls = [];
  const fakeCommandRunner = async (command, args) => {
    commandCalls.push({ command, args });

    if (args[0] === 'auth' && args[1] === 'status') {
      return {
        ok: true,
        payload: {
          authenticated: true,
          token_valid: true
        }
      };
    }

    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot,
    DingTalkBaseId: 'base_literal',
    DingTalkTableId: 'table_literal',
    DingTalkFieldMap: {
      fldTitle: 'export_rows.0.project_id',
      fldChannel: 'photo_studio',
      fldPriority: 3,
      fldEnabled: true
    },
    DingTalkCommandRunner: fakeCommandRunner
  });

  writeJson(dataRoot, 'external_exports.json', {
    export_sheet_literal: buildExportRecord({
      external_export_id: 'export_sheet_literal',
      export_key: 'queue:dingtalk_literal',
      target_type: 'sheet',
      target_name: 'photo_studio_literal_test',
      delivery_state: 'ready_to_publish',
      export_text: 'literal dingtalk export'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:dingtalk_literal',
    reference_date: '2026-05-06',
    execution_mode: 'dry_run'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'dry_run_preview');
  assert.equal(result.data.request_preview.records_preview[0].cells.fldTitle, 'proj_20000001');
  assert.equal(result.data.request_preview.records_preview[0].cells.fldChannel, 'photo_studio');
  assert.equal(result.data.request_preview.records_preview[0].cells.fldPriority, 3);
  assert.equal(result.data.request_preview.records_preview[0].cells.fldEnabled, true);
  assert.equal(commandCalls.length, 1);
});

test('process_external_delivery_queue clears stale live publish config across re-initialization', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  const envKeys = [
    'VCP_PHOTO_STUDIO_NOTION_API_KEY',
    'NOTION_API_KEY',
    'VCP_PHOTO_STUDIO_NOTION_PARENT_PAGE_ID',
    'NOTION_PARENT_PAGE_ID'
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  envKeys.forEach((key) => {
    delete process.env[key];
  });

  t.after(() => {
    envKeys.forEach((key) => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = originalEnv[key];
    });
  });

  let fetchCalled = false;
  const fakeFetch = async () => {
    fetchCalled = true;
    throw new Error('stale fetch should not be reused');
  };

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot,
    NotionApiKey: 'secret_notion_key',
    NotionParentPageId: 'parent-page-001',
    ExternalPublishFetch: fakeFetch
  });

  await deliveryQueuePlugin.initialize({
    DebugMode: false,
    PhotoStudioDataPath: dataRoot
  });

  writeJson(dataRoot, 'external_exports.json', {
    export_notion: buildExportRecord({
      external_export_id: 'export_notion',
      export_key: 'queue:notion_reinit',
      target_type: 'notion',
      target_name: 'Client Board',
      delivery_state: 'ready_to_publish',
      export_text: 'reinit notion export'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:notion_reinit',
    reference_date: '2026-05-06',
    execution_mode: 'live'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'missing_live_config');
  assert.equal(result.data.no_op, true);
  assert.deepEqual(result.data.missing_fields, ['NotionApiKey', 'NotionParentPageId']);
  assert.equal(result.data.record_unchanged, true);
  assert.equal(fetchCalled, false);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].delivery_state, 'ready_to_publish');
  assert.equal(externalExports[0].delivery_receipt_id, null);
});

test('process_external_delivery_queue publish_record live mode no-ops for sheet targets when DingTalk live config is missing', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await deliveryQueuePlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'external_exports.json', {
    export_sheet: buildExportRecord({
      external_export_id: 'export_sheet',
      export_key: 'queue:sheet_live',
      target_type: 'sheet',
      target_name: 'Ops Board',
      delivery_state: 'ready_to_publish',
      export_text: 'sheet export'
    })
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await deliveryQueuePlugin.processToolCall({
    action: 'publish_record',
    export_key: 'queue:sheet_live',
    reference_date: '2026-05-06',
    execution_mode: 'live'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.activation_status, 'missing_live_config');
  assert.equal(result.data.no_op, true);
  assert.equal(result.data.record_unchanged, true);
  assert.deepEqual(result.data.missing_fields, ['DingTalkBaseId', 'DingTalkTableId', 'DingTalkFieldMap']);
  assert.equal(result.meta.degraded, true);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].delivery_state, 'ready_to_publish');
  assert.equal(externalExports[0].delivery_receipt_id, null);
});

test('DingTalkAITablePublishAdapter preserves explicit Windows command wrappers instead of forcing node execution', () => {
  const originalPlatform = process.platform;
  const originalPath = process.env.PATH;
  const originalPathExt = process.env.PATHEXT;
  const originalAppData = process.env.APPDATA;

  Object.defineProperty(process, 'platform', { value: 'win32' });
  process.env.PATH = '';
  process.env.PATHEXT = '.EXE;.CMD;.BAT;.PS1;.JS';
  process.env.APPDATA = '';

  try {
    const spawnSpec = dingTalkAITablePublishAdapter._resolveSpawnSpec(
      'C:\\tools\\dws.cmd',
      ['auth', 'status', '--format', 'json']
    );

    assert.equal(spawnSpec.command, 'C:\\tools\\dws.cmd');
    assert.equal(spawnSpec.shell, true);
    assert.deepEqual(spawnSpec.args, ['auth', 'status', '--format', 'json']);
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env.PATH = originalPath;
    process.env.PATHEXT = originalPathExt;
    process.env.APPDATA = originalAppData;
  }
});

test('DingTalkAITablePublishAdapter resolves bare dws from PATH before machine-local fallback', (t) => {
  const tempRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const originalPlatform = process.platform;
  const originalPath = process.env.PATH;
  const originalPathExt = process.env.PATHEXT;
  const originalAppData = process.env.APPDATA;

  const pathDir = path.join(tempRoot, 'bin');
  const appDataDir = path.join(tempRoot, 'appdata');
  fs.mkdirSync(pathDir, { recursive: true });
  fs.mkdirSync(path.join(appDataDir, 'npm', 'node_modules', 'dingtalk-workspace-cli', 'bin'), { recursive: true });

  const pathCommand = path.join(pathDir, 'dws.cmd');
  const fallbackScript = path.join(appDataDir, 'npm', 'node_modules', 'dingtalk-workspace-cli', 'bin', 'dws.js');
  fs.writeFileSync(pathCommand, '@echo off\r\n', 'utf8');
  fs.writeFileSync(fallbackScript, 'console.log(\"fallback\");\n', 'utf8');

  Object.defineProperty(process, 'platform', { value: 'win32' });
  process.env.PATH = pathDir;
  process.env.PATHEXT = '.EXE;.CMD;.BAT;.PS1;.JS';
  process.env.APPDATA = appDataDir;

  try {
    const resolved = dingTalkAITablePublishAdapter._resolveWindowsDwsCommand('dws');
    const spawnSpec = dingTalkAITablePublishAdapter._resolveSpawnSpec('dws', ['auth', 'status']);

    assert.equal(resolved, pathCommand);
    assert.equal(spawnSpec.command, pathCommand);
    assert.equal(spawnSpec.shell, true);
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env.PATH = originalPath;
    process.env.PATHEXT = originalPathExt;
    process.env.APPDATA = originalAppData;
  }
});
