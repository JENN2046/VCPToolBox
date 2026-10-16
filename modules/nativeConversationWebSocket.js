'use strict';
const {createHash}=require('node:crypto');
const {executeNativeRequest,validateNativeRequest}=require('./nativeConversationTransport');
const connections=new WeakMap(),activeSessions=new Map();
function releaseClosedSession(ws,state){
 if(!state.closed||state.inflight.size)return;
 if(activeSessions.get(state.key)===ws)activeSessions.delete(state.key);
 if(connections.get(ws)===state)connections.delete(ws);
}
// Called by the host's single 60s heartbeat: one further tick without pong ends
// the transport, not the request. Only close + settled inflight releases a session.
function heartbeatNativeConversation(ws){
 const state=connections.get(ws);
 if(!state)return false;
 if(state.closed||ws.readyState!==1)return true;
 if(state.awaitingPong){ws.terminate();return true;}
 state.awaitingPong=true;
 try{ws.ping();}catch{ws.terminate();}
 return true;
}
// Session is a correlation namespace, never an identity or an authorization token.
async function handleNativeConversationMessage(ws,message,pluginManager,rawMessageBytes){
 if(message?.type!=='native_conversation_request')return false;
 const send=result=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'native_conversation_response',requestId:message.requestId,result}));};
 if(ws.clientType!=='DistributedServer'||!ws.serverId||ws.readyState!==1)return true;
 if(typeof message.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(message.requestId)||typeof message.sessionId!=='string'||!/^[a-f0-9-]{36}$/.test(message.sessionId)||typeof message.toolName!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(message.toolName)||!Number.isSafeInteger(rawMessageBytes)||rawMessageBytes<0||rawMessageBytes>40000){send({ok:false,code:'INVALID_NATIVE_REQUEST'});return true;}
 let state=connections.get(ws),registered=false;
 try{
  const body=message.body;
  if(!body||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload)){send({ok:false,code:'INVALID_NATIVE_REQUEST'});return true;}
  const original=body.payload.conversationId;
  const payload={...body.payload};
  if(original!==undefined){if(typeof original!=='string'||!original||original.length>240){send({ok:false,code:'CONVERSATION_REQUIRED'});return true;}
   payload.conversationId=createHash('sha256').update(JSON.stringify([ws.serverId,original])).digest('hex');}
  const finalBody={...body,payload};
  const validation=validateNativeRequest(pluginManager,message.toolName,message.authorization,finalBody);
  if(validation.result){send(validation.result);return true;}
  if(Buffer.byteLength(JSON.stringify(finalBody))>32768){send({ok:false,code:'INVALID_NATIVE_REQUEST'});return true;}
  const identity=createHash('sha256').update(message.authorization).digest('hex');
  if(state&&(state.sessionId!==message.sessionId||state.identity!==identity||state.tool!==message.toolName)){send({ok:false,code:'NATIVE_SESSION_CHANGED'});return true;}
  if(state&&(state.inflight.has(message.requestId)||state.inflight.size>=16||(['prepare','propose'].includes(message.body?.action)&&(state.sources.size>=4096||state.plans.size>=4096)))){send({ok:false,code:'NATIVE_REQUEST_BUSY'});return true;}
  if(body.action==='execute'&&!state?.sources.has(payload.sourceId)||body.action==='presented'&&!state?.plans.has(payload.planId)){send({ok:false,code:'NATIVE_CONNECTION_CHANGED'});return true;}
  if(!state){
   const key=createHash('sha256').update(JSON.stringify([message.sessionId,identity,message.toolName])).digest('hex');
   if(activeSessions.has(key)&&activeSessions.get(key)!==ws){send({ok:false,code:'NATIVE_SESSION_IN_USE'});return true;}
   state={key,closed:false,awaitingPong:false,sessionId:message.sessionId,identity,tool:message.toolName,inflight:new Set(),sources:new Set(),plans:new Set()};connections.set(ws,state);activeSessions.set(key,ws);
   const onPong=()=>{if(!state.closed)state.awaitingPong=false;};
   ws.on('pong',onPong);
   ws.once('close',()=>{state.closed=true;ws.off('pong',onPong);releaseClosedSession(ws,state);});
  }
  if(body.action==='execute')state.sources.delete(payload.sourceId);
  if(body.action==='presented')state.plans.delete(payload.planId);
  state.inflight.add(message.requestId);registered=true;
  const namespace=createHash('sha256').update(message.sessionId).digest('hex');
  const result=await executeNativeRequest(pluginManager,message.toolName,message.authorization,finalBody,namespace);
  if(result.sourceId)state.sources.add(result.sourceId);
  if(result.plan){state.plans.add(result.plan.id);result.plan={...result.plan,conversationId:original};}
  send(result);
 }catch{console.warn('[NativeConversation]',{code:'NATIVE_WEBSOCKET_FAILED'});send({ok:false,code:'NATIVE_RESULT_UNKNOWN'});}finally{if(registered){state.inflight.delete(message.requestId);releaseClosedSession(ws,state);}}
 return true;
}
module.exports={handleNativeConversationMessage,heartbeatNativeConversation};
