const path = require('path');
const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const REMINDER_TYPE_RULES = Object.freeze({
  quotation_followup: Object.freeze({
    allowedStatuses: ['quoted'],
    fallbackDateField: 'shoot_date',
    offsetDays: 0
  }),
  delivery_followup: Object.freeze({
    allowedStatuses: ['delivering', 'completed'],
    fallbackDateField: 'delivery_deadline',
    offsetDays: 3
  }),
  revisit: Object.freeze({
    allowedStatuses: ['completed', 'archived'],
    fallbackDateField: 'delivery_deadline',
    offsetDays: 30
  })
});

const PLUGIN_NAME = 'create_followup_reminder';
const PLUGIN_VERSION = '2.0.0';

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

function _addDays(dateString, offsetDays) {
  const baseDate = new Date(`${dateString}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
  return baseDate.toISOString().slice(0, 10);
}

function _resolveDefaultDueDate(project, reminderType) {
  const rule = REMINDER_TYPE_RULES[reminderType];
  const fallbackValue = project[rule.fallbackDateField] || project.due_date || project.shoot_date || null;

  if (fallbackValue) {
    return rule.offsetDays > 0 ? _addDays(fallbackValue, rule.offsetDays) : fallbackValue;
  }

  return _addDays(_timestamp().slice(0, 10), rule.offsetDays || 0);
}

async function processToolCall(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }
  if (!args.reminder_type || !REMINDER_TYPE_RULES[args.reminder_type]) {
    return _error('INVALID_INPUT', `reminder_type must be one of: ${Object.keys(REMINDER_TYPE_RULES).join(', ')}`, 'reminder_type');
  }

  const projectId = args.project_id.trim();
  const reminderType = args.reminder_type;
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `项目 ${projectId} 不存在`, 'project_id');
  }

  const rule = REMINDER_TYPE_RULES[reminderType];
  if (!rule.allowedStatuses.includes(project.status)) {
    return _error(
      'CONFLICT',
      `create_followup_reminder requires project status ${rule.allowedStatuses.join(' or ')} for ${reminderType}, received ${project.status}.`,
      'project_id',
      { allowed_statuses: rule.allowedStatuses, project_status: project.status, reminder_type: reminderType }
    );
  }

  const existingReminder = store.findPendingReminder(projectId, reminderType);
  if (existingReminder) {
    return _success({
      ...existingReminder,
      is_new: false
    }, {
      entity: 'followup_reminder',
      duplicate: true,
      project_status: project.status
    });
  }

  const reminderRecord = store.createReminder({
    project_id: project.project_id,
    customer_id: project.customer_id,
    reminder_type: reminderType,
    due_date: args.due_date || _resolveDefaultDueDate(project, reminderType),
    note: args.note || ''
  });

  return _success({
    ...reminderRecord,
    is_new: true
  }, {
    entity: 'followup_reminder',
    duplicate: false,
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
  REMINDER_TYPE_RULES,
  initialize,
  processToolCall,
  shutdown
};
