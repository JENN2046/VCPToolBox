'use strict';

const crypto = require('node:crypto');

const { getVisibleMessageText } = require('./oneringParser');

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
const LEADING_SYSTEM_NOTICE_PATTERN = /^\s*\[系统通知\][\s\S]*?\[系统通知结束\]\s*/;
const DEFAULT_SERVER_INFERRED_DISCARD_PATTERNS = Object.freeze([
  /^\s*\[系统提示/,
  /^\s*\[系统警告/,
  /^\s*\[系统指示/,
  /by\[Vchat群聊\]/,
  /现在轮到你.{0,30}发言/,
  /邀请.{1,20}发言/,
]);

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
  const index = normalizeSentMessageIndex(binding.sentMessageIndex);
  const timestampMs = normalizeTimestampMs(binding.timestamp);
  const sentHash = normalizeClientSentHash(binding.sentMessageHash);

  if (
    !role
    || index === null
    || timestampMs === null
    || !sentHash
  ) {
    return null;
  }

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

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

function normalizeSentMessageIndex(index) {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0
    ? index
    : null;
}

function normalizeTimestampMs(timestamp) {
  return typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0
    ? timestamp
    : null;
}

function mergeTimestampBindings(...bindingMaps) {
  return bindingMaps.reduce((merged, bindingMap) => ({
    ...merged,
    ...(bindingMap || {}),
  }), {});
}

function buildServerInferredWorkingView(messages, options = {}) {
  if (!Array.isArray(messages)) {
    return null;
  }

  const sanitizeUserContent = typeof options.sanitizeUserContent === 'function'
    ? options.sanitizeUserContent
    : sanitizeUserContentAtTimelineEntry;
  const hasUserTextContent = typeof options.hasUserTextContent === 'function'
    ? options.hasUserTextContent
    : defaultHasUserTextContent;
  const discardPatterns = Array.isArray(options.discardPatterns)
    ? options.discardPatterns
    : DEFAULT_SERVER_INFERRED_DISCARD_PATTERNS;
  const workingMessages = [];
  const workingToOriginalIndex = [];
  const originalToWorkingIndex = new Map();
  const originalRecords = new Map();
  const removedItems = [];
  const stats = {
    removedSystemUser: 0,
    removedEmptyUser: 0,
    strippedUserContent: 0,
  };

  messages.forEach((message, originalIndex) => {
    const originalKey = String(originalIndex);
    if (!message || message.role !== 'user') {
      const workingMessage = cloneMessageForWorkingView(message);
      markOneRingOriginalIndex(workingMessage, originalIndex);
      markOneRingWorkingKey(workingMessage, originalKey);
      originalToWorkingIndex.set(originalIndex, workingMessages.length);
      workingToOriginalIndex.push(originalIndex);
      originalRecords.set(originalKey, {
        originalIndex,
        workingIndex: workingMessages.length,
        role: message?.role || null,
        sanitized: false,
        removed: false,
        reason: null,
      });
      workingMessages.push(workingMessage);
      return;
    }

    const originalText = getVisibleMessageText(message.content);
    const sanitizedContent = sanitizeUserContent(message.content);
    const sanitizedText = getVisibleMessageText(sanitizedContent);
    const shouldDropSystemUser = discardPatterns.some(pattern => pattern.test(sanitizedText));

    if (shouldDropSystemUser) {
      stats.removedSystemUser += 1;
      removedItems.push({ originalIndex, originalKey, message, reason: 'system-user' });
      originalRecords.set(originalKey, {
        originalIndex,
        workingIndex: null,
        role: 'user',
        sanitized: originalText !== sanitizedText,
        removed: true,
        reason: 'system-user',
      });
      return;
    }

    if (!hasUserTextContent(sanitizedContent)) {
      stats.removedEmptyUser += 1;
      removedItems.push({ originalIndex, originalKey, message, reason: 'empty-user' });
      originalRecords.set(originalKey, {
        originalIndex,
        workingIndex: null,
        role: 'user',
        sanitized: originalText !== sanitizedText,
        removed: true,
        reason: 'empty-user',
      });
      return;
    }

    if (originalText !== sanitizedText) {
      stats.strippedUserContent += 1;
    }

    const workingMessage = markOneRingWorkingKey(
      markOneRingOriginalIndex({ ...message, content: sanitizedContent }, originalIndex),
      originalKey,
    );
    originalToWorkingIndex.set(originalIndex, workingMessages.length);
    workingToOriginalIndex.push(originalIndex);
    originalRecords.set(originalKey, {
      originalIndex,
      workingIndex: workingMessages.length,
      role: 'user',
      sanitized: originalText !== sanitizedText,
      removed: false,
      reason: originalText !== sanitizedText ? 'sanitized-user' : null,
    });
    workingMessages.push(workingMessage);
  });

  copyArrayOneRingMeta(messages, workingMessages);

  return {
    originalMessages: messages,
    workingMessages,
    workingToOriginalIndex,
    originalToWorkingIndex,
    originalRecords,
    removedItems,
    stats,
  };
}

function restoreServerInferredWorkingView(originalMessages, processedMessages, workingView, options = {}) {
  if (!workingView || !Array.isArray(originalMessages) || !Array.isArray(processedMessages)) {
    return processedMessages;
  }

  const isInjected = typeof options.isInjected === 'function'
    ? options.isInjected
    : isOneRingInjectedFromDb;
  const mergeProcessedMessage = typeof options.mergeProcessedMessage === 'function'
    ? options.mergeProcessedMessage
    : defaultMergeProcessedMessageOntoOriginal;
  const restored = [...originalMessages];
  const injectedBeforeOriginalIndex = new Map();
  const injectedAfterOriginalIndex = new Map();
  const injectedAtEnd = [];
  let pendingInjected = [];

  const pushInjectedAfter = (originalIndex, injectedMessages) => {
    if (!Array.isArray(injectedMessages) || injectedMessages.length === 0 || !Number.isInteger(originalIndex)) {
      return false;
    }
    if (originalIndex < 0 || originalIndex >= originalMessages.length) {
      return false;
    }
    if (!injectedAfterOriginalIndex.has(originalIndex)) {
      injectedAfterOriginalIndex.set(originalIndex, []);
    }
    injectedAfterOriginalIndex.get(originalIndex).push(...injectedMessages);
    return true;
  };

  const getOriginalIndexFromWorkingKey = (workingKey) => {
    if (!workingKey || !/^\d+$/.test(workingKey)) {
      return -1;
    }
    const record = workingView.originalRecords?.get?.(workingKey);
    if (Number.isInteger(record?.originalIndex)) {
      return record.originalIndex;
    }
    const parsed = Number.parseInt(workingKey, 10);
    return Number.isInteger(parsed) ? parsed : -1;
  };

  const getInjectedAnchorOriginalIndex = (message) => {
    const workingKey = getOneRingWorkingKey(message);
    if (!workingKey || (!workingKey.startsWith('z') && !workingKey.startsWith('o'))) {
      return -1;
    }
    return getOriginalIndexFromWorkingKey(workingKey.slice(1));
  };

  const queueInjected = (message) => {
    const anchorOriginalIndex = getInjectedAnchorOriginalIndex(message);
    if (pushInjectedAfter(anchorOriginalIndex, [message])) {
      return;
    }
    pendingInjected.push(message);
  };

  const flushPendingBefore = (originalIndex) => {
    if (pendingInjected.length === 0 || !Number.isInteger(originalIndex)) {
      return;
    }
    if (!injectedBeforeOriginalIndex.has(originalIndex)) {
      injectedBeforeOriginalIndex.set(originalIndex, []);
    }
    injectedBeforeOriginalIndex.get(originalIndex).push(...pendingInjected);
    pendingInjected = [];
  };

  let processedWorkingIndex = 0;
  for (const message of processedMessages) {
    if (!message) {
      continue;
    }

    const workingKey = getOneRingWorkingKey(message);

    if (isInjected(message) || (workingKey && (workingKey.startsWith('z') || workingKey.startsWith('o')))) {
      queueInjected(message);
      continue;
    }

    let originalIndex = getOneRingOriginalIndex(message);
    if ((!Number.isInteger(originalIndex) || originalIndex < 0) && workingKey) {
      originalIndex = getOriginalIndexFromWorkingKey(workingKey);
    }
    if (!Number.isInteger(originalIndex) || originalIndex < 0) {
      originalIndex = workingView.workingToOriginalIndex?.[processedWorkingIndex];
    }
    processedWorkingIndex += 1;

    if (!Number.isInteger(originalIndex) || originalIndex < 0 || originalIndex >= originalMessages.length) {
      continue;
    }

    flushPendingBefore(originalIndex);
    restored[originalIndex] = mergeProcessedMessage(originalMessages[originalIndex], message);
  }

  if (pendingInjected.length > 0) {
    injectedAtEnd.push(...pendingInjected);
  }

  const result = [];
  for (let index = 0; index < restored.length; index += 1) {
    result.push(...(injectedBeforeOriginalIndex.get(index) || []));
    result.push(restored[index]);
    result.push(...(injectedAfterOriginalIndex.get(index) || []));
  }
  result.push(...injectedAtEnd);
  copyArrayOneRingMetaFromSources(
    [processedMessages, workingView.workingMessages, originalMessages],
    result,
  );

  try {
    Object.defineProperty(result, '__oneRingInjectedCount', {
      value: result.filter(message => isInjected(message)).length,
      enumerable: false,
      configurable: true,
    });
  } catch {
    // Metadata is best-effort and should not make timeline restore fail.
  }

  return result;
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
    duplicateIndex: 0,
    duplicateMessageId: 0,
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
  const usedIndexes = new Set();
  const usedMessageIds = new Set();

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

    if (usedIndexes.has(binding.index)) {
      stats.duplicateIndex += 1;
      continue;
    }

    if (binding.messageId && usedMessageIds.has(binding.messageId)) {
      stats.duplicateMessageId += 1;
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
    usedIndexes.add(binding.index);
    if (binding.messageId) {
      usedMessageIds.add(binding.messageId);
    }
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

  if (Object.hasOwn(block, 'content')) {
    return getVisibleMessageText(block.content);
  }

  return getVisibleMessageText(block);
}

function sanitizeUserContentAtTimelineEntry(content) {
  if (typeof content === 'string') {
    return stripLeadingSystemNoticeText(content);
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => sanitizeUserContentPart(part))
      .filter((part) => !isEmptyTextPart(part));
  }

  if (content && typeof content === 'object') {
    return sanitizeUserContentPart(content);
  }

  return content;
}

function sanitizeUserContentPart(part) {
  if (!part || typeof part !== 'object') {
    return part;
  }

  if (typeof part.text === 'string') {
    return { ...part, text: stripLeadingSystemNoticeText(part.text) };
  }

  if (part.type === 'text' && typeof part.value === 'string') {
    return { ...part, value: stripLeadingSystemNoticeText(part.value) };
  }

  return part;
}

function isEmptyTextPart(part) {
  return Boolean(
    part
    && typeof part === 'object'
    && part.type === 'text'
    && (
      (typeof part.text === 'string' && !part.text.trim())
      || (typeof part.value === 'string' && !part.value.trim())
    ),
  );
}

function stripLeadingSystemNoticeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  let result = text;
  let stripped = false;
  while (LEADING_SYSTEM_NOTICE_PATTERN.test(result)) {
    result = result.replace(LEADING_SYSTEM_NOTICE_PATTERN, '');
    stripped = true;
  }
  return stripped ? result.trimStart() : text;
}

function defaultHasUserTextContent(content) {
  return Boolean(getVisibleMessageText(content).trim()) || hasNonTextContentPart(content);
}

function hasNonTextContentPart(content) {
  if (Array.isArray(content)) {
    return content.some((part) => hasNonTextContentPart(part));
  }

  if (!content || typeof content !== 'object') {
    return false;
  }

  if (typeof content.text === 'string' || (content.type === 'text' && typeof content.value === 'string')) {
    return false;
  }

  if (content.type === 'text') {
    return false;
  }

  if (typeof content.type === 'string') {
    return true;
  }

  if (Object.hasOwn(content, 'content')) {
    return hasNonTextContentPart(content.content);
  }

  return Object.keys(content).length > 0;
}

function cloneMessageForWorkingView(message) {
  return message && typeof message === 'object'
    ? { ...message }
    : message;
}

function markOneRingOriginalIndex(message, originalIndex) {
  if (!message || typeof message !== 'object' || !Number.isInteger(originalIndex)) {
    return message;
  }
  return defineHiddenOneRingProperty(message, '__oneRingOriginalIndex', originalIndex);
}

function getOneRingOriginalIndex(message) {
  return Number.isInteger(message?.__oneRingOriginalIndex)
    ? message.__oneRingOriginalIndex
    : -1;
}

function markOneRingWorkingKey(message, workingKey) {
  if (!message || typeof message !== 'object' || typeof workingKey !== 'string') {
    return message;
  }
  return defineHiddenOneRingProperty(message, '__oneRingWorkingKey', workingKey);
}

function getOneRingWorkingKey(message) {
  return typeof message?.__oneRingWorkingKey === 'string'
    ? message.__oneRingWorkingKey
    : null;
}

function markOneRingInjectedFromDb(message) {
  if (!message || typeof message !== 'object') {
    return message;
  }
  return defineHiddenOneRingProperty(message, '__oneRingInjectedFromDb', true);
}

function isOneRingInjectedFromDb(message) {
  return Boolean(message && message.__oneRingInjectedFromDb === true);
}

function copyOneRingMessageMetadata(source, target) {
  for (const key of [
    '__oneRingOriginalIndex',
    '__oneRingWorkingKey',
    '__oneRingInjectedFromDb',
    '__oneRingTimelineMeta',
  ]) {
    if (source && Object.hasOwn(source, key)) {
      defineHiddenOneRingProperty(target, key, source[key]);
    }
  }
  return target;
}

function cloneMessageWithOneRingMetadata(message, overrides = {}) {
  if (!message || typeof message !== 'object') {
    return message;
  }
  return copyOneRingMessageMetadata(message, { ...message, ...overrides });
}

function defineHiddenOneRingProperty(target, key, value) {
  try {
    Object.defineProperty(target, key, {
      value,
      enumerable: false,
      configurable: true,
    });
  } catch {
    // Keep helpers side-effect-safe for frozen objects.
  }
  return target;
}

function copyArrayOneRingMeta(source, target) {
  const descriptor = source && Object.getOwnPropertyDescriptor(source, '__oneRingMeta');
  if (descriptor) {
    try {
      Object.defineProperty(target, '__oneRingMeta', descriptor);
    } catch {
      // Keep helpers side-effect-safe for frozen objects.
    }
  }
  return target;
}

function copyArrayOneRingMetaFromSources(sources, target) {
  for (const source of sources) {
    if (source && Object.getOwnPropertyDescriptor(source, '__oneRingMeta')) {
      return copyArrayOneRingMeta(source, target);
    }
  }
  return target;
}

function defaultMergeProcessedMessageOntoOriginal(originalMessage, processedMessage) {
  if (originalMessage?.role === 'user') {
    return originalMessage;
  }
  return processedMessage;
}

module.exports = {
  DEFAULT_SERVER_INFERRED_DISCARD_PATTERNS,
  bindClientTimestampBindingsToPostBlocks,
  buildServerInferredWorkingView,
  cloneMessageWithOneRingMetadata,
  findClientRawHashMatchVariant,
  getClientTimestampBindingsFromConfig,
  getOneRingOriginalIndex,
  getOneRingWorkingKey,
  isOneRingInjectedFromDb,
  markOneRingInjectedFromDb,
  markOneRingOriginalIndex,
  markOneRingWorkingKey,
  mergeTimestampBindings,
  normalizeClientSentHash,
  rawSha256,
  restoreServerInferredWorkingView,
  sanitizeUserContentAtTimelineEntry,
};
