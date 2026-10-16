'use strict';
// Synthetic plugin results; real ws/HTTP sockets and actual server callbacks.
// Only the existing host interval clock is controlled, never plugin completion.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),{createServer}=require('node:http'),{once}=require('node:events'),{randomUUID}=require('node:crypto'),WebSocket=require('ws');
const sourcePath=path.join(__dirname,'../WebSocketServer.js'),realRequire=createRequire(sourcePath);
const frame=(sessionId=randomUUID(),action='prepare',payload={conversationId:'chat'})=>({type:'native_conversation_request',requestId:randomUUID(),sessionId,toolName:'Example',authorization:'Bearer '+'synthetic-owner'.padEnd(40,'x'),body:{action,payload}});
function gate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function fixture(t,{heartbeatEnabled=false}={}){
 const intervals=new Map(),callbacks=[],calls=[],sockets=[],logs=[],requests=new Map();let approvals=0;
 const manager={plugins:new Map([['Example',{name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'},communication:{protocol:'stdio'}}]]),unregisterAllDistributedTools(){},async handleApprovalResponse(){approvals++;},async executePlugin(_name,args){calls.push(JSON.parse(args));return {result:JSON.parse(args).nativeAction==='prepare'?{ok:true,sourceId:'source',plan:{id:'plan'}}:{ok:true}};}};
 const module={exports:{}};
 const context={module,exports:module.exports,__dirname:path.dirname(sourcePath),Buffer,URL,console:{log(){},warn:(...a)=>logs.push(a),error:(...a)=>logs.push(a)},process:{env:{}},setTimeout,clearTimeout,
  setInterval(fn,ms){const timer={unref(){}};intervals.set(timer,{fn,ms});callbacks.push(fn);return timer;},clearInterval(timer){intervals.delete(timer);},
  require(name){if(name==='./modules/distributedMusicDiarySync')return {};if(name==='./modules/vcpLogReplayManager')return {};if(name==='./modules/nativeConversationWebSocket'){const native=realRequire(name);return {...native,handleNativeConversationMessage(...args){const work=native.handleNativeConversationMessage(...args);requests.set(args[1]?.requestId,work);return work;}};}return realRequire(name);}};
 vm.runInNewContext(fs.readFileSync(sourcePath,'utf8')+'\nmodule.exports.fixtureServer=()=>wssInstance;',context,{filename:sourcePath});
 const host=module.exports,http=createServer();host.setPluginManager(manager);host.initialize(http,{vcpKey:'synthetic-test-key',debugMode:false,heartbeatEnabled});
 await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{for(const {client} of sockets)client.terminate();await host.shutdown();await new Promise(resolve=>http.close(resolve));assert.equal(intervals.size,0,'shutdown clears the shared interval');});
 async function connect({autoPong=true,ordinary=false}={}){
  const client=new WebSocket(`ws://127.0.0.1:${http.address().port}/${ordinary?'vcp-admin-panel':'vcp-distributed-server'}/VCP_Key=synthetic-test-key`,{autoPong});client.on('error',()=>{});
  const connected=once(host.fixtureServer(),'connection');await once(client,'open');const [ws]=await connected;
  const entry={client,ws};sockets.push(entry);return entry;
 }
 async function send(entry,message){const response=once(entry.client,'message');entry.client.send(typeof message==='string'||Buffer.isBuffer(message)?message:JSON.stringify(message));return JSON.parse((await response)[0].toString()).result;}
 function tick(){assert.equal(intervals.size,1,'one existing host timer must also serve native-only heartbeat');const [{fn,ms}]=intervals.values();assert.equal(ms,60000);fn();}
 return {host,manager,calls,sockets,logs,connect,send,tick,intervals,callbacks,requests,approvals:()=>approvals};
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
