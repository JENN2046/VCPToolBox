'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_ONERING_HOT_CONFIG,
  normalizeOneRingHotConfig,
  normalizeTailTagPlacement,
  readOneRingHotConfigFile,
} = require('../modules/oneringHotConfig');

test('normalizeOneRingHotConfig returns conservative defaults for empty input', () => {
  assert.deepEqual(normalizeOneRingHotConfig(), {
    enabled: false,
    tailTagPlacement: 'inline',
    maxContextBlocks: 10,
    timeInsert: false,
  });

  assert.deepEqual(normalizeOneRingHotConfig(null), DEFAULT_ONERING_HOT_CONFIG);
});

test('normalizeOneRingHotConfig accepts explicit supported values', () => {
  assert.deepEqual(
    normalizeOneRingHotConfig({
      enabled: 'on',
      tailTagPlacement: 'system-user-block',
      maxContextBlocks: '24',
      timeInsert: 1,
    }),
    {
      enabled: true,
      tailTagPlacement: 'system_user_block',
      maxContextBlocks: 24,
      timeInsert: true,
    },
  );
});

test('normalizeOneRingHotConfig falls back safely for invalid values', () => {
  assert.deepEqual(
    normalizeOneRingHotConfig({
      enabled: 'maybe',
      tailTagPlacement: 'unknown',
      maxContextBlocks: 0,
      timeInsert: 'later',
    }),
    DEFAULT_ONERING_HOT_CONFIG,
  );
});

test('normalizeTailTagPlacement accepts upstream aliases', () => {
  assert.equal(normalizeTailTagPlacement('system_user_block'), 'system_user_block');
  assert.equal(normalizeTailTagPlacement('user_block'), 'system_user_block');
  assert.equal(normalizeTailTagPlacement('pseudo_system_user'), 'system_user_block');
  assert.equal(normalizeTailTagPlacement('INLINE'), 'inline');
  assert.equal(normalizeTailTagPlacement('bad'), 'inline');
});

test('readOneRingHotConfigFile returns defaults for missing paths without creating files', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onering-hot-config-missing-'));
  const configPath = path.join(tempDir, 'OneRingConfig.json');

  const result = readOneRingHotConfigFile(configPath);

  assert.equal(result.exists, false);
  assert.equal(result.error, null);
  assert.deepEqual(result.config, DEFAULT_ONERING_HOT_CONFIG);
  await assert.rejects(fs.stat(configPath), { code: 'ENOENT' });
});

test('readOneRingHotConfigFile normalizes valid JSON from temp path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onering-hot-config-valid-'));
  const configPath = path.join(tempDir, 'OneRingConfig.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      enabled: true,
      tailTagPlacement: 'user-block',
      maxContextBlocks: 6,
      timeInsert: 'yes',
      ignored: 'value',
    }),
    'utf8',
  );

  const result = readOneRingHotConfigFile(configPath);

  assert.equal(result.exists, true);
  assert.equal(result.error, null);
  assert.deepEqual(result.config, {
    enabled: true,
    tailTagPlacement: 'system_user_block',
    maxContextBlocks: 6,
    timeInsert: true,
  });
  assert.equal(result.raw.ignored, 'value');
});

test('readOneRingHotConfigFile reports invalid JSON and keeps safe defaults', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'onering-hot-config-invalid-'));
  const configPath = path.join(tempDir, 'OneRingConfig.json');
  await fs.writeFile(configPath, '{bad json', 'utf8');

  const result = readOneRingHotConfigFile(configPath);

  assert.equal(result.exists, false);
  assert.match(result.error, /JSON|Expected|property/i);
  assert.deepEqual(result.config, DEFAULT_ONERING_HOT_CONFIG);
});
