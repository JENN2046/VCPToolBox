/**
 * PhotoStudioProjectTasks — 摄影工作室项目任务拆解插件
 *
 * hybridservice + direct 协议
 * 支持预设模板和自定义任务列表，关联 project_id
 */

const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const VALID_TASK_TYPES = ['shooting', 'editing', 'delivery', 'review', 'communication', 'preparing', 'selection', 'other'];

const TASK_TEMPLATES = {
  wedding_standard: [
    { task_name: '前期沟通', phase: 'lead', task_type: 'communication', sort_order: 1 },
    { task_name: '拍摄筹备', phase: 'preparing', task_type: 'preparing', sort_order: 2 },
    { task_name: '婚礼拍摄', phase: 'shot', task_type: 'shooting', sort_order: 3 },
    { task_name: '选片确认', phase: 'selection_pending', task_type: 'selection', sort_order: 4 },
    { task_name: '后期精修', phase: 'retouching', task_type: 'editing', sort_order: 5 },
    { task_name: '交付成品', phase: 'delivering', task_type: 'delivery', sort_order: 6 }
  ],
  portrait_basic: [
    { task_name: '前期沟通', phase: 'lead', task_type: 'communication', sort_order: 1 },
    { task_name: '拍摄执行', phase: 'shot', task_type: 'shooting', sort_order: 2 },
    { task_name: '选片确认', phase: 'selection_pending', task_type: 'selection', sort_order: 3 },
    { task_name: '后期修图', phase: 'retouching', task_type: 'editing', sort_order: 4 },
    { task_name: '交付成品', phase: 'delivering', task_type: 'delivery', sort_order: 5 }
  ],
  commercial_standard: [
    { task_name: '需求对接', phase: 'lead', task_type: 'communication', sort_order: 1 },
    { task_name: '拍摄策划', phase: 'preparing', task_type: 'preparing', sort_order: 2 },
    { task_name: '拍摄执行', phase: 'shot', task_type: 'shooting', sort_order: 3 },
    { task_name: '客户审片', phase: 'selection_pending', task_type: 'selection', sort_order: 4 },
    { task_name: '后期处理', phase: 'retouching', task_type: 'editing', sort_order: 5 },
    { task_name: '交付成品', phase: 'delivering', task_type: 'delivery', sort_order: 6 }
  ],
  event_basic: [
    { task_name: '活动沟通', phase: 'lead', task_type: 'communication', sort_order: 1 },
    { task_name: '现场拍摄', phase: 'shot', task_type: 'shooting', sort_order: 2 },
    { task_name: '后期处理', phase: 'retouching', task_type: 'editing', sort_order: 3 },
    { task_name: '交付成品', phase: 'delivering', task_type: 'delivery', sort_order: 4 }
  ]
};

// project_type -> 默认模板映射
const TYPE_TEMPLATE_MAP = {
  wedding: 'wedding_standard',
  portrait: 'portrait_basic',
  commercial: 'commercial_standard',
  event: 'event_basic',
  other: 'portrait_basic'
};

const PLUGIN_NAME = 'create_project_tasks';
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
  if (args.task_template && !TASK_TEMPLATES[args.task_template]) {
    return _error('INVALID_INPUT', `task_template must be one of: ${Object.keys(TASK_TEMPLATES).join(', ')}`, 'task_template');
  }
  if (args.tasks && !Array.isArray(args.tasks)) {
    return _error('INVALID_INPUT', 'tasks must be an array', 'tasks');
  }
  // 校验自定义任务列表中的字段
  if (args.tasks) {
    for (let i = 0; i < args.tasks.length; i++) {
      const t = args.tasks[i];
      if (!t.task_name) {
        return _error('MISSING_REQUIRED_FIELD', `tasks[${i}].task_name is required`, `tasks[${i}].task_name`);
      }
      if (!t.task_type || !VALID_TASK_TYPES.includes(t.task_type)) {
        return _error('INVALID_INPUT', `tasks[${i}].task_type must be one of: ${VALID_TASK_TYPES.join(', ')}`, `tasks[${i}].task_type`);
      }
    }
  }
  return null;
}

async function processToolCall(args, executionContext) {
  if (config.DebugMode) {
    console.log(`[${PLUGIN_NAME}] processToolCall called with:`, JSON.stringify(args).substring(0, 300));
  }

  const validationError = _validateInput(args);
  if (validationError) return validationError;

  const projectId = args.project_id.trim();

  // 校验项目存在
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `项目 ${projectId} 不存在`, 'project_id');
  }

  // 确定任务来源
  let taskList;
  if (args.task_template) {
    taskList = TASK_TEMPLATES[args.task_template];
  } else if (args.tasks && args.tasks.length > 0) {
      taskList = args.tasks.map((t, i) => ({
        task_name: t.task_name,
        task_template_id: t.task_template_id || args.task_template || '',
        phase: t.phase || t.task_type || 'other',
        task_type: t.task_type,
        priority: t.priority || 'medium',
        sort_order: t.sort_order || (i + 1),
        due_date: t.due_date || '',
        assignee: t.assignee || '',
        blocker_flag: t.blocker_flag === true,
        notes: t.notes || t.remark || '',
        remark: t.remark || t.notes || ''
      }));
  } else {
    // 按 project_type 使用默认模板
    const templateName = TYPE_TEMPLATE_MAP[project.project_type] || 'portrait_basic';
    taskList = TASK_TEMPLATES[templateName];
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Using default template: ${templateName}`);
  }

  // 检查已有任务
  const existingTasks = store.getTasksByProject(projectId);
  const pendingTasks = existingTasks.filter(t => t.status === 'pending');
  const overrideExisting = args.override_existing === true;

  if (pendingTasks.length > 0 && !overrideExisting) {
    // 不覆盖，跳过创建，返回已有信息
    return _success({
      project_id: projectId,
      created_tasks: [],
      created_count: 0,
      skipped_count: pendingTasks.length,
      message: `项目已有 ${pendingTasks.length} 个未完成任务，设置 override_existing=true 可覆盖`
    });
  }

  // 创建任务
  try {
    const created = store.createTasks(projectId, taskList);
    if (config.DebugMode) console.log(`[${PLUGIN_NAME}] Created ${created.length} tasks for project ${projectId}`);

    return _success({
      project_id: projectId,
      created_tasks: created.map(t => ({
        task_id: t.task_id,
        task_name: t.task_name,
        phase: t.phase,
        task_type: t.task_type,
        priority: t.priority,
        sort_order: t.sort_order,
        status: t.status
      })),
      created_count: created.length,
      skipped_count: 0
    });
  } catch (e) {
    console.error(`[${PLUGIN_NAME}] Error creating tasks:`, e.message);
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
