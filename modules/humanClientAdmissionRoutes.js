'use strict';
const express=require('express');
const {authority:defaultAuthority}=require('./approvalReceiptAuthority');
const {getAdmission:defaultGet}=require('./humanClientAdmissionRuntime');
const {shape,ROOT,ADMIN}=require('./humanClientAdmission');
const {hash,fail}=require('./humanClientAdmissionCrypto');
const {forward}=require('./humanClientAdmissionProxy');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=(title,content)=>'<!doctype html><html><head><meta charset="utf-8"><title>'+escape(title)+'</title></head><body><h1>'+escape(title)+'</h1>'+content+'</body></html>';
function headers(res){res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});}
function base(getAdmission,prefix){
    const r=express.Router({strict:true,caseSensitive:true});r.use((req,res,next)=>{headers(res);if(!(req.originalUrl===prefix||req.originalUrl.startsWith(prefix+'/'))||/[?%]/.test(req.originalUrl))return res.status(400).json({error:'INVALID_ENROLLMENT'});req.humanAdmission=getAdmission();if(!req.humanAdmission)return res.status(503).json({error:'ADMISSION_DISABLED'});if(Object.keys(req.query).length)return res.status(400).json({error:'INVALID_ENROLLMENT'});if(Number(req.headers['content-length']||0)>8192)return res.status(413).json({error:'INVALID_ENROLLMENT'});next();});
    r.use(express.json({limit:8192,strict:true}));r.use(express.urlencoded({limit:8192,extended:false,parameterLimit:8}));
    // Independent Admin may have parsed the body already. Still bound execution/proxy input.
    r.use((req,res,next)=>{if(req.body!==undefined&&Buffer.byteLength(JSON.stringify(req.body))>8192)return res.status(413).json({error:'INVALID_ENROLLMENT'});next();});return r;
}
function finish(r){r.use((_q,res)=>res.status(404).json({error:'SURFACE_NOT_ADMITTED'}));r.use((e,_q,res,_next)=>{
    const allowed=['TRUSTED_CLIENT_RECOVERY_LOCKDOWN','ADMISSION_DISABLED','INVALID_ENROLLMENT','ENROLLMENT_EXPIRED','ENROLLMENT_NOT_APPROVED','PROOF_INVALID','PROOF_EXPIRED','PROOF_REPLAYED','SESSION_UNKNOWN','SESSION_EXPIRED','SESSION_REVOKED','CAPACITY_REACHED','CLIENT_NOT_AUTHORIZED','SURFACE_NOT_ADMITTED'];
    const code=allowed.includes(e.code||e.message)?(e.code||e.message):'INVALID_ENROLLMENT';res.status(code==='CAPACITY_REACHED'?429:code==='ADMISSION_DISABLED'?503:code==='CLIENT_NOT_AUTHORIZED'?403:400).json({error:code});});return r;}
function createClientRouter({getAdmission=defaultGet}={}){
    const r=base(getAdmission,'/human-client');
    r.post('/v1/vcp-chat/enrollments',(req,res)=>res.status(201).json(req.humanAdmission.begin(req.body,req.socket.remoteAddress||'unknown')));
    r.get('/v1/vcp-chat/enrollments/:id',(req,res)=>res.json(req.humanAdmission.enrollment(req.params.id)));
    r.post('/v1/vcp-chat/enrollments/:id/claim',(req,res)=>res.json(req.humanAdmission.claim(req.params.id,req.body)));
    r.post('/v1/vcp-chat/sessions/:id/nonces',(req,res)=>{shape(req.body,['purpose']);res.json(req.humanAdmission.nonce(req.params.id,req.body.purpose));});
    r.post('/v1/vcp-chat/sessions/:id/capability',(req,res)=>res.json(req.humanAdmission.mint(req.params.id,req.body)));
    r.post('/v1/vcp-chat/sessions/:id/revoke',(req,res)=>res.json(req.humanAdmission.selfRevoke(req.params.id,req.body)));
    r.post('/v1/vcp-chat/clients/:id/session-challenges',(req,res)=>{shape(req.body,[]);res.json(req.humanAdmission.sessionChallenge(req.params.id));});
    r.post('/v1/vcp-chat/clients/:id/sessions',(req,res)=>res.json(req.humanAdmission.authenticate(req.params.id,req.body)));
    return finish(r);
}
function principal(req){let a=req.headers.authorization;if(!a){const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('admin_auth='));if(c)a=decodeURIComponent(c.slice(11));}return hash(a||'');}
function createAdminRouter({getAdmission=defaultGet,authority=defaultAuthority,env=process.env,proxy=forward}={}){
    const r=base(getAdmission,ADMIN);
    r.use((req,res,next)=>{try{authority.assertAdminRequest(req,env);}catch{return res.status(401).json({error:'CLIENT_NOT_AUTHORIZED'});}if(req.method==='POST'&&req.headers.origin!==req.humanAdmission.adminOrigin)return res.status(403).json({error:'CLIENT_NOT_AUTHORIZED'});next();});
    r.use(async(req,res,next)=>{if(authority.isChannelIssuer())return next();try{const x=await proxy(req,Number(env.PORT)||6005);if(x.type)res.type(x.type);res.status(x.status).send(x.body);}catch(e){next(e);}});
    r.get('/enrollments/:id',(req,res)=>{
        const a=req.humanAdmission,e=a.enrollment(req.params.id),token=a.csrf(principal(req),'enrollment:'+e.enrollmentId);
        const fields='<dl><dt>Host origin</dt><dd>'+escape(a.hostOrigin)+'</dd><dt>Surface</dt><dd>VCPChat (vcp_chat)</dd><dt>Public-key SHA-256 fingerprint</dt><dd>'+escape(e.publicKeyFingerprint)+'</dd><dt>Client label</dt><dd>'+escape(e.clientLabel)+'</dd><dt>Purpose</dt><dd>Enroll this exact client key durably; this does not admit the implementation profile or approve any tool.</dd><dt>Enrollment</dt><dd>Durable until explicit revoke or material identity invalidation. Sessions have an 8-hour absolute maximum; existing key proof recovers sessions without re-enrollment. C1 production participation is disabled.</dd><dt>Enrollment expiresAt</dt><dd>'+e.expiresAt+'</dd><dt>State</dt><dd>'+escape(e.state)+'</dd></dl>';
        const form=e.state==='PENDING_HUMAN'?'<form method="post" action="'+ADMIN+'/enrollments/'+e.enrollmentId+'/decision"><input type="hidden" name="csrf" value="'+token+'"><button name="decision" value="approve">Approve</button><button name="decision" value="deny">Deny</button></form>':'';
        res.type('html').send(html('VCPChat human enrollment',fields+form));
    });
    r.post('/enrollments/:id/decision',(req,res)=>{shape(req.body,['csrf','decision']);if(!['approve','deny'].includes(req.body.decision))fail('INVALID_ENROLLMENT');const a=req.humanAdmission;a.enrollment(req.params.id);a.consumeCsrf(principal(req),'enrollment:'+req.params.id,req.body.csrf);res.json(a.browserDecision(req.params.id,req.body.decision));});
    r.get('/sessions',(req,res)=>{
        const a=req.humanAdmission;const sessions=a.clients();a.assertCsrfCapacity(sessions.length);const items=sessions.map(s=>{const token=a.csrf(principal(req),'session:'+s.clientEnrollmentId);return '<section><pre>'+escape(JSON.stringify(s,null,2))+'</pre><form method="post" action="'+ADMIN+'/sessions/'+s.clientEnrollmentId+'/revoke"><input type="hidden" name="csrf" value="'+token+'"><button>Revoke session</button></form></section>';}).join('');
        res.type('html').send(html('Human client sessions',items));
    });
    r.post('/sessions/:id/revoke',(req,res)=>{shape(req.body,['csrf']);const a=req.humanAdmission;a.consumeCsrf(principal(req),'session:'+req.params.id,req.body.csrf);res.json(a.revoke(req.params.id));});
    return finish(r);
}
module.exports={createClientRouter,createAdminRouter};
