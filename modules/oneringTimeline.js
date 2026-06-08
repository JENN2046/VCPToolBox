'use strict';

const crypto = require('node:crypto');

const SHA256_PREFIX = 'sha256:';
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const TRAILING_WHITESPACE_PATTERN = /[\s\u00a0\u3000]+$/u;
const TRAILING_WHITESPACE_SUFFIXES = [
  ' ',
  '  ',
  '   ',
  '\t',
  '\u00a0',
  '\u3000',
  '\n',
  '\n\n',
  '\r\n',
  '\r\n\r\n',
  ' \n',
  ' \r\n',
  '\u00a0\n',
  '\u3000\n',
];

function rawSha256(text) {
  return crypto
    .createHash('sha256')
    .update(typeof text === 'string' ? text : '')
    .digest('hex');
}

function normalizeClientSentHash(hash) {
  if (typeof hash !== 'string') {
    return '';
  }

  const trimmed = hash.trim().toLowerCase();
  const normalized = trimmed.startsWith(SHA256_PREFIX)
    ? trimmed.slice(SHA256_PREFIX.length)
    : trimmed;

  return SHA256_HEX_PATTERN.test(normalized) ? normalized : '';
}

function findClientRawHashMatchVariant(text, sentHash) {
  const rawText = typeof text === 'string' ? text : '';
  const targetHash = normalizeClientSentHash(sentHash);
  if (!targetHash) {
    return null;
  }

  const trimEndWhitespaceText = rawText.replace(TRAILING_WHITESPACE_PATTERN, '');
  const variants = [
    { text: rawText, variant: 'raw' },
    { text: trimEndWhitespaceText, variant: 'trim-end-whitespace' },
    ...TRAILING_WHITESPACE_SUFFIXES.flatMap(suffix => ([
      { text: `${rawText}${suffix}`, variant: `append-trailing-ws-${JSON.stringify(suffix)}` },
      { text: `${trimEndWhitespaceText}${suffix}`, variant: `trim-end-then-append-trailing-ws-${JSON.stringify(suffix)}` },
    ])),
  ];

  for (const candidate of variants) {
    const hash = rawSha256(candidate.text);
    if (hash === targetHash) {
      return {
        hash,
        variant: candidate.variant,
        addedChars: candidate.text.length - rawText.length,
      };
    }
  }

  return null;
}

function getClientTimestampBindingsFromConfig(config = {}, formatTimestamp) {
  const extension = config && typeof config === 'object' ? config.vcpchatExtensions : null;
  const rawBindings = Array.isArray(extension?.messageTimestampBindings)
    ? extension.messageTimestampBindings
    : [];

  if (rawBindings.length === 0) {
    return {
      schemaVersion: null,
      messageMetadataMode: null,
      rawCount: 0,
      bindings: [],
    };
  }

  const bindings = rawBindings
    .map(binding => normalizeClientTimestampBinding(binding, formatTimestamp))
    .filter(Boolean);

  return {
    schemaVersion: extension?.schemaVersion ?? null,
    messageMetadataMode: extension?.messageMetadataMode || null,
    rawCount: rawBindings.length,
    bindings,
  };
}

function normalizeClientTimestampBinding(binding, formatTimestamp) {
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const role = binding.role === 'user' || binding.role === 'assistant'
    ? binding.role
    : null;
  const index = Number(binding.sentMessageIndex);
  const timestampMs = Number(binding.timestamp);
  const sentHash = normalizeClientSentHash(binding.sentMessageHash);

  if (
    !role
    || !Number.isInteger(index)
    || index < 0
    || !Number.isFinite(timestampMs)
    || timestampMs <= 0
    || !sentHash
  ) {
    return null;
  }

  const date = new Date(timestampMs);
  return {
    messageId: typeof binding.messageId === 'string' ? binding.messageId : null,
    role,
    index,
    timestampMs,
    timestamp: typeof formatTimestamp === 'function'
      ? formatTimestamp(date, true)
      : date.toISOString(),
    timestampIso: typeof binding.timestampIso === 'string' ? binding.timestampIso : null,
    source: typeof binding.source === 'string' ? binding.source : 'client',
    sentHash,
  };
}

function mergeTimestampBindings(...bindingMaps) {
  return bindingMaps.reduce((merged, bindingMap) => ({
    ...merged,
    ...(bindingMap || {}),
  }), {});
}

function bindClientTimestampBindingsToPostBlocks(
  postBlocks,
  bindingInfo,
  {
    agentName = '',
    frontendSource = '',
    source = 'client-verified-hash',
  } = {},
) {
  const stats = {
    boundTimestampsByIndex: {},
    verifiedBindings: [],
    missingIndex: 0,
    roleMismatch: 0,
    hashMismatch: 0,
  };
  const blocks = Array.isArray(postBlocks) ? postBlocks : [];
  const clientBindings = Array.isArray(bindingInfo?.bindings) ? bindingInfo.bindings : [];
  if (blocks.length === 0 || clientBindings.length === 0) {
    return stats;
  }

  const blockByIndex = new Map(blocks.map((block, arrayIndex) => [
    getPostBlockIndex(block, arrayIndex),
    block,
  ]));

  for (const binding of clientBindings) {
    const block = blockByIndex.get(binding.index);
    if (!block) {
      stats.missingIndex += 1;
      continue;
    }

    if (block.role !== binding.role) {
      stats.roleMismatch += 1;
      continue;
    }

    const blockText = getPostBlockText(block);
    const hashMatch = findClientRawHashMatchVariant(blockText, binding.sentHash);
    if (!hashMatch) {
      stats.hashMismatch += 1;
      continue;
    }

    const verified = {
      ...binding,
      agentName,
      frontendSource,
      text: blockText,
      hash: hashMatch.hash,
      hashVariant: hashMatch.variant,
      hashVariantAddedChars: hashMatch.addedChars,
    };

    stats.verifiedBindings.push(verified);
    stats.boundTimestampsByIndex[binding.index] = {
      timestamp: binding.timestamp,
      senderName: block.senderName || (block.role === 'assistant' ? agentName : '?'),
      frontendSource,
      source,
      messageId: binding.messageId || null,
      sentHash: binding.sentHash,
      hashVariant: hashMatch.variant,
    };
  }

  return stats;
}

function getPostBlockIndex(block, arrayIndex) {
  const explicitIndex = Number(block?.index);
  return Number.isInteger(explicitIndex) && explicitIndex >= 0
    ? explicitIndex
    : arrayIndex;
}

function getPostBlockText(block) {
  if (!block || typeof block !== 'object') {
    return '';
  }

  if (typeof block.text === 'string') {
    return block.text;
  }

  if (typeof block.content === 'string') {
    return block.content;
  }

  return '';
}

module.exports = {
  bindClientTimestampBindingsToPostBlocks,
  findClientRawHashMatchVariant,
  getClientTimestampBindingsFromConfig,
  mergeTimestampBindings,
  normalizeClientSentHash,
  rawSha256,
};
