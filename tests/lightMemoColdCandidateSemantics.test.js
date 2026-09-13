const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// All DB/provider/filesystem fixtures are isolated. Never initialize the plugin.
const source = process.env.LIGHTMEMO_TEST_SOURCE || path.join(__dirname, '../Plugin/LightMemo/LightMemo.js');
const json = value => JSON.parse(JSON.stringify(value));
function load(file = source, io = fs.promises, provider = null) {
    const context = {module: {exports: {}}, Buffer, URL, process: {env: {}}, __dirname: path.dirname(file),
        console: {log() {}, warn() {}, error() {}}, setTimeout, clearTimeout,
        require(name) {
            if (name === 'fs') return {...fs, promises: io};
            if (name === 'path') return path;
            if (name === 'axios') return provider || {post() {throw Error('External provider forbidden');}};
            if (name === '@node-rs/jieba') return {Jieba: class {cut(s) {return [s];}}};
            if (name === '@node-rs/jieba/dict') return {dict: {}};
            throw Error('Unexpected dependency: ' + name);
        }};
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
    return context.module.exports;
}
async function fixture(raw = [], file = source, io, provider) {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lightmemo-cold-candidates-'));
    await fs.promises.mkdir(path.join(root, 'Lib')); await fs.promises.mkdir(path.join(root, 'Other'));
    const plugin = load(file, io, provider), calls = [];
    plugin.tdbKnowledgeManager = {config: {rootPath: root},
        _resolveLibrary: p => ({library: path.relative(root, p).split(path.sep)[0]}),
        search: async (q, opts) => {calls.push(json(opts)); return raw.slice(0, opts.topK);}};
    const write = (name, body) => fs.promises.writeFile(path.join(root, name), body);
    const run = async (args = {}) => json(await plugin.processToolCall({command: 'SearchRAG', query: 'q', knowledge_base: 'Lib,Other', k: 5, ...args}));
    return {root, plugin, write, run, calls};
}
const hit = (sourceFile, text = 'anchor', score = .6, library = 'Lib') => ({sourceFile, text, score, library});

test('L03 exact golden matrix: first occurrence, library dimension, falsy sources and object identity', () => {
    const p = load();
    const docs = [
        {id: 0, dbName: 'Lib', sourceFile: 'Lib/A', text: 'first', score: .1},
        {id: 1, dbName: 'Lib', sourceFile: 'Lib/A', text: 'second', score: .99},
        {id: 2, dbName: 'Lib', sourceFile: 'Lib/B', text: 'first'},
        {id: 3, dbName: 'Other', sourceFile: 'Other/A', text: 'first'},
        {id: 4, dbName: 'Other', sourceFile: 'Lib/A', text: 'first'},
        {id: 5, dbName: 'Lib'}, {id: 6, dbName: 'Lib'},
        {id: 7, dbName: 'Lib', sourceFile: null}, {id: 8, dbName: 'Lib', sourceFile: null},
        {id: 9, dbName: 'Lib', sourceFile: ''}, {id: 10, dbName: 'Lib', sourceFile: ''},
        {id: 11, dbName: 'Lib', sourceFile: false}, {id: 12, dbName: 'Lib', sourceFile: 0}
    ];
    const before = structuredClone(docs), output = p._dedupeColdKnowledgeDocs(docs);
    assert.deepEqual(Array.from(output, d => d.id), [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const d of output) assert.equal(d, docs[d.id]);
    assert.deepEqual(docs, before); assert.notEqual(output, docs);
    assert.deepEqual(Array.from(p._dedupeColdKnowledgeDocs([])), []);
});

test('exactly one candidate dedup precedes body, rerank and seam; body helper no longer dedups', async () => {
    const f = await fixture([hit('Lib/A', 'first', .1), hit('Lib/A', 'second', .99), hit('Lib/B', 'anchor')]);
    await f.write('Lib/A', 'first then second'); await f.write('Lib/B', 'before anchor after');
    const order = [], dedup = f.plugin._dedupeColdKnowledgeDocs.bind(f.plugin), expand = f.plugin._expandColdKnowledgeDocs.bind(f.plugin);
    f.plugin._dedupeColdKnowledgeDocs = docs => {order.push('dedup'); return dedup(docs);};
    f.plugin._expandColdKnowledgeDocs = async docs => {order.push('body'); assert.equal(docs.length, 2); return expand(docs);};
    const out = await f.run({cold_result_mode: 'structured'});
    assert.deepEqual(order, ['dedup', 'body']);
    assert.deepEqual(out.result.cold_result.documents.map(d => d.source_file), ['Lib/A', 'Lib/B']);
    assert.equal(out.result.cold_result.documents[0].text_preview, 'first');
    assert.equal(out.result.cold_result.documents[0].hybrid_score, .1);
    assert.ok(out.result.content[0].text.includes('first then second'));
    const standalone = await expand([{dbName: 'Lib', sourceFile: 'Lib/A', text: 'first'}, {dbName: 'Lib', sourceFile: 'Lib/A', text: 'second'}]);
    assert.equal(standalone.length, 2, 'body helper must not hide another dedup step');
});

test('default/text/structured preserve native body, parser gates and exact TDB arguments', async () => {
    const f = await fixture([hit('Lib/A')]); await f.write('Lib/A', 'before anchor after');
    const omitted = await f.run(), text = await f.run({cold_result_mode: 'text'}), structured = await f.run({cold_result_mode: 'structured'});
    assert.deepEqual(omitted, text); assert.deepEqual(text.result.content, structured.result.content);
    assert.equal(text.result.cold_result, undefined);
    const cold = structured.result.cold_result;
    assert.equal(cold.schema_version, 1); assert.equal(cold.stage, 'post_tdb_topk'); assert.equal(cold.rerank_applied, false);
    assert.deepEqual(f.calls[0], {libraries: ['Lib', 'Other'], topK: 5, expandDepth: 1, minScore: .1, hybridAlpha: .65, expand: false});
    for (const rerank of [true, 1, .7, 'rrf', 'rrf0.7']) {
        const out = await f.run({rerank, cold_result_mode: 'structured'});
        assert.equal(out.plugin_error, 'STRUCTURED_COLD_RESULT_REQUIRES_RERANK_FALSE');
    }
});

test('rerank receives deduped expanded body and still selects B; no external API', async () => {
    let received;
    const provider = {post: async (url, body) => {
        received = body.documents;
        return {data: {results: body.documents.map((text, index) => ({index, relevance_score: text.includes('BODY_SIGNAL') ? .99 : .1}))}};
    }};
    const f = await fixture([hit('Lib/A'), hit('Lib/A', 'anchor', .5), hit('Lib/B')], source, undefined, provider);
    await f.write('Lib/A', 'anchor ordinary'); await f.write('Lib/B', 'anchor BODY_SIGNAL');
    f.plugin.rerankConfig = {url: 'https://fixture.invalid/', apiKey: 'fixture', model: 'fixture', maxTokens: 100000};
    const out = await f.run({rerank: true, k: 1});
    assert.deepEqual(Array.from(received), ['anchor ordinary', 'anchor BODY_SIGNAL']);
    assert.ok(out.result.content[0].text.includes('[路径: Lib/B]')); assert.equal(f.calls[0].topK, 3);
});

test('body containment: safe symlink, outside/cross-library, directory, FIFO, stale source', async () => {
    const names = ['safe', 'outside', 'cross', 'dir', 'fifo', 'missing'];
    const f = await fixture(names.map(n => hit('Lib/' + n)));
    await f.write('Lib/target', 'anchor body'); await f.write('Other/target', 'anchor other');
    await fs.promises.symlink('target', path.join(f.root, 'Lib/safe'));
    const outside = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lightmemo-outside-')), 'file'); await fs.promises.writeFile(outside, 'anchor');
    await fs.promises.symlink(outside, path.join(f.root, 'Lib/outside'));
    await fs.promises.symlink('../Other/target', path.join(f.root, 'Lib/cross'));
    await fs.promises.mkdir(path.join(f.root, 'Lib/dir')); execFileSync('mkfifo', [path.join(f.root, 'Lib/fifo')]);
    const docs = names.map(n => ({dbName: 'Lib', sourceFile: 'Lib/' + n, text: 'anchor'}));
    const out = await f.plugin._expandColdKnowledgeDocs(f.plugin._dedupeColdKnowledgeDocs(docs));
    assert.deepEqual(Array.from(out, d => d.bodyExpanded), [true, false, false, false, false, false]);
    for (const sourceFile of ['../escape', 'Lib/../../escape', f.root + '-sibling/file']) {
        const [d] = await f.plugin._expandColdKnowledgeDocs([{dbName: 'Lib', sourceFile, text: 'anchor'}]);
        assert.equal(d.bodyExpanded, false); assert.equal(d.bodyReason, '源路径超出知识库范围');
    }
});

test('body budgets remain 256KiB/file, 1MiB/request, 64KiB/chunk and UTF16 output bounds', async () => {
    const requested = []; let bytes = 0;
    const io = {...fs.promises, open: async (...args) => {
        const h = await fs.promises.open(...args);
        return {stat: () => h.stat(), close: () => h.close(), read: async (...args) => {
            requested.push(args[2]); const out = await h.read(...args); bytes += out.bytesRead; return out;
        }};
    }};
    const f = await fixture([], source, io), docs = [];
    for (let i = 0; i < 5; i++) {await f.write('Lib/' + i, 'anchor' + 'x'.repeat(262144 - 6)); docs.push({dbName: 'Lib', sourceFile: 'Lib/' + i, text: 'anchor'});}
    const out = await f.plugin._expandColdKnowledgeDocs(docs);
    assert.equal(bytes, 1048576); assert.ok(requested.every(n => n <= 65536)); assert.equal(out[4].bodyExpanded, false);
    assert.ok(out.slice(0, 4).every(d => d.text.length === 9600));
    await f.write('Lib/over', 'anchor' + 'x'.repeat(262145 - 6));
    assert.equal((await f.plugin._expandColdKnowledgeDocs([{dbName: 'Lib', sourceFile: 'Lib/over', text: 'anchor'}]))[0].bodyExpanded, false);
    await f.write('Lib/surrogate', 'anchor' + 'x'.repeat(11993) + '😀tail');
    const [d] = await f.plugin._expandColdKnowledgeDocs([{dbName: 'Lib', sourceFile: 'Lib/surrogate', text: 'anchor'}]);
    assert.deepEqual(Array.from(d.bodyRange), [0, 11999]); assert.ok(!/[\uD800-\uDBFF]$/.test(d.text));
});

test('body anchors retain unique/long/stale/ambiguous/short-duplicate behavior', async () => {
    const f = await fixture();
    for (const [name, body, anchor, expanded] of [
        ['unique', 'before anchor after', 'anchor', true], ['long', 'x'.repeat(14000) + 'anchor' + 'y'.repeat(14000), 'anchor', true],
        ['stale', 'new body', 'old', false], ['ambiguous', 'anchor anchor' + 'x'.repeat(14000), 'anchor', false],
        ['short-duplicate', 'anchor anchor', 'anchor', true], ['multiline', '头\n一行\n二行😀\n尾', '一行\n二行😀', true]]) {
        await f.write('Lib/' + name, body);
        const [d] = await f.plugin._expandColdKnowledgeDocs([{dbName: 'Lib', sourceFile: 'Lib/' + name, text: anchor}]);
        assert.equal(d.bodyExpanded, expanded, name); if (!expanded) assert.equal(d.text, anchor);
    }
});

test('stat→replace and read→mutate fail safely on actual Core reader', async () => {
    for (const mode of ['replace', 'mutate']) {
        const io = {...fs.promises, open: async (p, flags) => {
            if (mode === 'replace') {await fs.promises.rename(p, p + '.old'); await fs.promises.writeFile(p, 'anchor replacement');}
            const h = await fs.promises.open(p, flags);
            if (mode === 'replace') return h;
            return {stat: () => h.stat(), close: () => h.close(), read: async (...args) => {
                const out = await h.read(...args); await fs.promises.appendFile(p, '!'); return out;
            }};
        }};
        const f = await fixture([], source, io); await f.write('Lib/A', 'anchor original');
        const [d] = await f.plugin._expandColdKnowledgeDocs([{dbName: 'Lib', sourceFile: 'Lib/A', text: 'anchor'}]);
        assert.equal(d.bodyExpanded, false); assert.equal(d.text, 'anchor'); assert.equal(d.bodyReason, '源文件在读取期间发生变化');
    }
});

module.exports = {load, fixture, hit};
