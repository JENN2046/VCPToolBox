'use strict';
// Durable identity only. No decisions, capabilities, receipts, sessions or grants.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { digest } = require('./approvalReceiptAuthority');
const C = require('./humanClientAdmissionCrypto');
const LOCKDOWN = 'TRUSTED_CLIENT_RECOVERY_LOCKDOWN';
const MAX_CLIENTS = 256;
const MAX_BYTES = 4 * 1024 * 1024;
const fail = () => { throw Object.assign(new Error(LOCKDOWN), { code: LOCKDOWN }); };
const inside = (p, parent) => p === parent || p.startsWith(parent + path.sep);
function directory(p, testOnly) {
    if (typeof p !== 'string' || !path.isAbsolute(p) || fs.realpathSync(p) !== p) fail();
    for (let x=p;;x=path.dirname(x)) {
        if (fs.lstatSync(x).isSymbolicLink()) fail();
        if (!testOnly && fs.existsSync(path.join(x,'.git'))) fail();
        if (x===path.dirname(x)) break;
    }
    const s=fs.statSync(p);
    if (!s.isDirectory() || s.uid!==process.getuid() || (s.mode & 0o077)) fail();
    if (testOnly) { if (!inside(p,'/tmp')) fail(); }
    else if (['/tmp','/var/tmp',path.resolve(__dirname,'..'),path.resolve(__dirname,'../..'),process.cwd()].some(x=>inside(p,x))) fail();
    return s;
}
function read(p) {
    const fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    try { const s=fs.fstatSync(fd);if(!s.isFile()||s.size>MAX_BYTES||s.uid!==process.getuid()||(s.mode&0o077))fail();return JSON.parse(fs.readFileSync(fd,'utf8')); }
    finally { fs.closeSync(fd); }
}
function writeAtomic(p,value) {
    const tmp=p+'.'+crypto.randomBytes(16).toString('hex');
    const fd=fs.openSync(tmp,'wx',0o600);
    try {fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    fs.renameSync(tmp,p);const d=fs.openSync(path.dirname(p),'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}
}
function commitment(r) { return digest({hostAuthorityId:r.hostAuthorityId,epoch:r.epoch,clients:r.clients,version:1}); }
function pair(registry,anchor,validateRecords=true) {
    if(registry.version!==1||anchor.version!==1||!/^[-_A-Za-z0-9]{43}$/.test(registry.hostAuthorityId)||!Number.isSafeInteger(registry.epoch)||registry.epoch<0||!Array.isArray(registry.clients)||registry.clients.length>MAX_CLIENTS)fail();
    if(anchor.hostAuthorityId!==registry.hostAuthorityId||anchor.highestCommittedAuthorityEpoch!==registry.epoch||anchor.authorityHeadCommitment!==commitment(registry))fail();
    if(!validateRecords)return;
    const ids=new Set();for(const c of registry.clients){
        if(!c||typeof c.clientEnrollmentId!=='string'||ids.has(c.clientEnrollmentId)||c.surface!=='vcp_chat'||!['ENROLLED','REVOKED'].includes(c.enrollmentState)||!['UNKNOWN','ADMITTED','DENIED','SUSPENDED'].includes(c.admissionState)||c.keyVersion!==1||!Number.isSafeInteger(c.createdAt)||typeof c.implementationProfileId!=='string'||C.importPublicKey(c.publicKeySpki).fingerprint!==c.publicKeyFingerprint||C.importPublicKey(c.publicKeySpki).publicKeyAlgorithm!==c.publicKeyAlgorithm)fail();
        const keys=['clientEnrollmentId','surface','publicKeySpki','publicKeyAlgorithm','publicKeyFingerprint','keyVersion','enrollmentState','admissionState','createdAt','revokedAt','revocationReason','implementationProfileId','clientLabel'];if(Object.keys(c).some(k=>!keys.includes(k)))fail();ids.add(c.clientEnrollmentId);
    }
}
class TrustedClientAuthorityStore {
    #locked=false; #lastEpoch=-1; #lastHead=null; #root; #anchorRoot; #testOnly;
    constructor({registryRoot,anchorRoot,testOnly=false}) {
        this.#root=registryRoot;this.#anchorRoot=anchorRoot;this.#testOnly=testOnly===true;
        try { const a=directory(registryRoot,this.#testOnly),b=directory(anchorRoot,this.#testOnly);
            if(inside(registryRoot,anchorRoot)||inside(anchorRoot,registryRoot))fail();
            // Production requires distinct mounted filesystems, not two names in one rollback domain.
            if(!this.#testOnly && a.dev===b.dev)fail();
            this.snapshot();
        }catch{this.#locked=true;fail();}
    }
    get testOnly(){return this.#testOnly;}
    snapshot() {
        if(this.#locked)fail();
        try {
            if(fs.existsSync(path.join(this.#root,'authority.lock')))fail();
            const r=read(path.join(this.#root,'authority.json')),a=read(path.join(this.#anchorRoot,'anchor.json'));pair(r,a,this.#lastHead!==a.authorityHeadCommitment);
            if(r.epoch<this.#lastEpoch||(r.epoch===this.#lastEpoch&&this.#lastHead!==null&&this.#lastHead!==a.authorityHeadCommitment))fail();
            this.#lastEpoch=r.epoch;this.#lastHead=a.authorityHeadCommitment;return r;
        }catch{this.#locked=true;fail();}
    }
    get(id){return this.snapshot().clients.find(c=>c.clientEnrollmentId===id)||null;}
    #commit(change) {
        this.snapshot();const lock=path.join(this.#root,'authority.lock');let fd;
        try{fd=fs.openSync(lock,'wx',0o600);}catch{this.#locked=true;fail();}
        try{
            const r=read(path.join(this.#root,'authority.json')),a=read(path.join(this.#anchorRoot,'anchor.json'));pair(r,a,this.#lastHead!==a.authorityHeadCommitment);
            if(r.epoch!==this.#lastEpoch||a.authorityHeadCommitment!==this.#lastHead)fail();
            const result=change(r);if(!Number.isSafeInteger(r.epoch+1))fail();r.epoch++;
            const next={version:1,hostAuthorityId:r.hostAuthorityId,highestCommittedAuthorityEpoch:r.epoch,authorityHeadCommitment:commitment(r)};
            pair(r,next);
            // Any crash between domains leaves a mismatch. Never auto-repair either domain.
            writeAtomic(path.join(this.#root,'authority.json'),r);writeAtomic(path.join(this.#anchorRoot,'anchor.json'),next);
            this.#lastEpoch=r.epoch;this.#lastHead=next.authorityHeadCommitment;
            return result;
        }catch(e){this.#locked=true;fail();}
        finally{fs.closeSync(fd);if(!this.#locked)fs.unlinkSync(lock);}
    }
    add(record) {
        const snap=this.snapshot();if(snap.clients.length>=MAX_CLIENTS)throw Object.assign(new Error('CAPACITY_REACHED'),{code:'CAPACITY_REACHED'});
        if(snap.clients.some(c=>c.clientEnrollmentId===record.clientEnrollmentId))fail();
        return this.#commit(r=>{r.clients.push({...record});return {...record};});
    }
    update(id,fields) {
        if(Object.keys(fields).some(k=>!['enrollmentState','admissionState','revokedAt','revocationReason'].includes(k)))fail();
        if(!this.get(id))throw Object.assign(new Error('SESSION_UNKNOWN'),{code:'SESSION_UNKNOWN'});
        return this.#commit(r=>{const c=r.clients.find(x=>x.clientEnrollmentId===id);if(c.enrollmentState==='REVOKED'&&fields.enrollmentState==='ENROLLED')fail();Object.assign(c,fields);return {...c};});
    }
}
module.exports={TrustedClientAuthorityStore,MAX_CLIENTS,LOCKDOWN};
