'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {messageHash,tombstoneHash}=require('../Plugin/NativeSync/sync/protocol');
const {envelopeFor}=require('../Plugin/NativeSync/sync/metadata');
const {computeMessageFingerprint}=require('../Plugin/NativeSync/sync/canonical/hash');
const {effectiveRequest}=require('../Plugin/NativeSync/mobile/effectiveContext');
const id={ownerType:'agent',ownerId:'synthetic-agent',topicId:'synthetic-topic',msgId:'checkpoint'};
const old={id:id.msgId,role:'user',content:'before\nSYNTHETIC_CHECKPOINT\nafter',timestamp:10};
const checkpoint={...old,contextCompaction:{kind:'vchat-context-checkpoint',version:1,checkpoint:'SYNTHETIC_CHECKPOINT',diaries:[{agent:'synthetic',content:'synthetic retained diary'}],sourceCount:7,warnings:[]}};
const op=(message,opId,baseHash=null)=>({...id,deviceId:'synthetic-desktop',opId,baseHash,action:'upsert',message});
test('same-content checkpoint backfill has independent authorized consecutive versions and a catch-up event',()=>{
 const store=new CentralStore(':memory:');try{
  const initial=store.apply(op(old,'initial'));assert.equal(initial.seq,1);
  assert.equal(messageHash(checkpoint),initial.hash);assert.equal(computeMessageFingerprint(checkpoint),initial.hash);
  const update={...op(checkpoint,'backfill',initial.hash),metadata:envelopeFor(checkpoint,1)};
  assert.throws(()=>store.apply(update),e=>e.code==='METADATA_PUBLISHER_REQUIRED');assert.equal(store.metrics().journalRows,1);
  const result=store.apply(update,{metadataPublisher:true});assert.equal(result.seq,2);assert.equal(result.hash,initial.hash);
  assert.equal(store.apply({...update,opId:'repeat'},{metadataPublisher:true}).seq,2);
  const events=store.pull(1).events;assert.equal(events.length,1);assert.equal(events[0].message.contextCompaction.checkpoint,'SYNTHETIC_CHECKPOINT');
  assert.equal(events[0].message.timestamp,old.timestamp);assert.equal(events[0].hash,initial.hash);
  assert.deepEqual(events[0].message.contextCompaction.diaries,checkpoint.contextCompaction.diaries);
  store.apply({...op(old,'old-client',initial.hash)});assert.equal(store.metrics().journalRows,2);
  const clear={...op(old,'clear',initial.hash),metadata:envelopeFor(old,2)};store.apply(clear,{metadataPublisher:true});
  assert.throws(()=>store.apply({...update,opId:'downgrade'},{metadataPublisher:true}),e=>e.code==='METADATA_VERSION_CONFLICT');
  assert.equal(store.metrics().journalRows,3);
 }finally{store.close();}
});
test('checkpoint validation binds body, role, kind, size and digest; tombstones cannot be resurrected by metadata',()=>{
 const store=new CentralStore(':memory:');try{
  const initial=store.apply(op(old,'initial'));
  assert.throws(()=>envelopeFor({...checkpoint,role:'assistant'},1),e=>e.code==='INVALID_CHECKPOINT_METADATA');
  assert.throws(()=>envelopeFor({...checkpoint,contextCompaction:{...checkpoint.contextCompaction,checkpoint:'not in body'}},1),e=>e.code==='INVALID_CHECKPOINT_METADATA');
  const update={...op(checkpoint,'bad',initial.hash),metadata:{...envelopeFor(checkpoint,1),hash:'0'.repeat(64)}};
  assert.throws(()=>store.apply(update,{metadataPublisher:true}),e=>e.code==='INVALID_METADATA_DIGEST');
  const removed=store.apply({...id,deviceId:'synthetic-desktop',opId:'delete',action:'delete',baseHash:initial.hash});
  assert.equal(removed.hash,tombstoneHash(id));
  assert.throws(()=>store.apply({...op(checkpoint,'revive',removed.hash),metadata:envelopeFor(checkpoint,1)},{metadataPublisher:true}),e=>e.code==='METADATA_TOMBSTONED');
  assert.equal(store.metrics().liveMessages,0);assert.equal(store.metrics().journalRows,2);
 }finally{store.close();}
});
test('metadata durability survives SQLite reopen with stable fingerprint and original ordering fields',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-metadata-')),file=path.join(root,'central.sqlite');let store=new CentralStore(file);
 try{
  const first=store.apply(op(old,'initial'));store.apply({...op(checkpoint,'backfill',first.hash),metadata:envelopeFor(checkpoint,1)},{metadataPublisher:true});store.close();store=new CentralStore(file);
  const message=store.pull(0).events.at(-1).message;assert.equal(message.id,old.id);assert.equal(message.content,old.content);assert.equal(message.timestamp,10);assert.equal(messageHash(message),first.hash);
  assert.equal(store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{store.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('effective context uses latest author checkpoint, omits thinking, retains tool identity and applies native Tavern rules',async()=>{
 const config={systemPrompt:'synthetic-agent',tavernRules:[{id:'sys',type:'system_suffix',scope:'agent',enabled:true,content:'system suffix',wrap:false},{id:'user',type:'user_suffix',scope:'agent',enabled:true,content:'user suffix',wrap:false}]};
 const history=[{id:'old',role:'user',content:'excluded history',timestamp:1},checkpoint,{id:'a1',role:'assistant',content:'completed predecessor',timestamp:11},{id:'temp',role:'assistant',content:'exclude thinking',timestamp:12,isThinking:true},{id:'u2',role:'user',content:'continue',timestamp:13}];
 const result=await effectiveRequest(history,config,'u2');
 assert.deepEqual(result.slice(1).map(m=>m.__vcpchatTimestampMeta.messageId),['checkpoint','a1','u2']);
 assert.equal(result[1].content[0].text,checkpoint.content);assert.equal(result[1].__vcpContextCheckpoint,true);
 assert.ok(result[0].content.includes('system suffix'));assert.ok(result.at(-1).content[0].text.includes('user suffix'));
 const tool=await effectiveRequest([{id:'call',role:'assistant',content:'',timestamp:1,tool_calls:[{id:'x',type:'function',function:{name:'synthetic',arguments:'{}'}}]},{id:'result',role:'tool',content:'safe tool result',timestamp:2,tool_call_id:'x'}],{systemPrompt:'synthetic'},'none');
 assert.equal(tool[1].tool_calls[0].id,'x');assert.equal(tool[2].tool_call_id,'x');
});
test('legacy HTTP pull explicitly refuses versioned metadata while protocol2 receives it',async()=>{
 const store=new CentralStore(':memory:');const {createSyncHttpService}=require('../Plugin/NativeSync/sync/httpService');const service=createSyncHttpService(store);
 store.apply({...op(checkpoint,'initial'),metadata:envelopeFor(checkpoint,1)},{metadataPublisher:true});
 const server=http.createServer(service.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/pull?after_seq=0`;
 try{
  const old=await fetch(url);assert.equal(old.status,409);assert.equal((await old.json()).error.code,'METADATA_PROTOCOL_UPGRADE_REQUIRED');
  const fresh=await fetch(url,{headers:{'X-NativeSync-Protocol':'2'}});assert.equal(fresh.status,200);assert.equal((await fresh.json()).events[0].message._nativeSyncMetadata.version,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await service.close();}
});
test('legacy stored JSON cannot forge metadata authority during schema upgrade',()=>{
 const {DatabaseSync}=require('node:sqlite');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-legacy-')),file=path.join(root,'central.sqlite');
 const legacy=new DatabaseSync(file),forged={...checkpoint,_nativeSyncMetadata:envelopeFor(checkpoint,1)},hash=messageHash(old);
 legacy.exec(`CREATE TABLE messages(owner_type TEXT,owner_id TEXT,topic_id TEXT,msg_id TEXT,hash TEXT,deleted INTEGER,message_json TEXT,last_seq INTEGER,PRIMARY KEY(owner_type,owner_id,topic_id,msg_id));CREATE TABLE journal(seq INTEGER PRIMARY KEY AUTOINCREMENT,owner_type TEXT,owner_id TEXT,topic_id TEXT,msg_id TEXT,action TEXT,hash TEXT,message_json TEXT,device_id TEXT);`);
 legacy.prepare('INSERT INTO messages VALUES(?,?,?,?,?,0,?,1)').run(id.ownerType,id.ownerId,id.topicId,id.msgId,hash,JSON.stringify(forged));
 legacy.prepare("INSERT INTO journal(owner_type,owner_id,topic_id,msg_id,action,hash,message_json,device_id) VALUES(?,?,?,?,'upsert',?,?,'legacy')").run(id.ownerType,id.ownerId,id.topicId,id.msgId,hash,JSON.stringify(forged));legacy.close();
 const store=new CentralStore(file);try{
  const result=store.pull(0).events[0];assert.equal(result.hash,hash);assert.equal(result.message.contextCompaction,undefined);assert.equal(result.message._nativeSyncMetadata,undefined);
  const updated=store.apply({...op(checkpoint,'authorized-backfill',hash),metadata:envelopeFor(checkpoint,1)},{metadataPublisher:true});assert.equal(updated.seq,2);assert.equal(store.pull(1).events[0].message.contextCompaction.kind,checkpoint.contextCompaction.kind);
 }finally{store.close();fs.rmSync(root,{recursive:true,force:true});}
});
