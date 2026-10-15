'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const express=require('express');
const {registerNativeConversationRoute,executeNativeRequest}=require('../modules/nativeConversationTransport');
const credential='Bearer '+'synthetic-owner'.padEnd(40,'x');
const plugin={name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'},communication:{protocol:'stdio'}};
const request={action:'prepare',payload:{conversationId:'synthetic'}};
async function fixture(t,{value={ok:true},error,plugins=new Map([[plugin.name,plugin]])}={}){
 let calls=0;
 const manager={plugins,async executePlugin(){calls++;if(error)throw error;return {result:value};}};
 const app=express();app.use(express.json());registerNativeConversationRoute(app,manager);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}`;
 return {url,manager,calls:()=>calls,post:(body=request,authorization=credential)=>fetch(url+'/v1/native-conversation/Example',{method:'POST',headers:{'content-type':'application/json',...(authorization?{'x-vcp-application-authorization':authorization}:{})},body:JSON.stringify(body)})};
}
const codes=['APPLICATION_SESSION_REQUIRED','INVALID_NATIVE_REQUEST','NATIVE_TOOL_UNAVAILABLE','NATIVE_RESULT_UNKNOWN'];
for(const code of codes)test('plugin business error preserves HTTP 200 and JSON: '+code,async t=>{
 const value={ok:false,code,handled:true,detail:{synthetic:true}};const f=await fixture(t,{value});
 const response=await f.post();assert.equal(response.status,200);assert.deepEqual(await response.json(),value);assert.equal(f.calls(),1);
 assert.deepEqual(await executeNativeRequest(f.manager,'Example',credential,request),value);
});
test('successful plugin results keep the existing HTTP envelope',async t=>{const value={ok:true,handled:false,sequence:3};const f=await fixture(t,{value});const response=await f.post();assert.equal(response.status,200);assert.deepEqual(await response.json(),value);});
for(const [name,body] of [['missing action',{payload:{}}],['unsupported action',{action:'reschedule',payload:{}}],['array payload',{action:'prepare',payload:[]}],['extra key',{...request,approved:true}],['oversize body',{action:'prepare',payload:{text:'x'.repeat(32768)}}]])test('route rejects '+name+' before plugin dispatch',async t=>{
 const f=await fixture(t);const response=await f.post(body);assert.equal(response.status,400);assert.deepEqual(await response.json(),{ok:false,code:'INVALID_NATIVE_REQUEST'});assert.equal(f.calls(),0);
});
for(const authorization of [null,'Bearer short'])test('route rejects missing or malformed application credential',async t=>{const f=await fixture(t);const response=await f.post(request,authorization);assert.equal(response.status,403);assert.equal((await response.json()).code,'APPLICATION_SESSION_REQUIRED');assert.equal(f.calls(),0);});
for(const plugins of [new Map(),new Map([['Example',{...plugin,communication:{protocol:'http'}}]])])test('route rejects missing or non-native stdio tool',async t=>{const f=await fixture(t,{plugins});const response=await f.post();assert.equal(response.status,404);assert.equal((await response.json()).code,'NATIVE_TOOL_UNAVAILABLE');assert.equal(f.calls(),0);});
test('non-loopback route remains forbidden before dispatch',async()=>{
 let route,status,value,calls=0;registerNativeConversationRoute({post:(_p,h)=>route=h},{plugins:new Map([[plugin.name,plugin]]),executePlugin:async()=>calls++});
 await route({socket:{remoteAddress:'192.0.2.10'}},{status(s){status=s;return this;},json(r){value=r;}});assert.equal(status,403);assert.equal(value.code,'LOCAL_NATIVE_CHANNEL_REQUIRED');assert.equal(calls,0);
});
test('host exception remains HTTP 503 rather than a plugin business result',async t=>{const f=await fixture(t,{error:Error('synthetic-host-error')});const response=await f.post();assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,code:'NATIVE_RESULT_UNKNOWN'});});
// Use the actual unmodified #59 module when supplied; no copied transport or mock IPC.
const chatSource=process.env.JSO_CHAT_SOURCE;
for(const code of codes)test('actual Chat #59 HTTP transport receives original plugin code: '+code,{skip:!chatSource},async t=>{
 const {createNativeTransport}=require(path.join(chatSource,'modules/services/trustedConversation/transport.cjs'));
 const value={ok:false,code,handled:true};const f=await fixture(t,{value});
 const transport=createNativeTransport({binding:{toolboxUrl:f.url,toolName:'Example',transportTokenEnv:'TRANSPORT',applicationAuthorizationEnv:'OWNER'},env:{TRANSPORT:'synthetic-transport',OWNER:credential}});
 assert.deepEqual(await transport.request('prepare'),value);assert.equal(f.calls(),1);
});
