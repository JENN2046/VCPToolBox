'use strict';
// Isolated test server: same native route, manifest/config loader and actual stdio launcher.
const path=require('node:path');const root=path.resolve(__dirname,'../..');
const express=require('express'),manager=require('../../Plugin');
const {registerNativeConversationRoute}=require('../../modules/nativeConversationTransport');
const parser=require('../../modules/vcpLoop/toolCallParser');
(async()=>{
 manager.setProjectBasePath(root);manager.debugMode=false;
 const manifests=await manager._discoverLegacyPluginManifestsFromDir(process.env.TEST_PLUGIN_ROOT,'core');
 if(manifests.length!==1)throw Error('EXPECTED_ONE_TEST_PLUGIN');
 await manager._registerLocalPlugin(manifests[0],new Map(),[]);
 const spawn=manager._spawnPluginProcess.bind(manager);manager._spawnPluginProcess=(c,a,o)=>{if(o.env.JSO_LOCAL_AGENT_TOKEN||o.env.VCP_NATIVE_APPLICATION_AUTHORIZATION)throw Error('CREDENTIAL_LEAK_TO_CHILD');return spawn(c,a,o);};
 const app=express();app.use((req,res,next)=>req.headers.authorization==='Bearer synthetic-toolbox-transport'?next():res.status(401).json({ok:false,code:'UNAUTHORIZED'}));app.use(express.json({limit:'300kb'}));
 registerNativeConversationRoute(app,manager);
 app.post('/v1/human/tool',express.text({type:'text/plain'}),async(req,res)=>{try{const b=parser.extractNextToolBlock(req.body),p=parser.parseBlock(b.blockContent);const r=await manager.processToolCall(p.name,p.args,'127.0.0.1','human/tool');res.json(r);}catch(error){res.status(400).json({ok:false,code:'MODEL_TOOL_DENIED',detail:error.message});}});
 const server=app.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({nativeFixturePort:server.address().port})));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
})().catch(error=>{console.error(error.code||error.message);process.exit(1)});
