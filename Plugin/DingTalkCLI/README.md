# DingTalkCLI Plugin

DingTalkCLI is the unified `dingtalk-workspace-cli (DWS)` integration entry for VCPToolBox.

## Implemented Actions

- `health_check`
- `auth_status`
- `auth_login`
- `schema_list`
- `schema_tool`
- `execute_tool`
- `run_workflow`

## `execute_tool` Fixed Request Fields

```json
{
  "action": "execute_tool",
  "product": "aitable",
  "tool": "record create",
  "args": {
    "base_id": "base_xxx",
    "table_id": "tbl_xxx",
    "records": [
      {
        "cells": {
          "title": "demo"
        }
      }
    ]
  },
  "apply": false,
  "dry_run": true,
  "yes": false,
  "jq": "",
  "format": "json"
}
```

Rules:
- `dry_run` default is `true`.
- If `apply=true`, dry-run is forced to `false`.
- Write-like tools are blocked from real writes unless `apply=true`.
- Gray stage gate is controlled by `DWS_GRAY_STAGE`:
  - `query_only`: block all writes
  - `low_risk_write`: allow writes on `todo/ding/chat` only
  - `full_write`: allow all writes (subject to `apply` gate)
- `format` default is `json`.
- `tool` supports multi-level command path, e.g. `record create`, `task list`, `message send`.
- Runtime emits DWS `--format json` (not `--json`) for structured output.
- On Windows, `.cmd` wrapper is invoked via `node .../dws.js` to keep argument-array execution and avoid shell command concatenation.

## Built-in Workflows

- `meeting_automation`
- `customer_followup`
- `daily_report_generation`

Each workflow persists checkpoint state under `Plugin/DingTalkCLI/state/workflow-runs` for resume.

## Notes

- This plugin does not auto-install DWS.
- Keep `DingTalkTable` enabled during migration; it now forwards to DingTalkCLI-compatible logic and is marked deprecated.
- Optional alias map file: `Plugin/DingTalkCLI/state/capability-map.json` (config: `DWS_TOOL_MAP_PATH`).
- Gray release env:
  - `DWS_GRAY_STAGE=query_only` for phase-1 query-only rollout.
