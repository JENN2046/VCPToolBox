const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const pluginPath = path.join(repoRoot, 'Plugin', 'OpenHerPersona', 'OpenHerPersona.js');
const stateDir = path.join(repoRoot, 'Plugin', 'OpenHerPersona', 'state');
const stateDbPath = path.join(stateDir, 'openher-axis-state.sqlite');
const configPath = path.join(stateDir, 'openher-persona-config.json');
const legacyDbPath = path.join(stateDir, 'openher-persona-state.sqlite');
const legacyJsonPath = path.join(stateDir, 'openher-persona-state.json');
const orderPath = path.join(repoRoot, 'preprocessor_order.json');

let activePlugin = null;

function dbSidecarPaths(dbPath) {
  return [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
}

function managedStateFiles() {
  return [
    ...dbSidecarPaths(stateDbPath),
    configPath,
    `${configPath}.tmp`,
    ...dbSidecarPaths(legacyDbPath),
    legacyJsonPath,
    `${legacyJsonPath}.tmp`,
  ];
}

function backupFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

function restoreFile(filePath, content) {
  if (content === null) {
    try {
      fs.rmSync(filePath, { force: true });
    } catch (_) {
      // File may not exist.
    }
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function shutdownActivePlugin() {
  if (activePlugin && typeof activePlugin.shutdown === 'function') {
    activePlugin.shutdown();
  }
  activePlugin = null;
}

async function withIsolatedState(fn) {
  shutdownActivePlugin();
  const backups = new Map(managedStateFiles().map((filePath) => [filePath, backupFile(filePath)]));
  try {
    for (const filePath of managedStateFiles()) {
      restoreFile(filePath, null);
    }
    fs.mkdirSync(stateDir, { recursive: true });
    await fn();
  } finally {
    shutdownActivePlugin();
    for (const [filePath, content] of backups.entries()) {
      restoreFile(filePath, content);
    }
  }
}

function charFrequencyEmbedder(texts) {
  return Promise.resolve((texts || []).map((text) => {
    const vector = new Array(96).fill(0);
    for (const char of String(text || '')) {
      vector[char.codePointAt(0) % 96] += 1;
    }
    return vector;
  }));
}

function freshPlugin(config = {}, dependencies = {}) {
  shutdownActivePlugin();
  delete require.cache[require.resolve(pluginPath)];
  const plugin = require(pluginPath);
  plugin.initialize({
    OpenHerPersonaEnabled: true,
    OpenHerPersonaAsyncObservation: false,
    OpenHerPersonaEmbeddingTimeoutMs: 1000,
    DebugMode: false,
    ...config,
  }, {
    embeddingProvider: charFrequencyEmbedder,
    ...dependencies,
  });
  activePlugin = plugin;
  return plugin;
}

function openReadonlyDb() {
  if (!fs.existsSync(stateDbPath)) return null;
  return new Database(stateDbPath, { readonly: true });
}

function readAgentRow(agentKey) {
  const db = openReadonlyDb();
  if (!db) return null;
  try {
    const row = db.prepare('SELECT * FROM openher_axis_state WHERE agent_key = ?').get(agentKey);
    if (!row) return null;
    return {
      agentKey: row.agent_key,
      agentLabel: row.agent_label,
      psyGender: row.psy_gender,
      gender: JSON.parse(row.gender_json || '{}'),
      cognitive: JSON.parse(row.cognitive_json || '{}'),
      affective: JSON.parse(row.affective_json || '{}'),
      drive: JSON.parse(row.drive_json || '{}'),
      coupling: JSON.parse(row.coupling_json || '{}'),
      baseline: JSON.parse(row.baseline_json || '{}'),
      observationCount: Number(row.observation_count) || 0,
      lastObservedAt: row.last_observed_at,
      lastInputHash: row.last_input_hash,
      lastObservation: row.last_observation_json ? JSON.parse(row.last_observation_json) : null,
    };
  } finally {
    db.close();
  }
}

function readAgentKeys() {
  const db = openReadonlyDb();
  if (!db) return [];
  try {
    return db.prepare('SELECT agent_key FROM openher_axis_state ORDER BY agent_key ASC').all()
      .map((row) => row.agent_key);
  } finally {
    db.close();
  }
}

function readAuditRows(agentKey) {
  const db = openReadonlyDb();
  if (!db) return [];
  try {
    return db.prepare('SELECT event_type, payload_json FROM openher_axis_audit WHERE agent_key = ? ORDER BY at ASC')
      .all(agentKey)
      .map((row) => ({ eventType: row.event_type, payload: JSON.parse(row.payload_json || '{}') }));
  } finally {
    db.close();
  }
}

async function waitFor(predicate, timeoutMs = 3000) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = predicate();
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Timed out waiting for condition. Last value: ${JSON.stringify(lastValue)}`);
}

function cloneMessages(messages) {
  return JSON.parse(JSON.stringify(messages));
}

function assertAxisSnapshot(row) {
  assert(row, 'missing agent row');
  assert(row.psyGender >= 0 && row.psyGender <= 1, 'psyGender out of range');
  assert(row.observationCount >= 0, 'observation count out of range');
  for (const layer of ['gender', 'cognitive', 'affective', 'drive']) {
    assert(row[layer] && typeof row[layer] === 'object', `missing ${layer} axis map`);
    for (const axisState of Object.values(row[layer])) {
      assert(axisState.value >= 0 && axisState.value <= 1, `${layer} value out of range`);
      assert(axisState.activation >= 0 && axisState.activation <= 1, `${layer} activation out of range`);
      assert(axisState.sharpness >= 0 && axisState.sharpness <= 1, `${layer} sharpness out of range`);
    }
  }
}

test.after(() => {
  shutdownActivePlugin();
});

test('OpenHerPersona observes synchronously without mutating prompt messages', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin();
    const messages = [
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: '今天想聊聊最近的进展。' },
    ];
    const before = cloneMessages(messages);

    const processed = await plugin.processMessages(messages);

    assert.equal(processed, messages);
    assert.deepEqual(messages, before);
    assert.doesNotMatch(processed[0].content, /persona_state_hint/);

    const row = readAgentRow('Nova');
    assertAxisSnapshot(row);
    assert.equal(row.agentLabel, 'Nova');
    assert.equal(row.observationCount, 1);
    assert(row.lastObservedAt);
    assert(row.lastInputHash);
    assert(row.lastObservation && row.lastObservation.mood, 'missing observation payload');

    const status = await plugin.processToolCall({ command: 'status', agentId: 'Nova', agentName: 'Nova' });
    assert.equal(status.status, 'success');
    assert.equal(status.mode, 'async_observer');
    assert.equal(status.promptInjection, false);
    assert.equal(status.boundaries.noPromptInjection, true);
    assert.equal(status.boundaries.observationOnly, true);
    assert.equal(status.state.observationCount, 1);
  });
});

test('OpenHerPersona resolves the latest OneRing identity and ignores older memory markers', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin();

    await plugin.processMessages([
      {
        role: 'system',
        content: [
          '记忆召回旧块：[[OneRing::MemoryGhost::VCPChat]]',
          '[[OneRing::Nova::VCPChat]]',
          '后续工具指南没有身份标记。',
        ].join('\n'),
      },
      { role: 'user', content: '验证 system 块内部最后一个 OneRing 身份。' },
    ]);

    assert.deepEqual(readAgentKeys(), ['Nova']);
    const row = readAgentRow('Nova');
    assertAxisSnapshot(row);
    assert.equal(row.observationCount, 1);
  });
});

test('OpenHerPersona keeps separate rows for explicit VCPChat agent identities', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin();

    await plugin.processMessages([
      { role: 'system', content: 'base system' },
      { role: 'user', content: 'Nova 的第一轮。' },
    ], {
      vcpchatExtensions: {
        openHerPersonaAgent: { agentId: 'nova-id', agentName: 'Nova' },
      },
    });

    await plugin.processMessages([
      { role: 'system', content: 'base system' },
      { role: 'user', content: 'Kira 的第一轮。' },
    ], {
      vcpchatExtensions: {
        openHerPersonaAgent: { agentId: 'kira-id', agentName: 'Kira' },
      },
    });

    assert.deepEqual(readAgentKeys(), ['kira-id', 'nova-id']);
    assert.equal(readAgentRow('nova-id').agentLabel, 'Nova');
    assert.equal(readAgentRow('kira-id').agentLabel, 'Kira');

    const novaStatus = await plugin.processToolCall({ command: 'status', agentId: 'nova-id', agentName: 'Nova' });
    assert.equal(novaStatus.state.agentKey, 'nova-id');
    assert.equal(novaStatus.state.observationCount, 1);

    await plugin.processToolCall({ command: 'reset', agentId: 'kira-id', agentName: 'Kira' });
    assert.equal(readAgentRow('kira-id').observationCount, 0);
    assert.equal(readAgentRow('nova-id').observationCount, 1);
  });
});

test('OpenHerPersona skips VCP pseudo user notices when finding the latest real message', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin();

    await plugin.processMessages([
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: '真人用户消息。' },
    ]);
    const afterRealUser = readAgentRow('Nova');

    await plugin.processMessages([
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: '真人用户消息。' },
      { role: 'user', content: '[系统提示:][OneRing通知:上一条消息由Nova于2026-06-10 12:00:00发送于VCPChat]' },
    ]);
    const afterPseudoUser = readAgentRow('Nova');

    assert.equal(afterPseudoUser.observationCount, afterRealUser.observationCount);
    assert.equal(afterPseudoUser.lastInputHash, afterRealUser.lastInputHash);
  });
});

test('OpenHerPersona async queue eventually persists observation without mutating messages', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin({ OpenHerPersonaAsyncObservation: true });
    const messages = [
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: '异步观察也不能改写 prompt。' },
    ];
    const before = cloneMessages(messages);

    const processed = await plugin.processMessages(messages);
    assert.equal(processed, messages);
    assert.deepEqual(messages, before);

    const row = await waitFor(() => {
      const current = readAgentRow('Nova');
      return current && current.observationCount >= 1 ? current : null;
    });
    assertAxisSnapshot(row);
    assert.equal(row.observationCount, 1);
  });
});

test('OpenHerPersona disabled mode is a no-op and does not create state rows', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin({ OpenHerPersonaEnabled: false });
    const messages = [
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: 'disabled smoke' },
    ];

    const processed = await plugin.processMessages(messages);

    assert.equal(processed, messages);
    assert.deepEqual(readAgentKeys(), []);
  });
});

test('OpenHerPersona status, tick, and explain describe observer-only boundaries', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin();

    await plugin.processToolCall({ command: 'reset', agentId: 'nova-id', agentName: 'Nova' });

    const status = await plugin.processToolCall({ command: 'status', agentId: 'nova-id', agentName: 'Nova' });
    assert.equal(status.status, 'success');
    assert.equal(status.plugin, 'OpenHerPersona');
    assert.equal(status.promptInjection, false);
    assert.equal(status.timeMetabolism, false);
    assert.equal(status.keywordHeuristic, false);
    assert.equal(status.database.schema, 'openher_axis_*');
    assert.equal(status.state.agentKey, 'nova-id');
    assert.equal(status.state.observationCount, 0);

    const tick = await plugin.processToolCall({ command: 'tick', agentId: 'nova-id', agentName: 'Nova' });
    assert.equal(tick.status, 'success');
    assert.equal(tick.skipped, true);
    assert.match(tick.reason, /pure async observer mode/);

    const explanation = await plugin.processToolCall({ command: 'explain' });
    assert.equal(explanation.status, 'success');
    assert.match(explanation.summary, /pure async observation/);
    assert(explanation.removed.includes('persona_state_hint injection'));
  });
});

test('OpenHerPersona records failed async observations as audit without changing prompt messages', async () => {
  await withIsolatedState(async () => {
    const plugin = freshPlugin(
      { OpenHerPersonaAsyncObservation: true },
      { embeddingProvider: () => Promise.reject(new Error('embedding service down')) }
    );
    const messages = [
      { role: 'system', content: '[[OneRing::Nova::VCPChat]]\nbase system' },
      { role: 'user', content: '嵌入服务失败也不能影响消息流。' },
    ];

    const processed = await plugin.processMessages(messages);
    assert.equal(processed, messages);

    const auditRows = await waitFor(() => {
      const rows = readAuditRows('Nova');
      return rows.some((row) => row.eventType === 'observe_error') ? rows : null;
    });
    assert(auditRows.some((row) => row.payload.error === 'embedding service down'));
    assert.equal(readAgentRow('Nova').observationCount, 0);
  });
});

test('memory and identity preprocessors preserve their required relative order', () => {
  const document = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
  assert.equal(document.version, 2);
  assert.equal(document.strict, true);
  const order = document.order;
  const ragIndex = order.indexOf('RAGDiaryPlugin');
  const timelineIndex = order.indexOf('VCPTimeLine');
  const openHerIndex = order.indexOf('OpenHerPersona');
  const oneRingIndex = order.indexOf('OneRing');
  const contextFoldingIndex = order.indexOf('ContextFoldingV2');

  assert(ragIndex >= 0, 'RAGDiaryPlugin must be present');
  assert(timelineIndex > ragIndex, 'VCPTimeLine must run after RAGDiaryPlugin');
  assert(openHerIndex > timelineIndex, 'OpenHerPersona must run after VCPTimeLine');
  assert(oneRingIndex > openHerIndex, 'OneRing must run after OpenHerPersona');
  assert(contextFoldingIndex > oneRingIndex, 'ContextFoldingV2 must run after OneRing');
});
