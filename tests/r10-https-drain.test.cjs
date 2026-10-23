'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const https=require('node:https'),net=require('node:net'),tls=require('node:tls'),{execFileSync}=require('node:child_process');
const {createListener,drainListener,listenerState}=require('../Plugin/NativeSync/mobile/httpsListener');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore'),{createSyncHttpService}=require('../Plugin/NativeSync/sync/httpService');
let root,options;const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function listen(s){await new Promise(r=>s.listen(0,'127.0.0.1',r));return s.address().port;}
async function within(p){return Promise.race([p,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Listener drain timed out')),1000);t.unref();})]);}
before(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'r10-tls-drain-'));execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=synthetic.invalid','-keyout',path.join(root,'synthetic.key'),'-out',path.join(root,'synthetic.crt')],{stdio:'ignore'});options={key:fs.readFileSync(path.join(root,'synthetic.key')),cert:fs.readFileSync(path.join(root,'synthetic.crt'))};});
after(()=>{assert.ok(path.basename(root).startsWith('r10-tls-drain-'));fs.rmSync(root,{recursive:true,force:true});});

test('pre-fix HTTPS close remains pending on an unrequested TLS preconnect',async()=>{
 const s=https.createServer(options,(_q,r)=>r.end('synthetic'));const port=await listen(s);let accepted;const connection=new Promise(r=>accepted=r);s.once('connection',accepted);
 const raw=net.connect(port,'127.0.0.1');await connection;let closed=false;const closing=new Promise(r=>s.close(()=>{closed=true;r();}));s.closeIdleConnections();await pause(30);assert.equal(closed,false);
 raw.destroy();await within(closing);
});

test('R10 drains both unfinished TLS and established idle HTTPS preconnects, idempotently',async()=>{
 const s=createListener(options,(_q,r)=>r.end('synthetic'));const port=await listen(s);
 const raw=net.connect(port,'127.0.0.1');await new Promise(r=>raw.once('connect',r));
 const secure=tls.connect({host:'127.0.0.1',port,rejectUnauthorized:false});await new Promise(r=>secure.once('secureConnect',r));await pause(10);
 assert.equal(listenerState(s).connections,2);assert.equal(listenerState(s).activeRequests,0);
 const closing=drainListener(s);assert.equal(drainListener(s),closing);await within(closing);assert.equal(listenerState(s).connections,0);raw.destroy();secure.destroy();
});

test('R10 lets an accepted partial JSON push persist and acknowledge before HTTP/SQLite close',async()=>{
 const store=new CentralStore(path.join(root,'synthetic.sqlite')),service=createSyncHttpService(store);let entered;
 const received=new Promise(r=>entered=r);const s=createListener(options,(q,r)=>{entered();return service.handle(q,r);});const port=await listen(s);
 const op={ownerType:'agent',ownerId:'synthetic',topicId:'topic',msgId:'one',deviceId:'test-device',opId:'test-operation',action:'upsert',baseHash:null,message:{id:'one',role:'user',content:'synthetic',timestamp:1}},body=JSON.stringify(op);
 let request;const response=new Promise((resolve,reject)=>{request=https.request({host:'127.0.0.1',port,path:'/push',method:'POST',rejectUnauthorized:false,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},r=>{let data='';r.on('data',b=>data+=b);r.on('end',()=>resolve({status:r.statusCode,body:JSON.parse(data)}));});request.on('error',reject);});
 request.write(body.slice(0,12));await received;assert.equal(listenerState(s).activeRequests,1);
 let ended=false;const closing=drainListener(s).then(()=>{ended=true;});await pause(30);assert.equal(ended,false);request.end(body.slice(12));
 const result=await response;assert.equal(result.status,200);assert.equal(result.body.seq,1);await within(closing);assert.equal(store.metrics().journalRows,1);await service.close();
});
