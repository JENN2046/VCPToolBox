import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),fs=require('node:fs');
const {loadProvider,start}=require('./native-sync-r9-provider-relay.cjs');
const root=process.env.VCP_R7_RUN_ROOT;
if(process.platform!=='linux'||!root?.startsWith('/home/admin/VCPKF/vcp/artifacts/native-sync-r7/run-'))throw Error('R9_RELAY_ROOT_REQUIRED');
const provider=loadProvider();
globalThis.__r9ProviderPolicy=Object.freeze({model:'doubao-seed-2.0-mini',hostname:provider.url.hostname});
require('./native-sync-r6-preload.cjs');
const relay=await start({root,provider,maxCalls:12});globalThis.__r9ProviderRelay=relay;
process.env.API_URL=relay.url;process.env.API_Key=relay.token;
// Real-provider logs expose only lifecycle/transport projections. Model payloads
// and credentials are not emitted or persisted as debug output.
for(const name of ['stdout','stderr'])process[name].write=function(_chunk,encoding,callback){if(typeof encoding==='function')encoding();else callback?.();return true;};
const create=fs.createWriteStream;
fs.createWriteStream=function(file,...args){const stream=create.call(this,file,...args);if(String(file).includes('/DebugLog/')){const write=stream.write.bind(stream);stream.write=(_chunk,...rest)=>write('[R9 log projection; values omitted]\n',...rest);}return stream;};
process.on('SIGTERM',()=>{void relay.close();});
