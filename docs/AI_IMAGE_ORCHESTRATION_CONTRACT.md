# AI Image Orchestration Contract

**Date**: 2026-04-26
**Owner plugin**: `Plugin/AIGentOrchestrator`
**Stage**: Multi-agent orchestration contract, dry-run only

This document defines how the AI image agents hand work to each other and which safety gates must exist before any future real execution.

## Safety Boundary

The current orchestrator is a planner, not an executor.

- It does not invoke downstream plugins.
- It does not call `AIGentWorkflow`.
- It does not call `ComfyUIGen`.
- It does not start StyleTrainer training.
- It does not call QualityInspector external vision checks.
- It does not upload files or call external services.

`PlanImagePipeline` and `PlanRetryPipeline` return JSON plans only.

## Execution Gates

Future real downstream execution must require all of these conditions:

- `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=true`
- request includes `execute_pipeline=true`
- request includes `confirm_external_effects=true`
- each downstream step has an allow gate specific to that plugin
- generated outputs are written only to explicit output paths
- audit logs preserve the source plan and final execution result

If any gate fails, the orchestrator must return a plan with safety blockers instead of invoking a plugin.

## Agent Roles

Stable agent role names:

- `prompt`: `AIGentPrompt`
- `workflow`: `AIGentWorkflow`
- `style`: `AIGentStyle`
- `quality`: `AIGentQuality`

Consumers should depend on role names rather than hard-coding step positions.

## PlanImagePipeline

Input shape:

```json
{
  "tool_name": "PlanImagePipeline",
  "user_input": "Generate an ecommerce dress product image",
  "scenario": "ecommerce",
  "include_style_training": false,
  "output_directory": "A:/path/to/output"
}
```

Output shape:

```json
{
  "pipeline_id": "ai-image-pipeline-...",
  "scenario": "ecommerce",
  "dry_run": true,
  "status": "planned",
  "steps": [],
  "state_plan": {},
  "audit_plan": {},
  "handoff_contracts": [],
  "safety": {
    "executable": false,
    "blockers": [],
    "real_workflow_invoked": false,
    "real_training_invoked": false,
    "external_service_called": false
  }
}
```

Default step order:

1. `prompt.generate`: ask `AIGentPrompt` to generate a prompt.
2. `workflow.plan`: ask `AIGentWorkflow` to prepare a simulated generation workflow.
3. `quality.inspect`: ask `AIGentQuality` to inspect outputs and build retry advice.

Optional step:

- `style.prepare`: ask `AIGentStyle` to build a dry-run training job manifest.

## PlanRetryPipeline

Input shape:

```json
{
  "tool_name": "PlanRetryPipeline",
  "retry_plan": {
    "retry_queue": []
  }
}
```

Output shape:

```json
{
  "pipeline_id": "ai-image-retry-...",
  "dry_run": true,
  "status": "planned",
  "retry_count": 1,
  "steps": [],
  "state_plan": {},
  "audit_plan": {},
  "safety": {
    "executable": false,
    "blockers": [],
    "real_workflow_invoked": false,
    "real_generation_retried": false,
    "external_service_called": false
  }
}
```

`retry_plan.retry_queue` must follow `docs/AI_IMAGE_QUALITY_CONTRACT.md`.

## Step Contract

Each step has this shape:

```json
{
  "id": "workflow.plan",
  "agent": "AIGentWorkflow",
  "command": "ExecuteWorkflow",
  "purpose": "Select and parameterize a generation workflow in simulate mode",
  "depends_on": ["prompt.generate"],
  "execution": "planned",
  "input": {}
}
```

Stable fields:

- `id`: unique within the plan.
- `agent`: plugin name.
- `command`: plugin command identifier.
- `purpose`: human-readable intent.
- `depends_on`: step ids that must complete first.
- `execution`: currently always `planned`.
- `input`: proposed downstream input.

Future executor implementations must validate `depends_on` before running any step.

## State Plan

`state_plan` describes the dry-run lifecycle shape that a future executor or UI may persist.

Shape:

```json
{
  "dry_run": true,
  "initial_state": "planned",
  "terminal_states": ["accepted", "rejected", "cancelled", "failed"],
  "step_states": [
    {
      "step_id": "prompt.generate",
      "state": "planned",
      "depends_on": []
    }
  ]
}
```

This is not persisted by the current stage.

## Audit Plan

`audit_plan` describes what should be preserved if a future stage adds real orchestration execution.

Shape:

```json
{
  "dry_run": true,
  "audit_id": "ai-image-audit-...",
  "write_audit_log": false,
  "requested_by": "unknown",
  "fields_to_preserve": [],
  "redaction_rules": []
}
```

Rules:

- Do not persist secrets or raw environment values.
- Do not persist binary image payloads.
- Store file paths and hashes instead of image bytes.
- Store operator decisions separately from generated model outputs.

## Handoff Contracts

Current handoff documents:

- `docs/AI_IMAGE_QUALITY_CONTRACT.md`
- `docs/AI_IMAGE_ORCHESTRATION_CONTRACT.md`

Future handoff documents may be added for prompt, workflow and style contracts.

## Consumer Rules

Consumers should:

- treat orchestration plans as proposals, not proof that work was executed.
- persist `pipeline_id`, `steps` and `safety` when displaying or auditing plans.
- never infer that downstream plugins were invoked from a `planned` step.
- require an explicit execution API in a later stage before invoking downstream plugins.
- keep QualityInspector retry advice separate from execution authorization.

## Known Limits

- No live dependency resolution between plugins.
- No downstream plugin invocation.
- No persisted execution state.
- No retry loop execution.
- No distributed node scheduling.
- No operator approval workflow UI yet.
