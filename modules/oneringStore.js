'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

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

module.exports = {
  DEFAULT_STORE_FILE_NAME,
  DEFAULT_MAX_RECORDS,
  OneRingStore,
  normalizeMessageRecord,
};
