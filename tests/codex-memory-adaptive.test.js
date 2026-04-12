const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildCodexAdaptiveProfiles, buildCodexTagContributionInsights } = require('../modules/codexMemoryAdaptive');

test('buildCodexAdaptiveProfiles should boost Codex diary when hit rate is below target', () => {
    const result = buildCodexAdaptiveProfiles({
        writeEntries: [
            { decision: 'accepted', target: 'process', timestamp: '2026-04-13T00:00:01.000Z' },
            { decision: 'accepted', target: 'process', timestamp: '2026-04-13T00:00:02.000Z' },
            { decision: 'accepted', target: 'process', timestamp: '2026-04-13T00:00:03.000Z' },
            { decision: 'accepted', target: 'process', timestamp: '2026-04-13T00:00:04.000Z' }
        ],
        recallEntries: [
            { dbName: 'Codex', recallType: 'snippet', topScore: 0.61, fromCache: false, timestamp: '2026-04-13T00:10:00.000Z' }
        ]
    });

    const codexProfile = result.profiles.find(item => item.dbName === 'Codex');
    const knowledgeProfile = result.profiles.find(item => item.dbName === 'Codex的知识');

    assert.ok(codexProfile);
    assert.equal(codexProfile.status, 'boosted');
    assert.ok(codexProfile.thresholdDelta < 0);
    assert.ok(codexProfile.tagWeightDelta > 0);
    assert.ok(codexProfile.kDelta >= 1);
    assert.ok(codexProfile.truncationDelta > 0);

    assert.ok(knowledgeProfile);
    assert.equal(knowledgeProfile.status, 'warming');
});

test('buildCodexTagContributionInsights should aggregate matched and core tags', () => {
    const result = buildCodexTagContributionInsights({
        recallEntries: [
            {
                dbName: 'Codex',
                target: 'process',
                matchedTags: ['checkpoint', 'pipeline'],
                coreTags: ['codex'],
                memoryIds: ['codex-process-alpha'],
                topScore: 0.88,
                timestamp: '2026-04-13T00:10:00.000Z'
            },
            {
                dbName: 'Codex',
                target: 'process',
                matchedTags: ['checkpoint'],
                coreTags: ['codex'],
                memoryIds: ['codex-process-beta'],
                topScore: 0.92,
                timestamp: '2026-04-13T00:11:00.000Z'
            }
        ]
    });

    assert.equal(result.flat.length, 3);
    assert.equal(result.flat[0].tag, 'checkpoint');
    assert.equal(result.flat[0].hitCount, 2);
    assert.equal(result.flat[0].matchedHitCount, 2);
    assert.equal(result.flat[0].coreHitCount, 0);
    assert.equal(result.flat[0].uniqueMemoryCount, 2);
});
