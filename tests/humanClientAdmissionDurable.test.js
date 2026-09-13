'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,durableFixture}=require('./humanClientAdmissionFixtures');
const {TrustedClientAuthorityStore,LOCKDOWN}=require('../modules/trustedClientAuthorityStore');
const {PROFILES,productionAdmitted}=require('../modules/trustedClientImplementationProfile');
const {LIMITS}=require('../modules/humanClientAdmission');
const C=require('../modules/humanClientAdmissionCrypto');
const denied=fn=>assert.throws(fn);
const statePath=h=>path.join(h.storage.registryRoot,'authority.json');
const anchorPath=h=>path.join(h.storage.anchorRoot,'anchor.json');
function recover(h,other){const challenge=other.a.sessionChallenge(h.identity.clientEnrollmentId);return other.a.authenticate(h.identity.clientEnrollmentId,h.sign(challenge));}
for(const event of ['session-expiry','client-restart','Host-restart','Host-upgrade/ordinary-source-rollback'])test('durable lifecycle: '+event,()=>{
 const h=fixture();h.identity=h.enroll();const count=h.store.snapshot().clients.length;let other=h;
 if(event==='session-expiry'){h.advance(LIMITS.sessionMs);h.a.sweep();}
 else if(event!=='client-restart')other=fixture({storage:h.storage});
 const s=recover(h,other);assert.notEqual(s.sessionId,h.identity.sessionId);assert.equal(s.clientEnrollmentId,h.identity.clientEnrollmentId);assert.equal(s.enrollmentState,'ENROLLED');assert.equal(s.sessionState,'AUTHENTICATED');assert.equal(other.store.snapshot().clients.length,count);
 if(other!==h)denied(()=>other.a.nonce(h.identity.sessionId,'capability-mint'));
});
test('durable lifecycle: revoked identity and lost key cannot recover',()=>{
 const h=fixture();h.identity=h.enroll();const other=fixture({storage:h.storage}),p=other.a.sessionChallenge(h.identity.clientEnrollmentId);
 denied(()=>other.a.authenticate(h.identity.clientEnrollmentId,other.sign(p)));assert.equal(other.a.counts().sessions,0);
 h.a.revoke(h.identity.clientEnrollmentId);denied(()=>recover(h,other));assert.equal(other.store.get(h.identity.clientEnrollmentId).enrollmentState,'REVOKED');
});
test('state domains: denied/disconnected, admitted/authenticated, suspended/authenticated',()=>{
 const h=fixture(),s=h.enroll();h.a.setAdmission(s.clientEnrollmentId,'DENIED');h.advance(LIMITS.sessionMs);h.a.sweep();let x=h.a.client(s.clientEnrollmentId);assert.equal(x.enrollmentState,'ENROLLED');assert.equal(x.currentAdmission,'DENIED');assert.equal(x.sessionState,'DISCONNECTED');
 h.a.setAdmission(s.clientEnrollmentId,'ADMITTED');let p=h.a.sessionChallenge(s.clientEnrollmentId);assert.equal(h.a.client(s.clientEnrollmentId).sessionState,'AUTHENTICATING');const fresh=h.a.authenticate(s.clientEnrollmentId,h.sign(p));assert.equal(fresh.currentAdmission,'ADMITTED');assert.equal(fresh.sessionState,'AUTHENTICATED');
 h.a.setAdmission(s.clientEnrollmentId,'SUSPENDED');x=h.a.client(s.clientEnrollmentId);assert.equal(x.enrollmentState,'ENROLLED');assert.equal(x.currentAdmission,'SUSPENDED');assert.equal(x.sessionState,'AUTHENTICATED');denied(()=>h.cap(fresh));
});
for(const action of ['SUSPENDED','DENIED','REVOKED'])test('admission race: '+action+' after capability blocks claim and future submission',()=>{
 const h=fixture(),s=h.enroll(),cap=h.cap(s).capability,ws=h.channel(s);
 if(action==='REVOKED')h.a.revoke(s.clientEnrollmentId);else h.a.setAdmission(s.clientEnrollmentId,action);
 denied(()=>h.authority.claimClientChannel(cap));assert.equal(h.authority.isHuman(ws),false);
 const args={command:'grant',requestId:'never-executed',projectRoot:'/fixture',purpose:'propose'},pending=h.authority.snapshot('CodexWorker',args,{requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'},{});
 denied(()=>h.authority.approve(pending,'never-executed-host',ws));ws.close();
});
for(const change of ['REVOKED','SUSPENDED'])test('admission race: cryptographic verification then '+change+' before final check',t=>{
 const h=fixture(),s=h.enroll(),p=h.a.nonce(s.sessionId,'capability-mint'),verify=C.verify;
 t.mock.method(C,'verify',(...args)=>{const valid=verify(...args);if(change==='REVOKED')h.a.revoke(s.clientEnrollmentId);else h.a.setAdmission(s.clientEnrollmentId,'SUSPENDED');return valid;});
 denied(()=>h.a.mint(s.sessionId,h.sign(p)));
});
test('activation: TEST_ONLY valid proofs cannot create production human receipt',()=>{
 const h=fixture(),s=h.enroll(),ws=h.channel(s);assert.equal(s.implementationProfileId,'vcp_chat.c1.fixture');assert.equal(h.a.client(s.clientEnrollmentId).productionAdmission,'DENIED');assert.equal(h.authority.isHuman(ws),false);
 const args={command:'grant',requestId:'fixture',projectRoot:'/fixture',purpose:'propose'},pending=h.authority.snapshot('CodexWorker',args,{requiresApproval:true,matchedRule:'CodexWorker:grant',matchedCommand:'grant'},{});denied(()=>h.authority.approve(pending,'fixture',ws));ws.close();
});
test('activation: production catalog disabled and no caller/Host promotion entry',()=>{
 assert.equal(PROFILES['vcp_chat.c2'].activation,'PRODUCTION_DISABLED');assert(Object.isFrozen(PROFILES));assert(Object.isFrozen(PROFILES['vcp_chat.c2']));denied(()=>{PROFILES['vcp_chat.c2'].activation='PRODUCTION_ADMITTED';});
 for(const implementationProfileId of ['vcp_chat.c2','vcp_chat.c1.fixture','PRODUCTION_ADMITTED','vcp_mobile'])assert.equal(productionAdmitted({implementationProfileId}),false);
 const h=fixture();denied(()=>h.a.begin({protocolVersion:1,publicKeySpki:h.publicKeySpki,implementationProfileId:'PRODUCTION_ADMITTED'},'caller'));
});
for(const attack of ['registry-newer','anchor-newer','identity-mismatch','commitment-mismatch','anchor-missing','anchor-unreadable','registry-missing','both-missing','incomplete-write-lock'])test('continuity: '+attack+' locks down with no repair',()=>{
 const h=fixture(),s=h.enroll(),r=JSON.parse(fs.readFileSync(statePath(h))),a=JSON.parse(fs.readFileSync(anchorPath(h)));
 if(attack==='registry-newer'){r.epoch++;fs.writeFileSync(statePath(h),JSON.stringify(r));}
 if(attack==='anchor-newer'){a.highestCommittedAuthorityEpoch++;fs.writeFileSync(anchorPath(h),JSON.stringify(a));}
 if(attack==='identity-mismatch'){a.hostAuthorityId=crypto.randomBytes(32).toString('base64url');fs.writeFileSync(anchorPath(h),JSON.stringify(a));}
 if(attack==='commitment-mismatch'){a.authorityHeadCommitment='0'.repeat(64);fs.writeFileSync(anchorPath(h),JSON.stringify(a));}
 if(['anchor-missing','both-missing'].includes(attack))fs.unlinkSync(anchorPath(h));
 if(['registry-missing','both-missing'].includes(attack))fs.unlinkSync(statePath(h));
 if(attack==='anchor-unreadable'){fs.unlinkSync(anchorPath(h));fs.mkdirSync(anchorPath(h));}
 if(attack==='incomplete-write-lock')fs.writeFileSync(path.join(h.storage.registryRoot,'authority.lock'),'incomplete');
 assert.throws(()=>h.store.snapshot(),{code:LOCKDOWN});denied(()=>h.cap(s));assert.throws(()=>new TrustedClientAuthorityStore(h.storage),{code:LOCKDOWN});
});
test('continuity: revoked identity survives ordinary runtime rollback but registry-only restore locks down',()=>{
 const h=fixture(),s=h.enroll(),prior=fs.readFileSync(statePath(h));h.a.revoke(s.clientEnrollmentId);const next=fixture({storage:h.storage});assert.equal(next.store.get(s.clientEnrollmentId).enrollmentState,'REVOKED');denied(()=>next.a.sessionChallenge(s.clientEnrollmentId));fs.writeFileSync(statePath(h),prior);assert.throws(()=>next.store.snapshot(),{code:LOCKDOWN});
});
test('continuity: configuration rejects nested roots, same domain production and missing state',()=>{
 const storage=durableFixture();assert.throws(()=>new TrustedClientAuthorityStore({...storage,anchorRoot:storage.registryRoot}),{code:LOCKDOWN});assert.throws(()=>new TrustedClientAuthorityStore({...storage,testOnly:false}),{code:LOCKDOWN});const virgin=durableFixture();fs.unlinkSync(path.join(virgin.registryRoot,'authority.json'));assert.throws(()=>new TrustedClientAuthorityStore(virgin),{code:LOCKDOWN});
});
test('durable registry contains only enrollment authority; no session/key secrets or downstream state',()=>{
 const h=fixture(),s=h.enroll(),raw=fs.readFileSync(statePath(h),'utf8');for(const k of ['privateKey','capability','receipt','approved','sessionId','grantId'])assert(!raw.includes('"'+k+'"'));assert(raw.includes(s.clientEnrollmentId));
});
test('receipt boundary: client-state dependencies removed from issued receipt consume path',()=>{
 const text=fs.readFileSync(require.resolve('../modules/approvalReceiptAuthority'),'utf8');const bind=text.slice(text.indexOf('    bindInvocation('));assert(!bind.includes('#live('));assert(!bind.includes('validLease('));assert(!bind.includes('productionHuman('));const invalidate=text.slice(text.indexOf('    invalidateHumanLease('),text.indexOf('    assertAdminRequest('));assert(!invalidate.includes('#receipts'));
});

test('activation: valid enrollment PoP with production-disabled profile stays disconnected',()=>{const h=fixture({productionProfile:true}),c=h.enroll();assert.equal(c.enrollmentState,'ENROLLED');assert.equal(c.currentAdmission,'DENIED');assert.equal(c.productionAdmission,'DENIED');assert.equal(c.sessionState,'DISCONNECTED');assert.equal(c.implementationProfileId,'vcp_chat.c2');assert.equal(h.a.counts().sessions,0);denied(()=>h.a.sessionChallenge(c.clientEnrollmentId));});
test('durable session crypto: production functions verify cross-runtime recovery vector',()=>{const v=require('../docs/human-client-admission/ED25519_A1_SESSION_VECTORS.json'),x=v.cases.at(-1),t=C.transcript(x.boundFields);assert.equal(t.bytes.toString('hex'),x.signingInputHex);assert(C.verify(C.publicKey(v.publicKeySpki).key,t.bytes,Buffer.from(x.signatureHex,'hex').toString('base64url')));});

test('session recovery: final nonce deadline recheck after verification',t=>{const h=fixture(),s=h.enroll(),p=h.a.sessionChallenge(s.clientEnrollmentId),verify=C.verify;t.mock.method(C,'verify',(...args)=>{const valid=verify(...args);h.advance(LIMITS.nonceMs);return valid;});assert.throws(()=>h.a.authenticate(s.clientEnrollmentId,h.sign(p)),{code:'PROOF_EXPIRED'});});
