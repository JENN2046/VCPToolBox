'use strict';
const {randomBytes, createHash, timingSafeEqual} = require('node:crypto');
const invalid = () => Object.assign(new Error('WRITE_AUTHORITY_RECEIPT_INVALID'), {code:'WRITE_AUTHORITY_RECEIPT_INVALID'});
function canonical(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) {
        if (Reflect.ownKeys(value).length !== value.length+1) throw invalid();
        return '[' + Array.from({length:value.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value' in d))throw invalid();return canonical(d.value);}).join(',') + ']';
    }
    if (value && [Object.prototype,null].includes(Object.getPrototypeOf(value))) {
        if (Reflect.ownKeys(value).some(k=>typeof k!=='string')) throw invalid();
        return '{'+Object.keys(value).sort().map(k=>{
            const d=Object.getOwnPropertyDescriptor(value,k); if (!d || !('value' in d)) throw invalid();
            return JSON.stringify(k)+':'+canonical(d.value);
        }).join(',')+'}';
    }
    throw invalid();
}
const digest = value => createHash('sha256').update(canonical(value),'utf8').digest('hex');
function freeze(value) { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; }
const sensitive = (tool,args) => tool==='CodexWorker' && ['grant','revoke'].includes(args?.command);
class ApprovalReceiptAuthority {
    #issuer=false; #channels=new Map(); #claims=new WeakSet(); #connections=new WeakMap(); #pending=new WeakSet(); #receipts=new Map(); #contexts=new WeakMap(); #humanAdmission=null;
    constructor({now=Date.now}={}) {this.now=now;this.channelTtl=60000;this.connectionTtl=15*60000;this.receiptTtl=60000;}
    #sweep() {const now=this.now();for(const [id,r] of this.#channels)if(r.expiresAt<=now)this.#channels.delete(id);for(const [id,r] of this.#receipts)if(r.expiresAt<=now){if(r.state==='ISSUED')r.state='EXPIRED';this.#receipts.delete(id);}}
    // Called only by the authenticated Admin HTTP endpoint, never a tool route.
    setChannelIssuer(value) { this.#issuer=value===true; }
    isChannelIssuer() { return this.#issuer; }
    // Host composition only; never sourced from a request or plugin configuration.
    setHumanClientAdmission(admission) { if(this.#humanAdmission && this.#humanAdmission!==admission)throw invalid();this.#humanAdmission=admission; }
    #live(record) { return !record?.lease || !!this.#humanAdmission?.validLease(record.lease); }
    assertClientCapacity() {this.#sweep();if(this.#channels.size>=1024)throw invalid();}
    issueClientChannel(lease) {
        if(!this.#humanAdmission?.validLease(lease))throw invalid();this.assertClientCapacity();
        const token=randomBytes(32).toString('base64url');this.#channels.set(token,{expiresAt:Math.min(this.now()+this.channelTtl,lease.expiresAt),clientSurface:'vcp_chat',lease});return token;
    }
    claimClientChannel(token) {
        this.#sweep();const c=this.#channels.get(token);
        if(!c||c.clientSurface!=='vcp_chat'||!this.#live(c))throw invalid();
        this.#channels.delete(token);
        const claim=Object.freeze({expiresAt:Math.min(this.now()+this.connectionTtl,c.lease.expiresAt),provenance:createHash('sha256').update(token).digest('hex'),clientSurface:'vcp_chat',lease:c.lease});
        this.#claims.add(claim);return claim;
    }
    clientClaimLease(claim) {if(!this.#claims.has(claim)||claim.clientSurface!=='vcp_chat'||!this.#live(claim)||claim.expiresAt<=this.now())throw invalid();return claim.lease;}
    bindClientChannel(ws,claim) {
        this.clientClaimLease(claim);if(this.#connections.has(ws)||!this.#humanAdmission.channelVerified(ws,claim))throw invalid();
        this.#claims.delete(claim);this.#connections.set(ws,claim);
        const timer=setTimeout(()=>{this.#connections.delete(ws);ws.close(1008,'Approval channel expired');},Math.max(1,claim.expiresAt-this.now()));timer.unref?.();ws.once('close',()=>{clearTimeout(timer);this.#connections.delete(ws);});
    }
    invalidateHumanLease(lease) {
        for(const [token,c]of this.#channels)if(c.lease===lease)this.#channels.delete(token);
    }
    assertAdminRequest(req,env=process.env) {
        const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length && timingSafeEqual(x,y);};
        let auth=req.headers?.authorization;
        if(!auth){const c=(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('admin_auth='));if(c)try{auth=decodeURIComponent(c.slice(11));}catch{}}
        const expectedUser=env.AdminUsername, expectedPass=env.AdminPassword;
        if(!expectedUser||!expectedPass||typeof auth!=='string'||!auth.startsWith('Basic ')) throw invalid();
        const text=Buffer.from(auth.slice(6),'base64').toString('utf8'), colon=text.indexOf(':');
        if(colon<0||!equal(text.slice(0,colon),expectedUser)||!equal(text.slice(colon+1),expectedPass))throw invalid();
    }
    issueChannel(req,env=process.env) {
        this.assertAdminRequest(req,env);
        this.#sweep();if(this.#channels.size>=1024)throw invalid();
        const token=randomBytes(32).toString('base64url');this.#channels.set(token,{expiresAt:this.now()+this.channelTtl,clientSurface:'admin_panel'});return token;
    }
    claimChannel(token) {this.#sweep();const c=this.#channels.get(token);if(!c||c.clientSurface!=='admin_panel')throw invalid();this.#channels.delete(token);const claim=Object.freeze({expiresAt:this.now()+this.connectionTtl,provenance:createHash('sha256').update(token).digest('hex'),clientSurface:c.clientSurface});this.#claims.add(claim);return claim;}
    bindChannel(ws,claim) {if(!this.#claims.has(claim)||this.#connections.has(ws)||claim.clientSurface!=='admin_panel'||claim.expiresAt<=this.now())throw invalid();this.#claims.delete(claim);this.#connections.set(ws,claim);
        // Reconnect through authenticated HTTP when the bounded human channel expires.
        if(typeof ws.close==='function'){const timer=setTimeout(()=>{this.#connections.delete(ws);ws.close(1008,'Approval channel expired');},Math.max(1,claim.expiresAt-this.now()));timer.unref?.();ws.once?.('close',()=>{clearTimeout(timer);this.#connections.delete(ws);});}
    }
    isHuman(ws) {const c=ws && this.#connections.get(ws);return !!c && c.expiresAt>this.now() && this.#live(c) && (!c.lease || this.#humanAdmission.productionHuman(c.lease));}
    // Safe host-attested metadata only. No public adapter enrolls Chat/Mobile in S2-A.
    humanContext(ws) {const c=ws && this.#connections.get(ws);return this.isHuman(ws) ? Object.freeze({clientSurface:c.clientSurface,sourceClass:c.lease?'authenticated_human_client_session':'authenticated_admin_session',...(c.lease?{sessionId:c.lease.sessionId}:{})}) : null;}
    snapshot(tool,args,decision,config) {
        if(!sensitive(tool,args))return null;
        const rule=tool+':'+args.command;
        if(config?.enabled===false || config?.approveAll===true || decision?.requiresApproval!==true || decision.matchedRule!==rule || decision.matchedCommand!==args.command)throw invalid();
        const snapshot=freeze(JSON.parse(canonical(args)));
        const record=Object.freeze({canonicalToolName:tool,command:args.command,matchedRule:rule,args:snapshot,argsDigest:digest(snapshot),createdAt:this.now(),requiresTrustedHumanReceipt:true});
        this.#pending.add(record);return record;
    }
    approve(record,hostApprovalRequestId,ws) {
        if(!this.#pending.has(record)||!this.isHuman(ws))throw invalid();this.#pending.delete(record);this.#sweep();if(this.#receipts.size>=4096)throw invalid();
        const id=randomBytes(32).toString('hex'), executionId=randomBytes(32).toString('hex');
        const connection=this.#connections.get(ws);
        this.#receipts.set(id,{...record,hostApprovalRequestId,receiptId:id,executionId,decision:'approved',approvedAt:this.now(),expiresAt:this.now()+this.receiptTtl,sourceClass:connection.lease?'authenticated_human_client_session':'authenticated_admin_session',clientSurface:connection.clientSurface,provenance:connection.provenance,state:'ISSUED'});
        return Object.freeze({approvalReceiptId:id,approvalExecutionId:executionId});
    }
    bindInvocation(handle,context,args) {
        const r=this.#receipts.get(handle?.approvalReceiptId);
        if(!r||r.state!=='ISSUED'||r.executionId!==handle.approvalExecutionId||r.expiresAt<=this.now()||r.argsDigest!==digest(args)||r.bound){if(r&&r.state==='ISSUED')r.state='INVALIDATED';throw invalid();}
        r.bound=true;this.#contexts.set(context,r);
        Object.defineProperties(context,{approvalReceiptId:{value:r.receiptId,enumerable:false},approvalExecutionId:{value:r.executionId,enumerable:false}});
    }
    finishInvocation(context) {const r=this.#contexts.get(context);if(r?.state==='ISSUED')r.state='INVALIDATED';this.#contexts.delete(context);}
    invocationAudit(context) {const r=this.#contexts.get(context);return r ? Object.freeze({state:r.state,clientSurface:r.clientSurface,sourceClass:r.sourceClass,toolName:r.canonicalToolName,command:r.command,hostApprovalRequestId:r.hostApprovalRequestId}) : null;}
    verifyAuthorization(expected,context) {
        const r=context && this.#contexts.get(context);
        try {
            if(!r||r.state!=='ISSUED'||r.expiresAt<=this.now()||!(r.sourceClass==='authenticated_admin_session' || r.sourceClass==='authenticated_human_client_session'&&r.clientSurface==='vcp_chat')||r.decision!=='approved'
                ||r.canonicalToolName!==expected.toolName||r.command!==expected.command||r.matchedRule!==expected.toolName+':'+expected.command
                ||r.argsDigest!==digest(expected.payload)||expected.payload?.command!==expected.command||expected.payload?.requestId!==expected.requestId
                ||context.approvalReceiptId!==r.receiptId||context.approvalExecutionId!==r.executionId||!r.hostApprovalRequestId)throw invalid();
            r.state='CONSUMED';return Object.freeze({authorityGate:r.matchedRule,authorityGateVerified:true,humanApproved:true,requestId:expected.requestId,payloadDigest:r.argsDigest,authorizedAt:r.approvedAt});
        }catch{if(r&&r.state==='ISSUED')r.state='INVALIDATED';throw invalid();}
    }
}
module.exports={ApprovalReceiptAuthority,authority:new ApprovalReceiptAuthority(),canonical,digest,sensitive};
