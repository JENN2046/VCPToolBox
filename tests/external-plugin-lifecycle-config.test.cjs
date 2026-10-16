'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const manager=require('../Plugin');
const vcpLog=require('../Plugin/VCPLog/VCPLog');
const {ToolLifecycleVcpInfo}=require('../modules/toolLifecycleVcpInfo');
after(()=>manager.toolApprovalManager.shutdown());

test('external lifecycle excludes host secrets from all phases, references and both outputs while execution retains config',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lifecycle-config-'));
 const secret='SYNTHETIC_HOST_SENTINEL', legacySecret='SYNTHETIC_PROGRAMMATIC_SENTINEL';
 const envBefore=process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE;
 const saved={plugins:manager.plugins,serviceModules:manager.serviceModules,executionBridgeRegistry:manager.executionBridgeRegistry,decision:manager.toolApprovalManager.getApprovalDecision};
 t.after(()=>{Object.assign(manager,{plugins:saved.plugins,serviceModules:saved.serviceModules,executionBridgeRegistry:saved.executionBridgeRegistry});manager.toolApprovalManager.getApprovalDecision=saved.decision;vcpLog.setBroadcastFunctions(null);manager.removeListener('vcp_info',onInfo);if(envBefore===undefined)delete process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE;else process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE=envBefore;fs.rmSync(root,{recursive:true,force:true});});
 const template={message:'{{pluginConfig.jso_local_agent_token|pluginConfig.LABEL}} / {{plugin.name}}',data:{nested:[{direct:'{{pluginConfig.JSO_LOCAL_AGENT_TOKEN}}',all:'{{pluginConfig}}',caseAll:'{{PLUGINCONFIG}}',plugin:'{{plugin}}',legacy:'{{plugin.pluginSpecificEnvConfig}}',alternate:'{{plugin.CONFIG_ALIAS}}'}],normal:'{{pluginConfig.LABEL}}'}};
 const legacy={private_key:legacySecret,LABEL:'legacy label'};
 const plugin={name:'SyntheticLifecycle',pluginType:'synchronous',communication:{protocol:'stdio'},pluginSource:'external',pluginRoot:root,basePath:root,configSchema:{JSO_LOCAL_AGENT_TOKEN:'string',LABEL:'string',ENABLED:'boolean'},pluginSpecificEnvConfig:legacy,CONFIG_ALIAS:{nested:legacy},vcpInfoLifecycle:{enabledConfigKey:'ENABLED',enabledByDefault:false,...Object.fromEntries(['start','success','error','timeout'].map(x=>[x,template]))}};
 const file=path.join(root,'host.json');fs.writeFileSync(file,JSON.stringify({bindings:[{pluginName:plugin.name,sourceDirectory:root,config:{JSO_LOCAL_AGENT_TOKEN:secret,LABEL:'public label',ENABLED:true}}]}));process.env.VCP_EXTERNAL_PLUGIN_CONFIG_FILE=file;
 manager.plugins=new Map([[plugin.name,plugin]]);manager.serviceModules=new Map([['VCPLog',{module:vcpLog}]]);
 const broadcasts=[],events=[];function onInfo(payload){events.push(payload);}manager.on('vcp_info',onInfo);vcpLog.setBroadcastFunctions(payload=>broadcasts.push(payload));
 manager.toolApprovalManager.getApprovalDecision=()=>({requiresApproval:false});
 let executions=0;
 for(const mode of ['success','error','timeout']){
  manager.executionBridgeRegistry={execute:async current=>{executions++;assert.equal(current,plugin);assert.equal(manager._getPluginConfig(current).JSO_LOCAL_AGENT_TOKEN,secret);assert.equal(current.pluginSpecificEnvConfig.private_key,legacySecret);if(mode==='success')return {shortCircuitResult:{ok:true}};throw Error(mode==='timeout'?'synthetic timeout':'synthetic error');}};
  if(mode==='success')assert.deepEqual(await manager.processToolCall(plugin.name,{},null,null,{toolCallRecordHandle:{}}),{ok:true});
  else await assert.rejects(manager.processToolCall(plugin.name,{},null,null,{toolCallRecordHandle:{}}));
 }
 assert.equal(executions,3);assert.equal(broadcasts.length,6);assert.equal(events.length,6);
 assert.deepEqual(events.map(x=>x.phase),['start','success','start','error','start','timeout']);
 for(const payload of [...broadcasts,...events]){
  assert.equal(JSON.stringify(payload).includes(secret),false);
  assert.equal(JSON.stringify(payload).includes(legacySecret),false);
  assert.equal(payload.message,'public label / SyntheticLifecycle');assert.equal(payload.normal,'public label');
  assert.equal(payload.nested[0].direct,'');
 }
 assert.equal(manager._buildPluginProcessEnv(plugin,manager._getPluginConfig(plugin),{}).JSO_LOCAL_AGENT_TOKEN,undefined);
 assert.equal(manager._getPluginConfig(plugin).JSO_LOCAL_AGENT_TOKEN,secret);
 const ctx=manager.toolLifecycleVcpInfo.createContext(plugin,{}, {pluginConfig:manager._getPluginConfig(plugin)});
 assert.equal(JSON.stringify(ctx).includes(secret),false);assert.equal(JSON.stringify(ctx).includes(legacySecret),false);
 assert.equal(plugin.pluginSpecificEnvConfig.private_key,legacySecret);
});

test('normal lifecycle config, phase switches and trusted built-in templates stay compatible',()=>{
 const out=[],life=new ToolLifecycleVcpInfo({pushVcpInfo:x=>out.push(x)});
 const plugin={name:'ExternalNormal',pluginSource:'external',vcpInfoLifecycle:{enabledConfigKey:'ENABLED',enabledByDefault:false,start:{message:'{{pluginConfig.LABEL}} {{args.name}}',data:{items:['{{plugin.name}}'],tokenCount:3,sessionLabel:'public synthetic label',hidden:'{{lifecycleConfig}}'}}}};
 life.emit(life.createContext(plugin,{name:'fixture'},{pluginConfig:{LABEL:'public',ENABLED:false}}),'start');assert.equal(out.length,0);
 life.emit(life.createContext(plugin,{name:'fixture'},{pluginConfig:{LABEL:'public',ENABLED:true}}),'start');assert.equal(out[0].message,'public fixture');assert.deepEqual(out[0].items,['ExternalNormal']);assert.equal(out[0].tokenCount,3);assert.equal(out[0].sessionLabel,'public synthetic label');assert.equal(out[0].hidden,'');
 const builtin={name:'TrustedBuiltin',vcpInfoLifecycle:{start:{message:'{{pluginConfig.ACCESS_TOKEN}}'}}};
 life.emit(life.createContext(builtin,{}, {pluginConfig:{ACCESS_TOKEN:'SYNTHETIC_BUILTIN'}}),'start');assert.equal(out[1].message,'SYNTHETIC_BUILTIN');
});
