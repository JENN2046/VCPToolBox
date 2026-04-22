const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const EXTERNAL_SYNC_TARGET_TYPES = Object.freeze(['sheet', 'notion']);
const EXTERNAL_DELIVERY_STATES = Object.freeze(['ready_to_publish', 'queued', 'delivered', 'retry_scheduled', 'failed']);
const CLOSED_STATUSES = new Set(['completed', 'archived', 'cancelled']);
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_EXTERNAL_SYNC_SURFACE = 'local_shadow_external_export';
const DEFAULT_EXTERNAL_SYNC_TARGET_NAME = 'photo_studio_project_inventory';
const DEFAULT_EXTERNAL_SYNC_TARGET_TYPE = 'sheet';
const DEFAULT_EXTERNAL_DELIVERY_STATE = 'ready_to_publish';
const DEFAULT_EXTERNAL_DELIVERY_CHANNEL = 'local_shadow_outbox';
const DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS = 2;

const PLUGIN_NAME = 'sync_to_external_sheet_or_notion';
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

function _toUtcDayStart(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function _isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(_toUtcDayStart(value).getTime());
}

function _resolveReferenceDate(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return new Date().toISOString().slice(0, 10);
  }

  return _isIsoDate(candidate) ? candidate : null;
}

function _parsePositiveInteger(value, fieldName, defaultValue) {
  if (value === null || value === undefined || value === '') {
    return { value: defaultValue, error: null };
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      value: null,
      error: _error('INVALID_INPUT', `${fieldName} must be a positive integer.`, fieldName)
    };
  }

  return { value: parsed, error: null };
}

function _parseOptionalBoolean(value, fieldName, defaultValue) {
  if (value === null || value === undefined || value === '') {
    return { value: defaultValue, error: null };
  }

  if (typeof value !== 'boolean') {
    return {
      value: null,
      error: _error('INVALID_INPUT', `${fieldName} must be a boolean.`, fieldName)
    };
  }

  return { value, error: null };
}

function _toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function _addDays(dateString, days) {
  const date = _toUtcDayStart(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return _toIsoDate(date);
}

function _diffInDays(targetDateString, referenceDateString) {
  const target = _toUtcDayStart(targetDateString);
  const reference = _toUtcDayStart(referenceDateString);
  return Math.round((target.getTime() - reference.getTime()) / DAY_MS);
}

function _normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'default';
}

function _projectStartDate(project) {
  return project.shoot_date || project.start_date || null;
}

function _projectDueDate(project) {
  return project.delivery_deadline || project.due_date || null;
}

function _buildExportRows(projects, customerMap, referenceDate, upcomingDays, targetType, targetName) {
  return projects
    .map((project) => {
      const customer = customerMap.get(project.customer_id) || null;
      const customerName = customer && customer.customer_name ? customer.customer_name : '[Customer Name]';
      const dueDate = _projectDueDate(project);
      const isClosed = CLOSED_STATUSES.has(project.status);
      const daysUntilDue = dueDate ? _diffInDays(dueDate, referenceDate) : null;
      let attentionState = 'on_track';

      if (!dueDate && !isClosed) {
        attentionState = 'missing_due_date';
      } else if (!isClosed && daysUntilDue !== null && daysUntilDue < 0) {
        attentionState = 'overdue';
      } else if (!isClosed && daysUntilDue !== null && daysUntilDue <= upcomingDays) {
        attentionState = 'due_soon';
      } else if (isClosed) {
        attentionState = 'closed';
      }

      return {
        project_id: project.project_id,
        customer_id: project.customer_id,
        customer_name: customerName,
        project_name: project.project_name,
        project_type: project.project_type,
        status: project.status,
        shoot_date: _projectStartDate(project),
        delivery_deadline: dueDate,
        budget: project.budget ?? null,
        days_until_due: daysUntilDue,
        attention_state: attentionState,
        target_type: targetType,
        target_name: targetName,
        export_surface: DEFAULT_EXTERNAL_SYNC_SURFACE,
        sync_state: 'local_shadow'
      };
    })
    .sort((left, right) => {
      const leftSortDate = left.delivery_deadline || '9999-12-31';
      const rightSortDate = right.delivery_deadline || '9999-12-31';

      if (leftSortDate !== rightSortDate) {
        return leftSortDate.localeCompare(rightSortDate);
      }

      return String(left.project_name || '').localeCompare(String(right.project_name || ''));
    });
}

function _summarizeExportRows(exportRows) {
  const activeProjects = exportRows.filter((project) => !CLOSED_STATUSES.has(project.status));

  return {
    total_projects: exportRows.length,
    active_projects: activeProjects.length,
    closed_projects: exportRows.length - activeProjects.length,
    overdue_projects: exportRows.filter((project) => project.attention_state === 'overdue').length,
    due_soon_projects: exportRows.filter((project) => project.attention_state === 'due_soon').length,
    missing_due_date_count: exportRows.filter((project) => project.attention_state === 'missing_due_date').length,
    missing_customer_count: exportRows.filter((project) => project.customer_name === '[Customer Name]').length
  };
}

function _buildExportText({
  targetType,
  targetName,
  exportScope,
  projectId,
  referenceDate,
  upcomingDays,
  summary,
  exportRows,
  deliveryState,
  deliveryAttempts,
  deliveryReceiptId,
  retryAfterDate,
  deliveryError,
  note
}) {
  const lines = [
    'Photo Studio external sync export',
    `Target: ${targetType} -> ${targetName}`,
    `Scope: ${exportScope}${projectId ? ` (${projectId})` : ''}`,
    `Reference date: ${referenceDate}`,
    `Upcoming days: ${upcomingDays}`,
    `Projects: ${summary.total_projects}`,
    `Active projects: ${summary.active_projects}`,
    `Closed projects: ${summary.closed_projects}`,
    `Overdue projects: ${summary.overdue_projects}`,
    `Due soon projects: ${summary.due_soon_projects}`,
    `Missing due dates: ${summary.missing_due_date_count}`,
    `Missing customers: ${summary.missing_customer_count}`,
    `Delivery state: ${deliveryState} | attempts ${deliveryAttempts}`
  ];

  if (deliveryReceiptId) {
    lines.push(`Delivery receipt: ${deliveryReceiptId}`);
  }

  if (retryAfterDate) {
    lines.push(`Retry after: ${retryAfterDate}`);
  }

  if (deliveryError) {
    lines.push(`Delivery error: ${deliveryError}`);
  }

  if (note) {
    lines.push(`Note: ${note}`);
  }

  if (exportRows.length > 0) {
    lines.push('', 'Export rows:');
    exportRows.forEach((row) => {
      lines.push(`- ${row.project_name} | ${row.status} | ${row.customer_name}`);
    });
  }

  return lines.join('\n');
}

async function processToolCall(args) {
  const targetType = String(args.target_type || DEFAULT_EXTERNAL_SYNC_TARGET_TYPE).trim();
  if (!EXTERNAL_SYNC_TARGET_TYPES.includes(targetType)) {
    return _error('INVALID_INPUT', `target_type must be one of: ${EXTERNAL_SYNC_TARGET_TYPES.join(', ')}`, 'target_type');
  }

  const referenceDate = _resolveReferenceDate(args.reference_date);
  if (!referenceDate) {
    return _error('INVALID_INPUT', 'reference_date must be in YYYY-MM-DD format.', 'reference_date');
  }

  const upcomingDaysResult = _parsePositiveInteger(args.upcoming_days, 'upcoming_days', 14);
  if (upcomingDaysResult.error) {
    return upcomingDaysResult.error;
  }

  const includeClosedProjectsResult = _parseOptionalBoolean(args.include_closed_projects, 'include_closed_projects', true);
  if (includeClosedProjectsResult.error) {
    return includeClosedProjectsResult.error;
  }

  const deliveryAttemptsResult = _parsePositiveInteger(args.delivery_attempts, 'delivery_attempts', 1);
  if (deliveryAttemptsResult.error) {
    return deliveryAttemptsResult.error;
  }

  const retryAfterDaysResult = _parsePositiveInteger(args.retry_after_days, 'retry_after_days', DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS);
  if (retryAfterDaysResult.error) {
    return retryAfterDaysResult.error;
  }

  const deliveryAcknowledgedResult = _parseOptionalBoolean(
    args.delivery_acknowledged,
    'delivery_acknowledged',
    String(args.delivery_state || DEFAULT_EXTERNAL_DELIVERY_STATE).trim() === 'delivered'
  );
  if (deliveryAcknowledgedResult.error) {
    return deliveryAcknowledgedResult.error;
  }

  const targetName = String(args.target_name || DEFAULT_EXTERNAL_SYNC_TARGET_NAME).trim() || DEFAULT_EXTERNAL_SYNC_TARGET_NAME;
  const requestedProjectId = args.project_id ? String(args.project_id).trim() : null;
  const deliveryState = String(args.delivery_state || DEFAULT_EXTERNAL_DELIVERY_STATE).trim();

  if (!EXTERNAL_DELIVERY_STATES.includes(deliveryState)) {
    return _error('INVALID_INPUT', `delivery_state must be one of: ${EXTERNAL_DELIVERY_STATES.join(', ')}`, 'delivery_state');
  }

  if ((deliveryState === 'failed' || deliveryState === 'retry_scheduled') && !String(args.delivery_error || '').trim()) {
    return _error('MISSING_REQUIRED_FIELD', 'delivery_error is required for failed or retry_scheduled delivery states.', 'delivery_error');
  }

  const allProjects = store.listProjects();
  const selectedProjects = requestedProjectId
    ? allProjects.filter((project) => project.project_id === requestedProjectId)
    : allProjects;

  if (requestedProjectId && selectedProjects.length === 0) {
    return _error('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', 'project_id', {
      project_id: requestedProjectId
    });
  }

  const exportSourceProjects = includeClosedProjectsResult.value
    ? selectedProjects
    : selectedProjects.filter((project) => !CLOSED_STATUSES.has(project.status));
  const customerMap = new Map(store.listCustomers().map((record) => [record.customer_id, record]));
  const exportRows = _buildExportRows(
    exportSourceProjects,
    customerMap,
    referenceDate,
    upcomingDaysResult.value,
    targetType,
    targetName
  );
  const exportSummary = _summarizeExportRows(exportRows);
  const exportScope = requestedProjectId ? 'single_project' : 'all_projects';
  const exportKey = [
    'sync_to_external_sheet_or_notion',
    targetType,
    _normalizeLookup(targetName),
    exportScope,
    requestedProjectId || 'all',
    includeClosedProjectsResult.value ? 'include_closed' : 'active_only'
  ].join(':');
  const existing = store.getExternalExports().find((record) => record.export_key === exportKey) || null;
  const hasExplicitDeliveryAttempts = args.delivery_attempts !== undefined && args.delivery_attempts !== null && args.delivery_attempts !== '';
  const resolvedDeliveryAttempts = existing && !hasExplicitDeliveryAttempts
    ? existing.delivery_attempts
    : deliveryAttemptsResult.value;
  const retryAfterDate = deliveryState === 'retry_scheduled'
    ? _addDays(referenceDate, retryAfterDaysResult.value)
    : null;
  const exportText = _buildExportText({
    targetType,
    targetName,
    exportScope,
    projectId: requestedProjectId,
    referenceDate,
    upcomingDays: upcomingDaysResult.value,
    summary: exportSummary,
    exportRows,
    deliveryState,
    deliveryAttempts: resolvedDeliveryAttempts,
    deliveryReceiptId: String(args.delivery_receipt_id || '').trim() || null,
    retryAfterDate,
    deliveryError: String(args.delivery_error || '').trim() || null,
    note: String(args.note || '').trim() || null
  });

  const { record, existing: existingRecord } = store.upsertExternalExport({
    export_key: exportKey,
    target_type: targetType,
    target_name: targetName,
    export_scope: exportScope,
    project_id: requestedProjectId,
    reference_date: referenceDate,
    upcoming_days: upcomingDaysResult.value,
    include_closed_projects: includeClosedProjectsResult.value,
    delivery_state: deliveryState,
    delivery_attempts: resolvedDeliveryAttempts,
    delivery_acknowledged: deliveryAcknowledgedResult.value,
    delivery_receipt_id: String(args.delivery_receipt_id || '').trim() || null,
    delivery_error: String(args.delivery_error || '').trim() || null,
    retry_after_days: retryAfterDaysResult.value,
    retry_after_date: retryAfterDate,
    delivery_channel: DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    export_row_count: exportRows.length,
    export_summary: exportSummary,
    export_rows: exportRows,
    export_text: exportText,
    export_surface: DEFAULT_EXTERNAL_SYNC_SURFACE,
    note: String(args.note || '').trim() || null,
    normalized_target_name: _normalizeLookup(targetName)
  });

  return _success({
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    target_type: record.target_type,
    target_name: record.target_name,
    export_scope: record.export_scope,
    project_id: record.project_id,
    reference_date: record.reference_date,
    upcoming_days: record.upcoming_days,
    include_closed_projects: record.include_closed_projects,
    delivery_state: record.delivery_state,
    delivery_attempts: record.delivery_attempts,
    delivery_acknowledged: record.delivery_acknowledged,
    delivery_receipt_id: record.delivery_receipt_id,
    delivery_error: record.delivery_error,
    retry_after_days: record.retry_after_days,
    retry_after_date: record.retry_after_date,
    delivery_channel: record.delivery_channel,
    export_row_count: record.export_row_count,
    export_summary: record.export_summary,
    export_rows: record.export_rows,
    export_text: record.export_text,
    export_surface: record.export_surface,
    sync_state: record.sync_state,
    note: record.note,
    created_at: record.created_at,
    updated_at: record.updated_at,
    is_new: !existingRecord
  }, {
    entity: 'external_project_export',
    duplicate: Boolean(existingRecord),
    sync_mode: 'local_shadow',
    delivery_state: record.delivery_state,
    delivery_attempts: record.delivery_attempts,
    degraded: exportSummary.missing_customer_count > 0
      || exportSummary.missing_due_date_count > 0
      || deliveryState === 'failed'
      || deliveryState === 'retry_scheduled'
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
  EXTERNAL_DELIVERY_STATES,
  EXTERNAL_SYNC_TARGET_TYPES,
  initialize,
  processToolCall,
  shutdown
};
