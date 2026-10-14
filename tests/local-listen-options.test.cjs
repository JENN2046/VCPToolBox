'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {localListenArguments}=require('../modules/localListenOptions');
test('unset preserves legacy TCP and Unix socket arguments',()=>{for(const port of ['6005',6005,'/tmp/existing.sock'])assert.deepEqual(localListenArguments(port,undefined),[port]);});
test('explicit loopback accepts IPv4 and IPv6 and validates TCP port',()=>{for(const host of ['127.0.0.1','::1'])assert.deepEqual(localListenArguments('6005',host),[6005,host]);for(const port of ['/tmp/a.sock',-1,65536,'6005junk',''])assert.throws(()=>localListenArguments(port,'127.0.0.1'),/PORT_INVALID/);});
test('non-loopback and ambiguous host inputs are rejected',()=>{for(const host of ['0.0.0.0','::','192.168.1.1','localhost','',null,' 127.0.0.1','127.0.0.1 '])assert.throws(()=>localListenArguments(6005,host),/MUST_BE_LOOPBACK/);});
test('explicit listener actually binds IPv4 loopback',async t=>{const server=http.createServer((q,s)=>s.end('ok'));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(...localListenArguments(0,'127.0.0.1'),resolve);});t.after(()=>new Promise(resolve=>server.close(resolve)));assert.equal(server.address().address,'127.0.0.1');const result=await fetch('http://127.0.0.1:'+server.address().port);assert.equal(await result.text(),'ok');});
