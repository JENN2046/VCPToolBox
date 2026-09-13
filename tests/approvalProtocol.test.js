'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { ApprovalProtocol, LIMITS } = require('../modules/approvalProtocol');
const { ApprovalReceiptAuthority } = require('../modules/approvalReceiptAuthority');
const { dispatchApprovalMessage, broadcastApprovalTerminal } = require('../modules/approvalProtocolTransport');
const env = { AdminUsername: 'fixture-human', AdminPassword: 'fixture-only' };
const http = { headers: { authorization: 'Basic ' + Buffer.from('fixture-human:fixture-only').toString('base64') } };
const args = { command: 'grant', requestId: 'public-R', projectRoot: '/isolated/no-repository-required', purpose: 'propose' };
function setup() {
    let time = 100000, minted = 0;
    const timers = new Map(), events = [], sockets = [];
    const authority = new ApprovalReceiptAuthority({ now: () => time });
    const original = authority.approve.bind(authority);
    authority.approve = (...a) => { const h = original(...a); minted++; return h; };
    const p = new ApprovalProtocol({ authority, now: () => time,
        schedule: (fn, ms) => { const id = {}; timers.set(id, { fn: () => { timers.delete(id); fn(); }, ms }); return id; }, unschedule: id => timers.delete(id),
        onTerminal: e => { events.push(e); broadcastApprovalTerminal(sockets, authority, e); } });
    function socket() { const s = { readyState: 1, messages: [], send(text) { this.messages.push(JSON.parse(text)); } }; sockets.push(s); return s; }
    function human() { const s = socket(); authority.bindChannel(s, authority.claimChannel(authority.issueChannel(http, env))); return s; }
    function open(id = 'host-R', input = args, extra = {}) {
        const sensitiveApproval = authority.snapshot('CodexWorker', input, { requiresApproval: true, matchedRule: 'CodexWorker:' + input.command, matchedCommand: input.command }, {});
        return p.create({ requestId: id, toolName: 'CodexWorker', args: input, sensitiveApproval, timeoutMs: 100, ...extra });
    }
    return { p, authority, open, human, socket, events, timers, sockets, advance: n => { time += n; }, minted: () => minted };
}
for (const [a, b] of [[true,true],[true,false],[false,true],[false,false]]) {
    test(`race ${a}/${b}: one terminal and at most one receipt`, async () => {
        const h=setup(), request=h.open(), s1=h.human(), s2=h.human();
        const outcomes=await Promise.all([Promise.resolve().then(()=>h.p.respond({requestId:'host-R',approved:a},s1)),Promise.resolve().then(()=>h.p.respond({requestId:'host-R',approved:b},s2))]);
        assert.deepEqual(outcomes.map(x=>x.outcome),['ACCEPTED','ALREADY_TERMINAL']);
        assert.equal(h.minted(),a?1:0);assert.equal(h.events.length,1);assert.equal(h.p.pendingCount,0);
        if(a) await request.promise; else await assert.rejects(request.promise,{code:'approval_rejected'});
        assert.equal(h.events[0].terminalState,a?'ALLOWED':'DENIED');
    });
}
for(const [left,right,a,b] of [['admin_panel','vcp_chat',true,true],['admin_panel','vcp_mobile',true,true],['vcp_chat','vcp_mobile',true,true],['admin_panel','vcp_mobile',false,true],['vcp_mobile','vcp_chat',false,true]]) {
    test(`simulated admitted surfaces ${left}/${right} equal authority`,()=>{
        // Host-protocol DI only, not a production enrollment adapter or exported test switch.
        const identities=new WeakMap(),events=[];let count=0;
        const authority={humanContext:s=>identities.get(s),approve:()=>{count++;return {};}};
        const p=new ApprovalProtocol({authority,onTerminal:e=>events.push(e)});
        const real=new ApprovalReceiptAuthority();const snapshot=real.snapshot('CodexWorker',args,{requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'},{});
        p.create({requestId:'R',toolName:'CodexWorker',args,sensitiveApproval:snapshot,timeoutMs:10000});
        const s1={},s2={};identities.set(s1,{clientSurface:left});identities.set(s2,{clientSurface:right});
        assert.equal(p.respond({requestId:'R',approved:a},s1).outcome,'ACCEPTED');
        assert.equal(p.respond({requestId:'R',approved:b},s2).outcome,'ALREADY_TERMINAL');
        assert.equal(count,a?1:0);assert.equal(events.length,1);assert.equal(events[0].clientSurface,left);
    });
}
for(const decision of [true,false]) test(`untrusted ${decision} before and after deadline cannot mutate pending`,()=>{
    const h=setup();h.open();const fake=h.socket();fake.humanApprovalAuthenticated=true;fake.clientSurface='admin_panel';
    for(const elapsed of [0,101]){h.advance(elapsed);assert.equal(h.p.respond({requestId:'host-R',approved:decision,clientSurface:'vcp_mobile'},fake).outcome,'CLIENT_NOT_AUTHORIZED');assert.equal(h.p.pendingCount,1);assert.equal(h.events.length,0);assert.equal(h.minted(),0);}
    [...h.timers.values()][0].fn();assert.equal(h.events[0].terminalState,'EXPIRED');assert.equal(h.minted(),0);
});
test('deadline inclusive; delayed timer cannot admit expired response',()=>{
    const h=setup(),s=h.human();h.open();h.advance(100);assert.equal(h.p.respond({requestId:'host-R',approved:true},s).outcome,'ACCEPTED');
    const z=setup();z.open();const s2=z.human();z.advance(101);assert.equal(z.p.respond({requestId:'host-R',approved:true},s2).outcome,'REQUEST_EXPIRED');assert.equal(z.minted(),0);assert.equal(z.events.length,1);
});
test('timer agrees with deadline and emits once even when called repeatedly',()=>{
    const h=setup();h.open();const tick=[...h.timers.values()][0].fn;h.advance(100);tick();assert.equal(h.p.pendingCount,1);h.advance(1);tick();tick();assert.equal(h.events.length,1);assert.equal(h.timers.size,0);
});
test('cancellation before response yields no receipt, no resurrection',async()=>{
    const h=setup(),s=h.human(),r=h.open();h.p.cancel('host-R');h.p.cancel('host-R');assert.equal(h.p.respond({requestId:'host-R',approved:true},s).outcome,'ALREADY_TERMINAL');await assert.rejects(r.promise,{code:'approval_cancelled'});assert.equal(h.minted(),0);assert.equal(h.events.length,1);
});
test('owner AbortSignal and host shutdown cancel pending, detach timers',()=>{
    const h=setup(),c=new AbortController();h.open('R',args,{signal:c.signal});c.abort();assert.equal(h.p.inspect('R').terminalState,'CANCELLED');h.open('R2');h.p.cancelAll();assert.equal(h.p.pendingCount,0);assert.equal(h.timers.size,0);
});
test('already aborted owner never leaves actionable pending',()=>{const h=setup(),c=new AbortController();c.abort();h.open('R',args,{signal:c.signal});assert.equal(h.p.inspect('R').terminalState,'CANCELLED');});
for(const data of [null,{}, {requestId:'host-R',approved:'true'},{requestId:'host-R',approved:true,reason:4},{requestId:'host-R',approved:true,protocolVersion:2}])test('malformed response '+JSON.stringify(data),()=>{const h=setup();h.open();assert.equal(h.p.respond(data,h.human()).outcome,'INVALID_RESPONSE');assert.equal(h.p.pendingCount,1);h.p.cancelAll();});
test('unknown ID, target mismatch and forged surface ACKs',()=>{
    const h=setup(),s=h.human();h.open();assert.equal(h.p.respond({requestId:'missing',approved:true},s).outcome,'REQUEST_UNKNOWN');assert.equal(h.p.respond({requestId:'host-R',approved:true,argsDigest:'wrong'},s).outcome,'TARGET_MISMATCH');
    assert.equal(h.p.respond({requestId:'host-R',approved:true,clientSurface:'vcp_mobile'},s).outcome,'ACCEPTED');assert.equal(h.events[0].clientSurface,'admin_panel');
});
for(const input of [{...args,projectRoot:''},{...args,purpose:'apply'},{command:'revoke',requestId:'R',grantId:''}])test('invalid target cannot Allow but human can Deny '+JSON.stringify(input),()=>{const h=setup(),s=h.human();h.open('R',input);assert.equal(h.p.respond({requestId:'R',approved:true},s).outcome,'TARGET_MISMATCH');assert.equal(h.p.respond({requestId:'R',approved:false},s).outcome,'ACCEPTED');assert.equal(h.minted(),0);});
test('immutable snapshot and digest bind displayed args',()=>{const h=setup(),input={...args};const r=h.open('R',input);input.projectRoot='/changed';assert.equal(r.metadata.args.projectRoot,args.projectRoot);assert(Object.isFrozen(r.metadata));assert(Object.isFrozen(r.metadata.args));h.p.cancelAll();});
test('common receipt one-time verification, surface provenance and downstream failure',async()=>{
    const h=setup(),s=h.human(),r=h.open();h.p.respond({requestId:'host-R',approved:true},s);const handle=await r.promise,ctx={};h.authority.bindInvocation(handle,ctx,r.metadata.args);
    const expected={toolName:'CodexWorker',command:'grant',requestId:args.requestId,payload:args};h.authority.verifyAuthorization(expected,ctx);
    assert.equal(h.authority.invocationAudit(ctx).clientSurface,'admin_panel');assert.equal(h.authority.invocationAudit(ctx).state,'CONSUMED');assert.throws(()=>h.authority.verifyAuthorization(expected,ctx));h.authority.finishInvocation(ctx);assert.equal(h.p.inspect('host-R').terminalState,'ALLOWED');assert.equal(h.minted(),1);
});
test('receipt mint failure is CANCELLED, never ACCEPTED or retried',()=>{const h=setup(),s=h.human();h.open();h.authority.approve=()=>{throw Error('fixture');};assert.equal(h.p.respond({requestId:'host-R',approved:true},s).outcome,'INTERNAL_ERROR');assert.equal(h.p.inspect('host-R').terminalState,'CANCELLED');assert.equal(h.p.respond({requestId:'host-R',approved:true},s).outcome,'ALREADY_TERMINAL');});
test('expired/reused/wrong connection/forged claim capabilities fail closed',()=>{
    const h=setup(),a=h.authority,token=a.issueChannel(http,env),claim=a.claimChannel(token),s=h.socket();
    assert.throws(()=>a.claimChannel(token));assert.throws(()=>a.bindChannel({}, {...claim,clientSurface:'vcp_mobile'}));a.bindChannel(s,claim);assert.throws(()=>a.bindChannel({},claim));assert.equal(a.isHuman({...s}),false);
    const t=a.issueChannel(http,env);h.advance(60000);assert.throws(()=>a.claimChannel(t));h.advance(900001);assert.equal(a.isHuman(s),false);
});
test('public surface selector cannot enroll Chat/Mobile or rebind a connection',()=>{const h=setup(),a=h.authority,s=h.human();const token=a.issueChannel({...http,clientSurface:'vcp_mobile',query:{clientSurface:'vcp_chat'}},env);const c=a.claimChannel(token);assert.equal(c.clientSurface,'admin_panel');assert.throws(()=>a.bindChannel(s,c));assert.throws(()=>a.issueChannel({headers:{authorization:'Bearer shared-key'}},env));});
for(const terminal of ['ALLOWED','DENIED','EXPIRED','CANCELLED']) test('terminal broadcast and reconnect '+terminal,()=>{
    const h=setup(),a=h.human(),b=h.human(),generic=h.socket();h.open();b.readyState=3;
    if(terminal==='EXPIRED'){h.advance(101);[...h.timers.values()][0].fn();}else if(terminal==='CANCELLED')h.p.cancel('host-R');else h.p.respond({requestId:'host-R',approved:terminal==='ALLOWED'},a);
    assert.equal(a.messages.length,1);assert.equal(b.messages.length,0);assert.equal(generic.messages.length,0);
    const fresh=h.human(),snapshot=h.p.sync(fresh);assert.equal(snapshot.active.length,0);assert.equal(snapshot.terminal[0].terminalState,terminal);
    assert(!JSON.stringify(snapshot).includes('approvalReceiptId'));assert.equal(h.p.respond({requestId:'host-R',approved:true},fresh).outcome,terminal==='EXPIRED'?'REQUEST_EXPIRED':'ALREADY_TERMINAL');
});
test('sync denied for generic socket; stale card never resurrects after TTL or restart',()=>{const h=setup(),s=h.human();h.open();assert.equal(h.p.sync(h.socket()).outcome,'CLIENT_NOT_AUTHORIZED');h.p.cancel('host-R');h.advance(LIMITS.terminalTtlMs+1);const fresh=h.human();assert.equal(h.p.sync(fresh).terminal.length,0);assert.equal(h.p.respond({requestId:'host-R',approved:true},fresh).outcome,'REQUEST_UNKNOWN');const restart=new ApprovalProtocol({authority:h.authority});assert.equal(restart.sync(fresh).active.length,0);});
test('pending and tombstones have hard count bounds',()=>{const h=setup();for(let i=0;i<LIMITS.pending;i++)h.open('p'+i);assert.throws(()=>h.open('overflow'),{code:'APPROVAL_CAPACITY'});h.p.cancelAll();for(let i=0;i<LIMITS.terminalCount+2;i++){h.open('t'+i);h.p.cancel('t'+i);}assert.equal(h.p.sync(h.human()).terminal.length,LIMITS.terminalCount);assert.equal(h.p.inspect('t0'),null);});
test('target size and duplicate identity bounds',()=>{const h=setup();h.open();assert.throws(()=>h.open(),{code:'INVALID_REQUEST'});assert.throws(()=>h.open('big',{...args,projectRoot:'x'.repeat(LIMITS.targetBytes)}),{code:'APPROVAL_CAPACITY'});h.p.cancelAll();});
test('legacy unrelated tool approval and silent Deny remain compatible',async()=>{const h=setup();const r=h.p.create({requestId:'legacy',toolName:'Other',args:{x:1},timeoutMs:100,notifyAiOnReject:false});assert.equal(h.p.respond({requestId:'legacy',approved:false},h.socket()).outcome,'ACCEPTED');assert.deepEqual(await r.promise,{silentRejected:true});assert.equal(h.minted(),0);});
test('transport ACK/sync additive types; send failure does not undo terminal',()=>{
    const h=setup(),s=h.human();h.open();const manager={handleApprovalResponseOutcome:(d,c)=>h.p.respond(d,c),syncApprovals:c=>h.p.sync(c)};
    dispatchApprovalMessage(s,{type:'tool_approval_response',data:{requestId:'host-R',approved:true}},manager);
    const ack=s.messages.find(x=>x.type==='tool_approval_ack');assert.equal(ack.data.outcome,'ACCEPTED');assert.equal(ack.data.requestId,'host-R');assert.equal(ack.data.terminalState,'ALLOWED');assert(!JSON.stringify(ack).includes('grantId'));
    dispatchApprovalMessage(s,{type:'tool_approval_sync',data:{protocolVersion:1}},manager);assert.equal(s.messages.at(-1).data.terminal.length,1);
    s.send=()=>{throw Error('closed');};dispatchApprovalMessage(s,{type:'tool_approval_response',data:{requestId:'host-R',approved:true}},manager);assert.equal(h.minted(),1);
});

// Evaluate the actual production class without running its singleton constructor/watchers.
function pluginClass(authority) {
    const text=fs.readFileSync(require.resolve('../Plugin'),'utf8');
    const body=text.slice(text.indexOf('class PluginManager extends'),text.indexOf('const pluginManager = new PluginManager();'));
    return new Function('EventEmitter','approvalReceiptAuthority','toolCallRecordStore','FileFetcherServer','buildToolChangePreview','_filterFuzzyDiff','ApprovalProtocol','return '+body)(EventEmitter,authority,{beginRecord:()=>null,finishRecord:()=>{}},{resolveFileUrl:async x=>x},()=>null,()=>{},ApprovalProtocol);
}
function managerFixture(h, dispatch) {
    const C=pluginClass(h.authority),m=Object.create(C.prototype);
    Object.assign(m,{approvalProtocol:h.p,plugins:new Map([['CodexWorker',{name:'CodexWorker',pluginType:'hybridservice',communication:{protocol:'direct'}}]]),_resolvePluginName:name=>({name}),_assertDirectAdmissionOpen:()=>{},_sanitizeToolResultForAi:x=>x,getServiceModule:()=>({processToolCall:()=>{}}),_executeDirectToolCallWithTimeout:dispatch,toolApprovalManager:{getApprovalDecision:()=>({requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'}),config:{},getTimeoutMs:()=>100},webSocketServer:{broadcast:msg=>{m.card=msg;}}});return m;
}
test('actual PluginManager frozen snapshot → pending → receipt → fake Direct verifier, no real grant',async()=>{
    const h=setup(),s=h.human();let called=0;
    const m=managerFixture(h,async(plugin,name,module,input,ctx)=>{called++;assert.equal(input.projectRoot,args.projectRoot);return { ...h.authority.verifyAuthorization({toolName:name,command:input.command,requestId:input.requestId,payload:input},ctx) };});
    const input={...args};const task=m.processToolCall('CodexWorker',input);await new Promise(setImmediate);assert(m.card);assert.equal(called,0);input.projectRoot='/substitution';
    assert.equal(m.handleApprovalResponse(m.card.data.requestId,true,'',s),true);await task;assert.equal(called,1);assert.equal(h.minted(),1);assert.equal(h.p.pendingCount,0);
});
test('actual PluginManager cancels when broadcast fails or owner aborts',async()=>{
    const h=setup(),m=managerFixture(h,()=>assert.fail('must not dispatch'));m.webSocketServer.broadcast=()=>{throw Error('broadcast fixture failure');};await assert.rejects(m.processToolCall('CodexWorker',{...args}),/broadcast fixture/);assert.equal(h.p.pendingCount,0);assert.equal(h.events[0].terminalState,'CANCELLED');
    const c=new AbortController(),h2=setup(),m2=managerFixture(h2,()=>assert.fail('must not dispatch'));const task=m2.processToolCall('CodexWorker',{...args},null,null,{signal:c.signal});await new Promise(setImmediate);c.abort();await assert.rejects(task,{code:'approval_cancelled'});assert.equal(h2.minted(),0);
});
test('simulated three-surface subscriptions each receive one coherent terminal, generic receives none',()=>{
    const identities=new WeakMap(),sockets=[];
    for(const surface of ['admin_panel','vcp_chat','vcp_mobile']){const s={readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x));}};identities.set(s,{clientSurface:surface});sockets.push(s);}
    const generic={readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x));}};sockets.push(generic);
    let minted=0;const authority={humanContext:s=>identities.get(s),isHuman:s=>identities.has(s),approve:()=>{minted++;return {};}};
    const p=new ApprovalProtocol({authority,onTerminal:e=>broadcastApprovalTerminal(sockets,authority,e)});
    const real=new ApprovalReceiptAuthority(),sensitiveApproval=real.snapshot('CodexWorker',args,{requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'},{});
    p.create({requestId:'shared',toolName:'CodexWorker',args,sensitiveApproval,timeoutMs:1000});
    assert.equal(p.respond({requestId:'shared',approved:false},sockets[2]).outcome,'ACCEPTED');
    for(const s of sockets.slice(0,3)){assert.equal(s.messages.length,1);assert.equal(s.messages[0].data.terminalState,'DENIED');assert.equal(s.messages[0].data.clientSurface,'vcp_mobile');}
    assert.equal(generic.messages.length,0);assert.equal(minted,0);
});
test('unauthenticated sync past deadline does not expire pending',()=>{const h=setup();h.open();h.advance(101);assert.equal(h.p.sync(h.socket()).outcome,'CLIENT_NOT_AUTHORIZED');assert.equal(h.p.pendingCount,1);assert.equal(h.events.length,0);h.p.cancelAll();});
test('actual legacy Direct invocation dispatches approved snapshot with a mutable private copy',async()=>{
    const h=setup();let dispatched=false;
    const m=managerFixture(h,async(_p,_n,_m,input)=>{assert.equal(input.nested.value,'A');input.nested.value='plugin private mutation';dispatched=true;return {};});
    m.plugins=new Map([['Other',{name:'Other',pluginType:'hybridservice',communication:{protocol:'direct'}}]]);
    const input={command:'test',nested:{value:'A'}},task=m.processToolCall('Other',input);await new Promise(setImmediate);
    input.nested.value='caller changed after display';assert.equal(m.card.data.args.nested.value,'A');assert(Object.isFrozen(m.card.data.args));
    assert.equal(m.handleApprovalResponse(m.card.data.requestId,true,'',h.socket()),true);await task;assert(dispatched);assert.equal(h.minted(),0);
});
