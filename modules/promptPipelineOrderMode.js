const PROMPT_PIPELINE_ORDER_MODES = Object.freeze({
    LEGACY: 'legacy',
    DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER: 'detector_post_processors_final_role_divider'
});

function resolvePromptPipelineOrderMode(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (normalized === PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER) {
        return PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER;
    }

    return PROMPT_PIPELINE_ORDER_MODES.LEGACY;
}

function isExperimentalPromptPipelineOrderMode(value) {
    return resolvePromptPipelineOrderMode(value) === PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER;
}

module.exports = {
    PROMPT_PIPELINE_ORDER_MODES,
    resolvePromptPipelineOrderMode,
    isExperimentalPromptPipelineOrderMode
};
