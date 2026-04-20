'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULTS, GRAY_STAGE, resolveDefaultAuditLogPath } = require('./constants');

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const idx = trimmed.indexOf('=');
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true';
}

function asInteger(value, defaultValue) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return parsed;
}

function normalizeBinValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeGrayStage(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();

  if (!raw) {
    return DEFAULTS.DWS_GRAY_STAGE;
  }

  const aliasMap = {
    query: GRAY_STAGE.QUERY_ONLY,
    query_only: GRAY_STAGE.QUERY_ONLY,
    phase1: GRAY_STAGE.QUERY_ONLY,
    p1: GRAY_STAGE.QUERY_ONLY,
    low_risk: GRAY_STAGE.LOW_RISK_WRITE,
    low_risk_write: GRAY_STAGE.LOW_RISK_WRITE,
    phase2: GRAY_STAGE.LOW_RISK_WRITE,
    p2: GRAY_STAGE.LOW_RISK_WRITE,
    full: GRAY_STAGE.FULL_WRITE,
    full_write: GRAY_STAGE.FULL_WRITE,
    phase3: GRAY_STAGE.FULL_WRITE,
    p3: GRAY_STAGE.FULL_WRITE
  };

  return aliasMap[raw] || DEFAULTS.DWS_GRAY_STAGE;
}

function resolveDwsBin(input) {
  const raw = normalizeBinValue(input || DEFAULTS.DWS_BIN || 'dws') || 'dws';
  const candidates = [];

  const push = (candidate) => {
    if (!candidate) {
      return;
    }
    const key = String(candidate).toLowerCase();
    if (!candidates.some((item) => String(item).toLowerCase() === key)) {
      candidates.push(candidate);
    }
  };

  if (process.platform === 'win32') {
    const baseName = path.basename(raw).replace(/\.(cmd|exe|bat)$/i, '');
    const appData = process.env.APPDATA;
    const userProfile = process.env.USERPROFILE;
    const npmPrefix = process.env.npm_config_prefix;

    if (raw.includes(path.sep) || raw.includes('/') || path.isAbsolute(raw)) {
      push(raw);
    }
    if (appData) {
      push(path.join(appData, 'npm', `${baseName}.cmd`));
    }
    if (userProfile) {
      push(path.join(userProfile, 'AppData', 'Roaming', 'npm', `${baseName}.cmd`));
    }
    if (npmPrefix) {
      push(path.join(npmPrefix, `${baseName}.cmd`));
    }
    if (!/\.(cmd|exe|bat)$/i.test(raw)) {
      push(`${baseName}.cmd`);
    }
    push(raw);
  } else {
    push(raw);
  }

  let fallback = raw;
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    fallback = candidate;
  }

  for (const candidate of candidates) {
    if (!(candidate.includes(path.sep) || candidate.includes('/'))) {
      fallback = candidate;
      break;
    }
  }

  return fallback || raw;
}

function readRuntimeConfig(basePath) {
  const projectBasePath = process.env.PROJECT_BASE_PATH || basePath;
  const envPath = path.join(basePath, 'config.env');
  loadEnvFile(envPath);

  const config = {
    projectBasePath,
    pluginBasePath: basePath,
    dwsBin: resolveDwsBin(process.env.DWS_BIN || DEFAULTS.DWS_BIN),
    dwsMinVersion: process.env.DWS_MIN_VERSION || DEFAULTS.DWS_MIN_VERSION,
    authMode: process.env.AUTH_MODE || DEFAULTS.AUTH_MODE,
    grayStage: normalizeGrayStage(process.env.DWS_GRAY_STAGE || DEFAULTS.DWS_GRAY_STAGE),
    dwsClientId: process.env.DWS_CLIENT_ID || DEFAULTS.DWS_CLIENT_ID,
    dwsClientSecret: process.env.DWS_CLIENT_SECRET || DEFAULTS.DWS_CLIENT_SECRET,
    trustedDomains: (process.env.DWS_TRUSTED_DOMAINS || DEFAULTS.DWS_TRUSTED_DOMAINS)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    timeoutMs: asInteger(process.env.DWS_TIMEOUT_MS, DEFAULTS.DWS_TIMEOUT_MS),
    schemaCacheTtlMs: asInteger(process.env.DWS_SCHEMA_CACHE_TTL_MS, DEFAULTS.DWS_SCHEMA_CACHE_TTL_MS),
    maxArgBytes: asInteger(process.env.DWS_MAX_ARG_BYTES, DEFAULTS.DWS_MAX_ARG_BYTES),
    batchLimit: asInteger(process.env.DWS_BATCH_LIMIT, DEFAULTS.DWS_BATCH_LIMIT),
    debug: asBoolean(process.env.DWS_DEBUG, false),
    auditLogPath:
      process.env.AUDIT_LOG_PATH ||
      DEFAULTS.AUDIT_LOG_PATH ||
      resolveDefaultAuditLogPath(projectBasePath),
    cachePath: path.join(basePath, 'state', 'schema-cache.json'),
    workflowStateDir: path.join(basePath, 'state', 'workflow-runs'),
    toolMapPath:
      process.env.DWS_TOOL_MAP_PATH ||
      DEFAULTS.DWS_TOOL_MAP_PATH ||
      path.join(basePath, 'state', 'capability-map.json')
  };

  return config;
}

module.exports = {
  loadEnvFile,
  readRuntimeConfig,
  asBoolean,
  asInteger,
  resolveDwsBin,
  normalizeGrayStage
};
