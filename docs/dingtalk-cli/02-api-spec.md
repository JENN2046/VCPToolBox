# 02 API Spec

## Fixed Actions

- `health_check`
- `auth_status`
- `auth_login`
- `schema_list`
- `schema_tool`
- `execute_tool`
- `run_workflow`

## `execute_tool` Contract

Request fields are fixed:

- `product`
- `tool`
- `args`
- `apply`
- `dry_run`
- `yes`
- `jq`
- `format`

Example:

```json
{
  "action": "execute_tool",
  "product": "todo",
  "tool": "task_create",
  "args": {"title": "follow up", "assignee": "u123"},
  "apply": false,
  "dry_run": true,
  "yes": false,
  "jq": "",
  "format": "json"
}
```

## Default Rules

- `dry_run` defaults to `true`.
- `apply=true` forces `dry_run=false`.
- `format` defaults to `json`.
- write-like tools require explicit `apply=true` for real writes.
- gray policy `DWS_GRAY_STAGE` is enforced at runtime:
  - `query_only`: block all write tools
  - `low_risk_write`: allow write tools only for `todo/ding/chat`
  - `full_write`: full write scope (still guarded by `apply`)

## Error Shape

All errors return:

```json
{
  "status": "error",
  "error": {
    "category": "validation|auth|authorization|upstream|timeout|parse|security|system",
    "reason": "...",
    "hint": "...",
    "actions": ["..."]
  }
}
```

## Workflows

`run_workflow` supports:

- `meeting_automation`
- `customer_followup`
- `daily_report_generation`

Workflow request fields:

- `workflow`
- `input`
- `apply`
- `resume_from` (optional)
- `run_id` (optional)
