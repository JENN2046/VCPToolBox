const {
    DEFAULT_TASK_STATUS,
    TASK_TYPES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    nowIso,
    optionalBoolean,
    optionalDate,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const ALLOWED_DELIVERY_TASK_PROJECT_STATUSES = Object.freeze([
    'reviewing',
    'delivered',
    'completed'
]);

const DEFAULT_DELIVERY_MODE = 'digital delivery';
const DELIVERY_TASK_GROUP = 'delivery_stage';

const DELIVERY_TASK_TEMPLATES = Object.freeze({
    wedding: [
        { task_name: 'Finalize wedding gallery for delivery', task_type: 'review', sort_order: 1 },
        { task_name: 'Prepare wedding delivery package', task_type: 'delivery', sort_order: 2 },
        { task_name: 'Send wedding gallery handoff', task_type: 'communication', sort_order: 3 },
        { task_name: 'Confirm wedding delivery receipt', task_type: 'communication', sort_order: 4 }
    ],
    portrait: [
        { task_name: 'Finalize portrait selects for delivery', task_type: 'review', sort_order: 1 },
        { task_name: 'Prepare portrait delivery package', task_type: 'delivery', sort_order: 2 },
        { task_name: 'Send portrait handoff details', task_type: 'communication', sort_order: 3 },
        { task_name: 'Confirm portrait delivery receipt', task_type: 'communication', sort_order: 4 }
    ],
    commercial: [
        { task_name: 'Finalize approved commercial assets', task_type: 'review', sort_order: 1 },
        { task_name: 'Prepare commercial delivery package', task_type: 'delivery', sort_order: 2 },
        { task_name: 'Share asset handoff instructions', task_type: 'communication', sort_order: 3 },
        { task_name: 'Confirm commercial asset receipt', task_type: 'communication', sort_order: 4 }
    ],
    event: [
        { task_name: 'Finalize event gallery for delivery', task_type: 'review', sort_order: 1 },
        { task_name: 'Prepare event delivery package', task_type: 'delivery', sort_order: 2 },
        { task_name: 'Send event gallery handoff', task_type: 'communication', sort_order: 3 },
        { task_name: 'Confirm event delivery receipt', task_type: 'communication', sort_order: 4 }
    ],
    other: [
        { task_name: 'Finalize selected assets for delivery', task_type: 'review', sort_order: 1 },
        { task_name: 'Prepare final delivery package', task_type: 'delivery', sort_order: 2 },
        { task_name: 'Send delivery handoff details', task_type: 'communication', sort_order: 3 },
        { task_name: 'Confirm final delivery receipt', task_type: 'communication', sort_order: 4 }
    ]
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

function isManagedDeliveryTask(task, projectId) {
    return task.project_id === projectId
        && task.task_group === DELIVERY_TASK_GROUP
        && task.generated_by === 'create_delivery_tasks';
}

function buildTaskRemark(deliveryMode) {
    return `Delivery mode: ${deliveryMode}`;
}

function buildDeliveryTaskRecord(project, draftTask, deliveryMode, deliveryDeadline) {
    const timestamp = nowIso();

    return {
        task_id: generateRecordId('task'),
        project_id: project.project_id,
        task_name: requireString(draftTask.task_name, 'task_name'),
        task_type: requireEnum(draftTask.task_type, 'task_type', TASK_TYPES),
        status: DEFAULT_TASK_STATUS,
        assignee: null,
        due_date: optionalDate(deliveryDeadline || project.due_date, 'delivery_deadline'),
        sort_order: draftTask.sort_order,
        remark: buildTaskRemark(deliveryMode),
        created_at: timestamp,
        updated_at: timestamp,
        task_group: DELIVERY_TASK_GROUP,
        generated_by: 'create_delivery_tasks',
        delivery_mode: deliveryMode
    };
}

function buildDeliveryTaskDrafts(projectType) {
    return DELIVERY_TASK_TEMPLATES[projectType] || DELIVERY_TASK_TEMPLATES.other;
}

async function createDeliveryTasks(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const overrideExisting = optionalBoolean(input.override_existing, 'override_existing');
    const deliveryMode = optionalString(input.delivery_mode, 'delivery_mode') || DEFAULT_DELIVERY_MODE;
    const deliveryDeadline = optionalDate(input.delivery_deadline, 'delivery_deadline');

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        if (!ALLOWED_DELIVERY_TASK_PROJECT_STATUSES.includes(project.status)) {
            throw new PhotoStudioError(
                'CONFLICT',
                `create_delivery_tasks requires project status to be reviewing, delivered, or completed, received ${project.status}.`,
                {
                    field: 'project_id',
                    project_status: project.status,
                    allowed_statuses: ALLOWED_DELIVERY_TASK_PROJECT_STATUSES
                }
            );
        }

        const taskCollection = await readCollection('tasks', dataDir);
        const existingDeliveryTasks = taskCollection.records.filter((task) => isManagedDeliveryTask(task, projectId));

        if (existingDeliveryTasks.length > 0 && !overrideExisting) {
            return buildSuccess({
                project_id: projectId,
                delivery_mode: deliveryMode,
                delivery_deadline: deliveryDeadline || project.due_date || null,
                created_tasks: [],
                created_count: 0,
                skipped_count: existingDeliveryTasks.length,
                message: 'Existing delivery-stage tasks already cover this project.'
            }, {
                entity: 'delivery_tasks',
                data_dir: dataDir,
                project_status: project.status
            });
        }

        const remainingTasks = overrideExisting
            ? taskCollection.records.filter((task) => !isManagedDeliveryTask(task, projectId))
            : taskCollection.records.slice();
        const createdTasks = buildDeliveryTaskDrafts(project.project_type).map((draftTask) =>
            buildDeliveryTaskRecord(project, draftTask, deliveryMode, deliveryDeadline)
        );

        remainingTasks.push(...createdTasks);
        await writeCollection('tasks', remainingTasks, dataDir);

        return buildSuccess({
            project_id: projectId,
            delivery_mode: deliveryMode,
            delivery_deadline: deliveryDeadline || project.due_date || null,
            created_tasks: createdTasks.map(summarizeTask),
            created_count: createdTasks.length,
            skipped_count: 0
        }, {
            entity: 'delivery_tasks',
            data_dir: dataDir,
            project_status: project.status
        });
    });
}

module.exports = {
    ALLOWED_DELIVERY_TASK_PROJECT_STATUSES,
    createDeliveryTasks
};
