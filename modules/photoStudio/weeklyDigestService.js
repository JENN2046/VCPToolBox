const {
    PROJECT_STATUSES,
    PROJECT_TYPES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock } = require('./store');
const { buildWeeklyProjectDigestText } = require('./weeklyDigestTemplates');
const {
    optionalDate,
    optionalString
} = require('./utils');

const CLOSED_STATUSES = new Set(['completed', 'archived', 'cancelled']);
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

function diffInDays(targetDateString, referenceDateString) {
    const target = toUtcDayStart(targetDateString);
    const reference = toUtcDayStart(referenceDateString);
    return Math.round((target.getTime() - reference.getTime()) / DAY_MS);
}

function buildStatusCountMap(projects) {
    const counts = {};

    PROJECT_STATUSES.forEach((status) => {
        counts[status] = 0;
    });

    projects.forEach((project) => {
        if (Object.prototype.hasOwnProperty.call(counts, project.status)) {
            counts[project.status] += 1;
        }
    });

    return counts;
}

function buildTypeCountMap(projects) {
    const counts = {};

    PROJECT_TYPES.forEach((type) => {
        counts[type] = 0;
    });

    projects.forEach((project) => {
        if (Object.prototype.hasOwnProperty.call(counts, project.project_type)) {
            counts[project.project_type] += 1;
        }
    });

    return counts;
}

function buildProjectDigestRows(projects, customerMap, referenceDate, upcomingDays) {
    const rows = projects.map((project) => {
        const customer = customerMap.get(project.customer_id) || null;
        const customerName = customer && customer.customer_name ? customer.customer_name : '[客户姓名]';
        const hasCustomer = Boolean(customer);
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
            start_date: project.start_date,
            due_date: project.due_date,
            days_until_due: daysUntilDue,
            attention_state: attentionState,
            has_customer: hasCustomer,
            has_due_date: hasDueDate
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

function buildRecentTransitions(statusLogRecords, projectMap, customerMap, windowStart, windowEnd) {
    return statusLogRecords
        .filter((record) => record.transition_time >= `${windowStart}T00:00:00.000Z`
            && record.transition_time <= `${windowEnd}T23:59:59.999Z`)
        .map((record) => {
            const project = projectMap.get(record.project_id) || null;
            const customer = project ? customerMap.get(project.customer_id) || null : null;

            return {
                status_log_id: record.status_log_id,
                project_id: record.project_id,
                project_name: project ? project.project_name : null,
                customer_id: project ? project.customer_id : null,
                customer_name: customer && customer.customer_name ? customer.customer_name : '[客户姓名]',
                previous_status: record.previous_status,
                new_status: record.new_status,
                transition_time: record.transition_time,
                remark: record.remark || null
            };
        })
        .sort((left, right) => right.transition_time.localeCompare(left.transition_time));
}

async function generateWeeklyProjectDigest(input) {
    const referenceDate = resolveReferenceDate(optionalString(input.reference_date, 'reference_date'));
    const lookbackDays = parsePositiveInteger(input.lookback_days, 'lookback_days', 7);
    const upcomingDays = parsePositiveInteger(input.upcoming_days, 'upcoming_days', 14);

    const windowStart = addDays(referenceDate, -(lookbackDays - 1));
    const windowEnd = referenceDate;
    const upcomingWindowEnd = addDays(referenceDate, upcomingDays);

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const customerCollection = await readCollection('customers', dataDir);
        const statusLogCollection = await readCollection('statusLog', dataDir);

        const customerMap = new Map(customerCollection.records.map((record) => [record.customer_id, record]));
        const projectMap = new Map(projectCollection.records.map((record) => [record.project_id, record]));
        const projectRows = buildProjectDigestRows(projectCollection.records, customerMap, referenceDate, upcomingDays);
        const statusCounts = buildStatusCountMap(projectCollection.records);
        const typeCounts = buildTypeCountMap(projectCollection.records);

        const overdueProjects = projectRows.filter((project) => project.attention_state === 'overdue');
        const upcomingDueProjects = projectRows.filter((project) => project.attention_state === 'due_soon');
        const recentTransitions = buildRecentTransitions(statusLogCollection.records, projectMap, customerMap, windowStart, windowEnd);

        const dataQuality = {
            missing_due_date_count: projectRows.filter((project) => project.attention_state === 'missing_due_date').length,
            missing_customer_count: projectRows.filter((project) => !project.has_customer).length,
            missing_project_reference_count: recentTransitions.filter((transition) => !transition.project_name).length
        };

        const activeProjects = projectRows.filter((project) => !CLOSED_STATUSES.has(project.status));
        const summary = {
            total_projects: projectRows.length,
            active_projects: activeProjects.length,
            closed_projects: projectRows.length - activeProjects.length,
            overdue_projects: overdueProjects.length,
            due_soon_projects: upcomingDueProjects.length,
            recent_transition_count: recentTransitions.length
        };

        const digestText = buildWeeklyProjectDigestText({
            referenceDate,
            windowStart,
            windowEnd,
            summary,
            statusCounts,
            typeCounts,
            overdueProjects,
            upcomingDueProjects,
            recentTransitions,
            dataQuality
        });

        return buildSuccess({
            digest_label: 'weekly_project_digest',
            reference_date: referenceDate,
            lookback_days: lookbackDays,
            upcoming_days: upcomingDays,
            generated_at: `${referenceDate}T23:59:59.999Z`,
            window_start: windowStart,
            window_end: windowEnd,
            summary,
            status_counts: statusCounts,
            project_type_counts: typeCounts,
            overdue_projects: overdueProjects,
            upcoming_due_projects: upcomingDueProjects,
            recent_transitions: recentTransitions,
            data_quality: dataQuality,
            digest_text: digestText,
            project_rows: projectRows
        }, {
            entity: 'weekly_project_digest',
            data_dir: dataDir,
            lookback_days: lookbackDays,
            upcoming_days: upcomingDays,
            degraded: dataQuality.missing_due_date_count > 0
                || dataQuality.missing_customer_count > 0
                || dataQuality.missing_project_reference_count > 0
        });
    });
}

module.exports = {
    generateWeeklyProjectDigest
};
