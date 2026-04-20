'use strict';

const fs = require('fs');

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeJsonParse(raw, fallback = null) {
  if (typeof raw !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function toJsonIfPossible(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, value: raw, error: 'non-string' };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, value: null, error: 'empty-output' };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed), error: null };
  } catch (_) {
    // Try newline-delimited fallback: parse last valid JSON line.
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
      const line = lines[idx];
      try {
        return { ok: true, value: JSON.parse(line), error: null };
      } catch (_lineError) {
        // continue
      }
    }
  }

  return { ok: false, value: trimmed, error: 'invalid-json' };
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

function compareSemver(a, b) {
  const left = String(a || '0.0.0').split('.').map((x) => Number.parseInt(x, 10) || 0);
  const right = String(b || '0.0.0').split('.').map((x) => Number.parseInt(x, 10) || 0);

  const maxLength = Math.max(left.length, right.length);
  for (let i = 0; i < maxLength; i += 1) {
    const lv = left[i] || 0;
    const rv = right[i] || 0;
    if (lv > rv) return 1;
    if (lv < rv) return -1;
  }
  return 0;
}

function pickVersion(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function summarizeArgs(args, maxLen = 240) {
  let raw = '';
  try {
    raw = JSON.stringify(args || {});
  } catch (_) {
    raw = '[unserializable-args]';
  }

  if (raw.length <= maxLen) {
    return raw;
  }

  return `${raw.slice(0, maxLen)}...`;
}

function deepGet(obj, dottedPath) {
  if (!dottedPath) {
    return obj;
  }

  const parts = dottedPath.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) {
      return undefined;
    }
    cur = cur[part];
  }

  return cur;
}

module.exports = {
  ensureDirSync,
  safeJsonParse,
  toJsonIfPossible,
  nowIso,
  randomId,
  compareSemver,
  pickVersion,
  summarizeArgs,
  deepGet
};