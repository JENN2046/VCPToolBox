'use strict';
const {selectGroupContextHistory}=require('../nativeRules/Groupmodules/groupContextWindow');
const {resolveEffectiveModel}=require('../nativeRules/Groupmodules/modelSelection');
const {attachTimestampMetadata}=require('../nativeRules/modules/chat/requestMetadata');
const sanitizer=require('../nativeRules/modules/contextSanitizer');
const tavern=require('../nativeRules/modules/tavernRulesEngine');
const {nativePacket}=require('./nativePacket');
const fail=code=>Object.assign(new Error(code),{code,status:409});
function assertPortableContext(messages){for(const message of messages){const texts=typeof message.content==='string'?[message.content]:(Array.isArray(message.content)?message.content.filter(p=>p.type==='text').map(p=>p.text):[]);if(texts.some(text=>/\{\{VCPChat(?:Canvas|WorkSpace)(?::[^{}]*)?\}\}/.test(text||'')))throw fail('DESKTOP_CONTEXT_REQUIRED');}}

function sanitize(messages,policy={},preserveCheckpoint=false){
 const mapText=(m,fn)=>preserveCheckpoint&&m.__vcpContextCheckpoint?m:{...m,content:typeof m.content==='string'?fn(m.content):Array.isArray(m.content)?m.content.map(p=>p.type==='text'&&typeof p.text==='string'?{...p,text:fn(p.text)}:p):m.content};
 if(policy.enableThoughtChainInjection!==true)messages=messages.map(m=>mapText(m,text=>sanitizer.stripThoughtChains(text)));
 if(preserveCheckpoint)messages=messages.map(m=>mapText(m,text=>sanitizer.stripHiddenToolResults(text)));
 if(policy.enableContextSanitizer===true){
  const systems=messages.filter(m=>m.role==='system'),others=messages.filter(m=>m.role!=='system');
  const converted=sanitizer.sanitizeMessages(others,policy.contextSanitizerDepth??2,policy.enableThoughtChainInjection===true);
  messages=[...systems,...converted.map((m,i)=>preserveCheckpoint&&others[i]?.__vcpContextCheckpoint?others[i]:m)];
 }
 return messages;
}
function watcher(topic,history,seq){
 const modified=Math.max(0,...history.map(m=>Number(m.updatedAt||m.timestamp)||0)),last=new Date(modified),now=new Date();
 return {status:'active',currentSession:{groupId:topic.ownerId,topicId:topic.topicId,filePath:null,storage:'NativeSyncJournal',seq,lastModified:last.toISOString(),lastModifiedDisplay:last.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai'}),modifiedTimestamp:modified,size:Buffer.byteLength(JSON.stringify(history)),messageCount:history.length},timestamp:now.toISOString(),displayTime:now.toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai'})};
}
async function groupRequest({topic,config,member,history,currentUserId,requestId,store,attachments,seq}){
 const group=config.group,policy=config.executionPolicy||{},rules=config.tavernRules||[],name=member.name||member.id;
 let prompt=member.promptPolicy==='native-alias-snapshot'?`{{agent:${member.agentAlias}}}`:(member.systemPrompt||`你是${name}。`);
 let groupPrompt=group.groupPrompt||'';
 if(groupPrompt.includes('{{VCPChatGroupSessionWatcher}}'))groupPrompt=groupPrompt.replaceAll('{{VCPChatGroupSessionWatcher}}',JSON.stringify(watcher(topic,history,seq)));
 if(groupPrompt)prompt+=`\n\n[群聊设定]:\n${groupPrompt}`;
 prompt=tavern.applySystemSuffix(prompt,rules,'group');
 const messages=[],budget={bytes:0};
 for(const message of selectGroupContextHistory(history.filter(m=>!m.isThinking),group)){
  if(typeof message.content!=='string')throw fail('TEXT_MESSAGES_REQUIRED');
  if(message.content.includes('{{VCPChatCanvas}}'))throw fail('DESKTOP_CONTEXT_REQUIRED');
  const speaker=message.name||(message.role==='user'?(policy.userName||'用户'):(config.agents.find(a=>a.id===message.agentId)?.name||'AI'));
  const projected={...message};
  let parts=[{type:'text',text:projected.content}];
  if(message.attachments?.length){if(!attachments)throw fail('ATTACHMENTS_NOT_ENABLED');const model=resolveEffectiveModel(group,member).effectiveModel;parts=await attachments.content(topic.key,projected,config.imageModels?.includes(model),budget);}
  if(message.id===currentUserId&&message.role==='user')parts[0]={...parts[0],text:tavern.applyUserSuffix(parts[0].text,rules,'group')};
  parts[0]={...parts[0],text:`[${speaker}的发言]: ${parts[0].text}`};
  messages.push(attachTimestampMetadata({role:message.role,content:parts},message));
 }
 const invite=(group.invitePrompt||'[系统邀请指令:] 现在轮到你 {{VCPChatAgentName}} 发言了。').replace(/{{VCPChatAgentName}}/g,name);
 messages.push({role:'user',content:[{type:'text',text:invite}],name:policy.userName||'用户'});
 const injected=tavern.applyContextInject(messages,rules,'group',{makeMessage:(role,text)=>({role,content:[{type:'text',text}]})});
 const prepared=sanitize([...(prompt.trim()?[{role:'system',content:prompt}]:[]),...injected],policy);
 assertPortableContext(prepared);
 const resolution=resolveEffectiveModel(group,member);
 if(!resolution.effectiveModel)throw fail('AGENT_NOT_CONFIGURED');
 // Match the native Group transport: unified model overrides only model;
 // temperature/output/stream remain the member's settings. Token trimming is
 // still the original ToolBox handler's responsibility.
 const params={model:resolution.effectiveModel,...(Number.isFinite(member.temperature)?{temperature:member.temperature}:{}),...(Number.isFinite(member.maxOutputTokens)?{max_tokens:member.maxOutputTokens}:{}),stream:member.streamOutput===true};
 return {body:nativePacket(prepared,{agentId:member.id,agentName:name,topicId:topic.topicId,isGroupMessage:true},requestId,params),resolution};
}
module.exports={groupRequest,sanitize,assertPortableContext};
