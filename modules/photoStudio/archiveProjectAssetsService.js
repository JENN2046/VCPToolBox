const {
    ARCHIVE_MODES,
    DEFAULT_ARCHIVE_KEY,
    DEFAULT_ARCHIVE_MODE,
    DEFAULT_ARCHIVE_SURFACE
} = require('./constants');
const { buildSuccess, PhotoStudioError } = require('./runtime');
const { buildArchiveAssetDescription } = require('./archiveAssetTemplates');
const { readCollection, withStoreLock, writeCollection } = require('./store');
const {
    generateRecordId,
    normalizeLookup,
    nowIso,
    optionalString,
    requireEnum,
    requireString
} = require('./utils');

const ALLOWED_ARCHIVE_PROJECT_STATUSES = Object.freeze([
    'completed',
    'archived'
]);

function buildDefaultArchivePath(project) {
    return `archive/photo-studio/${project.project_id}`;
}

function summarizeArchiveRecord(record, isNew) {
    return {
        archive_asset_id: record.archive_asset_id,
        project_id: record.project_id,
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        project_name: record.project_name,
        project_type: record.project_type,
        project_status: record.project_status,
        archive_key: record.archive_key,
        archive_path: record.archive_path,
        archive_label: record.archive_label,
        archive_mode: record.archive_mode,
        asset_summary: record.asset_summary,
        archive_surface: record.archive_surface,
        sync_state: record.sync_state,
        created_at: record.created_at,
        is_new: isNew
    };
}

async function archiveProjectAssets(input) {
    const projectId = requireString(input.project_id, 'project_id');
    const archiveKey = optionalString(input.archive_key, 'archive_key') || DEFAULT_ARCHIVE_KEY;
    const archivePathInput = optionalString(input.archive_path, 'archive_path');
    const archiveLabelInput = optionalString(input.archive_label, 'archive_label');
    const assetSummaryInput = optionalString(input.asset_summary, 'asset_summary');
    const archiveSurfaceInput = optionalString(input.archive_surface, 'archive_surface');
    const archiveMode = requireEnum(input.archive_mode || DEFAULT_ARCHIVE_MODE, 'archive_mode', ARCHIVE_MODES);
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

        if (!ALLOWED_ARCHIVE_PROJECT_STATUSES.includes(project.status)) {
            throw new PhotoStudioError(
                'CONFLICT',
                `archive_project_assets requires project status to be completed or archived, received ${project.status}.`,
                {
                    field: 'project_id',
                    project_status: project.status,
                    allowed_statuses: ALLOWED_ARCHIVE_PROJECT_STATUSES
                }
            );
        }

        const customerCollection = await readCollection('customers', dataDir);
        const customer = customerCollection.records.find((record) => record.customer_id === project.customer_id) || null;
        const archiveCollection = await readCollection('archiveAssets', dataDir);
        const archiveSurface = archiveSurfaceInput || DEFAULT_ARCHIVE_SURFACE;
        const existing = archiveCollection.records.find((record) => (
            record.project_id === projectId
            && record.archive_surface === archiveSurface
            && record.archive_key === archiveKey
        )) || null;

        const customerName = customer && customer.customer_name ? customer.customer_name : '[客户姓名]';
        const archivePath = archivePathInput
            || (existing && existing.archive_path)
            || buildDefaultArchivePath(project);
        const archiveLabel = archiveLabelInput
            || (existing && existing.archive_label)
            || `${project.project_name} assets`;
        const assetSummary = assetSummaryInput
            || (existing && existing.asset_summary)
            || 'Project assets archived for review and retention.';
        const timestamp = nowIso();
        const archiveRecord = {
            archive_asset_id: existing ? existing.archive_asset_id : generateRecordId('archive'),
            project_id: project.project_id,
            customer_id: project.customer_id,
            customer_name: customerName,
            project_name: project.project_name,
            project_type: project.project_type,
            project_status: project.status,
            archive_key: archiveKey,
            archive_path: archivePath,
            archive_label: archiveLabel,
            archive_mode: archiveMode,
            asset_summary: assetSummary,
            archive_description: buildArchiveAssetDescription({
                archiveLabel,
                archiveMode,
                archivePath,
                assetSummary,
                customerName,
                note,
                project
            }),
            archive_surface: archiveSurface,
            sync_state: 'local_shadow',
            note,
            created_at: existing ? existing.created_at : timestamp,
            updated_at: timestamp,
            normalized_project_name: normalizeLookup(project.project_name)
        };

        if (existing) {
            const existingIndex = archiveCollection.records.findIndex((record) => (
                record.project_id === projectId
                && record.archive_surface === archiveSurface
                && record.archive_key === archiveKey
            ));
            archiveCollection.records[existingIndex] = archiveRecord;
        } else {
            archiveCollection.records.push(archiveRecord);
        }

        await writeCollection('archiveAssets', archiveCollection.records, dataDir);

        return buildSuccess(summarizeArchiveRecord(archiveRecord, !existing), {
            entity: 'archive_project_assets',
            data_dir: dataDir,
            degraded: !customer,
            duplicate: Boolean(existing),
            project_status: project.status,
            archive_surface: archiveSurface,
            archive_mode: archiveMode,
            sync_mode: 'local_shadow'
        });
    });
}

module.exports = {
    ALLOWED_ARCHIVE_PROJECT_STATUSES,
    archiveProjectAssets
};
