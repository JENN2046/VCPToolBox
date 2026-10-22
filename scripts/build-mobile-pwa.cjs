'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=path.join(root,'apps/mobile'),artifacts=path.resolve(root,'../../artifacts/native-sync-r7');
const deps=path.join(artifacts,'frontend-deps/node_modules'),vite=path.join(deps,'vite/bin/vite.js');
if(!fs.existsSync(vite))throw Error('Install the declared apps/mobile package into the isolated native-sync-r7/frontend-deps first');
const link=path.join(source,'node_modules');
if(!fs.existsSync(link)){
 if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',`New-Item -ItemType Junction -Path '${link.replaceAll("'","''")}' -Target '${deps.replaceAll("'","''")}' | Out-Null`],{windowsHide:true});
 else fs.symlinkSync(deps,link,'dir');
}
if(fs.realpathSync(link).toLowerCase()!==fs.realpathSync(deps).toLowerCase())throw Error('Unexpected mobile dependency boundary');
const out=path.join(artifacts,'pwa-dist-'+Date.now());if(fs.existsSync(out))throw Error('Fresh build output required');
const env={NODE_ENV:'production'};for(const key of ['PATH','Path','SystemRoot','WINDIR','COMSPEC','PATHEXT'])if(process.env[key])env[key]=process.env[key];
env.TEMP=env.TMP=path.join(artifacts,'build-temp');env.HOME=env.USERPROFILE=path.join(artifacts,'build-home');fs.mkdirSync(env.TEMP,{recursive:true});fs.mkdirSync(env.HOME,{recursive:true});
execFileSync(process.execPath,[vite,'build',source,'--outDir',out],{cwd:root,env,windowsHide:true,stdio:'inherit'});
const files=[];function visit(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,item.name);if(item.isDirectory())visit(file);else{const bytes=fs.readFileSync(file);if(bytes.includes(Buffer.from('isolated-poc-token'))||bytes.includes(Buffer.from('r7-synthetic-provider-unused')))throw Error('Server credential embedded in frontend');files.push({name:path.relative(out,file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}visit(out);
fs.writeFileSync(path.join(artifacts,'FRONTEND_BUILD.json'),JSON.stringify({source,dist:out,exitCode:0,noToolboxKeyEmbedded:true,files},null,2)+'\n');
