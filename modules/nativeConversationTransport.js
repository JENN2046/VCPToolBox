'use strict';
// Transport provenance is host-owned and cannot be supplied through tool JSON.
// The plugin independently verifies the existing application credential before action.
const admitted=new WeakMap();
function loopback(ip){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);}
const actions=new Set(['status','prepare','execute','propose','presented','invalidate','recover']);
async function dispatchNativeRequest(pluginManager,toolName,credential,body,namespace){
 const plugin=pluginManager.plugins.get(toolName);
 if(!plugin||plugin.nativeConversation?.protocol!=='trusted-conversation-v1'||plugin.communication?.protocol!=='stdio')return {status:404,result:{ok:false,code:'NATIVE_TOOL_UNAVAILABLE'}};
 if(typeof credential!=='string'||!/^Bearer [\x21-\x7e]{32,4096}$/.test(credential))return {status:403,result:{ok:false,code:'APPLICATION_SESSION_REQUIRED'}};
 if(!body||Object.keys(body).sort().join(',')!=='action,payload'||!actions.has(body.action)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)||Buffer.byteLength(JSON.stringify(body))>32768)return {status:400,result:{ok:false,code:'INVALID_NATIVE_REQUEST'}};
 const context=Object.freeze({});admitted.set(context,{credential,toolName:plugin.name,namespace});
 // A plugin business result must not be confused with a route or host failure.
 try{const result=await pluginManager.executePlugin(plugin.name,JSON.stringify({nativeAction:body.action,payload:body.payload}),'127.0.0.1',{nativeConversationContext:context});return {status:200,result:result.result??result};}
 catch(error){const known=['JSO_LOCAL_BINDING_INVALID','JSO_ASSISTANT_BINDING_REQUIRED','NATIVE_CONTEXT_REQUIRED'];console.warn('[NativeConversation]',{code:known.includes(error?.message)?error.message:'NATIVE_EXECUTION_FAILED',action:body.action});return {status:503,result:{ok:false,code:'NATIVE_RESULT_UNKNOWN'}};}
 finally{admitted.delete(context);}
}
async function executeNativeRequest(pluginManager,toolName,credential,body,namespace){
 return (await dispatchNativeRequest(pluginManager,toolName,credential,body,namespace)).result;
}
function registerNativeConversationRoute(app,pluginManager){
 app.post('/v1/native-conversation/:toolName',async(req,res)=>{
  if(!loopback(req.socket?.remoteAddress))return res.status(403).json({ok:false,code:'LOCAL_NATIVE_CHANNEL_REQUIRED'});
  const {status,result}=await dispatchNativeRequest(pluginManager,req.params.toolName,req.headers['x-vcp-application-authorization'],req.body);
  return res.status(status).json(result);
 });
}
module.exports={registerNativeConversationRoute,executeNativeRequest};

// Per-invocation loopback broker: application/assistant credentials stay in the host.
// VCP_EXECUTION_CONTEXT is the existing allowed stdio context carrier. Its random
// handle expires when that child invocation ends and never grants another identity.
async function createStdioContext(plugin,config,nativeContext){
 if(plugin.nativeConversation?.protocol!=='trusted-conversation-v1')return null;
 const native=admitted.get(nativeContext);
 if(nativeContext&&(!native||native.toolName!==plugin.name))throw Error('NATIVE_CONTEXT_REQUIRED');
 const endpoint=new URL(config.JSO_LOCAL_AGENT_ENDPOINT);
 if(endpoint.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(endpoint.hostname)||endpoint.pathname!=='/api/v2/agent/tools'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('JSO_LOCAL_BINDING_INVALID');
 const assistant=config.JSO_LOCAL_AGENT_TOKEN;if(typeof assistant!=='string'||assistant.length<32)throw Error('JSO_ASSISTANT_BINDING_REQUIRED');
 const {createServer}=require('node:http'),{randomBytes}=require('node:crypto');const capability=randomBytes(32).toString('hex');
 const resources=String(config.JSO_RESOURCE_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  if(req.method!=='POST'||req.headers.authorization!=='Bearer '+capability)return send(403,{ok:false,code:'INVOCATION_CONTEXT_REQUIRED'});
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>270336)return send(413,{ok:false});}const body=JSON.parse(raw);let route,authorization,payload;
   if(body.kind==='agent'){
    payload=body.args;if(!payload||Object.keys(payload).sort().join(',')!=='command,payload_json')return send(400,{ok:false,code:'INVALID_AGENT_ARGUMENTS'});
    if(!['read_state','read_receipt','preview_shift','preview_calendar','propose_reschedule','reschedule'].includes(payload.command)||((!native||config.JSO_CALL_POLICY!=='native-direct-and-confirm')&&payload.command==='reschedule'))return send(403,{ok:false,code:'TRUSTED_NATIVE_TRANSPORT_REQUIRED'});
    const p=JSON.parse(payload.payload_json);if(payload.command==='read_state'&&p.resourceScope===undefined){p.resourceScope=resources;payload={...payload,payload_json:JSON.stringify(p)};}if(p.resourceId&&!resources.includes(p.resourceId)||p.resourceScope?.some(id=>!resources.includes(id)))return send(403,{ok:false,code:'FORBIDDEN'});
    route='/api/v2/agent/tools';authorization='Bearer '+assistant;
   }else if(body.kind==='owner-session'||body.kind==='owner-delegation'){
    if(!native)return send(403,{ok:false,code:'APPLICATION_SESSION_REQUIRED'});
    if(body.kind==='owner-delegation'&&config.JSO_CALL_POLICY!=='native-direct-and-confirm')return send(403,{ok:false,code:'READ_ONLY_POLICY'});
    route='/api/v2/agent/'+body.kind;authorization=native.credential;payload=body.kind==='owner-delegation'?body.payload:undefined;
    if(payload&&(!resources.includes(payload.command?.resourceId)||payload.assistantSubjectId!==config.JSO_ASSISTANT_SUBJECT_ID))return send(403,{ok:false,code:'FORBIDDEN'});
   }else return send(400,{ok:false,code:'INVALID_INVOCATION_REQUEST'});
   const result=await fetch(endpoint.origin+route,{method:payload?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization,'content-type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});const value=await result.json();if((payload?.command==='read_receipt'&&value.ok===true&&(value.kind!=='reschedule'||!resources.includes(value.receipt?.resourceId)))||(value.receipt?.resourceId&&!resources.includes(value.receipt.resourceId)))return send(403,{ok:false,code:'FORBIDDEN'});send(200,value);
  }catch{send(503,{ok:false,code:'INVOCATION_RESULT_UNKNOWN'});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {env:{VCP_EXECUTION_CONTEXT:JSON.stringify({protocol:'trusted-conversation-v1',endpoint:`http://127.0.0.1:${server.address().port}`,capability,native:!!native,...(native?.namespace?{namespace:native.namespace}:{})})},close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports.createStdioContext=createStdioContext;
