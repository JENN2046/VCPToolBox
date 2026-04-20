# 01 Architecture

## Objective

Deliver a unified DWS integration entry in VCPToolBox with:

- dynamic schema discovery (`dws schema`)
- security gate (default dry-run + explicit apply)
- structured audit logs
- built-in workflows with resume checkpoints
- backward compatibility via `DingTalkTable`

## Plugin Layout

- `Plugin/DingTalkCLI/DingTalkCLI.js`: stdio entry
- `Plugin/DingTalkCLI/lib/dingtalk-executor.js`: safe spawn executor
- `Plugin/DingTalkCLI/lib/schema-discoverer.js`: schema registry/cache
- `Plugin/DingTalkCLI/lib/security-handler.js`: input policy and write gate
- `Plugin/DingTalkCLI/lib/error-handler.js`: category mapping
- `Plugin/DingTalkCLI/lib/audit-logger.js`: JSONL audit writer
- `Plugin/DingTalkCLI/workflows/workflow-engine.js`: workflow orchestration/checkpoint
- `Plugin/DingTalkCLI/workflows/default-workflows.js`: built-in workflows

## Request Flow

1. `PluginManager` sends action JSON to `DingTalkCLI` via stdio.
2. Runtime resolves action and request ID.
3. `execute_tool` runs security validation.
4. Schema validation is attempted through cached/fresh `dws schema` data.
5. Executor calls `dws` with spawn argument array (no shell string concat).
6. Output is parsed and returned as structured JSON.
7. Audit record is appended to `AUDIT_LOG_PATH`.

## Capability Coverage

Supported products (v1 full scope):

- `aitable`
- `calendar`
- `chat`/`bot`
- `ding`
- `contact`
- `todo`
- `report`
- `attendance`
- `devdoc`
- `workbench`

## Compatibility

`DingTalkTable` remains enabled and forwards legacy actions to `DingTalkCLI` `execute_tool` (AITable channel) with a deprecation marker in responses.