'use strict';

// Presentation and patch helpers for the host-authenticated ChannelHub admin
// surface. Credential values never leave the server through adapter GET/POST/PUT.
// PATCH-like config updates retain secrets not re-entered in the admin page.
const CREDENTIAL_FIELD = /(?:^key$|token|secret|password|credential|authorization|api[_-]?key|bridge[_-]?key|app[_-]?key|private[_-]?key|auth[_-]?code)/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnsafeKeys(record, at = 'config', depth = 0) {
  if (!isRecord(record) || depth > 8) throw new Error('CHANNELHUB_CONFIG_INVALID_OBJECT');
  for (const [key, value] of Object.entries(record)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new Error('CHANNELHUB_CONFIG_UNSAFE_KEY:' + at + '.' + key);
    }
    if (isRecord(value)) rejectUnsafeKeys(value, at + '.' + key, depth + 1);
    if (Array.isArray(value)) {
      for (const item of value) if (isRecord(item)) rejectUnsafeKeys(item, at + '.' + key, depth + 1);
    }
  }
}

function hideSecrets(value) {
  if (Array.isArray(value)) return value.map(hideSecrets);
  if (!isRecord(value)) return value;
  const visible = {};
  for (const [key, content] of Object.entries(value)) {
    if (CREDENTIAL_FIELD.test(key)) continue;
    visible[key] = hideSecrets(content);
  }
  return visible;
}

function publicAdapter(adapter) {
  if (!adapter) return null;
  const publicRecord = hideSecrets(adapter);
  // The dashboard shows only metadata that a credential is present.
  publicRecord.configuredSecrets = Object.keys(adapter.config || {})
    .filter(key => CREDENTIAL_FIELD.test(key)).sort();
  return publicRecord;
}

function validateAgent(agentId, runtime) {
  if (typeof agentId !== 'string' || !agentId.trim()) throw new Error('CHANNELHUB_AGENT_REQUIRED');
  const agentManager = runtime?.agentManager;
  const selectedAlias = runtime?.agents?.[agentId]?.agentAlias || agentId;
  if (!agentManager || typeof agentManager.isAgent !== 'function' || !agentManager.isAgent(selectedAlias)) {
    throw new Error('CHANNELHUB_AGENT_NOT_REGISTERED');
  }
  return agentId;
}

function listAgents(runtime) {
  const manager = runtime?.agentManager;
  if (!manager || !(manager.agentMap instanceof Map) || typeof manager.isAgent !== 'function') {
    throw new Error('CHANNELHUB_AGENT_CATALOG_UNAVAILABLE');
  }
  return [...manager.agentMap.keys()]
    .filter(name => typeof name === 'string' && manager.isAgent(name))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map(name => ({ id: name, name }));
}

function assertPatch(payload) {
  if (!isRecord(payload)) throw new Error('CHANNELHUB_ADAPTER_PATCH_REQUIRED');
  for (const key of Object.keys(payload)) {
    if (!['name', 'config', 'expectedUpdatedAt'].includes(key)) {
      throw new Error('CHANNELHUB_ADAPTER_EDIT_FIELD_FORBIDDEN:' + key);
    }
  }
  if ('name' in payload && (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.length > 120)) {
    throw new Error('CHANNELHUB_ADAPTER_NAME_INVALID');
  }
  if ('config' in payload) rejectUnsafeKeys(payload.config);
  if (!('name' in payload) && !('config' in payload)) throw new Error('CHANNELHUB_ADAPTER_PATCH_EMPTY');
  if ('expectedUpdatedAt' in payload && typeof payload.expectedUpdatedAt !== 'string') {
    throw new Error('CHANNELHUB_ADAPTER_EDIT_VERSION_INVALID');
  }
}

function buildPatch(existing, payload, runtime) {
  assertPatch(payload);
  if (payload.expectedUpdatedAt && existing.updatedAt !== payload.expectedUpdatedAt) {
    const error = new Error('CHANNELHUB_ADAPTER_CONFIG_CHANGED_RELOAD_REQUIRED');
    error.httpStatus = 409;
    throw error;
  }
  const update = {};
  if ('name' in payload) update.name = payload.name.trim();
  if ('config' in payload) {
    update.config = { ...(existing.config || {}), ...payload.config };
    if (Object.hasOwn(payload.config, 'agentId')) validateAgent(payload.config.agentId, runtime);
  }
  return update;
}

module.exports = { publicAdapter, validateAgent, listAgents, assertPatch, buildPatch, isRecord, hideSecrets, rejectUnsafeKeys };
