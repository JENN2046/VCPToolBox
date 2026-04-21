const { REPLY_TONES } = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { buildSelectionNotice } = require('./selectionNoticeTemplates');
const { readCollection, withStoreLock } = require('./store');
const {
    nowIso,
    optionalDate,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES = Object.freeze([
    'editing',
    'reviewing'
]);

const DEFAULT_SELECTION_METHOD = 'online gallery review';
const FALLBACK_CUSTOMER_NAME = '[瀹㈡埛濮撳悕]';

async function createSelectionNotice(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const selectionDeadlineInput = optionalDate(input.selection_deadline, 'selection_deadline');
    const selectionMethodInput = optionalString(input.selection_method, 'selection_method');
    const noteToClient = optionalString(input.note_to_client, 'note_to_client');
    const tone = requireEnum(input.tone || 'warm', 'tone', REPLY_TONES);

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        if (!ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES.includes(project.status)) {
            throw new PhotoStudioError(
                'CONFLICT',
                `create_selection_notice requires project status to be editing or reviewing, received ${project.status}.`,
                {
                    field: 'project_id',
                    project_status: project.status,
                    allowed_statuses: ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES
                }
            );
        }

        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === project.customer_id) || null;
        const degraded = !customer || !customer.customer_name;
        const customerName = degraded ? FALLBACK_CUSTOMER_NAME : customer.customer_name;
        const selectionDeadline = selectionDeadlineInput || project.due_date || null;
        const selectionMethod = selectionMethodInput || DEFAULT_SELECTION_METHOD;
        const generationTime = nowIso();
        const noticeContent = buildSelectionNotice({
            customerName,
            project,
            tone,
            selectionDeadline,
            selectionMethod,
            noteToClient
        });

        return buildSuccess({
            project_id: project.project_id,
            customer_name: customerName,
            selection_deadline: selectionDeadline,
            selection_method: selectionMethod,
            notice_content: noticeContent,
            generation_time: generationTime
        }, {
            entity: 'selection_notice',
            data_dir: dataDir,
            degraded,
            project_status: project.status
        });
    });
}

module.exports = {
    ALLOWED_SELECTION_NOTICE_PROJECT_STATUSES,
    createSelectionNotice
};
