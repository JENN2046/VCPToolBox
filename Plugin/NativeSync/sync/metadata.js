'use strict';
const {stable,sha256}=require('./protocol');
const fail=code=>Object.assign(new Error(code),{code,status:409});
const controls=['contextCompaction','isThinking','tool_calls','tool_call_id'];
const emptyHash=()=>sha256(stable({}));
function boundedJson(value,depth=0){
    if(depth>8)throw fail('INVALID_CONTROL_METADATA');
    if(value===null||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return value;
    if(typeof value==='string'&&value.length<=128000)return value;
    if(Array.isArray(value)&&value.length<=1000)return value.map(v=>boundedJson(v,depth+1));
    if(value&&typeof value==='object'&&Object.keys(value).length<=100&&!Object.keys(value).some(k=>['__proto__','prototype','constructor'].includes(k)))return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,boundedJson(v,depth+1)]));
    throw fail('INVALID_CONTROL_METADATA');
}
function fieldsFrom(message){
    const fields={};
    if(message.contextCompaction!==undefined){
        const c=message.contextCompaction;
        if(!c||c.kind!=='vchat-context-checkpoint'||c.version!==1||message.role!=='user'||typeof c.checkpoint!=='string'||!c.checkpoint.trim()||c.checkpoint.length>128000||typeof message.content!=='string'||!message.content.includes(c.checkpoint))throw fail('INVALID_CHECKPOINT_METADATA');
        fields.contextCompaction={kind:c.kind,version:1,checkpoint:c.checkpoint};
        for(const key of ['diaries','fidelity','continuity','warnings','sourceCount'])if(c[key]!==undefined)fields.contextCompaction[key]=boundedJson(c[key]);
        if(c.diaries!==undefined&&(!Array.isArray(c.diaries)||c.diaries.some(d=>!d||typeof d.content!=='string')))throw fail('INVALID_CHECKPOINT_METADATA');
        if(c.warnings!==undefined&&(!Array.isArray(c.warnings)||c.warnings.some(v=>typeof v!=='string')))throw fail('INVALID_CHECKPOINT_METADATA');
        if(c.sourceCount!==undefined&&(!Number.isSafeInteger(c.sourceCount)||c.sourceCount<0))throw fail('INVALID_CHECKPOINT_METADATA');
    }
    if(message.isThinking!==undefined){if(typeof message.isThinking!=='boolean')throw fail('INVALID_CONTROL_METADATA');fields.isThinking=message.isThinking;}
    if(message.tool_calls!==undefined){
        if(message.role!=='assistant'||!Array.isArray(message.tool_calls)||message.tool_calls.length>32||message.tool_calls.some(c=>!c||c.type!=='function'||typeof c.id!=='string'||!c.function||typeof c.function.name!=='string'||typeof c.function.arguments!=='string'))throw fail('INVALID_CONTROL_METADATA');
        fields.tool_calls=message.tool_calls.map(c=>({id:c.id,type:'function',function:{name:c.function.name,arguments:c.function.arguments}}));
    }
    if(message.tool_call_id!==undefined){if(message.role!=='tool'||typeof message.tool_call_id!=='string')throw fail('INVALID_CONTROL_METADATA');fields.tool_call_id=message.tool_call_id;}
    const attachments=[];
    for(const a of message.attachments||[]){
        const source=a._fileManagerData||a,entry={id:a.id||source.id||'attachment_'+(a.hash||source.hash),contentHash:a.hash||source.hash};
        for(const key of ['extractedText','imageFrames','blobHash','frameHashes'])if(source[key]!==undefined)entry[key]=source[key];
        if(entry.frameHashes!==undefined){if(!Array.isArray(entry.frameHashes)||entry.frameHashes.length>10||entry.frameHashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))throw fail('INVALID_ATTACHMENT_METADATA');delete entry.imageFrames;}
        if(typeof entry.id!=='string'||!entry.id||(entry.extractedText!==undefined&&typeof entry.extractedText!=='string')||(entry.blobHash!==undefined&&!/^[a-f0-9]{64}$/.test(entry.blobHash))||(entry.imageFrames!==undefined&&(!Array.isArray(entry.imageFrames)||entry.imageFrames.some(f=>typeof f!=='string'))))throw fail('INVALID_ATTACHMENT_METADATA');
        attachments.push(entry);
    }
    if(new Set(attachments.map(a=>a.id)).size!==attachments.length)throw fail('INVALID_ATTACHMENT_METADATA');
    if(attachments.length)fields.attachmentData=attachments.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    if(Buffer.byteLength(stable(fields))>768000)throw fail('CONTROL_METADATA_TOO_LARGE');
    return fields;
}
function withFields(message,envelope){
    const result={...message};for(const key of controls)delete result[key];
    const fields=envelope.fields;
    for(const key of controls)if(Object.hasOwn(fields,key))result[key]=fields[key];
    if(result.attachments)result.attachments=result.attachments.map(a=>{
        const copy={...a};for(const k of ['extractedText','imageFrames','blobHash','frameHashes'])delete copy[k];
        const data=fields.attachmentData?.find(item=>item.id===a.id||item.contentHash===a.hash);
        copy.id=data?.id||a.id||'attachment_'+a.hash;
        if(data)for(const k of ['extractedText','imageFrames','blobHash','frameHashes'])if(Object.hasOwn(data,k))copy[k]=data[k];
        return copy;
    });
    result._nativeSyncMetadata=envelope;return result;
}
function envelopeFor(message,version){const fields=fieldsFrom(message);return {version,hash:sha256(stable(fields)),fields};}
function validateEnvelope(message,envelope){
    if(!envelope||Object.keys(envelope).some(k=>!['version','hash','fields'].includes(k))||!Number.isSafeInteger(envelope.version)||envelope.version<1||!envelope.fields||Object.keys(envelope.fields).some(k=>![...controls,'attachmentData'].includes(k)))throw fail('INVALID_CONTROL_METADATA');
    const normalized=fieldsFrom(withFields(message,envelope));
    // R1-B envelopes predate attachment identity binding. Preserve their digest
    // on read; a new publisher may advance them to the richer R1-C projection.
    for(const item of normalized.attachmentData||[]){const original=envelope.fields.attachmentData?.find(a=>a.id===item.id);if(original&&!Object.hasOwn(original,'contentHash'))delete item.contentHash;}
    if(stable(normalized)!==stable(envelope.fields)||sha256(stable(normalized))!==envelope.hash)throw fail('INVALID_METADATA_DIGEST');
    return {version:envelope.version,hash:envelope.hash,fields:normalized};
}
function preserveMetadata(source,target){
    if(target.attachments)target.attachments=target.attachments.map((a,index)=>{
        const raw=source.attachments[index],data=raw?._fileManagerData||raw;
        return {...a,id:raw?.id||data?.id||'attachment_'+a.hash,...(data?.blobHash!==undefined?{blobHash:data.blobHash}:{}),...(data?.frameHashes!==undefined?{frameHashes:data.frameHashes}:{})};
    });
    for(const key of controls)if(Object.hasOwn(source,key))target[key]=source[key];
    if(source._nativeSyncMetadata)return withFields(target,validateEnvelope(target,source._nativeSyncMetadata));
    const cleaned=withFields(target,{fields:fieldsFrom(target)});delete cleaned._nativeSyncMetadata;return cleaned;
}
module.exports={fieldsFrom,withFields,envelopeFor,validateEnvelope,preserveMetadata,emptyHash};
