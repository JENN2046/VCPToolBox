const {
    DEFAULT_REMINDER_STATUS,
    REMINDER_TYPES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    nowIso,
    optionalDate,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const REMINDER_TYPE_RULES = Object.freeze({
    quotation_followup: Object.freeze({
        allowedStatuses: ['quoted'],
        fallbackDateField: 'start_date',
        offsetDays: 2
    }),
    delivery_followup: Object.freeze({
        allowedStatuses: ['delivered', 'completed'],
        fallbackDateField: 'due_date',
        offsetDays: 3
    }),
    revisit: Object.freeze({
        allowedStatuses: ['completed', 'archived'],
        fallbackDateField: 'due_date',
        offsetDays: 30
    })
});

function addDays(dateString, offsetDays) {
    const baseDate = new Date(`${dateString}T00:00:00.000Z`);
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    return baseDate.toISOString().slice(0, 10);
}

function summarizeReminder(reminder, isNew) {
    return {
        reminder_id: reminder.reminder_id,
        project_id: reminder.project_id,
        customer_id: reminder.customer_id,
        reminder_type: reminder.reminder_type,
        due_date: reminder.due_date,
        status: reminder.status,
        note: reminder.note,
        created_at: reminder.created_at,
        is_new: isNew
    };
}

function resolveDefaultDueDate(project, reminderType) {
    const rule = REMINDER_TYPE_RULES[reminderType];
    const fallbackValue = rule.fallbackDateField ? project[rule.fallbackDateField] : null;

    if (fallbackValue) {
        if (reminderType === 'revisit') {
            return addDays(fallbackValue, rule.offsetDays);
        }

        return fallbackValue;
    }

    return addDays(nowIso().slice(0, 10), rule.offsetDays);
}

function assertReminderTypeAllowedForProject(project, reminderType) {
    const rule = REMINDER_TYPE_RULES[reminderType];
    if (rule.allowedStatuses.includes(project.status)) {
        return;
    }

    throw new PhotoStudioError(
        'CONFLICT',
        `create_followup_reminder requires project status ${rule.allowedStatuses.join(' or ')} for ${reminderType}, received ${project.status}.`,
        {
            field: 'project_id',
            reminder_type: reminderType,
            project_status: project.status,
            allowed_statuses: rule.allowedStatuses
        }
    );
}

async function createFollowupReminder(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const reminderType = requireEnum(input.reminder_type, 'reminder_type', REMINDER_TYPES);
    const explicitDueDate = optionalDate(input.due_date, 'due_date');
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

        assertReminderTypeAllowedForProject(project, reminderType);

        const reminderCollection = await readCollection('reminders', dataDir);
        const existingReminder = reminderCollection.records.find((record) =>
            record.project_id === projectId
            && record.reminder_type === reminderType
            && record.status === DEFAULT_REMINDER_STATUS
        );

        if (existingReminder) {
            return buildSuccess(summarizeReminder(existingReminder, false), {
                entity: 'followup_reminder',
                data_dir: dataDir,
                duplicate: true,
                project_status: project.status
            });
        }

        const timestamp = nowIso();
        const reminderRecord = {
            reminder_id: generateRecordId('rem'),
            project_id: project.project_id,
            customer_id: project.customer_id,
            reminder_type: reminderType,
            due_date: explicitDueDate || resolveDefaultDueDate(project, reminderType),
            status: DEFAULT_REMINDER_STATUS,
            note,
            created_at: timestamp,
            updated_at: timestamp
        };

        reminderCollection.records.push(reminderRecord);
        await writeCollection('reminders', reminderCollection.records, dataDir);

        return buildSuccess(summarizeReminder(reminderRecord, true), {
            entity: 'followup_reminder',
            data_dir: dataDir,
            duplicate: false,
            project_status: project.status
        });
    });
}

module.exports = {
    REMINDER_TYPE_RULES,
    createFollowupReminder
};
