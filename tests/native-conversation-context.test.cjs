'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createStdioContext}=require('../modules/nativeConversationTransport');const {buildExternalPluginRuntimeEnv}=require('../modules/pluginRuntimeEnvSandbox');
test('JSON cannot mint host provenance and external environment policy remains unchanged',async()=>{
 const plugin={name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}};
 await assert.rejects(createStdioContext(plugin,{}, {human:true,approved:true,role:'user'}),/NATIVE_CONTEXT_REQUIRED/);
 const env=buildExternalPluginRuntimeEnv({},{JSO_LOCAL_AGENT_TOKEN:'synthetic-value'},{VCP_NATIVE_APPLICATION_AUTHORIZATION:'Bearer synthetic',VCP_EXECUTION_CONTEXT:'opaque-invocation-context'});
 assert.equal(env.JSO_LOCAL_AGENT_TOKEN,undefined);assert.equal(env.VCP_NATIVE_APPLICATION_AUTHORIZATION,undefined);assert.equal(env.VCP_EXECUTION_CONTEXT,'opaque-invocation-context');
});
test('temporary stdio broker rejects absent capability and has no Owner authority on model calls',async()=>{
 const context=await createStdioContext({name:'Example',nativeConversation:{protocol:'trusted-conversation-v1'}},{JSO_LOCAL_AGENT_ENDPOINT:'http://127.0.0.1:1/api/v2/agent/tools',JSO_LOCAL_AGENT_TOKEN:'synthetic'.padEnd(40,'x'),JSO_RESOURCE_IDS:'R'},undefined);
 const c=JSON.parse(context.env.VCP_EXECUTION_CONTEXT);
 try{
  assert.equal((await fetch(c.endpoint,{method:'POST',body:'{}'})).status,403);
  const r=await fetch(c.endpoint,{method:'POST',headers:{authorization:'Bearer '+c.capability},body:JSON.stringify({kind:'owner-session'})}).then(r=>r.json());assert.equal(r.code,'APPLICATION_SESSION_REQUIRED');
  assert.equal(JSON.stringify(context.env).includes('synthetic'),false);
 }finally{await context.close();}
 await assert.rejects(fetch(c.endpoint));
});
