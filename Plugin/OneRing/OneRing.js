'use strict';

const path = require('node:path');

const {
  classifySenderSource,
  getVisibleMessageText,
  parseOneRingTrigger,
  stripOneRingTailMarkers,
} = require('../../modules/oneringParser');
const {
  DEFAULT_ONERING_HOT_CONFIG,
  normalizeOneRingHotConfig,
  readOneRingHotConfigFile,
} = require('../../modules/oneringHotConfig');
const {
  DEFAULT_MAX_RECORDS,
  OneRingStore,
} = require('../../modules/oneringStore');

const HOT_CONFIG_FILE_NAME = 'OneRingConfig.json';
const DEFAULT_USER_NAME = 'User';

function createOneRingRecorder(options = {}) {
  let runtimeConfig = normalizeRuntimeConfig(options.config);
  let hotConfigPath = options.hotConfigPath || null;
  let store = null;
  const pluginDir = options.pluginDir || __dirname;
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const StoreClass = options.StoreClass || OneRingStore;

  function initialize(initialConfig = {}) {
    runtimeConfig = normalizeRuntimeConfig({
      ...runtimeConfig,
      ...initialConfig,
    });
    hotConfigPath = initialConfig.ONERING_HOT_CONFIG_PATH || hotConfigPath || path.join(pluginDir, HOT_CONFIG_FILE_NAME);
  }

  async function processMessages(messages) {
    const trigger = findLastTrigger(messages);
    if (!trigger || !isEffectiveEnabled()) {
      return messages;
    }

    const lastUser = findLastMessageByRole(messages, 'user');
    const content = cleanVisibleContent(lastUser?.content);
    if (!content) {
      return messages;
    }

    const sender = classifySenderSource(content, runtimeConfig.ONERING_USER_NAME);
    recordMessage({
      agentName: trigger.agentName,
      role: 'user',
      senderName: sender.senderName,
      frontendSource: trigger.frontendSource,
      content: sender.text,
    });

    return messages;
  }

  async function recordAIResponseFromMessages(messages, assistantContent) {
    const trigger = findLastTrigger(messages);
    const content = cleanVisibleContent(assistantContent);
    if (!trigger || !content || !isEffectiveEnabled()) {
      return { recorded: false, reason: !trigger ? 'missing-trigger' : 'disabled-or-empty' };
    }

    const result = recordMessage({
      agentName: trigger.agentName,
      role: 'assistant',
      senderName: trigger.agentName,
      frontendSource: trigger.frontendSource,
      content,
    });

    return { recorded: true, id: result.id };
  }

  async function recordAIResponse(meta, assistantContent) {
    const agentName = normalizeText(meta?.agentName);
    const frontendSource = normalizeText(meta?.frontendSource) || 'unknown';
    const content = cleanVisibleContent(assistantContent);
    if (!agentName || !content || !isEffectiveEnabled()) {
      return { recorded: false, reason: !agentName ? 'missing-agent' : 'disabled-or-empty' };
    }

    const result = recordMessage({
      agentName,
      role: 'assistant',
      senderName: agentName,
      frontendSource,
      content,
    });

    return { recorded: true, id: result.id };
  }

  function listMessages(agentName, listOptions) {
    return getStore().listMessages(agentName, listOptions);
  }

  function shutdown() {
    if (store) {
      store.close();
      store = null;
    }
  }

  function recordMessage(message) {
    return getStore().addMessage({
      ...message,
      timestamp: now(),
    });
  }

  function getStore() {
    if (!store) {
      store = new StoreClass({
        baseDir: resolveDataDir(runtimeConfig, pluginDir),
        maxRecords: runtimeConfig.ONERING_MAX_DB_RECORDS,
      });
    }

    return store;
  }

  function isEffectiveEnabled() {
    if (!runtimeConfig.ONERING_ENABLED) {
      return false;
    }

    const hotConfig = getHotConfig(options, hotConfigPath);
    return hotConfig.enabled === true;
  }

  return {
    initialize,
    processMessages,
    recordAIResponseFromMessages,
    recordAIResponse,
    listMessages,
    shutdown,
    _isEffectiveEnabled: isEffectiveEnabled,
  };
}

function getHotConfig(options, configPath) {
  if (options.hotConfig) {
    return normalizeOneRingHotConfig({
      ...DEFAULT_ONERING_HOT_CONFIG,
      ...options.hotConfig,
    });
  }

  return readOneRingHotConfigFile(configPath || path.join(__dirname, HOT_CONFIG_FILE_NAME)).config;
}

function findLastTrigger(messages) {
  if (!Array.isArray(messages)) {
    return null;
  }

  let lastTrigger = null;
  for (const message of messages) {
    const trigger = parseOneRingTrigger(getVisibleMessageText(message));
    if (trigger) {
      lastTrigger = trigger;
    }
  }

  return lastTrigger;
}

function findLastMessageByRole(messages, role) {
  if (!Array.isArray(messages)) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === role) {
      return messages[index];
    }
  }

  return null;
}

function cleanVisibleContent(content) {
  const visible = getVisibleMessageText(content).trim();
  if (!visible) {
    return '';
  }

  return stripOneRingTailMarkers(visible).text.trim();
}

function normalizeRuntimeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    ONERING_ENABLED: normalizeBoolean(source.ONERING_ENABLED, false),
    ONERING_RECORD_ONLY: normalizeBoolean(source.ONERING_RECORD_ONLY, true),
    ONERING_ALLOW_CONTEXT_PATCH: normalizeBoolean(source.ONERING_ALLOW_CONTEXT_PATCH, false),
    ONERING_USER_NAME: normalizeText(source.ONERING_USER_NAME) || DEFAULT_USER_NAME,
    ONERING_DATA_DIR: normalizeText(source.ONERING_DATA_DIR),
    ONERING_HOT_CONFIG_PATH: normalizeText(source.ONERING_HOT_CONFIG_PATH),
    ONERING_MAX_DB_RECORDS: normalizeInteger(source.ONERING_MAX_DB_RECORDS, DEFAULT_MAX_RECORDS),
  };
}

function resolveDataDir(config, pluginDir) {
  return config.ONERING_DATA_DIR
    ? path.resolve(config.ONERING_DATA_DIR)
    : path.join(pluginDir, 'data');
}

function normalizeBoolean(value, defaultValue) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
}

function normalizeInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const defaultRecorder = createOneRingRecorder();

module.exports = defaultRecorder;
module.exports.createOneRingRecorder = createOneRingRecorder;
module.exports.normalizeRuntimeConfig = normalizeRuntimeConfig;
