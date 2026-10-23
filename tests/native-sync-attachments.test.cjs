'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {AttachmentStore,hash,CHUNK,MAX_FILE}=require('../Plugin/NativeSync/mobile/attachments');
const {envelopeFor}=require('../Plugin/NativeSync/sync/metadata');
const {messageHash}=require('../Plugin/NativeSync/sync/protocol');
const topic={key:'attachments',ownerType:'agent',ownerId:'synthetic',topicId:'topic'},other={...topic,key:'other',topicId:'other'};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-cas-')),store=new CentralStore(path.join(root,'central.sqlite')),cas=new AttachmentStore({store,root,topics:[topic,other]});t.after(async()=>{await cas.close();store.close();fs.rmSync(root,{recursive:true,force:true});});return {root,store,cas};}
async function upload(cas,bytes,{key=topic.key,principal='mobile:synthetic',name='test.txt',requestId='upload_request_1',...extra}={}){
 const started=cas.begin(principal,key,{requestId,name,size:bytes.length,expectedHash:hash(bytes),...extra});
 for(let offset=started.offset;offset<bytes.length;offset+=CHUNK)cas.chunk(principal,key,started.uploadId,{offset,data:bytes.subarray(offset,offset+CHUNK).toString('base64')});
 return cas.finish(principal,key,started.uploadId);
}
function message(files){return {id:'synthetic-message',role:'user',content:'synthetic attachment request',timestamp:1,attachments:files};}
function apply(store,value,principal='mobile:synthetic'){const op={...topic,msgId:value.id,deviceId:principal,opId:'commit-'+value.id,action:'upsert',baseHash:null,message:value,metadata:envelopeFor(value,1)};return store.apply(op,{metadataPublisher:true,attachmentPrincipal:principal});}
test('resumable chunks verify actual bytes; duplicate upload stores one CAS object and preserves message fingerprint',async t=>{
 const {cas,store}=await fixture(t),bytes=Buffer.from('synthetic content '.repeat(5000)),principal='mobile:synthetic';
 const start=cas.begin(principal,topic.key,{requestId:'resume_request',name:'test.txt',size:bytes.length,expectedHash:hash(bytes)});
 const chunk={offset:0,data:bytes.subarray(0,CHUNK).toString('base64')};cas.chunk(principal,topic.key,start.uploadId,chunk);
 assert.equal(cas.chunk(principal,topic.key,start.uploadId,chunk).offset,CHUNK);
 assert.throws(()=>cas.chunk(principal,topic.key,start.uploadId,{offset:0,data:Buffer.from('changed').toString('base64')}),e=>e.code==='UPLOAD_OFFSET_CONFLICT');
 const resumed=cas.begin(principal,topic.key,{requestId:'resume_request',name:'test.txt',size:bytes.length,expectedHash:hash(bytes)});assert.equal(resumed.offset,CHUNK);
 for(let offset=resumed.offset;offset<bytes.length;offset+=CHUNK)cas.chunk(principal,topic.key,start.uploadId,{offset,data:bytes.subarray(offset,offset+CHUNK).toString('base64')});
 const done=await cas.finish(principal,topic.key,start.uploadId);assert.equal(done.hash,hash(bytes));
 const files=cas.claim(principal,topic.key,[done.uploadId]),m=message(files),fingerprint=messageHash(m);apply(store,m);
 assert.equal(hash(cas.locate(topic.key,m.id,files[0].id).bytes),hash(bytes));assert.equal(messageHash(store.pull(0).events[0].message),fingerprint);
 await upload(cas,bytes,{requestId:'second_upload'});assert.equal(store.db.prepare('SELECT count(*) AS n FROM attachment_blobs').get().n,1);
});
test('scope, staging identity, file type, size, declared digest and arbitrary-host-path defenses reject before association',async t=>{
 const {cas,store}=await fixture(t),bytes=Buffer.from('synthetic text');
 assert.throws(()=>cas.begin('mobile:x','unknown',{requestId:'request001',name:'a.txt',size:1}),e=>e.code==='TOPIC_NOT_ALLOWED');
 assert.throws(()=>cas.begin('mobile:x',topic.key,{requestId:'request001',name:'a.txt',size:MAX_FILE+1}),e=>e.code==='INVALID_ATTACHMENT_UPLOAD');
 assert.throws(()=>cas.begin('mobile:x',topic.key,{requestId:'request001',name:'file:///etc/passwd',size:1}),e=>e.code==='INVALID_ATTACHMENT_UPLOAD');
 const done=await upload(cas,bytes);assert.throws(()=>cas.claim('mobile:other',topic.key,[done.uploadId]),e=>e.code==='UPLOAD_NOT_FOUND');assert.throws(()=>cas.claim('mobile:synthetic',other.key,[done.uploadId]),e=>e.code==='UPLOAD_NOT_FOUND');
 const files=cas.claim('mobile:synthetic',topic.key,[done.uploadId]);const foreign={...message(files),id:'foreign'};store.apply({...other,msgId:foreign.id,deviceId:'attacker',opId:'foreign',action:'upsert',baseHash:null,message:foreign,metadata:envelopeFor(foreign,1)},{metadataPublisher:true,attachmentPrincipal:'mobile:synthetic'});
 assert.throws(()=>cas.locate(other.key,foreign.id,files[0].id),e=>e.code==='ATTACHMENT_BLOB_MISSING');
 await assert.rejects(()=>upload(cas,Buffer.from('<svg>active</svg>'),{requestId:'invalid_svg',name:'active.svg'}),e=>e.code==='ATTACHMENT_TYPE_REJECTED');
 const bad=cas.begin('mobile:synthetic',topic.key,{requestId:'bad_digest',name:'x.txt',size:bytes.length,expectedHash:'0'.repeat(64)});cas.chunk('mobile:synthetic',topic.key,bad.uploadId,{offset:0,data:bytes.toString('base64')});await assert.rejects(()=>cas.finish('mobile:synthetic',topic.key,bad.uploadId),e=>e.code==='ATTACHMENT_HASH_MISMATCH');
});
test('image content reaches native-format multimodal blocks; unsupported models and missing/corrupt blobs fail explicitly',async t=>{
 const {cas,store}=await fixture(t);const done=await upload(cas,png,{name:'image.png',requestId:'image_upload'}),files=cas.claim('mobile:synthetic',topic.key,[done.uploadId]),m=message(files);apply(store,m);
 const parts=await cas.content(topic.key,m,true);assert.equal(parts[1].type,'image_url');assert.equal(hash(Buffer.from(parts[1].image_url.url.split(',')[1],'base64')),hash(png));
 await assert.rejects(()=>cas.content(topic.key,m,false),e=>e.code==='MODEL_IMAGE_UNSUPPORTED');
 const before=store.metrics();fs.writeFileSync(cas.blobPath(done.hash),Buffer.alloc(png.length));await assert.rejects(()=>cas.content(topic.key,m,true),e=>e.code==='ATTACHMENT_BLOB_CORRUPT');
 fs.unlinkSync(cas.blobPath(done.hash));assert.equal(cas.status(topic.key,[m.id])[0].state,'missing');await assert.rejects(()=>cas.content(topic.key,m,true),e=>e.code==='ATTACHMENT_BLOB_MISSING');assert.deepEqual(store.metrics(),before);
 await upload(cas,png,{name:'image.png',requestId:'image_repair',messageId:m.id,attachmentId:files[0].id});assert.equal(cas.status(topic.key,[m.id])[0].state,'available');assert.deepEqual(store.metrics(),before);
});
test('a renamed blob with a durable finalizing intent resumes after store reopen without duplicate files',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-cas-restart-')),file=path.join(root,'central.sqlite');let store=new CentralStore(file),cas=new AttachmentStore({store,root,topics:[topic]});
 t.after(async()=>{await cas.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
 const bytes=Buffer.from('restart synthetic text'),done=await upload(cas,bytes);store.db.prepare("UPDATE attachment_uploads SET state='finalizing',extracted_text=NULL WHERE id=?").run(done.uploadId);await cas.close();store.close();
 store=new CentralStore(file);cas=new AttachmentStore({store,root,topics:[topic]});const recovered=await cas.finish('mobile:synthetic',topic.key,done.uploadId);assert.equal(recovered.state,'ready');assert.equal(recovered.hash,hash(bytes));assert.equal(store.db.prepare('SELECT count(*) AS n FROM attachment_blobs').get().n,1);
});
test('expired unassociated grants cannot be claimed and request budgets bound repeated reads',async t=>{
 const {cas,store}=await fixture(t),done=await upload(cas,Buffer.from('synthetic text'));
 store.db.prepare('UPDATE attachment_uploads SET expires=0 WHERE id=?').run(done.uploadId);
 assert.throws(()=>cas.claim('mobile:synthetic',topic.key,[done.uploadId]),e=>e.code==='UPLOAD_NOT_READY');
 cas.expire();assert.equal(store.db.prepare('SELECT count(*) AS n FROM attachment_uploads').get().n,0);
 assert.throws(()=>cas.spend('synthetic',97*1024*1024),e=>e.code==='ATTACHMENT_REQUEST_BUDGET');
});
test('PDF extraction uses the existing native PDFParse contract and preserves the uploaded binary',async t=>{
 const {cas,store}=await fixture(t),stream='BT /F1 12 Tf 40 700 Td (Synthetic PDF continuity test with original binary preserved.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const bytes=Buffer.from(pdf),done=await upload(cas,bytes,{requestId:'pdf_upload',name:'document.pdf'});assert.equal(done.parseError,null);
 const files=cas.claim('mobile:synthetic',topic.key,[done.uploadId]);assert.ok(files[0].extractedText.includes('Synthetic PDF continuity test'));
 const m=message(files);apply(store,m);assert.ok((await cas.content(topic.key,m,false))[0].text.includes('Synthetic PDF continuity test'));assert.equal(hash(cas.locate(topic.key,m.id,files[0].id).bytes),hash(bytes));
});
test('derived PDF frames remain bound to the original message, Topic and independently versioned metadata',async t=>{
 const {cas,store}=await fixture(t),pdf=Buffer.from('%PDF-1.4\nsynthetic frame transport fixture');
 const main=await upload(cas,pdf,{requestId:'pdf_frame_main',name:'scan.pdf'}),files=cas.claim('mobile:synthetic',topic.key,[main.uploadId]);
 const frame=await upload(cas,png,{requestId:'pdf_frame_image',name:'frame.png',messageId:'synthetic-message',attachmentId:files[0].id,frameIndex:0});
 const m=message([{...files[0],frameHashes:[frame.hash]}]),original=message(files);assert.equal(messageHash(m),messageHash(original));apply(store,m);
 assert.equal(hash(cas.frame(topic.key,m.id,files[0].id,0).bytes),hash(png));const parts=await cas.content(topic.key,m,true);assert.equal(parts.filter(p=>p.type==='image_url').length,1);
 assert.throws(()=>cas.frame(topic.key,m.id,files[0].id,1),e=>e.code==='ATTACHMENT_BLOB_MISSING');
 assert.throws(()=>cas.frame(other.key,m.id,files[0].id,0),e=>e.code==='ATTACHMENT_NOT_ALLOWED');
 store.apply({...topic,msgId:m.id,deviceId:'mobile:synthetic',opId:'delete-frame-parent',action:'delete',baseHash:messageHash(m)});assert.throws(()=>cas.frame(topic.key,m.id,files[0].id,0),e=>e.code==='ATTACHMENT_NOT_ALLOWED');
});
