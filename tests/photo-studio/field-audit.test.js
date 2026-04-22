const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const fieldAuditPlugin = require('../../plugins/custom/project/check_missing_project_fields/src/index.js');
const { makeTempDataRoot, store } = require('./helpers');

function writeJson(dataRoot, fileName, payload) {
  fs.writeFileSync(path.join(dataRoot, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('check_missing_project_fields audits missing required and recommended fields across projects', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await fieldAuditPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

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
      customer_id: 'cust_missing',
      project_name: 'Incomplete Commercial',
      project_type: 'commercial',
      shoot_date: '',
      delivery_deadline: '',
      budget: null,
      status: 'quoted',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    },
    proj_20000003: {
      project_id: 'proj_20000003',
      customer_id: 'cust_10000001',
      project_name: '',
      project_type: null,
      shoot_date: '2026-05-02',
      delivery_deadline: '2026-05-12',
      budget: 8600,
      status: 'lead',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const result = await fieldAuditPlugin.processToolCall({
    include_recommended_fields: true
  });

  assert.equal(result.success, true);
  assert.equal(result.data.audit_label, 'missing_project_fields');
  assert.equal(result.data.audit_mode, 'all_projects');
  assert.equal(result.data.summary.total_projects_checked, 3);
  assert.equal(result.data.summary.projects_with_issues, 2);
  assert.equal(result.data.summary.required_field_gap_count, 2);
  assert.equal(result.data.summary.recommended_field_gap_count, 3);
  assert.equal(result.data.summary.invalid_customer_reference_count, 1);
  assert.equal(result.meta.degraded, true);
  assert.equal(result.data.project_rows.length, 2);
  assert.equal(result.data.project_rows[0].project_name, 'Incomplete Commercial');
  assert.deepEqual(result.data.project_rows[0].missing_required_fields, []);
  assert.deepEqual(result.data.project_rows[0].missing_recommended_fields, ['shoot_date', 'delivery_deadline', 'budget']);
  assert.deepEqual(result.data.project_rows[0].invalid_reference_fields, ['customer_id']);
  assert.equal(result.data.project_rows[1].project_name, '[Untitled Project]');
  assert.deepEqual(result.data.project_rows[1].missing_required_fields, ['project_name', 'project_type']);
  assert.match(result.data.audit_text, /Photo Studio project field audit/);
  assert.match(result.data.audit_text, /Incomplete Commercial/);
});

test('check_missing_project_fields can target a single project and rejects missing project references', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await fieldAuditPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {});
  writeJson(dataRoot, 'projects.json', {
    proj_20000004: {
      project_id: 'proj_20000004',
      customer_id: 'cust_missing',
      project_name: 'One-off Audit',
      project_type: 'event',
      status: 'preparing',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  store.clearCache().configureDataRoot(dataRoot);

  const singleResult = await fieldAuditPlugin.processToolCall({
    project_id: 'proj_20000004',
    include_recommended_fields: false
  });

  assert.equal(singleResult.success, true);
  assert.equal(singleResult.data.audit_mode, 'single_project');
  assert.equal(singleResult.data.checked_project_id, 'proj_20000004');
  assert.equal(singleResult.data.project_rows.length, 1);
  assert.equal(singleResult.data.project_rows[0].missing_recommended_fields.length, 0);
  assert.deepEqual(singleResult.data.project_rows[0].invalid_reference_fields, ['customer_id']);

  const missingResult = await fieldAuditPlugin.processToolCall({
    project_id: 'proj_missing'
  });

  assert.equal(missingResult.success, false);
  assert.equal(missingResult.error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(missingResult.error.field, 'project_id');
});
