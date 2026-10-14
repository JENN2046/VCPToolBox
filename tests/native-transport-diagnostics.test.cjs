const test=require('node:test'),assert=require('node:assert/strict');
const {registerNativeConversationRoute,createStdioContext}=require('../modules/nativeConversationTransport');
for(const known of [true,false])test(`native errors have scrubbed diagnostics (known=${known})`,async()=>{
 const plugin={name:'Synthetic',nativeConversation:{protocol:'trusted-conversation-v1'},communication:{protocol:'stdio'}};let route;const logs=[],old=console.warn;
 registerNativeConversationRoute({post:(p,h)=>route=h},{plugins:new Map([[plugin.name,plugin]]),executePlugin:()=>known?createStdioContext(plugin,{JSO_LOCAL_AGENT_ENDPOINT:'http://127.0.0.1:1/wrong-path'}):Promise.reject(Error('secret-credential-and-payload'))});
 try{console.warn=(...args)=>logs.push(args);let status,result;await route({socket:{remoteAddress:'127.0.0.1'},params:{toolName:plugin.name},headers:{'x-vcp-application-authorization':'Bearer '+'secret-credential'.padEnd(40,'x')},body:{action:'status',payload:{secret:'secret-payload'}}},{status(s){status=s;return this},json(r){result=r}});
 assert.equal(status,503);assert.equal(result.code,'NATIVE_RESULT_UNKNOWN');assert.equal(logs.length,1);assert.equal(logs[0][1].code,known?'JSO_LOCAL_BINDING_INVALID':'NATIVE_EXECUTION_FAILED');assert.doesNotMatch(JSON.stringify({logs,result}),/secret/);
 }finally{console.warn=old;}
});
