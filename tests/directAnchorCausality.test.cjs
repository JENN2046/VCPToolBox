'use strict';
// Synthetic SQLite only. Explicit binaries required; no KBM construction or live I/O.
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const core=path.resolve(__dirname,'..');
const {createRequire}=require('node:module');const cr=createRequire(path.join(core,'package.json'));
const Database=cr('better-sqlite3');const {initializeKnowledgeBaseSchema}=cr('./modules/knowledgeBase/schemaManager');
const before=process.env.CAUSALITY_BEFORE_BINARY,after=process.env.CAUSALITY_AFTER_BINARY;
if(!before||!after)throw Error('Explicit isolated CAUSALITY_BEFORE_BINARY and CAUSALITY_AFTER_BINARY required');
const B=require(before),A=require(after);const vector=v=>Buffer.from(new Float32Array(v).buffer);
const j=v=>JSON.parse(JSON.stringify(v));const parsed=v=>typeof v==='string'?JSON.parse(v):v;
const ranking=d=>d.results.map(r=>({id:r.chunkId,rank:r.rank,baseScore:r.baseScore,topologyBonus:r.topologyBonus,anchorBonus:r.anchorBonus,finalScore:r.score,role:r.role}));
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'anchor-causality-synthetic-')),dbPath=path.join(dir,'db.sqlite'),db=new Database(dbPath);initializeKnowledgeBaseSchema(db,{logPrefix:'P1D-synthetic'});
 t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
 const tags=[[1,'seed-one',[1,0,0,0]],[2,'seed-two',[0,1,0,0]],[3,'semantic-neighbor',[.95,.1,0,0]],[4,'unrelated',[0,0,1,0]]];
 for(const [id,name,v]of tags)db.prepare('INSERT INTO tags(id,name,vector) VALUES(?,?,?)').run(id,name,vector(v));
 const rows=[[1,[1],[1,0,0,0]],[2,[3],[1,.1,0,0]],[3,[4],[1,0,0,0]],[4,[1,2],[.7,.7,0,0]],[5,[2],[0,1,0,0]]];
 for(const [id,ids,v]of rows){db.prepare('INSERT INTO files(id,path,diary_name,checksum,mtime,size,updated_at) VALUES(?,?,?,?,1,1,1)').run(id,`synthetic/${id}.txt`,'synthetic','fixture');db.prepare('INSERT INTO chunks(id,file_id,chunk_index,content,vector) VALUES(?,?,0,?,?)').run(100+id,id,'Synthetic candidate',vector(v));ids.forEach((tag,i)=>db.prepare('INSERT INTO file_tags(file_id,tag_id,position) VALUES(?,?,?)').run(id,tag,i));}
 const b=new B.VexusIndex(4,32),a=new A.VexusIndex(4,32);const artifact=await b.rebuildMemoArtifact(dbPath,JSON.stringify({modelSig:'synthetic-p1d',effectiveConfig:{}}));assert.equal(artifact.success,true);
 for(const [id,,v] of tags){b.add(id,new Float32Array(v));a.add(id,new Float32Array(v));}
 const input={dimension:4,topK:5,query:{text:'synthetic',vector:[1,0,0,0]},denoisedVector:[1,0,0,0],localVector:[1,0,0,0],transferVector:[1,0,0,0],candidates:rows.map(([id])=>({id:100+id,score:.5})),queryState:{sourceField:[[1,1],[2,.2]],localField:[[1,1],[2,.2]],transferField:[[1,1],[2,.2]],localDomainIds:[1,2],transferDomainIds:[1,2],fieldProvenance:[{id:1,hop:0,sourceType:'core'},{id:2,hop:0,sourceType:'seed'}],riverNodes:[{id:1,energy:1,normalizedEnergy:1,hop:0},{id:2,energy:.2,normalizedEnergy:.2,hop:0}],riverEdges:[],completeObservation:true},config:{}};
 const run=async(index,extra={})=>parsed(await index.rerankRivermemoTopologyV3(dbPath,artifact.artifactSig,JSON.stringify({...input,...extra})));
 return {a,b,artifact,db,dbPath,input,run};
}
let retainedRaw;
const evidence=[];
test.after(()=>{if(process.env.CAUSALITY_EVIDENCE_DIR){
 const out=path.resolve(process.env.CAUSALITY_EVIDENCE_DIR);assert.ok(out.startsWith('/tmp/'));
 fs.writeFileSync(path.join(out,'causality-fixture-evidence.json'),JSON.stringify(evidence,null,2));
}});
test('T2-T7/T10-T12 exact+semantic+zero contacts, true gate chain, native ABI and exact before/after parity',async t=>{
 const f=await fixture(t);
 for(const config of [{},{anchorActivationZ:0},{anchorActivationFloor:.99},{anchorSaturation:0,anchorActivationZ:0,anchorActivationFloor:0}]){
  const oldOff=await f.run(f.b,{includeTrace:false,config}),newOff=await f.run(f.a,{includeTrace:false,config}),oldOn=await f.run(f.b,{includeTrace:true,config}),newOn=await f.run(f.a,{includeTrace:true,config});
  for(const out of [newOff,oldOn,newOn])assert.deepEqual(ranking(out),ranking(oldOff),'FAIL_TRACE_EXTENSION_CHANGED_RANKING');
  assert.deepEqual(Object.keys(newOff).sort(),Object.keys(oldOff).sort());assert.ok(!Object.hasOwn(newOff,'anchorQuery'));
  for(let i=0;i<newOff.results.length;i++)assert.deepEqual(Object.keys(newOff.results[i]).sort(),Object.keys(oldOff.results[i]).sort());
  const exact=newOn.results.find(r=>r.chunkId===101),semantic=newOn.results.find(r=>r.chunkId===102),zero=newOn.results.find(r=>r.chunkId===103);
  assert.ok(exact.topologyV3.contacts.some(c=>c.exact===true&&c.seedId===1&&c.candidateTagId===1));
  assert.ok(semantic.topologyV3.contacts.some(c=>c.exact===false&&c.seedId===1&&c.candidateTagId===3));
  assert.deepEqual(zero.topologyV3.contacts,[]);assert.equal(zero.anchorBonus,0);
  for(const r of newOn.results){const d=r.topologyV3.anchorDecision;assert.equal(d.strength,r.topologyV3.anchorStrength);assert.equal(d.awardedBonus,r.anchorBonus);assert.equal(d.poolSize,5);assert.equal(typeof d.threshold,'number');assert.equal(typeof d.thresholdPassed,'boolean');assert.ok(['below_or_equal_threshold','smoothstep','degenerate_saturation'].includes(d.stage));for(const c of r.topologyV3.contacts){for(const key of ['specificity','rarity','chunkCosine','normalizedMass','matchWeight','contribution','similarity'])assert.equal(typeof c[key],'number');assert.ok(!Object.hasOwn(c,'text')&&!Object.hasOwn(c,'vector'));}}
  assert.ok(newOn.results.some(r=>r.topologyV3.anchorDecision.thresholdPassed===false));
  if(config.anchorActivationZ===0){assert.ok(newOn.results.some(r=>r.anchorBonus>0));retainedRaw=newOn;}
  if(config.anchorActivationFloor===.99)assert.ok(newOn.results.every(r=>r.anchorBonus===0));
  evidence.push({config,before:ranking(oldOff),after:ranking(newOn),disabled:ranking(newOff),trace:newOn,synthetic:true});
  assert.deepEqual(newOn.anchorQuery.seeds,f.input.queryState.sourceField);assert.equal(newOn.anchorQuery.fallbackAnchor,false);
 }
 const truncated=await f.run(f.a,{includeTrace:true,topK:1});assert.equal(truncated.results.length,1);assert.equal(truncated.anchorQuery.candidatePool.length,5);assert.ok(truncated.anchorQuery.candidatePool.every(r=>Array.isArray(r.contacts)&&!Object.hasOwn(r,'text')));
 const fallback=await f.run(f.a,{includeTrace:true,queryState:{...f.input.queryState,fieldProvenance:[]}});assert.equal(fallback.anchorQuery.fallbackAnchor,true);
});
test('T1/T10/T11 real pipeline trace, hop-0 identity, no-trace metadata ABI and enhanced-vector parity',async t=>{
 const f=await fixture(t);const input={queryId:'p1d',queryText:'synthetic',coreTags:['seed-one'],config:{maxLevels:1,pyramidTopK:4,maxEmergentNodes:8,spikeRouting:{maxSafeHops:2,maxPropagationStates:100,maxOutputNodes:0,maxOutputEdges:0}}};
 const run=async(index,trace)=>index.runMemoPipeline(f.dbPath,f.artifact.artifactSig,JSON.stringify({...input,...(trace?{includeTrace:true}:{})}),new Float32Array([1,0,0,0]),new Float32Array(0));
 const b=await run(f.b,false),a=await run(f.a,false),tr=await run(f.a,true);assert.deepEqual(Array.from(b.enhancedVector),Array.from(a.enhancedVector));assert.deepEqual(Array.from(b.enhancedVector),Array.from(tr.enhancedVector));
 const bm=JSON.parse(b.metadataJson),am=JSON.parse(a.metadataJson),tm=JSON.parse(tr.metadataJson);assert.deepEqual(Object.keys(am).sort(),Object.keys(bm).sort());assert.ok(!Object.hasOwn(am,'causalityTrace'));
 const q=tm.causalityTrace;assert.equal(q.schema,'memo-query-causality-v1');assert.ok(q.gatedTags.length);assert.ok(q.observation.nodes.some(n=>n.hop===0));assert.deepEqual(q.coreTags,input.coreTags);assert.ok(q.selectedTags.every(x=>!Object.hasOwn(x,'vector')));
 const native=await f.run(f.a,{includeTrace:true,observationHandle:tm.observationHandle});assert.equal(native.anchorQuery.observationHandle,tm.observationHandle);for(const [id]of native.anchorQuery.seeds)assert.ok(q.observation.sourceField.some(x=>x[0]===id));
});
test('T1 actual KBM preparation forwards diagnostic flag and actual Engine preserves query/contact payload',async t=>{
 const f=await fixture(t);const acorn=cr('acorn');const source=fs.readFileSync(path.join(core,'KnowledgeBaseManager.js'),'utf8'),tree=acorn.parse(source,{ecmaVersion:'latest'}),cls=tree.body.find(n=>n.type==='ClassDeclaration'&&n.id.name==='KnowledgeBaseManager'),method=cls.body.body.find(n=>n.key.name==='prepareUnifiedMemoObservation');
 const kbm=vm.runInNewContext('(new(class{'+source.slice(method.start,method.end)+'})())',{Float32Array,Object,Number,String,Array,Math,RangeError,Error});
 kbm.config={dimension:4};kbm.ragParams={};kbm.tagIndex=f.a;kbm._resolveUnifiedMemoRuntime=()=>({artifact:{artifactSig:f.artifact.artifactSig,generation:1,effectiveConfig:{}},dbPath:f.dbPath});
 const prepared=await kbm.prepareUnifiedMemoObservation({text:'synthetic',vector:[1,0,0,0]},{includeTrace:true,coreTags:['seed-one']});assert.ok(prepared.sourceObservationResult.causalityTrace);
 const Engine=cr('./RiverMemoEngine.js');const facade={runtime:{tagIndex:f.a,config:{dimension:4},db:f.db},config:{},_nativeConfig:Engine.prototype._nativeConfig};
 const out=await Engine.prototype._rerankNative.call(facade,{text:'synthetic',vector:new Float32Array([1,0,0,0])},f.input.candidates,{}, {includeTrace:true,topK:5,observationHandle:prepared.observationHandle,dbPath:f.dbPath},prepared.artifact,prepared.nativePreparedQuery);
 assert.equal(out.queryObservation,prepared.sourceObservationResult.causalityTrace);assert.equal(out.anchorQuery.observationHandle,prepared.observationHandle);assert.ok(out.results.every(r=>Array.isArray(r.topologyV3.contacts)));
 const no=await kbm.prepareUnifiedMemoObservation({text:'synthetic',vector:[1,0,0,0]},{});assert.ok(!Object.hasOwn(no.sourceObservationResult,'causalityTrace'));
 const off=await Engine.prototype._rerankNative.call(facade,{text:'synthetic',vector:new Float32Array([1,0,0,0])},f.input.candidates,{}, {topK:5,observationHandle:prepared.observationHandle,dbPath:f.dbPath},prepared.artifact,prepared.nativePreparedQuery);assert.ok(!Object.hasOwn(off,'queryObservation')&&!Object.hasOwn(off,'anchorQuery'));assert.deepEqual(ranking(out),ranking(off));retainedRaw=out;
});
test('T8/T9 actual LightMemo and Inspector preserve causal trace and unknown fields unchanged',async t=>{
 const h=cr('./Plugin/RiverMemoInspector/tests/harness.cjs');const f=h.lightFixture();const value=j(retainedRaw);value.futureCausality={sentinel:[0,null,'kept']};const snapshot=j(value);f.lm.vectorDBManager.rerankWithRiverMemoAsync=async()=>value;
 const runtime=await h.load(t,f.lm);const out=await runtime.pm.processToolCall('RiverMemoInspector',{action:'trace_query',query:'exam',diaries:['Fixture'],k:5});assert.equal(out.raw_trace,value);assert.deepEqual(out.raw_trace,snapshot);assert.equal(out.trace_schema.limitation,'UNKNOWN_TRACE_SCHEMA');assert.equal(out.trace_schema.individual_anchor_contacts_available,null);assert.equal(runtime.calls.filter(c=>c.toolName==='LightMemo').length,1);assert.ok(out.raw_trace.queryObservation&&out.raw_trace.anchorQuery);
});
