const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const CALENDAR_EVENT_TYPES = ['milestone', 'follow_up', 'deadline'];
const ALLOWED_SYNC_PROJECT_STATUSES = ['quoted', 'confirmed', 'preparing', 'shot', 'selection_pending', 'retouching', 'delivering', 'completed'];
const DEFAULT_CALENDAR_EVENT_TYPE = 'milestone';
const DEFAULT_CALENDAR_SURFACE = 'local_shadow_calendar';
const DEFAULT_CALENDAR_TIMEZONE = 'Asia/Shanghai';
const EVENT_TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

const PLUGIN_NAME = 'sync_calendar_event';
const PLUGIN_VERSION = '2.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return {
    plugin_name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    timestamp: _timestamp(),
    ...extra
  };
}

function _success(data, extraMeta) {
  return {
    success: true,
    data,
    error: null,
    meta: _meta(extraMeta || {})
  };
}

function _error(code, message, field, details) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      field: field || null,
      details: details || {}
    },
    meta: _meta()
  };
}

function _buildCalendarEventTitle(eventType, projectName, explicitTitle) {
  if (explicitTitle) {
    return explicitTitle;
  }

  const eventTitles = {
    milestone: 'Project milestone',
    follow_up: 'Follow-up check-in',
    deadline: 'Project deadline'
  };

  return `${eventTitles[eventType] || 'Calendar coordination'}: ${projectName}`;
}

function _buildCalendarEventDescription({ customerName, eventDate, eventTime, eventType, note, project, timezone }) {
  const lines = [
    `Project: ${project.project_name}`,
    `Customer: ${customerName}`,
    `Project status: ${project.status}`,
    `Event type: ${eventType}`,
    `Date: ${eventDate}`,
    `Timezone: ${timezone}`
  ];

  if (eventTime) {
    lines.push(`Time: ${eventTime}`);
  }

  if (note) {
    lines.push(`Note: ${note}`);
  }

  return lines.join('\n');
}

function _deriveEventDate(project, eventType) {
  if (eventType === 'follow_up' || eventType === 'deadline') {
    return project.delivery_deadline || project.due_date || project.shoot_date || project.start_date || null;
  }

  return project.shoot_date || project.start_date || project.delivery_deadline || project.due_date || null;
}

function _validateInput(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }

  if (args.event_type && !CALENDAR_EVENT_TYPES.includes(args.event_type)) {
    return _error('INVALID_INPUT', `event_type must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}`, 'event_type');
  }

  if (args.event_time && !EVENT_TIME_PATTERN.test(args.event_time)) {
    return _error('INVALID_INPUT', 'event_time must be in HH:mm or HH:mm:ss format', 'event_time');
  }

  return null;
}

function _summarizeCalendarEvent(record, isNew) {
  return {
    calendar_event_id: record.calendar_event_id,
    project_id: record.project_id,
    customer_id: record.customer_id,
    customer_name: record.customer_name,
    project_name: record.project_name,
    project_type: record.project_type,
    project_status: record.project_status,
    event_type: record.event_type,
    event_key: record.event_key,
    event_title: record.event_title,
    event_date: record.event_date,
    event_time: record.event_time,
    timezone: record.timezone,
    calendar_surface: record.calendar_surface,
    sync_state: record.sync_state,
    created_at: record.created_at,
    is_new: isNew
  };
}

async function processToolCall(args) {
  const validationError = _validateInput(args);
  if (validationError) {
    return validationError;
  }

  const projectId = args.project_id.trim();
  const eventType = args.event_type || DEFAULT_CALENDAR_EVENT_TYPE;
  const eventKey = String(args.event_key || eventType).trim();
  const project = store.getProject(projectId);

  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `project ${projectId} not found`, 'project_id');
  }

  if (!ALLOWED_SYNC_PROJECT_STATUSES.includes(project.status)) {
    return _error(
      'CONFLICT',
      `sync_calendar_event requires project status ${ALLOWED_SYNC_PROJECT_STATUSES.join(' or ')}, received ${project.status}.`,
      'project_id',
      {
        allowed_statuses: ALLOWED_SYNC_PROJECT_STATUSES,
        project_status: project.status
      }
    );
  }

  const calendarSurface = args.calendar_surface || DEFAULT_CALENDAR_SURFACE;
  const existing = store.getCalendarEventsByProject(projectId).find((event) =>
    event.calendar_surface === calendarSurface && event.event_key === eventKey
  ) || null;

  if (existing && existing.event_type !== eventType) {
    return _error(
      'CONFLICT',
      'event_key already exists for a different event_type on this project and calendar surface.',
      'event_type',
      {
        project_id: projectId,
        event_key: eventKey,
        existing_event_type: existing.event_type,
        requested_event_type: eventType
      }
    );
  }

  const resolvedEventDate = args.event_date || (existing && existing.event_date) || _deriveEventDate(project, eventType);
  if (!resolvedEventDate) {
    return _error('MISSING_REQUIRED_FIELD', 'event_date is required when the project has no usable date.', 'event_date', { project_id: projectId });
  }

  const customer = project.customer_id ? store.getCustomer(project.customer_id) : null;
  const degraded = !customer || !customer.customer_name;
  const customerName = degraded ? '[客户姓名]' : customer.customer_name;
  const timezone = args.timezone || (existing && existing.timezone) || DEFAULT_CALENDAR_TIMEZONE;
  const eventTime = args.event_time || (existing && existing.event_time) || null;

  const { record, existing: existingRecord } = store.upsertCalendarEvent({
    project_id: project.project_id,
    customer_id: project.customer_id,
    customer_name: customerName,
    project_name: project.project_name,
    project_type: project.project_type,
    project_status: project.status,
    event_type: eventType,
    event_key: eventKey,
    event_title: _buildCalendarEventTitle(eventType, project.project_name, args.event_title || (existing && existing.event_title) || ''),
    event_description: _buildCalendarEventDescription({
      customerName,
      eventDate: resolvedEventDate,
      eventTime,
      eventType,
      note: args.note || '',
      project,
      timezone
    }),
    event_date: resolvedEventDate,
    event_time: eventTime,
    timezone,
    calendar_surface: calendarSurface,
    note: args.note || ''
  });

  return _success(_summarizeCalendarEvent(record, !existingRecord), {
    entity: 'calendar_event',
    degraded,
    duplicate: Boolean(existingRecord),
    project_status: project.status,
    calendar_surface: calendarSurface,
    sync_mode: 'local_shadow'
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
  ALLOWED_SYNC_PROJECT_STATUSES,
  CALENDAR_EVENT_TYPES,
  initialize,
  processToolCall,
  shutdown
};
