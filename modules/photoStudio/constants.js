const path = require('path');

const DEFAULT_RELATIVE_DATA_DIR = path.join('data', 'photo-studio');

const COLLECTION_FILES = Object.freeze({
    customers: 'customers.json',
    projects: 'projects.json',
    tasks: 'tasks.json',
    statusLog: 'status_log.json'
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
const DEFAULT_TASK_STATUS = 'pending';

module.exports = {
    ALLOWED_PROJECT_STATUS_TRANSITIONS,
    COLLECTION_FILES,
    CUSTOMER_SOURCES,
    CUSTOMER_TYPES,
    DEFAULT_PROJECT_STATUS,
    DEFAULT_TASK_STATUS,
    DEFAULT_RELATIVE_DATA_DIR,
    ERROR_CODES,
    PROJECT_STATUSES,
    PROJECT_TYPES,
    RECORD_VERSION,
    REPLY_CONTEXT_TYPES,
    REPLY_TONES,
    TASK_STATUSES,
    TASK_TEMPLATE_NAMES,
    TASK_TYPES
};
