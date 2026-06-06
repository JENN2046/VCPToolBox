'use strict';

const fs = require('fs');

const DEFAULT_ONERING_HOT_CONFIG = Object.freeze({
  enabled: false,
  tailTagPlacement: 'inline',
  maxContextBlocks: 10,
  timeInsert: false,
});

const TAIL_TAG_PLACEMENT_INLINE = 'inline';
const TAIL_TAG_PLACEMENT_SYSTEM_USER_BLOCK = 'system_user_block';
const VALID_TAIL_TAG_PLACEMENTS = new Set([
  TAIL_TAG_PLACEMENT_INLINE,
  TAIL_TAG_PLACEMENT_SYSTEM_USER_BLOCK,
]);

function normalizeOneRingHotConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};

  return {
    enabled: normalizeBoolean(source.enabled, DEFAULT_ONERING_HOT_CONFIG.enabled),
    tailTagPlacement: normalizeTailTagPlacement(source.tailTagPlacement),
    maxContextBlocks: normalizePositiveInteger(
      source.maxContextBlocks,
      DEFAULT_ONERING_HOT_CONFIG.maxContextBlocks,
    ),
    timeInsert: normalizeBoolean(source.timeInsert, DEFAULT_ONERING_HOT_CONFIG.timeInsert),
  };
}

function normalizeTailTagPlacement(value) {
  const normalized = String(value || DEFAULT_ONERING_HOT_CONFIG.tailTagPlacement).trim().toLowerCase();

  if (['system-user-block', 'user_block', 'user-block', 'pseudo_system_user'].includes(normalized)) {
    return TAIL_TAG_PLACEMENT_SYSTEM_USER_BLOCK;
  }

  return VALID_TAIL_TAG_PLACEMENTS.has(normalized)
    ? normalized
    : DEFAULT_ONERING_HOT_CONFIG.tailTagPlacement;
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

function normalizePositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function readOneRingHotConfigFile(configPath, options = {}) {
  if (!configPath || typeof configPath !== 'string') {
    return {
      config: normalizeOneRingHotConfig(options.defaults),
      exists: false,
      path: configPath || null,
      error: 'missing-config-path',
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);

    return {
      config: normalizeOneRingHotConfig({
        ...options.defaults,
        ...parsed,
      }),
      exists: true,
      path: configPath,
      raw: parsed,
      error: null,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        config: normalizeOneRingHotConfig(options.defaults),
        exists: false,
        path: configPath,
        error: null,
      };
    }

    return {
      config: normalizeOneRingHotConfig(options.defaults),
      exists: false,
      path: configPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

module.exports = {
  DEFAULT_ONERING_HOT_CONFIG,
  TAIL_TAG_PLACEMENT_INLINE,
  TAIL_TAG_PLACEMENT_SYSTEM_USER_BLOCK,
  normalizeOneRingHotConfig,
  normalizeTailTagPlacement,
  readOneRingHotConfigFile,
};
