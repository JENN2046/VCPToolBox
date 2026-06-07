const test = require('node:test');
const assert = require('node:assert/strict');

const messageProcessor = require('../modules/messageProcessor.js');

const LEGACY_MODE = 'legacy';
const EXPERIMENTAL_MODE = 'detector_post_processors_final_role_divider';

function resolvePromptPipelineOrderMode(value) {
  return value === EXPERIMENTAL_MODE ? EXPERIMENTAL_MODE : LEGACY_MODE;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function visibleText(messages) {
  return messages.map(message => {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter(part => part && part.type === 'text')
        .map(part => part.text)
        .join('\n');
    }
    return '';
  }).join('\n---\n');
}

function markRoleDividerStage(messages, stage) {
  return clone(messages).map(message => {
    if (typeof message.content === 'string') {
      return { ...message, content: `[${stage}] ${message.content}` };
    }
    if (Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map(part => {
          if (part && part.type === 'text' && typeof part.text === 'string') {
            return { ...part, text: `[${stage}] ${part.text}` };
          }
          return part;
        })
      };
    }
    return message;
  });
}

function applyDetectorPhaseHarness({ mode, text, role = 'system', context }) {
  const resolvedMode = resolvePromptPipelineOrderMode(mode);
  const phases = [];
  let currentText = text;

  if (resolvedMode === LEGACY_MODE) {
    phases.push('legacy-replaceOtherVariables');
    currentText = messageProcessor.applyDetectorRules(currentText, role, context);
  } else {
    phases.push('deferred-message-level');
    currentText = messageProcessor.applyDetectorsToMessages([
      { role, content: currentText }
    ], context)[0].content;
  }

  return { mode: resolvedMode, phases, text: currentText };
}

function runPipelineVisibilityHarness({
  mode,
  enableRoleDivider = true,
  messages,
  preprocessor = current => current,
  semanticRouter = current => visibleText(current)
}) {
  const resolvedMode = resolvePromptPipelineOrderMode(mode);
  const roleDividerStages = [];
  let current = clone(messages);

  const runRoleDivider = stage => {
    roleDividerStages.push(stage);
    current = markRoleDividerStage(current, stage);
  };

  if (enableRoleDivider && resolvedMode === LEGACY_MODE) {
    runRoleDivider('initial');
  }

  const preprocessorInput = clone(current);
  current = preprocessor(clone(current), resolvedMode);

  const semanticInput = clone(current);
  const routeKey = semanticRouter(clone(current), resolvedMode);

  if (enableRoleDivider && resolvedMode === EXPERIMENTAL_MODE) {
    runRoleDivider('final');
  }

  return {
    mode: resolvedMode,
    roleDividerStages,
    preprocessorInput,
    semanticInput,
    routeKey,
    finalMessages: clone(current)
  };
}

test('E3a harness keeps unknown or missing pipeline modes on legacy', () => {
  assert.equal(resolvePromptPipelineOrderMode(undefined), LEGACY_MODE);
  assert.equal(resolvePromptPipelineOrderMode(''), LEGACY_MODE);
  assert.equal(resolvePromptPipelineOrderMode('future-mode'), LEGACY_MODE);
  assert.equal(resolvePromptPipelineOrderMode(EXPERIMENTAL_MODE), EXPERIMENTAL_MODE);
});

test('E3a harness documents detector single ownership for legacy and experimental modes', () => {
  const context = {
    detectors: [
      { detector: 'A', output: 'B' },
      { detector: 'C', output: 'D' }
    ],
    superDetectors: [
      { detector: 'B', output: 'C' }
    ]
  };

  const legacy = applyDetectorPhaseHarness({ mode: LEGACY_MODE, text: 'A', context });
  const experimental = applyDetectorPhaseHarness({ mode: EXPERIMENTAL_MODE, text: 'A', context });

  assert.deepEqual(legacy.phases, ['legacy-replaceOtherVariables']);
  assert.deepEqual(experimental.phases, ['deferred-message-level']);
  assert.equal(legacy.text, 'C');
  assert.equal(experimental.text, 'C');

  const doubleApplied = messageProcessor.applyDetectorsToMessages([
    { role: 'system', content: legacy.text }
  ], context)[0].content;

  assert.equal(doubleApplied, 'D');
  assert.notEqual(doubleApplied, legacy.text);
});

test('E3a harness message-level detector traversal preserves non-text parts and input messages', () => {
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
    }
  ];
  const original = clone(input);
  const output = messageProcessor.applyDetectorsToMessages(input, {
    detectors: [{ detector: 'system-only', output: 'detected' }],
    superDetectors: [{ detector: 'all-role', output: 'global' }]
  });

  assert.deepEqual(input, original);
  assert.equal(output[0].content[0].text, 'detected global');
  assert.deepEqual(output[0].content[1], original[0].content[1]);
  assert.equal(output[1].content, 'system-only global');
});

test('E3a harness documents Role Divider ownership and preprocessor visibility delta', () => {
  const messages = [{ role: 'user', content: 'hello' }];
  const capturePreprocessorText = current => current;

  const legacy = runPipelineVisibilityHarness({
    mode: LEGACY_MODE,
    messages,
    preprocessor: capturePreprocessorText
  });
  const experimental = runPipelineVisibilityHarness({
    mode: EXPERIMENTAL_MODE,
    messages,
    preprocessor: capturePreprocessorText
  });
  const disabled = runPipelineVisibilityHarness({
    mode: EXPERIMENTAL_MODE,
    enableRoleDivider: false,
    messages,
    preprocessor: capturePreprocessorText
  });

  assert.deepEqual(legacy.roleDividerStages, ['initial']);
  assert.deepEqual(experimental.roleDividerStages, ['final']);
  assert.deepEqual(disabled.roleDividerStages, []);

  assert.match(visibleText(legacy.preprocessorInput), /^\[initial\] hello/);
  assert.equal(visibleText(experimental.preprocessorInput), 'hello');
  assert.match(visibleText(experimental.finalMessages), /^\[final\] hello/);
});

test('E3a harness makes the semantic routing input delta explicit', () => {
  const messages = [{ role: 'user', content: 'route-me' }];
  const semanticRouter = current => visibleText(current);

  const legacy = runPipelineVisibilityHarness({
    mode: LEGACY_MODE,
    messages,
    semanticRouter
  });
  const experimental = runPipelineVisibilityHarness({
    mode: EXPERIMENTAL_MODE,
    messages,
    semanticRouter
  });

  assert.equal(legacy.routeKey, '[initial] route-me');
  assert.equal(experimental.routeKey, 'route-me');
  assert.notEqual(legacy.routeKey, experimental.routeKey);
});
