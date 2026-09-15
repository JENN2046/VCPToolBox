'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  applyLightMemoCompatibility,
  dedupeColdKnowledgeDocs,
  parseRiverTraceFlag
} = require('../modules/lightMemoCompatibility.js');

function aiText(text) {
  return { content: [{ type: 'text', text }] };
}

function makeLightMemo({ tdbKnowledgeManager = null, vectorDBManager = null } = {}) {
  const calls = {
    originalProcess: 0,
    tdb: [],
    vector: []
  };
  const lightMemo = {
    tdbKnowledgeManager,
    vectorDBManager,
    _isTagMemoABRequest(args = {}) {
      return String(args.command || '').toLowerCase() === 'tagmemo_ab';
    },
    _detectColdKnowledgeRoute(query, knowledgeBaseArg) {
      if (!this.tdbKnowledgeManager) return null;
      const rawQuery = typeof query === 'string' ? query : '';
      const match = rawQuery.match(/\[\s*知识库\s*(?:[:：]\s*([^\]]+))?\s*\]/u);
      const libraries = [];
      if (match?.[1]) libraries.push(...match[1].split(/[,，|]/u).map(value => value.trim()).filter(Boolean));
      if (knowledgeBaseArg) {
        const values = Array.isArray(knowledgeBaseArg) ? knowledgeBaseArg : String(knowledgeBaseArg).split(/[,，|]/u);
        libraries.push(...values.map(value => String(value).trim()).filter(Boolean));
      }
      if (!match && libraries.length === 0) return null;
      return {
        query: match ? rawQuery.replace(match[0], '').trim() : rawQuery,
        libraries: [...new Set(libraries)]
      };
    },
    _parseNumber(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    },
    _parseRerankOptions(value) {
      if (value === true) return { enabled: true, rrfOptions: null };
      if (value === false || value === undefined || value === null) return { enabled: false, rrfOptions: null };
      if (typeof value === 'string' && value.toLowerCase().startsWith('rrf')) {
        return { enabled: true, rrfOptions: { alpha: 0.5 } };
      }
      return { enabled: false, rrfOptions: null };
    },
    _parseEngineMode(value) {
      return String(value || 'rivermemo').trim().toLowerCase();
    },
    _parseAIMemoOptions(value, preset) {
      return { enabled: Boolean(preset) || value === true || (typeof value === 'string' && value.trim() !== '' && value.toLowerCase() !== 'false') };
    },
    _buildAiFriendlyTextResult(text) {
      return { result: aiText(text) };
    },
    _normalizeToolResult(result) {
      if (typeof result === 'string') return this._buildAiFriendlyTextResult(result);
      if (result && typeof result === 'object' && Array.isArray(result.content)) {
        return { status: 'success', result };
      }
      return result;
    },
    _buildBm25TopIds() {
      return [{ id: 11, score: 0.4 }];
    },
    async _rerankDocuments(query, docs, k) {
      return docs.slice().reverse().slice(0, k).map((doc, index) => ({
        ...doc,
        rerank_score: 1 - index * 0.1
      }));
    },
    async _handleRiverMemoSearch(options) {
      if (!this.vectorDBManager?.rerankWithRiverMemoAsync) {
        return [{ label: 11, text: 'ordinary formatted path', options }];
      }
      const riverResult = await this.vectorDBManager.rerankWithRiverMemoAsync(
        { text: options.actualQuery, vector: options.queryVector },
        options.candidates.map(candidate => ({
          ...candidate,
          id: Number(candidate.label),
          chunkId: Number(candidate.label),
          bm25Score: 0.4
        })),
        {
          agentId: options.maid || null,
          allowedFileIds: [...new Set(options.candidates.map(candidate => Number(candidate.fileId)).filter(Number.isFinite))]
        },
        {
          topK: options.k,
          identityDiaryName: options.maid || null,
          includeTrace: false
        }
      );
      calls.postVectorFormatting = (calls.postVectorFormatting || 0) + 1;
      return riverResult.results.map(item => ({ ...item, formatted: true }));
    },
    async processToolCall(args = {}) {
      calls.originalProcess += 1;
      if ((args.enginemode || args.engineMode || 'rivermemo').toLowerCase() === 'rivermemo') {
        const candidates = args.__testCandidates || [{
          label: 11,
          fileId: 7,
          dbName: 'HotDiary',
          text: 'candidate'
        }];
        const traced = await this._handleRiverMemoSearch({
          query: args.query,
          actualQuery: args.query,
          queryVector: new Float32Array([1, 0]),
          candidates,
          maid: args.maid || null,
          folder: args.folder || null,
          searchAll: false,
          k: Number(args.k || 5),
          rerank: args.rerank || false,
          useBM25: true,
          tagBoost: 0.5,
          coreTags: [],
          coreBoostFactor: 1.33,
          aiMemoOptions: { enabled: false },
          returnResults: false
        });
        return this._normalizeToolResult(traced);
      }
      return this._normalizeToolResult(`delegated:${args.query || ''}`);
    }
  };
  return { lightMemo, calls };
}

test('P6 flag parser is strict and deterministic', () => {
  assert.equal(parseRiverTraceFlag(undefined), false);
  assert.equal(parseRiverTraceFlag(true), true);
  assert.equal(parseRiverTraceFlag('false'), false);
  assert.throws(() => parseRiverTraceFlag('yes'), /INVALID_INCLUDE_RIVER_TRACE/u);
});

test('P6 L03 dedup retains first ordered hit per library/source and preserves source-less hits', () => {
  const docs = [
    { dbName: 'A', sourceFile: 'x.md', text: 'first' },
    { dbName: 'A', sourceFile: 'x.md', text: 'second' },
    { dbName: 'B', sourceFile: 'x.md', text: 'third' },
    { dbName: 'A', sourceFile: '', text: 'source-less-1' },
    { dbName: 'A', sourceFile: '', text: 'source-less-2' }
  ];
  assert.deepEqual(
    dedupeColdKnowledgeDocs(docs).map(item => item.text),
    ['first', 'third', 'source-less-1', 'source-less-2']
  );
});

test('P6 Cold preview structured mode uses TDB preview only and dedups before projection', async () => {
  const manager = {
    config: { rootPath: '/unused' },
    async search(query, options) {
      assert.equal(query, 'needle');
      assert.equal(options.expand, false);
      return [
        { id: 1, library: 'Lib', sourceFile: 'Lib/a.md', text: 'preview-a', score: 0.91 },
        { id: 2, library: 'Lib', sourceFile: 'Lib/a.md', text: 'duplicate-a', score: 0.90 },
        { id: 3, library: 'Lib', sourceFile: 'Lib/b.md', text: 'preview-b', score: 0.80 }
      ];
    }
  };
  const { lightMemo, calls } = makeLightMemo({ tdbKnowledgeManager: manager });
  applyLightMemoCompatibility(lightMemo);

  const result = await lightMemo.processToolCall({
    query: 'needle',
    knowledge_base: 'Lib',
    k: 5,
    rerank: false,
    cold_text_mode: 'preview',
    cold_result_mode: 'structured'
  });

  assert.equal(calls.originalProcess, 0, 'Cold compatibility must not fall through to upstream Hot path');
  assert.equal(result.status, 'success');
  assert.equal(result.result.cold_result.schema_version, 1);
  assert.equal(result.result.cold_result.stage, 'post_tdb_topk');
  assert.equal(result.result.cold_result.rerank_applied, false);
  assert.deepEqual(result.result.cold_result.requested_libraries, ['Lib']);
  assert.deepEqual(
    result.result.cold_result.documents.map(doc => [doc.source_file, doc.text_preview]),
    [['Lib/a.md', 'preview-a'], ['Lib/b.md', 'preview-b']]
  );
  assert.doesNotMatch(result.result.content[0].text, /duplicate-a/u);
});

test('P6 legacy full-body Cold mode expands after dedup and stays inside the library root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p6-cold-'));
  fs.mkdirSync(path.join(root, 'Lib'));
  fs.writeFileSync(path.join(root, 'Lib', 'a.md'), 'prefix\npreview-a\nparent-body-tail\n', 'utf8');

  try {
    let searchOptions;
    const manager = {
      config: { rootPath: root },
      _resolveLibrary(filePath) {
        const relative = path.relative(root, filePath);
        return { library: relative.split(path.sep)[0] };
      },
      async search(_query, options) {
        searchOptions = options;
        return [
          { id: 1, library: 'Lib', sourceFile: 'Lib/a.md', text: 'preview-a', score: 0.91 },
          { id: 2, library: 'Lib', sourceFile: 'Lib/a.md', text: 'preview-a-duplicate', score: 0.90 }
        ];
      }
    };
    const { lightMemo } = makeLightMemo({ tdbKnowledgeManager: manager });
    applyLightMemoCompatibility(lightMemo);
    const result = await lightMemo.processToolCall({
      query: 'needle',
      knowledge_base: 'Lib',
      k: 5,
      rerank: false
    });
    assert.equal(searchOptions.expand, false);
    assert.match(result.result.content[0].text, /parent-body-tail/u);
    assert.match(result.result.content[0].text, /父文档正文/u);
    assert.doesNotMatch(result.result.content[0].text, /preview-a-duplicate/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('P6 Cold compatibility rejects unsupported cross-scope combinations', async () => {
  const manager = { async search() { return []; } };
  const { lightMemo } = makeLightMemo({ tdbKnowledgeManager: manager });
  applyLightMemoCompatibility(lightMemo);

  assert.deepEqual(
    await lightMemo.processToolCall({
      query: 'x', knowledge_base: 'Lib', cold_text_mode: 'preview', rerank: true
    }),
    { plugin_error: 'COLD_PREVIEW_TEXT_MODE_REQUIRES_RERANK_FALSE' }
  );
  assert.deepEqual(
    await lightMemo.processToolCall({
      query: 'x', knowledge_base: 'Lib', cold_result_mode: 'structured', rerank: true
    }),
    { plugin_error: 'STRUCTURED_COLD_RESULT_REQUIRES_RERANK_FALSE' }
  );
  assert.deepEqual(
    await lightMemo.processToolCall({ query: 'hot', maid: 'm', cold_text_mode: 'preview' }),
    { plugin_error: 'COLD_TEXT_MODE_REQUIRES_COLD_SCOPE' }
  );
});

test('P6 River trace returns the exact production result before formatting with no second retrieval', async () => {
  const vectorDBManager = {
    ragParams: { KnowledgeBaseManager: { riverMemo: { candidateSuperset: { bm25K: 10 } } } },
    async rerankWithRiverMemoAsync(query, candidates, agentContext, options) {
      this.calls = (this.calls || 0) + 1;
      assert.equal(query.text, 'river');
      assert.equal(options.includeTrace, true);
      assert.equal(options.identityDiaryName, 'Maid');
      assert.deepEqual(agentContext.allowedFileIds, [7]);
      assert.equal(candidates[0].bm25Score, 0.4);
      return {
        results: [{ id: 11, score: 0.88 }],
        artifactSig: 'artifact-1',
        queryId: 'query-1',
        diagnostics: { trace: ['native'] }
      };
    }
  };
  const { lightMemo, calls } = makeLightMemo({ vectorDBManager });
  applyLightMemoCompatibility(lightMemo);

  const result = await lightMemo.processToolCall({
    query: 'river',
    maid: 'Maid',
    enginemode: 'rivermemo',
    include_river_trace: true,
    rerank: false,
    aimemo: false
  });

  assert.equal(calls.originalProcess, 1);
  assert.equal(vectorDBManager.calls, 1, 'Trace must observe the production call, not issue a second retrieval');
  assert.equal(calls.postVectorFormatting || 0, 0, 'Trace capture must stop before LightMemo formatting');
  assert.equal(result.status, 'success');
  assert.equal(result.result.river_memo_trace.artifactSig, 'artifact-1');
  assert.deepEqual(result.result.river_memo_trace.diagnostics.trace, ['native']);
  assert.match(result.result.content[0].text, /raw trace/u);
});

test('P6 River trace is rejected outside the exact Hot River profile', async () => {
  const { lightMemo } = makeLightMemo({ vectorDBManager: { rerankWithRiverMemoAsync() {} } });
  applyLightMemoCompatibility(lightMemo);
  assert.deepEqual(
    await lightMemo.processToolCall({ query: 'x', maid: 'm', enginemode: 'knn', include_river_trace: true }),
    { plugin_error: 'RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE' }
  );
  assert.deepEqual(
    await lightMemo.processToolCall({ query: 'x', maid: 'm', enginemode: 'rivermemo', include_river_trace: true, rerank: true }),
    { plugin_error: 'RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE' }
  );
});

test('P6 ordinary Hot calls delegate unchanged', async () => {
  const { lightMemo, calls } = makeLightMemo();
  lightMemo._parseEngineMode = () => 'knn';
  applyLightMemoCompatibility(lightMemo);
  const result = await lightMemo.processToolCall({ query: 'hot', maid: 'm', enginemode: 'knn' });
  assert.equal(calls.originalProcess, 1);
  assert.equal(result.result.content[0].text, 'delegated:hot');
});
