'use strict';
const { DatabaseSync } = require('node:sqlite');
const { identity, stable, sha256, messageHash, tombstoneHash } = require('./protocol');
const {validateEnvelope,withFields,fieldsFrom}=require('./metadata');

class SyncError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = status;
  }
}
class CentralStore {
  constructor(filePath) {
    this.db = new DatabaseSync(filePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS messages (
        owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, topic_id TEXT NOT NULL,
        msg_id TEXT NOT NULL, hash TEXT NOT NULL, deleted INTEGER NOT NULL,
        message_json TEXT, last_seq INTEGER NOT NULL,
        PRIMARY KEY(owner_type, owner_id, topic_id, msg_id)
      );
      CREATE TABLE IF NOT EXISTS journal (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, topic_id TEXT NOT NULL,
        msg_id TEXT NOT NULL, action TEXT NOT NULL, hash TEXT NOT NULL,
        message_json TEXT, device_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS applied_ops (
        device_id TEXT NOT NULL, op_id TEXT NOT NULL,
        request_hash TEXT NOT NULL, result_json TEXT NOT NULL,
        PRIMARY KEY(device_id, op_id)
      );
      CREATE INDEX IF NOT EXISTS idx_journal_topic ON journal(owner_type,owner_id,topic_id,seq);
    `);
    // Legacy JSON never proves metadata publication authority. Only these
    // independently persisted columns, written in the same Journal transaction,
    // identify a validated envelope; existing rows start at version zero.
    for(const table of ['messages','journal']){
      const columns=this.db.prepare('PRAGMA table_info('+table+')').all();
      if(!columns.some(c=>c.name==='metadata_version'))this.db.exec('ALTER TABLE '+table+' ADD COLUMN metadata_version INTEGER NOT NULL DEFAULT 0');
      if(!columns.some(c=>c.name==='metadata_hash'))this.db.exec('ALTER TABLE '+table+' ADD COLUMN metadata_hash TEXT');
    }
    this.findOp = this.db.prepare('SELECT request_hash, result_json FROM applied_ops WHERE device_id=? AND op_id=?');
    this.findMessage = this.db.prepare('SELECT hash, deleted, last_seq, message_json,metadata_version,metadata_hash FROM messages WHERE owner_type=? AND owner_id=? AND topic_id=? AND msg_id=?');
    this.insertJournal = this.db.prepare('INSERT INTO journal(owner_type,owner_id,topic_id,msg_id,action,hash,message_json,device_id,metadata_version,metadata_hash) VALUES (?,?,?,?,?,?,?,?,?,?)');
    this.upsertMessage = this.db.prepare(`INSERT INTO messages(owner_type,owner_id,topic_id,msg_id,hash,deleted,message_json,last_seq,metadata_version,metadata_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_type,owner_id,topic_id,msg_id) DO UPDATE SET
      hash=excluded.hash, deleted=excluded.deleted, message_json=excluded.message_json, last_seq=excluded.last_seq,metadata_version=excluded.metadata_version,metadata_hash=excluded.metadata_hash`);
    this.insertOp = this.db.prepare('INSERT INTO applied_ops(device_id,op_id,request_hash,result_json) VALUES(?,?,?,?)');
    this.pullStmt = this.db.prepare('SELECT * FROM journal WHERE seq > ? ORDER BY seq ASC LIMIT ?');
    this.headStmt = this.db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM journal');
  }
  apply(raw, authority = {}) {
    const id = identity(raw);
    if (!raw || typeof raw.deviceId !== 'string' || !raw.deviceId ||
        typeof raw.opId !== 'string' || !raw.opId ||
        !['upsert','delete'].includes(raw.action) ||
        (raw.baseHash !== null && (typeof raw.baseHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.baseHash)))) {
      throw new SyncError('INVALID_OPERATION', 'Invalid deviceId, opId, action or baseHash');
    }
    let message = null;
    if (raw.action === 'upsert') {
      if (!raw.message || raw.message.id !== id.msgId) {
        throw new SyncError('INVALID_MESSAGE', 'message.id must match msgId');
      }
      messageHash(raw.message);
      message = raw.message;
    }
    if(raw.metadata!==undefined&&!authority.metadataPublisher)throw new SyncError('METADATA_PUBLISHER_REQUIRED','Trusted metadata publisher required',403);
    if(raw.metadata!==undefined&&raw.action!=='upsert')throw new SyncError('INVALID_CONTROL_METADATA','Metadata is only valid on a live upsert',400);
    const incoming=raw.metadata===undefined?null:validateEnvelope(message,raw.metadata);
    if(message?._nativeSyncMetadata&&!incoming)throw new SyncError('VERSIONED_METADATA_REQUIRED','Stored metadata cannot be supplied without publication authority',409);
    const normalized = { ...id, deviceId: raw.deviceId, opId: raw.opId,
      action: raw.action, baseHash: raw.baseHash, message, ...(incoming?{metadata:incoming}:{}) };
    const requestHash = sha256(stable(normalized));
    const args = [id.ownerType, id.ownerId, id.topicId, id.msgId];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previousOp = this.findOp.get(raw.deviceId, raw.opId);
      if (previousOp) {
        if (previousOp.request_hash !== requestHash) {
          throw new SyncError('IDEMPOTENCY_KEY_REUSED', 'opId reused for different content', 409);
        }
        const result = JSON.parse(previousOp.result_json);
        this.db.exec('COMMIT');
        return { ...result, replayed: true };
      }
      const previous = this.findMessage.get(...args);
      const hash = raw.action === 'delete' ? tombstoneHash(id) : messageHash(message);
      let priorMetadata=previous?.metadata_version?this.projectMessage(previous)._nativeSyncMetadata:null;
      let metadata=priorMetadata;
      if(incoming){
        if(previous?.deleted)throw new SyncError('METADATA_TOMBSTONED','Metadata cannot resurrect a deleted message',409);
        const version=priorMetadata?.version||0;
        if(incoming.version<version||incoming.version>version+1||(incoming.version===version&&incoming.hash!==priorMetadata.hash))throw new SyncError('METADATA_VERSION_CONFLICT','Expected consecutive metadata version',409);
        if(incoming.hash!==priorMetadata?.hash){
          if((previous?.hash??null)!==raw.baseHash)throw new SyncError('MESSAGE_CONFLICT','Metadata content binding changed',409);
          metadata=incoming;
        }
      }else if(message?.contextCompaction!==undefined||message?.tool_calls!==undefined||message?.tool_call_id!==undefined||message?.isThinking!==undefined){
        if(!priorMetadata)throw new SyncError('VERSIONED_METADATA_REQUIRED','Control metadata requires a versioned envelope',409);
      }
      if(message&&metadata){message=withFields(message,metadata);fieldsFrom(message);}
      const metadataChanged=(metadata?.hash||null)!==(priorMetadata?.hash||null);
      let seq;
      if (previous && previous.hash === hash && Boolean(previous.deleted) === (raw.action === 'delete') && !metadataChanged) {
        // Same materialized state. A fresh opId must not create duplicate journal entries.
        seq = Number(previous.last_seq);
      } else {
        if ((previous?.hash ?? null) !== raw.baseHash) {
          throw new SyncError('MESSAGE_CONFLICT', 'Expected message hash differs from central state', 409);
        }
        seq = Number(this.insertJournal.run(...args, raw.action, hash,
          message ? JSON.stringify(message) : null, raw.deviceId,message&&metadata?metadata.version:0,message&&metadata?metadata.hash:null).lastInsertRowid);
        this.upsertMessage.run(...args, hash, raw.action === 'delete' ? 1 : 0,
          message ? JSON.stringify(message) : null, seq,message&&metadata?metadata.version:0,message&&metadata?metadata.hash:null);
      }
      const result = { seq, hash, deleted: raw.action === 'delete', ...(metadata&&raw.action!=='delete'?{metadataVersion:metadata.version,metadataHash:metadata.hash}:{}) };
      this.insertOp.run(raw.deviceId, raw.opId, requestHash, JSON.stringify(result));
      this.db.exec('COMMIT');
      return { ...result, replayed: false };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  pull(afterSeq, limit = 100, allowedTopics) {
    if (!Number.isSafeInteger(afterSeq) || afterSeq < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new SyncError('INVALID_CURSOR', 'afterSeq must be >= 0; limit must be 1..500');
    }
    if (allowedTopics !== undefined && (!Array.isArray(allowedTopics) || allowedTopics.some(key => typeof key !== 'string'))) {
      throw new SyncError('INVALID_TOPIC_SCOPE', 'Topic scope must be an array of identity keys', 403);
    }
    const allowed = allowedTopics === undefined ? null : new Set(allowedTopics);
    // LIMIT bounds the global scan, not just the authorized output. An empty
    // filtered page must still acknowledge precisely this scanned window.
    const rows = this.pullStmt.all(afterSeq, limit);
    const headSeq = Number(this.headStmt.get().seq);
    const nextSeq = rows.at(-1)?.seq ?? afterSeq;
    const events = rows.filter(row => !allowed || allowed.has(JSON.stringify([row.owner_type, row.owner_id, row.topic_id]))).map(row => ({
      seq: Number(row.seq), ownerType: row.owner_type, ownerId: row.owner_id,
      topicId: row.topic_id, msgId: row.msg_id,
      action: row.action, hash: row.hash, message: this.projectMessage(row),
      sourceDevice: row.device_id
    }));
    return { events, headSeq, nextSeq, hasMore: nextSeq < headSeq };
  }
  projectMessage(row) {
    if(!row.message_json)return null;
    const message=JSON.parse(row.message_json);
    if(!row.metadata_version){for(const key of ['_nativeSyncMetadata','contextCompaction','isThinking','tool_calls','tool_call_id'])delete message[key];return message;}
    const envelope=validateEnvelope(message,message._nativeSyncMetadata);
    if(envelope.version!==row.metadata_version||envelope.hash!==row.metadata_hash)throw new SyncError('METADATA_PROJECTION_CORRUPT','Metadata authority columns disagree',409);
    return withFields(message,envelope);
  }
  metrics() {
    return {
      headSeq: Number(this.headStmt.get().seq),
      journalRows: Number(this.db.prepare('SELECT COUNT(*) AS n FROM journal').get().n),
      appliedOps: Number(this.db.prepare('SELECT COUNT(*) AS n FROM applied_ops').get().n),
      liveMessages: Number(this.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE deleted=0').get().n)
    };
  }
  close() { this.db.close(); }
}
module.exports = { CentralStore, SyncError };
