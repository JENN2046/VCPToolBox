const { buildSuccess, PhotoStudioError } = require('./runtime');
const { readCollection, withStoreLock } = require('./store');
const { buildMissingProjectFieldsAuditText } = require('./missingProjectFieldsAuditTemplates');
const { optionalString } = require('./utils');

const REQUIRED_PROJECT_FIELDS = Object.freeze([
    'project_id',
    'customer_id',
    'project_name',
    'project_type',
    'status',
    'created_at',
    'updated_at',
    'normalized_project_name'
]);

const RECOMMENDED_PROJECT_FIELDS = Object.freeze([
    'start_date',
    'due_date',
    'budget'
]);

function isMissingValue(value) {
    return value === null
        || value === undefined
        || (typeof value === 'string' && value.trim() === '');
}

function parseOptionalBoolean(value, fieldName, defaultValue) {
    if (value === null || value === undefined || value === '') {
        return defaultValue;
    }

    if (typeof value !== 'boolean') {
        throw new PhotoStudioError('INVALID_INPUT', `${fieldName} must be a boolean.`, {
            field: fieldName,
            value
        });
    }

    return value;
}

function resolveAuditTargets(projectCollection, requestedProjectId) {
    if (!requestedProjectId) {
        return projectCollection.records;
    }

    const project = projectCollection.records.find((record) => record.project_id === requestedProjectId) || null;
    if (!project) {
        throw new PhotoStudioError('RESOURCE_NOT_FOUND', 'project_id does not reference an existing project.', {
            field: 'project_id',
            project_id: requestedProjectId
        });
    }

    return [project];
}

function buildProjectAuditRow(project, customerMap, includeRecommendedFields, rowIndex) {
    const missingRequiredFields = REQUIRED_PROJECT_FIELDS.filter((field) => isMissingValue(project[field]));
    const missingRecommendedFields = includeRecommendedFields
        ? RECOMMENDED_PROJECT_FIELDS.filter((field) => isMissingValue(project[field]))
        : [];
    const invalidReferenceFields = [];

    if (!isMissingValue(project.customer_id) && !customerMap.has(project.customer_id)) {
        invalidReferenceFields.push('customer_id');
    }

    const issueCount = missingRequiredFields.length + missingRecommendedFields.length + invalidReferenceFields.length;

    return {
        audit_row_id: `row_${String(rowIndex + 1).padStart(4, '0')}`,
        project_id: project.project_id || null,
        customer_id: project.customer_id || null,
        project_name: project.project_name || '[未命名项目]',
        project_type: project.project_type || null,
        status: project.status || null,
        missing_required_fields: missingRequiredFields,
        missing_recommended_fields: missingRecommendedFields,
        invalid_reference_fields: invalidReferenceFields,
        issue_count: issueCount,
        has_customer_reference: !invalidReferenceFields.includes('customer_id')
    };
}

async function checkMissingProjectFields(input) {
    const requestedProjectId = optionalString(input.project_id, 'project_id');
    const includeRecommendedFields = parseOptionalBoolean(
        input.include_recommended_fields,
        'include_recommended_fields',
        true
    );

    return withStoreLock(async ({ dataDir }) => {
        const projectCollection = await readCollection('projects', dataDir);
        const customerCollection = await readCollection('customers', dataDir);
        const customerMap = new Map(customerCollection.records.map((record) => [record.customer_id, record]));
        const projectsToAudit = resolveAuditTargets(projectCollection, requestedProjectId);
        const projectRows = projectsToAudit
            .map((project, index) => buildProjectAuditRow(project, customerMap, includeRecommendedFields, index))
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

        const auditText = buildMissingProjectFieldsAuditText({
            auditMode: requestedProjectId ? 'single_project' : 'all_projects',
            summary,
            checkedProjectId: requestedProjectId,
            projectRows
        });

        return buildSuccess({
            audit_label: 'missing_project_fields',
            audit_mode: requestedProjectId ? 'single_project' : 'all_projects',
            checked_project_id: requestedProjectId,
            include_recommended_fields: includeRecommendedFields,
            summary,
            project_rows: projectRows,
            audit_text: auditText
        }, {
            entity: 'project_field_audit',
            data_dir: dataDir,
            degraded: projectRows.length > 0
        });
    });
}

module.exports = {
    checkMissingProjectFields,
    REQUIRED_PROJECT_FIELDS,
    RECOMMENDED_PROJECT_FIELDS
};
