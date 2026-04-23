const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const externalSyncPlugin = require('../../plugins/custom/reporting/sync_to_external_sheet_or_notion/src/index.js');
const { makeTempDataRoot, store } = require('./helpers');

function writeJson(dataRoot, fileName, payload) {
  fs.writeFileSync(path.join(dataRoot, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('sync_to_external_sheet_or_notion exports a full project inventory shadow record', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await externalSyncPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {
    cust_10000001: {
      customer_id: 'cust_10000001',
      customer_name: 'Northlight Studio'
    }
  });

  writeJson(dataRoot, 'projects.json', {
    proj_20000001: {
      project_id: 'proj_20000001',
      customer_id: 'cust_10000001',
      project_name: 'May Wedding Story',
      project_type: 'wedding',
      shoot_date: '2026-05-01',
      delivery_deadline: '2026-05-10',
      budget: 28000,
      status: 'selection_pending',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    },
    proj_20000002: {
      project_id: 'proj_20000002',
      customer_id: 'cust_10000001',
      project_name: 'Studio Portraits',
      project_type: 'portrait',
      shoot_date: '2026-04-20',
      delivery_deadline: '2026-05-06',
      budget: 9600,
      status: 'preparing',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    },
    proj_20000003: {
      project_id: 'proj_20000003',
      customer_id: 'cust_missing',
      project_name: 'Archive Closed Case',
      project_type: 'commercial',
      shoot_date: '2026-04-12',
      delivery_deadline: '2026-04-30',
      budget: 12000,
      status: 'completed',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await externalSyncPlugin.processToolCall({
    reference_date: '2026-05-05',
    upcoming_days: 7,
    delivery_state: 'queued',
    delivery_attempts: 1,
    delivery_acknowledged: false,
    note: 'Weekly sync export'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.target_type, 'sheet');
  assert.equal(result.data.target_provider, 'dingtalk_ai_table');
  assert.equal(result.data.target_name, 'photo_studio_project_inventory');
  assert.equal(result.data.export_scope, 'all_projects');
  assert.equal(result.data.export_row_count, 3);
  assert.equal(result.data.export_summary.total_projects, 3);
  assert.equal(result.data.export_summary.active_projects, 2);
  assert.equal(result.data.export_summary.closed_projects, 1);
  assert.equal(result.data.export_summary.overdue_projects, 0);
  assert.equal(result.data.export_summary.due_soon_projects, 2);
  assert.equal(result.data.delivery_state, 'queued');
  assert.equal(result.data.delivery_attempts, 1);
  assert.equal(result.data.delivery_acknowledged, false);
  assert.equal(result.meta.degraded, true);
  assert.match(result.data.export_text, /Delivery state: queued \| attempts 1/);
  assert.match(result.data.export_text, /Target provider: dingtalk_ai_table/);
  assert.match(result.data.export_text, /Photo Studio external sync export/);
  assert.match(result.data.export_text, /Weekly sync export/);
  assert.equal(result.data.export_rows[0].status, 'completed');
  assert.equal(result.data.export_rows[0].customer_name, '[Customer Name]');
  assert.equal(result.data.export_rows[0].target_provider, 'dingtalk_ai_table');

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].export_key.includes('sync_to_external_sheet_or_notion:sheet:dingtalk_ai_table:photo_studio_project_inventory:all_projects:all:include_closed'), true);
  assert.equal(externalExports[0].target_provider, 'dingtalk_ai_table');
  assert.equal(externalExports[0].delivery_state, 'queued');
  assert.equal(externalExports[0].delivery_attempts, 1);
  assert.equal(externalExports[0].delivery_acknowledged, false);
  assert.equal(externalExports[0].delivery_channel, 'local_shadow_outbox');
});

test('sync_to_external_sheet_or_notion updates the same export record for the same target key', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await externalSyncPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {
    cust_10000001: {
      customer_id: 'cust_10000001',
      customer_name: 'Northlight Studio'
    }
  });

  writeJson(dataRoot, 'projects.json', {
    proj_20000001: {
      project_id: 'proj_20000001',
      customer_id: 'cust_10000001',
      project_name: 'May Wedding Story',
      project_type: 'wedding',
      shoot_date: '2026-05-01',
      delivery_deadline: '2026-05-10',
      budget: 28000,
      status: 'selection_pending',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const firstResult = await externalSyncPlugin.processToolCall({
    target_type: 'notion',
    target_name: 'Client Board',
    project_id: 'proj_20000001',
    reference_date: '2026-05-05',
    delivery_state: 'retry_scheduled',
    delivery_error: 'Notion rate limit',
    retry_after_days: 3,
    delivery_attempts: 2
  });

  assert.equal(firstResult.success, true);
  assert.equal(firstResult.data.export_scope, 'single_project');
  assert.equal(firstResult.data.target_provider, null);
  assert.equal(firstResult.data.export_rows.length, 1);
  assert.equal(firstResult.data.export_rows[0].target_type, 'notion');
  assert.equal(firstResult.data.export_rows[0].target_provider, null);
  assert.equal(firstResult.data.export_rows[0].target_name, 'Client Board');
  assert.equal(firstResult.data.delivery_state, 'retry_scheduled');
  assert.equal(firstResult.data.delivery_attempts, 2);
  assert.equal(firstResult.data.retry_after_date, '2026-05-08');

  writeJson(dataRoot, 'projects.json', {
    proj_20000001: {
      project_id: 'proj_20000001',
      customer_id: 'cust_10000001',
      project_name: 'May Wedding Story',
      project_type: 'wedding',
      shoot_date: '2026-05-01',
      delivery_deadline: '2026-05-12',
      budget: 30000,
      status: 'delivering',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-22T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const secondResult = await externalSyncPlugin.processToolCall({
    target_type: 'notion',
    target_name: 'Client Board',
    project_id: 'proj_20000001',
    reference_date: '2026-05-05',
    delivery_state: 'delivered',
    delivery_receipt_id: 'receipt-001',
    delivery_acknowledged: true,
    delivery_attempts: 3
  });

  assert.equal(secondResult.success, true);
  assert.equal(secondResult.data.external_export_id, firstResult.data.external_export_id);
  assert.equal(secondResult.data.export_rows.length, 1);
  assert.equal(secondResult.data.export_rows[0].status, 'delivering');
  assert.equal(secondResult.data.export_summary.total_projects, 1);
  assert.equal(secondResult.data.export_summary.closed_projects, 0);
  assert.equal(secondResult.data.delivery_state, 'delivered');
  assert.equal(secondResult.data.delivery_receipt_id, 'receipt-001');
  assert.equal(secondResult.data.delivery_acknowledged, true);
  assert.equal(secondResult.meta.degraded, false);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 1);
  assert.equal(externalExports[0].export_rows[0].status, 'delivering');
  assert.equal(externalExports[0].target_provider, null);
  assert.equal(externalExports[0].delivery_state, 'delivered');
  assert.equal(externalExports[0].delivery_receipt_id, 'receipt-001');
});

test('sync_to_external_sheet_or_notion keeps sheet export identities separate by target_provider', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await externalSyncPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {
    cust_10000001: {
      customer_id: 'cust_10000001',
      customer_name: 'Northlight Studio'
    }
  });

  writeJson(dataRoot, 'projects.json', {
    proj_20000001: {
      project_id: 'proj_20000001',
      customer_id: 'cust_10000001',
      project_name: 'May Wedding Story',
      project_type: 'wedding',
      shoot_date: '2026-05-01',
      delivery_deadline: '2026-05-10',
      budget: 28000,
      status: 'selection_pending',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const dingTalkResult = await externalSyncPlugin.processToolCall({
    target_type: 'sheet',
    target_provider: 'dingtalk_ai_table',
    target_name: 'Ops Board',
    project_id: 'proj_20000001',
    reference_date: '2026-05-05'
  });

  const baserowResult = await externalSyncPlugin.processToolCall({
    target_type: 'sheet',
    target_provider: 'baserow',
    target_name: 'Ops Board',
    project_id: 'proj_20000001',
    reference_date: '2026-05-05'
  });

  assert.equal(dingTalkResult.success, true);
  assert.equal(baserowResult.success, true);
  assert.equal(dingTalkResult.data.target_provider, 'dingtalk_ai_table');
  assert.equal(baserowResult.data.target_provider, 'baserow');
  assert.notEqual(dingTalkResult.data.external_export_id, baserowResult.data.external_export_id);
  assert.notEqual(dingTalkResult.data.export_key, baserowResult.data.export_key);

  const externalExports = store.getExternalExports();
  assert.equal(externalExports.length, 2);
  assert.equal(externalExports.some((record) => record.export_key.includes(':sheet:dingtalk_ai_table:ops_board:single_project:proj_20000001:include_closed')), true);
  assert.equal(externalExports.some((record) => record.export_key.includes(':sheet:baserow:ops_board:single_project:proj_20000001:include_closed')), true);
});

test('sync_to_external_sheet_or_notion rejects invalid targets, missing projects, and failed deliveries without errors', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await externalSyncPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {});
  writeJson(dataRoot, 'projects.json', {});
  store.clearCache().configureDataRoot(dataRoot);

  const invalidTargetResult = await externalSyncPlugin.processToolCall({
    target_type: 'spreadsheet'
  });

  assert.equal(invalidTargetResult.success, false);
  assert.equal(invalidTargetResult.error.code, 'INVALID_INPUT');
  assert.equal(invalidTargetResult.error.field, 'target_type');

  const invalidProviderResult = await externalSyncPlugin.processToolCall({
    target_type: 'sheet',
    target_provider: 'airtable'
  });

  assert.equal(invalidProviderResult.success, false);
  assert.equal(invalidProviderResult.error.code, 'INVALID_INPUT');
  assert.equal(invalidProviderResult.error.field, 'target_provider');

  const missingProjectResult = await externalSyncPlugin.processToolCall({
    project_id: 'proj_missing'
  });

  assert.equal(missingProjectResult.success, false);
  assert.equal(missingProjectResult.error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(missingProjectResult.error.field, 'project_id');

  const failedDeliveryResult = await externalSyncPlugin.processToolCall({
    delivery_state: 'failed'
  });

  assert.equal(failedDeliveryResult.success, false);
  assert.equal(failedDeliveryResult.error.code, 'MISSING_REQUIRED_FIELD');
  assert.equal(failedDeliveryResult.error.field, 'delivery_error');
});
