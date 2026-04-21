function formatStatusCounts(statusCounts) {
    return Object.entries(statusCounts)
        .map(([status, count]) => `${status}: ${count}`)
        .join(' | ');
}

function formatProjectRow(project) {
    const dueDate = project.due_date || 'n/a';
    const daysUntilDue = project.days_until_due === null ? 'n/a' : `${project.days_until_due}`;
    return `- ${project.project_name} (${project.project_id}) | ${project.status} | due ${dueDate} | ${daysUntilDue} day(s) | ${project.customer_name}`;
}

function formatTransitionRow(transition) {
    const projectLabel = transition.project_name ? `${transition.project_name} (${transition.project_id})` : transition.project_id;
    return `- ${transition.transition_time} | ${projectLabel} | ${transition.previous_status} -> ${transition.new_status}`;
}

function buildListSection(title, rows) {
    if (!rows.length) {
        return `${title}\n- none`;
    }

    return `${title}\n${rows.map((row) => `- ${row}`).join('\n')}`;
}

function buildWeeklyProjectDigestText({
    referenceDate,
    windowStart,
    windowEnd,
    summary,
    statusCounts,
    typeCounts,
    overdueProjects,
    upcomingDueProjects,
    recentTransitions,
    dataQuality
}) {
    const sections = [
        'Weekly photo_studio digest',
        `Reference date: ${referenceDate}`,
        `Window: ${windowStart} to ${windowEnd}`,
        `Summary: total ${summary.total_projects} | active ${summary.active_projects} | closed ${summary.closed_projects}`,
        `Status counts: ${formatStatusCounts(statusCounts)}`,
        `Project type counts: ${formatStatusCounts(typeCounts)}`
    ];

    sections.push(
        buildListSection(
            `Overdue projects (${overdueProjects.length})`,
            overdueProjects.map(formatProjectRow)
        )
    );

    sections.push(
        buildListSection(
            `Due soon projects (${upcomingDueProjects.length})`,
            upcomingDueProjects.map(formatProjectRow)
        )
    );

    sections.push(
        buildListSection(
            `Recent transitions (${recentTransitions.length})`,
            recentTransitions.map(formatTransitionRow)
        )
    );

    sections.push(
        [
            'Data quality',
            `- missing due dates: ${dataQuality.missing_due_date_count}`,
            `- missing customer records: ${dataQuality.missing_customer_count}`,
            `- missing project references: ${dataQuality.missing_project_reference_count}`
        ].join('\n')
    );

    return sections.join('\n\n');
}

module.exports = {
    buildWeeklyProjectDigestText
};
