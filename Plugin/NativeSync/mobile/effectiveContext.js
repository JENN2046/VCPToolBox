'use strict';
const {effectiveContextHistory,isContextCheckpoint}=require('../nativeRules/modules/chat/contextCompactionState');
const {attachTimestampMetadata}=require('../nativeRules/modules/chat/requestMetadata');
const {stripHiddenToolResults}=require('../nativeRules/modules/renderer/toolResultRegions');
const tavern=require('../nativeRules/modules/tavernRulesEngine');

// IO is supplied by the CAS adapter; context selection and Tavern semantics
// remain the author's locally deployed pure rules.
async function effectiveRequest(history,config,currentId,buildContent=async m=>[{type:'text',text:stripHiddenToolResults(m.content)}]){
    const rules=config.tavernRules||[],messages=[];
    for(const message of effectiveContextHistory(history)){
        const checkpoint=isContextCheckpoint(message);
        let content=checkpoint?[{type:'text',text:message.content}]:await buildContent(message);
        if(!checkpoint&&message.role==='user'&&message.id===currentId)content=content.map((p,i)=>i===0&&p.type==='text'?{...p,text:tavern.applyUserSuffix(p.text,rules,'agent')}:p);
        messages.push(attachTimestampMetadata({role:message.role,content,...(checkpoint?{__vcpContextCheckpoint:true}:{}),...(message.name?{name:message.name}:{}),...(message.tool_calls?{tool_calls:message.tool_calls}:{}),...(message.tool_call_id?{tool_call_id:message.tool_call_id}:{})},message));
    }
    const prompt=tavern.applySystemSuffix(config.systemPrompt,rules,'agent');
    const injected=tavern.applyContextInject(messages,rules,'agent',{makeMessage:(role,text)=>({role,content:[{type:'text',text}],__tavernInjected:true})});
    return [...(prompt.trim()?[{role:'system',content:prompt}]:[]),...injected];
}
module.exports={effectiveRequest};
