'use strict';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;

function request(args) {
    if (!object(args) || args.action !== 'trace_query') throw new Error('INVALID_INSPECTOR_ACTION');
    if (Object.keys(args).some(key => !['action', 'query', 'diaries', 'k', 'bm25'].includes(key))) {
        throw new Error('INVALID_INSPECTOR_ARGUMENT');
    }
    if (typeof args.query !== 'string' || !args.query.trim()) throw new Error('INVALID_INSPECTOR_QUERY');
    let diaries = args.diaries;
    if (typeof diaries === 'string') {
        try { diaries = JSON.parse(diaries); } catch { throw new Error('INVALID_INSPECTOR_DIARIES'); }
    }
    // One entry is one LightMemo folder selector, not a second scope parser.
    if (!Array.isArray(diaries) || !diaries.length || diaries.some(value =>
        typeof value !== 'string' || !value.trim() || /[,，|]/u.test(value))) {
        throw new Error('INVALID_INSPECTOR_DIARIES');
    }
    diaries = diaries.map(value => value.trim());
    const k = args.k === undefined ? 10 : (
        typeof args.k === 'string' && /^\d+$/u.test(args.k.trim()) ? Number(args.k) : args.k
    );
    if (!Number.isSafeInteger(k) || k < 1) throw new Error('INVALID_INSPECTOR_K');
    let bm25 = args.bm25;
    if (typeof bm25 === 'string' && /^(true|false)$/iu.test(bm25.trim())) {
        bm25 = bm25.trim().toLowerCase() === 'true';
    }
    if (bm25 !== undefined && typeof bm25 !== 'boolean') throw new Error('INVALID_INSPECTOR_BM25');
    return { query: args.query, diaries, k, ...(bm25 === undefined ? {} : { bm25 }) };
}

function summarize(raw, input) {
    const knownSchema = raw.schema === 'rivermemo-topology-v3-result-v1';
    return {
        schema_version: 1,
        request: input,
        authority: { retrieval_surface: 'LightMemo', trace_mode: true },
        river: {
            query_id: text(raw.queryId),
            artifact_sig: text(raw.artifactSig),
            omega: number(raw.omega?.omega),
            regime: text(raw.omega?.regime)
        },
        results: raw.results.map(result => ({
            rank: number(result.rank),
            source: text(result.sourceFile),
            subject: text(result.subject),
            score: number(result.score),
            role: text(result.role),
            topology_bonus: number(result.topologyBonus),
            anchor_bonus: number(result.anchorBonus)
        })),
        // Current JS trace projection has aggregate counters only. Unknown
        // schemas remain inspectable through raw_trace; do not infer contacts.
        trace_schema: {
            individual_anchor_contacts_available: knownSchema ? false : null,
            dynamic_anchor_threshold_available: knownSchema ? false : null,
            limitation: knownSchema
                ? 'FIELD_NOT_EXPOSED_BY_CURRENT_TRACE_SCHEMA'
                : 'UNKNOWN_TRACE_SCHEMA'
        },
        raw_trace: raw
    };
}

module.exports = {
    createRuntime({ dependencies }) {
        return {
            start() {
                // Runtime V2 injects dependencies after prepare(), before start().
                if (typeof dependencies?.pluginManager?.processToolCall !== 'function') {
                    throw new Error('LIGHTMEMO_INTERNAL_DISPATCH_UNAVAILABLE');
                }
            },
            async process(args, context = {}) {
                const input = request(args);
                const nativeArgs = {
                    command: 'SearchRAG',
                    query: input.query,
                    folder: input.diaries.join(','),
                    k: input.k,
                    enginemode: 'rivermemo',
                    include_river_trace: true,
                    ...(input.bm25 === undefined ? {} : { bm25: input.bm25 })
                };
                // Preserve normal dispatch approval, privacy and runtime gates.
                // No private LightMemo import or direct retrieval dependency.
                const native = await dependencies.pluginManager.processToolCall(
                    'LightMemo', nativeArgs, context.requestIp ?? null, context.sourceNode ?? null
                );
                if (native?.plugin_error || native?.plugin_execution_error) {
                    throw new Error('LIGHTMEMO_TRACE_UPSTREAM_FAILED');
                }
                if (!object(native) || !Object.hasOwn(native, 'river_memo_trace')) {
                    throw new Error('LIGHTMEMO_TRACE_NOT_RETURNED');
                }
                const raw = native.river_memo_trace;
                if (!object(raw) || !Array.isArray(raw.results) || !raw.results.every(object)) {
                    throw new Error('LIGHTMEMO_TRACE_INVALID');
                }
                return {
                    status: 'success',
                    result: {
                        content: [{ type: 'text', text: 'LightMemo RiverMemo trace; see structured summary and raw_trace.' }],
                        ...summarize(raw, input)
                    }
                };
            }
        };
    }
};
