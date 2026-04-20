'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { SecurityHandler } = require('../../Plugin/DingTalkCLI/lib/security-handler');
const { SchemaDiscoverer } = require('../../Plugin/DingTalkCLI/lib/schema-discoverer');
const { WorkflowEngine } = require('../../Plugin/DingTalkCLI/workflows/workflow-engine');
const { DingTalkCLIRuntime } = require('../../Plugin/DingTalkCLI/lib/runtime');

async function runSecurityChecks() {
  const handler = new SecurityHandler({
    trustedDomains: [],
    maxArgBytes: 8192,
    batchLimit: 4
  });

  const write = handler.validateExecuteInput({
    product: 'todo',
    tool: 'task_create',
    args: { title: 'a' }
  });
  assert.equal(write.ok, true);
  assert.equal(write.value.dryRun, true);

  const read = handler.validateExecuteInput({
    product: 'todo',
    tool: 'list_completed',
    args: { user_id: 'u1' }
  });
  assert.equal(read.ok, true);
  assert.equal(read.value.dryRun, false);
}

async function runSchemaChecks(tempDir) {
  const discoverer = new SchemaDiscoverer({
    executor: {
      async runCommand() {
        return {
          code: 0,
          stdout: JSON.stringify({ tools: [{ product: 'todo', tool: 'list_completed' }] }),
          stderr: ''
        };
      }
    },
    logger: { warn() {}, debug() {} },
    auditLogger: null,
    cachePath: path.join(tempDir, 'schema-cache.json'),
    cacheTtlMs: 60000
  });

  const result = await discoverer.listSchema({ forceRefresh: true });
  assert.equal(result.status, 'success');
  assert.equal(result.result.schema.tools.length, 1);
}

async function runWorkflowChecks(tempDir) {
  const calls = [];
  const engine = new WorkflowEngine({
    stateDir: path.join(tempDir, 'wf'),
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    auditLogger: null,
    executeTool: async (req) => {
      calls.push(req);
      return {
        status: 'success',
        result: {
          output: {
            id: 'x',
            content: 'ok'
          }
        }
      };
    }
  });

  const result = await engine.runWorkflow(
    {
      workflow: 'daily_report_generation',
      apply: false,
      input: {
        user_id: 'u1',
        date: '2026-04-13',
        robot_id: 'r1'
      }
    },
    { requestId: 'smoke-1' }
  );

  assert.equal(result.status, 'success');
  assert.equal(calls.length, 4);
}

async function runRuntimeChecks(tempDir) {
  const observed = [];
  const runtime = new DingTalkCLIRuntime({
    config: {
      projectBasePath: tempDir,
      pluginBasePath: path.join(tempDir, 'Plugin', 'DingTalkCLI'),
      dwsBin: 'dws',
      dwsMinVersion: '1.0.8',
      authMode: 'auto',
      dwsClientId: '',
      dwsClientSecret: '',
      trustedDomains: [],
      timeoutMs: 30000,
      schemaCacheTtlMs: 30000,
      maxArgBytes: 1024 * 16,
      batchLimit: 50,
      debug: false,
      auditLogPath: path.join(tempDir, 'audit.jsonl'),
      cachePath: path.join(tempDir, 'schema-cache-runtime.json'),
      workflowStateDir: path.join(tempDir, 'wf-runtime')
    },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    executor: {
      async runCommand(args) {
        observed.push(args);
        return {
          code: 0,
          stdout: JSON.stringify({ ok: true }),
          stderr: '',
          durationMs: 11
        };
      },
      async checkHealth() {
        return { ok: true, version: '1.0.8', requiredVersion: '1.0.8' };
      }
    },
    schemaDiscoverer: {
      async getSchemaTool() {
        return { status: 'success', result: { schema: { required: [] } } };
      },
      async listSchema() {
        return { status: 'success', result: { source: 'cache', schema: { tools: [], products: {} }, degraded: false } };
      }
    }
  });

  const query = await runtime.handleRequest({
    action: 'execute_tool',
    product: 'todo',
    tool: 'list_completed',
    args: { user_id: 'u1' }
  });
  assert.equal(query.status, 'success');

  const write = await runtime.handleRequest({
    action: 'execute_tool',
    product: 'todo',
    tool: 'task_create',
    args: { title: 't1' }
  });
  assert.equal(write.status, 'success');

  assert.equal(observed[0].includes('--dry-run'), false);
  assert.equal(observed[1].includes('--dry-run'), true);
}

(async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-smoke-'));
  try {
    await runSecurityChecks();
    await runSchemaChecks(tempDir);
    await runWorkflowChecks(tempDir);
    await runRuntimeChecks(tempDir);
    console.log('dingtalk-cli smoke checks: PASS');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
})();