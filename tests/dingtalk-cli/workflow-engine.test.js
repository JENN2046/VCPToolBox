const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { WorkflowEngine } = require('../../Plugin/DingTalkCLI/workflows/workflow-engine');

function createEngine(baseDir, calls, failStepId = null) {
  return new WorkflowEngine({
    stateDir: path.join(baseDir, 'workflow-state'),
    auditLogger: null,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    executeTool: async (req, ctx) => {
      calls.push({ req, ctx });
      if (failStepId && ctx.stepId === failStepId) {
        return {
          status: 'error',
          error: {
            category: 'upstream',
            reason: 'forced failure',
            hint: 'retry',
            actions: ['retry']
          }
        };
      }
      return {
        status: 'success',
        result: {
          output: {
            id: `${ctx.stepId}-id`,
            content: `${ctx.stepId}-content`
          }
        }
      };
    }
  });
}

test('workflow engine should execute all steps and persist checkpoint', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-workflow-test-'));
  const calls = [];

  try {
    const engine = createEngine(dir, calls);
    const result = await engine.runWorkflow(
      {
        workflow: 'meeting_automation',
        apply: false,
        input: {
          user_id: 'u1',
          date: '2026-04-13',
          duration_minutes: 30,
          title: 'sync',
          start_time: '2026-04-14T10:00:00+08:00',
          end_time: '2026-04-14T10:30:00+08:00',
          attendees: ['u2'],
          todo_title: 'follow up',
          owner_id: 'u1',
          todo_due_time: '2026-04-15T12:00:00+08:00',
          report_summary: 'done'
        }
      },
      { requestId: 'r1' }
    );

    assert.equal(result.status, 'success');
    assert.equal(calls.length, 4);
    assert.equal(calls[0].req.dry_run, false);
    assert.equal(calls[1].req.dry_run, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('workflow engine should stop at failed step and return checkpoint', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dws-workflow-test-'));
  const calls = [];

  try {
    const engine = createEngine(dir, calls, 'send_ding_notice');
    const result = await engine.runWorkflow(
      {
        workflow: 'customer_followup',
        apply: true,
        input: {
          table_uuid: 'tbl',
          filter: 'status=open',
          owner_keyword: 'alice',
          ding_content: 'ping',
          ding_priority: 'high',
          followup_title: 'next',
          followup_due_time: '2026-04-16T10:00:00+08:00'
        }
      },
      { requestId: 'r2' }
    );

    assert.equal(result.status, 'error');
    assert.equal(result.result.failed_step, 'send_ding_notice');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});