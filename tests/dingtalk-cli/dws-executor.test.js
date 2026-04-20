const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { DingTalkExecutor } = require('../../Plugin/DingTalkCLI/lib/dingtalk-executor');

function createMockSpawn(responses) {
  let index = 0;
  return (_cmd, _args) => {
    const response = responses[index] || responses[responses.length - 1];
    index += 1;

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.stderr.setEncoding = () => {};
    child.kill = () => {};

    process.nextTick(() => {
      if (response.stdout) {
        child.stdout.emit('data', response.stdout);
      }
      if (response.stderr) {
        child.stderr.emit('data', response.stderr);
      }
      child.emit('close', response.code ?? 0, null);
    });

    return child;
  };
}

test('DingTalkExecutor should collect stdout and stderr', async () => {
  const executor = new DingTalkExecutor({
    dwsBin: 'dws',
    dwsMinVersion: '1.0.8',
    timeoutMs: 3000,
    logger: null,
    auditLogger: null,
    cwd: process.cwd(),
    env: process.env,
    spawnFn: createMockSpawn([{ code: 0, stdout: '{"ok":true}', stderr: 'warn' }])
  });

  const result = await executor.runCommand(['schema', 'list']);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '{"ok":true}');
  assert.equal(result.stderr, 'warn');
});

test('DingTalkExecutor checkHealth should validate minimal version', async () => {
  const executor = new DingTalkExecutor({
    dwsBin: 'dws',
    dwsMinVersion: '1.0.8',
    timeoutMs: 3000,
    logger: null,
    auditLogger: null,
    cwd: process.cwd(),
    env: process.env,
    spawnFn: createMockSpawn([{ code: 0, stdout: 'dws version 1.0.9' }])
  });

  const health = await executor.checkHealth();
  assert.equal(health.ok, true);
  assert.equal(health.version, '1.0.9');
});

test('DingTalkExecutor checkHealth should reject low version', async () => {
  const executor = new DingTalkExecutor({
    dwsBin: 'dws',
    dwsMinVersion: '1.0.8',
    timeoutMs: 3000,
    logger: null,
    auditLogger: null,
    cwd: process.cwd(),
    env: process.env,
    spawnFn: createMockSpawn([{ code: 0, stdout: 'dws version 1.0.6' }])
  });

  const health = await executor.checkHealth();
  assert.equal(health.ok, false);
  assert.match(health.reason, /too low/);
});