const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../../plugins/custom/shared/photo_studio_data/PhotoStudioDataStore');
const customerPlugin = require('../../plugins/custom/crm/create_customer_record/src/index.js');
const projectPlugin = require('../../plugins/custom/project/create_project_record/src/index.js');
const statusPlugin = require('../../plugins/custom/project/update_project_status/src/index.js');
const tasksPlugin = require('../../plugins/custom/project/create_project_tasks/src/index.js');
const replyPlugin = require('../../plugins/custom/crm/generate_client_reply_draft/src/index.js');

async function initializeCorePlugins(dataRoot) {
  const sharedConfig = { DebugMode: false, PhotoStudioDataPath: dataRoot };
  store.configureDataRoot(dataRoot).resetAllData();
  await customerPlugin.initialize(sharedConfig);
  await projectPlugin.initialize(sharedConfig);
  await statusPlugin.initialize(sharedConfig);
  await tasksPlugin.initialize(sharedConfig);
  await replyPlugin.initialize(sharedConfig);
  return sharedConfig;
}

function makeTempDataRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'photo-studio-batch2-'));
}

async function createCoreFixture() {
  const customerResult = await customerPlugin.processToolCall({
    customer_name: 'Northlight Studio',
    customer_type: 'individual',
    contact_wechat: 'northlight-photo'
  });

  const projectResult = await projectPlugin.processToolCall({
    customer_id: customerResult.data.customer_id,
    project_name: 'May Wedding Story',
    project_type: 'wedding',
    shoot_date: '2026-05-04',
    delivery_deadline: '2026-05-18',
    budget: 28800
  });

  return {
    customer_id: customerResult.data.customer_id,
    project_id: projectResult.data.project_id
  };
}

async function moveProjectToStatus(projectId, targetStatus) {
  const transitionPath = ['quoted', 'confirmed', 'preparing', 'shot', 'selection_pending', 'retouching', 'delivering', 'completed', 'archived'];

  for (const nextStatus of transitionPath) {
    const result = await statusPlugin.processToolCall({
      project_id: projectId,
      new_status: nextStatus
    });

    if (result.success !== true) {
      throw new Error(`Unable to transition ${projectId} to ${nextStatus}: ${JSON.stringify(result)}`);
    }

    if (nextStatus === targetStatus) {
      return;
    }
  }

  throw new Error(`Unsupported target status for helper: ${targetStatus}`);
}

module.exports = {
  createCoreFixture,
  initializeCorePlugins,
  makeTempDataRoot,
  moveProjectToStatus,
  store
};
