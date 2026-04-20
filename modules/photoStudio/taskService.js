const {
    DEFAULT_TASK_STATUS,
    TASK_STATUSES,
    TASK_TEMPLATE_NAMES,
    TASK_TYPES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    nowIso,
    optionalBoolean,
    optionalDate,
    optionalObjectArray,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const TASK_TEMPLATES = Object.freeze({
    wedding_standard: [
        { task_name: 'Confirm wedding timeline', task_type: 'communication', sort_order: 1 },
        { task_name: 'Prepare shot list', task_type: 'shooting', sort_order: 2 },
        { task_name: 'Execute wedding shoot', task_type: 'shooting', sort_order: 3 },
        { task_name: 'Select hero frames', task_type: 'review', sort_order: 4 },
        { task_name: 'Edit final gallery', task_type: 'editing', sort_order: 5 },
        { task_name: 'Deliver wedding package', task_type: 'delivery', sort_order: 6 }
    ],
    portrait_basic: [
        { task_name: 'Confirm portrait brief', task_type: 'communication', sort_order: 1 },
        { task_name: 'Prepare styling notes', task_type: 'other', sort_order: 2 },
        { task_name: 'Run portrait session', task_type: 'shooting', sort_order: 3 },
        { task_name: 'Edit selects', task_type: 'editing', sort_order: 4 },
        { task_name: 'Deliver portrait set', task_type: 'delivery', sort_order: 5 }
    ],
    commercial_standard: [
        { task_name: 'Confirm commercial scope', task_type: 'communication', sort_order: 1 },
        { task_name: 'Build production checklist', task_type: 'other', sort_order: 2 },
        { task_name: 'Execute production shoot', task_type: 'shooting', sort_order: 3 },
        { task_name: 'Review internal selects', task_type: 'review', sort_order: 4 },
        { task_name: 'Edit approved assets', task_type: 'editing', sort_order: 5 },
        { task_name: 'Deliver commercial assets', task_type: 'delivery', sort_order: 6 }
    ],
    event_basic: [
        { task_name: 'Confirm event rundown', task_type: 'communication', sort_order: 1 },
        { task_name: 'Capture event coverage', task_type: 'shooting', sort_order: 2 },
        { task_name: 'Edit highlight set', task_type: 'editing', sort_order: 3 },
        { task_name: 'Deliver event gallery', task_type: 'delivery', sort_order: 4 }
    ]
});

const DEFAULT_TEMPLATE_BY_PROJECT_TYPE = Object.freeze({
    wedding: 'wedding_standard',
    portrait: 'portrait_basic',
    commercial: 'commercial_standard',
    event: 'event_basic',
    other: 'portrait_basic'
});

function summarizeTask(task) {
    return {
        task_id: task.task_id,
        task_name: task.task_name,
        task_type: task.task_type,
        status: task.status,
        sort_order: task.sort_order,
        due_date: task.due_date,
        assignee: task.assignee
    };
}

function resolveTemplateName(projectType, explicitTemplate) {
    if (explicitTemplate) {
        return requireEnum(explicitTemplate, 'task_template', TASK_TEMPLATE_NAMES);
    }

    return DEFAULT_TEMPLATE_BY_PROJECT_TYPE[projectType];
}

function buildTaskRecord(project, draftTask, index) {
    const timestamp = nowIso();

    return {
        task_id: generateRecordId('task'),
        project_id: project.project_id,
        task_name: requireString(draftTask.task_name, 'task_name'),
        task_type: requireEnum(draftTask.task_type, 'task_type', TASK_TYPES),
        status: DEFAULT_TASK_STATUS,
        assignee: optionalString(draftTask.assignee, 'assignee'),
        due_date: optionalDate(draftTask.due_date || project.due_date, 'due_date'),
        sort_order: Number.isFinite(draftTask.sort_order) ? draftTask.sort_order : index + 1,
        remark: optionalString(draftTask.remark, 'remark'),
        created_at: timestamp,
        updated_at: timestamp
    };
}

function buildTaskDrafts(project, input) {
    const customTasks = optionalObjectArray(input.tasks, 'tasks');
    const explicitTemplate = optionalString(input.task_template, 'task_template');

    if (explicitTemplate && customTasks.length > 0) {
        throw new PhotoStudioError('INVALID_INPUT', 'task_template and tasks cannot be used together.', {
            field: 'task_template'
        });
    }

    if (customTasks.length > 0) {
        return customTasks.map((task, index) => ({
            task_name: task.task_name,
            task_type: task.task_type,
            sort_order: typeof task.sort_order === 'number' ? task.sort_order : index + 1,
            due_date: task.due_date,
            assignee: task.assignee,
            remark: task.remark
        }));
    }

    const templateName = resolveTemplateName(project.project_type, explicitTemplate);
    return TASK_TEMPLATES[templateName].map((task) => ({
        ...task,
        due_date: project.due_date,
        assignee: null,
        remark: null
    }));
}

async function createProjectTasks(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const overrideExisting = optionalBoolean(input.override_existing, 'override_existing');

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        const taskDrafts = buildTaskDrafts(project, input);
        const taskCollection = await readCollection('tasks', dataDir);
        const existingTasks = taskCollection.records.filter((task) => task.project_id === projectId);

        if (existingTasks.length > 0 && !overrideExisting) {
            return buildSuccess({
                project_id: projectId,
                created_tasks: [],
                created_count: 0,
                skipped_count: existingTasks.length,
                message: 'Existing tasks already cover this project.'
            }, {
                entity: 'project_tasks',
                data_dir: dataDir
            });
        }

        const remainingTasks = overrideExisting
            ? taskCollection.records.filter((task) => task.project_id !== projectId)
            : taskCollection.records.slice();
        const createdTasks = taskDrafts.map((task, index) => buildTaskRecord(project, task, index));

        remainingTasks.push(...createdTasks);
        await writeCollection('tasks', remainingTasks, dataDir);

        return buildSuccess({
            project_id: projectId,
            created_tasks: createdTasks.map(summarizeTask),
            created_count: createdTasks.length,
            skipped_count: 0
        }, {
            entity: 'project_tasks',
            data_dir: dataDir
        });
    });
}

module.exports = {
    createProjectTasks
};
