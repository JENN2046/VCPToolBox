'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { core, cr, acorn, methods, load, raw, lightFixture, discoverLegacyManifestRecordsFromRoot } = require('./harness.cjs');
const request = { action: 'trace_query', query: 'exam evidence', diaries: ['Fixture', 'Other'], k: 2 };
const json = value => JSON.parse(JSON.stringify(value));

test('T1/T2 real discovery, generation prepare/start and injected internal dispatch', async t => {
    const value = raw(), received = [];
    const h = await load(t, { processToolCall(args, ctx){ received.push({ args, ctx }); return { status: 'success', result: { content: [], river_memo_trace: value } }; } });
    assert.equal(h.records.length, 1);
    assert.equal(h.records[0].manifest.runtimeLifecycle, 2);
    assert.equal(h.generation.runtimes.get('RiverMemoInspector').started, true);
    const result = await h.pm.processToolCall('RiverMemoInspector', request, 'fixture-ip', 'fixture-node');
    assert.deepEqual(h.calls.map(c => c.toolName), ['RiverMemoInspector', 'LightMemo']);
    assert.equal(received.length, 1);
    assert.equal(received[0].ctx.requestIp, 'fixture-ip');
    assert.equal(received[0].ctx.sourceNode, 'fixture-node');
    assert.equal(result.raw_trace, value);
    assert.equal(result.authority.retrieval_surface, 'LightMemo');
    assert.ok(result.content.length);
});

test('T3/T4 exact native flags and argument mapping; native text input is supported', async t => {
    const received = [];
    const h = await load(t, { processToolCall(args){ received.push(json(args)); return { river_memo_trace: raw() }; } });
    for (const bm25 of [undefined, true, false, 'false']) {
        await h.pm.processToolCall('RiverMemoInspector', { ...request, diaries: '["Fixture","Other"]', k: '2', ...(bm25 === undefined ? {} : { bm25 }) });
        assert.deepEqual(received.at(-1), { command: 'SearchRAG', query: request.query, folder: 'Fixture,Other', k: 2,
            enginemode: 'rivermemo', include_river_trace: true, ...(bm25 === undefined ? {} : { bm25: bm25 === true }) });
    }
});

test('T5/T6 raw identity, order, unknown fields and null summary fields; no score calculation', async t => {
    const value = raw(), snapshot = json(value);
    const h = await load(t, { processToolCall(){ return { river_memo_trace: value }; } });
    const out = await h.pm.processToolCall('RiverMemoInspector', request);
    assert.equal(out.raw_trace, value); assert.deepEqual(value, snapshot);
    assert.deepEqual(out.raw_trace.future_trace_field, { x: 1 });
    assert.deepEqual(out.results.map(r => r.rank), [1, 2]);
    assert.deepEqual(out.results.map(r => r.source), ['Fixture/9.txt', 'Fixture/5.txt']);
    assert.deepEqual(out.results.map(r => r.score), value.results.map(r => r.score));
    assert.ok(out.results.every(r => r.subject === null));
    for (const key of ['topologyV3', 'relativeTopology', 'geometry', 'observables']) assert.ok(out.raw_trace.results[0][key]);
    assert.ok(out.raw_trace.sourceObservation.syntheticSentinelOnly);
    assert.equal(out.river.omega, 0.02);
});

test('T7 missing/invalid trace and upstream failure are explicit failures, no fallback query', async t => {
    for (const [value, error] of [
        [{ content: [] }, 'LIGHTMEMO_TRACE_NOT_RETURNED'],
        [undefined, 'LIGHTMEMO_TRACE_NOT_RETURNED'],
        [{ river_memo_trace: null }, 'LIGHTMEMO_TRACE_INVALID'],
        [{ river_memo_trace: { results: [null] } }, 'LIGHTMEMO_TRACE_INVALID'],
        [{ plugin_error: 'fixture retrieval failure' }, 'LIGHTMEMO_TRACE_UPSTREAM_FAILED']
    ]) {
        const h = await load(t, { processToolCall(){ return value; } });
        await assert.rejects(h.pm.processToolCall('RiverMemoInspector', request), e => e.message.includes(error));
        assert.equal(h.calls.filter(c => c.toolName === 'LightMemo').length, 1);
    }
    const h = await load(t, { processToolCall(){ throw Error('FIXTURE_UPSTREAM_REJECTION'); } });
    await assert.rejects(h.pm.processToolCall('RiverMemoInspector', request), /FIXTURE_UPSTREAM_REJECTION/);
});

test('T8 schema limitations are explicit; future raw schema remains intact without inferred availability', async t => {
    const value = raw();
    const h = await load(t, { processToolCall(){ return { river_memo_trace: value }; } });
    const out = await h.pm.processToolCall('RiverMemoInspector', request);
    assert.deepEqual(json(out.trace_schema), { individual_anchor_contacts_available: false,
        dynamic_anchor_threshold_available: false, limitation: 'FIELD_NOT_EXPOSED_BY_CURRENT_TRACE_SCHEMA' });
    value.schema = 'future-schema';
    const future = await h.pm.processToolCall('RiverMemoInspector', request);
    assert.equal(future.trace_schema.individual_anchor_contacts_available, null);
    assert.equal(future.trace_schema.limitation, 'UNKNOWN_TRACE_SCHEMA');
    assert.equal(future.raw_trace, value);
});

test('T9/T10 plugin has no imports, second runtime, data access, persistence, alternate actions or arbitrary dispatch', async t => {
    const source = fs.readFileSync(path.join(__dirname, '../source/RiverMemoInspector.js'), 'utf8');
    const tree = acorn.parse(source, { ecmaVersion: 'latest' });
    const calls = [], constructors = [];
    function walk(n) { if (!n || typeof n !== 'object') return; if (n.type === 'CallExpression') calls.push(n); if(n.type === 'NewExpression') constructors.push(n); for(const v of Object.values(n)) if(Array.isArray(v))v.forEach(walk);else walk(v); }
    walk(tree);
    assert.ok(constructors.every(n => n.callee.name === 'Error'));
    assert.ok(!calls.some(n => ['require', 'fetch', 'eval'].includes(n.callee.name)));
    const dispatch = calls.filter(n => n.callee.property?.name === 'processToolCall');
    assert.equal(dispatch.length, 1); assert.equal(dispatch[0].arguments[0].value, 'LightMemo');
    for (const forbidden of ['KnowledgeBaseManager', 'RiverMemoEngine', 'executeNativeRiverQuery', 'rerankWithRiverMemoAsync', 'nativeJointQuery', 'writeFile', 'readFile', 'rebuild', 'spawn']) assert.ok(!source.includes(forbidden), forbidden);
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../source/plugin-manifest.json')));
    assert.equal(manifest.capabilities.invocationCommands.length, 1);
    assert.equal(manifest.requiresKnowledgeBaseManager, undefined);
    const h = await load(t, { processToolCall(){ throw Error('Unexpected dispatch'); } });
    for (const args of [{ ...request, action: 'repair' }, { ...request, include_river_trace: false }, { ...request, enginemode: 'knn' },
        { ...request, rerank: true }, { ...request, diaries: [] }, { ...request, diaries: ['A,B'] },
        { ...request, k: false }, { ...request, k: 0 }, { ...request, bm25: null }]) {
        await assert.rejects(h.pm.processToolCall('RiverMemoInspector', args), /INVALID_INSPECTOR/);
    }
    assert.equal(h.calls.filter(c => c.toolName === 'LightMemo').length, 0);
});

test('current P1A LightMemo candidate/scoring inputs equal ordinary benchmark path through Inspector', async t => {
    const f = lightFixture(); const h = await load(t, f.lm);
    const input = { ...request, query: '[2026-09-01~2026-09-07] exam', bm25: false };
    const args = { command: 'SearchRAG', query: input.query, folder: 'Fixture,Other', k: 2, enginemode: 'rivermemo', bm25: false };
    // Undated synthetic chunks would be filtered: use ordinary query for candidate parity.
    input.query = 'exam'; args.query = 'exam';
    await h.pm.processToolCall('LightMemo', args);
    const out = await h.pm.processToolCall('RiverMemoInspector', input);
    assert.equal(f.calls.length, 2);
    const traced = json(f.calls[1]); assert.equal(traced.options.includeTrace, true);
    traced.options.includeTrace = false;
    assert.deepEqual(traced, f.calls[0]);
    assert.equal(out.raw_trace.results.length, 2);
    const direct = await h.pm.processToolCall('LightMemo', { ...args, include_river_trace: true });
    assert.deepEqual(json(out.raw_trace), json(direct.river_memo_trace));
});

test('source-only bundle is undiscoverable and unwatched; canonical temporary bundle is discoverable', async t => {
    const root = fs.mkdtempSync('/tmp/inspector-source-only-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const events = [];
    const manager = vm.runInNewContext('(new(class{' + methods(['startPluginWatcher']) + '})())', {
        chokidar: cr('chokidar'), path, PREPROCESSOR_ORDER_FILE: path.join(root, 'order.json'), console: { log(){} }
    });
    Object.assign(manager, { pluginRootResolver: { getWatchRoots: () => [root] }, watcherSuppressions: new Map(),
        _formatPluginEventPathForLog: x => x, handlePluginManifestChange: (...args) => events.push(args) });
    const watcher = manager.startPluginWatcher(); t.after(() => watcher.close());
    await new Promise(r => watcher.once('ready', r));
    fs.cpSync(path.join(__dirname, '../source'), path.join(root, 'RiverMemoInspector/source'), { recursive: true });
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(events.length, 0);
    assert.equal((await discoverLegacyManifestRecordsFromRoot({ rootPath: root })).records.length, 0);
    fs.cpSync(path.join(__dirname, '../source'), path.join(root, 'RiverMemoInspector'), { recursive: true });
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(events.length, 1);
    assert.equal((await discoverLegacyManifestRecordsFromRoot({ rootPath: root })).records.length, 1);
});

test('native human/tool route transports Inspector JSON summary and unknown raw fields', async t => {
    const h = await load(t, { processToolCall(){ return { content: [], river_memo_trace: raw() }; } }, true);
    const source = fs.readFileSync(path.join(core, 'server.js'), 'utf8');
    const tree = acorn.parse(source, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true });
    const route = tree.body.map(n => n.expression).find(n => n?.type === 'CallExpression'
        && n.callee?.object?.name === 'app' && n.callee?.property?.name === 'post'
        && n.arguments[0]?.value === '/v1/human/tool');
    assert.ok(route);
    const callback = route.arguments[1];
    const handler = vm.runInNewContext('(' + source.slice(callback.start, callback.end) + ')', {
        pluginManager: h.pm, ToolCallParser: cr('./modules/vcpLoop/toolCallParser'),
        DEBUG_MODE: false, console: { log(){}, error(){} }, handleApiError(){}
    });
    const body = '<<<[TOOL_REQUEST]>>>\ntool_name:「始」RiverMemoInspector「末」\n'
        + 'action:「始」trace_query「末」\nquery:「始」exam evidence「末」\n'
        + 'diaries:「始」["Fixture","Other"]「末」\nk:「始」2「末」\n<<<[END_TOOL_REQUEST]>>>';
    let status = 200, response;
    // Actual HTTP callback and parser, response recorder only; no listening port.
    await handler({ body, ip: 'fixture-ip' }, { status(code){ status = code; return this; }, json(value){ response = json(value); } });
    assert.equal(status, 200);
    const output = response.result || response;
    assert.equal(output.authority.retrieval_surface, 'LightMemo');
    assert.deepEqual(output.raw_trace.future_trace_field, { x: 1 });
    assert.deepEqual(output.raw_trace, raw());
    assert.deepEqual(h.calls.map(c => c.toolName), ['RiverMemoInspector', 'LightMemo']);
});
