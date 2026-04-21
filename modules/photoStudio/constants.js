const path = require('path');

const DEFAULT_RELATIVE_DATA_DIR = path.join('data', 'photo-studio');

const COLLECTION_FILES = Object.freeze({
    archiveAssets: 'archive_assets.json',
    calendarEvents: 'calendar_events.json',
    customers: 'customers.json',
    contentPool: 'content_pool.json',
    externalExports: 'external_exports.json',
    projects: 'projects.json',
    tasks: 'tasks.json',
    statusLog: 'status_log.json',
    reminders: 'reminders.json'
});

const CUSTOMER_TYPES = Object.freeze([
    'individual',
    'corporate'
]);

const CUSTOMER_SOURCES = Object.freeze([
    'referral',
    'social_media',
    'returning',
    'walk_in',
    'other'
]);

const PROJECT_TYPES = Object.freeze([
    'wedding',
    'portrait',
    'commercial',
    'event',
    'other'
]);

const PROJECT_STATUSES = Object.freeze([
    'inquiry',
    'quoted',
    'confirmed',
    'preparing',
    'shooting',
    'editing',
    'reviewing',
    'delivered',
    'completed',
    'archived',
    'cancelled'
]);

const ALLOWED_PROJECT_STATUS_TRANSITIONS = Object.freeze({
    inquiry: ['quoted', 'cancelled'],
    quoted: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['shooting', 'cancelled'],
    shooting: ['editing', 'cancelled'],
    editing: ['reviewing', 'delivered'],
    reviewing: ['editing', 'delivered'],
    delivered: ['completed'],
    completed: ['archived'],
    archived: [],
    cancelled: []
});

const TASK_TEMPLATE_NAMES = Object.freeze([
    'wedding_standard',
    'portrait_basic',
    'commercial_standard',
    'event_basic'
]);

const TASK_TYPES = Object.freeze([
    'shooting',
    'editing',
    'delivery',
    'review',
    'communication',
    'other'
]);

const TASK_STATUSES = Object.freeze([
    'pending',
    'in_progress',
    'completed',
    'skipped'
]);

const REPLY_CONTEXT_TYPES = Object.freeze([
    'quotation',
    'schedule',
    'delivery',
    'general'
]);

const REPLY_TONES = Object.freeze([
    'formal',
    'friendly',
    'warm'
]);

const REMINDER_TYPES = Object.freeze([
    'quotation_followup',
    'delivery_followup',
    'revisit'
]);

const REMINDER_STATUSES = Object.freeze([
    'pending',
    'completed',
    'cancelled'
]);

const ARCHIVE_MODES = Object.freeze([
    'shadow',
    'copy',
    'move'
]);

const CALENDAR_EVENT_TYPES = Object.freeze([
    'milestone',
    'follow_up',
    'deadline'
]);

const ERROR_CODES = Object.freeze([
    'MISSING_REQUIRED_FIELD',
    'INVALID_INPUT',
    'RESOURCE_NOT_FOUND',
    'CONFLICT',
    'INVALID_TRANSITION',
    'TIMEOUT',
    'UNKNOWN_ERROR'
]);

const RECORD_VERSION = 1;
const DEFAULT_PROJECT_STATUS = 'inquiry';
const DEFAULT_ARCHIVE_KEY = 'project_assets';
const DEFAULT_ARCHIVE_MODE = 'shadow';
const DEFAULT_ARCHIVE_SURFACE = 'local_shadow_archive';
const DEFAULT_CALENDAR_EVENT_TYPE = 'milestone';
const DEFAULT_CALENDAR_SURFACE = 'local_shadow_calendar';
const DEFAULT_CALENDAR_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_CONTENT_POOL_USAGE_STATUS = 'candidate';
const DEFAULT_EXTERNAL_SYNC_SURFACE = 'local_shadow_external_export';
const DEFAULT_EXTERNAL_SYNC_TARGET_NAME = 'photo_studio_project_inventory';
const DEFAULT_EXTERNAL_SYNC_TARGET_TYPE = 'sheet';
const DEFAULT_EXTERNAL_DELIVERY_STATE = 'ready_to_publish';
const DEFAULT_EXTERNAL_DELIVERY_CHANNEL = 'local_shadow_outbox';
const DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS = 2;
const EXTERNAL_DELIVERY_STATES = Object.freeze([
    'ready_to_publish',
    'queued',
    'delivered',
    'retry_scheduled',
    'failed'
]);
const DEFAULT_TASK_STATUS = 'pending';
const DEFAULT_REMINDER_STATUS = 'pending';

module.exports = {
    ALLOWED_PROJECT_STATUS_TRANSITIONS,
    ARCHIVE_MODES,
    CALENDAR_EVENT_TYPES,
    COLLECTION_FILES,
    CUSTOMER_SOURCES,
    CUSTOMER_TYPES,
    DEFAULT_ARCHIVE_KEY,
    DEFAULT_ARCHIVE_MODE,
    DEFAULT_ARCHIVE_SURFACE,
    DEFAULT_CALENDAR_EVENT_TYPE,
    DEFAULT_CALENDAR_SURFACE,
    DEFAULT_CALENDAR_TIMEZONE,
    DEFAULT_CONTENT_POOL_USAGE_STATUS,
    DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS,
    DEFAULT_EXTERNAL_DELIVERY_STATE,
    DEFAULT_EXTERNAL_SYNC_SURFACE,
    DEFAULT_EXTERNAL_SYNC_TARGET_NAME,
    DEFAULT_EXTERNAL_SYNC_TARGET_TYPE,
    DEFAULT_PROJECT_STATUS,
    DEFAULT_REMINDER_STATUS,
    DEFAULT_TASK_STATUS,
    DEFAULT_RELATIVE_DATA_DIR,
    ERROR_CODES,
    EXTERNAL_DELIVERY_STATES,
    PROJECT_STATUSES,
    PROJECT_TYPES,
    RECORD_VERSION,
    REMINDER_STATUSES,
    REMINDER_TYPES,
    REPLY_CONTEXT_TYPES,
    REPLY_TONES,
    TASK_STATUSES,
    TASK_TEMPLATE_NAMES,
    TASK_TYPES
};
