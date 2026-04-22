/**
 * PhotoStudioProjectStatus — 摄影工作室项目状态流转插件
 *
 * hybridservice + direct 协议
 * 校验状态转换合法性，写入 projects.json 和 status_log.json
 */

const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_STATUSES = [
  'lead', 'quoted', 'confirmed', 'preparing', 'shot',
  'selection_pending', 'retouching', 'delivering', 'completed', 'archived', 'cancelled'
];

const ALLOWED_TRANSITIONS = {
  lead:              ['quoted', 'cancelled'],
  quoted:            ['confirmed', 'cancelled'],
  confirmed:         ['preparing', 'cancelled'],
  preparing:         ['shot', 'cancelled'],
  shot:              ['selection_pending', 'cancelled'],
  selection_pending: ['retouching', 'cancelled'],
  retouching:        ['delivering', 'cancelled'],
  delivering:        ['completed'],
  completed:  ['archived'],
  archived:   [],
  cancelled:  []
};

const PLUGIN_NAME = 'update_project_status';
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
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }
  if (!args.new_status || !VALID_STATUSES.includes(args.new_status)) {
    return _error('INVALID_INPUT', `new_status must be one of: ${VALID_STATUSES.join(', ')}`, 'new_status');
  }
  return null;
}

async function processToolCall(args, executionContext) {
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] processToolCall called with:`, JSON.stringify(args).substring(0, 200));
  }

  const validationError = _validateInput(args);
  if (validationError) return validationError;

  const projectId = args.project_id.trim();

  // 校验项目存在
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `项目 ${projectId} 不存在`, 'project_id');
  }

  const currentStatus = project.status;
  const newStatus = args.new_status;

  // 同状态幂等返回
  if (currentStatus === newStatus) {
    return _success({
      project_id: projectId,
      old_status: currentStatus,
      new_status: newStatus,
      transition_time: _timestamp(),
      reason: args.reason || args.remark || '状态未变更（幂等）'
    });
  }

  // 校验转换合法性
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    if (config.DebugMode) {
      console.log(`[${PLUGIN_NAME}] Invalid transition: ${currentStatus} -> ${newStatus}. Allowed: ${allowed.join(', ')}`);
    }
    return _error('INVALID_TRANSITION', `不允许从 ${currentStatus} 转换到 ${newStatus}，合法目标: ${allowed.join(', ')}`, 'new_status');
  }

  // 执行状态变更
  try {
    const transitionTime = _timestamp();
    store.updateProject(projectId, { status: newStatus });

    // 写入状态日志
    store.appendStatusLog({
      project_id: projectId,
      old_status: currentStatus,
      new_status: newStatus,
      reason: args.reason || args.remark || '',
      changed_at: transitionTime,
      changed_by: args.changed_by || 'system'
    });

    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Status updated: ${projectId} ${currentStatus} -> ${newStatus}`);

    return _success({
      project_id: projectId,
      old_status: currentStatus,
      new_status: newStatus,
      transition_time: transitionTime,
      reason: args.reason || args.remark || ''
    });
  } catch (e) {
    console.error(`[${PLUGIN_NAME}] Error updating status:`, e.message);
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
