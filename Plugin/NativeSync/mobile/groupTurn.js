'use strict';
const {sha256,stable}=require('../sync/protocol');
const {envelopeFor}=require('../sync/metadata');
const {groupRequest}=require('./groupRequest');
const {nativeResponse}=require('./nativeResponse');
const nativeContext=require('../../../modules/requestExecutionContext');
const {resolveGroupChatUrl}=require('../nativeRules/Groupmodules/groupChatUrl');
const {withWatchdogNote}=require('../nativeRules/Groupmodules/streamWatchdog');
const modes={sequential:require('../nativeRules/Groupmodules/modes/sequentialMode'),naturerandom:require('../nativeRules/Groupmodules/modes/natureRandomMode'),invite_only:require('../nativeRules/Groupmodules/modes/inviteOnlyMode')};
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
const isGroup=row=>row?.kind==='group_message'||row?.kind==='group_invitation';

function schema(engine){
 const db=engine.db,columns=db.prepare('PRAGMA table_info(mobile_executions)').all();
 for(const [name,type]of [['kind','TEXT'],['terminal_state',"TEXT NOT NULL DEFAULT 'completed'"],['group_plan','TEXT'],['anchor_message_id','TEXT'],['group_position','INTEGER NOT NULL DEFAULT 0'],['review_resolved','INTEGER NOT NULL DEFAULT 0']])if(!columns.some(c=>c.name===name))db.exec('ALTER TABLE mobile_executions ADD COLUMN '+name+' '+type);
 db.exec(`CREATE TABLE IF NOT EXISTS mobile_execution_steps(id TEXT PRIMARY KEY,job_id TEXT NOT NULL,step_index INTEGER NOT NULL,agent_id TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,pending_operation TEXT,reply_message_id TEXT,error_code TEXT,terminal_state TEXT NOT NULL DEFAULT 'completed',tool_started INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(job_id,step_index));CREATE INDEX IF NOT EXISTS idx_mobile_steps_job ON mobile_execution_steps(job_id,step_index);`);
 db.exec('CREATE INDEX IF NOT EXISTS idx_mobile_executions_topic_state ON mobile_executions(topic_key,state)');
 engine.nativeWaiters=new Map();
}
function held(engine,key){return engine.db.prepare("SELECT id FROM mobile_executions WHERE topic_key=? AND kind IN ('group_message','group_invitation') AND (state IN ('review_required','recovering','blocked_config') OR (review_resolved=0 AND error_code LIKE '%REVIEW_REQUIRED')) LIMIT 1").get(key);}
function steps(engine,id){return engine.db.prepare('SELECT * FROM mobile_execution_steps WHERE job_id=? ORDER BY step_index').all(id);}
function step(engine,id){return engine.db.prepare('SELECT * FROM mobile_execution_steps WHERE id=?').get(id);}

function accept(engine,sessionId,input,invitation=false){
 const {topicKey,requestId,text='',attachments=[],agentId}=input,topic=engine.topics.get(topicKey);
 if(!topic||topic.ownerType!=='group')throw fail('TOPIC_NOT_ALLOWED',403);
 if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)||!Array.isArray(attachments)||attachments.length>8||attachments.some(id=>typeof id!=='string')||typeof text!=='string'||text.length>12000||(!invitation&&!text.trim()&&!attachments.length)||(invitation&&(typeof agentId!=='string'||!agentId)))throw fail('INVALID_GROUP_SUBMISSION',400);
 const kind=invitation?'group_invitation':'group_message',id='job_'+sha256(sessionId+'\0'+requestId).slice(0,32),requestHash=sha256(stable({kind,topicKey,...(invitation?{agentId}:{text,attachments})}));
 const prior=engine.get(id);if(prior){if(prior.request_hash!==requestHash)throw fail('REQUEST_ID_REUSED');if(prior.state==='preparing')engine.completeIntent(prior);return {...engine.public(engine.get(id),sessionId),replayed:true};}
 if(held(engine,topicKey))throw fail('DEPENDENCY_REVIEW_REQUIRED');
 if(engine.db.prepare('SELECT count(*) AS n FROM mobile_executions WHERE session_id=? AND created_at>?').get(sessionId,Date.now()-60000).n>=20)throw fail('SUBMISSION_RATE_LIMIT',429);
 const config=engine.configs.snapshot(topic);if(!config?.group)throw fail('EXECUTION_CONFIG_REQUIRED');
 if(!modes[config.group.mode])throw fail('GROUP_MODE_REQUIRES_DESKTOP');
 const records=engine.db.prepare('SELECT * FROM messages WHERE owner_type=? AND owner_id=? AND topic_id=? AND deleted=0 ORDER BY last_seq').all(topic.ownerType,topic.ownerId,topic.topicId);
 const history=records.map(r=>engine.store.projectMessage(r)).sort((a,b)=>a.timestamp-b.timestamp).filter(m=>!m.isThinking);
 const now=Date.now(),msgId=invitation?'invite_'+id:'mobile_'+id;
 const files=attachments.length?(engine.attachments?engine.attachments.claim('mobile:'+sessionId,topicKey,attachments):(()=>{throw fail('ATTACHMENTS_NOT_ENABLED');})()):[];
 const message={id:msgId,role:'user',name:config.executionPolicy?.userName||'用户',content:text,timestamp:now,...(files.length?{attachments:files}:{})};
 const active=config.group.members.map(id=>config.agents.find(a=>a.id===id&&!a.unavailable)).filter(Boolean);
 const plan=invitation?[active.find(a=>a.id===agentId)]:modes[config.group.mode].determineSpeakers(active,[...history,message],config.group,message,{isAborted:()=>false});
 if(plan.some(a=>!a))throw fail('GROUP_MEMBER_UNAVAILABLE',403);
 const selected=plan.map(a=>a.id),previous=engine.db.prepare("SELECT user_message_id,anchor_message_id FROM mobile_executions WHERE topic_key=? AND kind IN ('group_message','group_invitation') ORDER BY rowid DESC LIMIT 1").get(topicKey);
 const anchor=invitation?(previous?.anchor_message_id||previous?.user_message_id||history.at(-1)?.id||null):msgId;
 const op=invitation?null:{ownerType:topic.ownerType,ownerId:topic.ownerId,topicId:topic.topicId,msgId,deviceId:'mobile:'+sessionId,opId:'submit:'+id,action:'upsert',baseHash:null,message,...(files.length?{metadata:envelopeFor(message,1)}:{})};
 const head=engine.store.metrics().headSeq,state=invitation?(selected.length?'queued':'completed'):'preparing';
 engine.db.exec('BEGIN IMMEDIATE');
 try{
  engine.db.prepare('INSERT INTO mobile_executions(id,session_id,request_id,topic_key,request_hash,user_message_id,user_seq,state,pending_operation,created_at,updated_at,not_before,config_snapshot,request_payload,kind,group_plan,anchor_message_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,sessionId,requestId,topicKey,requestHash,msgId,invitation?head:null,state,op?JSON.stringify(op):null,now,now,now+engine.startDelayMs,JSON.stringify(config),JSON.stringify(invitation?{requestId,agentId}:{requestId,text,...(attachments.length?{attachments}:{})}),kind,JSON.stringify(selected),anchor);
  for(const [index,member]of selected.entries()){const stepId='gstep_'+sha256(id+'\0'+index).slice(0,40);engine.db.prepare("INSERT INTO mobile_execution_steps(id,job_id,step_index,agent_id,state,created_at,updated_at) VALUES(?,?,?,?,'queued',?,?)").run(stepId,id,index,member,now,now);}
  if(files.length)engine.attachments.bindExecution('mobile:'+sessionId,topicKey,attachments,id,msgId);
  engine.db.exec('COMMIT');
 }catch(e){engine.db.exec('ROLLBACK');throw e;}
 engine.fault('group-accepted-intent');if(op)engine.completeIntent(engine.get(id));else engine.wake();
 return {...engine.public(engine.get(id),sessionId),replayed:false};
}

function completeStep(engine,row){
 const op=JSON.parse(row.pending_operation);engine.store.apply(op);engine.fault('group-step-applied');
 const now=Date.now(),terminal=row.terminal_state||'completed';
 engine.db.exec('BEGIN IMMEDIATE');try{
  engine.db.prepare('UPDATE mobile_execution_steps SET state=?,pending_operation=NULL,reply_message_id=?,updated_at=? WHERE id=?').run(terminal,op.msgId,now,row.id);
  engine.db.prepare('UPDATE mobile_executions SET group_position=?,reply_message_id=?,updated_at=? WHERE id=?').run(row.step_index+1,op.msgId,now,row.job_id);
  if(terminal!=='completed')engine.db.prepare('UPDATE mobile_executions SET state=?,error_code=?,updated_at=? WHERE id=?').run(terminal==='cancelled'?'cancelled':'review_required',row.error_code,now,row.job_id);
  engine.db.exec('COMMIT');
 }catch(e){engine.db.exec('ROLLBACK');throw e;}
}
function publish(engine,row,member,content,code=null,terminal='completed'){
 const job=engine.get(row.job_id),topic=engine.topics.get(job.topic_key),msgId='reply_'+row.id;
 const op={ownerType:'group',ownerId:topic.ownerId,topicId:topic.topicId,msgId,deviceId:'server:native-execution',opId:'reply:'+row.id,action:'upsert',baseHash:null,message:{id:msgId,role:'assistant',name:member.name||member.id,agentId:member.id,groupId:topic.ownerId,topicId:topic.topicId,isGroupMessage:true,content,timestamp:Date.now(),...(terminal!=='completed'?{finishReason:'interrupted'}:{})}};
 engine.db.prepare("UPDATE mobile_execution_steps SET state='publishing',pending_operation=?,terminal_state=?,error_code=?,updated_at=? WHERE id=?").run(JSON.stringify(op),terminal,code,Date.now(),row.id);
 engine.fault('group-step-intent');completeStep(engine,step(engine,row.id));
}
function recover(engine){
 for(const row of engine.db.prepare("SELECT * FROM mobile_execution_steps WHERE state='publishing' ORDER BY created_at,step_index").all())completeStep(engine,row);
 for(const job of engine.db.prepare("SELECT * FROM mobile_executions WHERE kind IN ('group_message','group_invitation') AND state NOT IN ('completed','cancelled')").all()){
  const all=steps(engine,job.id),uncertain=all.filter(s=>['running','waiting_approval','interrupted'].includes(s.state));
  if(uncertain.length){for(const s of uncertain)engine.db.prepare("UPDATE mobile_execution_steps SET state='interrupted',error_code=coalesce(error_code,'EXECUTION_INTERRUPTED_REVIEW_REQUIRED'),updated_at=? WHERE id=?").run(Date.now(),s.id);engine.db.prepare("UPDATE mobile_executions SET state='review_required',error_code='EXECUTION_INTERRUPTED_REVIEW_REQUIRED',updated_at=? WHERE id=?").run(Date.now(),job.id);continue;}
  if(job.cancel_requested){engine.db.prepare("UPDATE mobile_execution_steps SET state='cancelled' WHERE job_id=? AND state='queued'").run(job.id);engine.db.prepare("UPDATE mobile_executions SET state='cancelled' WHERE id=?").run(job.id);continue;}
  if(all.every(s=>s.state==='completed'))engine.db.prepare("UPDATE mobile_executions SET state='completed',error_code=NULL WHERE id=?").run(job.id);
  else if(all.some(s=>s.state==='queued'))engine.db.prepare("UPDATE mobile_executions SET state='queued',error_code=NULL WHERE id=?").run(job.id);
 }
}

function history(engine,job){
 const topic=engine.topics.get(job.topic_key),prior=engine.db.prepare("SELECT rowid AS ordinal,* FROM mobile_executions WHERE topic_key=? AND kind IN ('group_message','group_invitation') AND rowid<=? ORDER BY rowid").all(job.topic_key,job.ordinal);
 const replies=new Map();for(const p of prior)replies.set(p.id,steps(engine,p.id).filter(s=>s.reply_message_id).map(s=>s.reply_message_id));
 const ids=[...replies.values()].flat();
 const records=engine.db.prepare(`SELECT * FROM (SELECT *,row_number() OVER(PARTITION BY msg_id ORDER BY seq DESC) AS r FROM journal WHERE owner_type=? AND owner_id=? AND topic_id=? AND (seq<=? OR msg_id IN (SELECT value FROM json_each(?)))) WHERE r=1 AND action='upsert' ORDER BY seq`).all(topic.ownerType,topic.ownerId,topic.topicId,job.user_seq,JSON.stringify(ids));
 const source=records.map(r=>engine.store.projectMessage(r)).sort((a,b)=>a.timestamp-b.timestamp),byId=new Map(source.map(m=>[m.id,m])),after=new Map(),relocated=new Set();
 for(const p of prior){const anchor=p.anchor_message_id||p.user_message_id;if(!after.has(anchor))after.set(anchor,[]);for(const id of replies.get(p.id)||[])if(byId.has(id)){after.get(anchor).push(byId.get(id));relocated.add(id);}}
 const ordered=[];for(const m of source)if(!relocated.has(m.id)){ordered.push(m);if(after.has(m.id))ordered.push(...after.get(m.id));}
 for(const [anchor,items]of after)if(!byId.has(anchor))ordered.push(...items);
 return ordered;
}

function observe(engine){
 if(engine.nativeObservers)return;
 const approval=data=>{const waiter=engine.nativeWaiters.get(data.requestId);if(!waiter)return;waiter.setter?.(data.waiting);const row=waiter.stepId?step(engine,waiter.stepId):null;
  if(row)engine.db.prepare("UPDATE mobile_execution_steps SET state=?,updated_at=? WHERE id=? AND state IN ('running','waiting_approval')").run(data.waiting?'waiting_approval':'running',Date.now(),row.id);
  engine.db.prepare("UPDATE mobile_executions SET state=CASE WHEN cancel_requested=1 THEN 'cancelling' ELSE ? END,updated_at=? WHERE id=? AND state IN ('running','waiting_approval','cancelling')").run(data.waiting?'waiting_approval':'running',Date.now(),waiter.jobId);
 };
 const tool=data=>{const waiter=engine.nativeWaiters.get(data.requestId);if(waiter?.stepId)engine.db.prepare('UPDATE mobile_execution_steps SET tool_started=1 WHERE id=?').run(waiter.stepId);};
 nativeContext.events.on('approval',approval);nativeContext.events.on('tool',tool);engine.nativeObservers=()=>{nativeContext.events.off('approval',approval);nativeContext.events.off('tool',tool);};
}

async function run(engine,initial){
 if(!engine.db.prepare("UPDATE mobile_executions SET state='running',attempts=attempts+1,updated_at=? WHERE id=? AND state='queued'").run(Date.now(),initial.id).changes)return;
 const controller=new AbortController();engine.active.set(initial.id,controller);let release;
 try{
  const job=engine.get(initial.id),topic=engine.topics.get(job.topic_key),config=engine.configs.verify(topic,JSON.parse(job.config_snapshot)),plan=JSON.parse(job.group_plan);
  for(const candidate of steps(engine,job.id)){
   if(candidate.state==='completed')continue;
   if(engine.draining)throw fail('EXECUTION_INTERRUPTED_REVIEW_REQUIRED');
   if(engine.get(job.id).cancel_requested)break;
   if(candidate.state!=='queued'||plan[candidate.step_index]!==candidate.agent_id)throw fail('GROUP_PLAN_REVIEW_REQUIRED');
   const member=config.agents.find(a=>a.id===candidate.agent_id&&!a.unavailable);if(!member||!engine.agentManager.isAgent(member.agentAlias))throw fail('EXECUTION_CONFIG_IDENTITY_MISMATCH');
   // Request construction cannot call a model or a tool. A failure remains a
   // visible blocked step; filtering never falls open to unfiltered content.
   let prepared;
   try{prepared=await groupRequest({topic,config,member,history:history(engine,job),currentUserId:job.kind==='group_message'?job.user_message_id:null,requestId:candidate.id,store:engine.store,attachments:engine.attachments,seq:job.user_seq});}
   catch(e){if(e.code==='MODEL_IMAGE_UNSUPPORTED'){publish(engine,candidate,member,'[System Message] 当前成员模型不支持本轮图片内容。',e.code);continue;}throw e;}
   if(engine.get(job.id).cancel_requested||engine.draining)break;
   engine.db.prepare("UPDATE mobile_execution_steps SET state='running',attempts=attempts+1,updated_at=? WHERE id=? AND state='queued'").run(Date.now(),candidate.id);
   release=nativeContext.register(candidate.id,member);engine.fault('group-step-running');
   try{
    const endpoint={...engine.endpoint,url:resolveGroupChatUrl(engine.endpoint.url,config.executionPolicy?.enableVcpToolInjection)};
    const result=await nativeResponse({endpoint,body:prepared.body,controller,headerTimeoutMs:engine.executionTimeoutMs,idleTimeoutMs:engine.groupIdleTimeoutMs||62000,onWaiting:setter=>{if(setter)engine.nativeWaiters.set(candidate.id,{jobId:job.id,stepId:candidate.id,setter});else engine.nativeWaiters.delete(candidate.id);}});
    if(engine.draining)throw fail('EXECUTION_INTERRUPTED_REVIEW_REQUIRED');
    if(engine.get(job.id).cancel_requested)throw fail('EXECUTION_CANCELLED');
    if(result.modelError){if(step(engine,candidate.id).tool_started)throw Object.assign(fail('EXECUTION_INTERRUPTED_REVIEW_REQUIRED'),{partialContent:result.content||''});const notice=`[System Message] VCP request failed: ${result.httpStatus} - Server returned status ${result.httpStatus}`;publish(engine,candidate,member,(result.content?result.content+'\n\n':'')+notice,'MODEL_HTTP_'+result.httpStatus);}
    else publish(engine,candidate,member,result.content);
   }catch(e){
    const current=step(engine,candidate.id);if(current.state==='publishing'){engine.db.prepare("UPDATE mobile_executions SET state='recovering' WHERE id=?").run(job.id);return;}
    const cancelled=Boolean(engine.get(job.id).cancel_requested),code=cancelled?(current.tool_started?'EXECUTION_CANCELLED_REVIEW_REQUIRED':'EXECUTION_CANCELLED'):(e.code||'EXECUTION_INTERRUPTED_REVIEW_REQUIRED');
    if(e.partialContent){const text=code==='STREAM_IDLE_TIMEOUT_REVIEW_REQUIRED'?withWatchdogNote(e.partialContent,engine.groupIdleTimeoutMs||62000):e.partialContent+'\n\n[System Message] 本步已中断，后续接力暂停；系统不会自动重跑不确定执行。';publish(engine,current,member,text,code,cancelled?'cancelled':'interrupted');}
    else {engine.db.prepare('UPDATE mobile_execution_steps SET state=?,error_code=?,updated_at=? WHERE id=?').run(cancelled?'cancelled':'interrupted',code,Date.now(),current.id);engine.db.prepare('UPDATE mobile_executions SET state=?,error_code=?,updated_at=? WHERE id=?').run(cancelled?'cancelled':'review_required',code,Date.now(),job.id);}
    return;
   }finally{release?.();release=null;engine.nativeWaiters.delete(candidate.id);}
  }
  const cancelled=Boolean(engine.get(initial.id).cancel_requested);if(cancelled)engine.db.prepare("UPDATE mobile_execution_steps SET state='cancelled' WHERE job_id=? AND state='queued'").run(initial.id);
  engine.db.prepare('UPDATE mobile_executions SET state=?,updated_at=? WHERE id=?').run(cancelled?'cancelled':'completed',Date.now(),initial.id);
 }catch(e){
  const all=steps(engine,initial.id),uncertain=all.filter(s=>['running','waiting_approval','interrupted'].includes(s.state));
  if(uncertain.length){for(const row of uncertain)engine.db.prepare("UPDATE mobile_execution_steps SET state='interrupted',error_code='EXECUTION_INTERRUPTED_REVIEW_REQUIRED',updated_at=? WHERE id=?").run(Date.now(),row.id);engine.db.prepare("UPDATE mobile_executions SET state='review_required',error_code='EXECUTION_INTERRUPTED_REVIEW_REQUIRED',updated_at=? WHERE id=?").run(Date.now(),initial.id);}
  else if(all.some(s=>s.state==='publishing'))engine.db.prepare("UPDATE mobile_executions SET state='recovering',error_code='PUBLISH_INTENT_PENDING',updated_at=? WHERE id=?").run(Date.now(),initial.id);
  else if(engine.draining)engine.db.prepare("UPDATE mobile_executions SET state='queued',error_code=NULL,updated_at=? WHERE id=?").run(Date.now(),initial.id);
  else engine.db.prepare("UPDATE mobile_executions SET state='blocked_config',error_code=?,updated_at=? WHERE id=?").run(e.code||'GROUP_CONTEXT_UNAVAILABLE',Date.now(),initial.id);
 }
 finally{release?.();engine.active.delete(initial.id);}
}

function cancel(engine,id,sessionId){
 let row=engine.get(id);if(!row||row.session_id!==sessionId)throw fail('EXECUTION_NOT_FOUND',404);if(row.state==='preparing'){engine.completeIntent(row);row=engine.get(id);}
 if(['completed','recovering'].includes(row.state))throw fail('EXECUTION_ALREADY_TERMINAL');
 engine.db.prepare("UPDATE mobile_executions SET cancel_requested=1,state=CASE WHEN state IN ('running','waiting_approval') THEN 'cancelling' ELSE 'cancelled' END,updated_at=? WHERE id=?").run(Date.now(),id);
 engine.db.prepare("UPDATE mobile_execution_steps SET state='cancelled' WHERE job_id=? AND state='queued'").run(id);engine.active.get(id)?.abort();return engine.public(engine.get(id),sessionId);
}
function resolve(engine,id,sessionId,action){
 const row=engine.get(id);if(!row||row.session_id!==sessionId||!isGroup(row))throw fail('EXECUTION_NOT_FOUND',404);
 if(action!=='acknowledge_and_abandon_remaining'||!(['review_required','blocked_config'].includes(row.state)||(row.state==='cancelled'&&!row.review_resolved&&row.error_code?.endsWith('REVIEW_REQUIRED'))))throw fail('INVALID_REVIEW_RESOLUTION');
 engine.db.exec('BEGIN IMMEDIATE');try{
  engine.db.prepare("UPDATE mobile_executions SET state='cancelled',cancel_requested=1,review_resolved=1,updated_at=? WHERE id=?").run(Date.now(),id);
  engine.db.prepare("UPDATE mobile_execution_steps SET state='cancelled' WHERE job_id=? AND state='queued'").run(id);
  engine.db.exec('COMMIT');
 }catch(e){engine.db.exec('ROLLBACK');throw e;}engine.wake();return engine.public(engine.get(id),sessionId);
}
function publicState(engine,row){
 const config=JSON.parse(row.config_snapshot),all=steps(engine,row.id);
 return {kind:row.kind,groupMode:config.group.mode,stepCount:all.length,position:row.group_position,reviewResolved:Boolean(row.review_resolved),steps:all.map(s=>({id:s.id,index:s.step_index,agentId:s.agent_id,name:config.agents.find(a=>a.id===s.agent_id)?.name||s.agent_id,state:s.state,attempts:s.attempts,replyMessageId:s.reply_message_id,errorCode:s.error_code}))};
}
module.exports={schema,isGroup,held,accept,completeStep,recover,history,observe,run,cancel,resolve,publicState,steps};
