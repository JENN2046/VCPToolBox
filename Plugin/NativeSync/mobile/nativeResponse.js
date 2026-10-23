'use strict';
const {groupStreamDelta}=require('../nativeRules/Groupmodules/streamDelta');
const MAX_OUTPUT=4*1024*1024;
const error=(code,partialContent='')=>Object.assign(new Error(code),{code,partialContent});

// Transport framing only. Model routing, RAG, tool execution and approval remain
// in the existing native HTTP handler. Never persist raw provider error bodies.
async function nativeResponse({endpoint,body,controller,headerTimeoutMs=120000,idleTimeoutMs=62000,onWaiting}){
 let timer,phase='headers',partial='',waiting=false,timedOut=null;
 const arm=()=>{clearTimeout(timer);if(!waiting)timer=setTimeout(()=>{timedOut=phase==='headers'?'RESPONSE_HEADER_TIMEOUT_REVIEW_REQUIRED':'STREAM_IDLE_TIMEOUT_REVIEW_REQUIRED';controller.abort();},phase==='headers'?headerTimeoutMs:idleTimeoutMs);};
 const setWaiting=value=>{waiting=value;arm();};onWaiting?.(setWaiting);arm();
 try{
  const response=await fetch(endpoint.url,{method:'POST',headers:{Authorization:`Bearer ${endpoint.key}`,'Content-Type':'application/json'},redirect:'error',signal:controller.signal,body:JSON.stringify(body)});
  if(!response.ok){const status=response.status;try{await response.body?.cancel();}catch{}return {modelError:true,httpStatus:status,content:''};}
  phase='body';arm();
  const type=response.headers.get('content-type')||'';
  if(!body.stream||!type.includes('text/event-stream')){
   let raw='';const decoder=new TextDecoder();for await(const chunk of response.body){arm();raw+=decoder.decode(chunk,{stream:true});if(Buffer.byteLength(raw)>MAX_OUTPUT)throw error('MODEL_RESPONSE_BUDGET_REVIEW_REQUIRED');}raw+=decoder.decode();
   const result=JSON.parse(raw),content=result.choices?.[0]?.message?.content;
   if(typeof content!=='string'||!content)throw error('INVALID_MODEL_RESULT_REVIEW_REQUIRED');return {content};
  }
  const decoder=new TextDecoder(),read=response.body.getReader();let buffer='',done=false,finish=false,malformed=false;
  const frame=text=>{
   const data=text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n').trim();
   if(!data)return;if(data==='[DONE]'){done=true;return;}
   let value;try{value=JSON.parse(data);}catch{malformed=true;return;}if(!value||typeof value!=='object'){malformed=true;return;}
   if(value.error){const status=Number(value.error.status||value.error.code);if(Number.isInteger(status)&&status>=400&&status<=599)throw Object.assign(error('MODEL_HTTP_ERROR',partial),{httpStatus:status});throw error('MODEL_STREAM_ERROR_REVIEW_REQUIRED',partial);}
   partial+=groupStreamDelta(value);if(value.choices?.[0]?.finish_reason)finish=true;
   if(Buffer.byteLength(partial)>MAX_OUTPUT)throw error('MODEL_RESPONSE_BUDGET_REVIEW_REQUIRED',Buffer.from(partial).subarray(0,MAX_OUTPUT).toString('utf8').replace(/\uFFFD$/,''));
  };
  while(true){const result=await read.read();if(result.done){buffer+=decoder.decode();break;}arm();buffer+=decoder.decode(result.value,{stream:true});let match;while((match=/\r?\n\r?\n/.exec(buffer))){frame(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}if(done)break;if(buffer.length>MAX_OUTPUT)throw error('STREAM_MALFORMED_REVIEW_REQUIRED',partial);}
  if(done)await read.cancel();else if(buffer.trim())frame(buffer);if(malformed||(!done&&!finish))throw error('STREAM_INCOMPLETE_REVIEW_REQUIRED',partial);
  if(!partial)throw error('INVALID_MODEL_RESULT_REVIEW_REQUIRED');return {content:partial};
 }catch(e){
  if(timedOut)throw error(timedOut,partial);
  if(e.code==='MODEL_HTTP_ERROR')return {modelError:true,httpStatus:e.httpStatus,content:e.partialContent||''};
  if(e.code)throw Object.assign(e,{partialContent:e.partialContent||partial});
  throw error(controller.signal.aborted?'EXECUTION_INTERRUPTED_REVIEW_REQUIRED':'MODEL_TRANSPORT_REVIEW_REQUIRED',partial);
 }finally{clearTimeout(timer);onWaiting?.(null);}
}
module.exports={nativeResponse};
