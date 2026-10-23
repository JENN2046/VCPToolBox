'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const native=require('../modules/requestExecutionContext');

// Execute the exact native PluginManager with inert record/lifecycle seams.
// No plugin process, auth config, environment file, log or provider is loaded.
test('native PluginManager cancellation clears original pending approval before bridge dispatch; approved ordinary path stays intact',async()=>{
 const file=path.resolve(__dirname,'../Plugin.js'),fallback=createRequire(file),mod={exports:{}},quiet={log(){},warn(){},error(){}};
 const overrides=new Map([['./modules/toolCallRecordStore',{beginRecord:()=>null,finishRecord(){}}],['./modules/toolApprovalManager',class {getApprovalDecision(){return {requiresApproval:true};}getTimeoutMs(){return 5000;}}]]);
 vm.runInNewContext('(function(require,module,exports,__dirname){'+fs.readFileSync(file,'utf8')+'\n})',{process:{env:{}},console:quiet,Buffer,URL,AbortController,setTimeout,clearTimeout,setInterval,clearInterval},{filename:file})(name=>overrides.has(name)?overrides.get(name):fallback(name),mod,mod.exports,path.dirname(file));
 const manager=mod.exports,requests=[];let dispatches=0;manager.webSocketServer={broadcast:message=>requests.push(message.data.requestId)};manager.plugins.set('Synthetic',{name:'Synthetic',isDistributed:true});manager.toolLifecycleVcpInfo={createContext:()=>({}),emit(){}};manager.executionBridgeRegistry={execute:async()=>{dispatches++;return {shortCircuitResult:{content:'synthetic result'}};}};
 const controller=new AbortController(),release=native.register('native-cancel-test',{});
 try{
  const task=native.run('native-cancel-test',controller.signal,()=>manager.processToolCall('Synthetic',{},null,null,{toolCallRecordHandle:{}}));const rejected=assert.rejects(task);assert.equal(manager.pendingApprovals.size,1);controller.abort();await rejected;assert.equal(manager.pendingApprovals.size,0);manager.handleApprovalResponse(requests[0],true);assert.equal(dispatches,0);
  const ordinary=manager.processToolCall('Synthetic',{},null,null,{toolCallRecordHandle:{}});assert.equal(manager.pendingApprovals.size,1);manager.handleApprovalResponse(requests[1],true);assert.equal((await ordinary).content,'synthetic result');assert.equal(dispatches,1);assert.equal(manager.pendingApprovals.size,0);
 }finally{release();for(const pending of manager.pendingApprovals.values())clearTimeout(pending.timeoutId);}
});
