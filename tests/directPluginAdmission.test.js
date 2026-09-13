'use strict';
// Source-only, isolated owner methods. No production PluginManager construction,
// plugin discovery, database, service, provider, or HTTP activity.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const core = path.resolve(__dirname, '..');
const cr = createRequire(path.join(core, 'package.json'));
const { createDirectPluginRuntime } = cr('./modules/directPluginRuntime');
const { DynamicToolRegistry } = cr('./modules/dynamicToolRegistry');
const tree = cr('acorn').parse(fs.readFileSync(path.join(core, 'Plugin.js'), 'utf8'), { ecmaVersion: 'latest' });
const owner = fs.readFileSync(path.join(core, 'Plugin.js'), 'utf8');
const members = tree.body.find(n => n.type === 'ClassDeclaration' && n.id.name === 'PluginManager').body.body;
const names = ['_admitDirectPlugin', '_assertNoDirectAdmission', '_assertDirectAdmissionOpen',
    '_directPluginDescription', '_publishDirectCandidate', '_verifyDirectPublication',
    '_loadFreshDirectModule', '_withTimeout', '_runtimeDependenciesForManifest',
    '_beginGenerationInvocation', '_executeDirectToolCallWithTimeout', 'getDetailedRuntimeStatus'];
const source = names.map(name => { const n = members.find(m => m.key.name === name); assert.ok(n, name); return owner.slice(n.start, n.end); }).join('\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 2)); } throw Error('fixture wait exceeded'); }
function fixture(t) {
    const root = fs.mkdtempSync('/tmp/vcp-admission-fixture-');
    const state = { events: [], starts: 0, stops: 0, pending: null };
    const pm = vm.runInNewContext('(new(class{' + source + '})())', {
        require: cr, path, __dirname: root, createDirectPluginRuntime,
        setTimeout, clearTimeout, Date, Map, Set, AbortController,
        console: { log(){}, warn(){}, error(){} }
    });
    const g = { id: 3, state: 'READY', activeRequests: 0, activeByPlugin: new Map(),
        plugins: new Map(), runtimes: new Map(), serviceModules: new Map(),
        messagePreprocessors: new Map(), initializationOrder: [] };
    const untouched = {};
    for (const name of ['OneRing', 'VCPTimeLine', 'ContextFoldingV2', 'Unrelated']) {
        const rt = { started: true, shutdown(){throw Error('unrelated stop')}, health:async()=>({status:'ready'}), getReloadBlockers:async()=>[] };
        g.runtimes.set(name, rt);g.plugins.set(name,{name});g.serviceModules.set(name,{runtime:rt});untouched[name]=rt;
    }
    const sharedKBM = { shutdown(){throw Error('shared KBM restart') } };
    Object.assign(pm, { currentGeneration: g, runtimeV2Enabled: true, runtimeState: 'READY',
        plugins:g.plugins, serviceModules:g.serviceModules, directAdmissions:new Map(),
        individualPluginDescriptions:new Map([['VCPOneRing','unchanged']]), activePluginRequests:new Map(),
        pythonRuntimeStatus:new Map(), projectBasePath:root, getRuntimeStatus:()=>({generation:g.id}),
        _evaluateExternalPluginRuntimeRegistration:()=>({allowed:true}), _runtimeConfigForManifest:()=>({}),
        getVCPLogFunctions:()=>state, vectorDBManager:sharedKBM, _assertPluginCircuitClosed(){}, _recordPluginCallResult(){},
        reloadPlugins(){throw Error('global reload')}, shutdownAllPlugins(){throw Error('global shutdown')}
    });
    const registry = new DynamicToolRegistry();
    registry.pluginManager=pm;registry.initialized=true;pm.directPluginCatalog=registry;
    pm.processToolCall=()=>{throw Error('No retrieval permitted during fixture admission')};
    for(const name of Object.keys(untouched)) {
        const key='local:'+name;
        registry.catalog.set(key,{originKey:key,pluginName:name,displayName:name,sourceHash:'unchanged',fullDescription:'unchanged',enabled:true,online:true,available:true,lastSeenAt:'unchanged'});
        registry.categories.set(key,{sourceHash:'unchanged',categories:['general']});
        registry.classificationQueue.set(key,{record:{originKey:key,sourceHash:'unchanged'}});
    }
    for(const method of ['syncFromPluginManager','_syncFromPluginManager','_writeCatalog','_writeCategories','enqueueClassification','_scheduleClassificationFlush']) {
        registry[method]=()=>{throw Error('forbidden global catalog/classification action: '+method)};
    }
    function write(version, overrides={}) {
        const dir=path.join(root,'Plugin','LightMemo');fs.mkdirSync(dir,{recursive:true});
        const manifest={name:'LightMemo',displayName:version,pluginType:'hybridservice',runtimeLifecycle:2,
            communication:{protocol:'direct',timeout:100},entryPoint:{script:'LightMemo.js'},
            capabilities:{invocationCommands:[{description:'description '+version,example:'example'}]}};
        const body=`module.exports={createRuntime({dependencies}) {let state;return {
            async prepare(){${overrides.prepare || ''}},
            async start(){state=dependencies.vcpLogFunctions;state.starts++;state.events.push('start:${version}');${overrides.start || ''}},
            health(){return {status:'ready'}},
            process(args){return state.pending || {version:'${version}',args}},
            shutdown(){if(state){state.stops++;state.events.push('stop:${version}');}${overrides.shutdown || ''}}
        }}};`;
        const bytes=Buffer.from(JSON.stringify(manifest));fs.writeFileSync(path.join(dir,'plugin-manifest.json'),bytes);fs.writeFileSync(path.join(dir,'LightMemo.js'),body);
        return {name:'LightMemo',expectedIdentity:{source_sha256:sha(body),manifest_sha256:sha(bytes)}};
    }
    async function active() {const args=write('A');await pm._admitDirectPlugin(args);return {args,old:g.runtimes.get('LightMemo')};}
    function call(timeout=100) {const manifest=g.plugins.get('LightMemo');manifest.communication.timeout=timeout;return pm._executeDirectToolCallWithTimeout(manifest,'LightMemo',null,{},{});}
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    return {root,pm,g,state,write,active,call,untouched,sharedKBM,registry};
}

test('T1/T2/T11 actual compiled source A stays identity A after disk B; status does not hash disk', async t=>{
    const f=fixture(t);const {old}=await f.active();const a=old.loadedIdentity;f.write('B');
    assert.equal((await old.process({})).version,'A');assert.equal(old.loadedIdentity,a);
    const status=await f.pm.getDetailedRuntimeStatus();assert.equal(status.plugins.find(p=>p.name==='LightMemo').loaded_identity,a);
    assert.notEqual(a.source_sha256,sha(fs.readFileSync(path.join(f.root,'Plugin/LightMemo/LightMemo.js'))));
    assert.ok(Object.isFrozen(a));assert.ok(a.instance_id);assert.equal(a.source_files.length,1);
});
test('T1 prepared candidate retains identity captured before disk drift', async t=>{
    const f=fixture(t);const args=f.write('A');const dir=path.join(f.root,'Plugin/LightMemo');const bytes=fs.readFileSync(path.join(dir,'plugin-manifest.json'));
    const manifest={...JSON.parse(bytes),basePath:dir};const exports=f.pm._loadFreshDirectModule(manifest,bytes,args.expectedIdentity);
    const rt=createDirectPluginRuntime(exports,{manifest,dependencies:{},config:{}});await rt.prepare();f.write('B');
    assert.equal(rt.loadedIdentity.source_sha256,args.expectedIdentity.source_sha256);
});
test('plugin-owned transitive source graph is captured from compiled bytes; hooks restored after error', async t=>{
    const f=fixture(t);f.write('A');const dir=path.join(f.root,'Plugin/LightMemo');const child='module.exports={value:7};';
    fs.writeFileSync(path.join(dir,'child.js'),child);fs.writeFileSync(path.join(dir,'LightMemo.js'),"module.exports=require('./child');");
    const manifest={...JSON.parse(fs.readFileSync(path.join(dir,'plugin-manifest.json'))),basePath:dir};
    const original=require('node:module')._extensions['.js'];const exports=f.pm._loadFreshDirectModule(manifest);
    const rt=createDirectPluginRuntime(exports,{manifest});assert.equal(rt.loadedIdentity.source_files.length,2);
    assert.equal(rt.loadedIdentity.source_files.find(x=>x.resolved_path.endsWith('child.js')).source_sha256,sha(child));
    fs.writeFileSync(path.join(dir,'LightMemo.js'),'throw Error("bad load")');assert.throws(()=>f.pm._loadFreshDirectModule(manifest),/bad load/);
    assert.equal(require('node:module')._extensions['.js'],original);
});
test('T3/T4 lock only target; caller timeout retains actual inflight until settlement', async t=>{
    const f=fixture(t);await f.active();let finish;f.state.pending=new Promise(r=>finish=r);
    await assert.rejects(f.call(5),e=>e.code==='DIRECT_TOOL_TIMEOUT');assert.equal(f.g.activeByPlugin.get('LightMemo'),1);
    const tx=f.pm._admitDirectPlugin({...f.write('B'),quiescenceTimeoutMs:200});await until(()=>f.pm.directAdmissions.get('LightMemo')?.locked);
    assert.throws(()=>f.pm._beginGenerationInvocation('LightMemo'),e=>e.code==='PLUGIN_TEMPORARILY_UNAVAILABLE_FOR_ADMISSION');
    const release=f.pm._beginGenerationInvocation('OneRing');release();assert.equal(f.g.activeByPlugin.get('LightMemo'),1);
    finish({});f.state.pending=null;await tx;assert.equal(f.g.activeByPlugin.get('LightMemo')||0,0);
});
test('T5 bounded quiescence abort never stops old call/runtime and releases fence', async t=>{
    const f=fixture(t);const {old}=await f.active();const release=f.pm._beginGenerationInvocation('LightMemo');
    await assert.rejects(f.pm._admitDirectPlugin({...f.write('B'),quiescenceTimeoutMs:5}),e=>e.code==='PLUGIN_QUIESCENCE_TIMEOUT');
    assert.equal(f.g.runtimes.get('LightMemo'),old);assert.equal(old.started,true);assert.equal(f.state.events.includes('stop:A'),false);
    assert.equal(f.pm.directAdmissions.size,0);const r=f.pm._beginGenerationInvocation('LightMemo');r();release();
});
for (const phase of ['prepare','start']) test(`T6 ${phase} failure preserves all old registry references`,async t=>{
    const f=fixture(t);const {old}=await f.active();const manifest=f.g.plugins.get('LightMemo'),service=f.g.serviceModules.get('LightMemo'),desc=f.pm.individualPluginDescriptions.get('VCPLightMemo');
    await assert.rejects(f.pm._admitDirectPlugin(f.write('B',{[phase]:"throw Error('candidate failure')"})),/candidate failure/);
    assert.equal(f.g.runtimes.get('LightMemo'),old);assert.equal(f.g.plugins.get('LightMemo'),manifest);assert.equal(f.g.serviceModules.get('LightMemo'),service);assert.equal(f.pm.individualPluginDescriptions.get('VCPLightMemo'),desc);assert.ok(old.started);
});
test('T7/T10/T12/T13 verified local publication precedes old retirement; unrelated references unchanged',async t=>{
    const f=fixture(t);const {old}=await f.active();const verify=f.pm._verifyDirectPublication;
    f.pm._verifyDirectPublication=function(...args){assert.ok(old.started);verify.apply(this,args);f.state.events.push('verified:B')};
    const result=await f.pm._admitDirectPlugin(f.write('B'));const next=f.g.runtimes.get('LightMemo');
    assert.equal(result.loaded_identity,next.loadedIdentity);assert.equal(result.previous_identity,old.loadedIdentity);assert.equal(old.started,false);
    assert.ok(f.state.events.indexOf('verified:B')<f.state.events.indexOf('stop:A'));assert.equal(f.g.id,3);
    for(const [name,rt] of Object.entries(f.untouched))assert.equal(f.g.runtimes.get(name),rt);
    assert.equal(f.pm.individualPluginDescriptions.get('VCPOneRing'),'unchanged');
    assert.equal(f.g.serviceModules.get('LightMemo').runtime,next);assert.equal(f.g.serviceModules.get('LightMemo').manifest,f.g.plugins.get('LightMemo'));
});
for (const phase of ['mid-publication','verification']) test(`T8 ${phase} fault restores prior active identity and all target surfaces`,async t=>{
    const f=fixture(t);const {old}=await f.active();const manifest=f.g.plugins.get('LightMemo'),service=f.g.serviceModules.get('LightMemo'),desc=f.pm.individualPluginDescriptions.get('VCPLightMemo');
    if(phase==='mid-publication')f.pm._publishDirectCandidate=(g,m,c)=>{g.plugins.set(m.name,m);g.runtimes.set(m.name,c);throw Error('publication fault')};
    else f.pm._verifyDirectPublication=()=>{throw Error('publication fault')};
    await assert.rejects(f.pm._admitDirectPlugin(f.write('B')),/publication fault/);
    assert.equal(f.g.runtimes.get('LightMemo'),old);assert.ok(old.started);assert.equal(f.g.plugins.get('LightMemo'),manifest);assert.equal(f.g.serviceModules.get('LightMemo'),service);assert.equal(f.pm.individualPluginDescriptions.get('VCPLightMemo'),desc);assert.equal(f.pm.directAdmissions.size,0);
});
test('T9 actual Inspector package initial activation uses same transaction, zero retrieval/start dispatch',async t=>{
    const f=fixture(t);const dir=path.join(f.root,'Plugin/RiverMemoInspector/source');fs.cpSync(path.join(core,'Plugin/RiverMemoInspector/source'),dir,{recursive:true});
    let calls=0;f.pm.processToolCall=()=>{calls++;throw Error('No retrieval permitted')};
    const result=await f.pm._admitDirectPlugin({name:'RiverMemoInspector',expectedIdentity:{source_sha256:sha(fs.readFileSync(path.join(dir,'RiverMemoInspector.js'))),manifest_sha256:sha(fs.readFileSync(path.join(dir,'plugin-manifest.json')))}});
    assert.equal(result.previous_identity,null);assert.equal(result.status,'published');assert.equal(calls,0);assert.ok(f.g.runtimes.get('RiverMemoInspector').started);
});
test('initial activation verification failure removes every newly inserted binding',async t=>{
    const f=fixture(t);f.pm._verifyDirectPublication=()=>{throw Error('verify fail')};await assert.rejects(f.pm._admitDirectPlugin(f.write('A')),/verify fail/);
    assert.equal(f.g.plugins.has('LightMemo'),false);assert.equal(f.g.runtimes.has('LightMemo'),false);assert.equal(f.g.serviceModules.has('LightMemo'),false);assert.equal(f.pm.individualPluginDescriptions.has('VCPLightMemo'),false);assert.equal(f.g.initializationOrder.includes('LightMemo'),false);
});
test('old retirement failure reports published cleanup failure without rolling back candidate',async t=>{
    const f=fixture(t);await f.pm._admitDirectPlugin(f.write('A',{shutdown:"throw Error('old cleanup failed')"}));const result=await f.pm._admitDirectPlugin(f.write('B'));
    assert.equal(result.status,'published_cleanup_failed');assert.match(result.retirement_error.message,/old cleanup failed/);assert.equal((await f.g.runtimes.get('LightMemo').process({})).version,'B');await tick();assert.equal(f.pm.directAdmissions.get('LightMemo').locked,false);
});
test('stale pre-approval manifest cannot acquire replacement runtime',async t=>{
    const f=fixture(t);await f.active();const stale=f.g.plugins.get('LightMemo');await f.pm._admitDirectPlugin(f.write('B'));
    await assert.rejects(f.pm._executeDirectToolCallWithTimeout(stale,'LightMemo',null,{},{}),e=>e.code==='PLUGIN_REGISTRATION_CHANGED');assert.equal(f.g.activeRequests,0);
});
test('accepted identity mismatch fails before executing changed entry source',async t=>{
    const f=fixture(t);const args=f.write('A');const file=path.join(f.root,'Plugin/LightMemo/LightMemo.js');fs.writeFileSync(file,"throw Error('must not execute changed source')");
    await assert.rejects(f.pm._admitDirectPlugin(args),/PLUGIN_ACCEPTED_IDENTITY_MISMATCH/);assert.equal(f.g.runtimes.has('LightMemo'),false);
});
test('concurrent generation control is rejected without stopping any plugin',async t=>{
    const f=fixture(t);await f.active();const release=f.pm._beginGenerationInvocation('LightMemo');const tx=f.pm._admitDirectPlugin({...f.write('B'),quiescenceTimeoutMs:200});await until(()=>f.pm.directAdmissions.get('LightMemo')?.locked);
    assert.throws(()=>f.pm._assertNoDirectAdmission(),e=>e.code==='PLUGIN_ADMISSION_IN_PROGRESS');release();await tx;
});

function unrelatedCatalog(f) {
    return JSON.stringify({catalog:Array.from(f.registry.catalog).filter(([k])=>k!=='local:LightMemo'&&k!=='local:RiverMemoInspector'),
        categories:Array.from(f.registry.categories).filter(([k])=>k!=='local:LightMemo'&&k!=='local:RiverMemoInspector'),
        queue:Array.from(f.registry.classificationQueue).filter(([,v])=>!['local:LightMemo','local:RiverMemoInspector'].includes(v.record.originKey))});
}
test('T17/T18/T23/T24 LightMemo publication changes only target catalog; no sync/write/classification',async t=>{
    const f=fixture(t);await f.active();const before=unrelatedCatalog(f);const a=f.registry.catalog.get('local:LightMemo');
    await f.pm._admitDirectPlugin(f.write('B'));const b=f.registry.catalog.get('local:LightMemo');
    assert.notEqual(a,b);assert.notEqual(a.sourceHash,b.sourceHash);assert.equal(b.displayName,'B');assert.equal(unrelatedCatalog(f),before);
    assert.equal(b.loadedIdentity,f.g.runtimes.get('LightMemo').loadedIdentity);assert.equal(f.registry.classificationQueue.has('local:LightMemo'),false);
});
for(const point of ['catalog-preparation','runtime-partial','catalog-partial','runtime-verification','catalog-verification']) {
 test(`T19/T22/T25 ${point} failure restores actual snapshots with lock held`,async t=>{
    const f=fixture(t);await f.active();const a=f.registry.catalog.get('local:LightMemo'),old=f.g.runtimes.get('LightMemo');
    const category={sourceHash:a.sourceHash,categories:['prior']},queue={record:{originKey:'local:LightMemo',sourceHash:a.sourceHash}};
    f.registry.categories.set('local:LightMemo',category);f.registry.classificationQueue.set('pending-A',queue);
    const before=unrelatedCatalog(f);let observed;
    const observe=()=>queueMicrotask(()=>{observed=[f.g.runtimes.get('LightMemo'),f.registry.catalog.get('local:LightMemo')];});
    const fail=()=>{assert.equal(f.pm.directAdmissions.get('LightMemo').locked,true);observe();throw Error('fault '+point)};
    const originalRestore=f.registry.restoreDirectPluginPublication.bind(f.registry);
    f.registry.restoreDirectPluginPublication=p=>{assert.equal(f.pm.directAdmissions.get('LightMemo').locked,true);originalRestore(p)};
    if(point==='catalog-preparation')f.registry.prepareDirectPluginPublication=fail;
    if(point==='runtime-partial')f.pm._publishDirectCandidate=(g,m,c)=>{g.runtimes.set(m.name,c);fail()};
    if(point==='catalog-partial') {const publish=f.registry.publishDirectPluginPublication.bind(f.registry);f.registry.publishDirectPluginPublication=p=>{publish(p);fail()};}
    if(point==='runtime-verification')f.pm._verifyDirectPublication=fail;
    if(point==='catalog-verification')f.registry.verifyDirectPluginPublication=fail;
    await assert.rejects(f.pm._admitDirectPlugin(f.write('B')),/fault/);await tick();
    assert.equal(f.g.runtimes.get('LightMemo'),old);assert.equal(f.registry.catalog.get('local:LightMemo'),a);assert.equal(f.registry.categories.get('local:LightMemo'),category);assert.equal(f.registry.classificationQueue.get('pending-A'),queue);
    assert.equal(old.started,true);assert.equal(f.pm.directAdmissions.size,0);assert.equal(unrelatedCatalog(f),before);
    assert.deepEqual(observed,[old,a]);
 });
}
test('T20/T26 actual Inspector catalog appears with runtime-owned identity and callable metadata',async t=>{
    const f=fixture(t);const before=unrelatedCatalog(f);const dir=path.join(f.root,'Plugin/RiverMemoInspector/source');fs.cpSync(path.join(core,'Plugin/RiverMemoInspector/source'),dir,{recursive:true});
    const result=await f.pm._admitDirectPlugin({name:'RiverMemoInspector',expectedIdentity:{source_sha256:sha(fs.readFileSync(path.join(dir,'RiverMemoInspector.js'))),manifest_sha256:sha(fs.readFileSync(path.join(dir,'plugin-manifest.json')))}});
    const record=f.registry.catalog.get('local:RiverMemoInspector');assert.equal(record.loadedIdentity,result.loaded_identity);assert.equal(record.pluginName,'RiverMemoInspector');assert.ok(record.commandIdentifiers.includes('trace_query'));assert.ok(record.fullDescription.includes('trace_query'));assert.equal(record.available,true);assert.equal(unrelatedCatalog(f),before);
    assert.ok(f.registry._classificationFor(record).categories.length>0);assert.equal(f.registry.categories.has(record.originKey),false);
    const injected=await f.registry.buildInjection({messages:[{role:'user',content:'RiverMemoInspector trace_query'}]});assert.match(injected,/RiverMemoInspector/);
});
test('T21 failed Inspector first catalog publish leaves no runtime, catalog or category orphan',async t=>{
    const f=fixture(t);const before=unrelatedCatalog(f);const dir=path.join(f.root,'Plugin/RiverMemoInspector/source');fs.cpSync(path.join(core,'Plugin/RiverMemoInspector/source'),dir,{recursive:true});
    const publish=f.registry.publishDirectPluginPublication.bind(f.registry);f.registry.publishDirectPluginPublication=p=>{publish(p);throw Error('Inspector catalog fault')};
    await assert.rejects(f.pm._admitDirectPlugin({name:'RiverMemoInspector',expectedIdentity:{source_sha256:sha(fs.readFileSync(path.join(dir,'RiverMemoInspector.js'))),manifest_sha256:sha(fs.readFileSync(path.join(dir,'plugin-manifest.json')))}}),/Inspector catalog fault/);
    for(const map of [f.g.plugins,f.g.runtimes,f.g.serviceModules])assert.equal(map.has('RiverMemoInspector'),false);
    assert.equal(f.registry.catalog.has('local:RiverMemoInspector'),false);assert.equal(f.registry.categories.has('local:RiverMemoInspector'),false);assert.equal(unrelatedCatalog(f),before);
});
test('T25 successful catalog publish and verify both hold target admission fence',async t=>{
    const f=fixture(t);await f.active();const calls=[];
    for(const key of ['publishDirectPluginPublication','verifyDirectPluginPublication']) {
        const original=f.registry[key].bind(f.registry);f.registry[key]=(...args)=>{assert.equal(f.pm.directAdmissions.get('LightMemo').locked,true);assert.throws(()=>f.pm._beginGenerationInvocation('LightMemo'),e=>e.code==='PLUGIN_TEMPORARILY_UNAVAILABLE_FOR_ADMISSION');calls.push(key);return original(...args)};
    }
    await f.pm._admitDirectPlugin(f.write('B'));assert.equal(calls.length,2);assert.equal(f.pm.directAdmissions.size,0);
});
test('candidate failure/quiescence abort never calls even catalog preparation',async t=>{
    const f=fixture(t);await f.active();f.registry.prepareDirectPluginPublication=()=>{throw Error('must not touch catalog')};
    await assert.rejects(f.pm._admitDirectPlugin(f.write('B',{prepare:"throw Error('before catalog')"})),/before catalog/);
    const release=f.pm._beginGenerationInvocation('LightMemo');await assert.rejects(f.pm._admitDirectPlugin({...f.write('C'),quiescenceTimeoutMs:5}),e=>e.code==='PLUGIN_QUIESCENCE_TIMEOUT');release();
});
test('catalog owner binds through existing event integration, without a fourth owner',t=>{
    const {EventEmitter}=require('node:events');const manager=new EventEmitter();const registry=new DynamicToolRegistry();registry._bindPluginManagerEvents(manager);assert.equal(manager.directPluginCatalog,registry);assert.equal(manager.listenerCount('tools_changed'),1);
});
test('in-flight obsolete target classification cannot overwrite admitted publication category state',async t=>{
    const f=fixture(t);await f.active();const a=f.registry.catalog.get('local:LightMemo');f.registry.classificationQueue.clear();f.registry.classificationQueue.set('target-A',{record:a,reason:'fixture'});
    let finish;f.registry._classifyRecord=()=>new Promise(r=>finish=r);let writes=0;f.registry._writeCategories=async()=>{writes++};
    const work=f.registry.flushClassificationQueue();await until(()=>!!finish);await f.pm._admitDirectPlugin(f.write('B'));
    finish({categories:['stale-A'],keywords:[]});await work;assert.equal(f.registry.categories.has('local:LightMemo'),false);assert.equal(writes,1); // ordinary pre-existing worker finishes; admission scheduled none
});
test('unbound pre-upgrade runtime is rejected; disk digest cannot manufacture previous identity',async t=>{
    const f=fixture(t);f.g.runtimes.set('LightMemo',{started:true});
    await assert.rejects(f.pm._admitDirectPlugin(f.write('B')),/PLUGIN_PREVIOUS_LOADED_IDENTITY_UNAVAILABLE/);assert.equal(f.pm.directAdmissions.size,0);
});
test('status started before replacement reports current bound identity rather than stale runtime reference',async t=>{
    const f=fixture(t);const {old}=await f.active();let finish;old.instance.health=()=>new Promise(r=>finish=r);
    const observing=f.pm.getDetailedRuntimeStatus();await until(()=>!!finish);await f.pm._admitDirectPlugin(f.write('B'));finish({status:'ready'});
    const status=await observing;const row=status.plugins.find(p=>p.name==='LightMemo');assert.equal(row.loaded_identity,f.g.runtimes.get('LightMemo').loadedIdentity);assert.equal(row.health.status,'changed_during_observation');
});
test('concurrent target registration drift aborts without overwriting external state or touching catalog',async t=>{
    const f=fixture(t);await f.active();const old=f.g.runtimes.get('LightMemo'),a=f.registry.catalog.get('local:LightMemo');const release=f.pm._beginGenerationInvocation('LightMemo');
    const tx=f.pm._admitDirectPlugin({...f.write('B'),quiescenceTimeoutMs:200});await until(()=>f.pm.directAdmissions.get('LightMemo')?.locked);
    const externallyChanged={...f.g.plugins.get('LightMemo'),externalRevision:true};f.g.plugins.set('LightMemo',externallyChanged);release();await assert.rejects(tx,/PLUGIN_ADMISSION_SOURCE_DRIFT/);
    assert.equal(f.g.plugins.get('LightMemo'),externallyChanged);assert.equal(f.g.runtimes.get('LightMemo'),old);assert.equal(f.registry.catalog.get('local:LightMemo'),a);assert.equal(f.pm.directAdmissions.size,0);
});
