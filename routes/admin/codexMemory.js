const express = require('express');
const fs = require('fs').promises;
const path = require('path');

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

function summarizeReasons(entries) {
    const buckets = new Map();
    for (const entry of entries) {
        const reason = typeof entry.reason === 'string' && entry.reason.trim()
            ? entry.reason.trim()
            : '未记录原因';
        buckets.set(reason, (buckets.get(reason) || 0) + 1);
    }

    return Array.from(buckets.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
}

function buildSummary(entries) {
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
            if (!summary.latestAcceptedAt) summary.latestAcceptedAt = timestamp;
            if (target === 'process') summary.processAccepted += 1;
            if (target === 'knowledge') summary.knowledgeAccepted += 1;
        }

        if (decision === 'rejected') {
            summary.rejected += 1;
            if (!summary.latestRejectedAt) summary.latestRejectedAt = timestamp;
            if (target === 'process') summary.processRejected += 1;
            if (target === 'knowledge') summary.knowledgeRejected += 1;
            if (reason.includes('必须改用 CodexMemoryBridge')) summary.blockedDirectWrites += 1;
            if (reason.includes('敏感')) summary.sensitiveRejected += 1;
        }
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
            reason: entry.reason || '',
            filePath: entry.filePath || null,
            agentAlias: entry.agentAlias || null,
            agentId: entry.agentId || null
        }));
}

module.exports = function (options) {
    const router = express.Router();
    const { dailyNoteRootPath } = options;
    const projectBasePath = path.join(__dirname, '..', '..');
    const auditLogPath = path.join(projectBasePath, 'logs', 'codex-memory-bridge.jsonl');
    const processDiaryPath = path.join(dailyNoteRootPath, 'Codex');
    const knowledgeDiaryPath = path.join(dailyNoteRootPath, 'Codex的知识');

    router.get('/codex-memory/overview', async (req, res) => {
        try {
            const auditWindow = toInt(req.query.auditWindow, DEFAULT_AUDIT_WINDOW, 10, 2000);
            const listLimit = toInt(req.query.limit, DEFAULT_LIST_LIMIT, 1, 50);
            const auditEntries = await readRecentJsonlEntries(auditLogPath, auditWindow);
            const normalizedEntries = normalizeAuditEntries(auditEntries, listLimit);

            res.json({
                paths: {
                    auditLogPath,
                    processDiaryPath,
                    knowledgeDiaryPath
                },
                summary: buildSummary(normalizedEntries),
                recentAudit: normalizedEntries,
                rejectionReasons: summarizeReasons(normalizedEntries.filter(entry => entry.decision === 'rejected')).slice(0, 8),
                recentFiles: {
                    process: await listRecentDiaryFiles(processDiaryPath, listLimit),
                    knowledge: await listRecentDiaryFiles(knowledgeDiaryPath, listLimit)
                },
                recall: {
                    available: false,
                    status: 'unavailable',
                    message: '当前版本未对 Codex 召回命中单独做审计记录。'
                }
            });
        } catch (error) {
            console.error('[AdminAPI] Error building Codex memory overview:', error);
            res.status(500).json({ error: 'Failed to load Codex memory overview', details: error.message });
        }
    });

    return router;
};
