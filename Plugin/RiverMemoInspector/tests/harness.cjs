'use strict';
// Actual production methods with only I/O/host services replaced. No server start.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = path.resolve(__dirname, '../../..');
const cr = require('node:module').createRequire(path.join(core, 'package.json'));
const acorn = cr('acorn');
const { createDirectPluginRuntime } = cr('./modules/directPluginRuntime');
const { discoverLegacyManifestRecordsFromRoot } = cr('./modules/pluginRootResolver');
const quiet = { log(){}, warn(){}, error(){} };
function methods(names) {
    const source = fs.readFileSync(path.join(core, 'Plugin.js'), 'utf8');
    const tree = acorn.parse(source, { ecmaVersion: 'latest' });
    const members = tree.body.find(n => n.type === 'ClassDeclaration' && n.id.name === 'PluginManager').body.body;
    return names.map(name => {
        const member = members.find(n => n.key.name === name);
        if (!member) throw Error('Missing production method: ' + name);
        return source.slice(member.start, member.end);
    }).join('\n');
}
async function load(t, lightMemo, privacy = false) {
    const root = fs.mkdtempSync('/tmp/rivermemo-inspector-load-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.cpSync(path.join(__dirname, '../source'), path.join(root, 'RiverMemoInspector'), { recursive: true });
    const { records } = await discoverLegacyManifestRecordsFromRoot({ rootPath: root, source: 'core' });
    const manifests = records.map(r => ({ ...r.manifest, basePath: r.pluginPath }));
    const source = methods(['_buildRuntimeGeneration', '_startRuntimeGeneration', '_withTimeout',
        '_runtimeDependenciesForManifest', '_loadFreshDirectModule', 'processToolCall',
        'getServiceModule', '_executeDirectToolCallWithTimeout', '_sanitizeToolResultForAi']);
    const calls = [], approvals = [];
    const pm = vm.runInNewContext('(new(class{' + source + '})())', {
        require: cr, path, __dirname: root, Date, AbortController, Map, Set,
        setTimeout, clearTimeout, console: quiet,
        express: { Router: () => ({}) }, resolvePythonExecutable: () => null,
        validatePythonPlugins: async () => new Map(), createDirectPluginRuntime,
        sanitizeToolResult: cr('./modules/toolResultPrivacyGuard').sanitizeToolResult,
        toolCallRecordStore: { beginRecord(value){ calls.push(value); return null; }, finishRecord(){} },
        FileFetcherServer: { resolveFileUrl(){ throw Error('Fixture forbids file URL resolution'); } }
    });
    Object.assign(pm, {
        runtimeGenerationSequence: 0, staticPlaceholderValues: new Map(), plugins: new Map(),
        _discoverLegacyPluginManifests: async () => manifests,
        _evaluateExternalPluginRuntimeRegistration: () => ({ allowed: true }),
        _runtimeConfigForManifest: () => ({}), _readStrictPreprocessorOrder: async () => [],
        getVCPLogFunctions: () => ({}), _registerGenerationRoutes: async () => {},
        initializeStaticPlugins: async () => {},
        _resolvePluginName: name => ({ name, isAlias: false }),
        _assertPluginCircuitClosed(){}, _beginGenerationInvocation: () => () => {}, _recordPluginCallResult(){},
        toolApprovalManager: { getApprovalDecision(name){ approvals.push(name); return { requiresApproval: false }; },
            getPrivacyProtectionConfig: () => ({ enabled: privacy }) }
    });
    const generation = await pm._buildRuntimeGeneration('isolated-inspector');
    await pm._startRuntimeGeneration(generation);
    const lightManifest = { name: 'LightMemo', pluginType: 'hybridservice', communication: { protocol: 'direct', timeout: 2000 } };
    generation.plugins.set('LightMemo', lightManifest);
    generation.serviceModules.set('LightMemo', { module: lightMemo });
    pm.currentGeneration = generation; pm.plugins = generation.plugins; pm.serviceModules = generation.serviceModules;
    t.after(async () => { for (const rt of generation.runtimes.values()) await rt.shutdown(); });
    return { pm, generation, records, calls, approvals, root };
}
function raw() {
    return { schema: 'rivermemo-topology-v3-result-v1', queryId: 'synthetic-query',
        artifactSig: 'synthetic-artifact', omega: { omega: 0.02, regime: 'collapsed' },
        results: [9, 5].map((id, i) => ({ id, rank: i + 1, sourceFile: `Fixture/${id}.txt`,
            score: 0.8 - i * 0.1, baseScore: 0.7, topologyBonus: 0, anchorBonus: 0.1,
            role: 'seed', topologyV3: { contactedSeeds: 2, exactContacts: 1, meanClosure: 0.6 },
            relativeTopology: { sentinel: 1 }, geometry: { sentinel: 2 }, observables: { sentinel: 3 }
        })), future_trace_field: { x: 1 }, sourceObservation: { syntheticSentinelOnly: true } };
}
function lightFixture() {
    const calls = [];
    const file = path.join(core, 'Plugin/LightMemo/LightMemo.js');
    const context = { module: { exports: {} }, console: quiet, Buffer, process: { env: {} },
        __dirname: path.dirname(file), setTimeout, clearTimeout, URL,
        require(name) {
            if (name === 'fs') return { promises: new Proxy({}, { get(){ return () => { throw Error('No filesystem access'); }; } }) };
            if (name === 'path') return path;
            if (name === 'axios') return { post(){ throw Error('No external provider'); } };
            if (name === '@node-rs/jieba') return { Jieba: class { cut(s){ return [s]; } } };
            if (name === '@node-rs/jieba/dict') return { dict: {} };
            throw Error('Unexpected dependency: ' + name);
        }
    };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    const lm = context.module.exports;
    lm.getSingleEmbedding = async () => [1, 0, 0, 0];
    lm.vectorDBManager = {
        ragParams: {},
        db: { prepare(){ return { iterate(){ return [
            { id: 1, file_id: 1, content: 'practice exam', diary_name: 'Fixture', path: 'Fixture/1.txt' },
            { id: 2, file_id: 2, content: 'exam evidence', diary_name: 'Fixture', path: 'Fixture/2.txt' }
        ]; } }; } },
        async rerankWithRiverMemoAsync(query, candidates, scope, options) {
            calls.push(JSON.parse(JSON.stringify({ query, candidates, scope, options })));
            return { ...raw(), results: candidates.slice(0, options.topK).map((c, i) => ({ ...c, ...raw().results[i] })) };
        }
    };
    return { lm, calls };
}
module.exports = { core, cr, acorn, methods, load, raw, lightFixture, discoverLegacyManifestRecordsFromRoot };
