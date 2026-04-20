'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDirSync, randomId, nowIso, deepGet } = require('../lib/helpers');
const { getWorkflowDefinition, listWorkflowNames } = require('./default-workflows');

const TOKEN_PATTERN = /\{\{\s*([^{}]+)\s*\}\}/g;

function resolveToken(token, context) {
  const trimmed = String(token || '').trim();

  if (trimmed === 'input') {
    return context.input;
  }

  if (trimmed.startsWith('input.')) {
    return deepGet(context.input, trimmed.slice('input.'.length));
  }

  if (trimmed.startsWith('steps.')) {
    return deepGet(context.steps, trimmed.slice('steps.'.length));
  }

  if (trimmed === 'run') {
    return context.run;
  }

  if (trimmed.startsWith('run.')) {
    return deepGet(context.run, trimmed.slice('run.'.length));
  }

  return undefined;
}

function resolveTemplateValue(value, context) {
  if (typeof value === 'string') {
    const onlyTokenMatch = value.match(/^\{\{\s*([^{}]+)\s*\}\}$/);
    if (onlyTokenMatch) {
      return resolveToken(onlyTokenMatch[1], context);
    }

    return value.replace(TOKEN_PATTERN, (_full, token) => {
      const resolved = resolveToken(token, context);
      if (resolved === undefined || resolved === null) {
        return '';
      }
      if (typeof resolved === 'object') {
        return JSON.stringify(resolved);
      }
      return String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, context));
  }

  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = resolveTemplateValue(item, context);
    }
    return output;
  }

  return value;
}

class WorkflowEngine {
  constructor(options) {
    this.executeTool = options.executeTool;
    this.stateDir = options.stateDir;
    this.auditLogger = options.auditLogger;
    this.logger = options.logger;

    ensureDirSync(this.stateDir);
  }

  listWorkflows() {
    return listWorkflowNames();
  }

  getStatePath(runId) {
    return path.join(this.stateDir, `${runId}.json`);
  }

  saveState(runState) {
    fs.writeFileSync(this.getStatePath(runState.run_id), JSON.stringify(runState, null, 2), 'utf8');
  }

  loadState(runId) {
    const statePath = this.getStatePath(runId);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  async runWorkflow(request, context) {
    const workflowName = String(request.workflow || request.name || '').trim();
    const definition = getWorkflowDefinition(workflowName);
    if (!definition) {
      return {
        status: 'error',
        error: {
          category: 'validation',
          reason: `unknown workflow: ${workflowName}`,
          hint: `available workflows: ${this.listWorkflows().join(', ')}`,
          actions: ['select_workflow']
        }
      };
    }

    const runId = request.run_id || randomId(`wf-${workflowName}`);
    const runState = this.loadState(runId) || {
      run_id: runId,
      workflow: workflowName,
      started_at: nowIso(),
      updated_at: nowIso(),
      status: 'running',
      input: request.input && typeof request.input === 'object' ? request.input : {},
      apply: request.apply === true,
      steps: []
    };

    const input = request.input && typeof request.input === 'object' ? request.input : runState.input || {};
    const stepOutputs = {};
    for (const item of runState.steps) {
      if (item && item.status === 'success') {
        stepOutputs[item.id] = item;
      }
    }

    const startIndex = this.resolveStartIndex(definition.steps, request.resume_from, runState.steps);

    for (let index = startIndex; index < definition.steps.length; index += 1) {
      const step = definition.steps[index];
      const runContext = {
        input,
        steps: stepOutputs,
        run: {
          id: runId,
          workflow: workflowName
        }
      };

      const resolvedArgs = resolveTemplateValue(step.argsTemplate || {}, runContext);
      const stepApply = step.write ? runState.apply === true : true;
      const stepDryRun = step.write ? !stepApply : false;

      const stepRequest = {
        product: step.product,
        tool: step.tool,
        args: resolvedArgs,
        apply: stepApply,
        dry_run: stepDryRun,
        yes: request.yes === true,
        jq: request.jq || '',
        format: request.format || 'json'
      };

      const startedAt = nowIso();
      const response = await this.executeTool(stepRequest, {
        requestId: context.requestId,
        workflow: workflowName,
        stepId: step.id
      });

      const stepRecord = {
        id: step.id,
        product: step.product,
        tool: step.tool,
        write: step.write,
        apply: stepApply,
        dry_run: stepDryRun,
        started_at: startedAt,
        ended_at: nowIso(),
        status: response.status,
        result: response.status === 'success' ? response.result : null,
        error: response.status === 'error' ? response.error : null
      };

      this.upsertStep(runState.steps, stepRecord);
      runState.updated_at = nowIso();
      runState.checkpoint = step.id;

      if (this.auditLogger) {
        this.auditLogger.write({
          requestId: context.requestId,
          phase: 'workflow-step',
          workflow: workflowName,
          runId,
          stepId: step.id,
          status: stepRecord.status,
          apply: stepApply,
          dryRun: stepDryRun
        });
      }

      this.saveState(runState);

      if (response.status !== 'success') {
        runState.status = 'failed';
        runState.failed_step = step.id;
        runState.updated_at = nowIso();
        this.saveState(runState);

        return {
          status: 'error',
          error: response.error,
          result: {
            run_id: runId,
            workflow: workflowName,
            checkpoint: step.id,
            failed_step: step.id,
            steps: runState.steps
          }
        };
      }

      stepOutputs[step.id] = stepRecord;
    }

    runState.status = 'completed';
    runState.completed_at = nowIso();
    runState.updated_at = nowIso();
    this.saveState(runState);

    return {
      status: 'success',
      result: {
        run_id: runId,
        workflow: workflowName,
        status: runState.status,
        checkpoint: runState.checkpoint || null,
        steps: runState.steps
      }
    };
  }

  resolveStartIndex(steps, resumeFrom, executedSteps) {
    if (!resumeFrom) {
      return executedSteps.length;
    }

    const index = steps.findIndex((step) => step.id === resumeFrom);
    if (index < 0) {
      return 0;
    }

    return index;
  }

  upsertStep(stepList, stepRecord) {
    const index = stepList.findIndex((item) => item.id === stepRecord.id);
    if (index >= 0) {
      stepList[index] = stepRecord;
      return;
    }

    stepList.push(stepRecord);
  }
}

module.exports = {
  WorkflowEngine,
  resolveTemplateValue
};