const { REPLY_TONES } = require('./constants');
const { buildCaseContentDraft } = require('./caseContentTemplates');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock } = require('./store');
const {
    nowIso,
    optionalString,
    requireEnum
} = require('./utils');

const FALLBACK_CUSTOMER_NAME = '[客户姓名]';
const FALLBACK_THEME = 'content case';
const FALLBACK_DELIVERABLES_SUMMARY = 'The project is ready for content reuse.';

function resolveContentItem(contentRecords, requestedContentItemId, requestedProjectId) {
    if (requestedContentItemId) {
        return contentRecords.find((record) => record.content_item_id === requestedContentItemId) || null;
    }

    return contentRecords.find((record) => record.project_id === requestedProjectId) || null;
}

async function generateCaseContentDraft(input) {
    const requestedContentItemId = optionalString(input.content_item_id, 'content_item_id');
    const requestedProjectId = optionalString(input.project_id, 'project_id');

    if (!requestedContentItemId && !requestedProjectId) {
        throw new PhotoStudioError('MISSING_REQUIRED_FIELD', 'content_item_id or project_id is required.', {
            field: 'content_item_id'
        });
    }

    const tone = requireEnum(input.tone || 'warm', 'tone', REPLY_TONES);

    return withStoreLock(async ({ dataDir }) => {
        const contentCollection = await readCollection('contentPool', dataDir);
        const contentItem = resolveContentItem(contentCollection.records, requestedContentItemId, requestedProjectId);

        if (!contentItem) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'The requested content pool item does not exist.', {
                field: requestedContentItemId ? 'content_item_id' : 'project_id',
                content_item_id: requestedContentItemId || undefined,
                project_id: requestedProjectId || undefined
            });
        }

        if (requestedContentItemId && requestedProjectId && contentItem.project_id !== requestedProjectId) {
            throw new PhotoStudioError('CONFLICT', 'content_item_id does not match the supplied project_id.', {
                field: 'project_id',
                content_item_id: requestedContentItemId,
                project_id: requestedProjectId
            });
        }

        const degraded = !contentItem.customer_name || !contentItem.theme || !contentItem.deliverables_summary;
        const customerName = contentItem.customer_name || FALLBACK_CUSTOMER_NAME;
        const theme = contentItem.theme || FALLBACK_THEME;
        const deliverablesSummary = contentItem.deliverables_summary || FALLBACK_DELIVERABLES_SUMMARY;
        const generationTime = nowIso();
        const draftVariants = buildCaseContentDraft({
            customerName,
            projectName: contentItem.project_name,
            projectType: contentItem.project_type,
            theme,
            deliverablesSummary,
            tone
        });

        return buildSuccess({
            content_item_id: contentItem.content_item_id,
            project_id: contentItem.project_id,
            customer_id: contentItem.customer_id,
            customer_name: customerName,
            project_name: contentItem.project_name,
            project_type: contentItem.project_type,
            theme,
            deliverables_summary: deliverablesSummary,
            usage_status: contentItem.usage_status,
            draft_variants: {
                ...draftVariants,
                tone
            },
            generation_time: generationTime
        }, {
            entity: 'case_content_draft',
            data_dir: dataDir,
            degraded,
            source_content_item_id: contentItem.content_item_id
        });
    });
}

module.exports = {
    generateCaseContentDraft
};
