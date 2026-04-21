const TONE_PRESETS = Object.freeze({
    formal: {
        greeting: 'Hello',
        intro: 'The current editing round is ready for your image selection.',
        selectionLead: 'Please review the gallery and confirm your selected images',
        methodLead: 'Selection method',
        noteLead: 'Additional note',
        closing: 'Thank you. Once we receive your selections, we will continue with the next delivery step.'
    },
    friendly: {
        greeting: 'Hi',
        intro: 'Your image selection round is ready to go.',
        selectionLead: 'Please take a look and send us your favorite images',
        methodLead: 'How to select',
        noteLead: 'Extra note',
        closing: 'Once you send the picks, we will move straight into the next step.'
    },
    warm: {
        greeting: 'Hi',
        intro: 'We have prepared the next selection round for your project.',
        selectionLead: 'When you have a moment, please review the gallery and mark the images you would like to keep',
        methodLead: 'Selection method',
        noteLead: 'A note for you',
        closing: 'Thank you for reviewing the gallery. We will keep the next step ready as soon as your selections come in.'
    }
});

function buildSelectionDeadlineLine(selectionLead, selectionDeadline) {
    if (selectionDeadline) {
        return `${selectionLead} by ${selectionDeadline}.`;
    }

    return `${selectionLead} when convenient.`;
}

function buildSelectionNotice({
    customerName,
    project,
    tone,
    selectionDeadline,
    selectionMethod,
    noteToClient
}) {
    const preset = TONE_PRESETS[tone] || TONE_PRESETS.warm;
    const lines = [
        `${preset.greeting} ${customerName},`,
        `${preset.intro} This notice is for "${project.project_name}".`,
        buildSelectionDeadlineLine(preset.selectionLead, selectionDeadline),
        `${preset.methodLead}: ${selectionMethod}.`,
        noteToClient ? `${preset.noteLead}: ${noteToClient}` : null,
        preset.closing
    ].filter(Boolean);

    return lines.join('\n\n');
}

module.exports = {
    buildSelectionNotice
};
