'use strict';
// Synthetic plugin results; real ws/HTTP sockets and actual server callbacks.
// Only the existing host interval clock is controlled, never plugin completion.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),{createServer}=require('node:http'),{once}=require('node:events'),{randomUUID}=require('node:crypto'),WebSocket=require('ws');
const sourcePath=path.join(__dirname,'../WebSocketServer.js'),realRequire=createRequire(sourcePath);
const frame=(sessionId=randomUUID(),action='prepare',payload={conversationId:'chat'})=>({type:'native_conversation_request',requestId:randomUUID(),sessionId,toolName:'Example',authorization:'Bearer '+'synthetic-owner'.padEnd(40,'x'),body:{action,payload}});
function gate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function fixture(t,{heartbeatEnabled=false,debugMode=false,callbackIO=false,musicEnabled=false}={}){
 const intervals=new Map(),callbacks=[],calls=[],sockets=[],logs=[],requests=new Map();let approvals=0;const registrations=[];let distributedCalls=0;const callbackWrites=[];
 const manager={plugins:new Map([['Example',{name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'},communication:{protocol:'stdio'}}]]),unregisterAllDistributedTools(){},registerDistributedTools(...args){registrations.push(args);},async handleApprovalResponse(){approvals++;},async executePlugin(_name,args){calls.push(JSON.parse(args));return {result:JSON.parse(args).nativeAction==='prepare'?{ok:true,sourceId:'source',plan:{id:'plan'}}:{ok:true}};}};
 const module={exports:{}};
 const context={module,exports:module.exports,__dirname:path.dirname(sourcePath),Buffer,URL,console:{log:(...a)=>logs.push(a),warn:(...a)=>logs.push(a),error:(...a)=>logs.push(a)},process:{env:{}},setTimeout,clearTimeout,
  setInterval(fn,ms){const timer={unref(){}};intervals.set(timer,{fn,ms});callbacks.push(fn);return timer;},clearInterval(timer){intervals.delete(timer);},
  require(name){if(name==='fs'&&callbackIO)return {promises:{mkdir:async()=>{},writeFile:async(...args)=>callbackWrites.push(args)}};if(name==='./modules/distributedMusicDiarySync')return musicEnabled?realRequire(name):{};if(name==='./modules/vcpLogReplayManager')return {};if(name==='./modules/nativeConversationWebSocket'){const native=realRequire(name);return {...native,handleNativeConversationMessage(...args){const work=native.handleNativeConversationMessage(...args);requests.set(args[1]?.requestId,work);return work;}};}return realRequire(name);}};
 vm.runInNewContext(fs.readFileSync(sourcePath,'utf8')+'\nmodule.exports.fixtureServer=()=>wssInstance;',context,{filename:sourcePath});
 const host=module.exports,http=createServer();host.setPluginManager(manager);host.initialize(http,{vcpKey:'synthetic-test-key',debugMode,heartbeatEnabled,distributedMusicPlaylistSyncEnabled:musicEnabled});
 const distributed=host.handleDistributedServerMessage;host.handleDistributedServerMessage=(...args)=>{distributedCalls++;return distributed(...args);};
 if(debugMode){const originals={};for(const level of ['log','warn','error','info','debug']){originals[level]=console[level];console[level]=(...args)=>logs.push(args);}t.after(()=>{Object.assign(console,originals);});}
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const {client} of sockets)client.terminate();await host.shutdown();await new Promise(resolve=>http.close(resolve));assert.equal(intervals.size,0,'shutdown clears the shared interval');});
 async function connect({autoPong=true,ordinary=false}={}){
  const client=new WebSocket(`ws://127.0.0.1:${http.address().port}/${ordinary?'vcp-admin-panel':'vcp-distributed-server'}/VCP_Key=synthetic-test-key`,{autoPong});client.on('error',()=>{});
  const connected=once(host.fixtureServer(),'connection');await once(client,'open');const [ws]=await connected;
  const entry={client,ws};sockets.push(entry);return entry;
 }
 async function send(entry,message){const response=once(entry.client,'message');entry.client.send(typeof message==='string'||Buffer.isBuffer(message)?message:JSON.stringify(message));return JSON.parse((await response)[0].toString()).result;}
 function tick(){assert.equal(intervals.size,1,'one existing host timer must also serve native-only heartbeat');const [{fn,ms}]=intervals.values();assert.equal(ms,60000);fn();}
 return {host,http,manager,callbackWrites,calls,sockets,logs,connect,send,tick,intervals,callbacks,requests,registrations,distributedCalls:()=>distributedCalls,approvals:()=>approvals};
}
async function pingCycle(f,entry){const pong=once(entry.ws,'pong');f.tick();await pong;}
async function staleClose(f,entry){const ping=once(entry.client,'ping');f.tick();await ping;const closed=once(entry.ws,'close');f.tick();await closed;}

test('connection liveness: silent idle native socket terminates through close and permits fresh recovery',async t=>{
 const f=await fixture(t),a=await f.connect({autoPong:false}),m=frame();await f.send(a,m);
 let terminates=0;const terminate=a.ws.terminate.bind(a.ws);a.ws.terminate=()=>{terminates++;terminate();};
 const oldPong=a.ws.listeners('pong').at(-1),oldClose=a.ws.listeners('close').at(-1);
 await staleClose(f,a);assert.equal(terminates,1);assert.equal(a.ws.listenerCount('pong'),0);
 const b=await f.connect(),c=await f.connect();assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).ok,true);
 for(const [action,payload] of [['execute',{sourceId:'source'}],['presented',{planId:'plan'}]])assert.equal((await f.send(b,frame(m.sessionId,action,payload))).code,'NATIVE_CONNECTION_CHANGED');
 assert.equal(typeof oldPong,'function');oldPong();oldClose();
 await realRequire('./modules/nativeConversationWebSocket').handleNativeConversationMessage(a.ws,frame(m.sessionId,'recover',{}),f.manager,300);
 f.callbacks[0]();
 assert.equal((await f.send(c,frame(m.sessionId,'recover',{}))).code,'NATIVE_SESSION_IN_USE');
 assert.deepEqual(f.calls.map(c=>c.nativeAction),['prepare','recover']);
});

test('connection liveness: real pong keeps idle and slow-plugin sockets alive over multiple ticks',async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame();await f.send(a,m);
 for(let i=0;i<3;i++)await pingCycle(f,a);
 const entered=gate(),result=gate();t.after(()=>result.resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}}));
 f.manager.executePlugin=(_n,args)=>{f.calls.push(JSON.parse(args));entered.resolve();return result.promise;};
 const work=f.send(a,frame(m.sessionId,'execute',{sourceId:'source'}));await entered.promise;
 for(let i=0;i<4;i++){await pingCycle(f,a);assert.equal(a.ws.readyState,WebSocket.OPEN);}
 const b=await f.connect();assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).code,'NATIVE_SESSION_IN_USE');
 result.resolve({result:{ok:true}});assert.equal((await work).ok,true);
 assert.equal(f.calls.filter(c=>c.nativeAction==='execute').length,1);
});

for(const outcome of ['success','reject','unknown'])test(`connection liveness: terminated in-flight ${outcome} retains reservation until actual settlement`,async t=>{
 const f=await fixture(t),a=await f.connect({autoPong:false}),m=frame();await f.send(a,m);
 const entered=gate(),result=gate();t.after(()=>result.resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}}));
 f.manager.executePlugin=(_n,args)=>{f.calls.push(JSON.parse(args));entered.resolve();return result.promise;};
 const execution=frame(m.sessionId,'execute',{sourceId:'source'});a.client.send(JSON.stringify(execution));await entered.promise;
 await staleClose(f,a);assert.equal(a.ws.readyState,WebSocket.CLOSED);
 const b=await f.connect();assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).code,'NATIVE_SESSION_IN_USE');
 assert.equal(f.calls.filter(c=>c.nativeAction==='recover').length,0);
 if(outcome==='reject')result.reject(Error('synthetic plugin rejection'));
 else result.resolve({result:{ok:outcome==='success',...(outcome==='unknown'?{code:'NATIVE_RESULT_UNKNOWN'}:{})}});
 await f.requests.get(execution.requestId);
 f.manager.executePlugin=async(_n,args)=>{f.calls.push(JSON.parse(args));return {result:{ok:true}};};
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).ok,true);
 assert.deepEqual(f.calls.map(c=>c.nativeAction),['prepare','execute','recover']);
});

test('connection liveness: ordinary default behavior and drain/late timer cleanup are unchanged',async t=>{
 const f=await fixture(t),ordinary=await f.connect({ordinary:true}),a=await f.connect({autoPong:false});
 let ordinaryPings=0;ordinary.ws.ping=()=>ordinaryPings++;
 await f.send(a,frame());f.tick();assert.equal(ordinaryPings,0);
 const late=f.callbacks[0];await f.host.shutdown();assert.equal(f.intervals.size,0);late();assert.equal(ordinaryPings,0);
 for(const {ws} of f.sockets)assert.equal(ws.listenerCount('pong'),0);
});

for(const format of ['whitespace','escape'])test(`wire limit: raw ${format} bytes reject before reservation, not reserialized size`,async t=>{
 const f=await fixture(t),a=await f.connect(),b=await f.connect(),m=frame();
 let raw;
 if(format==='whitespace')raw=' '.repeat(40001-Buffer.byteLength(JSON.stringify(m)))+JSON.stringify(m);
 else{m.body.payload.text='a'.repeat(7000);raw=JSON.stringify(m).replace('a'.repeat(7000),'\\u0061'.repeat(7000));}
 assert.ok(Buffer.byteLength(raw)>40000);assert.ok(Buffer.byteLength(JSON.stringify(JSON.parse(raw)))<40000);
 t.diagnostic(JSON.stringify({format,rawBytes:Buffer.byteLength(raw),reserializedBytes:Buffer.byteLength(JSON.stringify(JSON.parse(raw)))}));
 assert.equal((await f.send(a,Buffer.from(raw))).code,'INVALID_NATIVE_REQUEST');assert.equal(f.calls.length,0);
 assert.equal((await f.send(b,m)).ok,true,'oversize must not reserve the session');assert.equal(f.calls.length,1);
});

test('wire limit: actual raw Buffer 40000 accepted, 40001 rejected; normal route stays larger',async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame(),serialized=JSON.stringify(m);
 assert.equal((await f.send(a,Buffer.from(' '.repeat(40001-Buffer.byteLength(serialized))+serialized))).code,'INVALID_NATIVE_REQUEST');assert.equal(f.calls.length,0);
 assert.equal((await f.send(a,Buffer.from(' '.repeat(40000-Buffer.byteLength(serialized))+serialized))).ok,true);assert.equal(f.calls.length,1);
 const ordinary=await f.connect({ordinary:true}),raw=Buffer.from(JSON.stringify({type:'tool_approval_response',data:{requestId:'synthetic',approved:false,reason:'x'.repeat(45000)}}));
 await ordinary.ws.listeners('message')[0](raw);assert.equal(f.approvals(),1);
});

for(const action of ['execute','presented'])test(`wire limit: oversize raw ${action} preserves one-shot capability`,async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame();await f.send(a,m);
 const message=frame(m.sessionId,action,action==='execute'?{sourceId:'source'}:{planId:'plan'}),serialized=JSON.stringify(message);
 assert.equal((await f.send(a,Buffer.from(' '.repeat(40001-Buffer.byteLength(serialized))+serialized))).code,'INVALID_NATIVE_REQUEST');assert.equal(f.calls.length,1);
 assert.equal((await f.send(a,message)).ok,true);assert.equal(f.calls.length,2);
 assert.equal((await f.send(a,message)).code,'NATIVE_CONNECTION_CHANGED');assert.equal(f.calls.length,2);
});

test('connection liveness: terminated transport retains all inflight work until the last result',async t=>{
 const f=await fixture(t),a=await f.connect({autoPong:false}),m=frame();await f.send(a,m);
 const entered=gate(),results=[gate(),gate()];t.after(()=>results.forEach(g=>g.resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}})));
 let n=0;f.manager.executePlugin=(_name,args)=>{f.calls.push(JSON.parse(args));const result=results[n++];if(n===2)entered.resolve();return result.promise;};
 const first=frame(m.sessionId,'execute',{sourceId:'source'}),second=frame(m.sessionId,'recover',{});
 a.client.send(JSON.stringify(first));a.client.send(JSON.stringify(second));await entered.promise;await staleClose(f,a);
 const b=await f.connect();results[0].resolve({result:{ok:true}});await f.requests.get(first.requestId);
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).code,'NATIVE_SESSION_IN_USE');assert.equal(f.calls.length,3);
 results[1].resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}});await f.requests.get(second.requestId);
 f.manager.executePlugin=async(_name,args)=>{f.calls.push(JSON.parse(args));return {result:{ok:true}};};
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).ok,true);assert.equal(f.calls.length,4);
});

test('connection liveness: opt-in ordinary heartbeat keeps its old ping-only behavior',async t=>{
 const f=await fixture(t,{heartbeatEnabled:true}),ordinary=await f.connect({ordinary:true,autoPong:false}),unclaimed=await f.connect({autoPong:false});
 let pings=0;ordinary.ws.ping=()=>pings++;unclaimed.ws.ping=()=>pings++;
 for(let i=0;i<4;i++)f.tick();assert.equal(pings,8);assert.equal(ordinary.ws.readyState,WebSocket.OPEN);assert.equal(unclaimed.ws.readyState,WebSocket.OPEN);
});

test('connection liveness: draining cancels timer and late queued tick cannot terminate a live socket',async t=>{
 const f=await fixture(t),a=await f.connect({autoPong:false});await f.send(a,frame());f.tick();
 const late=f.callbacks[0];await f.host.beginDrain();assert.equal(f.intervals.size,0);late();assert.equal(a.ws.readyState,WebSocket.OPEN);
});

test('connection liveness: native detection also applies with legacy heartbeat enabled, without duplicate pings',async t=>{
 const f=await fixture(t,{heartbeatEnabled:true}),a=await f.connect({autoPong:false});await f.send(a,frame());
 let pings=0;const ping=a.ws.ping.bind(a.ws);a.ws.ping=()=>{pings++;ping();};
 const received=once(a.client,'ping');f.tick();await received;assert.equal(pings,1);
 const closed=once(a.ws,'close');f.tick();assert.notEqual(a.ws.readyState,WebSocket.OPEN,'missing pong must terminate, not merely ping again');await closed;
 assert.equal(pings,1,'native connections must not also receive the optional generic ping');
});


const privateToken='SYNTHETIC_UNKNOWN_NATIVE_CREDENTIAL',privatePayload='SYNTHETIC_UNKNOWN_NATIVE_PAYLOAD',privateType='SYNTHETIC_UNKNOWN_NATIVE_TYPE';
function assertPrivateLogs(f){
 const output=JSON.stringify(f.logs);
 for(const value of [privateToken,privatePayload,privateType])assert.ok(!output.includes(value),'complete log output must omit '+value);
 assert.ok(output.includes('WS_SENSITIVE_MESSAGE'),'fixed sensitivity diagnostic must be present');
 for(const args of f.logs){
  if(args.length===2){assert.equal(args[0],'[WebSocketServer]');assert.deepEqual(Object.keys(args[1]),['code']);assert.ok(['WS_SENSITIVE_MESSAGE','WS_MESSAGE_HANDLER_FAILED','WS_BROADCAST_FAILED'].includes(args[1].code));}
  else{assert.equal(args.length,1);assert.match(args[0],/^\[WebSocketServer\] [0-9T:.Z-]+ - WS_(?:SENSITIVE_MESSAGE|UNKNOWN_MESSAGE_TYPE)$/);}
 }
}
const sensitiveCases=[
 ['mistyped native',{type:'native_conversation_requset',authorization:'Bearer '+privateToken}],
 ['future native',{type:'native_conversation_request_v2',authorization:'Bearer '+privateToken}],
 ['unknown authorization',{type:privateType,authorization:'Bearer '+privateToken}],
 ['missing type',{authorization:'Bearer '+privateToken}],
 ['null type',{type:null,authorization:'Bearer '+privateToken}],
 ['numeric type',{type:17,authorization:'Bearer '+privateToken}],
 ['object type',{type:{private:privateType},authorization:'Bearer '+privateToken}],
 ['array type',{type:[privateType],authorization:'Bearer '+privateToken}],
 ['null authorization',{type:privateType,authorization:null}],
 ['native-like without authorization',{type:'native_conversaton_request'}],
 ['upper-case native without authorization',{type:'NATIVE_CONVERSATION_REQUEST'}]
];
for(const [label,partial] of sensitiveCases)test('sensitive envelope: '+label+' reaches real distributed handler without raw logging or dispatch',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();f.logs.length=0;
 const message={...partial,payload:{private:privatePayload},body:{action:'prepare',payload:{text:privatePayload}}};
 await a.ws.listeners('message')[0](Buffer.from(JSON.stringify(message)));
 t.diagnostic(JSON.stringify({case:label,downstreamCalls:f.distributedCalls(),pluginDispatches:f.calls.length,logEvents:f.logs.length,sensitiveMarkerPresent:[privateToken,privatePayload,privateType].some(value=>JSON.stringify(f.logs).includes(value))}));
 assert.equal(f.distributedCalls(),1,'actual downstream handler must run');assert.equal(f.calls.length,0);assertPrivateLogs(f);
 assert.ok(JSON.stringify(f.logs).includes('WS_UNKNOWN_MESSAGE_TYPE'));
});

test('sensitive envelope: direct distributed entry independently suppresses preview and dynamic type',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();f.logs.length=0;
 await f.host.handleDistributedServerMessage(a.ws.serverId,{type:privateType,authorization:'Bearer '+privateToken,payload:privatePayload});
 assert.equal(f.distributedCalls(),1);assert.equal(f.calls.length,0);assertPrivateLogs(f);
});

for(const authorization of [false,true])test(`sensitive envelope: ordinary approval and register routing unchanged (authorization=${authorization})`,async t=>{
 const f=await fixture(t,{debugMode:true}),distributed=await f.connect(),admin=await f.connect({ordinary:true});f.logs.length=0;
 const auth=authorization?{authorization:'Bearer '+privateToken}:{};
 await distributed.ws.listeners('message')[0](Buffer.from(JSON.stringify({type:'register_tools',...auth,data:{serverName:privatePayload,tools:[{name:'synthetic-tool'}]}})));
 await admin.ws.listeners('message')[0](Buffer.from(JSON.stringify({type:'tool_approval_response',...auth,data:{requestId:'synthetic',approved:false,reason:privatePayload}})));
 assert.equal(f.distributedCalls(),1);assert.equal(f.registrations.length,1);assert.equal(f.registrations[0][0],distributed.ws.serverId);
 assert.equal(f.registrations[0][1][0].name,'synthetic-tool');assert.equal(f.approvals(),1);assert.equal(f.calls.length,0);
 if(authorization)assertPrivateLogs(f);else assert.ok(JSON.stringify(f.logs).includes('Received message from'));
});

test('sensitive envelope: exact native type still uses only native dispatch over real WS',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();f.logs.length=0;
 const message=frame();message.authorization='Bearer '+privateToken;message.body.payload.text=privatePayload;
 assert.equal((await f.send(a,message)).ok,true);assert.equal(f.calls.length,1);assert.equal(f.distributedCalls(),0);
 for(const value of [privateToken,privatePayload])assert.ok(!require('node:util').inspect(f.logs,{depth:null,customInspect:false}).includes(value));
});

for(const mode of ['parse','native','ordinary'])test('sensitive envelope: '+mode+' exception keeps fixed diagnostics under debugMode',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect({ordinary:mode==='ordinary'});f.logs.length=0;
 let raw;
 if(mode==='parse')raw=Buffer.from('{'+privateToken+privatePayload);
 else if(mode==='native'){f.manager.plugins.get=()=>{throw Error(privateToken+privatePayload);};const m=frame();m.authorization='Bearer '+privateToken;raw=Buffer.from(JSON.stringify(m));}
 else{f.manager.handleApprovalResponse=async()=>{throw Error(privateToken+privatePayload);};raw=Buffer.from(JSON.stringify({type:'tool_approval_response',authorization:'Bearer '+privateToken,data:{reason:privatePayload}}));}
 await a.ws.listeners('message')[0](raw);
 for(const value of [privateToken,privatePayload])assert.ok(!JSON.stringify(f.logs).includes(value));
 const code={parse:'WS_JSON_PARSE_FAILED',native:'NATIVE_WEBSOCKET_FAILED',ordinary:'WS_MESSAGE_HANDLER_FAILED'}[mode];assert.ok(JSON.stringify(f.logs).includes(code));
 assert.equal(f.calls.length,0);
});

const initialRejects=[
 ['missing credential',m=>{delete m.authorization;},'APPLICATION_SESSION_REQUIRED'],
 ['short credential',m=>{m.authorization='Bearer short';},'APPLICATION_SESSION_REQUIRED'],
 ['non-string credential',m=>{m.authorization={private:privateToken};},'APPLICATION_SESSION_REQUIRED'],
 ['unknown tool',m=>{m.toolName='MistypedTool';},'NATIVE_TOOL_UNAVAILABLE'],
 ['extra body key',m=>{m.body.extra=true;},'INVALID_NATIVE_REQUEST'],
 ['unsupported action',m=>{m.body.action='reschedule';},'INVALID_NATIVE_REQUEST'],
 ['missing body',m=>{delete m.body;},'INVALID_NATIVE_REQUEST'],
 ['array payload',m=>{m.body.payload=[];},'INVALID_NATIVE_REQUEST'],
 ['empty conversation',m=>{m.body.payload.conversationId='';},'CONVERSATION_REQUIRED'],
 ['final body bytes',m=>{m.body.payload.text='中'.repeat(11000);},'INVALID_NATIVE_REQUEST'],
 ['unknown source',m=>{m.body={action:'execute',payload:{sourceId:'forged'}};},'NATIVE_CONNECTION_CHANGED'],
 ['unknown plan',m=>{m.body={action:'presented',payload:{planId:'forged'}};},'NATIVE_CONNECTION_CHANGED']
];
for(const [label,mutate,code] of initialRejects)test('consolidation: initial '+label+' rejects without binding or listeners and allows correction',async t=>{
 const f=await fixture(t),a=await f.connect(),b=await f.connect(),m=frame(),closeCount=a.ws.listenerCount('close');mutate(m);
 const rejected=await f.send(a,m);assert.equal(rejected.code,code);assert.equal(f.calls.length,0);
 t.diagnostic(JSON.stringify({case:label,pluginDispatches:f.calls.length,pongListeners:a.ws.listenerCount('pong'),extraCloseListeners:a.ws.listenerCount('close')-closeCount}));
 assert.equal(a.ws.listenerCount('pong'),0);assert.equal(a.ws.listenerCount('close'),closeCount);
 // A valid request using this correlation ID must not be occupied by the rejected one.
 const other=frame(m.sessionId,'recover',{});assert.equal((await f.send(b,other)).ok,true);
 // Correcting even identity/tool/session is possible before any valid binding.
 assert.equal((await f.send(a,frame())).ok,true);
 // Once validly bound, a different valid credential or eligible tool is refused.
 const valid=frame();await a.ws.listeners('message')[0](Buffer.from(JSON.stringify(valid)));
 assert.equal(f.calls.length,2);
});
for(const field of ['requestId','sessionId','toolName'])test('consolidation: array '+field+' is rejected before native dispatch',async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame();m[field]=[m[field]];
 assert.equal((await f.send(a,m)).code,'INVALID_NATIVE_REQUEST');assert.equal(f.calls.length,0);assert.equal(a.ws.listenerCount('pong'),0);
 assert.equal((await f.send(a,frame())).ok,true);
});

test('consolidation: a duplicate in-flight request cannot clean up the original reservation',async t=>{
 const f=await fixture(t),a=await f.connect(),b=await f.connect(),m=frame();await f.send(a,m);
 const entered=gate(),result=gate();t.after(()=>result.resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}}));
 f.manager.executePlugin=(_n,args)=>{f.calls.push(JSON.parse(args));entered.resolve();return result.promise;};
 const execution=frame(m.sessionId,'execute',{sourceId:'source'});a.client.send(JSON.stringify(execution));await entered.promise;const originalWork=f.requests.get(execution.requestId);
 assert.equal((await f.send(a,execution)).code,'NATIVE_REQUEST_BUSY');assert.equal(f.calls.length,2);
 const closed=once(a.ws,'close');a.client.terminate();await closed;
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).code,'NATIVE_SESSION_IN_USE');
 result.resolve({result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}});await originalWork;
 f.manager.executePlugin=async(_n,args)=>{f.calls.push(JSON.parse(args));return {result:{ok:true}};};
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).ok,true);assert.equal(f.calls.length,3);
});

test('consolidation: bound session rejects changed valid credentials and eligible tools',async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame();await f.send(a,m);
 const p=f.manager.plugins.get('Example');f.manager.plugins.set('Other',{...p,name:'Other'});
 for(const more of [{authorization:'Bearer '+'y'.repeat(40)},{toolName:'Other'},{sessionId:randomUUID()}]){
  assert.equal((await f.send(a,{...m,requestId:randomUUID(),...more})).code,'NATIVE_SESSION_CHANGED');assert.equal(f.calls.length,1);
 }
 assert.equal((await f.send(a,frame(m.sessionId,'recover',{}))).ok,true);assert.equal(f.calls.length,2);
});

test('consolidation: host socket error and draining upgrade logs are scrubbed',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();await f.send(a,frame());f.logs.length=0;
 const upgrade=f.http.listeners('upgrade')[0];
 a.ws.emit('error',Error(privateToken+privatePayload));
 await f.host.beginDrain();let destroyed=false;upgrade({url:'/vcp-distributed-server/VCP_Key='+privateToken},{destroy(){destroyed=true;}},Buffer.alloc(0));
 assert.equal(destroyed,true);
 for(const value of [privateToken,privatePayload])assert.ok(!require('node:util').inspect(f.logs,{depth:null,customInspect:false}).includes(value));
});


for(const type of ['report_ip','update_static_placeholders','music_playlist_update'])test('consolidation: sensitive '+type+' keeps downstream routing without metadata leaks',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();f.logs.length=0;let updates=0;
 f.manager.updateDistributedStaticPlaceholders=()=>updates++;
 const message={type,authorization:'Bearer '+privateToken,data:{serverName:privatePayload,localIPs:[privateToken],publicIP:privatePayload,placeholders:{synthetic:'value'},tracks:[]}};
 await f.host.handleDistributedServerMessage(a.ws.serverId,message);
 assertPrivateLogs(f);assert.equal(f.calls.length,0);
 if(type==='report_ip')assert.equal(f.host.__testing.distributedServers.get(a.ws.serverId).ips.publicIP,privatePayload);
 if(type==='update_static_placeholders')assert.equal(updates,1);
 if(type==='music_playlist_update')assert.equal(f.host.__testing.distributedServers.get(a.ws.serverId).musicPlaylist.syncResult.reason,'disabled_by_config');
});


test('consolidation: actual distributed async rejection reaches outer fixed catch',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect();f.logs.length=0;
 // Observe without replacing the actual rejection or allowing an unhandled rejection to kill the test process.
 const actual=f.host.handleDistributedServerMessage;f.host.handleDistributedServerMessage=(...args)=>{const work=actual(...args);work.catch(()=>{});return work;};
 await a.ws.listeners('message')[0](Buffer.from(JSON.stringify({type:'tool_result',authorization:'Bearer '+privateToken})));
 assert.equal(f.distributedCalls(),1);assert.equal(f.calls.length,0);assert.ok(JSON.stringify(f.logs).includes('WS_MESSAGE_HANDLER_FAILED'));
 assertPrivateLogs(f);
});
for(const mode of ['missing-plugin','push','send-error'])test('consolidation: sensitive callback '+mode+' keeps actual helper and wire behavior without logs',async t=>{
 const f=await fixture(t,{debugMode:true,callbackIO:true}),a=await f.connect();f.logs.length=0;
 f.manager.getPlugin=()=>mode==='missing-plugin'?null:{webSocketPush:{enabled:true,targetClientType:'DistributedServer',messageType:'synthetic_callback'}};
 const message={type:'plugin_callback_forward',authorization:'Bearer '+privateToken,data:{callbackData:{pluginName:privatePayload,taskId:'synthetic-task',private:privateToken}}};
 let received;
 if(mode==='push')received=once(a.client,'message');
 if(mode==='send-error')a.ws.send=()=>{throw Error(privateToken+privatePayload);};
 await f.host.handleDistributedServerMessage(a.ws.serverId,message);
 assert.equal(f.callbackWrites.length,1,'actual callback helper requests persistence through synthetic fs; real writes remain zero');
 if(received){const value=JSON.parse((await received)[0]);assert.equal(value.type,'synthetic_callback');assert.equal(value.data.private,privateToken,'logging suppression must not alter business wire data');}
 assertPrivateLogs(f);assert.equal(f.calls.length,0);
});

test('consolidation: enabled actual music helper uses fixed logger and preserves payload_error result',async t=>{
 const f=await fixture(t,{debugMode:true,musicEnabled:true}),a=await f.connect();f.logs.length=0;
 // Actual syncDistributedMusicDiary exits on data.error before any filesystem operation.
 await f.host.handleDistributedServerMessage(a.ws.serverId,{type:'music_playlist_update',authorization:'Bearer '+privateToken,data:{serverName:privatePayload,error:privateToken}});
 assert.equal(f.host.__testing.distributedServers.get(a.ws.serverId).musicPlaylist.syncResult.reason,'payload_error');
 assertPrivateLogs(f);assert.equal(f.calls.length,0);
});

test('consolidation: preflight exception before state can be corrected on the same socket',async t=>{
 const f=await fixture(t,{debugMode:true}),a=await f.connect(),m=frame(),get=f.manager.plugins.get;f.logs.length=0;
 f.manager.plugins.get=()=>{throw Error(privateToken+privatePayload);};
 assert.equal((await f.send(a,m)).code,'NATIVE_RESULT_UNKNOWN');assert.equal(a.ws.listenerCount('pong'),0);assert.equal(f.calls.length,0);
 f.manager.plugins.get=get;assert.equal((await f.send(a,m)).ok,true);assert.equal(f.calls.length,1);
 assert.ok(JSON.stringify(f.logs).includes('NATIVE_WEBSOCKET_FAILED'));for(const value of [privateToken,privatePayload])assert.ok(!require('node:util').inspect(f.logs).includes(value));
});

test('consolidation: complete synthetic normal routing and fresh reconnect use actual WS without HTTP fallback',async t=>{
 const f=await fixture(t),a=await f.connect(),m=frame();let sources=0;
 f.manager.executePlugin=async(_name,args)=>{const input=JSON.parse(args);f.calls.push(input);const action=input.nativeAction;
  return {result:action==='prepare'?{ok:true,sourceId:'source-'+(++sources)}:action==='propose'?{ok:true,plan:{id:'plan-flow',conversationId:input.payload.conversationId}}:action==='execute'?{ok:true,kind:sources===1?'state':'cancelled'}:action==='recover'?{ok:true,results:[]}:{ok:true}};};
 const send=(action,payload={})=>f.send(a,frame(m.sessionId,action,{conversationId:'chat',...payload}));
 assert.equal((await send('status')).ok,true);const query=await send('prepare',{text:'合成查询'});
 assert.equal((await send('execute',{sourceId:query.sourceId})).kind,'state');
 const proposal=await send('propose',{scheduleItemId:'synthetic-item',minutes:5});assert.equal(proposal.plan.conversationId,'chat');
 assert.equal((await send('presented',{planId:proposal.plan.id})).ok,true);
 assert.equal((await send('invalidate',{messageId:'synthetic-message'})).ok,true);
 const cancel=await send('prepare',{text:'合成取消'});assert.equal((await send('execute',{sourceId:cancel.sourceId})).kind,'cancelled');assert.equal((await send('recover')).ok,true);
 const closed=once(a.ws,'close');a.client.terminate();await closed;const b=await f.connect();
 assert.equal((await f.send(b,frame(m.sessionId,'recover',{}))).ok,true);
 assert.equal((await f.send(b,frame(m.sessionId,'execute',{sourceId:cancel.sourceId}))).code,'NATIVE_CONNECTION_CHANGED');
 assert.deepEqual(f.calls.map(c=>c.nativeAction),['status','prepare','execute','propose','presented','invalidate','prepare','execute','recover','recover']);
 t.diagnostic(JSON.stringify({realWebSocket:true,pluginSubstitute:true,realJso:false,humanConfirmation:false,httpFallback:false,pluginDispatches:f.calls.length}));
});
