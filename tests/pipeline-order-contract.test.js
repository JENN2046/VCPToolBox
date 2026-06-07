const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function markerIndex(source, marker) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, `missing marker: ${marker}`);
  return index;
}

function assertSourceOrder(source, markers) {
  const positions = markers.map(marker => ({ marker, index: markerIndex(source, marker) }));

  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i - 1].index < positions[i].index,
      `expected "${positions[i - 1].marker}" before "${positions[i].marker}"`
    );
  }
}

test('chatCompletionHandler keeps legacy as the default pipeline order', () => {
  const source = readSource('modules/chatCompletionHandler.js');

  assertSourceOrder(source, [
    'const pipelineOrderMode = resolvePromptPipelineOrderMode',
    'LogInput',
    'Applying Role Divider processing (Initial Stage)',
    'LogAfterInitialRoleDivider',
    'consumeVcpToolUseForbiddenPlaceholder(originalBody.messages)',
    'executeMessagePreprocessor(\'VCPTavern\', originalBody.messages)',
    'semanticModelRouter.resolveRoute',
    'messageProcessor.replaceAgentVariables',
    'LogAfterVariableProcessing',
    'const processorName = pluginManager.messagePreprocessors.has(\'MultiModalProcessor\')',
    'executeMessagePreprocessor(processorName, processedMessages)',
    'for (const name of pluginManager.messagePreprocessors.keys())',
    'executeMessagePreprocessor(name, processedMessages)',
    'LogAfterPreprocessors',
    'TransBase64+ cleanup and media restore complete',
    'finalContextStore.setLastFinalContext'
  ]);

  assert.equal(source.includes('if (enableRoleDivider && !useExperimentalPipelineOrder)'), true);
  assert.equal(source.includes("detectorPhase: useExperimentalPipelineOrder ? 'deferred' : 'legacy'"), true);
});

test('chatCompletionHandler wires explicit experimental pipeline order after preprocessors', () => {
  const source = readSource('modules/chatCompletionHandler.js');

  assertSourceOrder(source, [
    'TransBase64+ cleanup and media restore complete',
    'if (useExperimentalPipelineOrder)',
    'messageProcessor.applyDetectorsToMessages(processedMessages, processingContext)',
    'LogAfterDetectors',
    'Applying Role Divider processing (Final Stage)',
    'LogAfterFinalRoleDivider',
    'finalContextStore.setLastFinalContext'
  ]);

  assert.equal(source.includes('PROMPT_PIPELINE_ORDER_MODES.DETECTOR_POST_PROCESSORS_FINAL_ROLE_DIVIDER'), true);
  assert.equal(source.includes('this.config.promptPipelineOrderMode ?? process.env.PromptPipelineOrderMode'), true);
});

test('server passes raw PromptPipelineOrderMode into ChatCompletionHandler config', () => {
  const source = readSource('server.js');

  assertSourceOrder(source, [
    "dotenv.config({ path: 'config.env' })",
    'const chatCompletionHandler = new ChatCompletionHandler',
    'promptPipelineOrderMode: process.env.PromptPipelineOrderMode'
  ]);
});

test('messageProcessor keeps Detector and SuperDetector attached to replaceOtherVariables', () => {
  const source = readSource('modules/messageProcessor.js');

  assertSourceOrder(source, [
    'function applyDetectorRules(text, role, context = {})',
    'for (const rule of detectors)',
    'for (const rule of superDetectors)',
    'function applyDetectorsToMessages(messages, context = {})',
    'async function replaceOtherVariables(text, model, role, context)',
    "if (context?.detectorPhase !== 'deferred')",
    'processedText = applyDetectorRules(processedText, role, context)',
    'const asyncResultPlaceholderRegex',
    'module.exports ='
  ]);

  const replaceStart = markerIndex(source, 'async function replaceOtherVariables(text, model, role, context)');
  const exportStart = markerIndex(source, 'module.exports =');
  const detectorHelperCall = markerIndex(source, 'processedText = applyDetectorRules(processedText, role, context)');
  const asyncPlaceholderStart = markerIndex(source, 'const asyncResultPlaceholderRegex');
  const messageHelperStart = markerIndex(source, 'function applyDetectorsToMessages(messages, context = {})');
  const detectorPhaseGuard = markerIndex(source, "if (context?.detectorPhase !== 'deferred')");

  assert.ok(detectorHelperCall > replaceStart && detectorHelperCall < exportStart);
  assert.ok(detectorHelperCall < asyncPlaceholderStart);
  assert.ok(detectorPhaseGuard > replaceStart && detectorPhaseGuard < detectorHelperCall);
  assert.ok(messageHelperStart < replaceStart);
});

test('Package E keeps legacy and experimental orders distinct in source', () => {
  const currentLocalOrder = [
    'LogInput',
    'Role Divider initial stage',
    'VCPTavern',
    'semantic routing',
    'variable replacement',
    'media preprocessor',
    'generic preprocessors',
    'TransBase64+ cleanup',
    'final context capture'
  ];
  const packageETargetOrder = [
    'LogInput',
    'VCPTavern',
    'semantic routing',
    'variable replacement',
    'media preprocessor',
    'generic preprocessors',
    'TransBase64+ cleanup',
    'Detector / SuperDetector post-processing',
    'Role Divider final stage',
    'final context capture'
  ];

  assert.notDeepEqual(currentLocalOrder, packageETargetOrder);

  const handlerSource = readSource('modules/chatCompletionHandler.js');
  const processorSource = readSource('modules/messageProcessor.js');

  assert.equal(handlerSource.includes('LogAfterInitialRoleDivider'), true);
  assert.equal(handlerSource.includes('LogAfterDetectors'), true);
  assert.equal(handlerSource.includes('LogAfterFinalRoleDivider'), true);
  assert.equal(handlerSource.includes('applyDetectorsToMessages'), true);
  assert.equal(processorSource.includes('function applyDetectorsToMessages'), true);
});
