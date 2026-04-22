const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../../plugins/custom/shared/photo_studio_data/PhotoStudioDataStore');
const customerPlugin = require('../../plugins/custom/crm/create_customer_record/src/index.js');
const projectPlugin = require('../../plugins/custom/project/create_project_record/src/index.js');
const statusPlugin = require('../../plugins/custom/project/update_project_status/src/index.js');
const tasksPlugin = require('../../plugins/custom/project/create_project_tasks/src/index.js');
const replyPlugin = require('../../plugins/custom/crm/generate_client_reply_draft/src/index.js');

function makeTempDataRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'photo-studio-rebaseline-'));
}

test('photo_studio rebaseline core flow runs on the migrated contract', async (t) => {
  const dataRoot = makeTempDataRoot();

  t.after(() => {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  });

  store.configureDataRoot(dataRoot).resetAllData();

  const sharedConfig = { DebugMode: false, PhotoStudioDataPath: dataRoot };
  await customerPlugin.initialize(sharedConfig);
  await projectPlugin.initialize(sharedConfig);
  await statusPlugin.initialize(sharedConfig);
  await tasksPlugin.initialize(sharedConfig);
  await replyPlugin.initialize(sharedConfig);

  const customerResult = await customerPlugin.processToolCall({
    customer_name: '张三',
    customer_type: 'individual',
    contact_phone: '13800138000',
    source: 'referral'
  });

  assert.equal(customerResult.success, true);
  assert.match(customerResult.data.customer_id, /^cust_/);
  assert.equal(customerResult.data.normalized_contact_key, '张三::13800138000');

  const projectResult = await projectPlugin.processToolCall({
    customer_id: customerResult.data.customer_id,
    project_name: '张三婚礼跟拍',
    project_type: 'wedding',
    shoot_date: '2026-05-01',
    delivery_deadline: '2026-05-20',
    is_public_allowed: true
  });

  assert.equal(projectResult.success, true);
  assert.equal(projectResult.data.status, 'lead');

  const statusResult = await statusPlugin.processToolCall({
    project_id: projectResult.data.project_id,
    new_status: 'quoted',
    reason: '客户确认报价'
  });

  assert.equal(statusResult.success, true);
  assert.equal(statusResult.data.old_status, 'lead');
  assert.equal(statusResult.data.new_status, 'quoted');

  const tasksResult = await tasksPlugin.processToolCall({
    project_id: projectResult.data.project_id,
    task_template: 'wedding_standard'
  });

  assert.equal(tasksResult.success, true);
  assert.equal(tasksResult.data.created_count, 6);
  assert.equal(tasksResult.data.created_tasks[0].phase, 'lead');

  const replyResult = await replyPlugin.processToolCall({
    project_id: projectResult.data.project_id,
    context_type: 'quotation',
    tone: 'warm'
  });

  assert.equal(replyResult.success, true);
  assert.match(replyResult.data.draft_title, /报价方案/);
  assert.ok(replyResult.data.draft_body.includes('张三婚礼跟拍'));

  const savedProject = store.getProject(projectResult.data.project_id);
  const savedLogs = store.getStatusLog(projectResult.data.project_id);

  assert.equal(savedProject.status, 'quoted');
  assert.equal(savedLogs.length, 1);
  assert.equal(savedLogs[0].old_status, 'lead');
  assert.equal(savedLogs[0].new_status, 'quoted');

  assert.equal(fs.existsSync(path.join(dataRoot, 'content_pool.json')), true);
  assert.equal(fs.existsSync(path.join(dataRoot, 'templates.json')), true);
});
