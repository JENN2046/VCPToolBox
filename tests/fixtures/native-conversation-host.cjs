'use strict';
// Isolated test server: real native route, parser and stdio launcher. The current
// upstream has only built-in discovery; the fixture supplies a temporary trusted
// manifest registry entry with the same fields as that loader (not a live install).
const path=require('node:path');const root=path.resolve(__dirname,'../..');
const fs=require('node:fs'),childProcess=require('node:child_process');
const spawn=childProcess.spawn;
// Synthetic inherited secrets must never reach the native child, even when a
// plugin does not declare them. These are not real runtime credentials.
process.env.NATIVE_REVIEW_API_KEY='synthetic-inherited-provider-secret';
process.env.NATIVE_REVIEW_PRIVATE_DATA='synthetic-unlisted-host-state';
childProcess.spawn=(c,a,o)=>{if(o.env?.JSO_LOCAL_AGENT_TOKEN||o.env?.VCP_NATIVE_APPLICATION_AUTHORIZATION||o.env?.NATIVE_REVIEW_API_KEY||o.env?.NATIVE_REVIEW_PRIVATE_DATA)throw Error('CREDENTIAL_LEAK_TO_CHILD');return spawn(c,a,o);};
const express=require('express'),manager=require('../../Plugin'),dotenv=require('dotenv');
const {registerNativeConversationRoute}=require('../../modules/nativeConversationTransport');
const parser=require('../../modules/vcpLoop/toolCallParser');
(async()=>{
 manager.setProjectBasePath(root);manager.debugMode=false;
 const directories=fs.readdirSync(process.env.TEST_PLUGIN_ROOT,{withFileTypes:true}).filter(x=>x.isDirectory());
 const manifests=directories.map(x=>{const basePath=path.join(process.env.TEST_PLUGIN_ROOT,x.name),manifest=JSON.parse(fs.readFileSync(path.join(basePath,'plugin-manifest.json'),'utf8'));return {...manifest,basePath,pluginSpecificEnvConfig:dotenv.parse(fs.readFileSync(path.join(basePath,'config.env'),'utf8'))};});
 if(manifests.length!==1)throw Error('EXPECTED_ONE_TEST_PLUGIN');
 manager.plugins.set(manifests[0].name,manifests[0]);
 const app=express();app.use((req,res,next)=>req.headers.authorization==='Bearer synthetic-toolbox-transport'?next():res.status(401).json({ok:false,code:'UNAUTHORIZED'}));app.use(express.json({limit:'300kb'}));
 registerNativeConversationRoute(app,manager);
 app.post('/v1/human/tool',express.text({type:'text/plain'}),async(req,res)=>{try{const b=parser.extractNextToolBlock(req.body),p=parser.parseBlock(b.blockContent);const r=await manager.processToolCall(p.name,p.args,'127.0.0.1','human/tool');res.json(r);}catch(error){res.status(400).json({ok:false,code:'MODEL_TOOL_DENIED',detail:error.message});}});
 const server=app.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({nativeFixturePort:server.address().port})));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
})().catch(error=>{console.error(error.code||error.message);process.exit(1)});
