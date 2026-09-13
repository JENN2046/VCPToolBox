'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const WebSocket = require('ws');
const bridge = require('../WebSocketServer');
const { authority } = require('../modules/approvalReceiptAuthority');
const { ApprovalProtocol } = require('../modules/approvalProtocol');

test('actual isolated WebSocket handler: generic denied, Admin ACK/terminal, reconnect sync, no secret in output', { timeout: 10000 }, async t => {
    const output=[],secrets=[],sockets=[];
    t.mock.method(console,'log',(...args)=>output.push(args.join(' ')));
    const server=http.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
    const p=new ApprovalProtocol({authority,onTerminal:e=>{bridge.cancelVcpLogApprovalCache(e.requestId);bridge.broadcastApprovalTerminal(e);}});
    bridge.setPluginManager({handleApprovalResponseOutcome:(d,s)=>p.respond(d,s),syncApprovals:s=>p.sync(s),cancelPendingApprovals:()=>p.cancelAll()});
    const key=randomUUID();secrets.push(key);bridge.initialize(server,{vcpKey:key,debugMode:true,heartbeatEnabled:false});
    t.after(async()=>{p.cancelAll();for(const s of sockets)s.terminate();await bridge.shutdown();await new Promise(resolve=>server.close(resolve));});
    function waitType(s,type) {return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{s.off('message',handler);reject(Error('Expected '+type));},2000);const handler=b=>{const x=JSON.parse(b);if(x.type===type){clearTimeout(timeout);s.off('message',handler);resolve(x.data);}};s.on('message',handler);});}
    async function connect(human){
        let route='/VCPlog/VCP_Key='+key;
        if(human){const token=authority.issueChannel({headers:{authorization:'Basic '+Buffer.from('test:test').toString('base64')}},{AdminUsername:'test',AdminPassword:'test'});secrets.push(token);route='/VCPlog/admin-approval?capability='+token;}
        const s=new WebSocket('ws://127.0.0.1:'+server.address().port+route);sockets.push(s);await once(s,'message');return s;
    }
    const generic=await connect(false),a=await connect(true),b=await connect(true);
    const args={command:'grant',requestId:'fake-public',projectRoot:'/mock-only',purpose:'propose'};
    const snapshot=authority.snapshot('CodexWorker',args,{requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'},{});
    const pending=p.create({requestId:'fake-host',toolName:'CodexWorker',args,sensitiveApproval:snapshot,timeoutMs:5000});
    const ordinary=waitType(generic,'tool_approval_request');bridge.broadcast({type:'tool_approval_request',data:{requestId:'fake-host',args}},'VCPLog');await ordinary;
    const denied=waitType(generic,'tool_approval_ack');generic.send(JSON.stringify({type:'tool_approval_response',data:{requestId:'fake-host',approved:true,clientSurface:'admin_panel'}}));assert.equal((await denied).outcome,'CLIENT_NOT_AUTHORIZED');assert.equal(p.pendingCount,1);
    const ack=waitType(a,'tool_approval_ack'),terminal=waitType(b,'tool_approval_terminal');a.send(JSON.stringify({type:'tool_approval_response',data:{requestId:'fake-host',approved:true}}));assert.equal((await ack).outcome,'ACCEPTED');assert.equal((await terminal).terminalState,'ALLOWED');
    const handle=await pending.promise,ctx={};authority.bindInvocation(handle,ctx,args);authority.finishInvocation(ctx); // Never call CodexWorker or create a grant.
    b.close();await once(b,'close');const fresh=await connect(true),synced=waitType(fresh,'tool_approval_snapshot');fresh.send(JSON.stringify({type:'tool_approval_sync',data:{protocolVersion:1}}));const state=await synced;assert.equal(state.active.length,0);assert.equal(state.terminal[0].requestId,'fake-host');
    const again=waitType(fresh,'tool_approval_ack');fresh.send(JSON.stringify({type:'tool_approval_response',data:{requestId:'fake-host',approved:false}}));assert.equal((await again).outcome,'ALREADY_TERMINAL');
    for(const secret of secrets)assert.equal(output.some(line=>line.includes(secret)),false,'credentials/capabilities must not be logged');
});
