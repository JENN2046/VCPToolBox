const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ragDiaryPlugin = require('../Plugin/RAGDiaryPlugin/RAGDiaryPlugin');

test('RAGDiaryPlugin should append Codex recall audit entries only for Codex diaries', async () => {
    const previousLogPath = ragDiaryPlugin.codexRecallAuditLogPath;
    const tempBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-codex-recall-test-'));
    const auditLogPath = path.join(tempBasePath, 'logs', 'codex-memory-recall.jsonl');

    try {
        ragDiaryPlugin.codexRecallAuditLogPath = auditLogPath;

        const payload = ragDiaryPlugin._buildCodexRecallAuditPayload({
            dbName: 'Codex',
            recallType: 'snippet',
            results: [
                { score: 0.91234, source: 'rag', fullPath: 'Codex/2026-04-13-00_00_01.txt', text: 'Memory-ID: codex-process-alpha\nfirst chunk', matchedTags: ['checkpoint', 'pipeline'], coreTagsMatched: ['!codex'] },
                { score: 0.81234, source: 'time', sourceFile: 'Codex/2026-04-12-00_00_01.txt', text: 'Memory-ID: codex-process-beta\nsecond chunk', matchedTags: ['timeline'] }
            ],
            content: 'snippet recall content',
            useTime: true,
            useGroup: true,
            useRerank: false,
            useGeodesicRerank: false,
            coreTags: ['codex', 'memory']
        });

        assert.ok(payload, 'Codex diary should build an audit payload');
        assert.equal(payload.target, 'process');
        assert.equal(payload.resultCount, 2);
        assert.equal(payload.topSourceFile, 'Codex/2026-04-13-00_00_01.txt');
        assert.equal(payload.topMemoryId, 'codex-process-alpha');
        assert.deepEqual(payload.memoryIds, ['codex-process-alpha', 'codex-process-beta']);
        assert.deepEqual(payload.topMatchedTags, ['checkpoint', 'pipeline']);
        assert.deepEqual(payload.matchedTags, ['checkpoint', 'pipeline', 'timeline']);
        assert.deepEqual(payload.coreTags, ['!codex', 'codex', 'memory']);

        await ragDiaryPlugin._recordCodexRecallAudit(payload);

        const ignoredPayload = ragDiaryPlugin._buildCodexRecallAuditPayload({
            dbName: 'Nova',
            recallType: 'snippet',
            results: [{ score: 0.5, source: 'rag', fullPath: 'Nova/2026-04-13.txt' }],
            content: 'should not be logged'
        });
        assert.equal(ignoredPayload, null);

        const raw = await fs.readFile(auditLogPath, 'utf8');
        const entries = raw
            .split(/\r?\n/)
            .filter(Boolean)
            .map(line => JSON.parse(line));

        assert.equal(entries.length, 1);
        assert.equal(entries[0].dbName, 'Codex');
        assert.equal(entries[0].target, 'process');
        assert.equal(entries[0].recallType, 'snippet');
        assert.equal(entries[0].resultCount, 2);
        assert.equal(entries[0].fromCache, false);
        assert.equal(entries[0].topMemoryId, 'codex-process-alpha');
        assert.deepEqual(entries[0].memoryIds, ['codex-process-alpha', 'codex-process-beta']);
        assert.deepEqual(entries[0].matchedTags, ['checkpoint', 'pipeline', 'timeline']);
        assert.deepEqual(entries[0].coreTags, ['!codex', 'codex', 'memory']);
        assert.deepEqual(entries[0].sourceKinds, ['rag', 'time']);
    } finally {
        ragDiaryPlugin.codexRecallAuditLogPath = previousLogPath;
        await fs.rm(tempBasePath, { recursive: true, force: true });
    }
});
