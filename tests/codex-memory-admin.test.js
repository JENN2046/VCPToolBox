const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const codexMemoryRoute = require('../routes/admin/codexMemory');
const { KNOWLEDGE_DIARY_NAME, PROCESS_DIARY_NAME } = require('../modules/codexMemoryConstants');

test('codex-memory admin overview should include recall audit summary and recent hits', async () => {
    const tempBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-codex-admin-test-'));
    const logsDir = path.join(tempBasePath, 'logs');
    const dailyNoteRootPath = path.join(tempBasePath, 'dailynote');
    const processDiaryPath = path.join(dailyNoteRootPath, PROCESS_DIARY_NAME);
    const knowledgeDiaryPath = path.join(dailyNoteRootPath, KNOWLEDGE_DIARY_NAME);
    const auditLogPath = path.join(logsDir, 'codex-memory-bridge.jsonl');
    const recallLogPath = path.join(logsDir, 'codex-memory-recall.jsonl');

    await fs.mkdir(logsDir, { recursive: true });
    await fs.mkdir(processDiaryPath, { recursive: true });
    await fs.mkdir(knowledgeDiaryPath, { recursive: true });
    await fs.writeFile(path.join(processDiaryPath, '2026-04-13-00_00_01.txt'), 'process note', 'utf8');
    await fs.writeFile(path.join(knowledgeDiaryPath, '2026-04-13-00_00_02.txt'), 'knowledge note', 'utf8');

    await fs.writeFile(auditLogPath, [
        JSON.stringify({
            timestamp: '2026-04-13T00:00:01.000Z',
            decision: 'accepted',
            target: 'process',
            title: 'process memory A',
            memoryId: 'codex-process-alpha',
            reason: 'accepted',
            filePath: path.join(processDiaryPath, '2026-04-13-00_00_01.txt'),
            agentAlias: 'Codex',
            agentId: 'test-agent'
        }),
        JSON.stringify({
            timestamp: '2026-04-13T00:00:02.000Z',
            decision: 'rejected',
            target: 'knowledge',
            reason: 'sensitive content is blocked',
            filePath: null,
            agentAlias: 'Codex',
            agentId: 'test-agent'
        })
    ].join('\n') + '\n', 'utf8');

    await fs.writeFile(recallLogPath, [
        JSON.stringify({
            timestamp: '2026-04-13T00:10:00.000Z',
            dbName: PROCESS_DIARY_NAME,
            target: 'process',
            recallType: 'snippet',
            resultCount: 2,
            topScore: 0.91,
            topMemoryId: 'codex-process-alpha',
            topMatchedTags: ['checkpoint'],
            matchedTags: ['checkpoint', 'pipeline'],
            coreTags: ['codex'],
            topSourceFile: `${PROCESS_DIARY_NAME}/2026-04-13-00_00_01.txt`,
            memoryIds: ['codex-process-alpha'],
            sourceFiles: [`${PROCESS_DIARY_NAME}/2026-04-13-00_00_01.txt`],
            fromCache: false,
            sourceKinds: ['rag']
        }),
        JSON.stringify({
            timestamp: '2026-04-13T00:11:00.000Z',
            dbName: KNOWLEDGE_DIARY_NAME,
            target: 'knowledge',
            recallType: 'full_text',
            resultCount: 1,
            topScore: null,
            topMemoryId: 'codex-knowledge-beta',
            topSourceFile: null,
            memoryIds: ['codex-knowledge-beta'],
            sourceFiles: [],
            fromCache: true,
            sourceKinds: []
        })
    ].join('\n') + '\n', 'utf8');

    const app = express();
    app.use(codexMemoryRoute({ dailyNoteRootPath, projectBasePath: tempBasePath }));

    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/codex-memory/overview?limit=10&auditWindow=500`);
        assert.equal(response.status, 200);

        const data = await response.json();

        assert.equal(data.paths.auditLogPath, auditLogPath);
        assert.equal(data.paths.recallLogPath, recallLogPath);
        assert.equal(data.summary.accepted, 1);
        assert.equal(data.summary.rejected, 1);
        assert.equal(data.summary.sensitiveRejected, 1);

        assert.equal(data.recall.available, true);
        assert.equal(data.recall.status, 'active');
        assert.equal(data.recall.summary.totalHits, 2);
        assert.equal(data.recall.summary.processHits, 1);
        assert.equal(data.recall.summary.knowledgeHits, 1);
        assert.equal(data.recall.summary.snippetHits, 1);
        assert.equal(data.recall.summary.fullTextHits, 1);
        assert.equal(data.recall.summary.cacheHits, 1);
        assert.equal(data.recall.recent.length, 2);
        assert.equal(data.recall.recent[0].target, 'knowledge');
        assert.equal(data.recall.recent[1].topSourceFile, `${PROCESS_DIARY_NAME}/2026-04-13-00_00_01.txt`);
        assert.equal(data.adaptive.config.enabled, true);
        assert.equal(data.adaptive.profiles.length, 2);
        assert.equal(data.adaptive.profiles[0].dbName, PROCESS_DIARY_NAME);
        assert.equal(data.adaptive.tagContribution.flat.length, 3);
        assert.equal(data.adaptive.tagContribution.flat[0].tag, 'checkpoint');
        assert.equal(data.memoryLinks.length, 1);
        assert.equal(data.memoryLinks[0].memoryId, 'codex-process-alpha');
        assert.equal(data.memoryLinks[0].title, 'process memory A');
        assert.equal(data.memoryLinks[0].recallCount, 1);
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await fs.rm(tempBasePath, { recursive: true, force: true });
    }
});
