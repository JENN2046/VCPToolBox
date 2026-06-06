const test = require('node:test');
const assert = require('node:assert/strict');

const ragDiaryPlugin = require('../Plugin/RAGDiaryPlugin/RAGDiaryPlugin');

test('RAGDiaryPlugin ignores notification-only latest user when selecting query content', async () => {
    const originalContextVectorManager = ragDiaryPlugin.contextVectorManager;
    const originalFoldingStore = ragDiaryPlugin.foldingStore;
    const originalRagParams = ragDiaryPlugin.ragParams;
    const originalTimeParser = ragDiaryPlugin.timeParser;
    const originalGetSingleEmbeddingCached = ragDiaryPlugin.getSingleEmbeddingCached;
    const originalGetWeightedAverageVector = ragDiaryPlugin._getWeightedAverageVector;
    const originalCalculateDynamicParams = ragDiaryPlugin._calculateDynamicParams;
    const originalResolveGhostAnchors = ragDiaryPlugin._resolveGhostAnchors;
    const originalExtractContextDiaryPrefixes = ragDiaryPlugin._extractContextDiaryPrefixes;
    const originalProcessSingleSystemMessage = ragDiaryPlugin._processSingleSystemMessage;

    const embeddedTexts = [];
    const processedCalls = [];

    try {
        ragDiaryPlugin.contextVectorManager = {
            updateContext: async () => {},
            segmentContext: () => []
        };
        ragDiaryPlugin.foldingStore = null;
        ragDiaryPlugin.ragParams = {
            RAGDiaryPlugin: {
                mainSearchWeights: [1, 0]
            }
        };
        ragDiaryPlugin.timeParser = {
            parse: () => []
        };
        ragDiaryPlugin.getSingleEmbeddingCached = async (text) => {
            embeddedTexts.push(text);
            return text ? [1, 0, 0] : null;
        };
        ragDiaryPlugin._getWeightedAverageVector = (vectors) => vectors.find(Boolean) || null;
        ragDiaryPlugin._calculateDynamicParams = async () => ({
            k: 1,
            tagWeight: 0.15,
            tagTruncationRatio: 0.5,
            metrics: {}
        });
        ragDiaryPlugin._resolveGhostAnchors = async () => [];
        ragDiaryPlugin._extractContextDiaryPrefixes = () => new Set();
        ragDiaryPlugin._processSingleSystemMessage = async (
            content,
            queryVector,
            userContent,
            aiContent,
            combinedQueryForDisplay,
            dynamicK,
            timeRanges,
            processedDiaries,
            isAIMemoLicensed,
            dynamicTagWeight,
            dynamicTagTruncationRatio,
            metrics,
            historySegments,
            contextDiaryPrefixes,
            messages,
            ghostTags,
            collectedAttachments,
            isFreshTimeConversationStart
        ) => {
            processedCalls.push({
                content,
                queryVector,
                userContent,
                aiContent,
                combinedQueryForDisplay,
                dynamicK,
                isFreshTimeConversationStart
            });
            return `processed:${userContent}`;
        };

        const messages = [
            { role: 'system', content: '请检索 [[测试日记本]]' },
            { role: 'user', content: '真正的问题：请找昨天的部署记录' },
            { role: 'user', content: '[系统通知]当前时间 2026-06-06[系统通知结束]' }
        ];

        const result = await ragDiaryPlugin.processMessages(messages, {});

        assert.deepEqual(embeddedTexts, ['真正的问题：请找昨天的部署记录']);
        assert.equal(processedCalls.length, 1);
        assert.equal(processedCalls[0].userContent, '真正的问题：请找昨天的部署记录');
        assert.equal(processedCalls[0].combinedQueryForDisplay, '真正的问题：请找昨天的部署记录');
        assert.equal(processedCalls[0].isFreshTimeConversationStart, true);
        assert.equal(result[0].content, 'processed:真正的问题：请找昨天的部署记录');
        assert.equal(messages[0].content, '请检索 [[测试日记本]]');
    } finally {
        ragDiaryPlugin.contextVectorManager = originalContextVectorManager;
        ragDiaryPlugin.foldingStore = originalFoldingStore;
        ragDiaryPlugin.ragParams = originalRagParams;
        ragDiaryPlugin.timeParser = originalTimeParser;
        ragDiaryPlugin.getSingleEmbeddingCached = originalGetSingleEmbeddingCached;
        ragDiaryPlugin._getWeightedAverageVector = originalGetWeightedAverageVector;
        ragDiaryPlugin._calculateDynamicParams = originalCalculateDynamicParams;
        ragDiaryPlugin._resolveGhostAnchors = originalResolveGhostAnchors;
        ragDiaryPlugin._extractContextDiaryPrefixes = originalExtractContextDiaryPrefixes;
        ragDiaryPlugin._processSingleSystemMessage = originalProcessSingleSystemMessage;
    }
});
