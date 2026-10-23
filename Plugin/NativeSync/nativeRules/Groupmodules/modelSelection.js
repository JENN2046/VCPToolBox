'use strict';
function resolveEffectiveModel(groupConfig, agentConfig) {
    const usingUnifiedModel = groupConfig && groupConfig.useUnifiedModel === true;
    const unifiedModel = (groupConfig && typeof groupConfig.unifiedModel === 'string')
        ? groupConfig.unifiedModel.trim()
        : '';
    const agentModel = (agentConfig && typeof agentConfig.model === 'string')
        ? agentConfig.model.trim()
        : '';

    return {
        usingUnifiedModel,
        unifiedModel,
        agentModel,
        effectiveModel: usingUnifiedModel ? unifiedModel : agentModel
    };
}



module.exports={resolveEffectiveModel};
