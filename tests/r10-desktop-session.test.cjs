'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const express=require('express');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {createSyncHttpService}=require('../Plugin/NativeSync/sync/httpService');
const {DesktopSessions}=require('../Plugin/NativeSync/mobile/desktopSessions');
const topics=[{ownerType:'agent',ownerId:'synthetic-owner',topicId:'old-topic'}];
const token=()=> 'vcp_sync_'+crypto.randomBytes(32).toString('base64url');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r10-desktop-session-')),file=path.join(dir,'central.sqlite'),store=new CentralStore(file);t.after(()=>{try{store.close();}catch{}fs.rmSync(dir,{recursive:true,force:true});});return {store,file,grants:new DesktopSessions(store.db,topics)};}
const request=(secret,url='/api/v1/sync/pull?after_seq=0',body)=>({headers:{authorization:'Bearer '+secret},method:body?'POST':'GET',originalUrl:url,body});
test('dedicated desktop grant persists only a digest, expires, rotates and revokes without a host key',t=>{
 const {store,grants,file}=fixture(t),secret=token(),grant={deviceId:'desktop',token:secret,topics};
 grants.register(grant);assert.equal(grants.authorize(request(secret)).deviceId,'desktop');
 assert.equal(JSON.stringify(store.db.prepare('SELECT * FROM native_desktop_sessions').all()).includes(secret),false);
 const reopened=new CentralStore(file);assert.equal(new DesktopSessions(reopened.db,topics).authorize(request(secret)).deviceId,'desktop');reopened.close();
 assert.throws(()=>grants.authorize(request(secret),Date.now()+31*86400000),e=>e.code==='DESKTOP_SESSION_REQUIRED');
 const replacement=token();grants.register({...grant,token:replacement});assert.throws(()=>grants.authorize(request(secret)),e=>e.status===401);assert.equal(grants.revoke('desktop'),true);assert.throws(()=>grants.authorize(request(replacement)),e=>e.status===401);
 assert.equal(store.metrics().journalRows,0);
});
test('device scope and route boundaries reject identity changes, arbitrary APIs and catalog escalation',t=>{
 const {store,grants}=fixture(t),secret=token();grants.register({deviceId:'desktop',token:secret,topics});
 const op={...topics[0],deviceId:'desktop',msgId:'synthetic-id',opId:'op',action:'upsert',baseHash:null,message:{id:'synthetic-id',role:'user',content:'synthetic',timestamp:1}};
 assert.equal(grants.authorize(request(secret,'/api/v1/sync/push',op)).deviceId,'desktop');
 for(const url of ['/api/plugins/NativeSync/mobile/pairing','/v1/chat/completions','/api/v1/sync/push/extra','/api/v1/sync/push%2fextra'])assert.throws(()=>grants.authorize(request(secret,url,op)),e=>e.code==='DESKTOP_ROUTE_FORBIDDEN');
 assert.throws(()=>grants.authorize(request(secret,'/api/v1/sync/push',{...op,deviceId:'other'})),e=>e.code==='DESKTOP_DEVICE_MISMATCH');
 assert.throws(()=>grants.authorize(request(secret,'/api/v1/sync/push',{...op,ownerId:'other'})),e=>e.code==='DESKTOP_TOPIC_FORBIDDEN');
 assert.throws(()=>grants.authorize(request(secret,'/api/plugins/NativeSync/mobile/catalog',{topics:[{...topics[0],topicId:'other'}]})),e=>e.code==='DESKTOP_TOPIC_FORBIDDEN');
 assert.throws(()=>grants.register({deviceId:'desktop',token:secret,topics:[{...topics[0],topicId:'other'}]}),e=>e.code==='DESKTOP_SCOPE_MISMATCH');
 assert.throws(()=>new DesktopSessions(store.db,[{...topics[0],topicId:'other'}]).authorize(request(secret)),e=>e.code==='DESKTOP_SESSION_REQUIRED');
 assert.equal(store.metrics().journalRows,0);
});
test('real HTTP sync routes accept scoped push/pull and refuse out-of-scope data without leaking it',async t=>{
 const {store,grants}=fixture(t),secret=token();grants.register({deviceId:'desktop',token:secret,topics});
 const service=createSyncHttpService(store),app=express();app.use(express.json());app.use((q,r,next)=>{try{grants.authorize(q);next();}catch(e){r.status(e.status).json({error:{code:e.code}});}});app.use('/api/v1/sync',service.handle);app.use('/api/plugins/NativeSync/sync',service.handle);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(r=>server.close(r)));
 const send=(route,body,auth=secret)=>fetch('http://127.0.0.1:'+server.address().port+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const op={...topics[0],deviceId:'desktop',msgId:'message',opId:'one',action:'upsert',baseHash:null,message:{id:'message',role:'user',content:'synthetic selected',timestamp:1}};
 assert.equal((await send('/api/v1/sync/pull','',token())).status,401);
 assert.equal((await send('/api/v1/sync/push',op)).status,200);assert.equal((await send('/api/v1/sync/push',op)).status,200);assert.equal(store.metrics().journalRows,1);
 const pulled=await(await send('/api/plugins/NativeSync/sync/pull?after_seq=0')).json();assert.equal(pulled.events.length,1);assert.equal(pulled.events[0].message.content,'synthetic selected');
 assert.equal((await send('/api/v1/sync/push',{...op,ownerId:'other',opId:'bad'})).status,403);
 store.apply({...op,ownerId:'unselected-owner',opId:'separate-authority',message:{...op.message,content:'OUTSIDE_SCOPE_MARKER'}});
 const filtered=await send('/api/v1/sync/pull?after_seq=0');assert.equal(filtered.status,200);const body=await filtered.text();assert.equal(body.includes('OUTSIDE_SCOPE_MARKER'),false);const page=JSON.parse(body);assert.equal(page.events.length,1);assert.equal(page.nextSeq,2);assert.equal(page.hasMore,false);
});
