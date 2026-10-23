'use strict';
const express=require('express');
function attachmentRoutes({storage,authorize,principal}){
 const router=express.Router({mergeParams:true});
 router.use((req,res,next)=>{try{req.attachmentStore=storage();if(!req.attachmentStore)throw Object.assign(Error(),{code:'ATTACHMENTS_NOT_ENABLED',status:503});authorize(req);req.attachmentStore.spend(principal(req),req.body?Buffer.byteLength(JSON.stringify(req.body)):0);next();}catch(e){next(e);}});
 const run=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
 router.post('/uploads',run((q,r)=>r.status(201).json(q.attachmentStore.begin(principal(q),q.params.key,q.body))));
 router.get('/uploads/:id',run((q,r)=>r.json(q.attachmentStore.public(q.attachmentStore.get(principal(q),q.params.key,q.params.id)))));
 router.post('/uploads/:id/chunks',run((q,r)=>r.json(q.attachmentStore.chunk(principal(q),q.params.key,q.params.id,q.body))));
 router.post('/uploads/:id/finish',run(async(q,r)=>{q.attachmentStore.spend(principal(q),q.attachmentStore.get(principal(q),q.params.key,q.params.id).size);r.json(await q.attachmentStore.finish(principal(q),q.params.key,q.params.id));}));
 router.post('/status',run((q,r)=>r.json({attachments:q.attachmentStore.status(q.params.key,q.body?.messageIds)})));
 router.get('/messages/:messageId/:attachmentId/frames/:index',run((q,r)=>{const item=q.attachmentStore.frame(q.params.key,q.params.messageId,q.params.attachmentId,Number(q.params.index));q.attachmentStore.spend(principal(q),item.bytes.length);r.set({'Cache-Control':'no-store','Content-Type':item.blob.type,'X-Content-Type-Options':'nosniff'}).end(item.bytes);}));
 router.get('/messages/:messageId/:attachmentId',run((q,r)=>{
  const descriptor=q.attachmentStore.locate(q.params.key,q.params.messageId,q.params.attachmentId,false);q.attachmentStore.spend(principal(q),descriptor.blob.size);
  const item=q.attachmentStore.locate(q.params.key,q.params.messageId,q.params.attachmentId);
  r.set({'Cache-Control':'no-store','Content-Type':item.blob.type,'Content-Length':String(item.bytes.length),'X-Content-Type-Options':'nosniff','Content-Disposition':`${item.blob.type.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(item.attachment.name||'attachment')}`}).end(item.bytes);
 }));
 router.use((e,_q,r,_n)=>r.status(e.status||400).json({error:{code:e.code||'ATTACHMENT_REQUEST_FAILED'}}));
 return router;
}
module.exports={attachmentRoutes};
