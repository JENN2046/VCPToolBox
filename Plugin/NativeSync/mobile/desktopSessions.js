'use strict';
const {createHash}=require('node:crypto');
const {identity}=require('../sync/protocol');
const fail=(code,status=403)=>Object.assign(new Error(code),{code,status});
const digest=value=>createHash('sha256').update(value).digest('hex');
const topicKey=t=>JSON.stringify([t.ownerType,t.ownerId,t.topicId]);
function scopeOf(topics){
 if(!Array.isArray(topics)||!topics.length||topics.length>8)throw fail('INVALID_DESKTOP_SCOPE');
 const keys=topics.map(t=>{identity({...t,msgId:'_'});return topicKey(t);}).sort();
 if(new Set(keys).size!==keys.length)throw fail('INVALID_DESKTOP_SCOPE');
 return JSON.stringify(keys);
}
// Only the R10 host uses this authority. Grants live in the existing central
// SQLite and are provisioned through the already trusted SSH host connection.
// This never loads the ToolBox global key or changes model settings.
class DesktopSessions{
 constructor(db,topics){
  this.db=db;this.scope=scopeOf(topics);
  db.exec('CREATE TABLE IF NOT EXISTS native_desktop_sessions(device_id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,scope TEXT NOT NULL,expires INTEGER NOT NULL)');
 }
 register({deviceId,token,topics},now=Date.now()){
  if(typeof deviceId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(deviceId)||typeof token!=='string'||!/^vcp_sync_[a-zA-Z0-9_-]{43}$/.test(token))throw fail('INVALID_DESKTOP_GRANT');
  if(scopeOf(topics)!==this.scope)throw fail('DESKTOP_SCOPE_MISMATCH');
  const expires=now+30*86400000;
  this.db.prepare('INSERT INTO native_desktop_sessions(device_id,token_hash,scope,expires) VALUES(?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET token_hash=excluded.token_hash,scope=excluded.scope,expires=excluded.expires').run(deviceId,digest(token),this.scope,expires);
  return {registered:true,deviceId,expires};
 }
 revoke(deviceId){return this.db.prepare('DELETE FROM native_desktop_sessions WHERE device_id=?').run(deviceId).changes>0;}
 authorize(req,now=Date.now()){
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer vcp_sync_[a-zA-Z0-9_-]{43}$/.test(header))throw fail('AUTH_REQUIRED',401);
  const row=this.db.prepare('SELECT device_id,scope,expires FROM native_desktop_sessions WHERE token_hash=?').get(digest(header.slice(7)));
  if(!row||row.expires<=now||row.scope!==this.scope)throw fail('DESKTOP_SESSION_REQUIRED',401);
  const url=new URL(req.originalUrl||req.url,'https://localhost');
  const allowed=(req.method==='GET'&&/^\/api\/(?:v1\/sync|plugins\/NativeSync\/sync)\/(pull|status)$/.test(url.pathname))||(req.method==='POST'&&/^\/api\/(?:v1\/sync\/push|plugins\/NativeSync\/sync\/push|plugins\/NativeSync\/mobile\/catalog)$/.test(url.pathname));
  if(!allowed)throw fail('DESKTOP_ROUTE_FORBIDDEN');
  const keys=JSON.parse(row.scope);
  if(req.method==='POST'){
   const rows=url.pathname.endsWith('/catalog')?req.body?.topics:[req.body];
   if(!Array.isArray(rows)||!rows.length||rows.some(t=>!t||!keys.includes(topicKey(t))))throw fail('DESKTOP_TOPIC_FORBIDDEN');
   if(!url.pathname.endsWith('/catalog')&&req.body.deviceId!==row.device_id)throw fail('DESKTOP_DEVICE_MISMATCH');
  }
  req.nativeSyncTopics=keys;
  return {deviceId:row.device_id};
 }
}
module.exports={DesktopSessions,scopeOf};
