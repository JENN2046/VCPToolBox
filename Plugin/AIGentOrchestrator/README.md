# AIGentOrchestrator - Multi-Agent Orchestrator

**Version**: 0.1.0
**Stage**: Multi-agent dry-run planner
**Safety boundary**: builds orchestration plans only; does not call downstream plugins, generation workflows, training or external services.

## Goal

AIGentOrchestrator starts stage 5 of the AI image agent plan. It coordinates the contracts between:

- `AIGentPrompt`: prompt generation
- `AIGentWorkflow`: generation workflow planning
- `AIGentStyle`: optional StyleTrainer preparation
- `AIGentQuality`: quality inspection and retry routing

The current implementation returns JSON plans. It is deliberately not an executor.

## Commands

### PlanImagePipeline

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentOrchestrator「末」
tool_name:「始」PlanImagePipeline「末」
user_input:「始」Generate an ecommerce dress product image「末」
include_style_training:「始」false「末」
<<<[END_TOOL_REQUEST]>>>
```

### PlanRetryPipeline

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentOrchestrator「末」
tool_name:「始」PlanRetryPipeline「末」
retry_plan:「始」{ "retry_queue": [] }「末」
<<<[END_TOOL_REQUEST]>>>
```

### HealthCheck

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentOrchestrator「末」
tool_name:「始」HealthCheck「末」
<<<[END_TOOL_REQUEST]>>>
```

## Safety Notes

- `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false` is the stage 5 default.
- `execute_pipeline=true` alone is not enough for future execution.
- Future real execution must also require `confirm_external_effects=true`.
- This stage never invokes `AIGentWorkflow`, `ComfyUIGen`, StyleTrainer training or QualityInspector external vision checks.
