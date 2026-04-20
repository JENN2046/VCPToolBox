const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { searchCodexMemory } = require('../modules/codexMemorySearch');
const { KNOWLEDGE_DIARY_NAME, PROCESS_DIARY_NAME } = require('../modules/codexMemoryConstants');

test('searchCodexMemory should normalize results and append recall audit entries', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vcp-codex-search-test-'));
    const processFile = path.join(tempRoot, PROCESS_DIARY_NAME, '2026-04-13-00_00_01.txt');
    const knowledgeFile = path.join(tempRoot, KNOWLEDGE_DIARY_NAME, '2026-04-13-00_00_02.txt');
    const auditPayloads = [];

    await fs.mkdir(path.dirname(processFile), { recursive: true });
    await fs.mkdir(path.dirname(knowledgeFile), { recursive: true });
    await fs.writeFile(processFile, 'Memory-ID: codex-process-123\nTitle: Process checkpoint\nType: checkpoint\npipeline is green', 'utf8');
    await fs.writeFile(knowledgeFile, 'Memory-ID: codex-knowledge-456\nTitle: Knowledge rule\nReusable note body', 'utf8');

    const knowledgeBaseManager = {
        config: { rootPath: tempRoot },
        async search(dbName) {
            if (dbName === PROCESS_DIARY_NAME) {
                return [
                    {
                        text: 'Memory-ID: codex-process-123\nTitle: Process checkpoint\nType: checkpoint\npipeline is green',
                        score: 0.92,
                        fullPath: `${PROCESS_DIARY_NAME}/2026-04-13-00_00_01.txt`,
                        matchedTags: ['checkpoint', 'pipeline']
                    }
                ];
            }

            return [
                {
                    text: 'Memory-ID: codex-knowledge-456\nTitle: Knowledge rule\nReusable note body',
                    score: 0.78,
                    fullPath: `${KNOWLEDGE_DIARY_NAME}/2026-04-13-00_00_02.txt`,
                    matchedTags: ['rule']
                }
            ];
        }
    };

    const ragDiaryPlugin = {
        async getSingleEmbeddingCached(text) {
            assert.equal(text, 'find the saved checkpoint');
            return [0.1, 0.2, 0.3];
        },
        _buildCodexRecallAuditPayload({ dbName, recallType, results }) {
            return {
                dbName,
                target: dbName === PROCESS_DIARY_NAME ? 'process' : 'knowledge',
                recallType,
                resultCount: results.length
            };
        },
        async _recordCodexRecallAudit(payload, overrides) {
            auditPayloads.push({ payload, overrides });
        },
        _stripCodexMemoryMarkers(text) {
            return text.replace(/^Memory-ID:\s*[A-Za-z0-9-]+\n?/m, '').trim();
        },
        _extractMemoryIdsFromText(text) {
            const match = text.match(/Memory-ID:\s*([A-Za-z0-9-]+)/);
            return match ? [match[1]] : [];
        }
    };

    try {
        const results = await searchCodexMemory({
            query: 'find the saved checkpoint',
            target: 'both',
            limit: 5,
            includeContent: true,
            knowledgeBaseManager,
            ragDiaryPlugin
        });

        assert.equal(results.length, 2);
        assert.equal(results[0].target, 'process');
        assert.equal(results[0].memoryId, 'codex-process-123');
        assert.equal(results[0].title, 'Process checkpoint');
        assert.match(results[0].content, /pipeline is green/);
        assert.equal(results[1].target, 'knowledge');
        assert.equal(results[1].memoryId, 'codex-knowledge-456');
        assert.equal(results[1].sourceFile, `${KNOWLEDGE_DIARY_NAME}/2026-04-13-00_00_02.txt`);
        assert.equal(auditPayloads.length, 2);
        assert.equal(auditPayloads[0].overrides.source, 'mcp');
        assert.equal(auditPayloads[1].payload.resultCount, 1);
    } finally {
        await fs.rm(tempRoot, { recursive: true, force: true });
    }
});

test('searchCodexMemory should reject empty queries', async () => {
    await assert.rejects(
        () => searchCodexMemory({
            query: '   ',
            knowledgeBaseManager: {},
            ragDiaryPlugin: {}
        }),
        /non-empty string/
    );
});
