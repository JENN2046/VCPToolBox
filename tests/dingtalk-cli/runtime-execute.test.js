const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { DingTalkCLIRuntime } = require('../../Plugin/DingTalkCLI/lib/runtime');

function createMockExecutor(calls) {
  return {
    async runCommand(args) {
      calls.push(args);
      return {
        code: 0,
        stdout: JSON.stringify({ ok: true, args }),
        stderr: '',
        durationMs: 12
      };
    },
    async checkHealth() {
      return { ok: true, version: '1.0.8', requiredVersion: '1.0.8' };
    }
  };
}

function createSchemaDiscoverer() {
  return {
    async getSchemaTool() {
      return {
        status: 'success',
        result: {
          schema: {
            required: []
          }
        }
      };
    },
    async listSchema() {
      return {
        status: 'success',
        result: {
          source: 'cache',
          schema: { tools: [], products: {} },
          degraded: false
        }
      };
    }
  };
}

test('runtime execute_tool should honor dry-run and apply rules', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-runtime-test-'));
  const calls = [];
  try {
    const runtime = new DingTalkCLIRuntime({
      config: {
        projectBasePath: tempDir,
        pluginBasePath: path.join(tempDir, 'Plugin', 'DingTalkCLI'),
        dwsBin: 'dws',
        dwsMinVersion: '1.0.8',
        authMode: 'auto',
        grayStage: 'full_write',
        dwsClientId: '',
        dwsClientSecret: '',
        trustedDomains: [],
        timeoutMs: 30000,
        schemaCacheTtlMs: 30000,
        maxArgBytes: 1024 * 8,
        batchLimit: 100,
        debug: false,
        auditLogPath: path.join(tempDir, 'audit.jsonl'),
        cachePath: path.join(tempDir, 'schema-cache.json'),
        workflowStateDir: path.join(tempDir, 'wf')
      },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      executor: createMockExecutor(calls),
      schemaDiscoverer: createSchemaDiscoverer()
    });

    const writeDefault = await runtime.handleRequest({
      action: 'execute_tool',
      product: 'todo',
      tool: 'task_create',
      args: { title: 'abc' }
    });

    assert.equal(writeDefault.status, 'success');
    assert.ok(calls[0].includes('--dry-run'));

    const writeApply = await runtime.handleRequest({
      action: 'execute_tool',
      product: 'todo',
      tool: 'task_create',
      args: { title: 'abc' },
      apply: true
    });

    assert.equal(writeApply.status, 'success');
    assert.equal(calls[1].includes('--dry-run'), false);

    const readDefault = await runtime.handleRequest({
      action: 'execute_tool',
      product: 'todo',
      tool: 'list_completed',
      args: { user_id: 'u1' }
    });

    assert.equal(readDefault.status, 'success');
    assert.equal(calls[2].includes('--dry-run'), false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('runtime should expose fixed actions and unknown action should fail', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-runtime-test-'));
  try {
    const runtime = new DingTalkCLIRuntime({
      config: {
        projectBasePath: tempDir,
        pluginBasePath: path.join(tempDir, 'Plugin', 'DingTalkCLI'),
        dwsBin: 'dws',
        dwsMinVersion: '1.0.8',
        authMode: 'auto',
        grayStage: 'full_write',
        dwsClientId: '',
        dwsClientSecret: '',
        trustedDomains: [],
        timeoutMs: 30000,
        schemaCacheTtlMs: 30000,
        maxArgBytes: 1024 * 8,
        batchLimit: 100,
        debug: false,
        auditLogPath: path.join(tempDir, 'audit.jsonl'),
        cachePath: path.join(tempDir, 'schema-cache.json'),
        workflowStateDir: path.join(tempDir, 'wf')
      },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      executor: createMockExecutor([]),
      schemaDiscoverer: createSchemaDiscoverer()
    });

    const response = await runtime.handleRequest({ action: 'unknown_action' });
    assert.equal(response.status, 'error');
    assert.equal(response.error.category, 'validation');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('runtime execute_tool should block writes in query_only gray stage', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-runtime-test-'));
  const calls = [];
  try {
    const runtime = new DingTalkCLIRuntime({
      config: {
        projectBasePath: tempDir,
        pluginBasePath: path.join(tempDir, 'Plugin', 'DingTalkCLI'),
        dwsBin: 'dws',
        dwsMinVersion: '1.0.8',
        authMode: 'auto',
        grayStage: 'query_only',
        dwsClientId: '',
        dwsClientSecret: '',
        trustedDomains: [],
        timeoutMs: 30000,
        schemaCacheTtlMs: 30000,
        maxArgBytes: 1024 * 8,
        batchLimit: 100,
        debug: false,
        auditLogPath: path.join(tempDir, 'audit.jsonl'),
        cachePath: path.join(tempDir, 'schema-cache.json'),
        workflowStateDir: path.join(tempDir, 'wf')
      },
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      executor: createMockExecutor(calls),
      schemaDiscoverer: createSchemaDiscoverer()
    });

    const response = await runtime.handleRequest({
      action: 'execute_tool',
      product: 'todo',
      tool: 'task create',
      args: { title: 'abc' },
      apply: true
    });

    assert.equal(response.status, 'error');
    assert.equal(response.error.category, 'security');
    assert.equal(calls.length, 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
