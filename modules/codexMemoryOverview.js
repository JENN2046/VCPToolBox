const fs = require('fs').promises;
const path = require('path');

const { getCodexAdaptiveProfile } = require('./codexMemoryAdaptive');
const { PROCESS_DIARY_NAME, KNOWLEDGE_DIARY_NAME } = require('./codexMemoryConstants');

const DEFAULT_AUDIT_WINDOW = 500;
const DEFAULT_LIST_LIMIT = 10;
const MAX_AUDIT_BYTES = 1024 * 1024;

function toInt(value, fallback, min = 1, max = 200) {
    const parsed = parseInt(String(value || ''), 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
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
    const start = Math.max(0, stats.size - maxBytes);
    const handle = await fs.open(filePath, 'r');

    try {
        const buffer = Buffer.alloc(stats.size - start);
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

async function listRecentDiaryFiles(dirPath, limit = DEFAULT_LIST_LIMIT) {
    if (!(await pathExists(dirPath))) return [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        files.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
            updatedAt: stats.mtime.toISOString()
        });
    }

    return files
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
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

function normalizeFileKey(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) return null;

    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }

    return normalized;
}

function buildRecordLabel(entry) {
    if (typeof entry.title === 'string' && entry.title.trim()) {
        return entry.title.trim();
    }

    if (typeof entry.filePath === 'string' && entry.filePath.trim()) {
        return path.basename(entry.filePath.trim());
    }

    return 'Untitled memory';
}

function summarizeReasons(entries) {
    const buckets = new Map();

    for (const entry of entries) {
        const reason = typeof entry.reason === 'string' && entry.reason.trim()
            ? entry.reason.trim()
            : 'No recorded reason';
        buckets.set(reason, (buckets.get(reason) || 0) + 1);
    }

    return Array.from(buckets.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
}

function buildWriteSummary(entries) {
    const summary = {
        sampleSize: entries.length,
        accepted: 0,
        rejected: 0,
        processAccepted: 0,
        knowledgeAccepted: 0,
        processRejected: 0,
        knowledgeRejected: 0,
        blockedDirectWrites: 0,
        sensitiveRejected: 0,
        latestAcceptedAt: null,
        latestRejectedAt: null
    };

    for (const entry of entries) {
        const decision = entry.decision;
        const target = entry.target;
        const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : null;
        const reason = typeof entry.reason === 'string' ? entry.reason : '';

        if (decision === 'accepted') {
            summary.accepted += 1;
            summary.latestAcceptedAt = pickLaterTimestamp(summary.latestAcceptedAt, timestamp);
            if (target === 'process') summary.processAccepted += 1;
            if (target === 'knowledge') summary.knowledgeAccepted += 1;
        }

        if (decision === 'rejected') {
            summary.rejected += 1;
            summary.latestRejectedAt = pickLaterTimestamp(summary.latestRejectedAt, timestamp);
            if (target === 'process') summary.processRejected += 1;
            if (target === 'knowledge') summary.knowledgeRejected += 1;
            if (/CodexMemoryBridge/.test(reason)) summary.blockedDirectWrites += 1;
            if (/sensitive|sensitivity|secret|\u654f\u611f/i.test(reason)) summary.sensitiveRejected += 1;
        }
    }

    return summary;
}

function buildRecallSummary(entries) {
    const summary = {
        sampleSize: entries.length,
        totalHits: 0,
        processHits: 0,
        knowledgeHits: 0,
        snippetHits: 0,
        fullTextHits: 0,
        directHits: 0,
        cacheHits: 0,
        latestHitAt: null,
        latestProcessHitAt: null,
        latestKnowledgeHitAt: null
    };

    for (const entry of entries) {
        const target = entry.target;
        const recallType = entry.recallType;
        const timestamp = typeof entry.timestamp === 'string' ? entry.timestamp : null;

        summary.totalHits += 1;
        summary.latestHitAt = pickLaterTimestamp(summary.latestHitAt, timestamp);

        if (entry.fromCache) summary.cacheHits += 1;

        if (target === 'process') {
            summary.processHits += 1;
            summary.latestProcessHitAt = pickLaterTimestamp(summary.latestProcessHitAt, timestamp);
        }

        if (target === 'knowledge') {
            summary.knowledgeHits += 1;
            summary.latestKnowledgeHitAt = pickLaterTimestamp(summary.latestKnowledgeHitAt, timestamp);
        }

        if (recallType === 'snippet') summary.snippetHits += 1;
        if (recallType === 'full_text') summary.fullTextHits += 1;
        if (recallType === 'direct') summary.directHits += 1;
    }

    return summary;
}

function normalizeAuditEntries(entries, limit) {
    return [...entries]
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
        .slice(0, limit)
        .map(entry => ({
            timestamp: entry.timestamp || null,
            decision: entry.decision || 'unknown',
            target: entry.target || null,
            title: entry.title || null,
            memoryId: entry.memoryId || null,
            reason: entry.reason || '',
            filePath: entry.filePath || null,
            agentAlias: entry.agentAlias || null,
            agentId: entry.agentId || null
        }));
}

function normalizeRecallEntries(entries, limit) {
    return [...entries]
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
        .slice(0, limit)
        .map(entry => ({
            timestamp: entry.timestamp || null,
            dbName: entry.dbName || null,
            target: entry.target || null,
            recallType: entry.recallType || 'unknown',
            resultCount: Number.isFinite(entry.resultCount) ? entry.resultCount : 0,
            topScore: Number.isFinite(entry.topScore) ? entry.topScore : null,
            topMemoryId: entry.topMemoryId || null,
            topMatchedTags: Array.isArray(entry.topMatchedTags) ? entry.topMatchedTags : [],
            matchedTags: Array.isArray(entry.matchedTags) ? entry.matchedTags : [],
            coreTags: Array.isArray(entry.coreTags) ? entry.coreTags : [],
            topSourceFile: entry.topSourceFile || null,
            memoryIds: Array.isArray(entry.memoryIds) ? entry.memoryIds : [],
            fromCache: !!entry.fromCache,
            sourceKinds: Array.isArray(entry.sourceKinds) ? entry.sourceKinds : [],
            sourceFiles: Array.isArray(entry.sourceFiles) ? entry.sourceFiles : []
        }));
}

function buildMemoryLinks(writeEntries, recallEntries, limit = DEFAULT_LIST_LIMIT) {
    const records = new Map();
    const aliasToRecordKey = new Map();

    for (const entry of writeEntries) {
        if (entry.decision !== 'accepted') continue;

        const memoryId = typeof entry.memoryId === 'string' && entry.memoryId.trim() ? entry.memoryId.trim() : null;
        const fileKey = normalizeFileKey(entry.filePath);
        const recordKey = memoryId ? `id:${memoryId}` : (fileKey ? `path:${fileKey}` : null);
        if (!recordKey) continue;

        if (!records.has(recordKey)) {
            records.set(recordKey, {
                memoryId,
                title: buildRecordLabel(entry),
                target: entry.target || null,
                filePath: entry.filePath || null,
                writtenAt: entry.timestamp || null,
                recallCount: 0,
                cacheRecallCount: 0,
                lastRecallAt: null,
                lastTopScore: null
            });
        }

        if (memoryId) aliasToRecordKey.set(`id:${memoryId}`, recordKey);
        if (fileKey) aliasToRecordKey.set(`path:${fileKey}`, recordKey);
    }

    for (const entry of recallEntries) {
        const aliases = new Set();

        if (typeof entry.topMemoryId === 'string' && entry.topMemoryId.trim()) {
            aliases.add(`id:${entry.topMemoryId.trim()}`);
        }

        if (Array.isArray(entry.memoryIds)) {
            for (const memoryId of entry.memoryIds) {
                if (typeof memoryId === 'string' && memoryId.trim()) {
                    aliases.add(`id:${memoryId.trim()}`);
                }
            }
        }

        if (typeof entry.topSourceFile === 'string' && entry.topSourceFile.trim()) {
            aliases.add(`path:${normalizeFileKey(entry.topSourceFile)}`);
        }

        if (Array.isArray(entry.sourceFiles)) {
            for (const sourceFile of entry.sourceFiles) {
                const fileKey = normalizeFileKey(sourceFile);
                if (fileKey) aliases.add(`path:${fileKey}`);
            }
        }

        const recordKeys = new Set(
            [...aliases]
                .map(alias => aliasToRecordKey.get(alias))
                .filter(Boolean)
        );

        for (const recordKey of recordKeys) {
            const record = records.get(recordKey);
            if (!record) continue;

            record.recallCount += 1;
            if (entry.fromCache) record.cacheRecallCount += 1;
            record.lastRecallAt = pickLaterTimestamp(record.lastRecallAt, entry.timestamp || null);
            if (typeof entry.topScore === 'number' && !Number.isNaN(entry.topScore)) {
                record.lastTopScore = entry.topScore;
            }
        }
    }

    return [...records.values()]
        .sort((a, b) => {
            if ((b.recallCount || 0) !== (a.recallCount || 0)) {
                return (b.recallCount || 0) - (a.recallCount || 0);
            }
            return new Date(b.lastRecallAt || 0).getTime() - new Date(a.lastRecallAt || 0).getTime();
        })
        .slice(0, limit);
}

function buildRecallStatus(summary) {
    if (!summary || summary.totalHits === 0) {
        return {
            available: true,
            status: 'enabled',
            message: 'Recall auditing is enabled. No Codex memory hits are present in the current window.'
        };
    }

    return {
        available: true,
        status: 'active',
        message: `Recall auditing is enabled. The current window contains ${summary.totalHits} Codex memory hits.`
    };
}

function resolveOverviewPaths({ projectBasePath, dailyNoteRootPath }) {
    return {
        auditLogPath: path.join(projectBasePath, 'logs', 'codex-memory-bridge.jsonl'),
        recallLogPath: path.join(projectBasePath, 'logs', 'codex-memory-recall.jsonl'),
        processDiaryPath: path.join(dailyNoteRootPath, PROCESS_DIARY_NAME),
        knowledgeDiaryPath: path.join(dailyNoteRootPath, KNOWLEDGE_DIARY_NAME)
    };
}

async function buildCodexMemoryOverview({
    projectBasePath,
    dailyNoteRootPath,
    auditWindow = DEFAULT_AUDIT_WINDOW,
    listLimit = DEFAULT_LIST_LIMIT
}) {
    const paths = resolveOverviewPaths({ projectBasePath, dailyNoteRootPath });
    const auditEntries = await readRecentJsonlEntries(paths.auditLogPath, auditWindow);
    const recallEntries = await readRecentJsonlEntries(paths.recallLogPath, auditWindow);
    const recallSummary = buildRecallSummary(recallEntries);

    return {
        paths,
        summary: buildWriteSummary(auditEntries),
        recentAudit: normalizeAuditEntries(auditEntries, listLimit),
        rejectionReasons: summarizeReasons(auditEntries.filter(entry => entry.decision === 'rejected')).slice(0, 8),
        recentFiles: {
            process: await listRecentDiaryFiles(paths.processDiaryPath, listLimit),
            knowledge: await listRecentDiaryFiles(paths.knowledgeDiaryPath, listLimit)
        },
        memoryLinks: buildMemoryLinks(auditEntries, recallEntries, listLimit),
        adaptive: await getCodexAdaptiveProfile({ projectBasePath }),
        recall: {
            ...buildRecallStatus(recallSummary),
            summary: recallSummary,
            recent: normalizeRecallEntries(recallEntries, listLimit)
        }
    };
}

module.exports = {
    DEFAULT_AUDIT_WINDOW,
    DEFAULT_LIST_LIMIT,
    MAX_AUDIT_BYTES,
    buildCodexMemoryOverview,
    pathExists,
    readRecentJsonlEntries,
    resolveOverviewPaths,
    summarizeReasons,
    toInt
};
