'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { applyLightMemoCompatibility, searchColdCompatibility } = require('../modules/lightMemoCompatibility');

async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-body-state-'));
  const scope = path.join(root, 'knowledge');
  fs.mkdirSync(scope);
  const source = path.join(scope, 'note.txt');
  fs.writeFileSync(source, 'prefix synthetic anchor suffix');
  const calls = { searches: 0, original: 0, vector: 0 };
  const hits = [{ id: 'synthetic', library: 'Synthetic', text: 'synthetic anchor',
    sourceFile: 'note.txt', score: 0.5 }];
  const memo = {
    tdbKnowledgeManager: { config: { rootPath: scope },
      _resolveLibrary: () => ({ library: 'Synthetic' }),
      async search(_query, options) { calls.searches++; assert.equal(options.expand, false); return hits; } },
    vectorDBManager: { async rerankWithRiverMemoAsync() { calls.vector++; return { results: [] }; } },
    _isTagMemoABRequest: args => args.command === 'tagmemo_ab',
    _isMemoryABRequest: args => ['memory_ab', 'memory-ab', 'memory_compare', 'memory_address_ab'].includes(args.command),
    _detectColdKnowledgeRoute: (query, library) => library ? { query, libraries: ['Synthetic'] } : null,
    _parseEngineMode: () => 'rivermemo',
    async _handleRiverMemoSearch() { return this.vectorDBManager.rerankWithRiverMemoAsync(null, [], {}, {}); },
    async processToolCall(args) { calls.original++; return { result: await this._handleRiverMemoSearch(args) }; }
  };
  const search = options => searchColdCompatibility(memo, {
    query: 'synthetic query', libraries: ['Synthetic'], k: 5, rerank: false,
    coldResultMode: 'structured', coldTextMode: 'legacy_full_body', ...options
  });
  try { await run({ root, scope, source, calls, hits, memo, search }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('structured full-body state preserves the existing preview projection and native expansion metadata', () => fixture(async fx => {
  const result = await fx.search();
  assert.deepEqual(Object.keys(result).sort(), ['cold_body_state', 'cold_result', 'content']);
  assert.deepEqual(result.cold_body_state, {
    schema_version: 1, source_schema_version: 1, stage: 'native_body_state',
    text_mode: 'legacy_full_body', query: 'synthetic query', requested_libraries: ['Synthetic'], k: 5,
    documents: [{ ...result.cold_result.documents[0], body_expanded: true, body_truncated: false,
      body_reason: null, body_range: [0, 30], body_length: 30, returned_text_length: 30 }]
  });
  assert.equal(result.cold_body_state.documents[0].text_preview, 'synthetic anchor');
  assert.match(result.content[0].text, /prefix synthetic anchor suffix/);
  assert.equal(fx.calls.searches, 1, 'metadata must not cause another retrieval');
}));

test('preview and text modes retain their previous response shapes', () => fixture(async fx => {
  const originalOpen = fs.promises.open;
  fs.promises.open = async () => { throw new Error('PREVIEW_MUST_NOT_READ_BODY'); };
  try {
    const preview = await fx.search({ coldTextMode: 'preview' });
    assert.equal(Object.hasOwn(preview, 'cold_body_state'), false);
    assert.equal(preview.cold_result.documents[0].text_preview, 'synthetic anchor');
  } finally { fs.promises.open = originalOpen; }
  const text = await fx.search({ coldResultMode: 'text' });
  assert.equal(typeof text, 'string');
  assert.match(text, /prefix synthetic anchor suffix/);
}));

test('empty and deduplicated results keep body-state rows aligned with selected preview rows', () => fixture(async fx => {
  fx.hits.push({ ...fx.hits[0], id: 'duplicate' });
  const dedup = await fx.search({ k: 1 });
  assert.equal(dedup.cold_result.documents.length, 1);
  assert.equal(dedup.cold_body_state.documents.length, 1);
  assert.equal(dedup.cold_body_state.k, 1);
  fx.hits.length = 0;
  const empty = await fx.search();
  assert.deepEqual(empty.cold_result.documents, []);
  assert.deepEqual(empty.cold_body_state.documents, []);
}));

for (const [scenario, expected] of [
  ['missing_source', 'source_unavailable'], ['parent_path', 'out_of_scope'],
  ['library_mismatch', 'library_mismatch'], ['directory', 'not_regular_file'],
  ['oversized', 'read_limit_exceeded'], ['missing_anchor', 'anchor_missing'],
  ['ambiguous_anchor', 'anchor_ambiguous'], ['missing_file', 'read_failed']
]) {
  test(`body failure ${scenario} exposes only its fixed reason code`, () => fixture(async fx => {
    if (scenario === 'missing_source') fx.hits[0].sourceFile = '';
    if (scenario === 'parent_path') fx.hits[0].sourceFile = '../outside-synthetic.txt';
    if (scenario === 'library_mismatch') fx.memo.tdbKnowledgeManager._resolveLibrary = () => ({ library: 'Other' });
    if (scenario === 'directory') { fs.mkdirSync(path.join(fx.scope, 'directory')); fx.hits[0].sourceFile = 'directory'; }
    if (scenario === 'oversized') fs.writeFileSync(fx.source, 'x'.repeat(256 * 1024 + 1));
    if (scenario === 'missing_anchor') fs.writeFileSync(fx.source, 'unrelated synthetic text');
    if (scenario === 'ambiguous_anchor') fs.writeFileSync(fx.source, 'synthetic anchor' + 'x'.repeat(13000) + 'synthetic anchor');
    if (scenario === 'missing_file') fx.hits[0].sourceFile = 'missing-synthetic.txt';
    const result = await fx.search();
    const doc = result.cold_body_state.documents[0];
    assert.equal(doc.body_expanded, false);
    assert.equal(doc.body_reason, expected);
    assert.equal(doc.body_truncated, false);
    assert.deepEqual(doc.body_range, [0, fx.hits[0].text.length]);
    assert.equal(doc.body_length, fx.hits[0].text.length);
    assert.equal(doc.returned_text_length, fx.hits[0].text.length);
    assert.equal(JSON.stringify(result.cold_body_state).includes(fx.root), false);
  }));
}

test('unknown filesystem diagnostics are not copied into body-state reason metadata', () => fixture(async fx => {
  const originalOpen = fs.promises.open;
  fs.promises.open = async () => { throw new Error('SYNTHETIC_RAW_DIAGNOSTIC_MUST_NOT_PROJECT'); };
  try {
    const result = await fx.search();
    assert.equal(result.cold_body_state.documents[0].body_reason, 'read_failed');
    assert.doesNotMatch(JSON.stringify(result.cold_body_state), /SYNTHETIC_RAW_DIAGNOSTIC/);
    // This patch deliberately leaves the existing legacy text error contract unchanged.
  } finally { fs.promises.open = originalOpen; }
}));

test('changed files retain fail-closed body status without adding another read', () => fixture(async fx => {
  const originalOpen = fs.promises.open;
  let closes = 0;
  fs.promises.open = async (...args) => {
    const handle = await originalOpen(...args);
    return { async stat() { const stat = await handle.stat(); stat.mtimeMs += 1; return stat; },
      read: (...params) => handle.read(...params), async close() { closes++; await handle.close(); } };
  };
  try {
    const result = await fx.search();
    assert.equal(result.cold_body_state.documents[0].body_reason, 'source_changed');
    assert.equal(result.cold_body_state.documents[0].body_expanded, false);
    assert.equal(closes, 1);
  } finally { fs.promises.open = originalOpen; }
}));

test('bounded reads report the existing shared budget without expanding it', () => fixture(async fx => {
  fx.hits.length = 0;
  for (let index = 0; index < 5; index++) {
    const name = `budget-${index}.txt`;
    const anchor = `synthetic-${index}`;
    fs.writeFileSync(path.join(fx.scope, name), anchor.padEnd(256 * 1024, 'x'));
    fx.hits.push({ id: index, library: 'Synthetic', sourceFile: name, text: anchor, score: 0.5 });
  }
  const result = await fx.search();
  assert.deepEqual(result.cold_body_state.documents.map(doc => doc.body_expanded), [true, true, true, true, false]);
  assert.equal(result.cold_body_state.documents[4].body_reason, 'budget_exceeded');
}));

test('truncation metadata uses UTF-16 source ranges without splitting surrogate pairs', () => fixture(async fx => {
  const body = 'x'.repeat(13000) + '😀synthetic anchor😀' + 'y'.repeat(13000);
  fs.writeFileSync(fx.source, body);
  const result = await fx.search();
  const doc = result.cold_body_state.documents[0];
  assert.equal(doc.body_expanded, true);
  assert.equal(doc.body_truncated, true);
  assert.equal(doc.body_length, body.length);
  assert.equal(doc.returned_text_length, doc.body_range[1] - doc.body_range[0]);
  assert.ok(doc.returned_text_length <= 12000);
  assert.doesNotMatch(body.slice(...doc.body_range), /^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u);
  assert.equal(doc.text_preview, 'synthetic anchor');
}));

test('Memory A/B and JEV trace refusals survive the metadata-only compatibility port', () => fixture(async fx => {
  applyLightMemoCompatibility(fx.memo);
  for (const command of ['memory_ab', 'memory-ab', 'memory_compare', 'memory_address_ab']) {
    assert.deepEqual(await fx.memo.processToolCall({ command, include_river_trace: true }),
      { plugin_error: 'RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE' });
    assert.deepEqual(await fx.memo.processToolCall({ command, query: 'synthetic', knowledge_base: 'Synthetic', cold_text_mode: 'preview' }),
      { plugin_error: 'COLD_TEXT_MODE_REQUIRES_COLD_SCOPE' });
    assert.deepEqual(await fx.memo.processToolCall({ command, cold_result_mode: 'structured' }),
      { plugin_error: 'STRUCTURED_COLD_RESULT_REQUIRES_COLD_SCOPE' });
  }
  assert.deepEqual(await fx.memo.processToolCall({ include_river_trace: true, jev: true }),
    { plugin_error: 'RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE' });
  assert.deepEqual(fx.calls, { searches: 0, original: 0, vector: 0 });
}));

test('unsupported trace/Cold/rerank combinations still fail before retrieval', () => fixture(async fx => {
  applyLightMemoCompatibility(fx.memo);
  for (const [options, code] of [
    [{ include_river_trace: true }, 'RIVER_TRACE_REQUIRES_HOT_RIVER_SCOPE'],
    [{ cold_result_mode: 'structured', rerank: true }, 'STRUCTURED_COLD_RESULT_REQUIRES_RERANK_FALSE'],
    [{ cold_text_mode: 'preview', rerank: true }, 'COLD_PREVIEW_TEXT_MODE_REQUIRES_RERANK_FALSE']
  ]) {
    assert.deepEqual(await fx.memo.processToolCall({ query: 'synthetic', knowledge_base: 'Synthetic', ...options }), { plugin_error: code });
  }
  assert.deepEqual(fx.calls, { searches: 0, original: 0, vector: 0 });
}));
