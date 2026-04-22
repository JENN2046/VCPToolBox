const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const digestPlugin = require('../../plugins/custom/reporting/generate_weekly_project_digest/src/index.js');
const { makeTempDataRoot, store } = require('./helpers');

function writeJson(dataRoot, fileName, payload) {
  fs.writeFileSync(path.join(dataRoot, fileName), JSON.stringify(payload, null, 2), 'utf8');
}

test('generate_weekly_project_digest summarizes project activity and due dates', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await digestPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {
    cust_10000001: {
      customer_id: 'cust_10000001',
      customer_name: 'Northlight Studio'
    },
    cust_10000002: {
      customer_id: 'cust_10000002',
      customer_name: 'Morning Light'
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
      customer_id: 'cust_10000002',
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
      customer_id: 'cust_10000001',
      project_name: 'Commercial Retouch',
      project_type: 'commercial',
      shoot_date: '2026-04-12',
      delivery_deadline: '2026-04-28',
      budget: 12000,
      status: 'completed',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });

  writeJson(dataRoot, 'status_log.json', [
    {
      log_id: 'log_30000001',
      project_id: 'proj_20000001',
      old_status: 'shot',
      new_status: 'selection_pending',
      changed_at: '2026-05-04T10:00:00.000Z',
      reason: 'Sent for client selection'
    },
    {
      log_id: 'log_30000002',
      project_id: 'proj_20000002',
      old_status: 'confirmed',
      new_status: 'preparing',
      changed_at: '2026-05-03T10:00:00.000Z',
      reason: 'Prep checklist approved'
    },
    {
      log_id: 'log_30000003',
      project_id: 'proj_20000003',
      old_status: 'delivering',
      new_status: 'completed',
      changed_at: '2026-04-25T10:00:00.000Z',
      reason: 'Client approved'
    }
  ]);

  store.clearCache().configureDataRoot(dataRoot);

  const result = await digestPlugin.processToolCall({
    reference_date: '2026-05-05',
    lookback_days: 7,
    upcoming_days: 7
  });

  assert.equal(result.success, true);
  assert.equal(result.data.reference_date, '2026-05-05');
  assert.equal(result.data.summary.total_projects, 3);
  assert.equal(result.data.summary.active_projects, 2);
  assert.equal(result.data.summary.closed_projects, 1);
  assert.equal(result.data.overdue_projects.length, 0);
  assert.equal(result.data.upcoming_due_projects.length, 2);
  assert.equal(result.data.recent_transitions.length, 2);
  assert.equal(result.meta.degraded, false);
  assert.match(result.data.digest_text, /Weekly photo_studio digest/);
  assert.match(result.data.digest_text, /May Wedding Story/);
  assert.match(result.data.digest_text, /Studio Portraits/);
});

test('generate_weekly_project_digest keeps missing customer and due-date degradation explicit', async (t) => {
  const dataRoot = makeTempDataRoot();
  t.after(() => fs.rmSync(dataRoot, { recursive: true, force: true }));

  store.configureDataRoot(dataRoot).resetAllData();
  await digestPlugin.initialize({ DebugMode: false, PhotoStudioDataPath: dataRoot });

  writeJson(dataRoot, 'customers.json', {});
  writeJson(dataRoot, 'projects.json', {
    proj_20000004: {
      project_id: 'proj_20000004',
      customer_id: 'cust_missing',
      project_name: 'Incomplete Project',
      project_type: 'event',
      shoot_date: '2026-05-01',
      delivery_deadline: '',
      budget: 4000,
      status: 'selection_pending',
      created_at: '2026-04-21T08:00:00.000Z',
      updated_at: '2026-04-21T08:00:00.000Z'
    }
  });
  writeJson(dataRoot, 'status_log.json', []);

  store.clearCache().configureDataRoot(dataRoot);

  const result = await digestPlugin.processToolCall({
    reference_date: '2026-05-05'
  });

  assert.equal(result.success, true);
  assert.equal(result.meta.degraded, true);
  assert.equal(result.data.data_quality.missing_due_date_count, 1);
  assert.equal(result.data.data_quality.missing_customer_count, 1);
  assert.equal(result.data.data_quality.missing_project_reference_count, 0);
  assert.equal(result.data.project_rows[0].customer_name, '[Customer Name]');
  assert.equal(result.data.project_rows[0].attention_state, 'missing_due_date');
});
