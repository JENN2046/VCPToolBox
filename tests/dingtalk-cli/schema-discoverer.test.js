const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { SchemaDiscoverer } = require('../../Plugin/DingTalkCLI/lib/schema-discoverer');

function createExecutor(outputs) {
  let idx = 0;
  return {
    async runCommand() {
      const item = outputs[idx] || outputs[outputs.length - 1];
      idx += 1;
      return item;
    }
  };
}

test('schema discoverer should fetch from origin and cache results', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-schema-test-'));
  try {
    const discoverer = new SchemaDiscoverer({
      executor: createExecutor([
        {
          code: 0,
          stdout: JSON.stringify({
            tools: [{ product: 'todo', tool: 'list_completed' }]
          }),
          stderr: ''
        }
      ]),
      logger: { warn() {}, debug() {} },
      auditLogger: null,
      cachePath: path.join(dir, 'schema-cache.json'),
      cacheTtlMs: 60_000
    });

    const first = await discoverer.listSchema({ forceRefresh: true });
    assert.equal(first.status, 'success');
    assert.equal(first.result.schema.tools.length, 1);

    const second = await discoverer.listSchema({ forceRefresh: false });
    assert.equal(second.status, 'success');
    assert.equal(second.result.source, 'cache');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('schema discoverer should return stale cache when refresh fails', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-schema-test-'));
  try {
    const cachePath = path.join(dir, 'schema-cache.json');
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        updatedAt: new Date(Date.now() - 3600_000).toISOString(),
        schema: {
          tools: [{ product: 'calendar', tool: 'list_slots' }],
          products: { calendar: [{ product: 'calendar', tool: 'list_slots' }] }
        }
      }),
      'utf8'
    );

    const discoverer = new SchemaDiscoverer({
      executor: createExecutor([{ code: 1, stdout: '', stderr: 'failed' }]),
      logger: { warn() {}, debug() {} },
      auditLogger: null,
      cachePath,
      cacheTtlMs: 1
    });

    const result = await discoverer.listSchema({ forceRefresh: true });
    assert.equal(result.status, 'success');
    assert.equal(result.result.source, 'stale-cache');
    assert.equal(result.result.degraded, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});