const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const ARCHIVE_MODES = ['shadow', 'copy', 'move'];
const ALLOWED_ARCHIVE_PROJECT_STATUSES = ['completed', 'archived'];
const DEFAULT_ARCHIVE_KEY = 'project_assets';
const DEFAULT_ARCHIVE_MODE = 'shadow';
const DEFAULT_ARCHIVE_SURFACE = 'local_shadow_archive';

const PLUGIN_NAME = 'archive_project_assets';
const PLUGIN_VERSION = '2.0.0';

let config = { DebugMode: false };

function _timestamp() {
  return new Date().toISOString();
}

function _meta(extra) {
  return {
    plugin_name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    timestamp: _timestamp(),
    ...extra
  };
}

function _success(data, extraMeta) {
  return {
    success: true,
    data,
    error: null,
    meta: _meta(extraMeta || {})
  };
}

function _error(code, message, field, details) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      field: field || null,
      details: details || {}
    },
    meta: _meta()
  };
}

function _buildArchiveAssetDescription({ archiveLabel, archiveMode, archivePath, assetSummary, customerName, note, project }) {
  const lines = [
    `Project: ${project.project_name}`,
    `Customer: ${customerName}`,
    `Project status: ${project.status}`,
    `Archive label: ${archiveLabel}`,
    `Archive mode: ${archiveMode}`,
    `Archive path: ${archivePath}`
  ];

  if (assetSummary) {
    lines.push(`Asset summary: ${assetSummary}`);
  }

  if (note) {
    lines.push(`Note: ${note}`);
  }

  return lines.join('\n');
}

function _validateInput(args) {
  if (!args.project_id || typeof args.project_id !== 'string' || args.project_id.trim() === '') {
    return _error('MISSING_REQUIRED_FIELD', 'project_id is required', 'project_id');
  }

  if (args.archive_mode && !ARCHIVE_MODES.includes(args.archive_mode)) {
    return _error('INVALID_INPUT', `archive_mode must be one of: ${ARCHIVE_MODES.join(', ')}`, 'archive_mode');
  }

  return null;
}

function _buildDefaultArchivePath(project) {
  return `archive/photo-studio/${project.project_id}`;
}

function _summarizeArchiveRecord(record, isNew) {
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

async function processToolCall(args) {
  const validationError = _validateInput(args);
  if (validationError) {
    return validationError;
  }

  const projectId = args.project_id.trim();
  const project = store.getProject(projectId);
  if (!project) {
    return _error('RESOURCE_NOT_FOUND', `project ${projectId} not found`, 'project_id');
  }

  if (!ALLOWED_ARCHIVE_PROJECT_STATUSES.includes(project.status)) {
    return _error(
      'CONFLICT',
      `archive_project_assets requires project status ${ALLOWED_ARCHIVE_PROJECT_STATUSES.join(' or ')}, received ${project.status}.`,
      'project_id',
      {
        allowed_statuses: ALLOWED_ARCHIVE_PROJECT_STATUSES,
        project_status: project.status
      }
    );
  }

  const archiveSurface = args.archive_surface || DEFAULT_ARCHIVE_SURFACE;
  const archiveKey = String(args.archive_key || DEFAULT_ARCHIVE_KEY).trim();
  const existing = store.getArchiveAssetsByProject(projectId).find((asset) =>
    asset.archive_surface === archiveSurface && asset.archive_key === archiveKey
  ) || null;

  const customer = project.customer_id ? store.getCustomer(project.customer_id) : null;
  const degraded = !customer || !customer.customer_name;
  const customerName = degraded ? '[客户姓名]' : customer.customer_name;
  const archivePath = args.archive_path || (existing && existing.archive_path) || _buildDefaultArchivePath(project);
  const archiveLabel = args.archive_label || (existing && existing.archive_label) || `${project.project_name} assets`;
  const archiveMode = args.archive_mode || (existing && existing.archive_mode) || DEFAULT_ARCHIVE_MODE;
  const assetSummary = args.asset_summary || (existing && existing.asset_summary) || 'Project assets archived for review and retention.';

  const { record, existing: existingRecord } = store.upsertArchiveAsset({
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
    archive_description: _buildArchiveAssetDescription({
      archiveLabel,
      archiveMode,
      archivePath,
      assetSummary,
      customerName,
      note: args.note || '',
      project
    }),
    archive_surface: archiveSurface,
    note: args.note || ''
  });

  return _success(_summarizeArchiveRecord(record, !existingRecord), {
    entity: 'archive_project_assets',
    degraded,
    duplicate: Boolean(existingRecord),
    project_status: project.status,
    archive_surface: archiveSurface,
    archive_mode: archiveMode,
    sync_mode: 'local_shadow'
  });
}

async function initialize(initialConfig) {
  config = initialConfig || {};
  if (config.PhotoStudioDataPath) {
    store.configureDataRoot(config.PhotoStudioDataPath);
  }
}

function shutdown() {}

module.exports = {
  ALLOWED_ARCHIVE_PROJECT_STATUSES,
  ARCHIVE_MODES,
  initialize,
  processToolCall,
  shutdown
};
