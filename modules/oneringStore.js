'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const {
  normalizePostTurnMetadata,
} = require('./oneringPostTurnMetadata');

const DEFAULT_STORE_FILE_NAME = 'onering.sqlite';
const DEFAULT_MAX_RECORDS = 100;
const VALID_ROLES = new Set(['user', 'assistant']);

class OneRingStore {
  constructor(options = {}) {
    const baseDir = normalizeBaseDir(options.baseDir);
    const fileName = normalizeStoreFileName(options.fileName || DEFAULT_STORE_FILE_NAME);
    const dbPath = path.resolve(baseDir, fileName);

    ensurePathInsideBase(baseDir, dbPath);
    fs.mkdirSync(baseDir, { recursive: true });

    this.baseDir = baseDir;
    this.dbPath = dbPath;
    this.maxRecords = normalizeMaxRecords(options.maxRecords, DEFAULT_MAX_RECORDS);
    this.db = new Database(dbPath);
    this.closed = false;
    this._enableForeignKeys();
    this._initializeSchema();
  }

  addMessage(record = {}) {
    this._assertOpen();

    const normalized = normalizeMessageRecord(record);
    const timestamp = normalized.timestamp || new Date().toISOString();
    const statement = this.db.prepare(`
      INSERT INTO messages (
        agent_name,
        role,
        sender_name,
        frontend_source,
        content,
        timestamp,
        post_context_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      normalized.agentName,
      normalized.role,
      normalized.senderName,
      normalized.frontendSource,
      normalized.content,
      timestamp,
      normalized.postContextHash,
    );

    this._pruneAgent(normalized.agentName);

    return {
      id: Number(result.lastInsertRowid),
      ...normalized,
      timestamp,
    };
  }

  listMessages(agentName, options = {}) {
    this._assertOpen();

    const safeAgentName = normalizeRequiredString(agentName, 'agentName');
    const limit = normalizeReadLimit(options.limit, this.maxRecords);
    const rows = this.db.prepare(`
      SELECT
        id,
        agent_name AS agentName,
        role,
        sender_name AS senderName,
        frontend_source AS frontendSource,
        content,
        timestamp,
        post_context_hash AS postContextHash
      FROM messages
      WHERE agent_name = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(safeAgentName, limit);

    return rows.reverse();
  }

  countMessages(agentName) {
    this._assertOpen();

    const safeAgentName = normalizeRequiredString(agentName, 'agentName');
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM messages WHERE agent_name = ?').get(safeAgentName);
    return row.count;
  }

  upsertPostTurn(metadata) {
    this._assertOpen();

    const normalized = normalizePostTurnMetadataOrThrow(metadata);
    if (normalized.status !== 'pending') {
      throw new TypeError('OneRing post-turn upsert requires pending metadata');
    }

    this.db.prepare(`
      INSERT INTO post_turns (
        turn_id,
        agent_name,
        frontend_source,
        request_hash,
        request_block_count,
        status,
        response_message_id,
        response_content_hash,
        created_at,
        updated_at,
        completed_at,
        aborted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(turn_id) DO UPDATE SET
        request_hash = excluded.request_hash,
        request_block_count = excluded.request_block_count,
        updated_at = excluded.updated_at
      WHERE post_turns.status = 'pending'
        AND post_turns.agent_name = excluded.agent_name
        AND post_turns.frontend_source = excluded.frontend_source
    `).run(
      normalized.turnId,
      normalized.agentName,
      normalized.frontendSource,
      normalized.requestHash,
      normalized.requestBlockCount,
      normalized.status,
      normalized.responseMessageId,
      normalized.responseContentHash,
      normalized.createdAt,
      normalized.updatedAt,
      normalized.completedAt,
      normalized.abortedAt,
    );

    return this.getPostTurn(normalized.agentName, normalized.turnId);
  }

  getPostTurn(agentName, turnId) {
    this._assertOpen();

    const safeAgentName = normalizeRequiredString(agentName, 'agentName');
    const safeTurnId = normalizeRequiredString(turnId, 'turnId');
    const row = this.db.prepare(`
      SELECT
        turn_id AS turnId,
        agent_name AS agentName,
        frontend_source AS frontendSource,
        request_hash AS requestHash,
        request_block_count AS requestBlockCount,
        status,
        response_message_id AS responseMessageId,
        response_content_hash AS responseContentHash,
        created_at AS createdAt,
        updated_at AS updatedAt,
        completed_at AS completedAt,
        aborted_at AS abortedAt
      FROM post_turns
      WHERE agent_name = ?
        AND turn_id = ?
      LIMIT 1
    `).get(safeAgentName, safeTurnId);

    return row || null;
  }

  completePostTurn(metadata, responseMessageId) {
    this._assertOpen();

    const normalized = normalizePostTurnMetadataOrThrow(metadata);
    if (normalized.status !== 'completed') {
      throw new TypeError('OneRing post-turn completion requires completed metadata');
    }

    const safeMessageId = normalizePositiveInteger(responseMessageId);
    if (safeMessageId === null) {
      return {
        updated: false,
        reason: 'invalid-response-message-id',
        row: null,
      };
    }

    if (!normalized.responseContentHash) {
      return {
        updated: false,
        reason: 'missing-response-content-hash',
        row: null,
      };
    }

    const ownership = this._validateResponseMessageOwnership(normalized, safeMessageId);
    if (!ownership.ok) {
      return {
        updated: false,
        reason: ownership.reason,
        row: null,
      };
    }

    const completedAt = normalized.completedAt || normalized.updatedAt;
    const result = this.db.prepare(`
      UPDATE post_turns
      SET
        status = 'completed',
        response_message_id = ?,
        response_content_hash = ?,
        updated_at = ?,
        completed_at = ?,
        aborted_at = NULL
      WHERE turn_id = ?
        AND agent_name = ?
        AND frontend_source = ?
        AND status = 'pending'
    `).run(
      safeMessageId,
      normalized.responseContentHash,
      normalized.updatedAt,
      completedAt,
      normalized.turnId,
      normalized.agentName,
      normalized.frontendSource,
    );

    const row = this.getPostTurn(normalized.agentName, normalized.turnId);
    return {
      updated: result.changes > 0,
      reason: result.changes > 0 ? null : 'missing-pending-post-turn',
      row,
    };
  }

  abortPostTurn(metadata) {
    this._assertOpen();

    const normalized = normalizePostTurnMetadataOrThrow(metadata);
    if (normalized.status !== 'aborted') {
      throw new TypeError('OneRing post-turn abort requires aborted metadata');
    }

    const abortedAt = normalized.abortedAt || normalized.updatedAt;
    const result = this.db.prepare(`
      UPDATE post_turns
      SET
        status = 'aborted',
        response_message_id = NULL,
        response_content_hash = NULL,
        updated_at = ?,
        completed_at = NULL,
        aborted_at = ?
      WHERE turn_id = ?
        AND agent_name = ?
        AND frontend_source = ?
        AND status = 'pending'
    `).run(
      normalized.updatedAt,
      abortedAt,
      normalized.turnId,
      normalized.agentName,
      normalized.frontendSource,
    );

    const row = this.getPostTurn(normalized.agentName, normalized.turnId);
    return {
      updated: result.changes > 0,
      reason: result.changes > 0 ? null : 'missing-pending-post-turn',
      row,
    };
  }

  listRecentCompletedPostTurns(agentName, frontendSource, options = {}) {
    this._assertOpen();

    const safeAgentName = normalizeRequiredString(agentName, 'agentName');
    const safeFrontendSource = normalizeRequiredString(frontendSource, 'frontendSource');
    const limit = normalizeReadLimit(options.limit, this.maxRecords);
    return this.db.prepare(`
      SELECT
        turn_id AS turnId,
        agent_name AS agentName,
        frontend_source AS frontendSource,
        request_hash AS requestHash,
        request_block_count AS requestBlockCount,
        status,
        response_message_id AS responseMessageId,
        response_content_hash AS responseContentHash,
        created_at AS createdAt,
        updated_at AS updatedAt,
        completed_at AS completedAt,
        aborted_at AS abortedAt
      FROM post_turns
      WHERE agent_name = ?
        AND frontend_source = ?
        AND status = 'completed'
        AND response_message_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(safeAgentName, safeFrontendSource, limit);
  }

  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  _initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        sender_name TEXT NOT NULL,
        frontend_source TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        post_context_hash TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_onering_messages_agent_id
      ON messages (agent_name, id);

      CREATE TABLE IF NOT EXISTS post_turns (
        turn_id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        frontend_source TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        request_block_count INTEGER NOT NULL CHECK (request_block_count >= 0),
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'aborted')),
        response_message_id INTEGER,
        response_content_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        aborted_at TEXT,
        FOREIGN KEY (response_message_id) REFERENCES messages(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_onering_post_turns_agent_frontend_updated
      ON post_turns (agent_name, frontend_source, updated_at);

      CREATE INDEX IF NOT EXISTS idx_onering_post_turns_request_hash
      ON post_turns (agent_name, frontend_source, request_hash);

      CREATE INDEX IF NOT EXISTS idx_onering_post_turns_status_updated
      ON post_turns (status, updated_at);
    `);
  }

  _pruneAgent(agentName) {
    if (this.maxRecords <= 0) {
      return;
    }

    this.db.prepare(`
      DELETE FROM messages
      WHERE agent_name = ?
        AND id NOT IN (
          SELECT id FROM messages
          WHERE agent_name = ?
          ORDER BY id DESC
          LIMIT ?
        )
    `).run(agentName, agentName, this.maxRecords);
  }

  _assertOpen() {
    if (this.closed) {
      throw new Error('OneRingStore is closed');
    }
  }

  _enableForeignKeys() {
    this.db.pragma('foreign_keys = ON');
    const enabled = this.db.pragma('foreign_keys', { simple: true });
    if (enabled !== 1) {
      throw new Error('OneRingStore requires SQLite foreign key enforcement');
    }
  }

  _validateResponseMessageOwnership(metadata, responseMessageId) {
    const row = this.db.prepare(`
      SELECT
        agent_name AS agentName,
        frontend_source AS frontendSource,
        role
      FROM messages
      WHERE id = ?
      LIMIT 1
    `).get(responseMessageId);

    if (!row) {
      return { ok: false, reason: 'missing-response-message' };
    }

    if (row.agentName !== metadata.agentName || row.frontendSource !== metadata.frontendSource) {
      return { ok: false, reason: 'response-message-owner-mismatch' };
    }

    if (row.role !== 'assistant') {
      return { ok: false, reason: 'response-message-role-mismatch' };
    }

    return { ok: true, reason: null };
  }
}

function normalizeMessageRecord(record) {
  const source = record && typeof record === 'object' ? record : {};
  const role = normalizeRequiredString(source.role, 'role');

  if (!VALID_ROLES.has(role)) {
    throw new TypeError('Invalid OneRing message role');
  }

  return {
    agentName: normalizeRequiredString(source.agentName, 'agentName'),
    role,
    senderName: normalizeOptionalString(source.senderName, 'User'),
    frontendSource: normalizeOptionalString(source.frontendSource, 'unknown'),
    content: normalizeRequiredContent(source.content),
    timestamp: normalizeOptionalString(source.timestamp, ''),
    postContextHash: normalizeNullableString(source.postContextHash),
  };
}

function normalizeBaseDir(baseDir) {
  if (!baseDir || typeof baseDir !== 'string') {
    throw new TypeError('OneRingStore requires an explicit baseDir');
  }

  return path.resolve(baseDir);
}

function normalizeStoreFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new TypeError('Invalid OneRing store fileName');
  }

  if (path.isAbsolute(fileName) || fileName.includes('..') || /[\\/]/.test(fileName)) {
    throw new TypeError('OneRing store fileName must stay inside baseDir');
  }

  return fileName;
}

function ensurePathInsideBase(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new TypeError('OneRing store path escapes baseDir');
  }
}

function normalizeMaxRecords(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizeReadLimit(value, fallback) {
  const defaultLimit = fallback > 0 ? fallback : DEFAULT_MAX_RECORDS;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
}

function normalizeRequiredString(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new TypeError(`Missing OneRing message ${fieldName}`);
  }
  return text;
}

function normalizeRequiredContent(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Missing OneRing message content');
  }
  return value;
}

function normalizeOptionalString(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function normalizeNullableString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function normalizePostTurnMetadataOrThrow(metadata) {
  const result = normalizePostTurnMetadata(metadata);
  if (!result.ok) {
    throw new TypeError(`Invalid OneRing post-turn metadata: ${result.reason}`);
  }
  return result.metadata;
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  DEFAULT_STORE_FILE_NAME,
  DEFAULT_MAX_RECORDS,
  OneRingStore,
  normalizeMessageRecord,
};
