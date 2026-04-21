const { buildSuccess } = require('./runtime');
const { readCollection } = require('./store');
const { optionalDate, optionalNumber, optionalString } = require('./utils');

function resolveReferenceDate(value) {
    if (value === null || value === undefined || value === '') {
        return new Date().toISOString().slice(0, 10);
    }

    return optionalDate(value, 'reference_date');
}

function resolveScope(input = {}) {
    return {
        projectId: optionalString(input.project_id, 'project_id'),
        exportKey: optionalString(input.export_key, 'export_key'),
        targetType: optionalString(input.target_type, 'target_type'),
        deliveryState: optionalString(input.delivery_state, 'delivery_state')
    };
}

function matchesProjectId(record, projectId) {
    if (!projectId) {
        return true;
    }

    if (record.project_id === projectId) {
        return true;
    }

    return Array.isArray(record.export_rows)
        && record.export_rows.some((row) => row && row.project_id === projectId);
}

function matchesScope(record, scope) {
    if (!matchesProjectId(record, scope.projectId)) {
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

function displayName(record) {
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

function isRetryDue(record, referenceDate) {
    return record.delivery_state === 'retry_scheduled'
        && (!record.retry_after_date || record.retry_after_date <= referenceDate);
}

function isActionable(record, referenceDate) {
    return record.delivery_state === 'failed'
        || record.delivery_state === 'ready_to_publish'
        || record.delivery_state === 'queued'
        || isRetryDue(record, referenceDate)
        || (record.delivery_state === 'retry_scheduled' && record.retry_after_date && record.retry_after_date > referenceDate);
}

function scheduleDate(record, referenceDate) {
    if (record.delivery_state === 'failed') {
        return referenceDate;
    }

    if (record.delivery_state === 'ready_to_publish') {
        return referenceDate;
    }

    if (record.delivery_state === 'queued') {
        return referenceDate;
    }

    if (isRetryDue(record, referenceDate)) {
        return referenceDate;
    }

    if (record.delivery_state === 'retry_scheduled' && record.retry_after_date) {
        return record.retry_after_date;
    }

    return referenceDate;
}

function actionHint(record, referenceDate) {
    if (record.delivery_state === 'failed') {
        return 'reschedule_retry';
    }

    if (isRetryDue(record, referenceDate)) {
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

function priorityRank(record, referenceDate) {
    if (record.delivery_state === 'failed') {
        return 0;
    }

    if (isRetryDue(record, referenceDate)) {
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

function buildScheduleReason(record, referenceDate) {
    if (record.delivery_state === 'failed') {
        return record.delivery_error || 'Failed delivery needs retry scheduling.';
    }

    if (isRetryDue(record, referenceDate)) {
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

function buildScheduleRow(record, referenceDate) {
    const rank = priorityRank(record, referenceDate);
    const scheduleDateValue = scheduleDate(record, referenceDate);

    return {
        external_export_id: record.external_export_id,
        export_key: record.export_key,
        project_id: record.project_id || null,
        display_name: displayName(record),
        target_type: record.target_type,
        target_name: record.target_name,
        delivery_state: record.delivery_state,
        schedule_date: scheduleDateValue,
        schedule_bucket: scheduleDateValue <= referenceDate ? 'immediate' : 'future',
        priority_rank: rank,
        recommended_action: actionHint(record, referenceDate),
        schedule_reason: buildScheduleReason(record, referenceDate),
        retry_after_date: record.retry_after_date || null,
        delivery_error: record.delivery_error || null,
        delivery_attempts: record.delivery_attempts || 0,
        delivery_acknowledged: Boolean(record.delivery_acknowledged),
        updated_at: record.updated_at || null
    };
}

function buildWindowRows(rows) {
    const windows = new Map();

    rows.forEach((row) => {
        const key = row.schedule_date;
        const existing = windows.get(key) || {
            schedule_date: key,
            window_label: row.schedule_bucket,
            item_count: 0,
            priority_floor: row.priority_rank,
            priority_ceiling: row.priority_rank,
            items: []
        };

        existing.item_count += 1;
        existing.priority_floor = Math.min(existing.priority_floor, row.priority_rank);
        existing.priority_ceiling = Math.max(existing.priority_ceiling, row.priority_rank);
        existing.items.push(row);
        windows.set(key, existing);
    });

    return Array.from(windows.values()).sort((left, right) => left.schedule_date.localeCompare(right.schedule_date));
}

function buildScheduleText(referenceDate, summary, windows) {
    const lines = [
        'PhotoStudio delivery queue schedule',
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

async function generateDeliveryQueueSchedule(input = {}) {
    const referenceDate = resolveReferenceDate(input.reference_date);
    const scope = resolveScope(input);
    const maxItems = optionalNumber(input.max_items, 'max_items');
    const store = await readCollection('externalExports');
    const matchedRecords = store.records.filter((record) => matchesScope(record, scope));

    const rows = matchedRecords
        .filter((record) => isActionable(record, referenceDate))
        .map((record) => buildScheduleRow(record, referenceDate))
        .sort((left, right) => {
            if (left.priority_rank !== right.priority_rank) {
                return left.priority_rank - right.priority_rank;
            }

            if (left.schedule_date !== right.schedule_date) {
                return left.schedule_date.localeCompare(right.schedule_date);
            }

            return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
        });

    const limitedRows = typeof maxItems === 'number' ? rows.slice(0, maxItems) : rows;
    const windows = buildWindowRows(limitedRows);

    const summary = {
        total_records: matchedRecords.length,
        actionable_records: rows.length,
        immediate_actions_count: rows.filter((row) => row.schedule_bucket === 'immediate').length,
        future_actions_count: rows.filter((row) => row.schedule_bucket === 'future').length,
        failed_count: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
        retry_due_count: matchedRecords.filter((record) => isRetryDue(record, referenceDate)).length,
        ready_to_publish_count: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length,
        queued_count: matchedRecords.filter((record) => record.delivery_state === 'queued').length
    };

    return buildSuccess({
        reference_date: referenceDate,
        schedule_scope: scope,
        summary,
        schedule_rows: limitedRows,
        schedule_windows: windows,
        schedule_text: buildScheduleText(referenceDate, summary, windows)
    }, {
        report_type: 'delivery_queue_schedule',
        degraded: false,
        matched_records: matchedRecords.length
    });
}

async function prioritizePendingDeliveryActions(input = {}) {
    const referenceDate = resolveReferenceDate(input.reference_date);
    const scope = resolveScope(input);
    const maxItems = optionalNumber(input.max_items, 'max_items');
    const store = await readCollection('externalExports');
    const matchedRecords = store.records.filter((record) => matchesScope(record, scope));

    const queue = matchedRecords
        .filter((record) => isActionable(record, referenceDate))
        .map((record) => buildScheduleRow(record, referenceDate))
        .sort((left, right) => {
            if (left.priority_rank !== right.priority_rank) {
                return left.priority_rank - right.priority_rank;
            }

            if (left.schedule_date !== right.schedule_date) {
                return left.schedule_date.localeCompare(right.schedule_date);
            }

            return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
        });

    const limitedQueue = typeof maxItems === 'number' ? queue.slice(0, maxItems) : queue;

    const summary = {
        total_records: matchedRecords.length,
        priority_items: limitedQueue.length,
        critical_count: limitedQueue.filter((row) => row.priority_rank === 0).length,
        high_count: limitedQueue.filter((row) => row.priority_rank === 1 || row.priority_rank === 2).length,
        watch_count: limitedQueue.filter((row) => row.priority_rank >= 3).length,
        ready_to_publish_count: matchedRecords.filter((record) => record.delivery_state === 'ready_to_publish').length,
        failed_count: matchedRecords.filter((record) => record.delivery_state === 'failed').length,
        retry_due_count: matchedRecords.filter((record) => isRetryDue(record, referenceDate)).length
    };

    return buildSuccess({
        reference_date: referenceDate,
        priority_scope: scope,
        summary,
        priority_queue: limitedQueue,
        priority_text: buildScheduleText(referenceDate, summary, [{ schedule_date: referenceDate, window_label: 'priority_queue', item_count: limitedQueue.length, items: limitedQueue }])
    }, {
        report_type: 'delivery_queue_priority',
        degraded: false,
        matched_records: matchedRecords.length
    });
}

module.exports = {
    generateDeliveryQueueSchedule,
    prioritizePendingDeliveryActions
};
