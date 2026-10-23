'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {ConversationExecution}=require('../Plugin/NativeSync/mobile/execution');
const {ExecutionConfigs}=require('../Plugin/NativeSync/mobile/executionConfigs');
const express=require('express'),auth=require('../modules/apiBearerAuth');
const topic={key:'config-test',ownerType:'agent',ownerId:'test-agent',topicId:'test-topic',agentAlias:'test-alias',model:'legacy-model'};
const agents={isAgent:a=>a==='test-alias',getAgentPrompt:async()=>{throw Error('published jobs must not read mutable native prompt');}};
const config={name:'Test',systemPrompt:'Synthetic {{AgentName}} prompt',model:'model-v1',temperature:0.2,contextTokenLimit:10000,maxOutputTokens:100};
const body=(value=config,version=0)=>({topics:[{ownerType:topic.ownerType,ownerId:topic.ownerId,topicId:topic.topicId,expectedVersion:version,config:value}]});
async function wait(fn){for(let n=0;n<300;n++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');}
test('private configs reject missing/version-conflicting/foreign/extra inputs; unchanged publication is idempotent',async()=>{
 const store=new CentralStore(':memory:'),engine=new ConversationExecution({store,topics:[topic],agentManager:agents,configRequired:true});
 try{
  assert.throws(()=>engine.accept('session',{topicKey:topic.key,requestId:'config001',text:'hello'}),e=>e.code==='EXECUTION_CONFIG_REQUIRED');
  assert.equal(store.metrics().journalRows,0);
  assert.equal((await engine.configs.publish(body())).topics[0].configVersion,1);
  assert.equal((await engine.configs.publish(body())).topics[0].configVersion,1);
  await assert.rejects(()=>engine.configs.publish(body({...config,temperature:0.8},0)),e=>e.code==='CONFIG_VERSION_CONFLICT');
  await assert.rejects(()=>engine.configs.publish(body({...config,apiKey:'synthetic-forbidden'})),e=>e.code==='INVALID_EXECUTION_CONFIG');
  const foreign=body();foreign.topics[0].ownerId='other';await assert.rejects(()=>engine.configs.publish(foreign),e=>e.code==='TOPIC_NOT_ALLOWED');
  await engine.configs.publish(body({...config,model:'model-v2'},1));await engine.configs.publish(body(config,2));
  assert.equal(engine.configs.public(topic.key).configVersion,3);
  assert.equal('systemPrompt' in engine.configs.public(topic.key),false);
 }finally{await engine.close();store.close();}
});
test('accepted tasks retain configuration across updates and SQLite reopen, execute without desktop or mutable native prompt',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-config-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'central.sqlite');let store=new CentralStore(file),engine=new ConversationExecution({store,topics:[topic],agentManager:agents,configRequired:true});
 await engine.configs.publish(body());const one=engine.accept('session',{topicKey:topic.key,requestId:'config001',text:'one'});
 await engine.configs.publish(body({...config,model:'model-v2',temperature:0.8},1));
 const two=engine.accept('session',{topicKey:topic.key,requestId:'config002',text:'two'});
 assert.equal(one.configVersion,1);assert.equal(two.configVersion,2);
 await engine.close();store.close();
 store=new CentralStore(file);engine=new ConversationExecution({store,topics:[topic],agentManager:agents,configRequired:true});
 const requests=[];const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;requests.push(JSON.parse(raw));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'done'}}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  engine.setEndpoint({url:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key:'synthetic-test-key'});
  await wait(()=>engine.get(two.id).state==='completed');
  assert.deepEqual(requests.map(r=>[r.model,r.temperature]),[['model-v1',0.2],['model-v2',0.8]]);
  assert.equal(requests[0].messages[0].content,'Synthetic Test prompt');
  assert.ok(requests[1].messages.some(m=>m.content==='done'||m.content?.[0]?.text==='done'));
  assert.equal(JSON.stringify(engine.public(engine.get(one.id),'session')).includes('Synthetic'),false);
 }finally{await engine.close();store.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('only host Bearer authority publishes; mobile cookies cannot publish or expose private snapshots',async()=>{
 const plugin=require('../Plugin/NativeSync/native-sync');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-config-route-'));
 plugin.setMobileHostAuthority({agentManager:agents,verifyKey:async()=>false});
 await plugin.initialize({NativeSyncEnabled:true,NativeSyncDataDir:path.join(root,'data'),NativeMobileEnabled:true,NativeMobileConfigSync:true,NativeMobileOrigin:'https://synthetic.invalid',NativeMobileTopics:JSON.stringify([topic])});
 const app=express();app.use(express.json());app.use(auth('synthetic-test-key'));const router=express.Router();plugin.registerApiRoutes(router);app.use('/api/plugins/NativeSync',router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/api/plugins/NativeSync/mobile/execution-configs`;
 try {
  const send=(headers)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body())});
  assert.equal((await send({Cookie:'__Secure-vcp_mobile=synthetic'})).status,401);
  assert.equal((await send({Authorization:'Bearer synthetic-test-key'})).status,200);
  const r=await(await fetch(url,{headers:{Authorization:'Bearer synthetic-test-key'}})).json();
  assert.equal(r.topics[0].configVersion,1);assert.equal(JSON.stringify(r).includes('systemPrompt'),false);
 }finally{await plugin.shutdown();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
test('native alias prompt is frozen at publication; mixed or recursive Agent authority is rejected',async()=>{
 const store=new CentralStore(':memory:');let prompt='native-v1';
 const configs=new ExecutionConfigs(store.db,[topic],{isAgent:a=>['test-alias','other'].includes(a),getAgentPrompt:async()=>prompt},true);
 try{
  await configs.publish(body({...config,systemPrompt:'{{agent:test-alias}}'}));
  const snapshot=configs.snapshot(topic);prompt='native-v2';
  assert.equal(snapshot.systemPrompt,'native-v1');assert.equal(snapshot.promptPolicy,'native-alias-snapshot');
  await configs.publish(body({...config,systemPrompt:'{{agent:test-alias}}'},1));assert.equal(configs.snapshot(topic).version,2);
  await assert.rejects(()=>configs.publish(body({...config,systemPrompt:'{{other}} extra'},2)),e=>e.code==='CONFIG_PROMPT_AUTHORITY_CONFLICT');
  prompt='{{other}}';await assert.rejects(()=>configs.publish(body({...config,systemPrompt:'{{test-alias}}'},2)),e=>e.code==='CONFIG_PROMPT_SNAPSHOT_UNAVAILABLE');
 }finally{store.close();}
});
test('group snapshots preserve native identities, member order and parameters with explicit alias bindings',async()=>{
 const store=new CentralStore(':memory:');const group={key:'group',ownerType:'group',ownerId:'g',topicId:'t',memberAliases:{a:'test-alias',b:'test-alias'}};
 const configs=new ExecutionConfigs(store.db,[group],agents,true);
 const request={topics:[{ownerType:'group',ownerId:'g',topicId:'t',expectedVersion:0,config:{group:{name:'Synthetic Group',mode:'sequential',members:['b','a']},agents:[{id:'a',...config},{id:'b',...config,temperature:0.8}]}}]};
 try{
  await configs.publish(request);assert.deepEqual(configs.snapshot(group).agents.map(a=>[a.id,a.temperature]),[['b',0.8],['a',0.2]]);
  request.topics[0].config.group.members=['foreign'];request.topics[0].config.agents=[{id:'foreign',...config}];await assert.rejects(()=>configs.publish(request),e=>e.code==='GROUP_MEMBER_NOT_AUTHORIZED');
 }finally{store.close();}
});

test('native desktop template preserves same-owner alias composition, freezes its expansion and rejects foreign authority',async()=>{
 const store=new CentralStore(':memory:');let prompt='native-version-1';const manager={isAgent:a=>['test-alias','foreign-alias'].includes(a),getAgentPrompt:async()=>prompt},configs=new ExecutionConfigs(store.db,[topic],manager,true),template='Desktop prefix {{agent:test-alias}}\n{{VarToolList}} desktop suffix';
 try{await configs.publish(body({...config,systemPrompt:template}));const snapshot=configs.snapshot(topic);prompt='native-version-2';assert.equal(snapshot.systemPrompt,'native-version-1');assert.equal(snapshot.promptTemplate,template);const messages=await require('../Plugin/NativeSync/mobile/effectiveContext').effectiveRequest([],snapshot,'none');assert.equal(messages[0].content,template);assert.equal(snapshot.promptPolicy,'native-alias-snapshot');
  await assert.rejects(()=>configs.publish(body({...config,systemPrompt:'prefix {{foreign-alias}}'},1)),e=>e.code==='CONFIG_PROMPT_AUTHORITY_CONFLICT');await assert.rejects(()=>configs.publish(body({...config,systemPrompt:'{{agent:never-loaded}}'},1)),e=>e.code==='CONFIG_PROMPT_AUTHORITY_CONFLICT');prompt='recursive {{test-alias}}';await assert.rejects(()=>configs.publish(body({...config,systemPrompt:template},1)),e=>e.code==='CONFIG_PROMPT_SNAPSHOT_UNAVAILABLE');
 }finally{store.close();}
});
