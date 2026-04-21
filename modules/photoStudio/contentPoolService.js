const {
    DEFAULT_CONTENT_POOL_USAGE_STATUS
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeLookup,
    nowIso,
    optionalString,
    requireString
} = require('./utils');

const ALLOWED_CONTENT_POOL_PROJECT_STATUSES = Object.freeze([
    'delivered',
    'completed'
]);

const FALLBACK_THEME = 'content case';
const FALLBACK_DELIVERABLES_SUMMARY = 'The project is ready for content reuse.';
const FALLBACK_CUSTOMER_NAME = '[客户姓名]';

function summarizeContentItem(record, isNew) {
    return {
        content_item_id: record.content_item_id,
        project_id: record.project_id,
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        project_name: record.project_name,
        project_type: record.project_type,
        theme: record.theme,
        deliverables_summary: record.deliverables_summary,
        usage_status: record.usage_status,
        created_at: record.created_at,
        is_new: isNew
    };
}

function deriveTheme(project, explicitTheme) {
    if (explicitTheme) {
        return explicitTheme;
    }

    return `${project.project_type} ${FALLBACK_THEME}`;
}

function deriveDeliverablesSummary(project, explicitDeliverablesSummary) {
    if (explicitDeliverablesSummary) {
        return explicitDeliverablesSummary;
    }

    return `Project "${project.project_name}" is ready for content reuse.`;
}

async function pushProjectToContentPool(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const explicitTheme = optionalString(input.theme, 'theme');
    const explicitDeliverablesSummary = optionalString(input.deliverables_summary, 'deliverables_summary');

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const project = projectCollection.records.find((record) => record.project_id === projectId);

        if (!project) {
            throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
                field: 'project_id',
                project_id: projectId
            });
        }

        if (!ALLOWED_CONTENT_POOL_PROJECT_STATUSES.includes(project.status)) {
            throw new PhotoStudioError(
                'CONFLICT',
                `push_project_to_content_pool requires project status to be delivered or completed, received ${project.status}.`,
                {
                    field: 'project_id',
                    project_status: project.status,
                    allowed_statuses: ALLOWED_CONTENT_POOL_PROJECT_STATUSES
                }
            );
        }

        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === project.customer_id) || null;
        const contentCollection = await readCollection('contentPool', dataDir);
        const existing = contentCollection.records.find((record) => record.project_id === projectId) || null;
        const customerName = customer && customer.customer_name ? customer.customer_name : FALLBACK_CUSTOMER_NAME;
        const theme = deriveTheme(project, explicitTheme || (existing && existing.theme ? existing.theme : null));
        const deliverablesSummary = deriveDeliverablesSummary(project, explicitDeliverablesSummary || (existing && existing.deliverables_summary ? existing.deliverables_summary : null));
        const timestamp = nowIso();
        const contentRecord = {
            content_item_id: existing ? existing.content_item_id : generateRecordId('content'),
            project_id: project.project_id,
            customer_id: project.customer_id,
            customer_name: customerName,
            project_name: project.project_name,
            project_type: project.project_type,
            theme,
            deliverables_summary: deliverablesSummary,
            usage_status: DEFAULT_CONTENT_POOL_USAGE_STATUS,
            source_project_status: project.status,
            created_at: existing ? existing.created_at : timestamp,
            updated_at: timestamp,
            normalized_project_name: normalizeLookup(project.project_name)
        };

        if (existing) {
            const existingIndex = contentCollection.records.findIndex((record) => record.project_id === projectId);
            contentCollection.records[existingIndex] = contentRecord;
        } else {
            contentCollection.records.push(contentRecord);
        }

        await writeCollection('contentPool', contentCollection.records, dataDir);

        return buildSuccess(summarizeContentItem(contentRecord, !existing), {
            entity: 'content_pool',
            data_dir: dataDir,
            project_status: project.status,
            duplicate: Boolean(existing),
            degraded: customerName === FALLBACK_CUSTOMER_NAME
        });
    });
}

module.exports = {
    ALLOWED_CONTENT_POOL_PROJECT_STATUSES,
    pushProjectToContentPool
};
