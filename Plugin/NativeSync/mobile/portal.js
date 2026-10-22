'use strict';
const express = require('express');
const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { identity } = require('../sync/protocol');
const { ConversationExecution, error, digest } = require('./execution');
const cookieName = '__Secure-vcp_mobile';
const protectedHttps = req => Boolean(req.socket?.encrypted) || (req.secure === true && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress));
class MobilePortal {
    constructor({ store, config, agentManager }) {
        this.store = store; this.db = store.db;
        this.origin = new URL(config.NativeMobileOrigin).origin;
        if (!this.origin.startsWith('https://')) throw error('MOBILE_HTTPS_ORIGIN_REQUIRED');
        const list = JSON.parse(config.NativeMobileTopics || '[]');
        if (!Array.isArray(list) || !list.length || list.length > 8) throw error('EXPLICIT_MOBILE_TOPICS_REQUIRED');
        this.topics = list.map(t => {
            identity({ ...t, msgId: '_' });
            if (t.ownerType !== 'agent' || !/^[a-zA-Z0-9_-]{1,64}$/.test(t.key) || !t.agentAlias || !t.model) throw error('INVALID_MOBILE_TOPIC');
            return { ...t };
        });
        if (new Set(this.topics.map(t=>t.key)).size !== this.topics.length) throw error('DUPLICATE_MOBILE_TOPIC');
        this.db.exec(`CREATE TABLE IF NOT EXISTS mobile_pairings(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL,scopes TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS mobile_sessions(hash TEXT PRIMARY KEY,id TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL,scopes TEXT NOT NULL);`);
        this.engine = new ConversationExecution({ store, topics: this.topics, agentManager, startDelayMs: Math.max(0, Math.min(Number(config.NativeMobileStartDelayMs) || 0, 10000)) });
        this.router = express.Router();
        this.router.use((req, res, next) => {
            if (!protectedHttps(req)) return res.status(403).json({error:{code:'HTTPS_REQUIRED'}});
            res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
            res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'no-referrer'); next();
        });
        this.router.use('/api', (req, res, next) => {
            res.set('Cache-Control', 'no-store');
            if (!req.secure) return next(error('HTTPS_REQUIRED', 403));
            if (req.method !== 'GET' && req.headers.origin !== this.origin) return next(error('ORIGIN_REJECTED', 403));
            next();
        }, express.json({ limit: '32kb', strict: true }));
        this.router.post('/api/pair', (req, res, next) => { try { this.pair(req, res); } catch (e) { next(e); } });
        this.router.use('/api', (req, _res, next) => {
            try {
                const values = String(req.headers.cookie || '').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
                if (values.length !== 1) throw error('PAIR_REQUIRED', 401);
                const token = values[0].slice(cookieName.length+1);
                if (!/^[a-zA-Z0-9_-]{43}$/.test(token)) throw error('PAIR_REQUIRED', 401);
                const row = this.db.prepare('SELECT id,expires,scopes FROM mobile_sessions WHERE hash=?').get(digest(token));
                if (!row || row.expires <= Date.now()) throw error('PAIR_REQUIRED', 401);
                req.mobileSession = { id: row.id, scopes: JSON.parse(row.scopes) }; next();
            } catch (e) { next(e); }
        });
        this.router.get('/api/session', (req, res) => res.json({ authenticated: true, topics: this.catalog(req.mobileSession) }));
        this.router.get('/api/conversations', (req, res) => res.json({ topics: this.catalog(req.mobileSession) }));
        this.router.get('/api/conversations/:key', (req,res,next) => {
            try {
                const topic = this.authorize(req); const after = Number(req.query.after || 0);
                if (!Number.isSafeInteger(after) || after < 0) throw error('INVALID_CURSOR');
                const rows = this.db.prepare('SELECT last_seq AS seq,message_json,deleted,msg_id AS id FROM messages WHERE owner_type=? AND owner_id=? AND topic_id=? AND last_seq>? ORDER BY last_seq LIMIT 201').all(topic.ownerType,topic.ownerId,topic.topicId,after);
                const page = rows.slice(0,200);
                res.json({ messages: page.map(r=>({seq:r.seq,id:r.id,deleted:Boolean(r.deleted),message:r.message_json?JSON.parse(r.message_json):null})), next:page.at(-1)?.seq??after, hasMore:rows.length>200, executions:this.engine.list(topic.key,req.mobileSession.id) });
            } catch(e) { next(e); }
        });
        this.router.post('/api/conversations/:key/messages', (req,res,next) => {
            try {
                const topic=this.authorize(req);
                if (!req.body || Object.keys(req.body).some(k=>!['requestId','text'].includes(k))) throw error('INVALID_SUBMISSION');
                res.status(202).json(this.engine.accept(req.mobileSession.id,{topicKey:topic.key,...req.body}));
            } catch(e) { next(e); }
        });
        this.router.post('/api/executions/:id/cancel', (req,res,next) => { try {res.status(202).json(this.engine.cancel(req.params.id,req.mobileSession.id));} catch(e) {next(e);} });
        this.router.use('/api', (_req,res) => res.status(404).json({error:{code:'NOT_FOUND'}}));
        const dist=path.resolve(config.NativeMobilePwaDir || path.join(__dirname,'../mobile-dist'));
        this.router.use(express.static(dist,{index:'index.html',dotfiles:'deny',maxAge:0,fallthrough:true}));
        this.router.use((_req,res)=>res.status(404).end());
        this.router.use((e,_req,res,_next)=>res.status(e.status||400).json({error:{code:e.code||'BAD_REQUEST'}}));
    }
    authorize(req) { const t=this.topics.find(t=>t.key===req.params.key && req.mobileSession.scopes.includes(t.key));if(!t)throw error('TOPIC_NOT_ALLOWED',403);return t; }
    catalog(session) {
        return this.topics.filter(t=>session.scopes.includes(t.key)).map(t=>({key:t.key,agentName:t.agentName,topicName:t.topicName,...this.db.prepare('SELECT count(*) AS messageCount,coalesce(max(last_seq),0) AS seq FROM messages WHERE owner_type=? AND owner_id=? AND topic_id=? AND deleted=0').get(t.ownerType,t.ownerId,t.topicId)}));
    }
    createPairing() {
        const code=randomBytes(24).toString('base64url'),expiresAt=Date.now()+180000;
        this.db.prepare('INSERT INTO mobile_pairings(hash,expires,scopes) VALUES(?,?,?)').run(digest(code),expiresAt,JSON.stringify(this.topics.map(t=>t.key)));
        return {pairingCode:code,expiresAt};
    }
    pair(req,res) {
        const code=req.body?.code;
        if(typeof code!=='string'||!/^[a-zA-Z0-9_-]{32}$/.test(code))throw error('INVALID_PAIRING',401);
        const hash=digest(code),now=Date.now();const grant=this.db.prepare('SELECT * FROM mobile_pairings WHERE hash=?').get(hash);
        if(!grant||grant.used||grant.expires<=now)throw error('INVALID_PAIRING',401);
        const token=randomBytes(32).toString('base64url'),id=randomUUID();
        this.db.exec('BEGIN IMMEDIATE');
        try {
            if(!this.db.prepare('UPDATE mobile_pairings SET used=1 WHERE hash=? AND used=0 AND expires>?').run(hash,now).changes)throw error('INVALID_PAIRING',401);
            this.db.prepare('INSERT INTO mobile_sessions(hash,id,expires,scopes) VALUES(?,?,?,?)').run(digest(token),id,now+8*3600000,grant.scopes);this.db.exec('COMMIT');
        } catch(e){this.db.exec('ROLLBACK');throw e;}
        res.setHeader('Set-Cookie',`${cookieName}=${token}; Path=/mobile; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
        res.json({authenticated:true});
    }
    beginDrain(){this.engine.beginDrain();}
    async close(){await this.engine.close();}
    snapshot(){return {executions:this.engine.snapshot(),sessionCount:this.db.prepare('SELECT count(*) AS n FROM mobile_sessions').get().n};}
}
module.exports={MobilePortal,cookieName,protectedHttps};
