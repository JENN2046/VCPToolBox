const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));
const externalPublishAdapter = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'ExternalPublishAdapter'));

const EXTERNAL_DELIVERY_QUEUE_ACTIONS = Object.freeze([
  'list_due',
  'mark_queued',
  'mark_delivered',
  'mark_failed',
  'reschedule_retry',
  'publish_record'
]);

const QUEUEABLE_STATES = new Set([
  'ready_to_publish',
  'queued',
  'retry_scheduled',
  'failed'
]);

const LIST_PRIORITY = Object.freeze({
  failed: 0,
  retry_scheduled: 1,
  ready_to_publish: 2,
  queued: 3
});

const DEFAULT_EXTERNAL_DELIVERY_CHANNEL = 'local_shadow_outbox';
const DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS = 2;

const PLUGIN_NAME = 'process_external_delivery_queue';
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

function _toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function _addDays(dateString, days) {
  const date = _toUtcDayStart(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return _toIsoDate(date);
}

function _normalizeRecord(record) {
  return {
    ...record,
    delivery_channel: record.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    delivery_attempts: Number.isInteger(record.delivery_attempts) && record.delivery_attempts > 0 ? record.delivery_attempts : 1
  };
}

function _buildExportText(record) {
  const lines = [
    'Photo Studio external sync export',
    `Target: ${record.target_type} -> ${record.target_name}`,
    `Scope: ${record.export_scope}${record.project_id ? ` (${record.project_id})` : ''}`,
    `Reference date: ${record.reference_date}`,
    `Upcoming days: ${record.upcoming_days}`,
    `Projects: ${record.export_summary?.total_projects ?? record.export_row_count ?? 0}`,
    `Active projects: ${record.export_summary?.active_projects ?? 0}`,
    `Closed projects: ${record.export_summary?.closed_projects ?? 0}`,
    `Overdue projects: ${record.export_summary?.overdue_projects ?? 0}`,
    `Due soon projects: ${record.export_summary?.due_soon_projects ?? 0}`,
    `Missing due dates: ${record.export_summary?.missing_due_date_count ?? 0}`,
    `Missing customers: ${record.export_summary?.missing_customer_count ?? 0}`,
    `Delivery state: ${record.delivery_state} | attempts ${record.delivery_attempts}`
  ];

  if (record.delivery_receipt_id) {
    lines.push(`Delivery receipt: ${record.delivery_receipt_id}`);
  }

  if (record.retry_after_date) {
    lines.push(`Retry after: ${record.retry_after_date}`);
  }

  if (record.delivery_error) {
    lines.push(`Delivery error: ${record.delivery_error}`);
  }

  if (record.note) {
    lines.push(`Note: ${record.note}`);
  }

  if (record.external_reference_url) {
    lines.push(`External reference: ${record.external_reference_url}`);
  }

  const exportRows = Array.isArray(record.export_rows) ? record.export_rows : [];
  if (exportRows.length > 0) {
    lines.push('', 'Export rows:');
    exportRows.forEach((row) => {
      lines.push(`- ${row.project_name} | ${row.status} | ${row.customer_name}`);
    });
  }

  return lines.join('\n');
}

function _resolveExportIdentifier(records, args) {
  const externalExportId = args.external_export_id ? String(args.external_export_id).trim() : '';
  const exportKey = args.export_key ? String(args.export_key).trim() : '';

  if (!externalExportId && !exportKey) {
    return {
      record: null,
      error: _error('MISSING_REQUIRED_FIELD', 'external_export_id or export_key is required.', 'external_export_id')
    };
  }

  if (externalExportId) {
    const record = records.find((item) => item.external_export_id === externalExportId) || null;
    if (record) {
      return { record, error: null };
    }
  }

  if (exportKey) {
    const record = records.find((item) => item.export_key === exportKey) || null;
    if (record) {
      return { record, error: null };
    }
  }

  return {
    record: null,
    error: _error('RESOURCE_NOT_FOUND', 'Delivery queue record not found.', externalExportId ? 'external_export_id' : 'export_key', {
      external_export_id: externalExportId || null,
      export_key: exportKey || null
    })
  };
}

function _queueBucket(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return 'failed';
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 'ready';
  }

  if (record.delivery_state === 'queued') {
    return 'in_flight';
  }

  const retryAfterDate = record.retry_after_date || null;
  if (!retryAfterDate) {
    return 'retry_waiting';
  }

  return retryAfterDate <= referenceDate ? 'retry_due' : 'retry_waiting';
}

function _nextActionHint(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return 'reschedule_retry';
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 'mark_queued';
  }

  if (record.delivery_state === 'queued') {
    return 'mark_delivered_or_failed';
  }

  if (record.delivery_state === 'retry_scheduled') {
    return record.retry_after_date && record.retry_after_date <= referenceDate
      ? 'mark_queued'
      : 'wait_for_retry_date';
  }

  return 'none';
}

function _isDueNow(record, referenceDate) {
  if (record.delivery_state === 'ready_to_publish' || record.delivery_state === 'queued' || record.delivery_state === 'failed') {
    return true;
  }

  if (record.delivery_state === 'retry_scheduled') {
    return !record.retry_after_date || record.retry_after_date <= referenceDate;
  }

  return false;
}

function _buildQueueItem(record, referenceDate) {
  const queueBucket = _queueBucket(record, referenceDate);
  return {
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    target_type: record.target_type,
    target_name: record.target_name,
    export_scope: record.export_scope,
    project_id: record.project_id || null,
    delivery_state: record.delivery_state,
    delivery_attempts: record.delivery_attempts,
    delivery_acknowledged: record.delivery_acknowledged,
    delivery_receipt_id: record.delivery_receipt_id,
    delivery_error: record.delivery_error,
    retry_after_days: record.retry_after_days,
    retry_after_date: record.retry_after_date || null,
    delivery_channel: record.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    export_row_count: record.export_row_count,
    updated_at: record.updated_at,
    queue_bucket: queueBucket,
    due_now: _isDueNow(record, referenceDate),
    next_action: _nextActionHint(record, referenceDate),
    note: record.note || null
  };
}

function _buildQueueSummary(records, referenceDate) {
  const queueableRecords = records.filter((record) => QUEUEABLE_STATES.has(record.delivery_state));
  return {
    total_records: records.length,
    queueable_records: queueableRecords.length,
    ready_to_publish_count: records.filter((record) => record.delivery_state === 'ready_to_publish').length,
    queued_count: records.filter((record) => record.delivery_state === 'queued').length,
    retry_scheduled_count: records.filter((record) => record.delivery_state === 'retry_scheduled').length,
    failed_count: records.filter((record) => record.delivery_state === 'failed').length,
    due_now_count: queueableRecords.filter((record) => _isDueNow(record, referenceDate)).length
  };
}

function _updateRecordForAction(record, action, args, referenceDate) {
  const normalizedRecord = _normalizeRecord(record);
  const updatedAt = _timestamp();
  const nextNote = args.note !== undefined ? String(args.note || '').trim() || null : normalizedRecord.note || null;

  if (action === 'mark_queued') {
    if (normalizedRecord.delivery_state === 'ready_to_publish') {
      const updatedRecord = {
        ...normalizedRecord,
        delivery_state: 'queued',
        delivery_error: null,
        delivery_acknowledged: false,
        delivery_receipt_id: null,
        retry_after_date: null,
        note: nextNote,
        updated_at: updatedAt
      };
      updatedRecord.export_text = _buildExportText(updatedRecord);
      return { record: updatedRecord, duplicate: false, previous_delivery_state: normalizedRecord.delivery_state };
    }

    if (normalizedRecord.delivery_state === 'retry_scheduled') {
      const updatedRecord = {
        ...normalizedRecord,
        delivery_state: 'queued',
        delivery_attempts: normalizedRecord.delivery_attempts + 1,
        delivery_error: null,
        delivery_acknowledged: false,
        delivery_receipt_id: null,
        retry_after_date: null,
        note: nextNote,
        updated_at: updatedAt
      };
      updatedRecord.export_text = _buildExportText(updatedRecord);
      return { record: updatedRecord, duplicate: false, previous_delivery_state: normalizedRecord.delivery_state };
    }

    if (normalizedRecord.delivery_state === 'queued') {
      return { record: normalizedRecord, duplicate: true, previous_delivery_state: normalizedRecord.delivery_state };
    }

    return {
      record: null,
      duplicate: false,
      error: _error('INVALID_TRANSITION', `Cannot queue record from ${normalizedRecord.delivery_state}.`, 'action', {
        current_state: normalizedRecord.delivery_state,
        action
      })
    };
  }

  if (action === 'mark_delivered') {
    const deliveryReceiptId = String(args.delivery_receipt_id || '').trim();
    if (!deliveryReceiptId) {
      return {
        record: null,
        duplicate: false,
        error: _error('MISSING_REQUIRED_FIELD', 'delivery_receipt_id is required to mark a record delivered.', 'delivery_receipt_id')
      };
    }

    if (normalizedRecord.delivery_state === 'delivered' && normalizedRecord.delivery_receipt_id === deliveryReceiptId) {
      return { record: normalizedRecord, duplicate: true, previous_delivery_state: normalizedRecord.delivery_state };
    }

    if (normalizedRecord.delivery_state !== 'queued') {
      return {
        record: null,
        duplicate: false,
        error: _error('INVALID_TRANSITION', `Cannot mark record delivered from ${normalizedRecord.delivery_state}.`, 'action', {
          current_state: normalizedRecord.delivery_state,
          action
        })
      };
    }

    const updatedRecord = {
      ...normalizedRecord,
      delivery_state: 'delivered',
      delivery_acknowledged: true,
      delivery_receipt_id: deliveryReceiptId,
      delivery_error: null,
      retry_after_date: null,
      note: nextNote,
      updated_at: updatedAt
    };
    updatedRecord.export_text = _buildExportText(updatedRecord);
    return { record: updatedRecord, duplicate: false, previous_delivery_state: normalizedRecord.delivery_state };
  }

  if (action === 'mark_failed') {
    const deliveryError = String(args.delivery_error || '').trim();
    if (!deliveryError) {
      return {
        record: null,
        duplicate: false,
        error: _error('MISSING_REQUIRED_FIELD', 'delivery_error is required to mark a record failed.', 'delivery_error')
      };
    }

    if (normalizedRecord.delivery_state === 'failed' && normalizedRecord.delivery_error === deliveryError) {
      return { record: normalizedRecord, duplicate: true, previous_delivery_state: normalizedRecord.delivery_state };
    }

    if (normalizedRecord.delivery_state !== 'queued' && normalizedRecord.delivery_state !== 'retry_scheduled') {
      return {
        record: null,
        duplicate: false,
        error: _error('INVALID_TRANSITION', `Cannot mark record failed from ${normalizedRecord.delivery_state}.`, 'action', {
          current_state: normalizedRecord.delivery_state,
          action
        })
      };
    }

    const updatedRecord = {
      ...normalizedRecord,
      delivery_state: 'failed',
      delivery_acknowledged: false,
      delivery_receipt_id: null,
      delivery_error: deliveryError,
      retry_after_date: null,
      note: nextNote,
      updated_at: updatedAt
    };
    updatedRecord.export_text = _buildExportText(updatedRecord);
    return { record: updatedRecord, duplicate: false, previous_delivery_state: normalizedRecord.delivery_state };
  }

  if (action === 'reschedule_retry') {
    if (normalizedRecord.delivery_state === 'retry_scheduled') {
      return { record: normalizedRecord, duplicate: true, previous_delivery_state: normalizedRecord.delivery_state };
    }

    if (normalizedRecord.delivery_state !== 'failed') {
      return {
        record: null,
        duplicate: false,
        error: _error('INVALID_TRANSITION', `Cannot reschedule retry from ${normalizedRecord.delivery_state}.`, 'action', {
          current_state: normalizedRecord.delivery_state,
          action
        })
      };
    }

    const retryAfterDaysResult = _parsePositiveInteger(
      args.retry_after_days,
      'retry_after_days',
      normalizedRecord.retry_after_days || DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS
    );
    if (retryAfterDaysResult.error) {
      return { record: null, duplicate: false, error: retryAfterDaysResult.error };
    }

    const deliveryError = String(args.delivery_error || '').trim() || normalizedRecord.delivery_error || null;
    const updatedRecord = {
      ...normalizedRecord,
      delivery_state: 'retry_scheduled',
      retry_after_days: retryAfterDaysResult.value,
      retry_after_date: _addDays(referenceDate, retryAfterDaysResult.value),
      delivery_error: deliveryError,
      delivery_acknowledged: false,
      delivery_receipt_id: null,
      note: nextNote,
      updated_at: updatedAt
    };
    updatedRecord.export_text = _buildExportText(updatedRecord);
    return { record: updatedRecord, duplicate: false, previous_delivery_state: normalizedRecord.delivery_state };
  }

  return {
    record: null,
    duplicate: false,
    error: _error('INVALID_INPUT', `Unsupported action: ${action}.`, 'action')
  };
}

function _resolveExecutionMode(value) {
  const candidate = String(value || 'dry_run').trim();
  return candidate === 'live' ? 'live' : 'dry_run';
}

function _isPublishableState(record, referenceDate) {
  if (record.delivery_state === 'ready_to_publish' || record.delivery_state === 'queued') {
    return true;
  }

  if (record.delivery_state === 'retry_scheduled') {
    return !record.retry_after_date || record.retry_after_date <= referenceDate;
  }

  return false;
}

function _buildUpdatedRecordForPublish(record, publishResult, args, referenceDate) {
  const normalizedRecord = _normalizeRecord(record);
  const updatedAt = _timestamp();
  const nextNote = args.note !== undefined ? String(args.note || '').trim() || null : normalizedRecord.note || null;
  const shouldIncrementAttempt = normalizedRecord.delivery_state === 'retry_scheduled';
  const nextAttemptCount = shouldIncrementAttempt
    ? normalizedRecord.delivery_attempts + 1
    : normalizedRecord.delivery_attempts;

  if (!publishResult.ok) {
    const failedRecord = {
      ...normalizedRecord,
      delivery_state: 'failed',
      delivery_attempts: nextAttemptCount,
      delivery_acknowledged: false,
      delivery_receipt_id: null,
      delivery_error: publishResult.error_message || 'External publish failed.',
      retry_after_date: null,
      delivery_channel: publishResult.adapter || normalizedRecord.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
      publish_adapter: publishResult.adapter || null,
      last_publish_mode: publishResult.execution_mode || 'live',
      external_reference_url: null,
      note: nextNote,
      updated_at: updatedAt
    };
    failedRecord.export_text = _buildExportText(failedRecord);
    return failedRecord;
  }

  const deliveredRecord = {
    ...normalizedRecord,
    delivery_state: 'delivered',
    delivery_attempts: nextAttemptCount,
    delivery_acknowledged: true,
    delivery_receipt_id: publishResult.receipt_id || normalizedRecord.delivery_receipt_id || null,
    delivery_error: null,
    retry_after_date: null,
    delivery_channel: publishResult.adapter || normalizedRecord.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    publish_adapter: publishResult.adapter || null,
    last_publish_mode: publishResult.execution_mode || 'live',
    external_reference_url: publishResult.external_reference_url || null,
    note: nextNote,
    updated_at: updatedAt
  };
  deliveredRecord.export_text = _buildExportText(deliveredRecord);
  return deliveredRecord;
}

async function processToolCall(args) {
  const action = String(args.action || 'list_due').trim();
  if (!EXTERNAL_DELIVERY_QUEUE_ACTIONS.includes(action)) {
    return _error('INVALID_INPUT', `action must be one of: ${EXTERNAL_DELIVERY_QUEUE_ACTIONS.join(', ')}`, 'action');
  }

  const referenceDate = _resolveReferenceDate(args.reference_date);
  if (!referenceDate) {
    return _error('INVALID_INPUT', 'reference_date must be in YYYY-MM-DD format.', 'reference_date');
  }

  const allRecords = store.getExternalExports().map(_normalizeRecord);

  if (action === 'list_due') {
    const queueItems = allRecords
      .filter((record) => QUEUEABLE_STATES.has(record.delivery_state))
      .map((record) => _buildQueueItem(record, referenceDate))
      .sort((left, right) => {
        const leftPriority = LIST_PRIORITY[left.delivery_state] ?? 99;
        const rightPriority = LIST_PRIORITY[right.delivery_state] ?? 99;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        const leftDate = left.retry_after_date || '9999-12-31';
        const rightDate = right.retry_after_date || '9999-12-31';
        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }

        return left.export_key.localeCompare(right.export_key);
      });

    return _success({
      queue_action: action,
      reference_date: referenceDate,
      queue_summary: _buildQueueSummary(allRecords, referenceDate),
      queue_items: queueItems,
      note: args.note !== undefined ? String(args.note || '').trim() || null : null
    }, {
      entity: 'external_delivery_queue',
      sync_mode: 'local_shadow',
      queue_action: action
    });
  }

  const resolved = _resolveExportIdentifier(allRecords, args);
  if (resolved.error) {
    return resolved.error;
  }

  if (action === 'publish_record') {
    const normalizedRecord = _normalizeRecord(resolved.record);
    const executionMode = _resolveExecutionMode(args.execution_mode);

    if (!_isPublishableState(normalizedRecord, referenceDate)) {
      return _error('INVALID_TRANSITION', `Cannot publish record from ${normalizedRecord.delivery_state}.`, 'action', {
        current_state: normalizedRecord.delivery_state,
        action,
        execution_mode: executionMode
      });
    }

    const publishResult = await externalPublishAdapter.publishRecord(normalizedRecord, {
      execution_mode: executionMode
    });

    if (publishResult.no_op) {
      return _success({
        queue_action: action,
        external_export_id: normalizedRecord.external_export_id,
        export_key: normalizedRecord.export_key,
        execution_mode: executionMode,
        activation_status: publishResult.activation_status,
        published: false,
        no_op: true,
        delivery_state: normalizedRecord.delivery_state,
        delivery_attempts: normalizedRecord.delivery_attempts,
        delivery_channel: normalizedRecord.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
        reason: publishResult.reason || null,
        missing_fields: publishResult.missing_fields || [],
        request_preview: publishResult.request_preview || null,
        record_unchanged: true
      }, {
        entity: 'external_delivery_queue',
        sync_mode: 'local_shadow',
        queue_action: action,
        execution_mode: executionMode,
        degraded: true,
        no_op: true
      });
    }

    if (executionMode === 'dry_run') {
      return _success({
        queue_action: action,
        external_export_id: normalizedRecord.external_export_id,
        export_key: normalizedRecord.export_key,
        execution_mode: executionMode,
        activation_status: publishResult.activation_status,
        published: false,
        no_op: true,
        preview_only: true,
        delivery_state: normalizedRecord.delivery_state,
        delivery_attempts: normalizedRecord.delivery_attempts,
        delivery_channel: normalizedRecord.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
        request_preview: publishResult.request_preview || null,
        record_unchanged: true
      }, {
        entity: 'external_delivery_queue',
        sync_mode: 'local_shadow',
        queue_action: action,
        execution_mode: executionMode,
        duplicate: false
      });
    }

    const persisted = store.upsertExternalExport(
      _buildUpdatedRecordForPublish(normalizedRecord, publishResult, args, referenceDate)
    ).record;

    return _success({
      queue_action: action,
      external_export_id: persisted.external_export_id,
      export_key: persisted.export_key,
      execution_mode: executionMode,
      activation_status: publishResult.activation_status,
      published: publishResult.ok,
      no_op: false,
      delivery_state: persisted.delivery_state,
      delivery_attempts: persisted.delivery_attempts,
      delivery_acknowledged: persisted.delivery_acknowledged,
      delivery_receipt_id: persisted.delivery_receipt_id,
      delivery_error: persisted.delivery_error,
      delivery_channel: persisted.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
      external_reference_url: persisted.external_reference_url || null,
      request_preview: publishResult.request_preview || null,
      response_preview: publishResult.response_preview || null,
      updated_at: persisted.updated_at,
      note: persisted.note || null
    }, {
      entity: 'external_delivery_queue',
      sync_mode: 'local_shadow',
      queue_action: action,
      execution_mode: executionMode,
      delivery_state: persisted.delivery_state,
      delivery_attempts: persisted.delivery_attempts,
      degraded: !publishResult.ok
    });
  }

  const result = _updateRecordForAction(resolved.record, action, args, referenceDate);
  if (result.error) {
    return result.error;
  }

  const { record } = result;
  const persisted = store.upsertExternalExport(record).record;

  return _success({
    queue_action: action,
    external_export_id: persisted.external_export_id,
    export_key: persisted.export_key,
    previous_delivery_state: result.previous_delivery_state,
    delivery_state: persisted.delivery_state,
    delivery_attempts: persisted.delivery_attempts,
    delivery_acknowledged: persisted.delivery_acknowledged,
    delivery_receipt_id: persisted.delivery_receipt_id,
    delivery_error: persisted.delivery_error,
    retry_after_days: persisted.retry_after_days,
    retry_after_date: persisted.retry_after_date,
    delivery_channel: persisted.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    duplicate: result.duplicate,
    updated_at: persisted.updated_at,
    note: persisted.note || null
  }, {
    entity: 'external_delivery_queue',
    sync_mode: 'local_shadow',
    queue_action: action,
    delivery_state: persisted.delivery_state,
    delivery_attempts: persisted.delivery_attempts,
    duplicate: result.duplicate
  });
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
  externalPublishAdapter.configure(config);
}

function shutdown() {}

module.exports = {
  EXTERNAL_DELIVERY_QUEUE_ACTIONS,
  initialize,
  processToolCall,
  shutdown
};
