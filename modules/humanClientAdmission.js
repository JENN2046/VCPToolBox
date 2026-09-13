'use strict';
const { randomBytes } = require('node:crypto');
const C = require('./humanClientAdmissionCrypto');
const Profiles = require('./trustedClientImplementationProfile');
const {MAX_CLIENTS}=require('./trustedClientAuthorityStore');
const { digest } = require('./approvalReceiptAuthority');
const ROOT = '/human-client/v1/vcp-chat';
const ADMIN = '/admin_api/human-client';
const WS_PATH = '/VCPlog/vcp-chat-approval';
const LIMITS = Object.freeze({ enrollments:256, sessions:256, nonces:1024, perSessionNonces:8, terminal:512, csrf:512, sources:1024, startsPerMinute:10, sockets:4, enrollmentMs:300000, nonceMs:30000, upgradeMs:10000, sessionMs:28800000, terminalMs:300000, csrfMs:300000 });
const id = () => randomBytes(32).toString('base64url');
function shape(obj, required, optional=[]) {
    if (!obj || Object.getPrototypeOf(obj)!==Object.prototype || Object.keys(obj).some(k=>!required.includes(k)&&!optional.includes(k)) || required.some(k=>!Object.hasOwn(obj,k))) C.fail('INVALID_ENROLLMENT');
}
class HumanClientAdmission {
    #enrollments=new Map(); #sessions=new Map(); #nonces=new Map(); #terminal=new Map(); #csrf=new Map(); #rates=new Map(); #sockets=new Map();
    constructor({ authority, trustedHostOrigin, trustedAdminOrigin, store, now=Date.now }) {
        this.hostOrigin=C.origin(trustedHostOrigin); this.adminOrigin=C.origin(trustedAdminOrigin); this.bootId=id(); this.now=now; this.authority=authority;
        if(!store)C.fail('TRUSTED_CLIENT_RECOVERY_LOCKDOWN');this.store=store;this.profile=Profiles.profile(store);store.snapshot();
        authority.setHumanClientAdmission(this);
    }
    counts() { this.sweep(); return {enrollments:this.#enrollments.size,sessions:this.#sessions.size,nonces:this.#nonces.size,terminal:this.#terminal.size,csrf:this.#csrf.size,sources:this.#rates.size,sockets:this.#sockets.size}; }
    #remember(enrollment, state) {
        this.#enrollments.delete(enrollment.enrollmentId); this.#nonces.delete(enrollment.challengeId);
        this.#terminal.set(enrollment.enrollmentId,{...this.#view(enrollment),state,terminalExpiresAt:this.now()+LIMITS.terminalMs});
        while(this.#terminal.size>LIMITS.terminal)this.#terminal.delete(this.#terminal.keys().next().value);
    }
    sweep() {
        const now=this.now();
        for(const e of this.#enrollments.values())if(e.expiresAt<=now)this.#remember(e,'EXPIRED');
        for(const s of this.#sessions.values())if(s.expiresAt<=now){this.#retire(s,'DISCONNECTED');this.#sessions.delete(s.sessionId);}
        for(const [k,n]of this.#nonces)if(n.fields.expiresAt<=now)this.#nonces.delete(k);
        for(const [k,x]of this.#terminal)if(x.terminalExpiresAt<=now)this.#terminal.delete(k);
        for(const [k,x]of this.#csrf)if(x.expiresAt<=now)this.#csrf.delete(k);
        for(const [k,x]of this.#rates)if(x.until<=now)this.#rates.delete(k);
    }
    #rate(source) {
        this.sweep(); const k=C.hash(String(source).slice(0,200)); let x=this.#rates.get(k);
        if(!x){if(this.#rates.size>=LIMITS.sources)C.fail('CAPACITY_REACHED');x={until:this.now()+60000,count:0};this.#rates.set(k,x);}
        if(++x.count>LIMITS.startsPerMinute)C.fail('CAPACITY_REACHED');
    }
    #proof(purpose, fields, key, ttl=LIMITS.nonceMs) {
        if(this.#nonces.size>=LIMITS.nonces)C.fail('CAPACITY_REACHED');
        if((fields.sessionId||fields.clientEnrollmentId) && [...this.#nonces.values()].filter(n=>(n.fields.sessionId||n.fields.clientEnrollmentId)===(fields.sessionId||fields.clientEnrollmentId)).length>=LIMITS.perSessionNonces)C.fail('CAPACITY_REACHED');
        const nonceId=id(); const bound=Object.freeze({protocolVersion:1,purpose,hostBootId:this.bootId,trustedHostOrigin:this.hostOrigin,surface:'vcp_chat',hostAuthorityId:this.store.snapshot().hostAuthorityId,...fields,nonceId,issuedAt:this.now(),expiresAt:this.now()+ttl});
        const t=C.transcript(bound); this.#nonces.set(nonceId,{fields:bound,key,publicKeyAlgorithm:C.algorithmOf(key),bytes:t.bytes});
        return Object.freeze({nonceId,boundFields:bound,signingInput:t.signingInput,boundFieldDigest:t.boundFieldDigest});
    }
    #consume(purpose, owner, proof, extraCheck=()=>{}) {
        shape(proof,['nonceId','signature']); const n=this.#nonces.get(proof.nonceId);
        if(!n)C.fail('PROOF_REPLAYED');
        if(n.fields.expiresAt<=this.now())C.fail('PROOF_EXPIRED');
        if(n.fields.purpose!==purpose || n.fields.hostBootId!==this.bootId || n.fields.surface!=='vcp_chat' || (n.fields.sessionId||n.fields.enrollmentId||n.fields.clientEnrollmentId)!==owner || !C.verifyHumanClientProof({publicKeyAlgorithm:n.publicKeyAlgorithm,canonicalPublicKey:n.key,signingInput:n.bytes,signature:proof.signature}))C.fail('PROOF_INVALID');
        extraCheck(); // All crypto verification and final admission/consume are synchronous.
        if(n.fields.expiresAt<=this.now())C.fail('PROOF_EXPIRED');
        if(this.#nonces.get(proof.nonceId)!==n)C.fail('PROOF_REPLAYED');
        this.#nonces.delete(proof.nonceId); return n.fields;
    }
    #view(e) {return {enrollmentId:e.enrollmentId,...(e.sessionId?{sessionId:e.sessionId}:{}),...(e.clientEnrollmentId?{clientEnrollmentId:e.clientEnrollmentId}:{}),state:e.state,enrollmentState:['PENDING_HUMAN','APPROVED_WAITING_PROOF'].includes(e.state)?'PENDING_ENROLLMENT':e.state==='CLAIMED'?'ENROLLED':'UNENROLLED',clientSurface:'vcp_chat',publicKeyFingerprint:e.fingerprint,clientLabel:e.label,createdAt:e.createdAt,expiresAt:e.expiresAt,sessionMaxMs:LIMITS.sessionMs,trustedHostOrigin:this.hostOrigin};}
    begin(body,source) {
        shape(body,['protocolVersion','publicKeySpki'],['clientLabel']); if(body.protocolVersion!==1)C.fail('INVALID_ENROLLMENT');
        if(body.clientLabel!==undefined && (typeof body.clientLabel!=='string'||body.clientLabel.length>80||/[\x00-\x1f\x7f]/.test(body.clientLabel)))C.fail('INVALID_ENROLLMENT');
        const pub=C.importPublicKey(body.publicKeySpki);this.#rate(source);
        if(this.#enrollments.size>=LIMITS.enrollments)C.fail('CAPACITY_REACHED');
        const enrollmentId=id(),e={enrollmentId,state:'PENDING_HUMAN',...pub,label:body.clientLabel||'',createdAt:this.now(),expiresAt:this.now()+LIMITS.enrollmentMs};
        const proof=this.#proof('enrollment-claim',{enrollmentId,publicKeyFingerprint:pub.fingerprint,method:'POST',path:ROOT+'/enrollments/'+enrollmentId+'/claim',bodyDigest:digest({enrollmentId})},pub.key,LIMITS.enrollmentMs);
        e.challengeId=proof.nonceId;this.#enrollments.set(enrollmentId,e);
        return {...this.#view(e),browserEnrollmentUrl:this.adminOrigin+ADMIN+'/enrollments/'+enrollmentId,proof};
    }
    enrollment(enrollmentId) {this.sweep();const e=this.#enrollments.get(enrollmentId);const x=e?this.#view(e):this.#terminal.get(enrollmentId);if(!x)C.fail('INVALID_ENROLLMENT');const {terminalExpiresAt,...safe}=x;return safe;}
    browserDecision(enrollmentId,decision) {
        const e=this.#enrollments.get(enrollmentId);if(!e)C.fail('INVALID_ENROLLMENT');if(e.expiresAt<=this.now())C.fail('ENROLLMENT_EXPIRED');
        if(e.state!=='PENDING_HUMAN'||!['approve','deny'].includes(decision))C.fail('INVALID_ENROLLMENT');
        if(decision==='deny')this.#remember(e,'DENIED');else e.state='APPROVED_WAITING_PROOF';
        return this.enrollment(enrollmentId);
    }
    claim(enrollmentId,proof) {
        const e=this.#enrollments.get(enrollmentId);if(!e)C.fail('INVALID_ENROLLMENT');
        if(e.expiresAt<=this.now())C.fail('ENROLLMENT_EXPIRED');if(e.state!=='APPROVED_WAITING_PROOF')C.fail('ENROLLMENT_NOT_APPROVED');
        this.sweep();if(this.#sessions.size>=LIMITS.sessions||this.store.snapshot().clients.length>=MAX_CLIENTS)C.fail('CAPACITY_REACHED');
        this.#consume('enrollment-claim',enrollmentId,proof,()=>{if(e.state!=='APPROVED_WAITING_PROOF'||e.expiresAt<=this.now())C.fail('ENROLLMENT_NOT_APPROVED');});
        const clientEnrollmentId=id(),record={clientEnrollmentId,surface:'vcp_chat',publicKeySpki:e.spki,publicKeyAlgorithm:e.publicKeyAlgorithm,publicKeyFingerprint:e.fingerprint,keyVersion:1,enrollmentState:'ENROLLED',admissionState:'ADMITTED',createdAt:this.now(),revokedAt:null,revocationReason:null,implementationProfileId:this.profile.id,clientLabel:e.label};
        this.store.add(record);e.clientEnrollmentId=clientEnrollmentId;
        const result=this.#newSession(record);e.sessionId=result.sessionId;this.#remember(e,'CLAIMED');return result;
    }
    #newSession(record) {
        if(this.#admission(record)!=='ADMITTED')return this.#clientView(record);
        if(this.#sessions.size>=LIMITS.sessions)C.fail('CAPACITY_REACHED');
        const sessionId=id(),s={sessionId,clientEnrollmentId:record.clientEnrollmentId,surface:'vcp_chat',bootId:this.bootId,key:C.importPublicKey(record.publicKeySpki).key,fingerprint:record.publicKeyFingerprint,keyVersion:record.keyVersion,label:record.clientLabel,createdAt:this.now(),expiresAt:this.now()+LIMITS.sessionMs,sessionState:'AUTHENTICATED'};
        this.#sessions.set(sessionId,s);return this.#safe(s);
    }
    #admission(record,production=false) {
        if(!record||record.enrollmentState!=='ENROLLED')return 'DENIED';
        if(record.admissionState!=='ADMITTED')return record.admissionState;
        if(production||!this.store.testOnly)return Profiles.productionAdmitted(record)?'ADMITTED':'DENIED';
        return record.implementationProfileId===this.profile.id?'ADMITTED':'DENIED';
    }
    client(clientEnrollmentId) {
        const r=this.store.get(clientEnrollmentId);if(!r)C.fail('SESSION_UNKNOWN');
        return this.#clientView(r);
    }
    #clientView(r){const clientEnrollmentId=r.clientEnrollmentId;return {...r,currentAdmission:this.#admission(r),productionAdmission:this.#admission(r,true),sessionState:[...this.#sessions.values()].some(s=>s.clientEnrollmentId===clientEnrollmentId&&s.sessionState==='AUTHENTICATED'&&s.expiresAt>this.now())?'AUTHENTICATED':[...this.#nonces.values()].some(n=>n.fields.clientEnrollmentId===clientEnrollmentId&&n.fields.purpose==='session-authenticate'&&n.fields.expiresAt>this.now())?'AUTHENTICATING':'DISCONNECTED'};
    }
    clients(){return this.store.snapshot().clients.map(r=>{const {publicKeySpki,...safe}=this.#clientView(r);return safe;});}
    #safe(s) {const r=this.client(s.clientEnrollmentId);return {sessionId:s.sessionId,clientEnrollmentId:s.clientEnrollmentId,clientSurface:s.surface,publicKeyFingerprint:s.fingerprint,createdAt:s.createdAt,expiresAt:s.expiresAt,enrollmentState:r.enrollmentState,currentAdmission:r.currentAdmission,productionAdmission:r.productionAdmission,implementationProfileId:r.implementationProfileId,sessionState:s.sessionState,clientLabel:s.label};}
    list() {this.sweep();return [...this.#sessions.values()].map(s=>this.#safe(s));}
    #session(sessionId) {const s=this.#sessions.get(sessionId);if(!s)C.fail('SESSION_UNKNOWN');const r=this.store.get(s.clientEnrollmentId);if(r?.enrollmentState==='REVOKED')C.fail('SESSION_REVOKED');if(s.expiresAt<=this.now()||s.sessionState!=='AUTHENTICATED')C.fail('SESSION_EXPIRED');return s;}
    validLease(s) {try{return !!s && this.#sessions.get(s.sessionId)===s && s.bootId===this.bootId && s.surface==='vcp_chat' && s.sessionState==='AUTHENTICATED' && s.expiresAt>this.now() && this.#admission(this.store.get(s.clientEnrollmentId))==='ADMITTED' && this.store.get(s.clientEnrollmentId).publicKeyFingerprint===s.fingerprint && this.store.get(s.clientEnrollmentId).keyVersion===s.keyVersion;}catch{return false;}}
    productionHuman(s){return this.validLease(s)&&this.#admission(this.store.get(s.clientEnrollmentId),true)==='ADMITTED';}
    // Host policy API only, deliberately absent from public/native route schemas.
    setAdmission(clientEnrollmentId,state){if(!['UNKNOWN','ADMITTED','DENIED','SUSPENDED'].includes(state))C.fail('CLIENT_NOT_AUTHORIZED');this.store.update(clientEnrollmentId,{admissionState:state});}
    sessionChallenge(clientEnrollmentId) {
        this.sweep();const r=this.store.get(clientEnrollmentId);if(this.#admission(r)!=='ADMITTED')C.fail('CLIENT_NOT_AUTHORIZED');
        return this.#proof('session-authenticate',{clientEnrollmentId,hostAuthorityId:this.store.snapshot().hostAuthorityId,keyVersion:r.keyVersion,publicKeyFingerprint:r.publicKeyFingerprint,method:'POST',path:ROOT+'/clients/'+clientEnrollmentId+'/sessions',bodyDigest:digest({clientEnrollmentId})},C.importPublicKey(r.publicKeySpki).key);
    }
    authenticate(clientEnrollmentId,proof) {
        this.sweep();if(this.#sessions.size>=LIMITS.sessions)C.fail('CAPACITY_REACHED');
        this.#consume('session-authenticate',clientEnrollmentId,proof,()=>{if(this.#admission(this.store.get(clientEnrollmentId))!=='ADMITTED')C.fail('CLIENT_NOT_AUTHORIZED');});
        return this.#newSession(this.store.get(clientEnrollmentId));
    }
    nonce(sessionId,purpose) {
        if(!['capability-mint','self-revoke'].includes(purpose))C.fail('SURFACE_NOT_ADMITTED');this.sweep();const s=this.#session(sessionId);
        return this.#proof(purpose,{sessionId,publicKeyFingerprint:s.fingerprint,method:'POST',path:ROOT+'/sessions/'+sessionId+'/'+(purpose==='capability-mint'?'capability':'revoke'),bodyDigest:digest({sessionId})},s.key,Math.min(LIMITS.nonceMs,s.expiresAt-this.now()));
    }
    mint(sessionId,proof) {const s=this.#session(sessionId);this.authority.assertClientCapacity();this.#consume('capability-mint',sessionId,proof,()=>this.#session(sessionId));return {capability:this.authority.issueClientChannel(s),expiresInMs:this.authority.channelTtl,websocketUrl:this.hostOrigin.replace(/^https:/,'wss:')+WS_PATH};}
    #retire(s,state) {
        s.sessionState=state;
        this.authority.invalidateHumanLease(s);
        for(const [k,n]of this.#nonces)if(n.fields.sessionId===s.sessionId)this.#nonces.delete(k);
        for(const [ws,c]of this.#sockets)if(c.lease===s){this.#sockets.delete(ws);clearTimeout(c.timer);try{ws.close(1008,'Human session unavailable');}catch{}}
    }
    revoke(identity) {const s=this.#sessions.get(identity),clientEnrollmentId=s?.clientEnrollmentId||identity;this.store.update(clientEnrollmentId,{enrollmentState:'REVOKED',revokedAt:this.now(),revocationReason:'EXPLICIT_REVOKE'});for(const session of this.#sessions.values())if(session.clientEnrollmentId===clientEnrollmentId)this.#retire(session,'DISCONNECTED');return s?this.#safe(s):this.client(clientEnrollmentId);}
    selfRevoke(sessionId,proof) {this.#session(sessionId);this.#consume('self-revoke',sessionId,proof,()=>this.#session(sessionId));return this.revoke(sessionId);}
    assertCsrfCapacity(count=1) {this.sweep();if(this.#csrf.size+count>LIMITS.csrf)C.fail('CAPACITY_REACHED');}
    csrf(principal,resource) {this.assertCsrfCapacity();const token=id();this.#csrf.set(C.hash(token),{principal,resource,expiresAt:this.now()+LIMITS.csrfMs});return token;}
    consumeCsrf(principal,resource,token) {if(typeof token!=='string'||token.length>100)C.fail('CLIENT_NOT_AUTHORIZED');const k=C.hash(token),x=this.#csrf.get(k);if(!x||x.principal!==principal||x.resource!==resource||x.expiresAt<=this.now())C.fail('CLIENT_NOT_AUTHORIZED');this.#csrf.delete(k);}
    beginChannel(ws,claim) {
        const s=this.authority.clientClaimLease(claim);if(!this.validLease(s))C.fail('SESSION_REVOKED');
        if([...this.#sockets.values()].filter(x=>x.lease===s).length>=LIMITS.sockets)C.fail('CAPACITY_REACHED');
        const proof=this.#proof('channel-upgrade',{sessionId:s.sessionId,publicKeyFingerprint:s.fingerprint,capabilityDigest:claim.provenance,method:'GET',path:WS_PATH,bodyDigest:digest({})},s.key,Math.min(LIMITS.upgradeMs,s.expiresAt-this.now()));
        const c={lease:s,claim,proof,verified:false,timer:null};this.#sockets.set(ws,c);
        const release=()=>{clearTimeout(c.timer);this.#nonces.delete(proof.nonceId);this.#sockets.delete(ws);};
        c.timer=setTimeout(()=>{release();try{ws.close(1008,'Channel proof expired');}catch{}},LIMITS.upgradeMs);c.timer.unref?.();ws.once('close',release);
        return proof;
    }
    completeChannel(ws,proof) {
        const c=this.#sockets.get(ws);if(!c||c.verified||proof?.nonceId!==c.proof.nonceId)C.fail('PROOF_INVALID');
        this.#consume('channel-upgrade',c.lease.sessionId,proof,()=>{if(!this.validLease(c.lease))C.fail('SESSION_REVOKED');});
        c.verified=true;clearTimeout(c.timer);this.authority.bindClientChannel(ws,c.claim);
    }
    channelVerified(ws,claim) {const c=this.#sockets.get(ws);return !!c&&c.claim===claim&&c.verified&&this.validLease(c.lease);}
}
module.exports={HumanClientAdmission,LIMITS,ROOT,ADMIN,WS_PATH,shape};
