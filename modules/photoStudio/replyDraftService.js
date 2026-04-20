const {
    REPLY_CONTEXT_TYPES,
    REPLY_TONES
} = require('./constants');
const { buildReplyDraft } = require('./replyTemplates');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock } = require('./store');
const {
    nowIso,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

function normalizeKeyPoints(value) {
    if (value === null || value === undefined) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new PhotoStudioError('INVALID_INPUT', 'key_points must be an array of strings.', {
            field: 'key_points'
        });
    }

    return value.map((point, index) => {
        if (typeof point !== 'string' || !point.trim()) {
            throw new PhotoStudioError('INVALID_INPUT', 'key_points entries must be non-empty strings.', {
                field: 'key_points',
                index
            });
        }

        return point.trim();
    });
}

async function generateClientReplyDraft(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const requestedCustomerId = optionalString(input.customer_id, 'customer_id');
    const contextType = requireEnum(input.context_type, 'context_type', REPLY_CONTEXT_TYPES);
    const tone = requireEnum(input.tone || 'warm', 'tone', REPLY_TONES);
    const keyPoints = normalizeKeyPoints(input.key_points);

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        if (requestedCustomerId && requestedCustomerId !== project.customer_id) {
            throw new PhotoStudioError('CONFLICT', 'customer_id does not match the customer bound to this project.', {
                field: 'customer_id',
                customer_id: requestedCustomerId,
                project_id: projectId
            });
        }

        const resolvedCustomerId = requestedCustomerId || project.customer_id;
        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === resolvedCustomerId) || null;

        const degraded = !customer || !customer.customer_name;
        const customerName = degraded ? '[客户姓名]' : customer.customer_name;
        const generationTime = nowIso();
        const draftContent = buildReplyDraft({
            customerName,
            project,
            contextType,
            tone,
            keyPoints
        });

        return buildSuccess({
            project_id: project.project_id,
            customer_name: customerName,
            context_type: contextType,
            draft_content: draftContent,
            generation_time: generationTime
        }, {
            entity: 'reply_draft',
            data_dir: dataDir,
            degraded
        });
    });
}

module.exports = {
    generateClientReplyDraft
};
