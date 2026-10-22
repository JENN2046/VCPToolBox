'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {HostCredential}=require('../Plugin/NativeSync/mobile/hostCredential');
async function listen(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return server.address().port;}
test('host Key is verified only on loopback, encrypted at rest and recovered without production config reads',async t=>{
 const key='synthetic-once-entered-key';let calls=0;const backend=http.createServer((q,r)=>{calls++;r.writeHead(q.url==='/v1/models'&&q.headers.authorization==='Bearer '+key?200:401,{'Content-Type':'application/json'});r.end('{}');});const port=await listen(backend);t.after(()=>new Promise(r=>backend.close(r)));
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'r10-host-auth-'));let c=new HostCredential({dataDir,backend:'http://127.0.0.1:'+port});assert.equal(await c.verifyAndRemember('synthetic-wrong'),false);assert.equal(c.key,null);assert.equal(await c.verifyAndRemember(key),true);assert.equal(c.matches(key),true);assert.equal(c.matches('other'),false);
 const encrypted=c.db.prepare('SELECT cipher FROM mobile_host_credential').get().cipher;assert.equal(Buffer.from(encrypted).includes(Buffer.from(key)),false);c.close();c=new HostCredential({dataDir,backend:'http://127.0.0.1:'+port});assert.equal(c.matches(key),true);assert.equal(calls,2);c.close();
 assert.throws(()=>new HostCredential({dataDir,backend:'http://remote.invalid:6005'}),/LOCAL_TOOLBOX_AUTHORITY_REQUIRED/);
});
test('old-topic execution waits for the selected original history, and tombstones retain import readiness',async()=>{
 const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore'),{ConversationExecution,historyReady}=require('../Plugin/NativeSync/mobile/execution');const store=new CentralStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(),'r10-import-gate-')),'central.sqlite'));
 const topic={key:'selected',ownerType:'agent',ownerId:'original-owner',topicId:'original-topic',agentAlias:'Original',model:'original-model',requiredMessageIds:['old-id']};const engine=new ConversationExecution({store,topics:[topic],agentManager:{isAgent:()=>true}});engine.beginDrain();
 const request={topicKey:'selected',requestId:'new-request',text:'synthetic continuation'};assert.throws(()=>engine.accept('device',request),e=>e.code==='HISTORY_IMPORT_PENDING');
 const op={ownerType:topic.ownerType,ownerId:topic.ownerId,topicId:topic.topicId,msgId:'old-id',deviceId:'desktop',opId:'import-old',action:'upsert',baseHash:null,message:{id:'old-id',role:'user',content:'synthetic old history',timestamp:1}};const ack=store.apply(op);assert.equal(historyReady(store.db,topic),true);store.apply({...op,opId:'delete-old',action:'delete',baseHash:ack.hash,message:null});assert.equal(historyReady(store.db,topic),true);assert.equal(engine.accept('device',request).state,'queued');await engine.close();store.close();
});

test('R10 refuses legacy HTTP profiles and missing TLS before it can listen',()=>{
 const {tlsOptions,ORIGIN}=require('../Plugin/NativeSync/mobile/httpsListener');
 assert.throws(()=>tlsOptions({port:8888,publicHttpOrigin:'http://dnvcp.skmt617.top:13848'}),/R10_HTTPS_ONLY_PROFILE_REQUIRED/);
 assert.throws(()=>tlsOptions({port:8888,httpsOrigin:ORIGIN}),/R10_TLS_CERTIFICATE_REQUIRED/);
});

test('TLS listener verifies domain, chain and key, serves HTTPS and rejects cleartext',async t=>{
 const {execFileSync}=require('node:child_process'),https=require('node:https'),net=require('node:net');
 const {tlsOptions,createListener,ORIGIN}=require('../Plugin/NativeSync/mobile/httpsListener');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r10-tls-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=n=>path.join(dir,n),openssl=args=>execFileSync('openssl',args,{cwd:dir,stdio:'ignore'});
 openssl(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=R10 synthetic test CA','-addext','basicConstraints=critical,CA:TRUE','-keyout','ca.key','-out','ca.crt']);
 openssl(['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=dnvcp.skmt617.top','-keyout','leaf.key','-out','leaf.csr']);fs.chmodSync(file('leaf.key'),0o600);
 fs.writeFileSync(file('leaf.ext'),'subjectAltName=DNS:dnvcp.skmt617.top\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
 openssl(['x509','-req','-in','leaf.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-days','1','-extfile','leaf.ext','-out','leaf.crt']);
 const config={port:8888,httpsOrigin:ORIGIN,tls:{certFile:file('leaf.crt'),keyFile:file('leaf.key')}};
 const old=process.env.SSL_CERT_FILE,oldDir=process.env.SSL_CERT_DIR;t.after(()=>{if(old===undefined)delete process.env.SSL_CERT_FILE;else process.env.SSL_CERT_FILE=old;if(oldDir===undefined)delete process.env.SSL_CERT_DIR;else process.env.SSL_CERT_DIR=oldDir;});
 process.env.SSL_CERT_FILE=file('absent');process.env.SSL_CERT_DIR=dir;assert.throws(()=>tlsOptions(config),/R10_TLS_CHAIN_UNTRUSTED/);
 process.env.SSL_CERT_FILE=file('ca.crt');
 const options=tlsOptions(config),server=createListener(options,(_q,r)=>r.end('protected-r10'));options.key.fill(0);
 const port=await listen(server);t.after(()=>new Promise(r=>server.close(r)));
 const result=await new Promise((resolve,reject)=>{https.get({host:'127.0.0.1',port,servername:'dnvcp.skmt617.top',ca:fs.readFileSync(file('ca.crt'))},r=>{let body='';r.on('data',b=>body+=b);r.on('end',()=>resolve({status:r.statusCode,body}));}).on('error',reject);});assert.deepEqual(result,{status:200,body:'protected-r10'});
 const plaintext=await new Promise((resolve,reject)=>{let data='';const s=net.connect(port,'127.0.0.1',()=>s.write('GET / HTTP/1.1\r\nHost: dnvcp.skmt617.top\r\n\r\n'));s.setTimeout(3000,()=>{s.destroy();reject(Error('cleartext did not close'));});s.on('data',b=>data+=b);s.on('error',()=>{});s.on('close',()=>resolve(data));});assert.equal(plaintext,'');
 const wrong={...config,tls:{certFile:file('leaf.crt'),keyFile:file('ca.key')}};assert.throws(()=>tlsOptions(wrong),/R10_TLS_IDENTITY_INVALID/);
});
