'use strict';
const { stable, sha256 } = require('../sync/protocol');
const fail = (code, status = 409) => Object.assign(new Error(code), { code, status });
const fields = ['name','systemPrompt','model','temperature','contextTokenLimit','maxOutputTokens','tavernRules','executionPolicy','streamOutput'];
const groupFields = ['name','members','mode','memberTags','groupPrompt','invitePrompt','useUnifiedModel','unifiedModel','enableContextMessageWindow','contextMessageWindowSize','tagMatchMode','createdAt','modeSettings','sequentialSpeakerOrder'];

// Private immutable execution inputs, not another Agent registry. Identity and
// alias authority remain the explicit host topic scope and native AgentManager.
class ExecutionConfigs {
    constructor(db, topics, agentManager, required = false) {
        this.db = db; this.topics = topics; this.agentManager = agentManager; this.required = required;
        db.exec(`CREATE TABLE IF NOT EXISTS owner_execution_configs(
            topic_key TEXT NOT NULL, version INTEGER NOT NULL, hash TEXT NOT NULL,
            config_json TEXT NOT NULL, created_at INTEGER NOT NULL,
            PRIMARY KEY(topic_key,version));`);
    }
    latest(key) { return this.db.prepare('SELECT * FROM owner_execution_configs WHERE topic_key=? ORDER BY version DESC LIMIT 1').get(key); }
    public(key) {
        const r=this.latest(key);if(!r)return {configVersion:null,configHash:null};
        try{const c=JSON.parse(r.config_json);return {configVersion:r.version,configHash:r.hash,model:c.model,...(c.group?{groupMode:c.group.mode,members:c.agents.map(a=>({id:a.id,name:a.name||a.id,model:a.model||null,unavailable:a.unavailable===true}))}:{})};}
        catch{return {configVersion:null,configHash:null,configError:'CONFIG_SNAPSHOT_CORRUPT'};}
    }
    async normalize(topic, input) {
        if (topic.ownerType === 'group') {
            if (!input || Object.keys(input).some(k=>!['group','agents','tavernRules','executionPolicy'].includes(k))) throw fail('INVALID_GROUP_CONFIG',400);
            const group=input.group;
            if (!group || Object.keys(group).some(k=>!groupFields.includes(k)) || typeof group.name!=='string' || !['sequential','naturerandom','invite_only','jev','game'].includes(group.mode) || !Array.isArray(group.members) || group.members.length>32 || new Set(group.members).size!==group.members.length || !Array.isArray(input.agents) || input.agents.length!==group.members.length || JSON.stringify(group).length>64000) throw fail('INVALID_GROUP_CONFIG',400);
            if(group.members.some(id=>typeof id!=='string'||!id||id.length>200))throw fail('INVALID_GROUP_CONFIG',400);
            for(const order of [group.modeSettings?.sequential?.speakerOrder,group.sequentialSpeakerOrder])if(order!==undefined&&(!Array.isArray(order)||order.length>1000||order.some(id=>typeof id!=='string')))throw fail('INVALID_GROUP_CONFIG',400);
            const agents=await Promise.all(group.members.map(async id=>{
                const value=input.agents.find(a=>a.id===id),alias=topic.memberAliases?.[id];
                if(value?.unavailable===true&&Object.keys(value).every(k=>['id','unavailable'].includes(k)))return {id,unavailable:true};
                if (!value || typeof alias!=='string' || !Object.hasOwn(topic.memberAliases||{},id)) throw fail('GROUP_MEMBER_NOT_AUTHORIZED',403);
                const {id:_,...config}=value;
                return {id,...await this.normalize({ownerType:'agent',agentAlias:alias,imageModels:topic.imageModels},config)};
            }));
            if (group.memberTags && (typeof group.memberTags!=='object'||Array.isArray(group.memberTags)||Object.entries(group.memberTags).some(([id,tags])=>!group.members.includes(id)||typeof tags!=='string'))) throw fail('INVALID_GROUP_CONFIG',400);
            if (group.useUnifiedModel && (typeof group.unifiedModel!=='string'||!group.unifiedModel.trim())) throw fail('INVALID_GROUP_CONFIG',400);
            if (this.hasAgentReference(group.groupPrompt||'').length || this.hasAgentReference(group.invitePrompt||'').length) throw fail('CONFIG_PROMPT_AUTHORITY_CONFLICT');
            return {name:group.name,group:JSON.parse(JSON.stringify(group)),agents,imageModels:Array.isArray(topic.imageModels)?topic.imageModels.filter(m=>typeof m==='string'):[],executionPolicy:this.policy(input.executionPolicy),tavernRules:this.rules(input.tavernRules),model:group.useUnifiedModel?group.unifiedModel:agents.find(a=>!a.unavailable)?.model||null,promptPolicy:'desktop'};
        }
        if (!input || Object.keys(input).some(k => !fields.includes(k)) || topic.ownerType !== 'agent') throw fail('INVALID_EXECUTION_CONFIG',400);
        if (!topic.agentAlias || !this.agentManager.isAgent(topic.agentAlias)) throw fail('AGENT_NOT_CONFIGURED');
        if (typeof input.name !== 'string' || !input.name || input.name.length > 200 || typeof input.systemPrompt !== 'string' || input.systemPrompt.length > 128000 || typeof input.model !== 'string' || !input.model.trim() || input.model.length > 200) throw fail('INVALID_EXECUTION_CONFIG',400);
        let prompt=input.systemPrompt.replace(/\{\{AgentName\}\}/g,input.name),promptPolicy='desktop',promptTemplate;
        const references=text=>this.hasAgentReference(text);
        const refs=references(prompt);
        if(refs.length){
            if(refs.some(reference=>reference[1]!==topic.agentAlias))throw fail('CONFIG_PROMPT_AUTHORITY_CONFLICT');
            promptTemplate=prompt;
            prompt=await this.agentManager.getAgentPrompt(topic.agentAlias);
            if(typeof prompt!=='string'||!prompt||references(prompt).length||prompt.startsWith('[AgentManager:')||prompt===input.systemPrompt)throw fail('CONFIG_PROMPT_SNAPSHOT_UNAVAILABLE');
            promptPolicy='native-alias-snapshot';
        }
        const value = {name:input.name,systemPrompt:prompt,...(promptTemplate?{promptTemplate}:{}),model:input.model.trim(),executionPolicy:this.policy(input.executionPolicy),streamOutput:input.streamOutput===true||input.streamOutput==='true',promptPolicy,agentAlias:topic.agentAlias,imageSupported:Array.isArray(topic.imageModels)&&topic.imageModels.includes(input.model),tavernRules:this.rules(input.tavernRules)};
        for (const [key,min,max] of [['temperature',0,2],['contextTokenLimit',1,2000000],['maxOutputTokens',1,2000000]]) {
            if (input[key] !== undefined) {
                if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max || (key !== 'temperature' && !Number.isSafeInteger(input[key]))) throw fail('INVALID_EXECUTION_CONFIG',400);
                value[key] = input[key];
            }
        }
        return value;
    }
    policy(value={}) {
        const keys=['userName','enableThoughtChainInjection','enableContextSanitizer','contextSanitizerDepth','enableVcpToolInjection'];
        if(!value||Object.keys(value).some(k=>!keys.includes(k))||value.userName!==undefined&&(typeof value.userName!=='string'||value.userName.length>200))throw fail('INVALID_EXECUTION_POLICY',400);
        for(const key of ['enableThoughtChainInjection','enableContextSanitizer','enableVcpToolInjection'])if(value[key]!==undefined&&typeof value[key]!=='boolean')throw fail('INVALID_EXECUTION_POLICY',400);
        const depth=value.contextSanitizerDepth??2;if(!Number.isSafeInteger(depth)||depth<0||depth>10000)throw fail('INVALID_EXECUTION_POLICY',400);
        return {userName:value.userName||'用户',enableThoughtChainInjection:value.enableThoughtChainInjection===true,enableContextSanitizer:value.enableContextSanitizer===true,contextSanitizerDepth:depth,enableVcpToolInjection:value.enableVcpToolInjection===true};
    }
    rules(value=[]) {
        const keys=['id','name','type','enabled','content','scope','builtinKey','isBuiltin','role','depth','wrap','order','source'];
        if(!Array.isArray(value)||value.length>200||JSON.stringify(value).length>128000||value.some(r=>!r||typeof r!=='object'||Object.keys(r).some(k=>!keys.includes(k))||!['system_suffix','user_suffix','context_inject'].includes(r.type)||typeof r.content!=='string'||(r.type==='context_inject'&&(!['user','assistant'].includes(r.role)||!Number.isSafeInteger(r.depth)||r.depth<0||r.depth>10000))))throw fail('INVALID_TAVERN_RULES',400);
        if(value.some(r=>this.hasAgentReference(r.content).length))throw fail('CONFIG_PROMPT_AUTHORITY_CONFLICT');
        return JSON.parse(JSON.stringify(value));
    }
    hasAgentReference(text) { return [...text.matchAll(/\{\{(?:agent:)?([^{}]+)\}\}/g)].filter(m=>m[0].startsWith('{{agent:')||this.agentManager.isAgent(m[1])); }
    async publish(body) {
        if (!body || Object.keys(body).some(k=>k!=='topics') || !Array.isArray(body.topics) || body.topics.length > this.topics.length) throw fail('INVALID_EXECUTION_CONFIG',400);
        const rows = await Promise.all(body.topics.map(async row => {
            if (!row || Object.keys(row).some(k=>!['ownerType','ownerId','topicId','expectedVersion','config'].includes(k)) || !Number.isSafeInteger(row.expectedVersion) || row.expectedVersion < 0) throw fail('INVALID_EXECUTION_CONFIG',400);
            const topic = this.topics.find(t=>t.ownerType===row.ownerType && t.ownerId===row.ownerId && t.topicId===row.topicId);
            if (!topic) throw fail('TOPIC_NOT_ALLOWED',403);
            const config = await this.normalize(topic,row.config);
            return {topic,row,config,hash:sha256(stable(config))};
        }));
        if (new Set(rows.map(r=>r.topic.key)).size !== rows.length) throw fail('DUPLICATE_CONFIG_TOPIC',400);
        this.db.exec('BEGIN IMMEDIATE');
        try {
            for (const {topic,row,config,hash} of rows) {
                const latest = this.latest(topic.key);
                if (latest?.hash === hash) continue;
                if ((latest?.version || 0) !== row.expectedVersion) throw fail('CONFIG_VERSION_CONFLICT');
                // Reverting to an older payload still creates a newer version.
                this.db.prepare('INSERT INTO owner_execution_configs(topic_key,version,hash,config_json,created_at) VALUES(?,?,?,?,?)').run(topic.key,(latest?.version||0)+1,hash,JSON.stringify(config),Date.now());
            }
            this.db.exec('COMMIT');
        } catch(e) { this.db.exec('ROLLBACK'); throw e; }
        return {topics:rows.map(r=>({key:r.topic.key,...this.public(r.topic.key)}))};
    }
    snapshot(topic) {
        const row = this.latest(topic.key);
        if (!row) { if (this.required) throw fail('EXECUTION_CONFIG_REQUIRED'); return null; }
        const config = JSON.parse(row.config_json);
        if (topic.ownerType==='group') {
            if(config.agents.some(a=>!a.unavailable&&(topic.memberAliases?.[a.id]!==a.agentAlias||!this.agentManager.isAgent(a.agentAlias))))throw fail('EXECUTION_CONFIG_IDENTITY_MISMATCH');
        } else if (config.agentAlias !== topic.agentAlias || !this.agentManager.isAgent(config.agentAlias)) throw fail('EXECUTION_CONFIG_IDENTITY_MISMATCH');
        return this.verify(topic,{version:row.version,hash:row.hash,...config});
    }
    verify(topic,snapshot){
        const {version,hash,...config}=snapshot;
        const row=this.db.prepare('SELECT hash FROM owner_execution_configs WHERE topic_key=? AND version=?').get(topic.key,version);
        if(!row||row.hash!==hash||sha256(stable(config))!==hash)throw fail('CONFIG_SNAPSHOT_CORRUPT');
        return snapshot;
    }
}
module.exports = { ExecutionConfigs };
