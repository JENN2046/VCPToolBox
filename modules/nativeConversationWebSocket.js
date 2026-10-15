'use strict';
const {createHash}=require('node:crypto');
const {executeNativeRequest}=require('./nativeConversationTransport');
const connections=new WeakMap(),activeSessions=new Map();
// Session is a correlation namespace, never an identity or an authorization token.
async function handleNativeConversationMessage(ws,message,pluginManager){
 if(message?.type!=='native_conversation_request')return false;
 const send=result=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'native_conversation_response',requestId:message.requestId,result}));};
 if(ws.clientType!=='DistributedServer'||!ws.serverId)return true;
 if(!/^[a-f0-9-]{36}$/.test(message.requestId||'')||!/^[a-f0-9-]{36}$/.test(message.sessionId||'')||!/^[A-Za-z0-9_-]{1,100}$/.test(message.toolName||'')||Buffer.byteLength(JSON.stringify(message))>40000){send({ok:false,code:'INVALID_NATIVE_REQUEST'});return true;}
 let state=connections.get(ws);
 const identity=createHash('sha256').update(String(message.authorization)).digest('hex');
 if(!state){
  const key=createHash('sha256').update(JSON.stringify([message.sessionId,identity,message.toolName])).digest('hex');
  if(activeSessions.has(key)&&activeSessions.get(key)!==ws){send({ok:false,code:'NATIVE_SESSION_IN_USE'});return true;}
  state={sessionId:message.sessionId,identity,tool:message.toolName,inflight:new Set(),sources:new Set(),plans:new Set()};connections.set(ws,state);activeSessions.set(key,ws);
  ws.once('close',()=>{if(activeSessions.get(key)===ws)activeSessions.delete(key);connections.delete(ws);});
 }
 if(state.sessionId!==message.sessionId||state.identity!==identity||state.tool!==message.toolName){send({ok:false,code:'NATIVE_SESSION_CHANGED'});return true;}
 if(state.inflight.has(message.requestId)||state.inflight.size>=16||(['prepare','propose'].includes(message.body?.action)&&(state.sources.size>=4096||state.plans.size>=4096))){send({ok:false,code:'NATIVE_REQUEST_BUSY'});return true;}
 const body=message.body;
 if(!body||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)){send({ok:false,code:'INVALID_NATIVE_REQUEST'});return true;}
 if(body.action==='execute'&&!state.sources.has(body.payload.sourceId)||body.action==='presented'&&!state.plans.has(body.payload.planId)){send({ok:false,code:'NATIVE_CONNECTION_CHANGED'});return true;}
 if(body.action==='execute')state.sources.delete(body.payload.sourceId);
 if(body.action==='presented')state.plans.delete(body.payload.planId);
 const original=body.payload.conversationId;
 const payload={...body.payload};
 if(original!==undefined){if(typeof original!=='string'||!original||original.length>240){send({ok:false,code:'CONVERSATION_REQUIRED'});return true;}
  payload.conversationId=createHash('sha256').update(JSON.stringify([ws.serverId,original])).digest('hex');}
 state.inflight.add(message.requestId);
 try{
  const namespace=createHash('sha256').update(message.sessionId).digest('hex');
  const result=await executeNativeRequest(pluginManager,message.toolName,message.authorization,{...body,payload},namespace);
  if(result.sourceId)state.sources.add(result.sourceId);
  if(result.plan){state.plans.add(result.plan.id);result.plan={...result.plan,conversationId:original};}
  send(result);
 }catch{send({ok:false,code:'NATIVE_RESULT_UNKNOWN'});}finally{state.inflight.delete(message.requestId);}
 return true;
}
module.exports={handleNativeConversationMessage};
