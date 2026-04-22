const store = require('./PhotoStudioDataStore');

function _inputError(code, message, field, details) {
  const error = new Error(message);
  error.code = code;
  error.field = field || null;
  error.details = details || {};
  return error;
}

function _toUtcDayStart(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function _isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(_toUtcDayStart(value).getTime());
}

function _optionalTrimmedString(value) {
  const candidate = String(value || '').trim();
  return candidate || null;
}

function _resolveReferenceDate(value) {
  const candidate = _optionalTrimmedString(value);
  if (!candidate) {
    return new Date().toISOString().slice(0, 10);
  }

  if (!_isIsoDate(candidate)) {
    throw _inputError('INVALID_INPUT', 'reference_date must be in YYYY-MM-DD format.', 'reference_date');
  }

  return candidate;
}

function _resolveScope(input = {}) {
  return {
    projectId: _optionalTrimmedString(input.project_id),
    exportKey: _optionalTrimmedString(input.export_key),
    targetType: _optionalTrimmedString(input.target_type),
    deliveryState: _optionalTrimmedString(input.delivery_state)
  };
}

function _scopePayload(scope) {
  return {
    project_id: scope.projectId,
    export_key: scope.exportKey,
    target_type: scope.targetType,
    delivery_state: scope.deliveryState
  };
}

function _parseOptionalPositiveInteger(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw _inputError('INVALID_INPUT', `${fieldName} must be a positive integer.`, fieldName);
  }

  return parsed;
}

function _matchesProjectId(record, projectId) {
  if (!projectId) {
    return true;
  }

  if (record.project_id === projectId) {
    return true;
  }

  return Array.isArray(record.export_rows)
    && record.export_rows.some((row) => row && row.project_id === projectId);
}

function _matchesScope(record, scope) {
  if (!_matchesProjectId(record, scope.projectId)) {
    return false;
  }

  if (scope.exportKey && record.export_key !== scope.exportKey) {
    return false;
  }

  if (scope.targetType && record.target_type !== scope.targetType) {
    return false;
  }

  if (scope.deliveryState && record.delivery_state !== scope.deliveryState) {
    return false;
  }

  return true;
}

function _displayName(record) {
  const row = Array.isArray(record.export_rows) && record.export_rows.length > 0
    ? record.export_rows[0]
    : null;

  if (row && row.project_name && row.customer_name) {
    return `${row.project_name} / ${row.customer_name}`;
  }

  if (row && row.project_name) {
    return row.project_name;
  }

  return record.export_key || record.external_export_id;
}

function _isRetryDue(record, referenceDate) {
  return record.delivery_state === 'retry_scheduled'
    && (!record.retry_after_date || record.retry_after_date <= referenceDate);
}

function _isActionable(record, referenceDate) {
  return record.delivery_state === 'failed'
    || record.delivery_state === 'ready_to_publish'
    || record.delivery_state === 'queued'
    || _isRetryDue(record, referenceDate)
    || (record.delivery_state === 'retry_scheduled' && record.retry_after_date && record.retry_after_date > referenceDate);
}

function _scheduleDate(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return referenceDate;
  }

  if (record.delivery_state === 'ready_to_publish') {
    return referenceDate;
  }

  if (record.delivery_state === 'queued') {
    return referenceDate;
  }

  if (_isRetryDue(record, referenceDate)) {
    return referenceDate;
  }

  if (record.delivery_state === 'retry_scheduled' && record.retry_after_date) {
    return record.retry_after_date;
  }

  return referenceDate;
}

function _actionHint(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return 'reschedule_retry';
  }

  if (_isRetryDue(record, referenceDate)) {
    return 'mark_queued';
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 'mark_queued';
  }

  if (record.delivery_state === 'queued') {
    return 'monitor_delivery';
  }

  if (record.delivery_state === 'retry_scheduled') {
    return 'wait_for_retry_date';
  }

  return 'none';
}

function _priorityRank(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return 0;
  }

  if (_isRetryDue(record, referenceDate)) {
    return 1;
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 2;
  }

  if (record.delivery_state === 'queued') {
    return 3;
  }

  if (record.delivery_state === 'retry_scheduled') {
    return 4;
  }

  return 9;
}

function _buildScheduleReason(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return record.delivery_error || 'Failed delivery needs retry scheduling.';
  }

  if (_isRetryDue(record, referenceDate)) {
    return 'Retry window is open.';
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 'Record is ready to be queued.';
  }

  if (record.delivery_state === 'queued') {
    return 'Delivery is already in flight.';
  }

  if (record.delivery_state === 'retry_scheduled') {
    return record.retry_after_date
      ? `Retry after ${record.retry_after_date}.`
      : 'Retry date has not been set.';
  }

  return 'No scheduling action required.';
}

function _buildScheduleRow(record, referenceDate) {
  const scheduleDate = _scheduleDate(record, referenceDate);

  return {
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    project_id: record.project_id || null,
    display_name: _displayName(record),
    target_type: record.target_type,
    target_name: record.target_name,
    delivery_state: record.delivery_state,
    schedule_date: scheduleDate,
    schedule_bucket: scheduleDate <= referenceDate ? 'immediate' : 'future',
    priority_rank: _priorityRank(record, referenceDate),
    recommended_action: _actionHint(record, referenceDate),
    schedule_reason: _buildScheduleReason(record, referenceDate),
    retry_after_date: record.retry_after_date || null,
    delivery_error: record.delivery_error || null,
    delivery_attempts: record.delivery_attempts || 0,
    delivery_acknowledged: Boolean(record.delivery_acknowledged),
    updated_at: record.updated_at || null
  };
}

function _sortScheduleRows(left, right) {
  if (left.priority_rank !== right.priority_rank) {
    return left.priority_rank - right.priority_rank;
  }

  if (left.schedule_date !== right.schedule_date) {
    return left.schedule_date.localeCompare(right.schedule_date);
  }

  return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
}

function _buildWindowRows(rows) {
  const windows = new Map();

  rows.forEach((row) => {
    const key = row.schedule_date;
    const current = windows.get(key) || {
      schedule_date: key,
      window_label: row.schedule_bucket,
      item_count: 0,
      priority_floor: row.priority_rank,
      priority_ceiling: row.priority_rank,
      items: []
    };

    current.item_count += 1;
    current.priority_floor = Math.min(current.priority_floor, row.priority_rank);
    current.priority_ceiling = Math.max(current.priority_ceiling, row.priority_rank);
    current.items.push(row);
    windows.set(key, current);
  });

  return Array.from(windows.values()).sort((left, right) => left.schedule_date.localeCompare(right.schedule_date));
}

function _buildScheduleText(referenceDate, summary, windows) {
  const lines = [
    'Photo Studio delivery queue schedule',
    `Reference date: ${referenceDate}`,
    `Total records: ${summary.total_records}`,
    `Actionable records: ${summary.actionable_records}`,
    `Immediate actions: ${summary.immediate_actions_count}`,
    `Future actions: ${summary.future_actions_count}`,
    `Failed: ${summary.failed_count}`,
    `Retry due: ${summary.retry_due_count}`,
    `Ready to publish: ${summary.ready_to_publish_count}`,
    `Queued: ${summary.queued_count}`
  ];

  if (!windows.length) {
    lines.push('Schedule windows: none');
    return lines.join('\n');
  }

  lines.push('Schedule windows:');
  windows.slice(0, 10).forEach((window, index) => {
    lines.push(`${index + 1}. ${window.schedule_date} | ${window.window_label} | ${window.item_count} item(s)`);
    window.items.slice(0, 5).forEach((item, itemIndex) => {
      lines.push(`   ${itemIndex + 1}. ${item.display_name} | ${item.recommended_action} | ${item.schedule_reason}`);
    });
  });

  return lines.join('\n');
}

function _matchedRecords(scope) {
  return store.getExternalExports().filter((record) => _matchesScope(record, scope));
}

function generateDeliveryQueueSchedule(input = {}) {
  const referenceDate = _resolveReferenceDate(input.reference_date);
  const scope = _resolveScope(input);
  const maxItems = _parseOptionalPositiveInteger(input.max_items, 'max_items');
  const matchedRecords = _matchedRecords(scope);

  const scheduleRows = matchedRecords
    .filter((record) => _isActionable(record, referenceDate))
    .map((record) => _buildScheduleRow(record, referenceDate))
    .sort(_sortScheduleRows);

  const limitedRows = typeof maxItems === 'number' ? scheduleRows.slice(0, maxItems) : scheduleRows;
  const scheduleWindows = _buildWindowRows(limitedRows);

  const summary = {
    total_records: matchedRecords.length,
    actionable_records: scheduleRows.length,
    immediate_actions_count: scheduleRows.filter((row) => row.schedule_bucket === 'immediate').length,
    future_actions_count: scheduleRows.filter((row) => row.schedule_bucket === 'future').length,
    failed_count: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
    retry_due_count: matchedRecords.filter((record) => _isRetryDue(record, referenceDate)).length,
    ready_to_publish_count: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length,
    queued_count: matchedRecords.filter((record) => record.delivery_state === 'queued').length
  };

  return {
    reference_date: referenceDate,
    schedule_scope: _scopePayload(scope),
    summary,
    schedule_rows: limitedRows,
    schedule_windows: scheduleWindows,
    schedule_text: _buildScheduleText(referenceDate, summary, scheduleWindows)
  };
}

function prioritizePendingDeliveryActions(input = {}) {
  const referenceDate = _resolveReferenceDate(input.reference_date);
  const scope = _resolveScope(input);
  const maxItems = _parseOptionalPositiveInteger(input.max_items, 'max_items');
  const matchedRecords = _matchedRecords(scope);

  const priorityQueue = matchedRecords
    .filter((record) => _isActionable(record, referenceDate))
    .map((record) => _buildScheduleRow(record, referenceDate))
    .sort(_sortScheduleRows);

  const limitedQueue = typeof maxItems === 'number' ? priorityQueue.slice(0, maxItems) : priorityQueue;
  const summary = {
    total_records: matchedRecords.length,
    priority_items: limitedQueue.length,
    critical_count: limitedQueue.filter((row) => row.priority_rank === 0).length,
    high_count: limitedQueue.filter((row) => row.priority_rank === 1 || row.priority_rank === 2).length,
    watch_count: limitedQueue.filter((row) => row.priority_rank >= 3).length,
    ready_to_publish_count: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length,
    failed_count: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
    retry_due_count: matchedRecords.filter((record) => _isRetryDue(record, referenceDate)).length
  };

  return {
    reference_date: referenceDate,
    priority_scope: _scopePayload(scope),
    summary,
    priority_queue: limitedQueue,
    priority_text: _buildScheduleText(referenceDate, summary, [{
      schedule_date: referenceDate,
      window_label: 'priority_queue',
      item_count: limitedQueue.length,
      priority_floor: limitedQueue.length ? limitedQueue[0].priority_rank : null,
      priority_ceiling: limitedQueue.length ? limitedQueue[limitedQueue.length - 1].priority_rank : null,
      items: limitedQueue
    }])
  };
}

module.exports = {
  generateDeliveryQueueSchedule,
  prioritizePendingDeliveryActions
};
