'use strict';
// Stdin-only SSH provisioning: never echo a bearer, global key or chat body.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {DesktopSessions}=require('../Plugin/NativeSync/mobile/desktopSessions');
async function main(){
 const root='/home/admin/VCPKF/vcp/versions/vcptoolbox-daily-r10';
 const data='/home/admin/VCPKF/vcp/runtime-data/native-sync-r10';
 if(process.platform!=='linux'||path.resolve(__dirname,'..')!==root)throw Error('EXPLICIT_R10_DAILY_ROOT_REQUIRED');
 let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>16384)throw Error('GRANT_TOO_LARGE');}
 const grant=JSON.parse(text);if(!grant||Object.keys(grant).some(k=>!['deviceId','token','topics'].includes(k)))throw Error('INVALID_DESKTOP_GRANT');
 const config=JSON.parse(fs.readFileSync(path.join(root,'mobile-host.json'),'utf8'));
 const file=path.join(data,'central.sqlite'),stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('DESKTOP_DATABASE_ALIAS');
 const db=new DatabaseSync(file);try{db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL');const result=new DesktopSessions(db,config.topics).register(grant);process.stdout.write(JSON.stringify(result));}finally{db.close();}
}
main().catch(()=>{process.stderr.write('DESKTOP_GRANT_REGISTRATION_FAILED\n');process.exitCode=1;});
