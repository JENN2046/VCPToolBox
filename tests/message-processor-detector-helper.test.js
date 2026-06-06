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

test('Package E message-level detector helper is not exported or wired yet', () => {
  assert.equal(typeof messageProcessor.applyDetectorRules, 'function');
  assert.equal(Object.prototype.hasOwnProperty.call(messageProcessor, 'applyDetectorsToMessages'), false);
});
