'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {execFileSync}=require('node:child_process');
const ORIGIN='https://wp10.unicorn.org.cn:13848';
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
  if(!leaf.checkHost('wp10.unicorn.org.cn',{subject:'never'})||leaf.ca||Date.parse(leaf.validFrom)>now||Date.parse(leaf.validTo)<=now)throw Error();
  const actual=crypto.createPublicKey(crypto.createPrivateKey(key)).export({type:'spki',format:'der'});
  if(!actual.equals(leaf.publicKey.export({type:'spki',format:'der'})))throw Error();
 }catch{key.fill(0);throw Error('R10_TLS_IDENTITY_INVALID');}
 try{execFileSync('openssl',['verify','-purpose','sslserver','-verify_hostname','wp10.unicorn.org.cn','-untrusted',certFile,certFile],{stdio:'ignore',timeout:10000});}
 catch{key.fill(0);throw Error('R10_TLS_CHAIN_UNTRUSTED');}
 return {key,cert,minVersion:'TLSv1.2'};
}
function createListener(options,app){
 const server=https.createServer(options,app);
 // A cleartext request to this port is closed; there is no HTTP listener or
 // redirect service, and forwarded headers never establish transport trust.
 server.on('clientError',(_error,socket)=>socket.destroy());
 return server;
}
module.exports={ORIGIN,tlsOptions,createListener};
