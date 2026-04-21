const {
    CALENDAR_EVENT_TYPES,
    DEFAULT_CALENDAR_EVENT_TYPE,
    DEFAULT_CALENDAR_SURFACE,
    DEFAULT_CALENDAR_TIMEZONE
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { buildCalendarEventDescription, buildCalendarEventTitle } = require('./calendarEventTemplates');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeLookup,
    nowIso,
    optionalDate,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const ALLOWED_SYNC_PROJECT_STATUSES = Object.freeze([
    'quoted',
    'confirmed',
    'preparing',
    'shooting',
    'editing',
    'reviewing',
    'delivered',
    'completed'
]);

const DEFAULT_EVENT_TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

function normalizeEventTime(value, fieldName) {
    const normalized = optionalString(value, fieldName);
    if (!normalized) {
        return null;
    }

    if (!DEFAULT_EVENT_TIME_PATTERN.test(normalized)) {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be in HH:mm or HH:mm:ss format.`, {
            field: fieldName,
            value: normalized
        });
    }

    return normalized;
}

function deriveEventDate(project, eventType) {
    if (eventType === 'follow_up' || eventType === 'deadline') {
        return project.due_date || project.start_date || null;
    }

    return project.start_date || project.due_date || null;
}

function summarizeCalendarEvent(record, isNew) {
    return {
        calendar_event_id: record.calendar_event_id,
        project_id: record.project_id,
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        project_name: record.project_name,
        project_type: record.project_type,
        project_status: record.project_status,
        event_type: record.event_type,
        event_key: record.event_key,
        event_title: record.event_title,
        event_date: record.event_date,
        event_time: record.event_time,
        timezone: record.timezone,
        calendar_surface: record.calendar_surface,
        sync_state: record.sync_state,
        created_at: record.created_at,
        is_new: isNew
    };
}

async function syncCalendarEvent(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const eventType = requireEnum(input.event_type || DEFAULT_CALENDAR_EVENT_TYPE, 'event_type', CALENDAR_EVENT_TYPES);
    const explicitEventKey = optionalString(input.event_key, 'event_key');
    const explicitEventDate = optionalDate(input.event_date, 'event_date');
    const explicitEventTime = normalizeEventTime(input.event_time, 'event_time');
    const explicitSurface = optionalString(input.calendar_surface, 'calendar_surface');
    const explicitTimezone = optionalString(input.timezone, 'timezone');
    const explicitTitle = optionalString(input.event_title, 'event_title');
    const note = optionalString(input.note, 'note');

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        if (!ALLOWED_SYNC_PROJECT_STATUSES.includes(project.status)) {
            throw new PhotoStudioError(
                'CONFLICT',
                `sync_calendar_event requires project status to be quoted or later, received ${project.status}.`,
                {
                    field: 'project_id',
                    project_status: project.status,
                    allowed_statuses: ALLOWED_SYNC_PROJECT_STATUSES
                }
            );
        }

        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === project.customer_id) || null;
        const calendarCollection = await readCollection('calendarEvents', dataDir);
        const calendarSurface = explicitSurface || DEFAULT_CALENDAR_SURFACE;
        const eventKey = explicitEventKey || eventType;
        const existing = calendarCollection.records.find((record) => (
            record.project_id === projectId
            && record.calendar_surface === calendarSurface
            && record.event_key === eventKey
        )) || null;

        if (existing && existing.event_type !== eventType) {
            throw new PhotoStudioError('CONFLICT', 'event_key already exists for a different event_type on the same project.', {
                field: 'event_type',
                project_id: projectId,
                event_key: eventKey,
                existing_event_type: existing.event_type,
                requested_event_type: eventType
            });
        }

        const resolvedEventDate = explicitEventDate
            || (existing && existing.event_date)
            || deriveEventDate(project, eventType);

        if (!resolvedEventDate) {
            throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'event_date is required when the project has no usable date.', {
                field: 'event_date',
                project_id: projectId
            });
        }

        const timezone = explicitTimezone || (existing && existing.timezone) || DEFAULT_CALENDAR_TIMEZONE;
        const eventTime = explicitEventTime || (existing && existing.event_time) || null;
        const customerName = customer && customer.customer_name ? customer.customer_name : '[客户姓名]';
        const resolvedTitle = explicitTitle
            || (existing && existing.event_title)
            || buildCalendarEventTitle({
                eventType,
                projectName: project.project_name,
                customTitle: null
            });
        const eventDescription = buildCalendarEventDescription({
            customerName,
            eventDate: resolvedEventDate,
            eventTime,
            eventType,
            note,
            project,
            timezone
        });
        const timestamp = nowIso();
        const calendarRecord = {
            calendar_event_id: existing ? existing.calendar_event_id : generateRecordId('calendar'),
            project_id: project.project_id,
            customer_id: project.customer_id,
            customer_name: customerName,
            project_name: project.project_name,
            project_type: project.project_type,
            project_status: project.status,
            event_type: eventType,
            event_key: eventKey,
            event_title: resolvedTitle,
            event_description: eventDescription,
            event_date: resolvedEventDate,
            event_time: eventTime,
            timezone,
            calendar_surface: calendarSurface,
            sync_state: 'local_shadow',
            note,
            created_at: existing ? existing.created_at : timestamp,
            updated_at: timestamp,
            normalized_project_name: normalizeLookup(project.project_name)
        };

        if (existing) {
            const existingIndex = calendarCollection.records.findIndex((record) => (
                record.project_id === projectId
                && record.calendar_surface === calendarSurface
                && record.event_key === eventKey
            ));
            calendarCollection.records[existingIndex] = calendarRecord;
        } else {
            calendarCollection.records.push(calendarRecord);
        }

        await writeCollection('calendarEvents', calendarCollection.records, dataDir);

        return buildSuccess(summarizeCalendarEvent(calendarRecord, !existing), {
            entity: 'calendar_event',
            data_dir: dataDir,
            degraded: !customer,
            duplicate: Boolean(existing),
            project_status: project.status,
            calendar_surface: calendarSurface,
            sync_mode: 'local_shadow'
        });
    });
}

module.exports = {
    ALLOWED_SYNC_PROJECT_STATUSES,
    syncCalendarEvent
};
