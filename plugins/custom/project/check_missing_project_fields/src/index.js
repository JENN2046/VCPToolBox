const path = require('path');

const store = require(path.join(__dirname, '..', '..', '..', 'shared', 'photo_studio_data', 'PhotoStudioDataStore'));

const REQUIRED_PROJECT_FIELDS = Object.freeze([
  'project_id',
  'customer_id',
  'project_name',
  'project_type',
  'status',
  'created_at',
  'updated_at'
]);

const RECOMMENDED_PROJECT_FIELDS = Object.freeze([
  'shoot_date',
  'delivery_deadline',
  'budget'
]);

const PLUGIN_NAME = 'check_missing_project_fields';
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

function _isMissingValue(value) {
  return value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '');
}

function _validateInput(args) {
  if (args.project_id !== undefined && (typeof args.project_id !== 'string' || args.project_id.trim() === '')) {
    return _error('INVALID_INPUT', 'project_id must be a non-empty string when provided.', 'project_id');
  }

  if (args.include_recommended_fields !== undefined && typeof args.include_recommended_fields !== 'boolean') {
    return _error('INVALID_INPUT', 'include_recommended_fields must be a boolean.', 'include_recommended_fields');
  }

  return null;
}

function _buildProjectAuditRow(project, customerMap, includeRecommendedFields, rowIndex) {
  const missingRequiredFields = REQUIRED_PROJECT_FIELDS.filter((field) => _isMissingValue(project[field]));
  const missingRecommendedFields = includeRecommendedFields
    ? RECOMMENDED_PROJECT_FIELDS.filter((field) => _isMissingValue(project[field]))
    : [];
  const invalidReferenceFields = [];

  if (!_isMissingValue(project.customer_id) && !customerMap.has(project.customer_id)) {
    invalidReferenceFields.push('customer_id');
  }

  return {
    audit_row_id: `row_${String(rowIndex + 1).padStart(4, '0')}`,
    project_id: project.project_id || null,
    customer_id: project.customer_id || null,
    project_name: project.project_name || '[Untitled Project]',
    project_type: project.project_type || null,
    status: project.status || null,
    missing_required_fields: missingRequiredFields,
    missing_recommended_fields: missingRecommendedFields,
    invalid_reference_fields: invalidReferenceFields,
    issue_count: missingRequiredFields.length + missingRecommendedFields.length + invalidReferenceFields.length
  };
}

function _buildAuditText({ auditMode, checkedProjectId, summary, projectRows }) {
  const lines = [
    'Photo Studio project field audit',
    `Mode: ${auditMode}`
  ];

  if (checkedProjectId) {
    lines.push(`Project: ${checkedProjectId}`);
  }

  lines.push(
    `Projects checked: ${summary.total_projects_checked}`,
    `Projects with issues: ${summary.projects_with_issues}`,
    `Required gaps: ${summary.required_field_gap_count}`,
    `Recommended gaps: ${summary.recommended_field_gap_count}`,
    `Invalid customer references: ${summary.invalid_customer_reference_count}`
  );

  if (projectRows.length > 0) {
    lines.push('', 'Flagged projects:');
    projectRows.forEach((row) => {
      lines.push(`- ${row.project_name} (${row.project_id || 'unknown'})`);
    });
  }

  return lines.join('\n');
}

async function processToolCall(args) {
  const validationError = _validateInput(args);
  if (validationError) {
    return validationError;
  }

  const requestedProjectId = args.project_id ? args.project_id.trim() : null;
  const includeRecommendedFields = args.include_recommended_fields !== false;
  const allProjects = store.listProjects();
  const customerMap = new Map(store.listCustomers().map((record) => [record.customer_id, record]));
  const projectsToAudit = requestedProjectId
    ? allProjects.filter((project) => project.project_id === requestedProjectId)
    : allProjects;

  if (requestedProjectId && projectsToAudit.length === 0) {
    return _error('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', 'project_id', {
      project_id: requestedProjectId
    });
  }

  const projectRows = projectsToAudit
    .map((project, index) => _buildProjectAuditRow(project, customerMap, includeRecommendedFields, index))
    .filter((row) => row.issue_count > 0)
    .sort((left, right) => {
      if (left.issue_count !== right.issue_count) {
        return right.issue_count - left.issue_count;
      }

      return `${left.project_name}:${left.audit_row_id}`.localeCompare(`${right.project_name}:${right.audit_row_id}`);
    });

  const summary = {
    total_projects_checked: projectsToAudit.length,
    complete_projects: projectsToAudit.length - projectRows.length,
    incomplete_projects: projectRows.length,
    projects_with_issues: projectRows.length,
    required_field_gap_count: projectRows.reduce((total, row) => total + row.missing_required_fields.length, 0),
    recommended_field_gap_count: projectRows.reduce((total, row) => total + row.missing_recommended_fields.length, 0),
    invalid_customer_reference_count: projectRows.reduce((total, row) => total + row.invalid_reference_fields.length, 0)
  };

  return _success({
    audit_label: 'missing_project_fields',
    audit_mode: requestedProjectId ? 'single_project' : 'all_projects',
    checked_project_id: requestedProjectId,
    include_recommended_fields: includeRecommendedFields,
    summary,
    project_rows: projectRows,
    audit_text: _buildAuditText({
      auditMode: requestedProjectId ? 'single_project' : 'all_projects',
      checkedProjectId: requestedProjectId,
      summary,
      projectRows
    })
  }, {
    entity: 'project_field_audit',
    degraded: projectRows.length > 0
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
  REQUIRED_PROJECT_FIELDS,
  RECOMMENDED_PROJECT_FIELDS,
  initialize,
  processToolCall,
  shutdown
};
