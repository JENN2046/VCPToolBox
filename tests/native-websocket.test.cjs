'use strict';
// Synthetic input only; this is not a human confirmation acceptance.
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{randomUUID}=require('node:crypto');
const {handleNativeConversationMessage:handle}=require('../modules/nativeConversationWebSocket');
function fixture(){const ws=new EventEmitter();Object.assign(ws,{clientType:'DistributedServer',serverId:randomUUID(),readyState:1,send:text=>ws.messages.push(JSON.parse(text)),messages:[]});const calls=[];const plugin={name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'},communication:{protocol:'stdio'}};return {ws,calls,manager:{plugins:new Map([['Example',plugin]]),executePlugin:async(_name,args)=>{calls.push(JSON.parse(args));return {result:{ok:true,sourceId:'synthetic-source',plan:{id:'synthetic-plan',conversationId:'internal'}}};}}};}
const frame=(more={})=>({type:'native_conversation_request',requestId:randomUUID(),sessionId:randomUUID(),toolName:'Example',authorization:'Bearer '+'x'.repeat(40),body:{action:'prepare',payload:{conversationId:'chat'}},...more});
test('only special frames dispatch; source and plan are connection bound',async()=>{const {ws,calls,manager}=fixture();assert.equal(await handle(ws,{type:'execute_tool'},manager),false);await handle(ws,frame({body:{action:'execute',payload:{sourceId:'forged',conversationId:'chat'}}}),manager);assert.equal(calls.length,0);const f=frame();ws.emit('close');const next=fixture();await handle(next.ws,f,next.manager);assert.notEqual(next.calls[0].payload.conversationId,'chat');assert.equal(next.ws.messages[0].result.plan.conversationId,'chat');await handle(next.ws,{...f,requestId:randomUUID(),body:{action:'execute',payload:{sourceId:'synthetic-source',conversationId:'chat'}}},next.manager);assert.equal(next.calls.length,2);next.ws.emit('close');});
test('missing owner credential cannot dispatch, changed session and foreign node refused',async()=>{const {ws,calls,manager}=fixture(),f=frame({authorization:''});await handle(ws,f,manager);assert.equal(calls.length,0);assert.equal(ws.messages[0].result.code,'APPLICATION_SESSION_REQUIRED');await handle(ws,frame(),manager);assert.equal(ws.messages[1].result.code,'NATIVE_SESSION_CHANGED');ws.emit('close');const other=fixture();other.ws.clientType='VCPLog';await handle(other.ws,frame(),other.manager);assert.equal(other.calls.length,0);});
test('two sockets cannot share active client namespace; reconnect cannot execute old source',async()=>{const a=fixture(),b=fixture(),f=frame();await handle(a.ws,f,a.manager);await handle(b.ws,f,b.manager);assert.equal(b.calls.length,0);assert.equal(b.ws.messages[0].result.code,'NATIVE_SESSION_IN_USE');a.ws.emit('close');await handle(b.ws,{...f,requestId:randomUUID(),body:{action:'execute',payload:{sourceId:'synthetic-source',conversationId:'chat'}}},b.manager);assert.equal(b.calls.length,0);assert.equal(b.ws.messages[1].result.code,'NATIVE_CONNECTION_CHANGED');b.ws.emit('close');});
test('invalid bodies cannot turn a special message into arbitrary RPC',async()=>{const f=frame(),a=fixture();for(const action of ['execute_tool','reschedule','eval'])await handle(a.ws,{...f,requestId:randomUUID(),body:{action,payload:{}}},a.manager);assert.equal(a.calls.length,0);a.ws.emit('close');});
test('capacity stops new sources but leaves receipt recovery available',async()=>{const a=fixture(),f=frame();let n=0;a.manager.executePlugin=async()=>({result:{ok:true,sourceId:'source-'+(++n)}});for(let i=0;i<4096;i++)await handle(a.ws,{...f,requestId:randomUUID()},a.manager);await handle(a.ws,{...f,requestId:randomUUID()},a.manager);assert.equal(a.ws.messages.at(-1).result.code,'NATIVE_REQUEST_BUSY');await handle(a.ws,{...f,requestId:randomUUID(),body:{action:'recover',payload:{}}},a.manager);assert.equal(a.ws.messages.at(-1).result.ok,true);a.ws.emit('close');});

// Explicit Promise gates exercise disconnect ordering without timers or a backend.
function disconnect(ws){ws.readyState=3;ws.emit('close');}
function controlledPlugin(t,a){
 const gates=[],pending=[];
 a.manager.executePlugin=(_name,args)=>{
  a.calls.push(JSON.parse(args));
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  gates.push({resolve,reject});
  return promise;
 };
 t.after(async()=>{
  for(const gate of gates)gate.resolve({result:{ok:true}});
  await Promise.all(pending);
  disconnect(a.ws);
 });
 return {gates,start(message){const work=handle(a.ws,message,a.manager);pending.push(work);return work;}};
}
function reconnectFixture(t){const a=fixture();t.after(()=>disconnect(a.ws));return a;}
const request=(f,action,payload={})=>({...f,requestId:randomUUID(),body:{action,payload}});

test('lifecycle: disconnected execute reserves session until success, then recover dispatches once',async t=>{
 const a=fixture(),b=reconnectFixture(t),f=frame();
 await handle(a.ws,f,a.manager);
 const control=controlledPlugin(t,a);
 const execution=control.start(request(f,'execute',{sourceId:'synthetic-source',conversationId:'chat'}));
 assert.equal(control.gates.length,1);
 assert.equal(a.calls.at(-1).nativeAction,'execute');
 disconnect(a.ws);
 await handle(b.ws,request(f,'recover'),b.manager);
 t.diagnostic(JSON.stringify({phase:'execute-pending-after-close',reconnectResult:b.ws.messages.at(-1).result,pluginDispatches:b.calls.length}));
 assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_SESSION_IN_USE');
 assert.equal(b.calls.length,0,'blocked reconnect must not dispatch to plugin');
 control.gates[0].resolve({result:{ok:true,receipt:{id:'synthetic-receipt'}}});
 await execution;
 assert.equal(a.ws.messages.length,1,'closed socket must not receive execution result');
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.ok,true);
 assert.deepEqual(b.calls.map(call=>call.nativeAction),['recover']);
 assert.equal(a.calls.filter(call=>call.nativeAction==='execute').length,1);
});

for(const outcome of ['reject','unknown-result'])test(`lifecycle: ${outcome} settles a disconnected request and releases its session`,async t=>{
 const a=fixture(),b=reconnectFixture(t),f=frame(),control=controlledPlugin(t,a);
 const work=control.start(f);
 disconnect(a.ws);
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_SESSION_IN_USE');
 assert.equal(b.calls.length,0);
 if(outcome==='reject')control.gates[0].reject(new Error('synthetic plugin failure'));
 else control.gates[0].resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}});
 await work;
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.ok,true);
 assert.deepEqual(b.calls.map(call=>call.nativeAction),['recover']);
 assert.equal(a.calls.length,1,'settling an unknown result must not retry the command');
});

test('lifecycle: every in-flight request must settle before a closed session is released',async t=>{
 const a=fixture(),b=reconnectFixture(t),f=frame(),control=controlledPlugin(t,a);
 const first=control.start(f),second=control.start(request(f,'recover'));
 assert.equal(control.gates.length,2);
 disconnect(a.ws);
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_SESSION_IN_USE');
 control.gates[0].resolve({result:{ok:true}});
 await first;
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_SESSION_IN_USE');
 assert.equal(b.calls.length,0);
 control.gates[1].resolve({result:{ok:true}});
 await second;
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.deepEqual(b.calls.map(call=>call.nativeAction),['recover']);
});

test('lifecycle: idle close permits reconnect with fresh source and plan eligibility',async t=>{
 const a=reconnectFixture(t),b=reconnectFixture(t),f=frame();
 await handle(a.ws,f,a.manager);
 disconnect(a.ws);
 // Recovery itself must not provide new execution/presentation eligibility.
 b.manager.executePlugin=async(_name,args)=>{b.calls.push(JSON.parse(args));return {result:{ok:true}};};
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.ws.messages.at(-1).result.ok,true);
 for(const [action,payload] of [['execute',{sourceId:'synthetic-source'}],['presented',{planId:'synthetic-plan'}]]){
  await handle(b.ws,request(f,action,payload),b.manager);
  assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_CONNECTION_CHANGED');
 }
 assert.deepEqual(b.calls.map(call=>call.nativeAction),['recover']);
});

test('lifecycle: late old close cleanup cannot delete a new connection reservation',async t=>{
 const a=fixture(),b=reconnectFixture(t),c=reconnectFixture(t),f=frame(),control=controlledPlugin(t,a);
 const work=control.start(f),oldClose=a.ws.listeners('close')[0];
 disconnect(a.ws);
 control.gates[0].resolve({result:{ok:true,sourceId:'old-source',plan:{id:'old-plan'}}});
 await work;
 await handle(b.ws,request(f,'recover'),b.manager);
 for(const [action,payload] of [['execute',{sourceId:'old-source'}],['presented',{planId:'old-plan'}]]){
  await handle(b.ws,request(f,action,payload),b.manager);
  assert.equal(b.ws.messages.at(-1).result.code,'NATIVE_CONNECTION_CHANGED');
 }
 oldClose(); // Deliberately replay a retained old callback after the new registration.
 await handle(c.ws,request(f,'recover'),c.manager);
 assert.equal(c.ws.messages.at(-1).result.code,'NATIVE_SESSION_IN_USE');
 assert.equal(c.calls.length,0);
 disconnect(b.ws);
 await handle(c.ws,request(f,'recover'),c.manager);
 assert.equal(c.ws.messages.at(-1).result.ok,true);
});

function captureWarnings(t){
 const logs=[],warn=console.warn;
 console.warn=(...args)=>logs.push(args);
 t.after(()=>{console.warn=warn;});
 return logs;
}
test('WS diagnostics: transport preflight exception logs only a fixed code',async t=>{
 const a=reconnectFixture(t),b=reconnectFixture(t),f=frame(),logs=captureWarnings(t);
 const sensitive='SYNTHETIC_WS_PRIVATE_CREDENTIAL_PAYLOAD_ERROR';
 f.authorization='Bearer '+sensitive;f.body.payload.private=sensitive;
 a.manager.plugins.get=()=>{throw new Error(sensitive);}; // Outside the transport's inner catch.
 await handle(a.ws,f,a.manager);
 assert.equal(a.calls.length,0);
 assert.deepEqual(a.ws.messages.at(-1).result,{ok:false,code:'NATIVE_RESULT_UNKNOWN'});
 disconnect(a.ws);
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.calls.length,1,'exception must not leave an in-flight reservation');
 assert.doesNotMatch(JSON.stringify({logs,messages:a.ws.messages}),new RegExp(sensitive));
 assert.deepEqual(logs,[['[NativeConversation]',{code:'NATIVE_WEBSOCKET_FAILED'}]]);
});

for(const closed of [false,true])test(`WS diagnostics: sensitive result getter exception (closed=${closed})`,async t=>{
 const a=fixture(),b=reconnectFixture(t),f=frame(),logs=captureWarnings(t),control=controlledPlugin(t,a);
 const sensitive='SYNTHETIC_WS_PRIVATE_BUSINESS_RESULT_ERROR';
 const result={private:sensitive};
 Object.defineProperty(result,'sourceId',{get(){throw new Error(sensitive);}});
 const work=control.start(f);
 if(closed)disconnect(a.ws);
 control.gates[0].resolve({result});
 await work;
 if(closed)assert.deepEqual(a.ws.messages,[]);
 else assert.deepEqual(a.ws.messages.at(-1).result,{ok:false,code:'NATIVE_RESULT_UNKNOWN'});
 disconnect(a.ws);
 await handle(b.ws,request(f,'recover'),b.manager);
 assert.equal(b.calls.length,1,'result-processing exception must still clean up the session');
 assert.doesNotMatch(JSON.stringify({logs,messages:a.ws.messages}),new RegExp(sensitive));
 assert.deepEqual(logs,[['[NativeConversation]',{code:'NATIVE_WEBSOCKET_FAILED'}]]);
});

test('WS diagnostics: ordinary plugin rejection has one transport warning and no duplicate',async t=>{
 const a=reconnectFixture(t),f=frame(),logs=captureWarnings(t);
 const sensitive='SYNTHETIC_WS_PRIVATE_PLUGIN_ERROR';
 a.manager.executePlugin=async()=>{throw new Error(sensitive);};
 await handle(a.ws,f,a.manager);
 assert.deepEqual(a.ws.messages.at(-1).result,{ok:false,code:'NATIVE_RESULT_UNKNOWN'});
 assert.doesNotMatch(JSON.stringify({logs,messages:a.ws.messages}),new RegExp(sensitive));
 assert.deepEqual(logs,[['[NativeConversation]',{code:'NATIVE_EXECUTION_FAILED',action:'prepare'}]]);
});
