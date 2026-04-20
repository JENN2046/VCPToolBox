const {
    ALLOWED_PROJECT_STATUS_TRANSITIONS,
    PROJECT_STATUSES
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    nowIso,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

async function updateProjectStatus(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const newStatus = requireEnum(input.new_status, 'new_status', PROJECT_STATUSES);
    const remark = optionalString(input.remark, 'remark') || optionalString(input.reason, 'reason');

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const projectIndex = projectCollection.records.findIndex((record) => record.project_id === projectId);

        if (projectIndex === -1) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        const project = projectCollection.records[projectIndex];
        const previousStatus = project.status;

        if (previousStatus === newStatus) {
            return buildSuccess({
                project_id: projectId,
                previous_status: previousStatus,
                new_status: newStatus,
                transition_time: nowIso(),
                remark
            }, {
                entity: 'project_status',
                changed: false,
                data_dir: dataDir
            });
        }

        const allowedNextStatuses = ALLOWED_PROJECT_STATUS_TRANSITIONS[previousStatus] || [];
        if (!allowedNextStatuses.includes(newStatus)) {
            throw new PhotoStudioError(
                'INVALID_TRANSITION',
                `Cannot change project status from ${previousStatus} to ${newStatus}.`,
                {
                    field: 'new_status',
                    previous_status: previousStatus,
                    allowed_next_statuses: allowedNextStatuses
                }
            );
        }

        const transitionTime = nowIso();
        const updatedProject = {
            ...project,
            status: newStatus,
            updated_at: transitionTime
        };

        const statusLogCollection = await readCollection('statusLog', dataDir);
        statusLogCollection.records.push({
            status_log_id: generateRecordId('log'),
            project_id: projectId,
            previous_status: previousStatus,
            new_status: newStatus,
            transition_time: transitionTime,
            remark
        });

        projectCollection.records[projectIndex] = updatedProject;
        await writeCollection('projects', projectCollection.records, dataDir);
        await writeCollection('statusLog', statusLogCollection.records, dataDir);

        return buildSuccess({
            project_id: projectId,
            previous_status: previousStatus,
            new_status: newStatus,
            transition_time: transitionTime,
            remark
        }, {
            entity: 'project_status',
            changed: true,
            data_dir: dataDir
        });
    });
}

module.exports = {
    updateProjectStatus
};
