const fs = require('fs').promises;
const path = require('path');

const DEFAULT_AUDIT_WINDOW = 500;
const MAX_AUDIT_BYTES = 1024 * 1024;

const TARGET_TO_DB_NAME = {
    process: 'Codex',
    knowledge: 'Codex的知识'
};

const DEFAULT_CODEX_ADAPTIVE_CONFIG = {
    enabled: true,
    targetHitRate: 0.35,
    minWritesBeforeAdjust: 2,
    lowScoreThreshold: 0.72,
    maxThresholdDrop: 0.08,
    maxTagWeightBoost: 0.12,
    maxKBoost: 2,
    maxTruncationBoost: 0.12,
    thresholdDropScale: 0.18,
    tagWeightBoostScale: 0.24,
    truncationBoostScale: 0.18,
    scoreThresholdScale: 0.08,
    scoreTagWeightScale: 0.12,
    scoreTruncationScale: 0.08,
    kBoostStep: 0.12,
    tagContributionLimit: 10,
    profileWindow: DEFAULT_AUDIT_WINDOW,
    profileBytes: MAX_AUDIT_BYTES
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function pickLaterTimestamp(current, candidate) {
    if (!candidate) return current;
    if (!current) return candidate;

    const currentTime = new Date(current).getTime();
    const candidateTime = new Date(candidate).getTime();
    if (Number.isNaN(currentTime)) return candidate;
    if (Number.isNaN(candidateTime)) return current;
    return candidateTime > currentTime ? candidate : current;
}

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function readRecentJsonlEntries(filePath, maxLines = DEFAULT_AUDIT_WINDOW, maxBytes = MAX_AUDIT_BYTES) {
    if (!(await pathExists(filePath))) return [];

    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    const start = Math.max(0, fileSize - maxBytes);
    const handle = await fs.open(filePath, 'r');

    try {
        const buffer = Buffer.alloc(fileSize - start);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
        let content = buffer.toString('utf8', 0, bytesRead);

        if (start > 0) {
            const firstNewline = content.indexOf('\n');
            content = firstNewline >= 0 ? content.slice(firstNewline + 1) : '';
        }

        return content
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(-maxLines)
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    } finally {
        await handle.close();
    }
}

async function loadProjectRagParams(projectBasePath) {
    const paramsPath = path.join(projectBasePath, 'rag_params.json');
    try {
        const raw = await fs.readFile(paramsPath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function resolveCodexAdaptiveConfig(ragParams = {}) {
    return {
        ...DEFAULT_CODEX_ADAPTIVE_CONFIG,
        ...(ragParams?.RAGDiaryPlugin?.codexAdaptiveRecall || {})
    };
}

function createEmptyDiaryProfile(dbName, target, config) {
    return {
        dbName,
        target,
        enabled: config.enabled !== false,
        writeCount: 0,
        totalHits: 0,
        snippetHits: 0,
        fullTextHits: 0,
        directHits: 0,
        cacheHits: 0,
        avgTopScore: null,
        hitRate: 0,
        thresholdDelta: 0,
        tagWeightDelta: 0,
        kDelta: 0,
        truncationDelta: 0,
        lowScorePenalty: 0,
        lastWriteAt: null,
        lastHitAt: null,
        status: config.enabled === false ? 'disabled' : 'warming',
        reasons: []
    };
}

function createTagContributionBucket(dbName, target, tag) {
    return {
        dbName,
        target,
        tag,
        hitCount: 0,
        matchedHitCount: 0,
        coreHitCount: 0,
        cacheHits: 0,
        avgTopScore: null,
        latestHitAt: null,
        uniqueMemoryCount: 0
    };
}

function buildCodexAdaptiveProfiles({ recallEntries = [], writeEntries = [], config = DEFAULT_CODEX_ADAPTIVE_CONFIG }) {
    const diaries = {
        Codex: createEmptyDiaryProfile('Codex', 'process', config),
        'Codex的知识': createEmptyDiaryProfile('Codex的知识', 'knowledge', config)
    };

    for (const entry of writeEntries) {
        if (entry.decision !== 'accepted') continue;
        const dbName = TARGET_TO_DB_NAME[entry.target];
        if (!dbName || !diaries[dbName]) continue;

        const diary = diaries[dbName];
        diary.writeCount += 1;
        if (typeof entry.timestamp === 'string') {
            diary.lastWriteAt = entry.timestamp > (diary.lastWriteAt || '') ? entry.timestamp : diary.lastWriteAt;
        }
    }

    for (const entry of recallEntries) {
        const dbName = typeof entry.dbName === 'string' ? entry.dbName.trim() : '';
        if (!diaries[dbName]) continue;

        const diary = diaries[dbName];
        diary.totalHits += 1;
        if (entry.recallType === 'snippet') diary.snippetHits += 1;
        if (entry.recallType === 'full_text') diary.fullTextHits += 1;
        if (entry.recallType === 'direct') diary.directHits += 1;
        if (entry.fromCache) diary.cacheHits += 1;
        if (typeof entry.timestamp === 'string') {
            diary.lastHitAt = entry.timestamp > (diary.lastHitAt || '') ? entry.timestamp : diary.lastHitAt;
        }
    }

    for (const dbName of Object.keys(diaries)) {
        const diary = diaries[dbName];
        const scores = recallEntries
            .filter(entry => entry.dbName === dbName && typeof entry.topScore === 'number' && !Number.isNaN(entry.topScore))
            .map(entry => entry.topScore);

        if (scores.length > 0) {
            diary.avgTopScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
        }

        diary.hitRate = diary.writeCount > 0 ? diary.totalHits / diary.writeCount : 0;

        if (config.enabled === false) {
            diary.status = 'disabled';
            diary.reasons.push('自适应调参已关闭');
            continue;
        }

        if (diary.writeCount < config.minWritesBeforeAdjust) {
            diary.status = 'warming';
            diary.reasons.push('样本量不足，暂不调参');
            continue;
        }

        const hitGap = Math.max(0, config.targetHitRate - diary.hitRate);
        const lowScorePenalty = diary.avgTopScore !== null && diary.avgTopScore < config.lowScoreThreshold
            ? (config.lowScoreThreshold - diary.avgTopScore)
            : 0;
        diary.lowScorePenalty = lowScorePenalty;

        if (hitGap <= 0 && lowScorePenalty <= 0) {
            diary.status = 'steady';
            diary.reasons.push('命中率达标，保持当前参数');
            continue;
        }

        diary.thresholdDelta = -clamp(
            hitGap * config.thresholdDropScale + lowScorePenalty * config.scoreThresholdScale,
            0,
            config.maxThresholdDrop
        );
        diary.tagWeightDelta = clamp(
            hitGap * config.tagWeightBoostScale + lowScorePenalty * config.scoreTagWeightScale,
            0,
            config.maxTagWeightBoost
        );
        diary.truncationDelta = clamp(
            hitGap * config.truncationBoostScale + lowScorePenalty * config.scoreTruncationScale,
            0,
            config.maxTruncationBoost
        );
        diary.kDelta = Math.min(
            config.maxKBoost,
            Math.max(
                0,
                Math.round(hitGap / Math.max(config.kBoostStep, 0.01)) + (lowScorePenalty > 0.04 ? 1 : 0)
            )
        );
        diary.status = 'boosted';
        diary.reasons.push(`命中率低于目标 (${diary.hitRate.toFixed(2)} < ${config.targetHitRate.toFixed(2)})`);
        if (lowScorePenalty > 0) {
            diary.reasons.push(`平均 Top 分数偏低 (${diary.avgTopScore.toFixed(3)} < ${config.lowScoreThreshold})`);
        }
    }

    return {
        config,
        profiles: Object.values(diaries)
    };
}

function buildCodexTagContributionInsights({ recallEntries = [], config = DEFAULT_CODEX_ADAPTIVE_CONFIG }) {
    const buckets = new Map();

    for (const entry of recallEntries) {
        const dbName = typeof entry.dbName === 'string' ? entry.dbName.trim() : '';
        const target = dbName === 'Codex'
            ? 'process'
            : dbName === 'Codex的知识'
                ? 'knowledge'
                : null;
        if (!target) continue;

        const matchedTags = new Set(
            (Array.isArray(entry.matchedTags) ? entry.matchedTags : [])
                .filter(tag => typeof tag === 'string' && tag.trim())
                .map(tag => tag.trim())
        );
        const coreTags = new Set(
            (Array.isArray(entry.coreTags) ? entry.coreTags : [])
                .filter(tag => typeof tag === 'string' && tag.trim())
                .map(tag => tag.trim())
        );
        const allTags = new Set([...matchedTags, ...coreTags]);
        if (allTags.size === 0) continue;

        const score = typeof entry.topScore === 'number' && !Number.isNaN(entry.topScore)
            ? entry.topScore
            : null;
        const memoryIds = new Set(
            (Array.isArray(entry.memoryIds) ? entry.memoryIds : [])
                .filter(value => typeof value === 'string' && value.trim())
        );

        for (const tag of allTags) {
            const bucketKey = `${dbName}::${tag}`;
            if (!buckets.has(bucketKey)) {
                buckets.set(bucketKey, {
                    ...createTagContributionBucket(dbName, target, tag),
                    totalTopScore: 0,
                    scoredHits: 0,
                    memoryIds: new Set()
                });
            }

            const bucket = buckets.get(bucketKey);
            bucket.hitCount += 1;
            if (matchedTags.has(tag)) bucket.matchedHitCount += 1;
            if (coreTags.has(tag)) bucket.coreHitCount += 1;
            if (entry.fromCache) bucket.cacheHits += 1;
            bucket.latestHitAt = pickLaterTimestamp(bucket.latestHitAt, entry.timestamp || null);
            if (score !== null) {
                bucket.totalTopScore += score;
                bucket.scoredHits += 1;
            }
            for (const memoryId of memoryIds) {
                bucket.memoryIds.add(memoryId);
            }
        }
    }

    const flat = [...buckets.values()]
        .map(bucket => ({
            dbName: bucket.dbName,
            target: bucket.target,
            tag: bucket.tag,
            hitCount: bucket.hitCount,
            matchedHitCount: bucket.matchedHitCount,
            coreHitCount: bucket.coreHitCount,
            cacheHits: bucket.cacheHits,
            avgTopScore: bucket.scoredHits > 0 ? bucket.totalTopScore / bucket.scoredHits : null,
            latestHitAt: bucket.latestHitAt,
            uniqueMemoryCount: bucket.memoryIds.size
        }))
        .sort((a, b) => {
            if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
            return (b.avgTopScore || 0) - (a.avgTopScore || 0);
        });

    const byDiary = ['Codex', 'Codex的知识'].map(dbName => ({
        dbName,
        target: dbName === 'Codex' ? 'process' : 'knowledge',
        tags: flat.filter(item => item.dbName === dbName).slice(0, config.tagContributionLimit)
    }));

    return {
        flat: flat.slice(0, config.tagContributionLimit),
        byDiary
    };
}

async function getCodexAdaptiveProfile({ projectBasePath, ragParams = null }) {
    const effectiveRagParams = ragParams || await loadProjectRagParams(projectBasePath);
    const config = resolveCodexAdaptiveConfig(effectiveRagParams);
    const recallLogPath = path.join(projectBasePath, 'logs', 'codex-memory-recall.jsonl');
    const writeLogPath = path.join(projectBasePath, 'logs', 'codex-memory-bridge.jsonl');
    const recallEntries = await readRecentJsonlEntries(recallLogPath, config.profileWindow, config.profileBytes);
    const writeEntries = await readRecentJsonlEntries(writeLogPath, config.profileWindow, config.profileBytes);
    const profile = buildCodexAdaptiveProfiles({ recallEntries, writeEntries, config });
    const tagContribution = buildCodexTagContributionInsights({ recallEntries, config });

    return {
        ...profile,
        tagContribution,
        paths: {
            recallLogPath,
            writeLogPath
        }
    };
}

module.exports = {
    DEFAULT_CODEX_ADAPTIVE_CONFIG,
    TARGET_TO_DB_NAME,
    buildCodexAdaptiveProfiles,
    buildCodexTagContributionInsights,
    getCodexAdaptiveProfile,
    loadProjectRagParams,
    readRecentJsonlEntries,
    resolveCodexAdaptiveConfig
};
