'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const express=require('express');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {ConversationExecution}=require('../Plugin/NativeSync/mobile/execution');
const {MobilePortal}=require('../Plugin/NativeSync/mobile/portal');
const native=require('../modules/requestExecutionContext');
const {AttachmentStore,hash}=require('../Plugin/NativeSync/mobile/attachments');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){const end=Date.now()+6000;while(!await fn()){assert.ok(Date.now()<end,'bounded condition timed out');await pause(10);}}
const topic={key:'group',ownerType:'group',ownerId:'synthetic-group',topicId:'topic',memberAliases:{a:'alias-a',b:'alias-b'}};
const agents={isAgent:a=>['alias-a','alias-b'].includes(a),getAgentPrompt:async a=>'frozen '+a};
const configuration=(extra={})=>({group:{name:'Synthetic Group',mode:'sequential',members:['a','b'],groupPrompt:'shared group prompt',...extra.group},agents:[{id:'a',name:'Alpha',systemPrompt:'prompt Alpha',model:'model-a',temperature:0.2,maxOutputTokens:100,...extra.a},{id:'b',name:'Beta',systemPrompt:'prompt Beta',model:'model-b',temperature:0.8,maxOutputTokens:200,...extra.b}],...extra.policy&&{executionPolicy:extra.policy}});
const publish=(engine,config=configuration(),version=0,t=topic)=>engine.configs.publish({topics:[{ownerType:t.ownerType,ownerId:t.ownerId,topicId:t.topicId,expectedVersion:version,config}]});
async function fixture(t,{topics=[topic],fault=()=>{},...options}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-group-')),file=path.join(root,'central.sqlite');
 let store=new CentralStore(file),engine=new ConversationExecution({store,topics,agentManager:agents,configRequired:true,fault,...options}),server;
 const f={root,file,get store(){return store;},get engine(){return engine;},async reopen(){await engine.close();store.close();store=new CentralStore(file);engine=new ConversationExecution({store,topics,agentManager:agents,configRequired:true,...options});},async model(handler){server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));engine.setEndpoint({url:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key:'synthetic-only'});return server;}};
 t.after(async()=>{await engine.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}store.close();fs.rmSync(root,{recursive:true,force:true});});return f;
}
const json=(res,content)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content}}]}));};
async function body(req){let text='';for await(const chunk of req)text+=chunk;return JSON.parse(text);}
const submit=(engine,id,text='hello',key='group')=>engine.accept('device',{topicKey:key,requestId:id,text});

test('sequential native member parameters, frozen configs and U1/A/B/U2 ordering survive queued version updates',async t=>{
 const f=await fixture(t);await publish(f.engine);const first=submit(f.engine,'group_request_1','U1');
 await publish(f.engine,configuration({a:{model:'model-a-v2'}}),1);const second=submit(f.engine,'group_request_2','U2');
 const requests=[];await f.model(async(req,res)=>{const value=await body(req);requests.push(value);json(res,'reply '+requests.length);});
 await until(()=>f.engine.get(second.id).state==='completed');
 assert.equal(requests.length,4);assert.deepEqual(requests.map(r=>[r.model,r.temperature,r.max_tokens]),[['model-a',0.2,100],['model-b',0.8,200],['model-a-v2',0.2,100],['model-b',0.8,200]]);
 assert.ok(!JSON.stringify(requests[0]).includes('U2'));assert.ok(JSON.stringify(requests[1]).includes('[Alpha的发言]: reply 1'));
 const history=requests[2].messages.filter(m=>m.role!=='system').map(m=>m.content[0].text);assert.deepEqual(history.slice(0,4),['[用户的发言]: U1','[Alpha的发言]: reply 1','[Beta的发言]: reply 2','[用户的发言]: U2']);
 assert.equal(requests[0].messages[0].content,'prompt Alpha\n\n[群聊设定]:\nshared group prompt');
 assert.equal(requests[0].vcpchatExtensions.requestContext.ownerType,'group');assert.ok(requests[0].vcpchatExtensions.messageTimestampBindings.length);
 assert.ok(!JSON.stringify(requests).includes('__vcpchatTimestampMeta'));assert.ok(!JSON.stringify(requests).includes('__vcpContextCheckpoint'));
 assert.equal(f.store.metrics().journalRows,6);assert.equal(f.engine.public(f.engine.get(first.id),'device').steps.every(s=>s.attempts===1),true);
 assert.equal(submit(f.engine,'group_request_1','U1').replayed,true);assert.equal(f.store.metrics().journalRows,6);
});

test('invite_only saves user input without automatic calls; manual invitation is durable, scoped and has no fake user history',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({group:{mode:'invite_only'}}));const user=submit(f.engine,'invite_user_1');assert.equal(user.state,'completed');
 assert.throws(()=>f.engine.invite('device',{topicKey:'group',requestId:'invite_invalid',agentId:'foreign'}),e=>e.code==='GROUP_MEMBER_UNAVAILABLE');
 const invite=f.engine.invite('device',{topicKey:'group',requestId:'invite_valid_1',agentId:'b'});await f.reopen();let calls=0;
 await f.model(async(req,res)=>{const value=await body(req);calls++;assert.equal(value.model,'model-b');json(res,'invited response');});await until(()=>f.engine.get(invite.id).state==='completed');
 assert.equal(calls,1);assert.equal(f.store.metrics().journalRows,2);assert.equal(f.engine.invite('device',{topicKey:'group',requestId:'invite_valid_1',agentId:'b'}).replayed,true);
 assert.throws(()=>f.engine.cancel(invite.id,'other-device'),e=>e.status===404);
});

test('nature random chooses once before acceptance; persisted plan is never reselected after restart',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({group:{mode:'naturerandom'}}));const job=submit(f.engine,'nature_request_1','@所有人');const planned=JSON.parse(f.engine.get(job.id).group_plan);assert.ok(planned.length);
 await f.reopen();const mode=require('../Plugin/NativeSync/nativeRules/Groupmodules/modes/natureRandomMode'),original=mode.determineSpeakers;mode.determineSpeakers=()=>{throw Error('must not reselect accepted plan');};t.after(()=>mode.determineSpeakers=original);
 const models=[];await f.model(async(req,res)=>{models.push((await body(req)).model);json(res,'done');});await until(()=>f.engine.get(job.id).state==='completed');assert.deepEqual(models,planned.map(id=>id==='a'?'model-a':'model-b'));
});

test('member HTTP errors retain identity and continue the native plan; missing members are excluded and JEV is read-only',async t=>{
 const f=await fixture(t);await publish(f.engine);let calls=0;await f.model(async(req,res)=>{await body(req);if(++calls===1){res.writeHead(503);res.end('synthetic private provider detail must never persist');}else json(res,'Beta response');});
 const job=submit(f.engine,'error_request_1');await until(()=>f.engine.get(job.id).state==='completed');assert.equal(calls,2);const rows=f.store.pull(0).events.map(e=>e.message);assert.equal(rows[1].agentId,'a');assert.equal(rows[2].agentId,'b');assert.ok(rows[1].content.includes('503'));assert.ok(!JSON.stringify(rows).includes('private provider'));
 const config=configuration();config.agents[1]={id:'b',unavailable:true};await publish(f.engine,config,1);const next=submit(f.engine,'unavailable_1');await until(()=>f.engine.get(next.id).state==='completed');assert.equal(f.engine.public(f.engine.get(next.id),'device').stepCount,1);
 await publish(f.engine,configuration({group:{mode:'jev'}}),2);assert.throws(()=>submit(f.engine,'jev_request_1'),e=>e.code==='GROUP_MODE_REQUIRES_DESKTOP');
});

test('step publication crash recovers the same Journal operation and resumes only the remaining known step',async t=>{
 let crash=true;const f=await fixture(t,{fault:point=>{if(point==='group-step-applied'&&crash){crash=false;throw Error('synthetic crash after journal commit');}}});await publish(f.engine);let calls=0;
 const server=await f.model(async(req,res)=>{await body(req);calls++;json(res,'result '+calls);});const job=submit(f.engine,'step_crash_1');await until(()=>f.engine.get(job.id).state==='recovering');assert.equal(calls,1);assert.equal(f.store.metrics().journalRows,2);
 await f.reopen();f.engine.setEndpoint({url:`http://127.0.0.1:${server.address().port}/v1/chat/completions`,key:'synthetic-only'});await until(()=>f.engine.get(job.id).state==='completed');assert.equal(calls,2);assert.equal(f.store.metrics().journalRows,3);assert.equal(new Set(f.store.pull(0).events.map(e=>e.msgId)).size,3);
});

test('uncertain running steps survive restart as review_required and are never repeated',async t=>{
 const f=await fixture(t);await publish(f.engine);const job=submit(f.engine,'uncertain_1');const step=f.engine.public(f.engine.get(job.id),'device').steps[0];f.store.db.prepare("UPDATE mobile_execution_steps SET state='running',attempts=1 WHERE id=?").run(step.id);f.store.db.prepare("UPDATE mobile_executions SET state='running' WHERE id=?").run(job.id);await f.reopen();let calls=0;await f.model(async(_req,res)=>{calls++;json(res,'must not run');});await pause(150);
 assert.equal(f.engine.get(job.id).state,'review_required');assert.equal(calls,0);assert.throws(()=>submit(f.engine,'uncertain_2'),e=>e.code==='DEPENDENCY_REVIEW_REQUIRED');assert.throws(()=>f.engine.resolveReview(job.id,'foreign','acknowledge_and_abandon_remaining'),e=>e.status===404);
 f.engine.resolveReview(job.id,'device','acknowledge_and_abandon_remaining');assert.equal(f.engine.get(job.id).review_resolved,1);assert.equal(calls,0);
});

test('partial stream saves visible text, pauses successors, allows another Group and resumes only new work after acknowledgement',async t=>{
 const other={...topic,key:'other',ownerId:'other-group'};const f=await fixture(t,{topics:[topic,other]});await publish(f.engine);await publish(f.engine,configuration(),0,other);let calls=0;
 await f.model(async(req,res)=>{await body(req);calls++;if(calls===1){res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: {"choices":[{"delta":{"content":"部分回复"}}]}\n\n');}else json(res,'continued '+calls);});
 await publish(f.engine,configuration({a:{streamOutput:true}}),1);const first=submit(f.engine,'partial_1'),second=submit(f.engine,'partial_2');await until(()=>f.engine.get(first.id).state==='review_required');assert.equal(f.engine.get(second.id).state,'queued');assert.equal(calls,1);assert.ok(f.store.pull(0).events.some(e=>e.message.content.includes('部分回复')));
 const independent=submit(f.engine,'independent_1','other','other');await until(()=>f.engine.get(independent.id).state==='completed');assert.equal(calls,3);f.engine.resolveReview(first.id,'device','acknowledge_and_abandon_remaining');await until(()=>f.engine.get(second.id).state==='completed');assert.equal(calls,5);assert.equal(f.engine.public(f.engine.get(first.id),'device').steps[0].attempts,1);
});

test('stream transport handles native four delta formats and fragmented UTF-8 without leaking internal metadata',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({a:{streamOutput:true},b:{streamOutput:true}}));await f.model(async(req,res)=>{await body(req);res.writeHead(200,{'Content-Type':'text/event-stream'});const bytes=Buffer.from('data: {"choices":[{"delta":{"content":"中"}}]}\n\ndata: {"delta":{"content":"文"}}\n\ndata: {"content":"回"}\n\ndata: {"message":{"content":"复"}}\n\ndata: [DONE]\n\n');for(let n=0;n<bytes.length;n+=3)res.write(bytes.subarray(n,n+3));res.end();});
 const job=submit(f.engine,'stream_formats_1');await until(()=>f.engine.get(job.id).state==='completed');assert.deepEqual(f.store.pull(0).events.filter(e=>e.message.role==='assistant').map(e=>e.message.content),['中文回复','中文回复']);
});

test('original approval waits pause watchdogs; cancellation denies original pending request and fences later tool dispatch',async t=>{
 const f=await fixture(t,{executionTimeoutMs:1000,groupIdleTimeoutMs:1000});await publish(f.engine);let originalResolve,denied=0,tools=0,calls=0;
 const app=express();app.use(express.json());app.use(native.middleware);app.post('/v1/chat/completions',async(req,res)=>{calls++;try{await native.waitForApproval(new Promise(r=>originalResolve=r),()=>{denied++;originalResolve(false);});native.throwIfCancelled();native.toolStarted();tools++;json(res,'approved');}catch{if(!res.destroyed)res.end();}});
 const server=await f.model(app),job=submit(f.engine,'approval_cancel_1');await until(()=>f.engine.get(job.id).state==='waiting_approval');await pause(1200);assert.equal(f.engine.get(job.id).state,'waiting_approval');f.engine.cancel(job.id,'device');await until(()=>f.engine.get(job.id).state==='cancelled'&&denied===1);originalResolve(true);await pause(50);assert.equal(calls,1);assert.equal(tools,0);assert.equal(f.store.metrics().journalRows,1);assert.equal(f.engine.public(f.engine.get(job.id),'device').steps[1].attempts,0);
});

test('filter failure blocks execution before network, retaining the accepted message without unfiltered disclosure',async t=>{
 const f=await fixture(t);await publish(f.engine);const sanitizer=require('../Plugin/NativeSync/nativeRules/modules/contextSanitizer'),original=sanitizer.stripThoughtChains;sanitizer.stripThoughtChains=()=>{throw Error('synthetic filter fault');};t.after(()=>sanitizer.stripThoughtChains=original);let calls=0;await f.model(async(_req,res)=>{calls++;json(res,'unsafe');});const job=submit(f.engine,'filter_failure_1');await until(()=>f.engine.get(job.id).state==='blocked_config');assert.equal(calls,0);assert.equal(f.store.metrics().journalRows,1);
});

test('frozen aliases remain in native AgentManager guard path and cannot affect unrelated or unregistered requests',async()=>{
 const manager=require('../modules/agentManager');const release=native.register('frozen-synthetic',{promptPolicy:'native-alias-snapshot',agentAlias:'alias-a',systemPrompt:'frozen original prompt'}),controller=new AbortController();
 try{assert.equal(native.agentPrompt('alias-a'),undefined);await native.run('frozen-synthetic',controller.signal,async()=>{assert.equal(await manager.getAgentPrompt('alias-a'),'frozen original prompt');assert.equal(native.agentPrompt('alias-b'),undefined);});assert.equal(native.agentPrompt('alias-a'),undefined);}finally{release();}
});

test('accepted attachment intent remains linkable after stage TTL and portal reopen without desktop',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-accepted-file-')),file=path.join(root,'central.sqlite'),agent={key:'agent',ownerType:'agent',ownerId:'synthetic',topicId:'t',agentAlias:'alias-a'};let store=new CentralStore(file),portal=new MobilePortal({store,agentManager:agents,config:{NativeMobileOrigin:'https://synthetic.invalid',NativeSyncDataDir:root,NativeMobileTopics:JSON.stringify([agent]),NativeMobileConfigSync:true,NativeMobileAttachments:true}});
 t.after(async()=>{await portal.close();store.close();fs.rmSync(root,{recursive:true,force:true});});await publish(portal.engine,{name:'Synthetic',systemPrompt:'prompt',model:'text'},0,agent);
 const bytes=Buffer.from('accepted attachment survives expired staging'),cas=portal.attachments,start=cas.begin('mobile:device','agent',{requestId:'intent_file_1',name:'test.txt',size:bytes.length,expectedHash:hash(bytes)});cas.chunk('mobile:device','agent',start.uploadId,{offset:0,data:bytes.toString('base64')});await cas.finish('mobile:device','agent',start.uploadId);
 portal.engine.fault=point=>{if(point==='accepted-intent')throw Error('synthetic process stop');};assert.throws(()=>portal.engine.accept('device',{topicKey:'agent',requestId:'intent_submit_1',text:'check',attachments:[start.uploadId]}));store.db.prepare('UPDATE attachment_uploads SET expires=0').run();cas.expire();assert.equal(store.db.prepare('SELECT count(*) AS n FROM attachment_uploads').get().n,1);await portal.close();store.close();
 store=new CentralStore(file);portal=new MobilePortal({store,agentManager:agents,config:{NativeMobileOrigin:'https://synthetic.invalid',NativeSyncDataDir:root,NativeMobileTopics:JSON.stringify([agent]),NativeMobileConfigSync:true,NativeMobileAttachments:true}});const job=portal.engine.list('agent','device')[0],message=store.pull(0).events[0].message;assert.equal(job.state,'queued');assert.equal(hash(portal.attachments.locate('agent',message.id,message.attachments[0].id).bytes),hash(bytes));portal.attachments.expire();assert.equal(store.metrics().journalRows,1);
});

test('crash during cancellation keeps an uncertain Group dependency blocked after restart',async t=>{
 const f=await fixture(t);await publish(f.engine);const job=submit(f.engine,'cancel_crash_1');const step=f.engine.public(f.engine.get(job.id),'device').steps[0];
 f.store.db.prepare("UPDATE mobile_execution_steps SET state='waiting_approval',attempts=1 WHERE id=?").run(step.id);f.store.db.prepare("UPDATE mobile_executions SET state='cancelling',cancel_requested=1 WHERE id=?").run(job.id);await f.reopen();
 assert.equal(f.engine.get(job.id).state,'review_required');assert.equal(f.engine.get(job.id).error_code,'EXECUTION_INTERRUPTED_REVIEW_REQUIRED');assert.throws(()=>submit(f.engine,'cancel_crash_2'),e=>e.code==='DEPENDENCY_REVIEW_REQUIRED');
});

test('Group HTTP catalog, manual invitations and review handling enforce exact device and topic capabilities',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-group-routes-')),store=new CentralStore(path.join(root,'central.sqlite')),other={...topic,key:'other',ownerId:'other-group'},portal=new MobilePortal({store,agentManager:agents,config:{NativeMobileOrigin:'https://synthetic.invalid',NativeSyncDataDir:root,NativeMobileTopics:JSON.stringify([topic,other]),NativeMobileConfigSync:true}});
 await publish(portal.engine,configuration({group:{mode:'invite_only'}}));await publish(portal.engine,configuration({group:{mode:'game'}}),0,other);
 const app=express();app.set('trust proxy',true);app.use('/mobile',portal.router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await portal.close();server.closeAllConnections();await new Promise(r=>server.close(r));store.close();fs.rmSync(root,{recursive:true,force:true});});
 const grant=portal.createPairing(),{digest}=require('../Plugin/NativeSync/mobile/execution');store.db.prepare('UPDATE mobile_pairings SET scopes=? WHERE hash=?').run(JSON.stringify(['group']),digest(grant.pairingCode));let cookie;
 const request=(route,payload)=>fetch(`http://127.0.0.1:${server.address().port}/mobile/api/`+route,{method:payload?'POST':'GET',headers:{Origin:'https://synthetic.invalid','X-Forwarded-Proto':'https','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:payload?JSON.stringify(payload):undefined});
 const login=await request('pair',{code:grant.pairingCode});cookie=login.headers.get('set-cookie').split(';')[0];const catalog=await(await request('session')).json();assert.equal(catalog.topics.length,1);assert.equal(catalog.topics[0].ownerType,'group');assert.equal(catalog.topics[0].members[0].name,'Alpha');assert.ok(!JSON.stringify(catalog).includes('prompt Alpha'));assert.ok(!JSON.stringify(catalog).includes('systemPrompt'));
 assert.equal((await request('conversations/other')).status,403);assert.equal((await request('conversations/other/invitations',{requestId:'foreign_invite',agentId:'a'})).status,403);assert.equal((await request('conversations/group/invitations',{requestId:'extra_field',agentId:'a',systemPrompt:'forbidden'})).status,400);
 const invitation=await(await request('conversations/group/invitations',{requestId:'valid_invite',agentId:'a'})).json();assert.equal(invitation.kind,'group_invitation');assert.equal(invitation.state,'queued');assert.equal(store.metrics().journalRows,0);
 const page=await(await request('conversations/group')).json();assert.equal(page.executions[0].steps[0].agentId,'a');assert.equal(page.topicState.groupMode,'invite_only');assert.equal(portal.catalog({scopes:['other']})[0].unavailableReason,'GROUP_MODE_REQUIRES_DESKTOP');assert.equal((await request('executions/'+invitation.id+'/resolve',{action:'approve_tools'})).status,409);
});

test('native Group window and unified model affect requests without truncating committed history or member parameters',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({group:{enableContextMessageWindow:true,contextMessageWindowSize:2,useUnifiedModel:true,unifiedModel:'unified-native'}}));
 for(let i=0;i<5;i++)f.store.apply({ownerType:'group',ownerId:topic.ownerId,topicId:topic.topicId,msgId:'old-'+i,deviceId:'synthetic-desktop',opId:'old-'+i,action:'upsert',baseHash:null,message:{id:'old-'+i,role:'user',content:'old '+i,timestamp:i+1}});
 const requests=[];await f.model(async(req,res)=>{requests.push(await body(req));json(res,'window reply');});const job=submit(f.engine,'window_request_1','current');await until(()=>f.engine.get(job.id).state==='completed');
 assert.deepEqual(requests.map(r=>[r.model,r.temperature,r.max_tokens]),[['unified-native',0.2,100],['unified-native',0.8,200]]);assert.equal(requests[0].messages.length,4);assert.ok(!JSON.stringify(requests[0]).includes('old 3'));assert.ok(JSON.stringify(requests[0]).includes('old 4'));assert.equal(f.store.metrics().journalRows,8);
});

test('ordinary SSE member error preserves received text and continues known remaining members',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({a:{streamOutput:true}}));let calls=0;await f.model(async(req,res)=>{await body(req);if(++calls===1){res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: {"content":"已收到的部分"}\n\ndata: {"error":{"status":429}}\n\n');}else json(res,'next member');});
 const job=submit(f.engine,'known_stream_error');await until(()=>f.engine.get(job.id).state==='completed');const reply=f.store.pull(0).events.find(e=>e.message.agentId==='a').message;assert.ok(reply.content.startsWith('已收到的部分'));assert.ok(reply.content.includes('429'));assert.equal(calls,2);
});

test('cancel after native tool dispatch retains a review hold while preserving prior committed results',async t=>{
 const f=await fixture(t);await publish(f.engine);let entered=false;await f.model(async(req,res)=>{const value=await body(req);native.events.emit('tool',{requestId:value.requestId,started:true});entered=true;req.on('close',()=>{});res.on('close',()=>{});});
 const job=submit(f.engine,'tool_cancel_review');await until(()=>entered);f.engine.cancel(job.id,'device');await until(()=>f.engine.get(job.id).state==='cancelled');assert.equal(f.engine.get(job.id).error_code,'EXECUTION_CANCELLED_REVIEW_REQUIRED');assert.throws(()=>submit(f.engine,'tool_cancel_next'),e=>e.code==='DEPENDENCY_REVIEW_REQUIRED');assert.equal(f.engine.public(f.engine.get(job.id),'device').steps[1].attempts,0);f.engine.resolveReview(job.id,'device','acknowledge_and_abandon_remaining');assert.equal(f.engine.get(job.id).review_resolved,1);
});

test('unpublished desktop Canvas/workspace context is explicit and cannot masquerade as cloud parity',async t=>{
 const f=await fixture(t);await publish(f.engine,configuration({group:{groupPrompt:'{{VCPChatWorkSpace:synthetic}}'}}));let calls=0;await f.model(async(_req,res)=>{calls++;json(res,'must not run');});const job=submit(f.engine,'desktop_context_1');await until(()=>f.engine.get(job.id).state==='blocked_config');assert.equal(f.engine.get(job.id).error_code,'DESKTOP_CONTEXT_REQUIRED');assert.equal(calls,0);assert.equal(f.store.metrics().journalRows,1);
});
