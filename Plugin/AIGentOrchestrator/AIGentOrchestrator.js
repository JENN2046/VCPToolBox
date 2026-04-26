#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

const CONFIG = {
  allowExecution: String(process.env.AIGENT_ORCHESTRATOR_ALLOW_EXECUTION || 'false').toLowerCase() === 'true',
  defaultMode: process.env.AIGENT_ORCHESTRATOR_DEFAULT_MODE || 'dry-run'
};

const AGENTS = {
  prompt: 'AIGentPrompt',
  workflow: 'AIGentWorkflow',
  style: 'AIGentStyle',
  quality: 'AIGentQuality'
};

function readJsonFromStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('error', reject);
    process.stdin.on('end', () => {
      if (!input.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (error) {
        reject(new Error(`invalid json input: ${error.message}`));
      }
    });
  });
}

function stableId(prefix, payload) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12);
  return `${prefix}-${hash}`;
}

function inferScenario(request) {
  const text = String(`${request.scenario || ''} ${request.user_input || ''} ${request.description || ''}`).toLowerCase();
  if (/anime|character|game|二次元|角色|游戏/.test(text)) {
    return 'anime';
  }
  if (/portrait|headshot|person|人像|写真|头像/.test(text)) {
    return 'portrait';
  }
  if (/product|ecommerce|fashion|dress|电商|商品|服装|模特/.test(text)) {
    return 'ecommerce';
  }
  return 'general';
}

function buildStep({ id, agent, command, purpose, input, dependsOn = [], execution = 'planned' }) {
  return {
    id,
    agent,
    command,
    purpose,
    depends_on: dependsOn,
    execution,
    input
  };
}

function safetyBlockers(request) {
  return [
    ...(!CONFIG.allowExecution ? ['AIGENT_ORCHESTRATOR_ALLOW_EXECUTION is false'] : []),
    ...(request.execute_pipeline !== true ? ['execute_pipeline is not true'] : []),
    ...(request.confirm_external_effects === true ? [] : ['confirm_external_effects is not true'])
  ];
}

function buildAuditPlan(pipelineId, steps, request) {
  return {
    dry_run: true,
    audit_id: stableId('ai-image-audit', {
      pipeline_id: pipelineId,
      step_count: steps.length
    }),
    write_audit_log: false,
    requested_by: request.requested_by || 'unknown',
    fields_to_preserve: [
      'pipeline_id',
      'scenario',
      'steps',
      'handoff_contracts',
      'safety',
      'final_verdict',
      'operator_decision'
    ],
    redaction_rules: [
      'do not persist secrets or raw env values',
      'do not persist binary image payloads',
      'store file paths and hashes instead of image bytes'
    ]
  };
}

function buildStatePlan(steps) {
  return {
    dry_run: true,
    initial_state: 'planned',
    terminal_states: ['accepted', 'rejected', 'cancelled', 'failed'],
    step_states: steps.map((step) => ({
      step_id: step.id,
      state: 'planned',
      depends_on: step.depends_on
    }))
  };
}

function planImagePipeline(request) {
  const scenario = inferScenario(request);
  const pipelineId = stableId('ai-image-pipeline', {
    user_input: request.user_input,
    scenario,
    mode: CONFIG.defaultMode
  });
  const userInput = String(request.user_input || request.description || '').trim();
  if (!userInput) {
    throw new Error('user_input or description is required');
  }

  const steps = [
    buildStep({
      id: 'prompt.generate',
      agent: AGENTS.prompt,
      command: 'GenerateImagePrompt',
      purpose: 'Generate a model-ready prompt and negative prompt',
      input: {
        user_input: userInput,
        model_type: request.model_type || 'flux',
        quality: request.quality || 'ultra'
      }
    }),
    buildStep({
      id: 'workflow.plan',
      agent: AGENTS.workflow,
      command: 'ExecuteWorkflow',
      purpose: 'Select and parameterize a generation workflow in simulate mode',
      dependsOn: ['prompt.generate'],
      input: {
        user_input: userInput,
        scenario,
        simulate: true
      }
    }),
    buildStep({
      id: 'quality.inspect',
      agent: AGENTS.quality,
      command: 'BuildRetryPlan',
      purpose: 'Inspect generated outputs and build retry/manual-review advice',
      dependsOn: ['workflow.plan'],
      input: {
        directory: request.output_directory || '<workflow-output-directory>',
        caption: '<generated-prompt>',
        dry_run: true
      }
    })
  ];

  if (request.include_style_training === true) {
    steps.splice(1, 0, buildStep({
      id: 'style.prepare',
      agent: AGENTS.style,
      command: 'BuildTrainingJob',
      purpose: 'Prepare LoRA training job manifest without executing training',
      input: {
        dataset_name: request.dataset_name || '<dataset-name>',
        scenario,
        write_job_manifest: false
      }
    }));
  }

  const blockers = safetyBlockers(request);
  const auditPlan = buildAuditPlan(pipelineId, steps, request);
  const statePlan = buildStatePlan(steps);
  return {
    pipeline_id: pipelineId,
    scenario,
    dry_run: true,
    status: 'planned',
    steps,
    handoff_contracts: [
      'docs/AI_IMAGE_QUALITY_CONTRACT.md',
      'docs/AI_IMAGE_ORCHESTRATION_CONTRACT.md'
    ],
    state_plan: statePlan,
    audit_plan: auditPlan,
    safety: {
      executable: blockers.length === 0,
      blockers,
      real_workflow_invoked: false,
      real_training_invoked: false,
      external_service_called: false
    }
  };
}

function planRetryPipeline(request) {
  const retryPlan = request.retry_plan || {};
  const retryQueue = Array.isArray(retryPlan.retry_queue) ? retryPlan.retry_queue : [];
  const pipelineId = stableId('ai-image-retry', retryQueue);
  const blockers = safetyBlockers(request);
  const steps = retryQueue.map((item, index) => buildStep({
    id: `retry.${String(index + 1).padStart(3, '0')}`,
    agent: AGENTS.workflow,
    command: 'ExecuteWorkflow',
    purpose: `Prepare retry proposal for ${item.filename || item.image_path || 'image'}`,
    input: {
      source_image: item.image_path,
      route: item.route,
      actions: item.actions || [],
      simulate: true
    }
  }));
  const auditPlan = buildAuditPlan(pipelineId, steps, request);
  const statePlan = buildStatePlan(steps);

  return {
    pipeline_id: pipelineId,
    dry_run: true,
    status: 'planned',
    retry_count: retryQueue.length,
    handoff_contracts: [
      'docs/AI_IMAGE_QUALITY_CONTRACT.md',
      'docs/AI_IMAGE_ORCHESTRATION_CONTRACT.md'
    ],
    steps,
    state_plan: statePlan,
    audit_plan: auditPlan,
    safety: {
      executable: blockers.length === 0,
      blockers,
      real_workflow_invoked: false,
      real_generation_retried: false,
      external_service_called: false
    }
  };
}

async function handleRequest(request) {
  const action = String(request.action || request.tool_name || '').trim();

  switch (action) {
    case 'plan_image_pipeline':
    case 'PlanImagePipeline':
      return {
        status: 'success',
        result: planImagePipeline(request)
      };

    case 'plan_retry_pipeline':
    case 'PlanRetryPipeline':
      return {
        status: 'success',
        result: planRetryPipeline(request)
      };

    case 'health_check':
    case 'HealthCheck':
      return {
        status: 'success',
        result: {
          allow_execution: CONFIG.allowExecution,
          default_mode: CONFIG.defaultMode,
          agents: AGENTS,
          safety_boundary: 'dry-run orchestration only; no downstream plugin execution'
        }
      };

    default:
      return {
        status: 'error',
        error: `unknown action: ${action || '(empty)'}`,
        supported_actions: ['plan_image_pipeline', 'plan_retry_pipeline', 'health_check']
      };
  }
}

async function main() {
  try {
    const request = await readJsonFromStdin();
    const response = await handleRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'error', error: error.message })}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  handleRequest,
  planImagePipeline,
  planRetryPipeline,
  buildAuditPlan,
  buildStatePlan,
  inferScenario,
  safetyBlockers
};
