'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildServerInferredWorkingView,
  bindClientTimestampBindingsToPostBlocks,
  findClientRawHashMatchVariant,
  getOneRingOriginalIndex,
  getOneRingWorkingKey,
  isOneRingInjectedFromDb,
  markOneRingInjectedFromDb,
  markOneRingWorkingKey,
  restoreServerInferredWorkingView,
  sanitizeUserContentAtTimelineEntry,
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
          sentMessageIndex: 1,
          timestamp: 1770000001000,
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
        {
          role: 'user',
          sentMessageIndex: 4,
          timestamp: 100000000000000000000,
          sentMessageHash: rawSha256('out of range timestamp'),
        },
        {
          role: 'user',
          sentMessageIndex: '',
          timestamp: 1770000003000,
          sentMessageHash: rawSha256('coerced empty index'),
        },
        {
          role: 'user',
          sentMessageIndex: true,
          timestamp: 1770000004000,
          sentMessageHash: rawSha256('coerced boolean index'),
        },
        {
          role: 'user',
          sentMessageIndex: [1],
          timestamp: 1770000005000,
          sentMessageHash: rawSha256('coerced array index'),
        },
        {
          role: 'user',
          sentMessageIndex: 5,
          timestamp: '1770000006000',
          sentMessageHash: rawSha256('coerced string timestamp'),
        },
      ],
    },
  }, date => `formatted:${date.toISOString()}`);

  assert.equal(bindingInfo.schemaVersion, 2);
  assert.equal(bindingInfo.messageMetadataMode, 'raw-message-hash');
  assert.equal(bindingInfo.rawCount, 9);
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

test('getClientTimestampBindingsFromConfig drops out-of-range timestamps without throwing', () => {
  assert.doesNotThrow(() => {
    const bindingInfo = getClientTimestampBindingsFromConfig({
      vcpchatExtensions: {
        messageTimestampBindings: [
          {
            role: 'user',
            sentMessageIndex: 0,
            timestamp: 100000000000000000000,
            sentMessageHash: rawSha256('bad'),
          },
        ],
      },
    });

    assert.deepEqual(bindingInfo.bindings, []);
    assert.equal(bindingInfo.rawCount, 1);
  });
});

test('getClientTimestampBindingsFromConfig rejects coerced index and timestamp schema values', () => {
  const bindingInfo = getClientTimestampBindingsFromConfig({
    vcpchatExtensions: {
      messageTimestampBindings: [
        {
          role: 'user',
          sentMessageIndex: '',
          timestamp: 1770000000000,
          sentMessageHash: rawSha256('empty index'),
        },
        {
          role: 'user',
          sentMessageIndex: '  ',
          timestamp: 1770000000000,
          sentMessageHash: rawSha256('whitespace index'),
        },
        {
          role: 'user',
          sentMessageIndex: true,
          timestamp: 1770000000000,
          sentMessageHash: rawSha256('boolean index'),
        },
        {
          role: 'user',
          sentMessageIndex: [1],
          timestamp: 1770000000000,
          sentMessageHash: rawSha256('array index'),
        },
        {
          role: 'user',
          sentMessageIndex: 0,
          timestamp: '1770000000000',
          sentMessageHash: rawSha256('string timestamp'),
        },
      ],
    },
  });

  assert.equal(bindingInfo.rawCount, 5);
  assert.deepEqual(bindingInfo.bindings, []);
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

test('bindClientTimestampBindingsToPostBlocks preserves visible text for multipart content blocks', () => {
  const visibleText = 'first visible line\nsecond visible line';
  const emptyHash = rawSha256('');
  const result = bindClientTimestampBindingsToPostBlocks(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first visible line' },
          { type: 'text', value: 'second visible line' },
          { type: 'image_url', image_url: { url: 'https://example.invalid/image.png' } },
        ],
      },
    ],
    {
      bindings: [
        {
          messageId: 'bad-empty',
          role: 'user',
          index: 0,
          timestamp: '2026-02-02T15:59:59.000Z',
          sentHash: emptyHash,
        },
        {
          messageId: 'good-visible',
          role: 'user',
          index: 0,
          timestamp: '2026-02-02T16:00:00.000Z',
          sentHash: rawSha256(visibleText),
        },
      ],
    },
    {
      agentName: 'Agnes',
      frontendSource: 'VChat',
    },
  );

  assert.equal(result.hashMismatch, 1);
  assert.equal(result.verifiedBindings.length, 1);
  assert.equal(result.verifiedBindings[0].messageId, 'good-visible');
  assert.equal(result.verifiedBindings[0].text, visibleText);
  assert.deepEqual(result.boundTimestampsByIndex[0], {
    timestamp: '2026-02-02T16:00:00.000Z',
    senderName: '?',
    frontendSource: 'VChat',
    source: 'client-verified-hash',
    messageId: 'good-visible',
    sentHash: rawSha256(visibleText),
    hashVariant: 'raw',
  });
});

test('bindClientTimestampBindingsToPostBlocks rejects duplicate verified index and message IDs', () => {
  const firstHash = rawSha256('first block');
  const secondHash = rawSha256('second block');
  const result = bindClientTimestampBindingsToPostBlocks(
    [
      { role: 'user', content: 'first block' },
      { role: 'assistant', content: 'second block' },
    ],
    {
      bindings: [
        {
          messageId: 'same-message',
          role: 'user',
          index: 0,
          timestamp: '2026-02-02T16:00:00.000Z',
          sentHash: firstHash,
        },
        {
          messageId: 'same-index-later',
          role: 'user',
          index: 0,
          timestamp: '2026-02-02T16:00:01.000Z',
          sentHash: firstHash,
        },
        {
          messageId: 'same-message',
          role: 'assistant',
          index: 1,
          timestamp: '2026-02-02T16:00:02.000Z',
          sentHash: secondHash,
        },
      ],
    },
    {
      agentName: 'Agnes',
      frontendSource: 'VChat',
    },
  );

  assert.equal(result.duplicateIndex, 1);
  assert.equal(result.duplicateMessageId, 1);
  assert.equal(result.verifiedBindings.length, 1);
  assert.equal(result.verifiedBindings[0].messageId, 'same-message');
  assert.deepEqual(Object.keys(result.boundTimestampsByIndex), ['0']);
  assert.deepEqual(result.boundTimestampsByIndex[0], {
    timestamp: '2026-02-02T16:00:00.000Z',
    senderName: '?',
    frontendSource: 'VChat',
    source: 'client-verified-hash',
    messageId: 'same-message',
    sentHash: firstHash,
    hashVariant: 'raw',
  });
});

test('sanitizeUserContentAtTimelineEntry strips leading system notices from string and multipart text', () => {
  assert.equal(
    sanitizeUserContentAtTimelineEntry('[系统通知]internal\n[系统通知结束]\nvisible'),
    'visible',
  );
  assert.deepEqual(
    sanitizeUserContentAtTimelineEntry([
      { type: 'text', text: '[系统通知]internal\n[系统通知结束]\nvisible text' },
      { type: 'text', value: '[系统通知]internal\n[系统通知结束]\nvisible value' },
      { type: 'image_url', image_url: { url: 'https://example.invalid/image.png' } },
    ]),
    [
      { type: 'text', text: 'visible text' },
      { type: 'text', value: 'visible value' },
      { type: 'image_url', image_url: { url: 'https://example.invalid/image.png' } },
    ],
  );
});

test('sanitizeUserContentAtTimelineEntry preserves whitespace when no leading system notice exists', () => {
  const whitespaceSensitive = '  keep indentation\nand trailing lines\n\n';

  assert.equal(
    sanitizeUserContentAtTimelineEntry(whitespaceSensitive),
    whitespaceSensitive,
  );
  assert.deepEqual(
    sanitizeUserContentAtTimelineEntry([
      { type: 'text', text: whitespaceSensitive },
      { type: 'text', value: '\tvalue indentation\n' },
    ]),
    [
      { type: 'text', text: whitespaceSensitive },
      { type: 'text', value: '\tvalue indentation\n' },
    ],
  );
});

test('buildServerInferredWorkingView creates reversible sanitized view without enumerable metadata', () => {
  const messages = [
    { role: 'system', content: 'top system' },
    { role: 'user', content: '[系统通知]hidden\n[系统通知结束]\nvisible user' },
    { role: 'user', content: '[系统提示]pseudo system' },
    { role: 'user', content: '   ' },
    { role: 'assistant', content: 'assistant reply' },
  ];
  const view = buildServerInferredWorkingView(messages);

  assert.equal(view.workingMessages.length, 3);
  assert.deepEqual(view.workingToOriginalIndex, [0, 1, 4]);
  assert.equal(view.originalToWorkingIndex.get(1), 1);
  assert.equal(view.originalRecords.get('1').reason, 'sanitized-user');
  assert.equal(view.originalRecords.get('2').reason, 'system-user');
  assert.equal(view.originalRecords.get('3').reason, 'empty-user');
  assert.deepEqual(view.stats, {
    removedSystemUser: 1,
    removedEmptyUser: 1,
    strippedUserContent: 1,
  });
  assert.equal(view.workingMessages[1].content, 'visible user');
  assert.equal(getOneRingOriginalIndex(view.workingMessages[1]), 1);
  assert.equal(getOneRingWorkingKey(view.workingMessages[1]), '1');
  assert.equal(Object.keys(view.workingMessages[1]).includes('__oneRingOriginalIndex'), false);
  assert.equal(Object.keys(view.workingMessages[1]).includes('__oneRingWorkingKey'), false);
});

test('restoreServerInferredWorkingView maps processed messages and anchored injected blocks back to originals', () => {
  const messages = [
    { role: 'system', content: 'top system' },
    { role: 'user', content: '[系统通知]hidden\n[系统通知结束]\nvisible user' },
    { role: 'assistant', content: 'old assistant' },
  ];
  const view = buildServerInferredWorkingView(messages);
  const processed = view.workingMessages.map(message => ({ ...message }));
  processed[2] = { ...processed[2], content: 'new assistant' };
  const injected = markOneRingInjectedFromDb(
    markOneRingWorkingKey({ role: 'assistant', content: 'db context' }, 'z1'),
  );
  processed.splice(2, 0, injected);

  const restored = restoreServerInferredWorkingView(messages, processed, view);

  assert.equal(restored.length, 4);
  assert.deepEqual(restored.map(message => message.content), [
    'top system',
    '[系统通知]hidden\n[系统通知结束]\nvisible user',
    'db context',
    'new assistant',
  ]);
  assert.equal(isOneRingInjectedFromDb(restored[2]), true);
  assert.equal(restored.__oneRingInjectedCount, 1);
});

test('restoreServerInferredWorkingView supports custom user merge for tail metadata projection', () => {
  const messages = [
    { role: 'user', content: '[系统通知]hidden\n[系统通知结束]\nvisible user' },
  ];
  const view = buildServerInferredWorkingView(messages);
  const processed = [
    { ...view.workingMessages[0], content: 'visible user\n[tail]' },
  ];

  const restored = restoreServerInferredWorkingView(messages, processed, view, {
    mergeProcessedMessage(original, processedMessage) {
      return { ...original, content: processedMessage.content };
    },
  });

  assert.deepEqual(restored, [
    { role: 'user', content: 'visible user\n[tail]' },
  ]);
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
