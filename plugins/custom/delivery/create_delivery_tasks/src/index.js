const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const ALLOWED_DELIVERY_TASK_PROJECT_STATUSES = ['retouching', 'delivering', 'completed'];
const DEFAULT_DELIVERY_MODE = 'digital delivery';
const DELIVERY_TASK_GROUP = 'delivery_stage';

const PLUGIN_NAME = 'create_delivery_tasks';
const PLUGIN_VERSION = '2.0.0';

const DELIVERY_TASK_TEMPLATES = {
  wedding: [
    { task_name: 'Finalize wedding gallery for delivery', task_type: 'review', phase: 'retouching', sort_order: 1 },
    { task_name: 'Prepare wedding delivery package', task_type: 'delivery', phase: 'delivering', sort_order: 2 },
    { task_name: 'Send wedding gallery handoff', task_type: 'communication', phase: 'delivering', sort_order: 3 },
    { task_name: 'Confirm wedding delivery receipt', task_type: 'communication', phase: 'delivering', sort_order: 4 }
  ],
  portrait: [
    { task_name: 'Finalize portrait selects for delivery', task_type: 'review', phase: 'retouching', sort_order: 1 },
    { task_name: 'Prepare portrait delivery package', task_type: 'delivery', phase: 'delivering', sort_order: 2 },
    { task_name: 'Send portrait handoff details', task_type: 'communication', phase: 'delivering', sort_order: 3 },
    { task_name: 'Confirm portrait delivery receipt', task_type: 'communication', phase: 'delivering', sort_order: 4 }
  ],
  commercial: [
    { task_name: 'Finalize approved commercial assets', task_type: 'review', phase: 'retouching', sort_order: 1 },
    { task_name: 'Prepare commercial delivery package', task_type: 'delivery', phase: 'delivering', sort_order: 2 },
    { task_name: 'Share asset handoff instructions', task_type: 'communication', phase: 'delivering', sort_order: 3 },
    { task_name: 'Confirm commercial asset receipt', task_type: 'communication', phase: 'delivering', sort_order: 4 }
  ],
  event: [
    { task_name: 'Finalize event gallery for delivery', task_type: 'review', phase: 'retouching', sort_order: 1 },
    { task_name: 'Prepare event delivery package', task_type: 'delivery', phase: 'delivering', sort_order: 2 },
    { task_name: 'Send event gallery handoff', task_type: 'communication', phase: 'delivering', sort_order: 3 },
    { task_name: 'Confirm event delivery receipt', task_type: 'communication', phase: 'delivering', sort_order: 4 }
  ],
  other: [
    { task_name: 'Finalize selected assets for delivery', task_type: 'review', phase: 'retouching', sort_order: 1 },
    { task_name: 'Prepare final delivery package', task_type: 'delivery', phase: 'delivering', sort_order: 2 },
    { task_name: 'Send delivery handoff details', task_type: 'communication', phase: 'delivering', sort_order: 3 },
    { task_name: 'Confirm final delivery receipt', task_type: 'communication', phase: 'delivering', sort_order: 4 }
  ]
};

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return { plugin_name: PLUGIN_NAME, version: PLUGIN_VERSION, timestamp: _timestamp(), ...extra };
}

function _success(data, extraMeta) {
  return { success: true, data, error: null, meta: _meta(extraMeta || {}) };
}

function _error(code, message, field, details) {
  return { success: false, data: null, error: { code, message, field: field || null, details: details || {} }, meta: _meta() };
}

function _summarizeTask(task) {
  return {
    task_id: task.task_id,
    task_name: task.task_name,
    task_type: task.task_type,
    phase: task.phase,
    status: task.status,
    sort_order: task.sort_order,
    due_date: task.due_date,
    assignee: task.assignee
  };
}

function _isManagedDeliveryTask(task, projectId) {
  return task.project_id === projectId
    && task.task_group === DELIVERY_TASK_GROUP
    && task.generated_by === PLUGIN_NAME;
}

async function processToolCall(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }

  const projectId = args.project_id.trim();
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `项目 ${projectId} 不存在`, 'project_id');
  }

  if (!ALLOWED_DELIVERY_TASK_PROJECT_STATUSES.includes(project.status)) {
    return _error(
      'CONFLICT',
      `create_delivery_tasks requires project status ${ALLOWED_DELIVERY_TASK_PROJECT_STATUSES.join(' or ')}, received ${project.status}.`,
      'project_id',
      { allowed_statuses: ALLOWED_DELIVERY_TASK_PROJECT_STATUSES, project_status: project.status }
    );
  }

  const existingTasks = store.getTasksByProject(projectId);
  const existingDeliveryTasks = existingTasks.filter((task) => _isManagedDeliveryTask(task, projectId));
  const overrideExisting = args.override_existing === true;
  const deliveryMode = args.delivery_mode || DEFAULT_DELIVERY_MODE;
  const deliveryDeadline = args.delivery_deadline || project.delivery_deadline || project.due_date || null;

  if (existingDeliveryTasks.length > 0 && !overrideExisting) {
    return _success({
      project_id: projectId,
      delivery_mode: deliveryMode,
      delivery_deadline: deliveryDeadline,
      created_tasks: [],
      created_count: 0,
      skipped_count: existingDeliveryTasks.length,
      message: 'Existing delivery-stage tasks already cover this project.'
    }, {
      entity: 'delivery_tasks',
      project_status: project.status
    });
  }

  const retainedTasks = overrideExisting
    ? existingTasks.filter((task) => !_isManagedDeliveryTask(task, projectId))
    : existingTasks.slice();
  const drafts = DELIVERY_TASK_TEMPLATES[project.project_type] || DELIVERY_TASK_TEMPLATES.other;
  const createdTasks = drafts.map((draft) => ({
    task_id: store.generateId('task'),
    project_id: project.project_id,
    task_template_id: '',
    task_name: draft.task_name,
    phase: draft.phase,
    priority: 'medium',
    due_date: deliveryDeadline,
    status: 'pending',
    assignee: '',
    blocker_flag: false,
    created_at: _timestamp(),
    updated_at: _timestamp(),
    notes: `Delivery mode: ${deliveryMode}`,
    task_type: draft.task_type,
    sort_order: draft.sort_order,
    remark: `Delivery mode: ${deliveryMode}`,
    task_group: DELIVERY_TASK_GROUP,
    generated_by: PLUGIN_NAME,
    delivery_mode: deliveryMode
  }));

  store.setTasksByProject(projectId, [...retainedTasks, ...createdTasks]);

  return _success({
    project_id: projectId,
    delivery_mode: deliveryMode,
    delivery_deadline: deliveryDeadline,
    created_tasks: createdTasks.map(_summarizeTask),
    created_count: createdTasks.length,
    skipped_count: 0
  }, {
    entity: 'delivery_tasks',
    project_status: project.status
  });
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
}

function shutdown() {}

module.exports = {
  ALLOWED_DELIVERY_TASK_PROJECT_STATUSES,
  initialize,
  processToolCall,
  shutdown
};
