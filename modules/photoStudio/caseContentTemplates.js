const CASE_DRAFT_PRESETS = Object.freeze({
    formal: {
        summaryLead: 'This case documents a polished delivery for',
        captionLead: 'Portfolio highlight:',
        portfolioLead: 'A formal portfolio note for'
    },
    friendly: {
        summaryLead: 'Here is a friendly case summary for',
        captionLead: 'Behind the scenes of',
        portfolioLead: 'A friendly portfolio note for'
    },
    warm: {
        summaryLead: 'This warm case story captures',
        captionLead: 'A warm look at',
        portfolioLead: 'A warm portfolio note for'
    }
});

function buildCaseContentDraft({
    customerName,
    projectName,
    projectType,
    theme,
    deliverablesSummary,
    tone
}) {
    const preset = CASE_DRAFT_PRESETS[tone] || CASE_DRAFT_PRESETS.warm;

    return {
        case_title: `${customerName} x ${projectName}`,
        short_case_summary: `${preset.summaryLead} ${projectName} for ${customerName}. Theme: ${theme}. ${deliverablesSummary}`,
        social_caption: `${preset.captionLead} ${customerName} and ${projectName}. ${theme}. ${deliverablesSummary}`,
        portfolio_description: `${preset.portfolioLead} ${projectName}, showing ${theme} for the ${projectType} category. ${deliverablesSummary}`
    };
}

module.exports = {
    buildCaseContentDraft
};
