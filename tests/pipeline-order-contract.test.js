const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ChatCompletionHandler = require('../modules/chatCompletionHandler.js');

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function startCaptureUpstream() {
  const chatRequests = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404).end();
      return;
    }

    const body = await readJsonBody(req);
    chatRequests.push(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'pipeline-order-test',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model || 'fake-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop'
        }
      ]
    }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    chatRequests,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    body: '',
    setHeader() {},
    getHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.headersSent = true;
      this.writableEnded = true;
      this.body = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
      return this;
    },
    json(payload) {
      return this.send(Buffer.from(JSON.stringify(payload)));
    },
    write(payload) {
      this.headersSent = true;
      this.body += Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
      return true;
    },
    end(payload = '') {
      if (payload) {
        this.body += Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
      }
      this.headersSent = true;
      this.writableEnded = true;
    }
  };
}

function createPipelineTestHandler({ apiUrl, tavernPreprocessor }) {
  const pluginManager = {
    messagePreprocessors: new Map([['VCPTavern', tavernPreprocessor]]),
    getAllPlaceholderValues: () => new Map(),
    getIndividualPluginDescriptions: () => new Map(),
    getResolvedPluginConfigValue: () => null,
    async executeMessagePreprocessor(name, messages) {
      const preprocessor = this.messagePreprocessors.get(name);
      return preprocessor ? preprocessor(messages) : messages;
    }
  };

  return new ChatCompletionHandler({
    apiUrl,
    apiKey: 'test-key',
    modelRedirectHandler: {
      redirectModelForBackend(modelName) {
        return modelName;
      }
    },
    pluginManager,
    activeRequests: new Map(),
    writeDebugLog: async () => {},
    writeChatLog: undefined,
    handleDiaryFromAIResponse: async () => {},
    webSocketServer: { broadcast() {} },
    DEBUG_MODE: false,
    SHOW_VCP_OUTPUT: false,
    VCPToolCode: false,
    maxVCPLoopStream: 1,
    maxVCPLoopNonStream: 1,
    apiRetries: 1,
    apiRetryDelay: 1,
    RAGMemoRefresh: false,
    enableRoleDivider: true,
    enableRoleDividerInLoop: false,
    roleDividerIgnoreList: [],
    roleDividerSwitches: { system: true, assistant: true, user: true },
    roleDividerScanSwitches: { system: true, assistant: true, user: true },
    roleDividerRemoveDisabledTags: true,
    promptPipelineOrderMode: 'detector_post_processors_final_role_divider',
    chinaModel1: [],
    chinaModel1Cot: false,
    cachedEmojiLists: new Map(),
    detectors: [],
    superDetectors: []
  });
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

test('experimental final Role Divider skips the original top system even after inserted system messages', async () => {
  const upstream = await startCaptureUpstream();

  try {
    const handler = createPipelineTestHandler({
      apiUrl: upstream.baseUrl,
      tavernPreprocessor(messages) {
        return [
          {
            role: 'system',
            content: [
              'inserted-prefix',
              '<<<[ROLE_DIVIDE_USER]>>>inserted-user<<<[END_ROLE_DIVIDE_USER]>>>'
            ].join('\n')
          },
          ...messages
        ];
      }
    });

    const req = {
      ip: '127.0.0.1',
      headers: {},
      body: {
        model: 'fake-model',
        stream: false,
        messages: [
          {
            role: 'system',
            content: [
              'original-system',
              '<<<[ROLE_DIVIDE_USER]>>>original-user<<<[END_ROLE_DIVIDE_USER]>>>'
            ].join('\n')
          },
          {
            role: 'user',
            content: 'hello'
          }
        ]
      }
    };

    const res = createMockResponse();
    await handler.handle(req, res, false);

    assert.equal(upstream.chatRequests.length, 1);
    const finalMessages = upstream.chatRequests[0].messages;
    const finalTextByRole = finalMessages.map(message => `${message.role}:${message.content}`).join('\n---\n');

    assert.match(finalTextByRole, /system:inserted-prefix/);
    assert.match(finalTextByRole, /user:inserted-user/);
    assert.match(
      finalTextByRole,
      /system:original-system\n<<<\[ROLE_DIVIDE_USER\]>>>original-user<<<\[END_ROLE_DIVIDE_USER\]>>>/
    );
    assert.equal(finalMessages.some(message => message.role === 'user' && message.content === 'original-user'), false);
    assert.equal(JSON.stringify(finalMessages).includes('__vcpOriginalTopSystemPrompt'), false);
  } finally {
    await upstream.close();
  }
});
