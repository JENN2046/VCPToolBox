'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ChatCompletionHandler = require('../modules/chatCompletionHandler');
const {
  buildOneRingDispatchMetadata,
  dispatchOneRingAssistantRecordCandidate,
} = require('../modules/oneringHandlerWiring');

function tick() {
  return new Promise(resolve => setImmediate(resolve));
}

test('captureOneRingResponseMeta freezes plugin-derived response meta', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  const pluginMeta = {
    agentName: 'Agnes',
    frontendSource: 'VChat',
    turnId: 'turn-1',
  };
  const pluginManager = {
    messagePreprocessors: new Map([[
      'OneRing',
      {
        extractMetaFromMessages(extractMessages) {
          assert.equal(extractMessages, messages);
          return pluginMeta;
        },
      },
    ]]),
  };

  assert.equal(
    ChatCompletionHandler._captureOneRingResponseMeta(pluginManager, messages, false),
    pluginMeta,
  );
  assert.equal(ChatCompletionHandler._captureOneRingResponseMeta({}, messages, false), null);
});

test('captureOneRingResponseMeta treats extractor failures as non-fatal', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    const pluginManager = {
      messagePreprocessors: new Map([[
        'OneRing',
        {
          extractMetaFromMessages() {
            throw new Error('extract failed');
          },
        },
      ]]),
    };

    assert.equal(
      ChatCompletionHandler._captureOneRingResponseMeta(pluginManager, [], false),
      null,
    );
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /Failed to freeze response meta/);
  } finally {
    console.warn = originalWarn;
  }
});

test('dispatch metadata carries frozen response meta without leaking raw message args', () => {
  const responseMeta = {
    agentName: 'Agnes',
    frontendSource: 'VChat',
    turnId: 'turn-1',
    requestHash: 'hash-1',
    responseMessageIdToUpdate: 42,
    ignoredRawValue: 'not copied',
  };
  const metadata = buildOneRingDispatchMetadata(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      oneRingResponseMeta: responseMeta,
    },
    { phaseLabel: 'final_turn' },
  );

  assert.deepEqual(metadata.responseMeta, {
    agentName: 'Agnes',
    frontendSource: 'VChat',
    turnId: 'turn-1',
    requestHash: 'hash-1',
    responseMessageIdToUpdate: 42,
  });
  assert.equal(Object.hasOwn(metadata.responseMeta, 'ignoredRawValue'), false);
});

test('dispatchOneRingAssistantRecordCandidate prefers wrapper recorder with frozen meta', async () => {
  const wrapperCalls = [];
  const legacyCalls = [];
  const oneRingModule = {
    recordAIResponse(meta, content) {
      wrapperCalls.push({ meta, content });
      return { recorded: true, id: 42 };
    },
    recordAIResponseFromMessages(messages, content) {
      legacyCalls.push({ messages, content });
    },
  };

  const result = dispatchOneRingAssistantRecordCandidate(
    {
      originalBody: { messages: [{ role: 'user', content: 'hello' }] },
      oneRingResponseMeta: {
        agentName: 'Agnes',
        frontendSource: 'VChat',
        turnId: 'turn-frozen',
        responseMessageIdToUpdate: 7,
      },
      pluginManager: {
        messagePreprocessors: new Map([['OneRing', oneRingModule]]),
      },
    },
    { shouldRecord: true, role: 'assistant', content: 'visible answer', reason: null },
  );

  assert.equal(result.dispatched, true);

  await tick();

  assert.deepEqual(wrapperCalls, [{
    meta: {
      agentName: 'Agnes',
      frontendSource: 'VChat',
      turnId: 'turn-frozen',
      responseMessageIdToUpdate: 7,
      postTurn: null,
    },
    content: 'visible answer',
  }]);
  assert.deepEqual(legacyCalls, []);
});

test('stream and non-stream handlers pass frozen response meta into dispatch', () => {
  const streamSource = fs.readFileSync(
    path.join(__dirname, '..', 'modules', 'handlers', 'streamHandler.js'),
    'utf8',
  );
  const nonStreamSource = fs.readFileSync(
    path.join(__dirname, '..', 'modules', 'handlers', 'nonStreamHandler.js'),
    'utf8',
  );

  assert.match(streamSource, /responseMeta:\s*this\.context\.oneRingResponseMeta\s*\|\|\s*null/);
  assert.match(nonStreamSource, /responseMeta:\s*this\.context\.oneRingResponseMeta\s*\|\|\s*null/);
});
