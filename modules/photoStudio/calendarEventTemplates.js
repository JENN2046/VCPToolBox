const EVENT_TITLES = Object.freeze({
    milestone: 'Project milestone',
    follow_up: 'Follow-up check-in',
    deadline: 'Project deadline'
});

function buildCalendarEventTitle({ eventType, projectName, customTitle }) {
    if (customTitle) {
        return customTitle;
    }

    const prefix = EVENT_TITLES[eventType] || 'Calendar coordination';
    return `${prefix}: ${projectName}`;
}

function buildCalendarEventDescription({
    customerName,
    eventDate,
    eventTime,
    eventType,
    note,
    project,
    timezone
}) {
    const lines = [
        `Project: ${project.project_name}`,
        `Customer: ${customerName}`,
        `Project status: ${project.status}`,
        `Event type: ${eventType}`,
        `Date: ${eventDate}`,
        `Timezone: ${timezone}`
    ];

    if (eventTime) {
        lines.push(`Time: ${eventTime}`);
    }

    if (note) {
        lines.push(`Note: ${note}`);
    }

    return lines.join('\n');
}

module.exports = {
    buildCalendarEventDescription,
    buildCalendarEventTitle
};
