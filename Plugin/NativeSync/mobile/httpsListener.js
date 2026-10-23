'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {execFileSync}=require('node:child_process');
const ORIGIN='https://dnvcp.skmt617.top:13848';
const listeners=new WeakMap();
function tlsOptions(config){
 if(config.port!==8888||config.httpsOrigin!==ORIGIN||'publicHttpOrigin' in config)throw Error('R10_HTTPS_ONLY_PROFILE_REQUIRED');
 const certFile=config.tls?.certFile,keyFile=config.tls?.keyFile;
 if(!certFile||!keyFile||!path.isAbsolute(certFile)||!path.isAbsolute(keyFile))throw Error('R10_TLS_CERTIFICATE_REQUIRED');
 let cert,key;
 try{
  const cs=fs.statSync(certFile),ks=fs.statSync(keyFile);
  if(!cs.isFile()||!ks.isFile()||cs.size>1024*1024||ks.size>65536||(ks.mode&0o007))throw Error();
  cert=fs.readFileSync(certFile);key=fs.readFileSync(keyFile);
 }catch{throw Error('R10_TLS_FILES_UNAVAILABLE');}
 try{
  const leaf=new crypto.X509Certificate(cert),now=Date.now();
  if(!leaf.checkHost('dnvcp.skmt617.top',{subject:'never'})||leaf.ca||Date.parse(leaf.validFrom)>now||Date.parse(leaf.validTo)<=now)throw Error();
  const actual=crypto.createPublicKey(crypto.createPrivateKey(key)).export({type:'spki',format:'der'});
  if(!actual.equals(leaf.publicKey.export({type:'spki',format:'der'})))throw Error();
 }catch{key.fill(0);throw Error('R10_TLS_IDENTITY_INVALID');}
 try{execFileSync('openssl',['verify','-purpose','sslserver','-verify_hostname','dnvcp.skmt617.top','-untrusted',certFile,certFile],{stdio:'ignore',timeout:10000});}
 catch{key.fill(0);throw Error('R10_TLS_CHAIN_UNTRUSTED');}
 return {key,cert,minVersion:'TLSv1.2'};
}
function createListener(options,app){
 const server=https.createServer(options),state={sockets:new Map(),closing:false,closed:null};listeners.set(server,state);
 const key=s=>`${s.remoteAddress}:${s.remotePort}`;
 server.on('connection',socket=>{
  const id=key(socket),entry={socket,secure:null,active:0};state.sockets.set(id,entry);
  socket.once('close',()=>{if(state.sockets.get(id)===entry)state.sockets.delete(id);});
 });
 server.on('secureConnection',socket=>{const entry=state.sockets.get(key(socket));if(entry)entry.secure=socket;});
 server.on('request',(req,res)=>{
  const entry=state.sockets.get(key(req.socket));if(!entry)return;entry.active++;
  let ended=false;const end=()=>{if(ended)return;ended=true;entry.active--;if(state.closing&&entry.active===0)(entry.secure||entry.socket).end();};
  res.once('finish',end);res.once('close',end);
 });
 server.on('request',app);
 // A cleartext request to this port is closed; there is no HTTP listener or
 // redirect service, and forwarded headers never establish transport trust.
 server.on('clientError',(_error,socket)=>socket.destroy());
 return server;
}
function listenerState(server){const state=listeners.get(server);if(!state)throw Error('R10_OWNED_LISTENER_REQUIRED');return {connections:[...state.sockets.values()].filter(s=>!s.socket.destroyed).length,activeRequests:[...state.sockets.values()].reduce((n,s)=>n+s.active,0),closing:state.closing};}
function drainListener(server){
 const state=listeners.get(server);if(!state)throw Error('R10_OWNED_LISTENER_REQUIRED');if(state.closed)return state.closed;
 state.closing=true;state.closed=new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 server.closeIdleConnections?.();
 // HTTPS preconnects may have no HTTP parser/request yet. Node's HTTP idle
 // closer cannot account for unfinished TLS handshakes; no accepted work lives
 // on these sockets. Active requests remain until their response finishes.
 for(const entry of state.sockets.values())if(entry.active===0)entry.socket.destroy();
 return state.closed;
}
module.exports={ORIGIN,tlsOptions,createListener,drainListener,listenerState};
