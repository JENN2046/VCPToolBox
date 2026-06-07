'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');

const {
  readOneRingAdminConfig,
  validateOneRingAdminConfigPayload,
  writeOneRingAdminConfig,
} = require('../modules/oneringAdminConfig');

const createFinalContextRouter = require('../routes/admin/finalContext');

async function createTempProjectRoot() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'onering-admin-config-'));
  const pluginDir = path.join(projectRoot, 'Plugin', 'OneRing');
  await fs.mkdir(pluginDir, { recursive: true });
  return { projectRoot, pluginDir, configPath: path.join(pluginDir, 'OneRingConfig.json') };
}

async function withFinalContextApp(projectRoot, callback) {
  const app = express();
  app.use(express.json());
  app.use(createFinalContextRouter({ projectBasePath: projectRoot }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

test('readOneRingAdminConfig returns defaults without creating config', async () => {
  const { projectRoot, configPath } = await createTempProjectRoot();

  const result = await readOneRingAdminConfig({ projectRoot });

  assert.equal(result.exists, false);
  assert.equal(result.error, null);
  assert.equal(result.path, 'Plugin/OneRing/OneRingConfig.json');
  assert.deepEqual(result.config, {
    enabled: false,
    tailTagPlacement: 'inline',
    maxContextBlocks: 10,
    timeInsert: false,
  });
  await assert.rejects(fs.stat(configPath), { code: 'ENOENT' });
});

test('writeOneRingAdminConfig writes only normalized supported fields', async () => {
  const { projectRoot, configPath, pluginDir } = await createTempProjectRoot();

  const result = await writeOneRingAdminConfig({
    projectRoot,
    config: {
      enabled: 'on',
      tailTagPlacement: 'user-block',
      maxContextBlocks: '24',
      timeInsert: 1,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.path, 'Plugin/OneRing/OneRingConfig.json');
  assert.deepEqual(result.config, {
    enabled: true,
    tailTagPlacement: 'system_user_block',
    maxContextBlocks: 24,
    timeInsert: true,
  });

  const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(saved, result.config);
  const leftovers = await fs.readdir(pluginDir);
  assert.deepEqual(leftovers, ['OneRingConfig.json']);
});

test('writeOneRingAdminConfig rejects unknown and empty payloads without writing', async () => {
  const { projectRoot, configPath } = await createTempProjectRoot();

  await assert.rejects(
    writeOneRingAdminConfig({ projectRoot, config: { enbaled: true } }),
    (error) => {
      assert.equal(error.code, 'INVALID_ONERING_CONFIG');
      assert.deepEqual(error.details, ['unknown config keys: enbaled']);
      return true;
    },
  );
  await assert.rejects(
    writeOneRingAdminConfig({ projectRoot, config: {} }),
    (error) => {
      assert.equal(error.code, 'INVALID_ONERING_CONFIG');
      assert.deepEqual(error.details, ['config must include at least one supported field']);
      return true;
    },
  );
  await assert.rejects(fs.stat(configPath), { code: 'ENOENT' });
});

test('writeOneRingAdminConfig rejects missing plugin directories', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'onering-admin-config-missing-'));

  await assert.rejects(
    writeOneRingAdminConfig({ projectRoot, config: { enabled: true } }),
    { code: 'MISSING_ONERING_PLUGIN_DIR' },
  );
});

test('readOneRingAdminConfig reports invalid JSON with safe defaults', async () => {
  const { projectRoot, configPath } = await createTempProjectRoot();
  await fs.writeFile(configPath, '{bad json', 'utf8');

  const result = await readOneRingAdminConfig({ projectRoot });

  assert.equal(result.exists, false);
  assert.equal(result.error, 'invalid-json');
  assert.deepEqual(result.config, {
    enabled: false,
    tailTagPlacement: 'inline',
    maxContextBlocks: 10,
    timeInsert: false,
  });
});

test('validateOneRingAdminConfigPayload rejects non-object payloads', () => {
  assert.deepEqual(validateOneRingAdminConfigPayload(null), {
    valid: false,
    errors: ['config must be an object'],
  });
  assert.deepEqual(validateOneRingAdminConfigPayload([]), {
    valid: false,
    errors: ['config must be an object'],
  });
});

test('OneRing admin config route reads defaults and writes nested config payloads', async () => {
  const { projectRoot, configPath } = await createTempProjectRoot();

  await withFinalContextApp(projectRoot, async (baseUrl) => {
    const getResponse = await fetch(`${baseUrl}/onering-config`);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(await getResponse.json(), {
      config: {
        enabled: false,
        tailTagPlacement: 'inline',
        maxContextBlocks: 10,
        timeInsert: false,
      },
      exists: false,
      path: 'Plugin/OneRing/OneRingConfig.json',
      error: null,
    });

    const putResponse = await fetch(`${baseUrl}/onering-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          enabled: true,
          tailTagPlacement: 'system-user-block',
          maxContextBlocks: 3,
          timeInsert: 'yes',
        },
      }),
    });
    assert.equal(putResponse.status, 200);
    const putBody = await putResponse.json();
    assert.equal(putBody.success, true);
    assert.equal(putBody.path, 'Plugin/OneRing/OneRingConfig.json');
    assert.deepEqual(putBody.config, {
      enabled: true,
      tailTagPlacement: 'system_user_block',
      maxContextBlocks: 3,
      timeInsert: true,
    });
  });

  assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')), {
    enabled: true,
    tailTagPlacement: 'system_user_block',
    maxContextBlocks: 3,
    timeInsert: true,
  });
});

test('OneRing admin config route rejects unknown keys without saving', async () => {
  const { projectRoot, configPath } = await createTempProjectRoot();

  await withFinalContextApp(projectRoot, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/onering-config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, unexpected: 'value' }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Invalid OneRing config',
      details: ['unknown config keys: unexpected'],
    });
  });

  await assert.rejects(fs.stat(configPath), { code: 'ENOENT' });
});
