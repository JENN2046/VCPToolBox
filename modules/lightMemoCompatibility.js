'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');

const TRACE_CONTEXT = new AsyncLocalStorage();
const APPLIED = Symbol.for('vcp.p6.lightmemo.compatibility.v1');

function parseRiverTraceFlag(value) {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'false') return normalized === 'true';
  }
  throw new Error('INVALID_INCLUDE_RIVER_TRACE');
}

function parseColdRerank(lightMemo, rerank) {
  if (typeof lightMemo._parseRerankOptions === 'function') {
    return lightMemo._parseRerankOptions(rerank);
  }
  if (rerank === true) return { enabled: true, rrfOptions: null };
  if (typeof rerank === 'number' && rerank > 0 && rerank <= 1) {
    return { enabled: true, rrfOptions: { alpha: rerank } };
  }
  if (typeof rerank !== 'string') return { enabled: false, rrfOptions: null };
  const normalized = rerank.trim().toLowerCase();
  if (normalized.startsWith('rrf')) {
    const match = normalized.match(/rrf(\d+\.?\d*)/u);
    return {
      enabled: true,
      rrfOptions: { alpha: match ? Math.min(1, Math.max(0, Number(match[1]))) : 0.5 }
    };
  }
  const alpha = Number.parseFloat(normalized);
  if (Number.isFinite(alpha) && alpha > 0 && alpha <= 1) {
    return { enabled: true, rrfOptions: { alpha } };
  }
  return { enabled: normalized === 'true', rrfOptions: null };
}

function dedupeColdKnowledgeDocs(docs) {
  const seen = new Set();
  return docs.filter((doc) => {
    if (!doc.sourceFile) return true;
    const key = JSON.stringify([doc.dbName, doc.sourceFile]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readColdSource(lightMemo, root, configuredRoot, doc, budget) {
  const fail = (message) => {
    const error = new Error(message);
    error.coldBodyReason = message;
    throw error;
  };
  const inside = (relative) => relative
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);

  if (path.isAbsolute(doc.sourceFile) || path.win32.isAbsolute(doc.sourceFile)) {
    fail('源路径超出知识库范围');
  }
  const candidate = path.resolve(root, doc.sourceFile);
  if (!inside(path.relative(root, candidate))) fail('源路径超出知识库范围');
  const canonical = await fs.realpath(candidate);
  const relative = path.relative(root, canonical);
  if (!inside(relative)) fail('源路径超出知识库范围');

  const manager = lightMemo.tdbKnowledgeManager;
  if (typeof manager?._resolveLibrary !== 'function') fail('知识库来源校验不可用');
  const scope = manager._resolveLibrary(path.join(configuredRoot, relative));
  if (scope?.library !== doc.dbName) fail('源路径与命中知识库不一致');

  const before = await fs.stat(canonical);
  if (!before.isFile()) fail('源路径不是普通文件');
  const allowance = Math.min(256 * 1024, budget.remaining);
  if (before.size > allowance) fail('源文件超出单文件或本次剩余读取预算');

  const constants = require('node:fs').constants;
  let handle;
  try {
    const flags = constants.O_RDONLY
      | (constants.O_NOFOLLOW || 0)
      | (constants.O_NONBLOCK || 0);
    handle = await fs.open(canonical, flags);
    const opened = await handle.stat();
    const same = (stat) => stat.isFile()
      && stat.dev === before.dev
      && stat.ino === before.ino
      && stat.size === before.size
      && stat.mtimeMs === before.mtimeMs
      && stat.ctimeMs === before.ctimeMs;
    if (!same(opened)) fail('源文件在读取期间发生变化');

    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const length = Math.min(64 * 1024, buffer.length - offset, budget.remaining);
      if (length <= 0) fail('本次读取预算已用完');
      const { bytesRead } = await handle.read(buffer, offset, length, offset);
      budget.remaining -= bytesRead;
      if (!bytesRead) fail('源文件在读取期间发生变化');
      offset += bytesRead;
    }
    if (!same(await handle.stat())) fail('源文件在读取期间发生变化');
    return buffer.toString('utf8');
  } finally {
    if (handle) await handle.close();
  }
}

async function expandColdKnowledgeDocs(lightMemo, docs) {
  const limit = Math.min(12000, Math.floor(48000 / Math.max(1, docs.length)));
  const budget = { remaining: 1024 * 1024 };
  const configuredRoot = lightMemo.tdbKnowledgeManager?.config?.rootPath;
  let root;
  try {
    if (configuredRoot) root = await fs.realpath(configuredRoot);
  } catch (_) {
    root = null;
  }

  const out = [];
  for (const doc of docs) {
    const preview = String(doc.text || '');
    let text = preview;
    let start = 0;
    let expanded = false;
    let reason;
    try {
      if (!root || !doc.sourceFile) throw new Error('源路径不可用');
      if (!budget.remaining) throw new Error('本次读取预算已用完');
      text = await readColdSource(lightMemo, root, configuredRoot, doc, budget);
      const anchor = preview.trim();
      const at = anchor ? text.indexOf(anchor) : -1;
      if (at < 0) throw new Error('命中预览未在源文件中找到，索引可能已过期');
      if (text.length > limit) {
        if (text.indexOf(anchor, at + 1) !== -1) {
          throw new Error('命中预览在源文件中重复，无法唯一定位');
        }
        start = Math.max(0, Math.min(text.length - limit, at - Math.floor(limit / 4)));
      }
      expanded = true;
    } catch (error) {
      text = preview;
      start = 0;
      reason = error.coldBodyReason || error.message;
    }

    if (start > 0 && /[\uDC00-\uDFFF]/u.test(text[start])) start += 1;
    let end = Math.min(text.length, start + limit);
    if (end > start && /[\uD800-\uDBFF]/u.test(text[end - 1])) end -= 1;
    out.push({
      ...doc,
      text: text.slice(start, end),
      bodyExpanded: expanded,
      bodyReason: reason,
      bodyTruncated: start > 0 || end < text.length,
      bodyRange: [start, end],
      bodyLength: text.length
    });
  }
  return out.filter((doc) => doc.text);
}

function formatScoreMetadata(result, vectorType) {
  let scoreValue = null;
  let scoreType = 'unknown';
  let scoreField = 'none';
  if (typeof result.rerank_score === 'number' && Number.isFinite(result.rerank_score)) {
    scoreValue = result.rerank_score;
    scoreField = 'rerank_score';
    scoreType = result.rerank_failed ? '混合' : 'Rerank';
  } else if (typeof result.hybridScore === 'number' && Number.isFinite(result.hybridScore)) {
    scoreValue = result.hybridScore;
    scoreField = 'hybridScore';
    scoreType = '混合';
  } else if (typeof result.vectorScore === 'number' && Number.isFinite(result.vectorScore)) {
    scoreValue = result.vectorScore;
    scoreField = 'vectorScore';
    scoreType = vectorType || '向量';
  } else if (typeof result.bm25Score === 'number' && Number.isFinite(result.bm25Score)) {
    scoreValue = result.bm25Score;
    scoreField = 'bm25Score';
    scoreType = 'BM25';
  }
  const raw = Number.isFinite(scoreValue) ? scoreValue.toFixed(4) : 'N/A';
  const display = `raw=${raw}; type=${scoreType}; field=${scoreField}; calibrated=false`;
  return { value: scoreValue, display, metadata: display };
}

function formatColdKnowledgeResults(results, query, libraries, includeBodyStatus) {
  if (!results || results.length === 0) {
    const scope = libraries.length > 0 ? libraries.join(', ') : '全部知识库';
    return `关于"${query}"，在冷知识库（${scope}）中没有找到相关内容。`;
  }
  const searchedLibs = [...new Set(results.map((result) => result.dbName))];
  let content = `\n[--- TDB 冷知识库检索 ---]\n`;
  content += `[查询内容: "${query}"]\n`;
  content += `[知识库范围: ${searchedLibs.join(', ')}]\n\n`;
  content += `[找到 ${results.length} 条相关知识片段:]\n`;
  for (const result of results) {
    const score = formatScoreMetadata(result, 'TDB');
    content += `--- (来源: ${result.dbName}, 相关性: ${score.display})\n`;
    content += `    [评分: ${score.metadata}]\n`;
    if (result.sourceFile) content += `    [路径: ${result.sourceFile}]\n`;
    if (includeBodyStatus) {
      const bodyState = result.bodyExpanded
        ? '父文档正文'
        : `预览；未确认取得父文档正文；${result.bodyReason || '正文不可用'}`;
      const range = result.bodyRange || [0, (result.text || '').length];
      const truncation = result.bodyTruncated
        ? `; 已截断，${result.bodyExpanded ? '源文' : '预览'}字符范围 [${range[0]}, ${range[1]}) / ${result.bodyLength}`
        : '';
      content += `    [内容: ${bodyState}${truncation}]\n`;
    }
    content += `${String(result.text || '').trim()}\n\n`;
  }
  content += `\n[--- 知识库检索结束 ---]\n`;
  return content;
}

async function searchColdCompatibility(lightMemo, {
  query,
  libraries,
  k,
  rerank,
  coldResultMode = 'text',
  coldTextMode = 'legacy_full_body'
}) {
  if (!lightMemo.tdbKnowledgeManager) {
    return '冷知识库（TDBKnowledge）未启用或未注入，无法检索。';
  }
  if (!query || !String(query).trim()) throw new Error("冷知识库检索的 'query' 不能为空。");

  const { enabled: useRerank, rrfOptions } = parseColdRerank(lightMemo, rerank);
  if (coldTextMode === 'preview' && useRerank) {
    throw new Error('COLD_PREVIEW_TEXT_MODE_REQUIRES_RERANK_FALSE');
  }
  if (coldResultMode === 'structured' && useRerank) {
    throw new Error('STRUCTURED_COLD_RESULT_REQUIRES_RERANK_FALSE');
  }

  const numericK = typeof lightMemo._parseNumber === 'function'
    ? lightMemo._parseNumber(k, 5)
    : Number(k ?? 5);
  const normalizedK = Math.max(1, Math.floor(Number.isFinite(numericK) ? numericK : 5));
  const previewKey = Symbol('coldPreview');
  const finish = (docs, text) => {
    if (coldResultMode !== 'structured') return text;
    const aiText = typeof lightMemo._buildAiFriendlyTextResult === 'function'
      ? lightMemo._buildAiFriendlyTextResult(text).result
      : { content: [{ type: 'text', text }] };
    return {
      ...aiText,
      cold_result: {
        schema_version: 1,
        stage: 'post_tdb_topk',
        rerank_applied: false,
        query,
        requested_libraries: [...libraries],
        k: normalizedK,
        documents: docs.map((doc, index) => ({
          rank: index + 1,
          library: doc.dbName,
          source_file: typeof doc.sourceFile === 'string'
            && doc.sourceFile
            && !path.isAbsolute(doc.sourceFile)
            && !path.win32.isAbsolute(doc.sourceFile)
            ? doc.sourceFile
            : null,
          text_preview: doc[previewKey].text,
          vector_score: doc[previewKey].score,
          hybrid_score: doc[previewKey].score
        }))
      }
    };
  };

  const fetchK = useRerank ? normalizedK * 3 : normalizedK;
  let hits;
  try {
    hits = await lightMemo.tdbKnowledgeManager.search(query, {
      libraries: libraries.length > 0 ? libraries : undefined,
      topK: fetchK,
      expandDepth: 1,
      minScore: 0.1,
      hybridAlpha: 0.65,
      expand: false
    });
  } catch (error) {
    return `冷知识库检索出错: ${error.message}`;
  }

  if (!hits || hits.length === 0) {
    const scope = libraries.length > 0 ? libraries.join(', ') : '全部知识库';
    return finish([], `关于"${query}"，在冷知识库（${scope}）中没有找到相关内容。`);
  }

  let docs = hits.map((hit) => ({
    dbName: hit.library || '知识库',
    label: hit.id,
    text: hit.text || hit.payload?.text_preview || '',
    sourceFile: hit.sourceFile || hit.payload?.source_path || '',
    vectorScore: typeof hit.score === 'number' ? hit.score : 0,
    hybridScore: typeof hit.score === 'number' ? hit.score : 0,
    ...(coldResultMode === 'structured'
      ? { [previewKey]: { text: String(hit.text || hit.payload?.text_preview || ''), score: Number.isFinite(hit.score) ? hit.score : null } }
      : {})
  })).filter((doc) => doc.text);

  docs = dedupeColdKnowledgeDocs(docs);
  if (coldTextMode === 'legacy_full_body') {
    docs = await expandColdKnowledgeDocs(lightMemo, docs);
  }

  if (useRerank && docs.length > 0) {
    docs.forEach((doc, index) => { doc.retrieval_rank = index + 1; });
    docs = await lightMemo._rerankDocuments(query, docs, normalizedK, rrfOptions);
  } else {
    docs = docs.slice(0, normalizedK);
  }

  return finish(
    docs,
    formatColdKnowledgeResults(docs, query, libraries, coldTextMode !== 'preview')
  );
}

const TRACE_RESULT_CAPTURED = Symbol('p6-river-trace-result-captured');

async function runOriginalRiverMemoTrace(lightMemo, originalRiverMemoSearch, options) {
  const vectorDBManager = lightMemo.vectorDBManager;
  if (!vectorDBManager
    || typeof vectorDBManager.rerankWithRiverMemoAsync !== 'function') {
    const error = new Error('RiverMemo 异步生产接口不可用；请求未回退到其他记忆引擎');
    error.code = 'RIVERMEMO_ASYNC_INTERFACE_UNAVAILABLE';
    throw error;
  }

  const originalVectorCall = vectorDBManager.rerankWithRiverMemoAsync;
  const traceState = TRACE_CONTEXT.getStore();
  const receiver = Object.create(lightMemo);
  const vectorProxy = Object.create(vectorDBManager);

  Object.defineProperty(vectorProxy, 'rerankWithRiverMemoAsync', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: async (...args) => {
      const callArgs = [...args];
      const optionsIndex = 3;
      callArgs[optionsIndex] = {
        ...(callArgs[optionsIndex] || {}),
        includeTrace: true
      };
      const result = await originalVectorCall.apply(vectorDBManager, callArgs);
      if (traceState) traceState.riverMemoResult = result;
      const signal = new Error('P6_RIVER_TRACE_RESULT_CAPTURED');
      signal[TRACE_RESULT_CAPTURED] = true;
      throw signal;
    }
  });
  Object.defineProperty(receiver, 'vectorDBManager', {
    configurable: true,
    enumerable: true,
    writable: false,
    value: vectorProxy
  });

  try {
    await originalRiverMemoSearch.call(receiver, options);
  } catch (error) {
    if (error?.[TRACE_RESULT_CAPTURED] === true) {
      const riverResult = traceState?.riverMemoResult;
      if (!riverResult || !Array.isArray(riverResult.results)) {
        const invalid = new Error('RiverMemo 返回了无效的生产结果');
        invalid.code = 'RIVERMEMO_INVALID_RESULT';
        throw invalid;
      }
      return {
        content: [{ type: 'text', text: 'RiverMemo raw trace (before LightMemo formatting).' }],
        river_memo_trace: riverResult
      };
    }
    throw error;
  }

  throw new Error('RIVER_TRACE_NO_PRODUCTION_RESULT');
}

function applyLightMemoCompatibility(lightMemo) {
  if (!lightMemo || typeof lightMemo.processToolCall !== 'function') {
    throw new Error('P6_LIGHTMEMO_COMPATIBILITY_TARGET_INVALID');
  }
  if (lightMemo[APPLIED] === true) return lightMemo;

  const originalProcessToolCall = lightMemo.processToolCall.bind(lightMemo);
  const originalRiverMemoSearch = typeof lightMemo._handleRiverMemoSearch === 'function'
    ? lightMemo._handleRiverMemoSearch
    : null;

  if (originalRiverMemoSearch) {
    lightMemo._handleRiverMemoSearch = async function p6RiverMemoSearch(options) {
      if (TRACE_CONTEXT.getStore()?.includeRiverTrace === true) {
        return runOriginalRiverMemoTrace(lightMemo, originalRiverMemoSearch, options);
      }
      return originalRiverMemoSearch.call(lightMemo, options);
    };
  }

  lightMemo.processToolCall = async function p6ProcessToolCall(args = {}) {
    try {
      const includeTrace = parseRiverTraceFlag(args.include_river_trace);
      const isTagMemoAB = typeof lightMemo._isTagMemoABRequest === 'function'
        && lightMemo._isTagMemoABRequest(args);
      if (includeTrace && isTagMemoAB) throw new Error('RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE');

      if (Object.hasOwn(args, 'cold_text_mode')
        && !['legacy_full_body', 'preview'].includes(args.cold_text_mode)) {
        throw new Error('INVALID_COLD_TEXT_MODE');
      }
      if (args.cold_result_mode !== undefined
        && !['text', 'structured'].includes(args.cold_result_mode)) {
        throw new Error('INVALID_COLD_RESULT_MODE');
      }
      if (isTagMemoAB && Object.hasOwn(args, 'cold_text_mode')) {
        throw new Error('COLD_TEXT_MODE_REQUIRES_COLD_SCOPE');
      }
      if (isTagMemoAB && args.cold_result_mode === 'structured') {
        throw new Error('STRUCTURED_COLD_RESULT_REQUIRES_COLD_SCOPE');
      }

      const coldRoute = typeof lightMemo._detectColdKnowledgeRoute === 'function'
        ? lightMemo._detectColdKnowledgeRoute(args.query, args.knowledge_base)
        : null;
      if (coldRoute) {
        if (includeTrace) throw new Error('RIVER_TRACE_REQUIRES_HOT_RIVER_SCOPE');
        const result = await searchColdCompatibility(lightMemo, {
          query: coldRoute.query,
          libraries: coldRoute.libraries,
          k: args.k ?? 5,
          rerank: args.rerank ?? false,
          coldResultMode: args.cold_result_mode || 'text',
          coldTextMode: args.cold_text_mode ?? 'legacy_full_body'
        });
        return typeof lightMemo._normalizeToolResult === 'function'
          ? lightMemo._normalizeToolResult(result)
          : result;
      }

      if (Object.hasOwn(args, 'cold_text_mode')) {
        throw new Error('COLD_TEXT_MODE_REQUIRES_COLD_SCOPE');
      }
      if (args.cold_result_mode === 'structured') {
        throw new Error('STRUCTURED_COLD_RESULT_REQUIRES_COLD_SCOPE');
      }

      if (includeTrace) {
        if (!originalRiverMemoSearch) throw new Error('RIVERMEMO_ASYNC_INTERFACE_UNAVAILABLE');
        const engineMode = typeof lightMemo._parseEngineMode === 'function'
          ? lightMemo._parseEngineMode(
            args.engineMode ?? args.enginemode ?? args.memoryEngine ?? args.memory_engine
          )
          : String(args.engineMode ?? args.enginemode ?? 'rivermemo').toLowerCase();
        const rerankOptions = parseColdRerank(lightMemo, args.rerank ?? false);
        const aiMemoOptions = typeof lightMemo._parseAIMemoOptions === 'function'
          ? lightMemo._parseAIMemoOptions(args.aimemo ?? false, args.aimemo_preset ?? null)
          : { enabled: false };
        if (engineMode !== 'rivermemo' || rerankOptions.enabled || aiMemoOptions.enabled) {
          throw new Error('RIVER_TRACE_REQUIRES_SEARCH_RIVER_PROFILE');
        }
        const result = await TRACE_CONTEXT.run(
          { includeRiverTrace: true, riverMemoResult: null },
          () => originalProcessToolCall(args)
        );
        if (result?.plugin_error) return result;
        if (result?.result?.river_memo_trace) return result;
        return { plugin_error: 'RIVER_TRACE_NO_CANDIDATES' };
      }

      return originalProcessToolCall(args);
    } catch (error) {
      return { plugin_error: error.message || String(error) };
    }
  };

  Object.defineProperty(lightMemo, APPLIED, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false
  });
  return lightMemo;
}

module.exports = {
  applyLightMemoCompatibility,
  dedupeColdKnowledgeDocs,
  parseRiverTraceFlag,
  searchColdCompatibility
};
