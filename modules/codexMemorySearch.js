const fs = require('fs').promises;
const path = require('path');

const { getDiaryNamesForTarget, getTargetForDiaryName } = require('./codexMemoryConstants');

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;

function clampLimit(limit) {
    const parsed = parseInt(String(limit || DEFAULT_SEARCH_LIMIT), 10);
    if (Number.isNaN(parsed)) return DEFAULT_SEARCH_LIMIT;
    return Math.max(1, Math.min(MAX_SEARCH_LIMIT, parsed));
}

function pickTopScore(result) {
    const score = result?.rerank_score ?? result?.score ?? null;
    return Number.isFinite(score) ? Number(score) : null;
}

function extractTitle(text) {
    if (typeof text !== 'string' || !text.trim()) return 'Untitled memory';

    const titleMatch = text.match(/^(?:Title|\u6807\u9898):\s*(.+)$/mi);
    if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
    }

    const firstContentLine = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(line => line && !/^Tag:/i.test(line) && !/^Evidence:/i.test(line));

    if (!firstContentLine) return 'Untitled memory';
    return firstContentLine.slice(0, 120);
}

function toSnippet(text, maxLength = 240) {
    if (typeof text !== 'string' || !text.trim()) return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

async function readSourceContent(knowledgeBaseManager, fullPath) {
    if (!knowledgeBaseManager?.config?.rootPath || !fullPath) return null;
    const absolutePath = path.join(knowledgeBaseManager.config.rootPath, fullPath);
    return fs.readFile(absolutePath, 'utf8');
}

async function searchCodexMemory({
    query,
    target = 'both',
    limit = DEFAULT_SEARCH_LIMIT,
    includeContent = false,
    knowledgeBaseManager,
    ragDiaryPlugin
}) {
    if (typeof query !== 'string' || !query.trim()) {
        throw new Error('query must be a non-empty string');
    }

    if (!knowledgeBaseManager || typeof knowledgeBaseManager.search !== 'function') {
        throw new Error('knowledgeBaseManager is required');
    }

    if (!ragDiaryPlugin || typeof ragDiaryPlugin.getSingleEmbeddingCached !== 'function') {
        throw new Error('RAGDiaryPlugin is required');
    }

    const searchLimit = clampLimit(limit);
    const dbNames = getDiaryNamesForTarget(target);
    const vector = await ragDiaryPlugin.getSingleEmbeddingCached(query.trim());

    if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('Failed to create embedding for query');
    }

    const collectedResults = [];

    for (const dbName of dbNames) {
        const rawResults = await knowledgeBaseManager.search(dbName, vector, searchLimit, 0, [], 1.33);
        const safeResults = Array.isArray(rawResults) ? rawResults : [];

        const auditPayload = typeof ragDiaryPlugin._buildCodexRecallAuditPayload === 'function'
            ? ragDiaryPlugin._buildCodexRecallAuditPayload({
                dbName,
                recallType: includeContent ? 'full_text' : 'snippet',
                results: safeResults.map(result => ({ ...result, source: 'mcp' }))
            })
            : null;

        if (auditPayload && typeof ragDiaryPlugin._recordCodexRecallAudit === 'function') {
            await ragDiaryPlugin._recordCodexRecallAudit(auditPayload, { source: 'mcp' });
        }

        for (const result of safeResults) {
            const sourceText = includeContent && result.fullPath
                ? await readSourceContent(knowledgeBaseManager, result.fullPath)
                : result.text;
            const cleanedContent = typeof ragDiaryPlugin._stripCodexMemoryMarkers === 'function'
                ? ragDiaryPlugin._stripCodexMemoryMarkers(sourceText || '')
                : (sourceText || '');
            const memoryId = typeof ragDiaryPlugin._extractMemoryIdsFromText === 'function'
                ? (ragDiaryPlugin._extractMemoryIdsFromText(sourceText || result.text || '')[0] || null)
                : null;

            collectedResults.push({
                target: getTargetForDiaryName(dbName),
                title: extractTitle(cleanedContent),
                memoryId,
                score: pickTopScore(result),
                sourceFile: result.fullPath || result.sourceFile || null,
                matchedTags: Array.isArray(result.matchedTags) ? result.matchedTags : [],
                snippet: toSnippet(cleanedContent),
                ...(includeContent ? { content: cleanedContent } : {})
            });
        }
    }

    return collectedResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, searchLimit);
}

module.exports = {
    DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT,
    searchCodexMemory
};
