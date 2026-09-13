'use strict';
const crypto = require('node:crypto');
const d = require('./durable');
const artifacts = require('./artifacts');
const textIndex = require('./text-index');
const {fingerprint} = require('./snapshot');
function eq(a, b, code) {
    if (d.digest(a) !== d.digest(b))
        d.fail(code);
}
function mapValue(m) {
    return [...m].map(([k, v]) => [
        k,
        v instanceof Map ? [...v].sort((a, b) => a[0] - b[0]) : Array.isArray(v) ? [...v].sort((a, b) => a - b) : v
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}
function lossless(content, chunks) {
    let frontier = 0;
    for (const chunk of chunks) {
        if (!chunk.length)
            d.fail('EMPTY_CHUNK');
        let pos = content.indexOf(chunk), best = -1;
        while (pos >= 0) {
            if (pos > frontier && content.slice(frontier, pos).trim())
                break;
            if (pos + chunk.length > frontier)
                best = Math.max(best, pos + chunk.length);
            pos = content.indexOf(chunk, pos + 1);
        }
        if (best < 0)
            d.fail('LOSSY_CANONICAL_CHUNKS');
        frontier = best;
    }
    if (content.slice(frontier).trim())
        d.fail('MISSING_CANONICAL_CONTENT');
}
async function verify(runtime, job, {store, knowledge, snapshot, expectedReceipt = null}) {
    const m = runtime.manager, library = job.library, main = d.path.join(store, library + '.tdb');
    const observed = fingerprint(m, library, knowledge);
    if (knowledge !== m.config.rootPath) {
        if (observed.excluded.length)
            d.fail('EXTRA_CANDIDATE_SOURCE');
        observed.excluded = snapshot.excluded;
    }
    eq(d.digest({
        library: observed.library,
        files: observed.files,
        excluded: observed.excluded,
        recipe: observed.recipe
    }), snapshot.fingerprint, 'VERIFY_SOURCE_MISMATCH');
    const family = artifacts.bundle(store, library), rows = artifacts.metadata(store, library);
    if (artifacts.pending(store, library))
        d.fail('VERIFY_PENDING_WORK');
    if (expectedReceipt) {
        eq(family, expectedReceipt.artifacts, 'SEALED_ARTIFACT_CHANGED');
        eq(rows, expectedReceipt.metadata, 'SEALED_METADATA_CHANGED');
    }
    const text = textIndex.inspect(store, main);
    if (!text.valid)
        d.fail('VERIFY_TEXT_STRUCTURE');
    const TriviumDB = runtime.native;
    const opts = {
        dim: m.config.dimension,
        dtype: 'f32',
        storageMode: 'mmap',
        loadTextIndex: true,
        autoBuildQuiver: false,
        accessMode: 'readOnly',
        missingIndexPolicy: 'fallback'
    };
    const db = new TriviumDB(main, opts);
    let expected;
    try {
        const info = db.storageInfo(), count = Number(info.node_count);
        if (!Number.isSafeInteger(count) || count > (runtime.options.maxVerifyNodes ?? 100000))
            d.fail('VERIFY_NODE_BUDGET');
        const vector = Array(m.config.dimension).fill(0);
        vector[0] = 1;
        const nodes = db.searchExact(vector, Math.max(count + 1, 1));
        if (nodes.length !== count)
            d.fail('INCOMPLETE_NATIVE_ENUMERATION');
        const byId = new Map(nodes.map(n => [
            n.id,
            n
        ]));
        if (byId.size !== count)
            d.fail('DUPLICATE_NATIVE_ID');
        const mapped = [
            ...rows.files.map(f => f.doc_node_id),
            ...rows.chunks.map(c => c.node_id)
        ];
        eq([...byId.keys()].sort((a, b) => a - b), [...new Set(mapped)].sort((a, b) => a - b), 'ORPHAN_NATIVE');
        if (new Set(mapped).size !== mapped.length)
            d.fail('DUPLICATE_MAPPING');
        eq(rows.files.map(f => f.path).sort(), snapshot.files.filter(f => f.disposition === 'INDEX').map(f => f.path).sort(), 'SOURCE_COVERAGE');
        const scratch = runtime.jobPath(job, 'verification-' + crypto.randomUUID());
        d.mkdir(runtime.root, scratch);
        const expectedMain = d.path.join(scratch, 'expected.tdb');
        expected = new TriviumDB(expectedMain, {
            ...opts,
            accessMode: 'readWrite'
        });
        const expectedEdges = [], probes = [], owned = new Set();
        for (const source of snapshot.files) {
            if (source.disposition === 'NO_TEXT_EXPECTED')
                continue;
            const content = new TextDecoder('utf-8', { fatal: true }).decode(d.read(knowledge, d.path.join(knowledge, source.path)));
            const chunks = runtime.chunkText(content).filter(Boolean);
            lossless(content, chunks);
            const file = rows.files.find(f => f.path === source.path), doc = byId.get(file.doc_node_id)?.payload;
            if (!doc || doc.type !== 'document' || doc.library !== library || doc.source_path !== source.path || doc.checksum !== source.hash || doc.chunk_count !== chunks.length || file.checksum !== source.hash || file.size !== source.size)
                d.fail('DOCUMENT_IDENTITY');
            const chunkRows = rows.chunks.filter(c => c.path === source.path).sort((a, b) => a.chunk_index - b.chunk_index);
            if (chunkRows.length !== chunks.length)
                d.fail('CHUNK_COVERAGE');
            expected.insertWithId(file.doc_node_id, vector, {});
            const title = d.path.basename(source.path, d.path.extname(source.path));
            if (title.length >= 2)
                expected.indexKeyword(file.doc_node_id, title);
            for (let i = 0; i < chunks.length; i++) {
                const row = chunkRows[i], node = byId.get(row.node_id), payload = node?.payload;
                if (row.chunk_index !== i || row.checksum !== d.hash(chunks[i]) || !payload || payload.type !== 'chunk' || payload.library !== library || payload.source_path !== source.path || payload.chunk_index !== i || payload.checksum !== row.checksum || payload.text_preview !== chunks[i].slice(0, 500))
                    d.fail('CHUNK_IDENTITY');
                const key = d.digest([
                    source.path,
                    i
                ]);
                if (owned.has(key))
                    d.fail('DUPLICATE_CHUNK');
                owned.add(key);
                expected.insertWithId(row.node_id, vector, {});
                expected.indexText(row.node_id, chunks[i]);
                if (title.length >= 2)
                    expected.indexKeyword(row.node_id, title);
                expectedEdges.push([
                    file.doc_node_id,
                    row.node_id,
                    'contains',
                    1,
                    null
                ]);
                if (i) {
                    expectedEdges.push([
                        chunkRows[i - 1].node_id,
                        row.node_id,
                        'next',
                        0.7,
                        null
                    ], [
                        row.node_id,
                        chunkRows[i - 1].node_id,
                        'prev',
                        0.7,
                        null
                    ]);
                }
            }
        }
        eq(text.docIds, rows.chunks.map(c => c.node_id).sort((a, b) => a - b), 'TEXT_ID_COVERAGE');
        for (const id of byId.keys()) {
            const v = db.get(id)?.vector;
            if (!v || v.length !== m.config.dimension || !Array.from(v).every(Number.isFinite))
                d.fail('INVALID_VECTOR');
        }
        const edges = [];
        for (const id of byId.keys())
            for (const e of db.getEdges(id))
                edges.push([
                    id,
                    e.targetId,
                    e.label,
                    Math.round(e.weight * 1000000) / 1000000,
                    e.metadata ?? null
                ]);
        eq(edges.sort(), expectedEdges.sort(), 'UNOWNED_GRAPH_REFERENCE');
        expected.buildTextIndex();
        expected.flush();
        expected.close();
        expected = null;
        const canonicalText = textIndex.inspect(scratch, expectedMain);
        if (!canonicalText.valid)
            d.fail('CANONICAL_INDEX_INVALID');
        eq(mapValue(text.postings), mapValue(canonicalText.postings), 'STALE_OR_MISSING_POSTING');
        eq(mapValue(text.lengths), mapValue(canonicalText.lengths), 'TEXT_LENGTH_MISMATCH');
        eq(mapValue(text.keywords), mapValue(canonicalText.keywords), 'KEYWORD_OWNERSHIP');
        // Complete posting equivalence is the negative gate for obsolete/orphan terms, not just a sampled query.
        for (const file of rows.files) {
            const ids = new Set(rows.chunks.filter(c => c.path === file.path).map(c => c.node_id));
            const terms = [...canonicalText.postings].filter(([, map]) => [...map.keys()].some(id => ids.has(id))).map(([term]) => term);
            if (!terms.length)
                d.fail('NO_SEMANTIC_PROBE');
            const body = new TextDecoder('utf-8', { fatal: true }).decode(d.read(knowledge, d.path.join(knowledge, file.path))).toLowerCase();
            const tail = terms.find(term => body.slice(500).includes(term) && !body.slice(0, 500).includes(term));
            for (const term of [...new Set([
                        terms[0],
                        terms[terms.length - 1],
                        ...tail ? [tail] : []
                    ])]) {
                const hits = db.searchHybrid(vector, term, Math.max(count + 1, 1), 0, 1.01, 0, {
                    type: 'chunk',
                    source_path: file.path
                });
                if (!hits.some(h => ids.has(h.id) && h.score > 1))
                    d.fail('SEMANTIC_PROBE_FAILED');
                probes.push({
                    source: file.path,
                    probe_id: d.hash(term),
                    kind: term === tail ? 'long_tail' : 'per_source',
                    pass: true
                });
            }
        }
        const allTerms = [...canonicalText.postings.keys()];
        const multiHits = db.searchHybrid(vector, allTerms.join(' '), Math.max(count + 1, 1), 0, 1.01, 0, { type: 'chunk' });
        if (rows.files.some(file => !multiHits.some(hit => hit.payload?.source_path === file.path && hit.score > 1)))
            d.fail('MULTI_SOURCE_PROBE_FAILED');
        const absent = 'recoveryabsent' + d.digest(snapshot).slice(0, 32);
        if (db.searchHybrid(vector, absent, Math.max(count + 1, 1), 0, 1.01, 0, { type: 'chunk' }).length)
            d.fail('OBSOLETE_NEGATIVE_PROBE_FAILED');
        probes.push({
            kind: 'multi_source',
            pass: true,
            source_count: rows.files.length,
            probe_id: d.digest(allTerms)
        });
        probes.push({
            kind: 'obsolete_negative',
            pass: true,
            probe_id: d.hash(absent)
        });
        probes.push({
            kind: 'orphan_negative',
            pass: true,
            orphan_count: 0
        });
        return {
            pass: true,
            job_id: job.job_id,
            generation: job.candidate_generation,
            source: snapshot.fingerprint,
            recipe: d.digest(snapshot.recipe),
            artifacts: family,
            metadata: rows,
            source_count: rows.files.length,
            chunk_count: rows.chunks.length,
            node_count: count,
            orphan_count: 0,
            duplicate_count: 0,
            canonical_content: true,
            exact_postings: true,
            graph_ownership: true,
            semantic_probes: probes
        };
    } finally {
        if (expected)
            expected.close();
        db.close();
    }
}
module.exports = {
    verify,
    lossless
};
