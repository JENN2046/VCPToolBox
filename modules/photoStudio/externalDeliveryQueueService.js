const {
    DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS,
    EXTERNAL_DELIVERY_QUEUE_ACTIONS
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { buildExternalSyncText } = require('./externalSyncTemplates');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    nowIso,
    optionalDate,
    optionalString,
    requireEnum
} = require('./utils');

const QUEUEABLE_STATES = new Set([
    'ready_to_publish',
    'queued',
    'retry_scheduled',
    'failed'
]);

const LIST_PRIORITY = {
    failed: 0,
    retry_scheduled: 1,
    ready_to_publish: 2,
    queued: 3
};

function parsePositiveInteger(value, fieldName, defaultValue) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    const numericValue = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a positive integer.`, {
            field: fieldName,
            value
        });
    }

    return numericValue;
}

function resolveReferenceDate(value) {
    if (value === null || value === undefined || value === '') {
        return new Date().toISOString().slice(0, 10);
    }

    return optionalDate(value, 'reference_date');
}

function toUtcDayStart(dateString) {
    return new Date(`${dateString}T00:00:00.000Z`);
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
    const date = toUtcDayStart(dateString);
    date.setUTCDate(date.getUTCDate() + days);
    return toIsoDate(date);
}

function resolveExportIdentifier(records, input) {
    const externalExportId = optionalString(input.external_export_id, 'external_export_id');
    const exportKey = optionalString(input.export_key, 'export_key');

    if (!externalExportId && !exportKey) {
        throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'external_export_id or export_key is required.', {
            field: 'external_export_id'
        });
    }

    if (externalExportId) {
        const index = records.findIndex((record) => record.external_export_id === externalExportId);
        if (index >= 0) {
            return { index, record: records[index] };
        }
    }

    if (exportKey) {
        const index = records.findIndex((record) => record.export_key === exportKey);
        if (index >= 0) {
            return { index, record: records[index] };
        }
    }

    throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'Delivery queue record not found.', {
        field: externalExportId ? 'external_export_id' : 'export_key',
        external_export_id: externalExportId || null,
        export_key: exportKey || null
    });
}

function queueBucket(record, referenceDate) {
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

function nextActionHint(record, referenceDate) {
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

function isDueNow(record, referenceDate) {
    if (record.delivery_state === 'ready_to_publish' || record.delivery_state === 'queued') {
        return true;
    }

    if (record.delivery_state === 'failed') {
        return true;
    }

    if (record.delivery_state === 'retry_scheduled') {
        return !record.retry_after_date || record.retry_after_date <= referenceDate;
    }

    return false;
}

function buildQueueItem(record, referenceDate) {
    const retryAfterDate = record.retry_after_date || null;
    const bucket = queueBucket(record, referenceDate);

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
        retry_after_date: retryAfterDate,
        delivery_channel: record.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
        export_row_count: record.export_row_count,
        updated_at: record.updated_at,
        queue_bucket: bucket,
        due_now: isDueNow(record, referenceDate),
        next_action: nextActionHint(record, referenceDate),
        note: record.note || null
    };
}

function buildQueueSummary(records, referenceDate) {
    const queueableRecords = records.filter((record) => QUEUEABLE_STATES.has(record.delivery_state));
    return {
        total_records: records.length,
        queueable_records: queueableRecords.length,
        ready_to_publish_count: records.filter((record) => record.delivery_state === 'ready_to_publish').length,
        queued_count: records.filter((record) => record.delivery_state === 'queued').length,
        retry_scheduled_count: records.filter((record) => record.delivery_state === 'retry_scheduled').length,
        failed_count: records.filter((record) => record.delivery_state === 'failed').length,
        due_now_count: queueableRecords.filter((record) => isDueNow(record, referenceDate)).length
    };
}

function rebuildExportText(record) {
    return buildExternalSyncText({
        targetType: record.target_type,
        targetName: record.target_name,
        exportScope: record.export_scope,
        projectId: record.project_id,
        referenceDate: record.reference_date,
        upcomingDays: record.upcoming_days,
        summary: record.export_summary,
        exportRows: record.export_rows,
        deliveryState: record.delivery_state,
        deliveryAttempts: record.delivery_attempts,
        deliveryReceiptId: record.delivery_receipt_id,
        retryAfterDate: record.retry_after_date,
        deliveryError: record.delivery_error,
        note: record.note
    });
}

function normalizeUpdatedRecord(record) {
    return {
        ...record,
        delivery_channel: record.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
        delivery_attempts: record.delivery_attempts || 1
    };
}

function updateRecordForAction(record, action, input, referenceDate) {
    const normalizedRecord = normalizeUpdatedRecord(record);
    const updatedAt = nowIso();

    if (action === 'mark_queued') {
        if (normalizedRecord.delivery_state === 'ready_to_publish') {
            return {
                record: {
                    ...normalizedRecord,
                    delivery_state: 'queued',
                    delivery_error: null,
                    delivery_acknowledged: false,
                    delivery_receipt_id: null,
                    retry_after_date: null,
                    updated_at: updatedAt,
                    export_text: rebuildExportText({
                        ...normalizedRecord,
                        delivery_state: 'queued',
                        delivery_error: null,
                        delivery_acknowledged: false,
                        delivery_receipt_id: null,
                        retry_after_date: null,
                        updated_at: updatedAt
                    })
                },
                duplicate: false,
                previous_delivery_state: normalizedRecord.delivery_state
            };
        }

        if (normalizedRecord.delivery_state === 'retry_scheduled') {
            return {
                record: {
                    ...normalizedRecord,
                    delivery_state: 'queued',
                    delivery_attempts: normalizedRecord.delivery_attempts + 1,
                    delivery_error: null,
                    delivery_acknowledged: false,
                    delivery_receipt_id: null,
                    retry_after_date: null,
                    updated_at: updatedAt,
                    export_text: rebuildExportText({
                        ...normalizedRecord,
                        delivery_state: 'queued',
                        delivery_attempts: normalizedRecord.delivery_attempts + 1,
                        delivery_error: null,
                        delivery_acknowledged: false,
                        delivery_receipt_id: null,
                        retry_after_date: null,
                        updated_at: updatedAt
                    })
                },
                duplicate: false,
                previous_delivery_state: normalizedRecord.delivery_state
            };
        }

        if (normalizedRecord.delivery_state === 'queued') {
            return {
                record: normalizedRecord,
                duplicate: true,
                previous_delivery_state: normalizedRecord.delivery_state
            };
        }

        throw new PhotoStudioError('INVALID_TRANSITION', `Cannot queue record from ${normalizedRecord.delivery_state}.`, {
            field: 'action',
            current_state: normalizedRecord.delivery_state,
            action
        });
    }

    if (action === 'mark_delivered') {
        const deliveryReceiptId = optionalString(input.delivery_receipt_id, 'delivery_receipt_id');
        if (!deliveryReceiptId) {
            throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'delivery_receipt_id is required to mark a record delivered.', {
                field: 'delivery_receipt_id'
            });
        }

        if (normalizedRecord.delivery_state !== 'queued' && normalizedRecord.delivery_state !== 'retry_scheduled') {
            if (normalizedRecord.delivery_state === 'delivered' && normalizedRecord.delivery_receipt_id === deliveryReceiptId) {
                return {
                    record: normalizedRecord,
                    duplicate: true,
                    previous_delivery_state: normalizedRecord.delivery_state
                };
            }

            throw new PhotoStudioError('INVALID_TRANSITION', `Cannot mark record delivered from ${normalizedRecord.delivery_state}.`, {
                field: 'action',
                current_state: normalizedRecord.delivery_state,
                action
            });
        }

        return {
            record: {
                ...normalizedRecord,
                delivery_state: 'delivered',
                delivery_acknowledged: true,
                delivery_receipt_id: deliveryReceiptId,
                delivery_error: null,
                retry_after_date: null,
                updated_at: updatedAt,
                export_text: rebuildExportText({
                    ...normalizedRecord,
                    delivery_state: 'delivered',
                    delivery_acknowledged: true,
                    delivery_receipt_id: deliveryReceiptId,
                    delivery_error: null,
                    retry_after_date: null,
                    updated_at: updatedAt
                })
            },
            duplicate: false,
            previous_delivery_state: normalizedRecord.delivery_state
        };
    }

    if (action === 'mark_failed') {
        const deliveryError = optionalString(input.delivery_error, 'delivery_error');
        if (!deliveryError) {
            throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'delivery_error is required to mark a record failed.', {
                field: 'delivery_error'
            });
        }

        if (normalizedRecord.delivery_state !== 'queued' && normalizedRecord.delivery_state !== 'retry_scheduled') {
            if (normalizedRecord.delivery_state === 'failed' && normalizedRecord.delivery_error === deliveryError) {
                return {
                    record: normalizedRecord,
                    duplicate: true,
                    previous_delivery_state: normalizedRecord.delivery_state
                };
            }

            throw new PhotoStudioError('INVALID_TRANSITION', `Cannot mark record failed from ${normalizedRecord.delivery_state}.`, {
                field: 'action',
                current_state: normalizedRecord.delivery_state,
                action
            });
        }

        return {
            record: {
                ...normalizedRecord,
                delivery_state: 'failed',
                delivery_acknowledged: false,
                delivery_receipt_id: null,
                delivery_error: deliveryError,
                retry_after_date: null,
                updated_at: updatedAt,
                export_text: rebuildExportText({
                    ...normalizedRecord,
                    delivery_state: 'failed',
                    delivery_acknowledged: false,
                    delivery_receipt_id: null,
                    delivery_error: deliveryError,
                    retry_after_date: null,
                    updated_at: updatedAt
                })
            },
            duplicate: false,
            previous_delivery_state: normalizedRecord.delivery_state
        };
    }

    if (action === 'reschedule_retry') {
        if (normalizedRecord.delivery_state !== 'failed') {
            if (normalizedRecord.delivery_state === 'retry_scheduled') {
                return {
                    record: normalizedRecord,
                    duplicate: true,
                    previous_delivery_state: normalizedRecord.delivery_state
                };
            }

            throw new PhotoStudioError('INVALID_TRANSITION', `Cannot reschedule retry from ${normalizedRecord.delivery_state}.`, {
                field: 'action',
                current_state: normalizedRecord.delivery_state,
                action
            });
        }

        const retryAfterDays = parsePositiveInteger(
            input.retry_after_days,
            'retry_after_days',
            normalizedRecord.retry_after_days || DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS
        );
        const retryAfterDate = addDays(referenceDate, retryAfterDays);
        const deliveryError = optionalString(input.delivery_error, 'delivery_error') || normalizedRecord.delivery_error;

        return {
            record: {
                ...normalizedRecord,
                delivery_state: 'retry_scheduled',
                retry_after_days: retryAfterDays,
                retry_after_date: retryAfterDate,
                delivery_error: deliveryError,
                delivery_acknowledged: false,
                delivery_receipt_id: null,
                updated_at: updatedAt,
                export_text: rebuildExportText({
                    ...normalizedRecord,
                    delivery_state: 'retry_scheduled',
                    retry_after_days: retryAfterDays,
                    retry_after_date: retryAfterDate,
                    delivery_error: deliveryError,
                    delivery_acknowledged: false,
                    delivery_receipt_id: null,
                    updated_at: updatedAt
                })
            },
            duplicate: false,
            previous_delivery_state: normalizedRecord.delivery_state
        };
    }

    throw new PhotoStudioError('UNKNOWN_ERROR', `Unsupported delivery queue action: ${action}.`, {
        field: 'action'
    });
}

async function processExternalDeliveryQueue(input) {
    const action = requireEnum(input.action || 'list_due', 'action', EXTERNAL_DELIVERY_QUEUE_ACTIONS);
    const referenceDate = resolveReferenceDate(optionalString(input.reference_date, 'reference_date'));
    const note = optionalString(input.note, 'note');

    return withStoreLock(async ({ dataDir }) => {
        const exportCollection = await readCollection('externalExports', dataDir);
        const queueableRecords = exportCollection.records.filter((record) => QUEUEABLE_STATES.has(record.delivery_state));

        if (action === 'list_due') {
            const queueItems = queueableRecords
                .map((record) => buildQueueItem(record, referenceDate))
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

            const queueSummary = buildQueueSummary(exportCollection.records, referenceDate);

            return buildSuccess({
                queue_action: action,
                reference_date: referenceDate,
                queue_summary: queueSummary,
                queue_items: queueItems,
                note
            }, {
                entity: 'external_delivery_queue',
                data_dir: dataDir,
                sync_mode: 'local_shadow',
                queue_action: action
            });
        }

        const { index, record } = resolveExportIdentifier(exportCollection.records, input);
        const result = updateRecordForAction(record, action, input, referenceDate);
        const updatedRecord = result.record;

        exportCollection.records[index] = updatedRecord;
        await writeCollection('externalExports', exportCollection.records, dataDir);

        return buildSuccess({
            queue_action: action,
            external_export_id: updatedRecord.external_export_id,
            export_key: updatedRecord.export_key,
            previous_delivery_state: result.previous_delivery_state,
            delivery_state: updatedRecord.delivery_state,
            delivery_attempts: updatedRecord.delivery_attempts,
            delivery_acknowledged: updatedRecord.delivery_acknowledged,
            delivery_receipt_id: updatedRecord.delivery_receipt_id,
            delivery_error: updatedRecord.delivery_error,
            retry_after_days: updatedRecord.retry_after_days,
            retry_after_date: updatedRecord.retry_after_date,
            delivery_channel: updatedRecord.delivery_channel || DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
            duplicate: result.duplicate,
            updated_at: updatedRecord.updated_at,
            note
        }, {
            entity: 'external_delivery_queue',
            data_dir: dataDir,
            sync_mode: 'local_shadow',
            queue_action: action,
            delivery_state: updatedRecord.delivery_state,
            delivery_attempts: updatedRecord.delivery_attempts,
            duplicate: result.duplicate
        });
    });
}

module.exports = {
    processExternalDeliveryQueue
};
