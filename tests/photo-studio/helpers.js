const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const store = require('../../plugins/custom/shared/photo_studio_data/PhotoStudioDataStore');
const customerPlugin = require('../../plugins/custom/crm/create_customer_record/src/index.js');
const projectPlugin = require('../../plugins/custom/project/create_project_record/src/index.js');
const statusPlugin = require('../../plugins/custom/project/update_project_status/src/index.js');
const tasksPlugin = require('../../plugins/custom/project/create_project_tasks/src/index.js');
const replyPlugin = require('../../plugins/custom/crm/generate_client_reply_draft/src/index.js');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

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

async function createTempWorkspace(prefix = 'photo-studio-') {
  const workspaceRoot = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  const dataDir = path.join(workspaceRoot, 'data', 'photo-studio');

  return {
    workspaceRoot,
    dataDir
  };
}

async function cleanupWorkspace(workspaceRoot) {
  await fsp.rm(workspaceRoot, { recursive: true, force: true });
}

function runPlugin(scriptRelativePath, payload, env = {}) {
  const scriptPath = path.join(REPO_ROOT, scriptRelativePath);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        ...env
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      const trimmedStdout = stdout.trim();
      let parsed = null;

      if (trimmedStdout) {
        try {
          parsed = JSON.parse(trimmedStdout);
        } catch (error) {
          reject(new Error(`Failed to parse plugin stdout: ${error.message}\nstdout=${trimmedStdout}\nstderr=${stderr}`));
          return;
        }
      }

      resolve({
        code,
        json: parsed,
        stderr,
        stdout: trimmedStdout
      });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function readStoreJson(dataDir, fileName) {
  const raw = await fsp.readFile(path.join(dataDir, fileName), 'utf8');
  return JSON.parse(raw);
}

function assertSuccessEnvelope(result) {
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.ok(result.json, 'Expected JSON output');
  assert.equal(result.json.success, true, result.stdout);
  assert.equal(result.json.error, null);
}

function assertFailureEnvelope(result, expectedCode) {
  assert.equal(result.code, 1, result.stdout);
  assert.ok(result.json, 'Expected JSON output');
  assert.equal(result.json.success, false);
  assert.equal(result.json.error.code, expectedCode);
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
  assertFailureEnvelope,
  assertSuccessEnvelope,
  cleanupWorkspace,
  createTempWorkspace,
  createCoreFixture,
  initializeCorePlugins,
  makeTempDataRoot,
  moveProjectToStatus,
  readStoreJson,
  runPlugin,
  store
};
