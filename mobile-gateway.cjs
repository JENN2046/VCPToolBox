'use strict';
// NativeSync Service Plugin host for the separately assigned R10 port. Model,
// Agent and tool execution remain in the existing full ToolBox on loopback6005.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const express=require('express');
const root=path.resolve(__dirname),data=path.resolve(process.env.VCP_MOBILE_DATA||'');
if(process.platform!=='linux'||root!=='/home/admin/VCPKF/vcp/versions/vcptoolbox-daily-r10'||data!=='/home/admin/VCPKF/vcp/runtime-data/native-sync-r10')throw Error('EXPLICIT_R10_DAILY_ROOT_REQUIRED');
process.umask(0o077);
const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');console.log=console.warn=console.error=()=>{};
async function main(){
 const config=JSON.parse(fs.readFileSync(path.join(root,'mobile-host.json'),'utf8'));
 const {ORIGIN,tlsOptions,createListener}=require('./Plugin/NativeSync/mobile/httpsListener');
 // Validate TLS before Agent initialization, SQLite, plugin startup or listening.
 const tls=tlsOptions(config);
 for(const key of ['NativeSyncEnabled','NativeMobileEnabled'])process.env[key]='true';
 process.env.NativeSyncDataDir=data;process.env.NativeMobileOrigin=ORIGIN;
 process.env.NativeMobileTopics=JSON.stringify(config.topics);process.env.NativeMobileBackendUrl='http://wp10.unicorn.org.cn:13546';
 process.env.NativeMobileKeyExchangeEnabled='true';process.env.NativeMobileSessionHours='720';process.env.NativeMobilePwaDir=path.join(root,'Plugin/NativeSync/mobile-dist');
 process.env.DebugMode='false';process.env.PORT='8888';
 const authority=require('/app/VCPToolBox/modules/agentManager');await authority.initialize(false);
 const plugin=require('./Plugin/NativeSync/native-sync');let credential;
 plugin.setMobileHostAuthority({agentManager:authority,verifyKey:async key=>{const valid=await credential.verifyAndRemember(key);if(valid)plugin.setExecutionEndpoint({url:credential.backend+'/v1/chat/completions',key:credential.key});return valid;}});
 const manager=require('./Plugin');manager.setProjectBasePath(root);await manager.loadPlugins();
 if(manager.plugins.size!==1||!plugin.snapshot().ready)throw Error('R10_NATIVE_PLUGIN_BOOT_FAILED');
 credential=new(require('./Plugin/NativeSync/mobile/hostCredential').HostCredential)({dataDir:data});if(credential.key)plugin.setExecutionEndpoint({url:credential.backend+'/v1/chat/completions',key:credential.key});
 const desktops=new(require('./Plugin/NativeSync/mobile/desktopSessions').DesktopSessions)(credential.db,config.topics);
 const app=express();app.set('trust proxy',false);
 const instance=crypto.randomBytes(16).toString('hex');
 app.get('/healthz',(_q,r)=>r.set('Cache-Control','no-store').json({service:'VCPMobileGateway',release:config.release,instance,pid:process.pid,port:8888,nativeSyncReady:true,httpsReady:Boolean(config.httpsOrigin),backendAuthenticated:Boolean(credential.key)}));
 app.get('/',(_q,r)=>r.redirect(302,ORIGIN+'/mobile/'));
 app.get('/mobile/api/connection',(q,r)=>{if(q.secure)return plugin.handleMobile(Object.assign(q,{url:'/api/connection'}),r);r.set('Cache-Control','no-store').json({...plugin.mobileConnectionInfo(),credentialExchangeAllowed:false,httpsReady:false});});
 app.use('/mobile',(q,r,next)=>{if(q.path.startsWith('/api/'))return plugin.handleMobile(q,r);next();},express.static(process.env.NativeMobilePwaDir,{index:'index.html',dotfiles:'deny',maxAge:0}));
 app.use(express.json({limit:'8mb'}));
 app.use((q,r,next)=>{
  const header=q.headers.authorization;
  if(typeof header==='string'&&header.startsWith('Bearer ')&&credential.matches(header.slice(7)))return next();
  try{desktops.authorize(q);next();}catch(e){r.set('Cache-Control','no-store').status(e.status||401).json({error:{code:e.code||'AUTH_REQUIRED'}});}
 });manager.initializeServices(app,express.Router(),root);
 app.use((e,_q,r,_next)=>r.status(e.status===413?413:400).json({error:{code:e.status===413?'REQUEST_TOO_LARGE':'BAD_REQUEST'}}));
 const server=await new Promise((resolve,reject)=>{const s=createListener(tls,app);s.once('error',reject);s.listen(8888,'0.0.0.0',()=>resolve(s));});tls.key.fill(0);
 const receipt={event:'R10_GATEWAY_READY',pid:process.pid,port:8888,httpsOrigin:ORIGIN,release:config.release,instance,productionBackend:'http://127.0.0.1:6005',pluginLifecycle:plugin.snapshot().lifecycle};
 fs.writeFileSync(path.join(data,'service-ready.json'),JSON.stringify(receipt,null,2));emit(receipt);
 let stopping=false;async function stop(){if(stopping)return;stopping=true;plugin.beginDrain();await new Promise(r=>server.close(r));await manager.shutdownAllPlugins();credential.close();await manager.toolApprovalManager.watcher?.close();manager.toolApprovalManager.shutdown();fs.writeFileSync(path.join(data,'service-exit.json'),JSON.stringify({pid:process.pid,exitCode:0,pluginLifecycle:plugin.snapshot().lifecycle}));process.exit(0);}
 process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
}
main().catch(e=>{emit({event:'R10_GATEWAY_FAILED',code:/^R10_TLS_|^R10_HTTPS_ONLY_/.test(e.message)?e.message:e.code||'BOOT_FAILED'});process.exit(1);});
