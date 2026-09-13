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

const baseline = process.env.LIGHTMEMO_BASELINE;
test('T1/T2 legacy omitted and explicit preserve pre-contract full-body golden matrix', async () => {
    const cases = [[hit('Lib/A')], [hit('Lib/A'), hit('Lib/A','second'), hit('Other/A','anchor',.2,'Other')], [hit(null),hit(''),hit('Lib/stale')], []];
    for (const raw of cases) {
        const f = await fixture(raw); await f.write('Lib/A', 'before anchor second after'); await f.write('Other/A','other anchor body');
        const omitted=await f.run(), explicit=await f.run({cold_text_mode:'legacy_full_body'});
        assert.deepEqual(omitted,explicit);
        if (baseline) { const old=load(baseline);old.tdbKnowledgeManager=f.plugin.tdbKnowledgeManager;assert.deepEqual(omitted,json(await old.processToolCall({command:'SearchRAG',query:'q',knowledge_base:'Lib,Other',k:5}))); }
    }
});
test('T3/T4/T5/T6 preview skips every body layer; matrix, seam, order and retrieval stay invariant',async()=>{
    let opens=0;const io={...fs.promises,open:async(...a)=>{opens++;return fs.promises.open(...a);}};
    const f=await fixture([hit('Lib/A','anchor',.1),hit('Lib/A','later',.9),hit('Lib/B','anchor',.4)],source,io);
    await f.write('Lib/A','before anchor later after');await f.write('Lib/B','expanded anchor body');
    let expands=0,reads=0;const expand=f.plugin._expandColdKnowledgeDocs.bind(f.plugin),read=f.plugin._readColdSource.bind(f.plugin);
    f.plugin._expandColdKnowledgeDocs=async d=>{expands++;return expand(d);};f.plugin._readColdSource=async(...a)=>{reads++;return read(...a);};
    const legacy=await f.run({cold_result_mode:'structured'});assert.equal(expands,1);assert.equal(reads,2);assert.equal(opens,2);
    expands=reads=opens=0;
    const preview=await f.run({cold_text_mode:'preview',cold_result_mode:'structured'}), text=await f.run({cold_text_mode:'preview'});
    assert.equal(expands,0);assert.equal(reads,0);assert.equal(opens,0);assert.equal(f.calls.length,3);
    assert.deepEqual(f.calls[0],f.calls[1]);assert.deepEqual(f.calls[1],f.calls[2]);
    assert.deepEqual(preview.result.cold_result,legacy.result.cold_result);assert.deepEqual(preview.result.content,text.result.content);
    assert.deepEqual(preview.result.cold_result.documents.map(d=>d.source_file),['Lib/A','Lib/B']);
    const t=text.result.content[0].text;assert(!t.includes('[内容:'));assert(!t.includes('before anchor'));assert(t.includes('anchor\n'));
    const expected=f.plugin._formatColdKnowledgeResults([{dbName:'Lib',sourceFile:'Lib/A',text:'anchor',hybridScore:.1,vectorScore:.1},{dbName:'Lib',sourceFile:'Lib/B',text:'anchor',hybridScore:.4,vectorScore:.4}],'q',['Lib','Other'],false);
    assert.equal(t,expected);
});
test('T7/T8 invalid mode, Hot and normalized rerank rejection have no retrieval effects',async()=>{
    const f=await fixture([hit('Lib/A')]);
    for(const cold_text_mode of ['full','body','raw','structured',false,null,1,{},'',undefined]) assert.equal((await f.run({cold_text_mode})).plugin_error,'INVALID_COLD_TEXT_MODE');
    for(const rerank of [true,1,.7,'rrf','rrf0.7','true','0.7'])assert.equal((await f.run({rerank,cold_text_mode:'preview'})).plugin_error,'COLD_PREVIEW_TEXT_MODE_REQUIRES_RERANK_FALSE');
    for(const cold_text_mode of ['preview','legacy_full_body'])assert.equal(json(await f.plugin.processToolCall({query:'hot',folder:'Notes',cold_text_mode})).plugin_error,'COLD_TEXT_MODE_REQUIRES_COLD_SCOPE');
    assert.equal(f.calls.length,0);
    if(baseline)for(const args of [{query:'hot',folder:'Notes'},{query:'hot',folder:'Notes',enginemode:'knn'},{command:'tagmemo_ab',query:'hot'}])assert.deepEqual(json(await f.plugin.processToolCall(args)),json(await load(baseline).processToolCall(args)));
    for(const rerank of [false,0,'false','0'])assert(!(await f.run({rerank,cold_text_mode:'preview'})).plugin_error);
});
test('T9/T10 frozen seam/L03 and body-retired preview are independent',async t=>{
    if(!process.env.LIGHTMEMO_SIMULATION_DIR)return t.skip('isolated simulation paths not supplied');
    for(const raw of [[hit('Lib/A'),hit('Lib/A','second'),hit('Lib/B')],[hit(null),hit(''),hit('Lib/A','x'.repeat(14000),NaN)],[]]){
        const f=await fixture(raw);await f.write('Lib/A','anchor second');await f.write('Lib/B','anchor body');
        const args={command:'SearchRAG',query:'q',knowledge_base:'Lib,Other',k:5,cold_result_mode:'structured',cold_text_mode:'preview'};
        const expected=json(await f.plugin.processToolCall(args));
        for(const name of ['LightMemo.body-retired.js','LightMemo.frozen-preview.js']){
            const p=load(path.join(process.env.LIGHTMEMO_SIMULATION_DIR,name));p.tdbKnowledgeManager=f.plugin.tdbKnowledgeManager;
            assert.equal(p._expandColdKnowledgeDocs,undefined);assert.equal(p._readColdSource,undefined);
            const out=json(await p.processToolCall(args));assert.deepEqual(out.result.cold_result,expected.result.cold_result);
            if(name.includes('body-retired'))assert.deepEqual(out.result.content,expected.result.content);
            assert(!out.result.content[0].text.includes('[内容:'));
        }
    }
});
