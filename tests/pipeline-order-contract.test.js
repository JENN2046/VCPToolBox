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

test('chatCompletionHandler keeps current local pipeline order before Package E runtime changes', () => {
  const source = readSource('modules/chatCompletionHandler.js');

  assertSourceOrder(source, [
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

  assert.equal(source.includes('LogAfterDetectors'), false);
  assert.equal(source.includes('LogAfterFinalRoleDivider'), false);
  assert.equal(source.includes('Applying Role Divider processing (Final Stage)'), false);
  assert.equal(source.includes('applyDetectorsToMessages(processedMessages'), false);
});

test('messageProcessor keeps Detector and SuperDetector attached to replaceOtherVariables', () => {
  const source = readSource('modules/messageProcessor.js');

  assertSourceOrder(source, [
    'function applyDetectorRules(text, role, context = {})',
    'for (const rule of detectors)',
    'for (const rule of superDetectors)',
    'function applyDetectorsToMessages(messages, context = {})',
    'async function replaceOtherVariables(text, model, role, context)',
    'processedText = applyDetectorRules(processedText, role, context)',
    'const asyncResultPlaceholderRegex',
    'module.exports ='
  ]);

  const replaceStart = markerIndex(source, 'async function replaceOtherVariables(text, model, role, context)');
  const exportStart = markerIndex(source, 'module.exports =');
  const detectorHelperCall = markerIndex(source, 'processedText = applyDetectorRules(processedText, role, context)');
  const asyncPlaceholderStart = markerIndex(source, 'const asyncResultPlaceholderRegex');
  const messageHelperStart = markerIndex(source, 'function applyDetectorsToMessages(messages, context = {})');

  assert.ok(detectorHelperCall > replaceStart && detectorHelperCall < exportStart);
  assert.ok(detectorHelperCall < asyncPlaceholderStart);
  assert.ok(messageHelperStart < replaceStart);
});

test('Package E target order is documented but not active in runtime source', () => {
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

  assert.equal(handlerSource.includes('LogAfterDetectors'), false);
  assert.equal(handlerSource.includes('LogAfterFinalRoleDivider'), false);
  assert.equal(handlerSource.includes('applyDetectorsToMessages'), false);
  assert.equal(processorSource.includes('function applyDetectorsToMessages'), true);
});
