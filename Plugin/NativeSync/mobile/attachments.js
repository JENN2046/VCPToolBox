'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {identity,canonicalMessage}=require('../sync/protocol');
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const CHUNK=65536,MAX_FILE=20*1024*1024,MAX_STORAGE=512*1024*1024,TTL=24*3600000;
const byIdentity=t=>JSON.stringify([t.ownerType,t.ownerId,t.topicId]);
function regular(file){const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw fail('ATTACHMENT_PATH_ALIAS');return s;}
function directory(target){
 let current=path.parse(target).root;
 for(const part of target.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.existsSync(current)){const s=fs.lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())throw fail('ATTACHMENT_PATH_ALIAS');}else fs.mkdirSync(current,{mode:0o700});}
}
function detect(bytes,name){
 let type;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))type='image/png';
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';
 else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')type='image/webp';
 else if(bytes.toString('ascii',0,5)==='%PDF-')type='application/pdf';
 else {try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail('ATTACHMENT_TYPE_REJECTED',415);}if(bytes.includes(0))throw fail('ATTACHMENT_TYPE_REJECTED',415);type='text/plain';}
 const extensions={'image/png':['.png'],'image/jpeg':['.jpg','.jpeg'],'image/webp':['.webp'],'application/pdf':['.pdf'],'text/plain':['.txt','.md','.csv','.json']};
 if(!extensions[type].includes(path.extname(name).toLowerCase()))throw fail('ATTACHMENT_TYPE_REJECTED',415);
 return type;
}
class AttachmentStore{
 constructor({store,root,topics,extractPdf}){
  if(!path.isAbsolute(root))throw fail('ATTACHMENT_DEDICATED_ROOT_REQUIRED');
  this.store=store;this.db=store.db;this.root=path.join(root,'attachments');this.topics=new Map(topics.map(t=>[t.key,t]));this.extractPdf=extractPdf||require('./pdfText').extractPdfText;this.finishing=new Map();this.closing=false;this.requestBudgets=new Map();
  directory(this.root);directory(path.join(this.root,'temporary'));
  this.db.exec(`CREATE TABLE IF NOT EXISTS attachment_uploads(id TEXT PRIMARY KEY,principal TEXT NOT NULL,topic_key TEXT NOT NULL,request_id TEXT NOT NULL,name TEXT NOT NULL,declared_type TEXT,size INTEGER NOT NULL,expected_hash TEXT,offset INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,state TEXT NOT NULL,hash TEXT,actual_type TEXT,extracted_text TEXT,parse_error TEXT,msg_id TEXT,attachment_id TEXT,UNIQUE(principal,topic_key,request_id));
   CREATE TABLE IF NOT EXISTS attachment_blobs(hash TEXT PRIMARY KEY,size INTEGER NOT NULL,type TEXT NOT NULL,state TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS attachment_links(topic_identity TEXT NOT NULL,msg_id TEXT NOT NULL,attachment_id TEXT NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(topic_identity,msg_id,attachment_id));`);
  if(!this.db.prepare('PRAGMA table_info(attachment_uploads)').all().some(c=>c.name==='frame_index'))this.db.exec('ALTER TABLE attachment_uploads ADD COLUMN frame_index INTEGER');
  this.db.exec('CREATE TABLE IF NOT EXISTS attachment_frames(topic_identity TEXT NOT NULL,msg_id TEXT NOT NULL,attachment_id TEXT NOT NULL,frame_index INTEGER NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(topic_identity,msg_id,attachment_id,frame_index))');
  store.attachments=this;
 }
 topic(key){const t=this.topics.get(key);if(!t)throw fail('TOPIC_NOT_ALLOWED',403);return t;}
 temporary(id){if(!/^[a-f0-9-]{36}$/.test(id))throw fail('UPLOAD_NOT_FOUND',404);return path.join(this.root,'temporary',id);}
 blobPath(value){if(!/^[a-f0-9]{64}$/.test(value))throw fail('INVALID_ATTACHMENT_HASH',400);return path.join(this.root,value.slice(0,2),value);}
 begin(principal,key,input){
  if(this.closing)throw fail('ATTACHMENT_SERVICE_DRAINING',503);
  this.expire();
  this.topic(key);
  const keys=['requestId','name','type','size','expectedHash','messageId','attachmentId','frameIndex'];
  if(!input||Object.keys(input).some(k=>!keys.includes(k))||typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId)||typeof input.name!=='string'||!input.name||input.name.length>200||/[\\/:\x00-\x1f]/.test(input.name)||!Number.isSafeInteger(input.size)||input.size<1||input.size>MAX_FILE||(input.expectedHash!==undefined&&!/^[a-f0-9]{64}$/.test(input.expectedHash))||(input.type!==undefined&&(typeof input.type!=='string'||input.type.length>100)))throw fail('INVALID_ATTACHMENT_UPLOAD',400);
  for(const k of ['messageId','attachmentId'])if(input[k]!==undefined&&(typeof input[k]!=='string'||!input[k]||input[k].length>200))throw fail('INVALID_ATTACHMENT_UPLOAD',400);
  if(input.frameIndex!==undefined&&(!Number.isSafeInteger(input.frameIndex)||input.frameIndex<0||input.frameIndex>=10||!input.messageId||!input.attachmentId))throw fail('INVALID_ATTACHMENT_UPLOAD',400);
  const previous=this.db.prepare('SELECT * FROM attachment_uploads WHERE principal=? AND topic_key=? AND request_id=?').get(principal,key,input.requestId);
  if(previous){if(previous.expires<=Date.now())throw fail('UPLOAD_EXPIRED',410);if(previous.name!==input.name||previous.size!==input.size||previous.expected_hash!==(input.expectedHash||null)||previous.msg_id!==(input.messageId||null)||previous.attachment_id!==(input.attachmentId||null)||previous.frame_index!==(input.frameIndex??null))throw fail('UPLOAD_ID_REUSED');return this.public(previous);}
  if(this.db.prepare("SELECT count(*) AS n FROM attachment_uploads WHERE principal=? AND state!='ready' AND expires>?").get(principal,Date.now()).n>=16||this.db.prepare('SELECT count(*) AS n FROM attachment_uploads WHERE principal=? AND expires>?').get(principal,Date.now()+TTL-3600000).n>=200)throw fail('ATTACHMENT_UPLOAD_BUDGET',429);
  const used=this.db.prepare("SELECT (SELECT coalesce(sum(size),0) FROM attachment_blobs)+(SELECT coalesce(sum(size),0) FROM attachment_uploads WHERE state!='ready') AS n").get().n;
  if(used+input.size>MAX_STORAGE)throw fail('ATTACHMENT_STORAGE_BUDGET',413);
  const id=randomUUID(),file=this.temporary(id);const fd=fs.openSync(file,'wx',0o600);fs.fsyncSync(fd);fs.closeSync(fd);
  try{this.db.prepare("INSERT INTO attachment_uploads(id,principal,topic_key,request_id,name,declared_type,size,expected_hash,expires,state,msg_id,attachment_id,frame_index) VALUES(?,?,?,?,?,?,?,?,?,'uploading',?,?,?)").run(id,principal,key,input.requestId,input.name,input.type||null,input.size,input.expectedHash||null,Date.now()+TTL,input.messageId||null,input.attachmentId||null,input.frameIndex??null);}catch(e){fs.unlinkSync(file);throw e;}
  return this.public(this.get(principal,key,id));
 }
 get(principal,key,id){this.topic(key);const r=this.db.prepare('SELECT * FROM attachment_uploads WHERE id=? AND principal=? AND topic_key=?').get(id,principal,key);if(!r)throw fail('UPLOAD_NOT_FOUND',404);if(r.expires<=Date.now()&&r.state!=='ready')throw fail('UPLOAD_EXPIRED',410);return r;}
 public(r){return {uploadId:r.id,offset:r.offset,size:r.size,chunkSize:CHUNK,state:r.state,hash:r.hash||null,type:r.actual_type||null,parseError:r.parse_error||null};}
 chunk(principal,key,id,input){
  if(this.closing)throw fail('ATTACHMENT_SERVICE_DRAINING',503);
  const r=this.get(principal,key,id);if(r.state!=='uploading')return this.public(r);
  if(!input||Object.keys(input).some(k=>!['offset','data'].includes(k))||!Number.isSafeInteger(input.offset)||input.offset<0||typeof input.data!=='string'||input.data.length>Math.ceil(CHUNK/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))throw fail('INVALID_UPLOAD_CHUNK',400);
  const bytes=Buffer.from(input.data,'base64');if(!bytes.length||bytes.length>CHUNK||input.offset+bytes.length>r.size)throw fail('INVALID_UPLOAD_CHUNK',400);
  const file=this.temporary(id);regular(file);const fd=fs.openSync(file,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW);
  try{
   if(input.offset<r.offset){const previous=Buffer.alloc(bytes.length);fs.readSync(fd,previous,0,bytes.length,input.offset);if(input.offset+bytes.length>r.offset||!previous.equals(bytes))throw fail('UPLOAD_OFFSET_CONFLICT');return this.public(r);}
   if(input.offset!==r.offset)throw fail('UPLOAD_OFFSET_CONFLICT');
   fs.writeSync(fd,bytes,0,bytes.length,input.offset);fs.ftruncateSync(fd,input.offset+bytes.length);fs.fsyncSync(fd);
   this.db.prepare('UPDATE attachment_uploads SET offset=? WHERE id=?').run(input.offset+bytes.length,id);
  }finally{fs.closeSync(fd);}
  return this.public(this.get(principal,key,id));
 }
 finish(principal,key,id){
  if(this.closing)return Promise.reject(fail('ATTACHMENT_SERVICE_DRAINING',503));
  const existing=this.finishing.get(id);if(existing){this.get(principal,key,id);return existing;}
  const work=this.complete(principal,key,id).finally(()=>this.finishing.delete(id));this.finishing.set(id,work);return work;
 }
 async complete(principal,key,id){
  const r=this.get(principal,key,id);if(r.state==='ready'){this.readBlob(r.hash);this.linkExisting(r);return this.public(r);}
  if(r.offset!==r.size)throw fail('UPLOAD_INCOMPLETE');
  const temp=this.temporary(id);let bytes;if(fs.existsSync(temp)){regular(temp);bytes=fs.readFileSync(temp);}else if(r.state==='finalizing'&&r.hash)bytes=this.readBlob(r.hash);else throw fail('UPLOAD_BINARY_MISSING');const digest=hash(bytes);
  if(bytes.length!==r.size||(r.expected_hash&&digest!==r.expected_hash))throw fail('ATTACHMENT_HASH_MISMATCH');
  const type=detect(bytes,r.name);if(r.declared_type&&r.declared_type!==type&&!(type==='text/plain'&&['text/markdown','text/csv','application/json'].includes(r.declared_type)))throw fail('ATTACHMENT_TYPE_REJECTED',415);
  if(type.startsWith('image/')){try{const info=await require('sharp')(bytes,{limitInputPixels:32000000}).metadata();if(!info.width||!info.height)throw Error();}catch{throw fail('ATTACHMENT_TYPE_REJECTED',415);}}
  this.db.prepare("UPDATE attachment_uploads SET state='finalizing',hash=?,actual_type=? WHERE id=?").run(digest,type,id);
  const file=this.blobPath(digest);directory(path.dirname(file));
  this.db.prepare("INSERT INTO attachment_blobs(hash,size,type,state) VALUES(?,?,?,'staging') ON CONFLICT(hash) DO NOTHING").run(digest,bytes.length,type);
  if(fs.existsSync(file)){const present=this.readBlob(digest);if(!present.equals(bytes))throw fail('ATTACHMENT_BLOB_CORRUPT');}
  else {fs.renameSync(temp,file);const fd=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
  this.db.prepare("UPDATE attachment_blobs SET state='ready' WHERE hash=?").run(digest);
  let text=null,parseError=null;
  try{if(type==='text/plain')text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);else if(type==='application/pdf')text=await this.extractPdf(bytes);if(text!==null&&(typeof text!=='string'||Buffer.byteLength(text)>512000))throw fail('ATTACHMENT_TEXT_TOO_LARGE');}
  catch(e){text=null;parseError=e.code==='ATTACHMENT_TEXT_TOO_LARGE'?e.code:'ATTACHMENT_TEXT_UNAVAILABLE';}
  this.db.prepare("UPDATE attachment_uploads SET state='ready',hash=?,actual_type=?,extracted_text=?,parse_error=? WHERE id=?").run(digest,type,text,parseError,id);
  if(fs.existsSync(temp)){regular(temp);fs.unlinkSync(temp);}
  const completed=this.get(principal,key,id);this.linkExisting(completed);return this.public(completed);
 }
 readBlob(digest){
  const file=this.blobPath(digest);directory(path.dirname(file));let stat;try{stat=regular(file);}catch(e){if(e.code==='ENOENT')throw fail('ATTACHMENT_BLOB_MISSING',404);throw e;}
  if(stat.size>MAX_FILE)throw fail('ATTACHMENT_BLOB_CORRUPT');const bytes=fs.readFileSync(file);if(hash(bytes)!==digest)throw fail('ATTACHMENT_BLOB_CORRUPT');return bytes;
 }
 linkExisting(upload){
  if(upload.expires<=Date.now())return;
  if(!upload.msg_id||!upload.attachment_id)return;
  const topic=this.topic(upload.topic_key),row=this.store.findMessage.get(topic.ownerType,topic.ownerId,topic.topicId,upload.msg_id);
  if(!row||row.deleted)return;const message=this.store.projectMessage(row),a=message.attachments?.find(a=>a.id===upload.attachment_id);
  if(upload.frame_index!==null){if(a?.frameHashes?.[upload.frame_index]===upload.hash)this.db.prepare('INSERT INTO attachment_frames VALUES(?,?,?,?,?) ON CONFLICT(topic_identity,msg_id,attachment_id,frame_index) DO UPDATE SET hash=excluded.hash').run(byIdentity(topic),upload.msg_id,a.id,upload.frame_index,upload.hash);return;}
  if(a&&(a.hash===upload.hash||a.blobHash===upload.hash))this.db.prepare('INSERT INTO attachment_links(topic_identity,msg_id,attachment_id,hash) VALUES(?,?,?,?) ON CONFLICT(topic_identity,msg_id,attachment_id) DO UPDATE SET hash=excluded.hash').run(byIdentity(topic),upload.msg_id,a.id,upload.hash);
 }
 associate(id,message,principal){
  if(!message?.attachments?.length)return;const topic=[...this.topics.values()].find(t=>byIdentity(t)===byIdentity(id));if(!topic)return;
  for(const a of message.attachments){const digest=a.blobHash||a.hash;if(!/^[a-f0-9]{64}$/.test(digest||''))continue;
   const grant=this.db.prepare("SELECT id FROM attachment_uploads WHERE principal=? AND topic_key=? AND hash=? AND state='ready' AND expires>? LIMIT 1").get(principal||'',topic.key,digest,Date.now());
   if(grant)this.db.prepare('INSERT INTO attachment_links(topic_identity,msg_id,attachment_id,hash) VALUES(?,?,?,?) ON CONFLICT(topic_identity,msg_id,attachment_id) DO UPDATE SET hash=excluded.hash').run(byIdentity(id),id.msgId,a.id,digest);
   for(const [index,frame]of(a.frameHashes||[]).entries()){const grant=this.db.prepare("SELECT 1 FROM attachment_uploads WHERE principal=? AND topic_key=? AND hash=? AND state='ready' AND expires>? LIMIT 1").get(principal||'',topic.key,frame,Date.now());if(grant)this.db.prepare('INSERT INTO attachment_frames VALUES(?,?,?,?,?) ON CONFLICT(topic_identity,msg_id,attachment_id,frame_index) DO UPDATE SET hash=excluded.hash').run(byIdentity(id),id.msgId,a.id,index,frame);}
  }
 }
 claim(principal,key,ids){
  if(!Array.isArray(ids)||ids.length>8||new Set(ids).size!==ids.length)throw fail('INVALID_ATTACHMENT_SUBMISSION',400);
  return ids.map(id=>{const r=this.get(principal,key,id);if(r.state!=='ready'||r.expires<=Date.now())throw fail('UPLOAD_NOT_READY');this.readBlob(r.hash);return {id:'attachment_'+r.hash,name:r.name,type:r.actual_type,size:r.size,hash:r.hash,...(r.extracted_text!==null?{extractedText:r.extracted_text}:{}),blobHash:r.hash};});
 }
 locate(key,messageId,attachmentId,read=true){
  const t=this.topic(key);identity({...t,msgId:messageId});
  const r=this.store.findMessage.get(t.ownerType,t.ownerId,t.topicId,messageId);if(!r||r.deleted)throw fail('ATTACHMENT_NOT_ALLOWED',403);
  const m=this.store.projectMessage(r),a=m.attachments?.find(a=>a.id===attachmentId);if(!a)throw fail('ATTACHMENT_NOT_ALLOWED',403);
  const link=this.db.prepare('SELECT hash FROM attachment_links WHERE topic_identity=? AND msg_id=? AND attachment_id=?').get(byIdentity(t),messageId,attachmentId);
  if(!link||![a.hash,a.blobHash].includes(link.hash))throw fail('ATTACHMENT_BLOB_MISSING',404);
  const blob=this.db.prepare("SELECT * FROM attachment_blobs WHERE hash=? AND state='ready'").get(link.hash);if(!blob)throw fail('ATTACHMENT_BLOB_MISSING',404);
  if(!read){let s;try{s=regular(this.blobPath(link.hash));}catch(e){if(e.code==='ENOENT')throw fail('ATTACHMENT_BLOB_MISSING',404);throw e;}if(s.size!==blob.size)throw fail('ATTACHMENT_BLOB_CORRUPT');}
  return {attachment:a,blob,...(read?{bytes:this.readBlob(link.hash)}:{})};
 }
 frame(key,messageId,attachmentId,index){
  if(!Number.isSafeInteger(index)||index<0||index>=10)throw fail('ATTACHMENT_NOT_ALLOWED',403);
  const main=this.locate(key,messageId,attachmentId,false),digest=main.attachment.frameHashes?.[index],topic=this.topic(key);
  const link=this.db.prepare('SELECT hash FROM attachment_frames WHERE topic_identity=? AND msg_id=? AND attachment_id=? AND frame_index=?').get(byIdentity(topic),messageId,attachmentId,index);
  if(!digest||link?.hash!==digest)throw fail('ATTACHMENT_BLOB_MISSING',404);
  const blob=this.db.prepare("SELECT * FROM attachment_blobs WHERE hash=? AND state='ready'").get(digest);if(!blob||!blob.type.startsWith('image/'))throw fail('ATTACHMENT_BLOB_MISSING',404);
  return {attachment:main.attachment,blob,bytes:this.readBlob(digest)};
 }
 status(key,messageIds){
  if(!Array.isArray(messageIds)||messageIds.length>100||messageIds.some(id=>typeof id!=='string'||id.length>200))throw fail('INVALID_ATTACHMENT_STATUS',400);
  const topic=this.topic(key),result=[];
  for(const messageId of messageIds){const row=this.store.findMessage.get(topic.ownerType,topic.ownerId,topic.topicId,messageId);if(!row||row.deleted)continue;
   const message=this.store.projectMessage(row);for(const a of message.attachments||[]){try{const value=this.locate(key,messageId,a.id,false);result.push({messageId,attachmentId:a.id,state:'available',type:value.blob.type});}catch(e){result.push({messageId,attachmentId:a.id,state:e.code==='ATTACHMENT_BLOB_CORRUPT'?'corrupt':'missing',errorCode:e.code});}}
  }return result;
 }
 async content(key,message,imageSupported,budget={bytes:0}){
  const parts=[{type:'text',text:message.content||''}];
  for(const a of message.attachments||[]){
   const metadata=this.locate(key,message.id,a.id,false);budget.bytes+=metadata.blob.size;if(budget.bytes>MAX_FILE)throw fail('ATTACHMENT_REQUEST_BUDGET',413);
   const value=this.locate(key,message.id,a.id),type=value.blob.type;
   if(type.startsWith('image/')){if(!imageSupported)throw fail('MODEL_IMAGE_UNSUPPORTED');parts.push({type:'image_url',image_url:{url:`data:${type};base64,${value.bytes.toString('base64')}`}});}
   else if(a.frameHashes?.length){if(!imageSupported)throw fail('MODEL_IMAGE_UNSUPPORTED');if(a.extractedText)parts[0].text+=`\n\n[附加文件: ${a.name}]\n${a.extractedText}`;for(let i=0;i<a.frameHashes.length;i++){const frame=this.frame(key,message.id,a.id,i);budget.bytes+=frame.bytes.length;if(budget.bytes>MAX_FILE)throw fail('ATTACHMENT_REQUEST_BUDGET',413);parts.push({type:'image_url',image_url:{url:`data:${frame.blob.type};base64,${frame.bytes.toString('base64')}`}});}}
   else if(a.imageFrames?.length){if(!imageSupported)throw fail('MODEL_IMAGE_UNSUPPORTED');for(const frame of a.imageFrames){const binary=Buffer.from(frame,'base64'),type=detect(binary,binary[0]===137?'frame.png':'frame.jpg');if(!type.startsWith('image/'))throw fail('ATTACHMENT_TYPE_REJECTED');budget.bytes+=binary.length;if(budget.bytes>MAX_FILE)throw fail('ATTACHMENT_REQUEST_BUDGET',413);parts.push({type:'image_url',image_url:{url:`data:${type};base64,${frame}`}});}}
   else if(typeof a.extractedText==='string'&&a.extractedText.trim())parts[0].text+=`\n\n[附加文件: ${a.name}]\n${a.extractedText}\n[/附加文件结束: ${a.name}]`;
   else throw fail('ATTACHMENT_TEXT_UNAVAILABLE');
  }return parts;
 }
 async close(){this.closing=true;await Promise.allSettled([...this.finishing.values()]);}
 spend(principal,bytes=0){
  const now=Date.now();for(const [key,r]of this.requestBudgets)if(r.until<now)this.requestBudgets.delete(key);
  if(!this.requestBudgets.has(principal)&&this.requestBudgets.size>=1000)throw fail('ATTACHMENT_REQUEST_BUDGET',429);
  const r=this.requestBudgets.get(principal)||{until:now+60000,requests:0,bytes:0};r.requests++;r.bytes+=bytes;this.requestBudgets.set(principal,r);
  if(r.requests>1200||r.bytes>96*1024*1024)throw fail('ATTACHMENT_REQUEST_BUDGET',429);
 }
 expire(){
  const rows=this.db.prepare('SELECT * FROM attachment_uploads WHERE expires<=? LIMIT 100').all(Date.now());
  for(const r of rows){if(this.finishing.has(r.id))continue;
   const temp=this.temporary(r.id);try{regular(temp);fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}
   this.db.prepare('DELETE FROM attachment_uploads WHERE id=?').run(r.id);
   if(!r.hash||this.db.prepare('SELECT 1 FROM attachment_links WHERE hash=? LIMIT 1').get(r.hash)||this.db.prepare('SELECT 1 FROM attachment_frames WHERE hash=? LIMIT 1').get(r.hash)||this.db.prepare('SELECT 1 FROM attachment_uploads WHERE hash=? LIMIT 1').get(r.hash))continue;
   const file=this.blobPath(r.hash);try{regular(file);fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}
   this.db.prepare('DELETE FROM attachment_blobs WHERE hash=?').run(r.hash);
  }
 }
}
module.exports={AttachmentStore,CHUNK,MAX_FILE,detect,hash};
