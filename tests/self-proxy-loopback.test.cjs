'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {localListenArguments}=require('../modules/localListenOptions');
function listen(app,host){return new Promise((resolve,reject)=>{const server=app.listen(...localListenArguments(0,host));server.once('error',reject);server.once('listening',()=>resolve(server));});}
for(const host of [undefined,'127.0.0.1','::1'])test(`existing admin/protocol routes use configured main listener (${host})`,async t=>{
 // This upstream emits fixed fixtures only: no model endpoint, credentials or business data.
 process.env.Key='synthetic-self-proxy-key';if(host===undefined)delete process.env.VCP_LOCAL_LISTEN_HOST;else process.env.VCP_LOCAL_LISTEN_HOST=host;
 const seen=[],upstream=express();upstream.use(express.json());upstream.use((req,res)=>{
  assert.equal(req.headers.authorization,'Bearer synthetic-self-proxy-key');seen.push(req.path);
  if(req.path==='/v1/models')return res.json({data:[{id:'synthetic'}]});
  return res.json({id:'synthetic-response',model:'synthetic',choices:[{index:0,message:{role:'assistant',content:'fixture-ok'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
 });
 const main=await listen(upstream,host);t.after(()=>new Promise(r=>main.close(r)));process.env.PORT=String(main.address().port);
 const app=express();app.use(express.json());app.use(require('../routes/admin/aiChat')());app.use(require('../routes/protocolBridge'));
 const proxy=await listen(app,'127.0.0.1');t.after(()=>new Promise(r=>proxy.close(r)));
 const cases=[['/ai/models',null,'/v1/models'],['/ai/chat',{model:'synthetic',messages:[{role:'user',content:'fixture'}]},'/v1/chat/completions'],['/ai/chatvcp',{model:'synthetic',messages:[{role:'user',content:'fixture'}]},'/v1/chatvcp/completions'],['/v1/responses',{model:'synthetic',input:'fixture'},'/v1/chat/completions'],['/v1/messages',{model:'synthetic',messages:[{role:'user',content:'fixture'}]},'/v1/chat/completions'],['/v1beta/models/synthetic:generateContent',{contents:[{role:'user',parts:[{type:'text',text:'fixture'}]}]},'/v1/chat/completions']];
 for(const [route,body,target] of cases){const response=await fetch(`http://127.0.0.1:${proxy.address().port}${route}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});assert.equal(response.status,200,route);assert.match(await response.text(),/fixture-ok|synthetic/);assert.equal(seen.at(-1),target);}
 assert.equal(seen.length,6);
});
