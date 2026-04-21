function formatFieldList(fields) {
    if (!fields.length) {
        return 'none';
    }

    return fields.join(', ');
}

function formatProjectAuditRow(project) {
    return [
        `- ${project.project_name} (${project.project_id || project.audit_row_id})`,
        `status ${project.status || 'n/a'}`,
        `missing required: ${formatFieldList(project.missing_required_fields)}`,
        `missing recommended: ${formatFieldList(project.missing_recommended_fields)}`,
        `invalid references: ${formatFieldList(project.invalid_reference_fields)}`
    ].join(' | ');
}

function buildMissingProjectFieldsAuditText({
    auditMode,
    summary,
    checkedProjectId,
    projectRows
}) {
    const header = [
        'Photo Studio project field audit',
        `Audit mode: ${auditMode}`,
        `Checked project: ${checkedProjectId || 'all projects'}`,
        `Summary: total ${summary.total_projects_checked} | complete ${summary.complete_projects} | incomplete ${summary.incomplete_projects}`
    ];

    const counts = [
        `Required field gaps: ${summary.required_field_gap_count}`,
        `Recommended field gaps: ${summary.recommended_field_gap_count}`,
        `Invalid customer references: ${summary.invalid_customer_reference_count}`,
        `Projects with issues: ${summary.projects_with_issues}`
    ];

    const rows = projectRows.length
        ? projectRows.map(formatProjectAuditRow).join('\n')
        : '- none';

    return [
        ...header,
        ...counts,
        '',
        'Projects:',
        rows
    ].join('\n');
}

module.exports = {
    buildMissingProjectFieldsAuditText
};
