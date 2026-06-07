const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROMPT_PIPELINE_ORDER_MODES,
  resolvePromptPipelineOrderMode,
  isExperimentalPromptPipelineOrderMode
} = require('../modules/promptPipelineOrderMode.js');

test('resolvePromptPipelineOrderMode defaults missing empty and unknown values to legacy', () => {
  assert.equal(resolvePromptPipelineOrderMode(undefined), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode(null), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode(''), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode('   '), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode('future-mode'), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode(true), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  assert.equal(resolvePromptPipelineOrderMode(1), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
});

test('resolvePromptPipelineOrderMode accepts only the explicit experimental mode', () => {
  assert.equal(
    resolvePromptPipelineOrderMode(PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER),
    PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER
  );
  assert.equal(
    resolvePromptPipelineOrderMode(` ${PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER} `),
    PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER
  );
  assert.equal(
    resolvePromptPipelineOrderMode('DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER'),
    PROMPT_PIPELINE_ORDER_MODES.LEGACY
  );
  assert.equal(resolvePromptPipelineOrderMode('experimental'), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
});

test('isExperimentalPromptPipelineOrderMode reflects resolved mode', () => {
  assert.equal(isExperimentalPromptPipelineOrderMode(undefined), false);
  assert.equal(isExperimentalPromptPipelineOrderMode('legacy'), false);
  assert.equal(
    isExperimentalPromptPipelineOrderMode(PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER),
    true
  );
});

test('pipeline mode resolver is input-only and does not read process env implicitly', () => {
  const previous = process.env.PromptPipelineOrderMode;
  process.env.PromptPipelineOrderMode = PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER;

  try {
    assert.equal(resolvePromptPipelineOrderMode(), PROMPT_PIPELINE_ORDER_MODES.LEGACY);
  } finally {
    if (previous === undefined) {
      delete process.env.PromptPipelineOrderMode;
    } else {
      process.env.PromptPipelineOrderMode = previous;
    }
  }
});
