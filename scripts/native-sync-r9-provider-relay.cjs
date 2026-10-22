'use strict';
// Test transport only: preserve ToolBox's existing URL/path/body and model
// pipeline. The approved isolated provider credential stays on Ubuntu and is
// never given to the browser, Windows or the ToolBox log stream.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),crypto=require('node:crypto');
const model='doubao-seed-2.0-mini';
function loadProvider(){
 const file='/home/admin/VCPKF/vcp/versions/vcptoolbox-android-r9/config.env';
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('R9_PROVIDER_CONFIG_ALIAS');
 const env=require('dotenv').parse(fs.readFileSync(file));
 if(!env.API_URL||!env.API_Key)throw Error('R9_PROVIDER_CONFIG_INCOMPLETE');
 const url=new URL(env.API_URL);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('R9_PROVIDER_HTTPS_REQUIRED');
 return {url,key:env.API_Key};
}
async function start({root,provider=loadProvider(),maxCalls=12}){
 if(!Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>20)throw Error('R9_CALL_CAP_INVALID');
 fs.mkdirSync(root,{recursive:true,mode:0o700});const ledger=path.join(root,'PROVIDER_TRANSPORT_RECORDS.json');
 let rows=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[],failNext=false,controlledFailures=0;const active=new Set(),token=crypto.randomBytes(32).toString('base64url');
 const save=()=>fs.writeFileSync(ledger,JSON.stringify({model,maxCalls,calls:rows},null,2)+'\n',{mode:0o600});
 // Backward-compatible loading of this test ledger; it contains projections only.
 if(!Array.isArray(rows))rows=rows.calls;
 const server=http.createServer(async(req,res)=>{
  const fail=(status,code)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code}}));};
  if(req.headers.authorization!=='Bearer '+token)return fail(401,'R9_RELAY_AUTH_REQUIRED');
  if(req.method!=='POST'||!new URL(req.url,'http://local').pathname.endsWith('/v1/chat/completions'))return fail(404,'R9_ROUTE_DENIED');
  let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>2*1024*1024)return fail(413,'R9_BODY_LIMIT');}
  let body;try{body=JSON.parse(raw);}catch{return fail(400,'R9_BAD_JSON');}
  if(body.model!==model)return fail(403,'R9_MODEL_NOT_APPROVED');
  if(failNext){failNext=false;controlledFailures++;return fail(503,'R9_CONTROLLED_TRANSPORT_OUTAGE');}
  if(rows.length>=maxCalls)return fail(429,'R9_TEST_CALL_CAP');
  const record={number:rows.length+1,startedAt:Date.now(),model,requestSha256:crypto.createHash('sha256').update(raw).digest('hex'),status:null,aborted:false,usage:null};rows.push(record);save();
  const target=new URL(req.url,provider.url.origin);
  const transport=target.protocol==='https:'?https:http;
  const upstream=transport.request(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+provider.key},timeout:120000},reply=>{
   record.status=reply.statusCode;let bytes=0,chunks=[];
   reply.on('data',b=>{bytes+=b.length;if(bytes<=4*1024*1024)chunks.push(b);else upstream.destroy(Error('R9_RESPONSE_LIMIT'));});
   reply.on('end',()=>{record.completedAt=Date.now();let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{}
    if(parsed?.usage)record.usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].filter(k=>Number.isFinite(parsed.usage[k])).map(k=>[k,parsed.usage[k]]));
    save();if(!res.destroyed){if(reply.statusCode>=400)fail(reply.statusCode,'R9_PROVIDER_REJECTED');else{res.writeHead(reply.statusCode,{'Content-Type':'application/json'});res.end(Buffer.concat(chunks));}}active.delete(upstream);
   });
  });
  active.add(upstream);upstream.on('timeout',()=>upstream.destroy(Error('R9_PROVIDER_TIMEOUT')));
  upstream.on('error',()=>{active.delete(upstream);record.completedAt=Date.now();record.transportError=true;save();if(!res.destroyed&&!res.headersSent)fail(502,'R9_PROVIDER_TRANSPORT_FAILED');});
  res.on('close',()=>{if(!res.writableEnded){record.aborted=true;record.completedAt=Date.now();save();upstream.destroy();}});upstream.end(raw);
 });
 server.__nativeSyncFixture=true;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${server.address().port}${provider.url.pathname.replace(/\/$/,'')}`,token,snapshot:()=>({model,calls:rows.length,active:active.size,controlledFailures,records:rows}),failNext:()=>{failNext=true;},async close(){for(const x of active)x.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));save();}};
}
module.exports={start,loadProvider};
