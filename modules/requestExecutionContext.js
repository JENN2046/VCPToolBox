'use strict';
const {AsyncLocalStorage}=require('node:async_hooks'),{EventEmitter}=require('node:events');
const local=new AsyncLocalStorage(),events=new EventEmitter(),registered=new Map();
function note(type,data){const context=local.getStore();if(!context)return;try{events.emit(type,{requestId:context.requestId,...data});}catch{console.warn('[NativeExecution] OBSERVER_FAILED');}}
function cancellation(){return Object.assign(new Error('NATIVE_EXECUTION_CANCELLED'),{code:'NATIVE_EXECUTION_CANCELLED',name:'AbortError'});}
function throwIfCancelled(){if(local.getStore()?.signal.aborted)throw cancellation();}
function middleware(req,res,next){
 const requestId=req.body?.requestId,snapshot=registered.get(requestId);if(!snapshot)return next();
 const controller=new AbortController(),abort=()=>{if(!res.writableEnded)controller.abort();};req.once('aborted',abort);res.once('close',abort);
 res.once('finish',()=>{req.removeListener('aborted',abort);res.removeListener('close',abort);});
 return local.run({requestId,signal:controller.signal,...snapshot},next);
}
async function waitForApproval(promise,onCancel){
 const context=local.getStore();if(!context)return promise;
 throwIfCancelled();note('approval',{waiting:true});let abort;
 const cancelled=new Promise((_resolve,reject)=>{abort=()=>{try{onCancel?.();}finally{reject(cancellation());}};context.signal.addEventListener('abort',abort,{once:true});});
 try {const result=await Promise.race([promise,cancelled]);throwIfCancelled();return result;}
 finally {context.signal.removeEventListener('abort',abort);note('approval',{waiting:false});}
}
function register(requestId,config){
 if(typeof requestId!=='string'||registered.has(requestId))throw new Error('NATIVE_EXECUTION_CONTEXT_CONFLICT');
 registered.set(requestId,config?.promptPolicy==='native-alias-snapshot'?{agentAlias:config.agentAlias,agentPrompt:config.systemPrompt}:{});
 return ()=>registered.delete(requestId);
}
function agentPrompt(alias){const ctx=local.getStore();return ctx&&ctx.agentAlias===alias?ctx.agentPrompt:undefined;}
module.exports={middleware,events,waitForApproval,throwIfCancelled,register,agentPrompt,toolStarted:()=>note('tool',{started:true}),run:(requestId,signal,fn)=>local.run({requestId,signal,...registered.get(requestId)},fn)};
