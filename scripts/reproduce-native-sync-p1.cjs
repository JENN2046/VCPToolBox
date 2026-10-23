'use strict';
// Runs only the pinned pre-fix pure modules, with fresh synthetic SQLite/HTTP.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),base='fe8e6a2f79c9410f9b46d4920bf0b0e6481a5cef';
const out=path.resolve(process.argv[2]||'');if(!out.includes('native-sync-p1'))throw Error('EXPLICIT_P1_SYNTHETIC_ROOT_REQUIRED');fs.mkdirSync(out,{recursive:true});
function original(relative){const filename=path.join(root,relative),source=execFileSync('git',['show',base+':'+relative],{cwd:root,encoding:'utf8',windowsHide:true});const module={exports:{}};vm.compileFunction(source,['require','module','exports','__dirname'],{filename})(createRequire(filename),module,module.exports,path.dirname(filename));return module.exports;}
const {CentralStore}=original('Plugin/NativeSync/sync/centralStore.js'),{ConversationExecution}=original('Plugin/NativeSync/mobile/execution.js'),{createSyncHttpService}=original('Plugin/NativeSync/sync/httpService.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){const end=Date.now()+2500;while(!fn()){if(Date.now()>end)throw Error('Baseline synthetic condition timed out');await pause(5);}}
async function main(){
 const store=new CentralStore(path.join(out,'execution.sqlite')),topics=['a','b','c','d'].map(key=>({key,ownerType:'agent',ownerId:'synthetic-'+key,topicId:'topic',agentAlias:key,model:'synthetic'}));
 const waiting=[],requests=[];const model=http.createServer(async(q,r)=>{let raw='';for await(const chunk of q)raw+=chunk;const data=JSON.parse(raw);requests.push(data.requestId);await new Promise(resolve=>waiting.push(resolve));if(!r.destroyed){r.setHeader('Content-Type','application/json');r.end('{"choices":[{"message":{"content":"synthetic baseline reply"}}]}');}});
 await new Promise(r=>model.listen(0,'127.0.0.1',r));const engine=new ConversationExecution({store,topics,agentManager:{isAgent:()=>true,getAgentPrompt:async()=> 'synthetic'},maxConcurrency:4});
 engine.setEndpoint({url:'http://127.0.0.1:'+model.address().port+'/v1/chat/completions',key:'synthetic'});
 const accept=(topic,id)=>engine.accept('device',{topicKey:topic,requestId:'request-'+id,text:'synthetic '+id});
 const a1=accept('a','a1'),a2=accept('a','a2'),others=['b','c','d'].map(k=>accept(k,k));engine.tick();await until(()=>requests.length===1);
 const activeBefore=engine.active.size,othersBlocked=others.every(j=>engine.get(j.id).state==='queued');waiting[0]();await until(()=>requests.length===2);
 const secondWasA2=requests[1]===a2.id;assert.equal(activeBefore,1);assert.equal(othersBlocked,true);assert.equal(secondWasA2,true);
 engine.beginDrain();for(const done of waiting)done();await engine.close();model.closeAllConnections();await new Promise(r=>model.close(r));store.close();
 const central=new CentralStore(path.join(out,'scope.sqlite'));
 for(const ownerId of ['allowed','denied'])central.apply({ownerType:'agent',ownerId,topicId:'topic',msgId:ownerId,deviceId:'producer',opId:ownerId,action:'upsert',baseHash:null,message:{id:ownerId,role:'user',content:'synthetic',timestamp:1}});
 const express=require('express'),app=express(),service=createSyncHttpService(central);app.use((q,r,next)=>{if(q.headers.authorization!=='Bearer synthetic')return r.status(401).end();q.nativeSyncTopics=[JSON.stringify(['agent','allowed','topic'])];next();});app.use('/api/v1/sync',service.handle);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/sync/pull',{headers:{Authorization:'Bearer synthetic'}});const status=response.status,body=await response.json();assert.equal(status,403);assert.equal(body.error.code,'DESKTOP_TOPIC_FORBIDDEN');server.closeAllConnections();await new Promise(r=>server.close(r));central.close();
 const receipt={result:'P1_BASELINE_DEFECTS_REPRODUCED',baseline:base,concurrency:{configured:4,observed:activeBefore,independentTopicsBlocked:othersBlocked,aSecondRanBeforeOtherTopics:secondWasA2},mixedScope:{status,code:body.error.code,authorizedEventPresentButUnavailable:true},performance:'See paired Electron main-process benchmark for the unchanged pre-fix adapter',realProviderCalls:0};
 fs.writeFileSync(path.join(out,'BASELINE_REPRODUCTION.json'),JSON.stringify(receipt,null,2));process.stdout.write(JSON.stringify(receipt)+'\n');
}
main().catch(error=>{process.stderr.write(error.code||error.message);process.exitCode=1;});
