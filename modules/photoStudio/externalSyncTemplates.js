function formatExportRow(row) {
    const dueDate = row.due_date || 'n/a';
    const daysUntilDue = row.days_until_due === null ? 'n/a' : `${row.days_until_due}`;
    return `- ${row.project_name} (${row.project_id}) | ${row.status} | ${row.customer_name} | due ${dueDate} | ${daysUntilDue} day(s) | ${row.attention_state}`;
}

function buildListSection(title, rows) {
    if (!rows.length) {
        return `${title}\n- none`;
    }

    return `${title}\n${rows.map((row) => `- ${row}`).join('\n')}`;
}

function buildExternalSyncText({
    targetType,
    targetName,
    exportScope,
    projectId,
    referenceDate,
    upcomingDays,
    summary,
    exportRows,
    note
}) {
    const sections = [
        'Photo Studio external sync export',
        `Target type: ${targetType}`,
        `Target name: ${targetName}`,
        `Scope: ${exportScope}${projectId ? ` (${projectId})` : ''}`,
        `Reference date: ${referenceDate}`,
        `Upcoming window: ${upcomingDays} day(s)`,
        `Summary: total ${summary.total_projects} | active ${summary.active_projects} | closed ${summary.closed_projects} | overdue ${summary.overdue_projects} | due soon ${summary.due_soon_projects}`
    ];

    if (note) {
        sections.push(`Note: ${note}`);
    }

    sections.push(buildListSection(`Export rows (${exportRows.length})`, exportRows.map(formatExportRow)));

    sections.push([
        'Data quality',
        `- missing due dates: ${summary.missing_due_date_count}`,
        `- missing customer records: ${summary.missing_customer_count}`
    ].join('\n'));

    return sections.join('\n\n');
}

module.exports = {
    buildExternalSyncText
};
