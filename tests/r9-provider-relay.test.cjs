'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {start}=require('../scripts/native-sync-r9-provider-relay.cjs');
test('bounded relay keeps provider credentials out of downstream errors and receipts; only approved model can execute',async()=>{
 let calls=0;const upstream=http.createServer(async(req,res)=>{for await(const _ of req){}calls++;res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'must not propagate simulated secret'}}));});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const root=path.resolve(__dirname,'../../../artifacts/native-sync-r9/relay-unit-'+Date.now());
 const relay=await start({root,provider:{url:new URL(`http://127.0.0.1:${upstream.address().port}`),key:'synthetic-unit-secret'},maxCalls:1});
 try{
  const send=(model,auth=true)=>fetch(relay.url+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+relay.token}:{})},body:JSON.stringify({model,messages:[]})});
  assert.equal((await send('doubao-seed-2.0-mini',false)).status,401);assert.equal((await send('wrong-model')).status,403);
  relay.failNext();assert.equal((await send('doubao-seed-2.0-mini')).status,503);assert.equal(calls,0);
  const error=await send('doubao-seed-2.0-mini');assert.equal(error.status,401);assert.deepEqual(await error.json(),{error:{code:'R9_PROVIDER_REJECTED'}});
  assert.equal((await send('doubao-seed-2.0-mini')).status,429);assert.equal(calls,1);
  const record=fs.readFileSync(path.join(root,'PROVIDER_TRANSPORT_RECORDS.json'),'utf8');assert.ok(!record.includes('synthetic-unit-secret'));assert.ok(!record.includes('must not propagate'));assert.ok(!record.includes(relay.token));
 }finally{await relay.close();await new Promise(r=>upstream.close(r));}
});
