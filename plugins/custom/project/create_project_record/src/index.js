/**
 * PhotoStudioProjectRecord — 摄影工作室项目建档插件
 *
 * hybridservice + direct 协议
 * 关联 customer_id，查重项目名，写入 projects.json
 */

const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_PROJECT_TYPES = ['wedding', 'portrait', 'commercial', 'event', 'other'];

const PLUGIN_NAME = 'create_project_record';
const PLUGIN_VERSION = '1.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta() {
  return { plugin_name: PLUGIN_NAME, version: PLUGIN_VERSION, timestamp: _timestamp() };
}

function _success(data) {
  return { success: true, data, error: null, meta: _meta() };
}

function _error(code, message, field) {
  return { success: false, data: null, error: { code, message, field: field || null }, meta: _meta() };
}

function _validateInput(args) {
  if (!args.customer_id || typeof args.customer_id !== 'string' || args.customer_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'customer_id is required', 'customer_id');
  }
  if (!args.project_name || typeof args.project_name !== 'string' || args.project_name.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_name is required', 'project_name');
  }
  if (!args.project_type || !VALID_PROJECT_TYPES.includes(args.project_type)) {
    return _error('INVALID_INPUT', `project_type must be one of: ${VALID_PROJECT_TYPES.join(', ')}`, 'project_type');
  }
  return null;
}

async function processToolCall(args, executionContext) {
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] processToolCall called with:`, JSON.stringify(args).substring(0, 200));
  }

  const validationError = _validateInput(args);
  if (validationError) return validationError;

  // 校验客户存在
  const customer = store.getCustomer(args.customer_id.trim());
  if (!customer) {
    return _error('RESOURCE_NOT_FOUND', `客户 ${args.customer_id} 不存在`, 'customer_id');
  }

  // 查重: 同一 customer_id 下 project_name 完全匹配
  const existing = store.findProjectByCustomerAndName(args.customer_id.trim(), args.project_name.trim());
  if (existing) {
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Duplicate project found: ${existing.project_id}`);
    return {
      success: false,
      data: {
        project_id: existing.project_id,
        customer_id: existing.customer_id,
        project_name: existing.project_name,
        status: existing.status,
        is_new: false
      },
      error: { code: 'CONFLICT', message: '该项目已存在', field: 'project_name' },
      meta: _meta()
    };
  }

  // 建档
  const projectData = {
    customer_id: args.customer_id.trim(),
    project_name: args.project_name.trim(),
    project_type: args.project_type,
    shoot_date: args.shoot_date || args.start_date || '',
    location: args.location || '',
    style_keywords: args.style_keywords || [],
    delivery_deadline: args.delivery_deadline || args.due_date || '',
    is_public_allowed: args.is_public_allowed === true,
    current_blocker: args.current_blocker || '',
    start_date: args.start_date || args.shoot_date || '',
    due_date: args.due_date || args.delivery_deadline || '',
    budget: args.budget || 0,
    notes: args.notes || args.remark || '',
    remark: args.remark || args.notes || ''
  };

  try {
    const record = store.createProject(projectData);
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Project created: ${record.project_id}`);
    return _success({
      project_id: record.project_id,
      customer_id: record.customer_id,
      project_name: record.project_name,
      project_type: record.project_type,
      shoot_date: record.shoot_date,
      delivery_deadline: record.delivery_deadline,
      status: record.status,
      is_new: true,
      created_at: record.created_at
    });
  } catch (e) {
    console.error(`[${PLUGIN_NAME}] Error creating project:`, e.message);
    return _error('UNKNOWN_ERROR', e.message);
  }
}

async function initialize(initialConfig, dependencies) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] Initialized. DebugMode: ${config.DebugMode}`);
  }
}

function shutdown() {
  if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Shutdown.`);
}

module.exports = {
  initialize,
  processToolCall,
  shutdown
};
