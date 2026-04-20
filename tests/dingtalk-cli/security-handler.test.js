const test = require('node:test');
const assert = require('node:assert/strict');

const { SecurityHandler } = require('../../Plugin/DingTalkCLI/lib/security-handler');

function createHandler(overrides = {}) {
  return new SecurityHandler({
    trustedDomains: overrides.trustedDomains || [],
    maxArgBytes: overrides.maxArgBytes || 8192,
    batchLimit: overrides.batchLimit || 5,
    grayStage: overrides.grayStage || 'full_write'
  });
}

test('security handler should default write operation to dry-run', () => {
  const handler = createHandler();
  const result = handler.validateExecuteInput({
    product: 'todo',
    tool: 'task_create',
    args: { title: 'x' }
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.write, true);
  assert.equal(result.value.dryRun, true);
});

test('security handler should force dry-run false when apply=true', () => {
  const handler = createHandler();
  const result = handler.validateExecuteInput({
    product: 'todo',
    tool: 'task_create',
    args: { title: 'x' },
    apply: true,
    dry_run: true
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.dryRun, false);
});

test('security handler should allow read operation without dry-run', () => {
  const handler = createHandler();
  const result = handler.validateExecuteInput({
    product: 'todo',
    tool: 'list_completed',
    args: { user_id: 'u1' }
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.write, false);
  assert.equal(result.value.dryRun, false);
});

test('security handler should block untrusted domains', () => {
  const handler = createHandler({ trustedDomains: ['example.com'] });
  const result = handler.validateExecuteInput({
    product: 'chat',
    tool: 'bot_send',
    args: { callback_url: 'https://evil.test/hook' }
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /not trusted/);
});

test('security handler should block oversized batch payloads', () => {
  const handler = createHandler({ batchLimit: 2 });
  const result = handler.validateExecuteInput({
    product: 'aitable',
    tool: 'record_batch_create',
    args: { rows: [1, 2, 3] }
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /exceeds limit/);
});

test('security handler should block write operations in query_only gray stage', () => {
  const handler = createHandler({ grayStage: 'query_only' });
  const gate = handler.validateReleaseGate({
    product: 'todo',
    tool: 'task create',
    write: true
  });

  assert.equal(gate.ok, false);
  assert.match(gate.reason, /query_only/);
});

test('security handler should allow low-risk writes in low_risk_write gray stage', () => {
  const handler = createHandler({ grayStage: 'low_risk_write' });
  const allowed = handler.validateReleaseGate({
    product: 'chat',
    tool: 'message send-by-bot',
    write: true
  });
  const blocked = handler.validateReleaseGate({
    product: 'aitable',
    tool: 'record create',
    write: true
  });

  assert.equal(allowed.ok, true);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /blocked for product aitable/);
});
