const PROCESS_DIARY_NAME = 'Codex';
const KNOWLEDGE_DIARY_NAME = 'Codex\u7684\u77e5\u8bc6';

function getTargetForDiaryName(dbName) {
    if (dbName === PROCESS_DIARY_NAME) return 'process';
    if (dbName === KNOWLEDGE_DIARY_NAME) return 'knowledge';
    return null;
}

function getDiaryNamesForTarget(target = 'both') {
    if (target === 'process') return [PROCESS_DIARY_NAME];
    if (target === 'knowledge') return [KNOWLEDGE_DIARY_NAME];
    return [PROCESS_DIARY_NAME, KNOWLEDGE_DIARY_NAME];
}

module.exports = {
    PROCESS_DIARY_NAME,
    KNOWLEDGE_DIARY_NAME,
    getTargetForDiaryName,
    getDiaryNamesForTarget
};
