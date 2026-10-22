'use strict';
require('./native-sync-r6-preload.cjs');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.VCP_R7_RUN_ROOT;
const {port}=JSON.parse(fs.readFileSync(path.join(root,'r7-fixture-config.json'),'utf8'));
process.env.API_URL=`http://127.0.0.1:${port}`;
process.env.API_Key='r7-synthetic-provider-unused';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const audit=value=>fs.appendFileSync(path.join(root,'synthetic-model-events.jsonl'),JSON.stringify({...value,at:Date.now()})+'\n');
const server=http.createServer(async(req,res)=>{
 let text='';for await(const chunk of req)text+=chunk;
 const body=JSON.parse(text||'{}');
 const last=[...(body.messages||[])].reverse().find(m=>m.role==='user');
 const content=typeof last?.content==='string'?last.content:(last?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
 const key=digest(content);
 audit({event:'started',contentHash:key,model:body.model,hasConfiguredAgentPrompt:(body.messages||[]).some(m=>m.role==='system'&&String(m.content).includes('SYNTHETIC_R7_AGENT'))});
 let finished=false;
 const delay=content.includes('R7_CANCEL')?6000:2200;
 const timer=setTimeout(()=>{
  finished=true;res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({id:'synthetic-r7',object:'chat.completion',choices:[{message:{role:'assistant',content:'R7 server reply: '+content},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));
  audit({event:'completed',contentHash:key});
 },delay);
 res.on('close',()=>{if(!finished){clearTimeout(timer);audit({event:'aborted',contentHash:key});}});
});
server.__nativeSyncFixture=true;server.listen(port,'127.0.0.1');
process.on('SIGTERM',()=>{server.closeAllConnections();server.close();});
