'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  bindClientTimestampBindingsToPostBlocks,
  findClientRawHashMatchVariant,
  getClientTimestampBindingsFromConfig,
  mergeTimestampBindings,
  normalizeClientSentHash,
  rawSha256,
} = require('../modules/oneringTimeline');

test('normalizeClientSentHash accepts plain and prefixed sha256 values only', () => {
  const hash = rawSha256('hello');

  assert.equal(normalizeClientSentHash(hash.toUpperCase()), hash);
  assert.equal(normalizeClientSentHash(` sha256:${hash.toUpperCase()} `), hash);
  assert.equal(normalizeClientSentHash('sha256:not-a-hash'), '');
  assert.equal(normalizeClientSentHash('DeleteFile'), '');
  assert.equal(normalizeClientSentHash(null), '');
});

test('findClientRawHashMatchVariant keeps raw hash authoritative with tail whitespace tolerance', () => {
  const rawHash = rawSha256('hello');
  const trimEndHash = rawSha256('hello');
  const appendHash = rawSha256('hello\n');

  assert.deepEqual(findClientRawHashMatchVariant('hello', rawHash), {
    hash: rawHash,
    variant: 'raw',
    addedChars: 0,
  });
  assert.deepEqual(findClientRawHashMatchVariant('hello   ', trimEndHash), {
    hash: trimEndHash,
    variant: 'trim-end-whitespace',
    addedChars: -3,
  });

  const appendMatch = findClientRawHashMatchVariant('hello', appendHash);
  assert.equal(appendMatch.hash, appendHash);
  assert.equal(appendMatch.variant, 'append-trailing-ws-"\\n"');
  assert.equal(appendMatch.addedChars, 1);

  assert.equal(findClientRawHashMatchVariant('hello world', rawSha256('helloworld')), null);
});

test('getClientTimestampBindingsFromConfig validates client timestamp binding schema', () => {
  const userHash = rawSha256('hello user');
  const assistantHash = rawSha256('hello assistant');
  const bindingInfo = getClientTimestampBindingsFromConfig({
    vcpchatExtensions: {
      schemaVersion: 2,
      messageMetadataMode: 'raw-message-hash',
      messageTimestampBindings: [
        {
          messageId: 'u1',
          role: 'user',
          sentMessageIndex: 0,
          timestamp: 1770000000000,
          timestampIso: '2026-02-02T00:00:00.000Z',
          sentMessageHash: `sha256:${userHash}`,
          source: 'client',
        },
        {
          role: 'assistant',
          sentMessageIndex: '1',
          timestamp: '1770000001000',
          sentMessageHash: assistantHash,
        },
        {
          role: 'system',
          sentMessageIndex: 2,
          timestamp: 1770000002000,
          sentMessageHash: rawSha256('system'),
        },
        {
          role: 'user',
          sentMessageIndex: 3,
          timestamp: 0,
          sentMessageHash: rawSha256('bad timestamp'),
        },
      ],
    },
  }, date => `formatted:${date.toISOString()}`);

  assert.equal(bindingInfo.schemaVersion, 2);
  assert.equal(bindingInfo.messageMetadataMode, 'raw-message-hash');
  assert.equal(bindingInfo.rawCount, 4);
  assert.deepEqual(bindingInfo.bindings, [
    {
      messageId: 'u1',
      role: 'user',
      index: 0,
      timestampMs: 1770000000000,
      timestamp: 'formatted:2026-02-02T02:40:00.000Z',
      timestampIso: '2026-02-02T00:00:00.000Z',
      source: 'client',
      sentHash: userHash,
    },
    {
      messageId: null,
      role: 'assistant',
      index: 1,
      timestampMs: 1770000001000,
      timestamp: 'formatted:2026-02-02T02:40:01.000Z',
      timestampIso: null,
      source: 'client',
      sentHash: assistantHash,
    },
  ]);
});

test('bindClientTimestampBindingsToPostBlocks verifies post-block hashes before binding timestamps', () => {
  const userHash = rawSha256('hello user');
  const assistantHash = rawSha256('assistant reply\n');
  const mismatchHash = rawSha256('different');
  const bindingInfo = {
    bindings: [
      {
        messageId: 'u1',
        role: 'user',
        index: 0,
        timestamp: '2026-02-02T16:00:00.000Z',
        sentHash: userHash,
      },
      {
        messageId: 'a1',
        role: 'assistant',
        index: 1,
        timestamp: '2026-02-02T16:00:01.000Z',
        sentHash: assistantHash,
      },
      {
        role: 'user',
        index: 2,
        timestamp: '2026-02-02T16:00:02.000Z',
        sentHash: rawSha256('missing'),
      },
      {
        role: 'assistant',
        index: 3,
        timestamp: '2026-02-02T16:00:03.000Z',
        sentHash: rawSha256('role mismatch'),
      },
      {
        role: 'user',
        index: 4,
        timestamp: '2026-02-02T16:00:04.000Z',
        sentHash: mismatchHash,
      },
    ],
  };

  const result = bindClientTimestampBindingsToPostBlocks(
    [
      { index: 0, role: 'user', senderName: 'Ryan', text: 'hello user' },
      { index: 1, role: 'assistant', text: 'assistant reply' },
      { index: 3, role: 'user', text: 'role mismatch' },
      { index: 4, role: 'user', text: 'actual' },
    ],
    bindingInfo,
    {
      agentName: 'Agnes',
      frontendSource: 'VChat',
      source: 'client-verified-raw-hash',
    },
  );

  assert.equal(result.verifiedBindings.length, 2);
  assert.equal(result.missingIndex, 1);
  assert.equal(result.roleMismatch, 1);
  assert.equal(result.hashMismatch, 1);
  assert.deepEqual(result.boundTimestampsByIndex[0], {
    timestamp: '2026-02-02T16:00:00.000Z',
    senderName: 'Ryan',
    frontendSource: 'VChat',
    source: 'client-verified-raw-hash',
    messageId: 'u1',
    sentHash: userHash,
    hashVariant: 'raw',
  });
  assert.deepEqual(result.boundTimestampsByIndex[1], {
    timestamp: '2026-02-02T16:00:01.000Z',
    senderName: 'Agnes',
    frontendSource: 'VChat',
    source: 'client-verified-raw-hash',
    messageId: 'a1',
    sentHash: assistantHash,
    hashVariant: 'append-trailing-ws-"\\n"',
  });
});

test('bindClientTimestampBindingsToPostBlocks falls back to array positions for plain message blocks', () => {
  const userHash = rawSha256('plain user message');
  const assistantHash = rawSha256('plain assistant message');
  const result = bindClientTimestampBindingsToPostBlocks(
    [
      { role: 'user', senderName: 'Ryan', content: 'plain user message' },
      { role: 'assistant', content: 'plain assistant message' },
    ],
    {
      bindings: [
        {
          messageId: 'u1',
          role: 'user',
          index: 0,
          timestamp: '2026-02-02T16:00:00.000Z',
          sentHash: userHash,
        },
        {
          messageId: 'a1',
          role: 'assistant',
          index: 1,
          timestamp: '2026-02-02T16:00:01.000Z',
          sentHash: assistantHash,
        },
      ],
    },
    {
      agentName: 'Agnes',
      frontendSource: 'VChat',
    },
  );

  assert.equal(result.missingIndex, 0);
  assert.equal(result.hashMismatch, 0);
  assert.equal(result.verifiedBindings.length, 2);
  assert.deepEqual(Object.keys(result.boundTimestampsByIndex), ['0', '1']);
  assert.equal(result.boundTimestampsByIndex[0].senderName, 'Ryan');
  assert.equal(result.boundTimestampsByIndex[1].senderName, 'Agnes');
});

test('mergeTimestampBindings keeps later binding maps authoritative', () => {
  assert.deepEqual(
    mergeTimestampBindings(
      { 0: { timestamp: 'older' } },
      null,
      { 0: { timestamp: 'newer' }, 1: { timestamp: 'next' } },
    ),
    {
      0: { timestamp: 'newer' },
      1: { timestamp: 'next' },
    },
  );
});
