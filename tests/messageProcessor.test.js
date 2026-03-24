const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');

const messageProcessor = require('../modules/messageProcessor.js');
const agentManager = require('../modules/agentManager.js');
const tvsManager = require('../modules/tvsManager.js');
const toolboxManager = require('../modules/toolboxManager.js');

const ASYNC_RESULTS_DIR = path.join(__dirname, '..', 'VCPAsyncResults');
const TOUCHED_ENV_KEYS = ['SarModel1', 'SarPrompt1', 'TarGreeting'];

const originalMethods = {
  isAgent: agentManager.isAgent,
  getAgentPrompt: agentManager.getAgentPrompt,
  getContent: tvsManager.getContent,
  isToolbox: toolboxManager.isToolbox,
  getFoldObject: toolboxManager.getFoldObject
};

function createContext(overrides = {}) {
  return {
    pluginManager: {
      messagePreprocessors: new Map(),
      getAllPlaceholderValues: () => new Map(),
      getIndividualPluginDescriptions: () => new Map(),
      getResolvedPluginConfigValue: () => null
    },
    cachedEmojiLists: new Map(),
    detectors: [],
    superDetectors: [],
    DEBUG_MODE: false,
    messages: [],
    ...overrides
  };
}

function createRagPlugin(vector = [1, 0]) {
  return {
    ragParams: {
      RAGDiaryPlugin: {
        mainSearchWeights: [1, 0]
      }
    },
    sanitizeForEmbedding(text) {
      return String(text || '');
    },
    async getSingleEmbeddingCached() {
      return vector;
    },
    _getWeightedAverageVector(vectors) {
      return vectors.find(Boolean) || null;
    },
    vectorDBManager: {
      async getPluginDescriptionVector() {
        return vector;
      }
    }
  };
}

async function cleanupAsyncResultFile(pluginName, requestId) {
  const filePath = path.join(ASYNC_RESULTS_DIR, `${pluginName}-${requestId}.json`);
  await fs.rm(filePath, { force: true });
}

test.afterEach(async () => {
  agentManager.isAgent = originalMethods.isAgent;
  agentManager.getAgentPrompt = originalMethods.getAgentPrompt;
  tvsManager.getContent = originalMethods.getContent;
  toolboxManager.isToolbox = originalMethods.isToolbox;
  toolboxManager.getFoldObject = originalMethods.getFoldObject;

  for (const key of TOUCHED_ENV_KEYS) {
    delete process.env[key];
  }

  await cleanupAsyncResultFile('DemoPlugin', 'req123');
});

test('resolves direct agent placeholders', async () => {
  agentManager.isAgent = (alias) => alias === 'Alpha';
  agentManager.getAgentPrompt = async () => 'AGENT OUTPUT';

  const result = await messageProcessor.replaceAgentVariables(
    'Hello {{agent:Alpha}}',
    'Nova',
    'system',
    createContext()
  );

  assert.equal(result, 'Hello AGENT OUTPUT');
});

test('recursively resolves agent placeholders inside SarPrompt txt files', async () => {
  process.env.SarModel1 = 'Nova';
  process.env.SarPrompt1 = 'sar1.txt';

  agentManager.isAgent = (alias) => alias === 'Alpha';
  agentManager.getAgentPrompt = async () => 'INNER AGENT';
  tvsManager.getContent = async (filename) => {
    assert.equal(filename, 'sar1.txt');
    return 'Injected {{agent:Alpha}}';
  };

  const result = await messageProcessor.replaceAgentVariables(
    'Prefix {{SarPrompt1}} Suffix',
    'Nova',
    'system',
    createContext()
  );

  assert.equal(result, 'Prefix Injected INNER AGENT Suffix');
});

test('recursively resolves toolbox dynamic fold placeholders inside Tar txt files', async () => {
  process.env.TarGreeting = 'tar-greeting.txt';

  toolboxManager.isToolbox = (alias) => alias === 'ToolA';
  toolboxManager.getFoldObject = async () => ({
    vcp_dynamic_fold: true,
    plugin_description: 'ToolA description',
    fold_blocks: [
      { threshold: 0.7, content: 'HIGH BLOCK' },
      { threshold: 0.0, content: 'LOW BLOCK' }
    ]
  });
  tvsManager.getContent = async (filename) => {
    assert.equal(filename, 'tar-greeting.txt');
    return 'Tar says {{toolbox:ToolA}}';
  };

  const context = createContext({
    messages: [
      { role: 'user', content: 'Need toolbox guidance' }
    ],
    pluginManager: {
      messagePreprocessors: new Map([['RAGDiaryPlugin', createRagPlugin()]]),
      getAllPlaceholderValues: () => new Map(),
      getIndividualPluginDescriptions: () => new Map(),
      getResolvedPluginConfigValue: () => null
    }
  });

  const result = await messageProcessor.replaceAgentVariables(
    'Start {{TarGreeting}} End',
    'Nova',
    'system',
    context
  );

  assert.equal(result, 'Start Tar says HIGH BLOCK End');
});

test('injects async result placeholders from persisted callback files', async () => {
  await fs.mkdir(ASYNC_RESULTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(ASYNC_RESULTS_DIR, 'DemoPlugin-req123.json'),
    JSON.stringify({ message: 'Async completed' }),
    'utf8'
  );

  const result = await messageProcessor.replaceOtherVariables(
    'Result => {{VCP_ASYNC_RESULT::DemoPlugin::req123}}',
    'Nova',
    'user',
    createContext()
  );

  assert.equal(result, 'Result => Async completed');
});
