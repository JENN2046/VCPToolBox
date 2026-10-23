'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{pathToFileURL}=require('node:url');
const express=require('express'),auth=require('../modules/apiBearerAuth');
const {CentralStore}=require('../Plugin/NativeSync/sync/centralStore');
const {MobilePortal}=require('../Plugin/NativeSync/mobile/portal');
const {attachmentRoutes}=require('../Plugin/NativeSync/mobile/attachmentRoutes');
const {digest}=require('../Plugin/NativeSync/mobile/execution');
const {hash}=require('../Plugin/NativeSync/mobile/attachments');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('PWA upload kernel, scoped mobile routes and accepted execution preserve binary identity and immutable retry payload',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'seamless-attachment-http-')),store=new CentralStore(path.join(root,'central.sqlite'));
 const a={key:'a',ownerType:'agent',ownerId:'synthetic',topicId:'a',agentAlias:'synthetic',model:'vision-synthetic',imageModels:['vision-synthetic']},b={...a,key:'b',topicId:'b'};
 const portal=new MobilePortal({store,agentManager:{isAgent:()=>true,getAgentPrompt:async()=> 'unused'},config:{NativeSyncDataDir:root,NativeMobileOrigin:'https://synthetic.invalid',NativeMobileTopics:JSON.stringify([a,b]),NativeMobileConfigSync:true,NativeMobileAttachments:true}});
 const config={name:'Synthetic',systemPrompt:'synthetic published prompt',model:'vision-synthetic'};
 await portal.engine.configs.publish({topics:[{ownerType:a.ownerType,ownerId:a.ownerId,topicId:a.topicId,expectedVersion:0,config}]});
 const requests=[];const model=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;requests.push(JSON.parse(raw));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'synthetic image response'}}]}));});await new Promise(r=>model.listen(0,'127.0.0.1',r));
 portal.engine.setEndpoint({url:`http://127.0.0.1:${model.address().port}/v1/chat/completions`,key:'synthetic-host-key'});
 const app=express();app.set('trust proxy',true);app.use('/mobile',portal.router);app.use('/host/:key',auth('synthetic-host-key'),express.json({limit:'128kb'}),attachmentRoutes({storage:()=>portal.attachments,authorize:q=>portal.attachments.topic(q.params.key),principal:()=> 'host-bearer'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;let cookie;
 const req=(route,body,extra={})=>fetch(base+route,{method:body?'POST':'GET',headers:{'X-Forwarded-Proto':'https',Origin:'https://synthetic.invalid','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:body?JSON.stringify(body):undefined});
 const api=async(route,body)=>{const response=await req('/mobile/api/'+route,body),result=await response.json();if(!response.ok)throw Object.assign(Error(result.error?.code),{code:result.error?.code,status:response.status});return result;};
 try{
  const grant=portal.createPairing();portal.db.prepare('UPDATE mobile_pairings SET scopes=? WHERE hash=?').run(JSON.stringify(['a']),digest(grant.pairingCode));
  const paired=await req('/mobile/api/pair',{code:grant.pairingCode});cookie=paired.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/host/a/uploads',{requestId:'unauthorized',name:'x.txt',size:1})).status,401);
  const {uploadAttachment}=await import(pathToFileURL(path.resolve(__dirname,'../apps/mobile/src/attachmentUpload.js')).href);
  const id=await uploadAttachment(api,'a',new File([png],'image.png',{type:'image/png'}));
  await assert.rejects(()=>api('conversations/b/attachments/status',{messageIds:[]}),e=>e.status===403);
  assert.equal((await req('/mobile/api/conversations/a/attachments/messages/uncommitted/attachment_'+hash(png))).status,403);
  const submission={requestId:'attachment_request_1',text:'what is in this synthetic image?',attachments:[id]},accepted=await api('conversations/a/messages',submission);
  const deadline=Date.now()+4000;while(portal.engine.get(accepted.id).state!=='completed'){assert.ok(Date.now()<deadline);await pause(10);}
  assert.equal(requests.length,1);assert.equal(requests[0].messages[0].content,config.systemPrompt);
  const image=requests[0].messages.flatMap(m=>Array.isArray(m.content)?m.content:[]).find(p=>p.type==='image_url');assert.equal(hash(Buffer.from(image.image_url.url.split(',')[1],'base64')),hash(png));
  const page=await api('conversations/a');const user=page.messages.find(r=>r.id===accepted.userMessageId).message,attachment=user.attachments[0];
  const downloaded=await req('/mobile/api/conversations/a/attachments/messages/'+encodeURIComponent(user.id)+'/'+encodeURIComponent(attachment.id));assert.equal(downloaded.status,200);assert.equal(hash(Buffer.from(await downloaded.arrayBuffer())),hash(png));
  const own=page.executions.find(r=>r.id===accepted.id);assert.deepEqual(own.submission,submission);assert.equal((await api('conversations/a/messages',own.submission)).replayed,true);assert.equal(store.metrics().journalRows,2);
  await portal.engine.configs.publish({topics:[{ownerType:a.ownerType,ownerId:a.ownerId,topicId:a.topicId,expectedVersion:1,config:{...config,model:'text-synthetic'}}]});
  const unsupported=await api('conversations/a/messages',{requestId:'attachment_request_2',text:'continue',attachments:[id]});
  while(portal.engine.get(unsupported.id).state!=='failed'){assert.ok(Date.now()<deadline);await pause(10);}
  assert.equal(portal.engine.get(unsupported.id).error_code,'MODEL_IMAGE_UNSUPPORTED');assert.equal(requests.length,1);
 }finally{await portal.close();server.closeAllConnections();model.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>model.close(r))]);store.close();fs.rmSync(root,{recursive:true,force:true});}
});
