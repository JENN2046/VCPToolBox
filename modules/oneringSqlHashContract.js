'use strict';

const crypto = require('crypto');

const { extractComparableText } = require('./oneringFuzzy');

function buildOneRingContentHash(messageOrContent) {
  return sha256Hex(extractComparableText(messageOrContent));
}

function buildOneRingRequestHash(postBlocks) {
  const normalizedBlocks = normalizeRequestBlocks(postBlocks);
  return sha256Hex(stableStringify(normalizedBlocks));
}

function normalizeRequestBlocks(postBlocks) {
  if (!Array.isArray(postBlocks)) {
    return [];
  }

  return postBlocks
    .filter((block) => block && typeof block === 'object')
    .map((block) => ({
      role: typeof block.role === 'string' ? block.role : '',
      senderName: normalizeNullableString(block.senderName),
      frontendSource: normalizeNullableString(block.frontendSource),
      text: extractComparableText(getBlockTextCandidate(block)),
    }));
}

function storeRowsToDiffBlocks(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      id: row.id,
      role: typeof row.role === 'string' ? row.role : '',
      content: typeof row.content === 'string' ? row.content : '',
    }));
}

function getBlockTextCandidate(block) {
  if (Object.prototype.hasOwnProperty.call(block, 'text')) {
    return block.text;
  }

  if (Object.prototype.hasOwnProperty.call(block, 'content')) {
    return block.content;
  }

  return block;
}

function normalizeNullableString(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function sha256Hex(value) {
  return crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : '', 'utf8')
    .digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

module.exports = {
  buildOneRingContentHash,
  buildOneRingRequestHash,
  normalizeRequestBlocks,
  storeRowsToDiffBlocks,
};
