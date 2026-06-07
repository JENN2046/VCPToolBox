'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
  DEFAULT_ONERING_HOT_CONFIG,
  normalizeOneRingHotConfig,
} = require('./oneringHotConfig');

const ONERING_CONFIG_RELATIVE_PATH = path.join('Plugin', 'OneRing', 'OneRingConfig.json');
const SUPPORTED_ONERING_CONFIG_KEYS = new Set([
  'enabled',
  'tailTagPlacement',
  'maxContextBlocks',
  'timeInsert',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveOneRingAdminConfigPath(projectRoot) {
  const root = path.resolve(projectRoot || path.join(__dirname, '..'));
  const pluginDir = path.resolve(root, 'Plugin', 'OneRing');
  const configPath = path.resolve(pluginDir, 'OneRingConfig.json');
  const relativeToRoot = path.relative(root, configPath);
  const relativeToPluginDir = path.relative(pluginDir, configPath);

  if (
    relativeToRoot.startsWith('..') ||
    path.isAbsolute(relativeToRoot) ||
    relativeToPluginDir.startsWith('..') ||
    path.isAbsolute(relativeToPluginDir) ||
    path.basename(configPath) !== 'OneRingConfig.json'
  ) {
    throw new Error('invalid-onering-config-path');
  }

  return {
    projectRoot: root,
    pluginDir,
    configPath,
    relativePath: ONERING_CONFIG_RELATIVE_PATH.replace(/\\/g, '/'),
  };
}

function validateOneRingAdminConfigPayload(config) {
  if (!isPlainObject(config)) {
    return {
      valid: false,
      errors: ['config must be an object'],
    };
  }

  const keys = Object.keys(config);
  const unknownKeys = keys.filter((key) => !SUPPORTED_ONERING_CONFIG_KEYS.has(key));
  const errors = [];

  if (unknownKeys.length > 0) {
    errors.push(`unknown config keys: ${unknownKeys.join(', ')}`);
  }
  if (keys.length === 0) {
    errors.push('config must include at least one supported field');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function readOneRingAdminConfig(options = {}) {
  const paths = resolveOneRingAdminConfigPath(options.projectRoot);

  try {
    const content = await fs.readFile(paths.configPath, 'utf8');
    const parsed = JSON.parse(content);

    return {
      config: normalizeOneRingHotConfig({
        ...DEFAULT_ONERING_HOT_CONFIG,
        ...parsed,
      }),
      exists: true,
      path: paths.relativePath,
      error: null,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        config: normalizeOneRingHotConfig(DEFAULT_ONERING_HOT_CONFIG),
        exists: false,
        path: paths.relativePath,
        error: null,
      };
    }

    return {
      config: normalizeOneRingHotConfig(DEFAULT_ONERING_HOT_CONFIG),
      exists: false,
      path: paths.relativePath,
      error: error instanceof SyntaxError ? 'invalid-json' : 'read-error',
    };
  }
}

async function writeOneRingAdminConfig(options = {}) {
  const validation = validateOneRingAdminConfigPayload(options.config);
  if (!validation.valid) {
    const error = new Error('invalid-onering-config');
    error.code = 'INVALID_ONERING_CONFIG';
    error.details = validation.errors;
    throw error;
  }

  const paths = resolveOneRingAdminConfigPath(options.projectRoot);
  const normalizedConfig = normalizeOneRingHotConfig({
    ...DEFAULT_ONERING_HOT_CONFIG,
    ...options.config,
  });
  const tempPath = path.join(
    paths.pluginDir,
    `.OneRingConfig.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`,
  );
  const content = `${JSON.stringify(normalizedConfig, null, 2)}\n`;

  try {
    const pluginDirStat = await fs.stat(paths.pluginDir);
    if (!pluginDirStat.isDirectory()) {
      const error = new Error('missing-onering-plugin-dir');
      error.code = 'MISSING_ONERING_PLUGIN_DIR';
      throw error;
    }
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const missingError = new Error('missing-onering-plugin-dir');
      missingError.code = 'MISSING_ONERING_PLUGIN_DIR';
      throw missingError;
    }
    throw error;
  }

  try {
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, paths.configPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }

  return {
    success: true,
    config: normalizedConfig,
    exists: true,
    path: paths.relativePath,
  };
}

function getRequestOneRingAdminConfig(body) {
  return isPlainObject(body?.config) ? body.config : body;
}

module.exports = {
  ONERING_CONFIG_RELATIVE_PATH,
  SUPPORTED_ONERING_CONFIG_KEYS,
  getRequestOneRingAdminConfig,
  readOneRingAdminConfig,
  resolveOneRingAdminConfigPath,
  validateOneRingAdminConfigPayload,
  writeOneRingAdminConfig,
};
