const {
    DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
    DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS,
    DEFAULT_EXTERNAL_DELIVERY_STATE,
    DEFAULT_EXTERNAL_SYNC_SURFACE,
    DEFAULT_EXTERNAL_SYNC_TARGET_NAME,
    DEFAULT_EXTERNAL_SYNC_TARGET_TYPE,
    EXTERNAL_DELIVERY_STATES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { buildExternalSyncText } = require('./externalSyncTemplates');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeLookup,
    nowIso,
    optionalDate,
    optionalString,
    requireEnum
} = require('./utils');

const EXTERNAL_SYNC_TARGET_TYPES = Object.freeze([
    'sheet',
    'notion'
]);

const CLOSED_STATUSES = new Set([
    'completed',
    'archived',
    'cancelled'
]);

const DAY_MS = 24 * 60 * 60 * 1000;

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

function parseOptionalBoolean(value, fieldName, defaultValue) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    if (typeof value !== 'boolean') {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a boolean.`, {
            field: fieldName,
            value
        });
    }

    return value;
}

function parseOptionalDeliveryAttempts(value, fieldName, defaultValue) {
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

function resolveRetryAfterDate(referenceDate, retryAfterDays, deliveryState) {
    if (deliveryState !== 'retry_scheduled') {
        return null;
    }

    return addDays(referenceDate, retryAfterDays);
}

function diffInDays(targetDateString, referenceDateString) {
    const target = toUtcDayStart(targetDateString);
    const reference = toUtcDayStart(referenceDateString);
    return Math.round((target.getTime() - reference.getTime()) / DAY_MS);
}

function buildExportRows(projects, customerMap, referenceDate, upcomingDays, targetType, targetName) {
    const rows = projects.map((project) => {
        const customer = customerMap.get(project.customer_id) || null;
        const customerName = customer && customer.customer_name ? customer.customer_name : '[瀹㈡埛濮撳悕]';
        const hasDueDate = Boolean(project.due_date);
        const isClosed = CLOSED_STATUSES.has(project.status);
        const daysUntilDue = hasDueDate ? diffInDays(project.due_date, referenceDate) : null;
        let attentionState = 'on_track';

        if (!hasDueDate && !isClosed) {
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
            start_date: project.start_date || null,
            due_date: project.due_date || null,
            budget: project.budget ?? null,
            days_until_due: daysUntilDue,
            attention_state: attentionState,
            target_type: targetType,
            target_name: targetName,
            export_surface: DEFAULT_EXTERNAL_SYNC_SURFACE,
            sync_state: 'local_shadow'
        };
    });

    return rows.sort((left, right) => {
        const leftSortDate = left.due_date || '9999-12-31';
        const rightSortDate = right.due_date || '9999-12-31';

        if (leftSortDate !== rightSortDate) {
            return leftSortDate.localeCompare(rightSortDate);
        }

        return left.project_name.localeCompare(right.project_name);
    });
}

function summarizeExportRows(exportRows) {
    const activeProjects = exportRows.filter((project) => !CLOSED_STATUSES.has(project.status));

    return {
        total_projects: exportRows.length,
        active_projects: activeProjects.length,
        closed_projects: exportRows.length - activeProjects.length,
        overdue_projects: exportRows.filter((project) => project.attention_state === 'overdue').length,
        due_soon_projects: exportRows.filter((project) => project.attention_state === 'due_soon').length,
        missing_due_date_count: exportRows.filter((project) => project.attention_state === 'missing_due_date').length,
        missing_customer_count: exportRows.filter((project) => project.customer_name === '[瀹㈡埛濮撳悕]').length
    };
}

function buildExportRecordSummary(record, isNew) {
    return {
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
        retry_after_date: record.retry_after_date,
        delivery_channel: record.delivery_channel,
        retry_after_days: record.retry_after_days,
        export_row_count: record.export_row_count,
        export_summary: record.export_summary,
        export_rows: record.export_rows,
        export_text: record.export_text,
        export_surface: record.export_surface,
        sync_state: record.sync_state,
        note: record.note,
        created_at: record.created_at,
        updated_at: record.updated_at,
        is_new: isNew
    };
}

async function syncToExternalSheetOrNotion(input) {
    const targetType = requireEnum(input.target_type || DEFAULT_EXTERNAL_SYNC_TARGET_TYPE, 'target_type', EXTERNAL_SYNC_TARGET_TYPES);
    const targetName = optionalString(input.target_name, 'target_name') || DEFAULT_EXTERNAL_SYNC_TARGET_NAME;
    const requestedProjectId = optionalString(input.project_id, 'project_id');
    const referenceDate = resolveReferenceDate(optionalString(input.reference_date, 'reference_date'));
    const upcomingDays = parsePositiveInteger(input.upcoming_days, 'upcoming_days', 14);
    const includeClosedProjects = parseOptionalBoolean(input.include_closed_projects, 'include_closed_projects', true);
    const deliveryState = requireEnum(input.delivery_state || DEFAULT_EXTERNAL_DELIVERY_STATE, 'delivery_state', EXTERNAL_DELIVERY_STATES);
    const deliveryAttempts = parseOptionalDeliveryAttempts(
        input.delivery_attempts,
        'delivery_attempts',
        input.delivery_state ? 1 : 1
    );
    const deliveryReceiptId = optionalString(input.delivery_receipt_id, 'delivery_receipt_id');
    const deliveryError = optionalString(input.delivery_error, 'delivery_error');
    const deliveryAcknowledged = parseOptionalBoolean(
        input.delivery_acknowledged,
        'delivery_acknowledged',
        deliveryState === 'delivered'
    );
    const retryAfterDays = parsePositiveInteger(
        input.retry_after_days,
        'retry_after_days',
        DEFAULT_EXTERNAL_DELIVERY_RETRY_AFTER_DAYS
    );
    const note = optionalString(input.note, 'note');

    if ((deliveryState === 'failed' || deliveryState === 'retry_scheduled') && !deliveryError) {
        throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'delivery_error is required when delivery_state indicates a failure or retry.', {
            field: 'delivery_error'
        });
    }

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const customerCollection = await readCollection('customers', dataDir);
        const exportCollection = await readCollection('externalExports', dataDir);
        const customerMap = new Map(customerCollection.records.map((record) => [record.customer_id, record]));
        const exportScope = requestedProjectId ? 'single_project' : 'all_projects';
        const projectRecords = requestedProjectId
            ? projectCollection.records.filter((record) => record.project_id === requestedProjectId)
            : projectCollection.records;

        if (requestedProjectId && projectRecords.length === 0) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: requestedProjectId
            });
        }

        const exportSourceRecords = includeClosedProjects
            ? projectRecords
            : projectRecords.filter((record) => !CLOSED_STATUSES.has(record.status));
        const exportRows = buildExportRows(exportSourceRecords, customerMap, referenceDate, upcomingDays, targetType, targetName);
        const summary = summarizeExportRows(exportRows);
        const exportKey = [
            'sync_to_external_sheet_or_notion',
            targetType,
            normalizeLookup(targetName),
            exportScope,
            requestedProjectId || 'all',
            includeClosedProjects ? 'include_closed' : 'active_only'
        ].join(':');
        const existing = exportCollection.records.find((record) => record.export_key === exportKey) || null;
        const timestamp = nowIso();
        const hasExplicitDeliveryAttempts = input.delivery_attempts !== undefined
            && input.delivery_attempts !== null
            && input.delivery_attempts !== '';
        const resolvedDeliveryAttempts = existing && !hasExplicitDeliveryAttempts
            ? existing.delivery_attempts
            : deliveryAttempts;
        const retryAfterDate = resolveRetryAfterDate(referenceDate, retryAfterDays, deliveryState);
        const exportText = buildExternalSyncText({
            targetType,
            targetName,
            exportScope,
            projectId: requestedProjectId,
            referenceDate,
            upcomingDays,
            summary,
            exportRows,
            deliveryState,
            deliveryAttempts: resolvedDeliveryAttempts,
            deliveryReceiptId,
            retryAfterDate,
            deliveryError,
            note
        });
        const exportRecord = {
            external_export_id: existing ? existing.external_export_id : generateRecordId('export'),
            export_key: exportKey,
            target_type: targetType,
            target_name: targetName,
            export_scope: exportScope,
            project_id: requestedProjectId,
            reference_date: referenceDate,
            upcoming_days: upcomingDays,
            include_closed_projects: includeClosedProjects,
            delivery_state: deliveryState,
            delivery_attempts: resolvedDeliveryAttempts,
            delivery_acknowledged: deliveryAcknowledged,
            delivery_receipt_id: deliveryReceiptId,
            delivery_error: deliveryError,
            retry_after_days: retryAfterDays,
            retry_after_date: retryAfterDate,
            delivery_channel: DEFAULT_EXTERNAL_DELIVERY_CHANNEL,
            export_row_count: exportRows.length,
            export_summary: summary,
            export_rows: exportRows,
            export_text: exportText,
            export_surface: DEFAULT_EXTERNAL_SYNC_SURFACE,
            sync_state: 'local_shadow',
            note,
            created_at: existing ? existing.created_at : timestamp,
            updated_at: timestamp,
            normalized_target_name: normalizeLookup(targetName)
        };

        if (existing) {
            const existingIndex = exportCollection.records.findIndex((record) => record.export_key === exportKey);
            exportCollection.records[existingIndex] = exportRecord;
        } else {
            exportCollection.records.push(exportRecord);
        }

        await writeCollection('externalExports', exportCollection.records, dataDir);

        return buildSuccess(buildExportRecordSummary(exportRecord, !existing), {
            entity: 'external_project_export',
            data_dir: dataDir,
            target_type: targetType,
            target_name: targetName,
            export_scope: exportScope,
            duplicate: Boolean(existing),
            sync_mode: 'local_shadow',
            delivery_state: deliveryState,
            delivery_attempts: resolvedDeliveryAttempts,
            degraded: summary.missing_customer_count > 0
                || summary.missing_due_date_count > 0
                || deliveryState === 'failed'
                || deliveryState === 'retry_scheduled'
        });
    });
}

module.exports = {
    EXTERNAL_SYNC_TARGET_TYPES,
    syncToExternalSheetOrNotion
};
