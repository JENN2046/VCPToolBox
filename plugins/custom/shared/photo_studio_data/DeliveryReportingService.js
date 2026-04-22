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

function _isStalled(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return true;
  }

  if (_isRetryDue(record, referenceDate)) {
    return true;
  }

  if (record.delivery_state === 'queued' && record.updated_at) {
    return record.updated_at.slice(0, 10) < referenceDate;
  }

  return false;
}

function _operatorStatus(record, referenceDate) {
  if (record.delivery_state === 'failed') {
    return 'failed';
  }

  if (_isRetryDue(record, referenceDate)) {
    return 'retry_due';
  }

  if (record.delivery_state === 'ready_to_publish') {
    return 'ready_to_queue';
  }

  if (record.delivery_state === 'queued') {
    return 'queued';
  }

  if (record.delivery_state === 'delivered' && !record.delivery_acknowledged) {
    return 'awaiting_confirmation';
  }

  if (record.delivery_state === 'delivered' && record.delivery_acknowledged) {
    return 'delivered';
  }

  return 'idle';
}

function _operatorSeverity(status) {
  switch (status) {
    case 'failed':
      return 0;
    case 'retry_due':
      return 1;
    case 'ready_to_queue':
      return 2;
    case 'queued':
      return 3;
    case 'awaiting_confirmation':
      return 4;
    default:
      return 9;
  }
}

function _buildOperatorAlert(record, referenceDate) {
  const status = _operatorStatus(record, referenceDate);
  const severity = _operatorSeverity(status);

  if (severity >= 9) {
    return null;
  }

  const actionByStatus = {
    failed: 'reschedule_retry',
    retry_due: 'mark_queued',
    ready_to_queue: 'mark_queued',
    queued: 'mark_delivered_or_failed',
    awaiting_confirmation: 'confirm_delivery'
  };

  const reasonByStatus = {
    failed: record.delivery_error || 'Delivery failed and should be retried.',
    retry_due: 'Retry window is open.',
    ready_to_queue: 'Record is ready to be queued.',
    queued: 'Delivery is in flight.',
    awaiting_confirmation: 'Delivered locally but still awaiting confirmation.'
  };

  return {
    severity,
    operator_status: status,
    action_hint: actionByStatus[status] || 'none',
    reason: reasonByStatus[status] || 'No operator action required.',
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    project_id: record.project_id || null,
    display_name: _displayName(record),
    delivery_state: record.delivery_state,
    retry_after_date: record.retry_after_date || null,
    delivery_error: record.delivery_error || null,
    updated_at: record.updated_at || null
  };
}

function _buildOperatorRow(record, referenceDate) {
  const status = _operatorStatus(record, referenceDate);
  const alert = _buildOperatorAlert(record, referenceDate);

  return {
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    project_id: record.project_id || null,
    display_name: _displayName(record),
    target_type: record.target_type,
    target_name: record.target_name,
    delivery_state: record.delivery_state,
    operator_status: status,
    operator_severity: alert ? alert.severity : 9,
    recommended_action: alert ? alert.action_hint : 'none',
    retry_after_date: record.retry_after_date || null,
    delivery_receipt_id: record.delivery_receipt_id || null,
    delivery_error: record.delivery_error || null,
    delivery_attempts: record.delivery_attempts || 0,
    delivery_acknowledged: Boolean(record.delivery_acknowledged),
    updated_at: record.updated_at || null
  };
}

function _buildReportText(referenceDate, summary, alerts) {
  const lines = [
    'Photo Studio delivery operator report',
    `Reference date: ${referenceDate}`,
    `Total exports: ${summary.total_records}`,
    `Ready to queue: ${summary.ready_to_publish_count}`,
    `Queued: ${summary.queued_count}`,
    `Retry due: ${summary.retry_due_count}`,
    `Failed: ${summary.failed_count}`,
    `Delivered: ${summary.delivered_count}`,
    `Awaiting confirmation: ${summary.awaiting_confirmation_count}`,
    `Stalled: ${summary.stalled_count}`
  ];

  if (!alerts.length) {
    lines.push('Alerts: none');
    return lines.join('\n');
  }

  lines.push('Alerts:');
  alerts.slice(0, 10).forEach((alert, index) => {
    lines.push(`${index + 1}. ${alert.display_name} | ${alert.operator_status} | ${alert.action_hint} | ${alert.reason}`);
  });

  return lines.join('\n');
}

function _eventTimestamp(value, fallback) {
  return value || fallback;
}

function _buildAuditEvents(record, referenceDate) {
  const fallback = `${referenceDate}T00:00:00.000Z`;
  const events = [];

  if (record.created_at) {
    events.push({
      timestamp: _eventTimestamp(record.created_at, fallback),
      event_type: 'record_created',
      event_order: 0,
      external_export_id: record.external_export_id,
      export_key: record.export_key,
      project_id: record.project_id || null,
      display_name: _displayName(record),
      delivery_state: record.delivery_state,
      details: 'Local shadow export record created.'
    });
  }

  events.push({
    timestamp: _eventTimestamp(record.updated_at, fallback),
    event_type: 'current_state_snapshot',
    event_order: 1,
    external_export_id: record.external_export_id,
    export_key: record.export_key,
    project_id: record.project_id || null,
    display_name: _displayName(record),
    delivery_state: record.delivery_state,
    details: `Current state is ${record.delivery_state}.`
  });

  if (record.delivery_state === 'retry_scheduled' && record.retry_after_date) {
    events.push({
      timestamp: `${record.retry_after_date}T00:00:00.000Z`,
      event_type: 'retry_window_scheduled',
      event_order: 2,
      external_export_id: record.external_export_id,
      export_key: record.export_key,
      project_id: record.project_id || null,
      display_name: _displayName(record),
      delivery_state: record.delivery_state,
      details: 'Retry window was scheduled.'
    });
  }

  if (record.delivery_state === 'failed') {
    events.push({
      timestamp: _eventTimestamp(record.updated_at, fallback),
      event_type: 'delivery_failed',
      event_order: 2,
      external_export_id: record.external_export_id,
      export_key: record.export_key,
      project_id: record.project_id || null,
      display_name: _displayName(record),
      delivery_state: record.delivery_state,
      details: record.delivery_error || 'Delivery failed.'
    });
  }

  if (record.delivery_state === 'delivered') {
    events.push({
      timestamp: _eventTimestamp(record.updated_at, fallback),
      event_type: record.delivery_acknowledged ? 'delivery_acknowledged' : 'delivery_pending_confirmation',
      event_order: 2,
      external_export_id: record.external_export_id,
      export_key: record.export_key,
      project_id: record.project_id || null,
      display_name: _displayName(record),
      delivery_state: record.delivery_state,
      details: record.delivery_acknowledged
        ? 'Delivery was acknowledged.'
        : 'Delivery still awaits acknowledgement.'
    });
  }

  return events;
}

function _buildAuditText(referenceDate, scope, summary, rows) {
  const scopeLabel = scope.projectId || scope.exportKey || scope.targetType || scope.deliveryState || 'all exports';
  const lines = [
    'Photo Studio delivery audit trail',
    `Reference date: ${referenceDate}`,
    `Scope: ${scopeLabel}`,
    `Records: ${summary.total_records}`,
    `Events: ${summary.total_events}`
  ];

  if (!rows.length) {
    lines.push('Events: none');
    return lines.join('\n');
  }

  lines.push('Timeline:');
  rows.slice(0, 12).forEach((row, index) => {
    lines.push(`${index + 1}. ${row.timestamp} | ${row.display_name} | ${row.event_type} | ${row.details}`);
  });

  return lines.join('\n');
}

function generateDeliveryOperatorReport(input = {}) {
  const referenceDate = _resolveReferenceDate(input.reference_date);
  const scope = _resolveScope(input);
  const matchedRecords = store.getExternalExports().filter((record) => _matchesScope(record, scope));

  const rows = matchedRecords
    .map((record) => _buildOperatorRow(record, referenceDate))
    .sort((left, right) => {
      if (left.operator_severity !== right.operator_severity) {
        return left.operator_severity - right.operator_severity;
      }

      return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
    });

  const alerts = rows
    .filter((row) => row.operator_severity < 9)
    .map((row) => ({
      severity: row.operator_severity,
      operator_status: row.operator_status,
      action_hint: row.recommended_action,
      reason: row.operator_status === 'failed'
        ? row.delivery_error || 'Delivery failed and should be retried.'
        : row.operator_status === 'retry_due'
          ? 'Retry window is open.'
          : row.operator_status === 'ready_to_queue'
            ? 'Record is ready to be queued.'
            : row.operator_status === 'queued'
              ? 'Delivery is in flight.'
              : 'Delivered locally but still awaiting confirmation.',
      external_export_id: row.external_export_id,
      export_key: row.export_key,
      project_id: row.project_id,
      display_name: row.display_name,
      delivery_state: row.delivery_state,
      retry_after_date: row.retry_after_date,
      delivery_error: row.delivery_error,
      updated_at: row.updated_at
    }));

  const summary = {
    total_records: matchedRecords.length,
    ready_to_publish_count: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length,
    queued_count: matchedRecords.filter((record) => record.delivery_state === 'queued').length,
    retry_scheduled_count: matchedRecords.filter((record) => record.delivery_state === 'retry_scheduled').length,
    retry_due_count: matchedRecords.filter((record) => _isRetryDue(record, referenceDate)).length,
    failed_count: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
    delivered_count: matchedRecords.filter((record) => record.delivery_state === 'delivered').length,
    awaiting_confirmation_count: matchedRecords.filter((record) => record.delivery_state === 'delivered' && !record.delivery_acknowledged).length,
    due_now_count: matchedRecords.filter((record) => (
      record.delivery_state === 'ready_to_publish'
      || record.delivery_state === 'queued'
      || record.delivery_state === 'failed'
      || _isRetryDue(record, referenceDate)
    )).length,
    stalled_count: matchedRecords.filter((record) => _isStalled(record, referenceDate)).length
  };

  return {
    reference_date: referenceDate,
    report_scope: _scopePayload(scope),
    summary,
    operator_alerts: alerts,
    report_rows: rows,
    report_text: _buildReportText(referenceDate, summary, alerts)
  };
}

function inspectDeliveryAuditTrail(input = {}) {
  const referenceDate = _resolveReferenceDate(input.reference_date);
  const scope = _resolveScope(input);
  const matchedRecords = store.getExternalExports().filter((record) => _matchesScope(record, scope));

  const rows = matchedRecords
    .flatMap((record) => _buildAuditEvents(record, referenceDate))
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp);
      const rightTime = Date.parse(right.timestamp);

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.event_order - right.event_order;
    });

  const summary = {
    total_records: matchedRecords.length,
    total_events: rows.length,
    failed_records: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
    delivered_records: matchedRecords.filter((record) => record.delivery_state === 'delivered').length,
    retry_scheduled_records: matchedRecords.filter((record) => record.delivery_state === 'retry_scheduled').length,
    ready_to_publish_records: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length
  };

  return {
    reference_date: referenceDate,
    audit_scope: _scopePayload(scope),
    audit_summary: summary,
    audit_rows: rows,
    audit_text: _buildAuditText(referenceDate, scope, summary, rows)
  };
}

module.exports = {
  generateDeliveryOperatorReport,
  inspectDeliveryAuditTrail
};
