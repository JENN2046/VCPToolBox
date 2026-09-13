'use strict';
const crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {TrustedClientAuthorityStore}=require('../modules/trustedClientAuthorityStore');
const {digest}=require('../modules/approvalReceiptAuthority');
function durableFixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'c1-a1-fixture-'));const registryRoot=path.join(root,'registry'),anchorRoot=path.join(root,'independent-anchor');fs.mkdirSync(registryRoot,{mode:0o700});fs.mkdirSync(anchorRoot,{mode:0o700});const state={version:1,hostAuthorityId:crypto.randomBytes(32).toString('base64url'),epoch:0,clients:[]};fs.writeFileSync(path.join(registryRoot,'authority.json'),JSON.stringify(state),{mode:0o600});fs.writeFileSync(path.join(anchorRoot,'anchor.json'),JSON.stringify({version:1,hostAuthorityId:state.hostAuthorityId,highestCommittedAuthorityEpoch:0,authorityHeadCommitment:digest(state)}),{mode:0o600});return {root,registryRoot,anchorRoot,testOnly:true};}
const {ApprovalReceiptAuthority}=require('../modules/approvalReceiptAuthority');
const {HumanClientAdmission}=require('../modules/humanClientAdmission');
const env={AdminUsername:'c1-fixture-admin',AdminPassword:'c1-fixture-only'};
const auth='Basic '+Buffer.from(env.AdminUsername+':'+env.AdminPassword).toString('base64');
function fixture(options={}){let time=options.time??100000;const authority=options.authority||new ApprovalReceiptAuthority({now:()=>time});authority.setChannelIssuer(true);const storage=options.storage||durableFixture();const backing=new TrustedClientAuthorityStore(storage);const store=options.productionProfile?{testOnly:false,snapshot:()=>backing.snapshot(),get:id=>backing.get(id),add:r=>backing.add(r),update:(id,fields)=>backing.update(id,fields)}:backing;const a=new HumanClientAdmission({authority,store,now:options.now||(()=>time),trustedHostOrigin:'https://host.fixture',trustedAdminOrigin:'https://admin.fixture'});const keys=crypto.generateKeyPairSync('ed25519');const publicKeySpki=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');const sign=(proof,key=keys.privateKey)=>({nonceId:proof.nonceId,signature:crypto.sign(null,Buffer.from(proof.signingInput,'base64url'),key).toString('base64url')});let source=0;
 const begin=()=>a.begin({protocolVersion:1,publicKeySpki},'fixture-'+ ++source);
 const enroll=()=>{const e=begin();a.browserDecision(e.enrollmentId,'approve');return a.claim(e.enrollmentId,sign(e.proof));};
 const cap=s=>a.mint(s.sessionId,sign(a.nonce(s.sessionId,'capability-mint')));
 const socket=()=>{const s=new EventEmitter();s.closed=false;s.close=()=>{s.closed=true;s.emit('close');};return s;};
 const channel=s=>{const ws=socket(),token=cap(s).capability,claim=authority.claimClientChannel(token),proof=a.beginChannel(ws,claim);a.completeChannel(ws,sign(proof));return ws;};
 return {a,authority,store,storage,keys,publicKeySpki,sign,begin,enroll,cap,socket,channel,advance:ms=>{time+=ms;},setTime:t=>{time=t;},env,auth};}
module.exports={fixture,durableFixture,env,auth};
