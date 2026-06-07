const test = require('node:test');
const assert = require('node:assert/strict');

const messageProcessor = require('../modules/messageProcessor.js');

test('applyDetectorRules keeps Detector system-only and SuperDetector all-role behavior', () => {
  const context = {
    detectors: [
      { detector: 'system-only', output: 'detected' },
      { detector: '', output: 'ignored-empty-detector' },
      { detector: 'ignored-output', output: null }
    ],
    superDetectors: [
      { detector: 'detected', output: 'super-after-detector' },
      { detector: 'all-role', output: 'global' }
    ]
  };

  assert.equal(
    messageProcessor.applyDetectorRules('system-only all-role', 'system', context),
    'super-after-detector global'
  );
  assert.equal(
    messageProcessor.applyDetectorRules('system-only all-role', 'user', context),
    'system-only global'
  );
  assert.equal(
    messageProcessor.applyDetectorRules('system-only all-role', 'assistant', context),
    'system-only global'
  );
});

test('applyDetectorRules is side-effect-free for missing text and invalid context', () => {
  assert.equal(messageProcessor.applyDetectorRules(null, 'system'), '');
  assert.equal(messageProcessor.applyDetectorRules(undefined, 'system', null), '');
  assert.equal(messageProcessor.applyDetectorRules(12345, 'system', {
    detectors: [{ detector: '23', output: 'XX' }],
    superDetectors: []
  }), '1XX45');
});

test('replaceOtherVariables still applies detector rules before async placeholders resolve', async () => {
  const missingRequestId = `missing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await messageProcessor.replaceOtherVariables(
    `before {{VCP_ASYNC_RESULT::NoSuchPlugin::${missingRequestId}}} after`,
    'test-model',
    'user',
    {
      DEBUG_MODE: false,
      detectors: [{ detector: 'before', output: 'detector-should-not-run-for-user' }],
      superDetectors: [{ detector: '结果待更新', output: 'SHOULD_NOT_REWRITE_ASYNC_RESULT' }]
    }
  );

  assert.match(result, /before \[任务 NoSuchPlugin \(ID: missing-[^)]+\) 结果待更新\.\.\.\] after/);
  assert.equal(result.includes('SHOULD_NOT_REWRITE_ASYNC_RESULT'), false);
  assert.equal(result.includes('detector-should-not-run-for-user'), false);
});

test('replaceOtherVariables can defer detector rules for message-level pipeline mode', async () => {
  const result = await messageProcessor.replaceOtherVariables(
    'system-only all-role',
    'test-model',
    'system',
    {
      DEBUG_MODE: false,
      pluginManager: {
        getAllPlaceholderValues: () => new Map(),
        getIndividualPluginDescriptions: () => new Map(),
        getResolvedPluginConfigValue: () => null
      },
      detectorPhase: 'deferred',
      detectors: [{ detector: 'system-only', output: 'detected' }],
      superDetectors: [{ detector: 'all-role', output: 'global' }]
    }
  );

  assert.equal(result, 'system-only all-role');
});

test('applyDetectorsToMessages rewrites string and text parts without mutating inputs', () => {
  const input = [
    {
      role: 'system',
      content: [
        { type: 'text', text: 'system-only all-role' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
      ]
    },
    {
      role: 'user',
      content: 'system-only all-role'
    },
    null,
    'raw-message'
  ];
  const original = JSON.parse(JSON.stringify(input));

  const output = messageProcessor.applyDetectorsToMessages(input, {
    detectors: [{ detector: 'system-only', output: 'detected' }],
    superDetectors: [{ detector: 'all-role', output: 'global' }]
  });

  assert.deepEqual(input, original);
  assert.notEqual(output, input);
  assert.notEqual(output[0], input[0]);
  assert.notEqual(output[0].content[0], input[0].content[0]);
  assert.equal(output[0].content[0].text, 'detected global');
  assert.deepEqual(output[0].content[1], original[0].content[1]);
  assert.equal(output[1].content, 'system-only global');
  assert.equal(output[2], null);
  assert.equal(output[3], 'raw-message');
});

test('Package E message-level detector helper is exported for pipeline wiring', () => {
  assert.equal(typeof messageProcessor.applyDetectorRules, 'function');
  assert.equal(typeof messageProcessor.applyDetectorsToMessages, 'function');
});
