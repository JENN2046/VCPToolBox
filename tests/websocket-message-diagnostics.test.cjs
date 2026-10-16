'use strict';
// Run the actual message callback with synthetic socket/handler faults; no live service.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture({nativeFailure=false,approvalFailure=false}={}){
 const sensitive='SYNTHETIC_WS_PRIVATE_FRAME_CREDENTIAL_ERROR',logs=[],sent=[],calls={native:0,approval:0};let receive;
 const ws={clientType:'AdminPanel',clientId:'synthetic-client',on(type,handler){assert.equal(type,'message');receive=handler;},send(value){sent.push(value);}};
 const native={async handleNativeConversationMessage(_ws,message){calls.native++;if(nativeFailure)throw Error(sensitive);return message?.type==='native_conversation_request';}};
 const pluginManager={async handleApprovalResponse(...args){calls.approval++;calls.approvalArgs=args;if(approvalFailure)throw Error(sensitive);return true;}};
 const source=fs.readFileSync(path.join(__dirname,'../WebSocketServer.js'),'utf8');
 const start=source.indexOf("        ws.on('message', async (message) => {");
 const end=source.indexOf("        ws.on('close',",start);
 assert.ok(start>=0&&end>start);
 const helperStart=source.indexOf('function isSensitiveNativeMessage('),helperEnd=source.indexOf('async function writeLog(',helperStart);
 assert.ok(helperStart>=0&&helperEnd>helperStart);
 vm.runInNewContext(source.slice(helperStart,helperEnd)+source.slice(start,end),{ws,pluginManager,Buffer,serverConfig:{debugMode:false},console:{error:(...args)=>logs.push(args),log:(...args)=>logs.push(args)},require(name){assert.equal(name,'./modules/nativeConversationWebSocket');return native;}});
 return {sensitive,logs,sent,calls,receive};
}
for(const mode of ['parse','native','ordinary'])test(`outer WS diagnostics: ${mode} failure is classified and scrubbed`,async()=>{
 const f=fixture({nativeFailure:mode==='native',approvalFailure:mode==='ordinary'});
 const message=mode==='parse'?'{' + f.sensitive:JSON.stringify({type:mode==='native'?'native_conversation_request':'tool_approval_response',authorization:f.sensitive,data:{requestId:'synthetic-request',approved:false,reason:f.sensitive}});
 await f.receive(Buffer.from(message));
 assert.equal(f.calls.native,mode==='parse'?0:1);
 assert.equal(f.calls.approval,mode==='ordinary'?1:0);
 const code={parse:'WS_JSON_PARSE_FAILED',native:'WS_NATIVE_HANDLER_FAILED',ordinary:'WS_MESSAGE_HANDLER_FAILED'}[mode];
 assert.doesNotMatch(JSON.stringify({logs:f.logs,sent:f.sent}),new RegExp(f.sensitive));
 assert.equal(JSON.stringify(f.logs),JSON.stringify([['[WebSocketServer]',{code}]]));
 assert.deepEqual(f.sent,[],'diagnostics do not add a new business response');
});
test('outer WS diagnostics: ordinary approval routing and successful handling stay unchanged',async()=>{
 const f=fixture();
 await f.receive(Buffer.from(JSON.stringify({type:'tool_approval_response',data:{requestId:'synthetic-request',approved:false,reason:'synthetic reason'}})));
 assert.equal(f.calls.native,1);assert.equal(f.calls.approval,1);
 assert.deepEqual(f.calls.approvalArgs,['synthetic-request',false,'synthetic reason']);
 assert.deepEqual(f.logs,[]);assert.deepEqual(f.sent,[]);
});
