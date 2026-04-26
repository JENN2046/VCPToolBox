'use strict';

const path = require('path');

const SUPPORTED_PRODUCTS = new Set([
  'aitable',
  'calendar',
  'chat',
  'bot',
  'ding',
  'contact',
  'todo',
  'report',
  'attendance',
  'devdoc',
  'workbench'
]);

const PRODUCT_ALIASES = {
  chatbot: 'chat',
  'chat(bot)': 'chat',
  contacts: 'contact',
  docs: 'devdoc'
};

const WRITE_TOOL_HINTS = [
  'create',
  'add',
  'update',
  'delete',
  'remove',
  'send',
  'write',
  'batch',
  'append',
  'upsert',
  'publish',
  'assign'
];

const READ_TOOL_HINTS = [
  'get',
  'list',
  'query',
  'search',
  'read',
  'describe',
  'status',
  'detail',
  'fetch'
];

const DEFAULTS = {
  DWS_BIN: 'dws',
  DWS_MIN_VERSION: '1.0.8',
  AUTH_MODE: 'auto',
  DWS_GRAY_STAGE: 'query_only',
  DWS_CLIENT_ID: '',
  DWS_CLIENT_SECRET: '',
  DWS_TRUSTED_DOMAINS: '',
  AUDIT_LOG_PATH: '',
  DWS_TIMEOUT_MS: 60000,
  DWS_SCHEMA_CACHE_TTL_MS: 5 * 60 * 1000,
  DWS_MAX_ARG_BYTES: 256 * 1024,
  DWS_BATCH_LIMIT: 500,
  DWS_DEBUG: 'false',
  DWS_TOOL_MAP_PATH: ''
};

function resolveDefaultAuditLogPath(projectBasePath) {
  const basePath = projectBasePath || process.cwd();
  return path.join(basePath, 'logs', 'dingtalk-cli-audit.jsonl');
}

const GRAY_STAGE = {
  QUERY_ONLY: 'query_only',
  LOW_RISK_WRITE: 'low_risk_write',
  FULL_WRITE: 'full_write'
};

const LOW_RISK_WRITE_PRODUCTS = new Set(['todo', 'ding', 'chat']);

module.exports = {
  SUPPORTED_PRODUCTS,
  PRODUCT_ALIASES,
  WRITE_TOOL_HINTS,
  READ_TOOL_HINTS,
  DEFAULTS,
  resolveDefaultAuditLogPath,
  GRAY_STAGE,
  LOW_RISK_WRITE_PRODUCTS
};
