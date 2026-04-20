# photo_studio P0 Schema Contract

This file records the aligned `photo_studio` P0 contract on the clean engineering line in `A:\VCP\VCPToolBox-main`.

Business source of truth:

- [vcp_photo_studio_p0_schema_freeze.md](A:\VCP\docs\vcp_photo_studio_p0_schema_freeze.md)

Engineering scope for this batch:

- Align business behavior, IDs, status enums, task/reply interfaces, and tests to the frozen schema.
- Keep the current plugin transport and runtime layout unchanged for now:
  - `pluginType: synchronous`
  - `protocol: stdio`
  - shared runtime store under `data/photo-studio/`

## P0 Plugin Set

1. `create_customer_record`
2. `create_project_record`
3. `update_project_status`
4. `create_project_tasks`
5. `generate_client_reply_draft`

## Shared Output Envelope

Success:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "plugin_name": "create_customer_record",
    "version": "1.0.0",
    "timestamp": "2026-04-20T00:00:00.000Z"
  }
}
```

Failure:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "customer_name is required.",
    "field": "customer_name",
    "details": {
      "field": "customer_name"
    }
  },
  "meta": {
    "plugin_name": "create_customer_record",
    "version": "1.0.0",
    "timestamp": "2026-04-20T00:00:00.000Z"
  }
}
```

Conflict-style failures may keep a summary object in `data` so callers can reuse the existing record anchor.

## Error Codes

- `MISSING_REQUIRED_FIELD`
- `INVALID_INPUT`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `INVALID_TRANSITION`
- `TIMEOUT`
- `UNKNOWN_ERROR`

## Shared Identifier Rules

- `customer_id`: `cust_[a-z0-9]{8}`
- `project_id`: `proj_[a-z0-9]{8}`
- `task_id`: `task_[a-z0-9]{8}`

## Customer Contract

### Input

```json
{
  "customer_name": "string",
  "customer_type": "individual|corporate",
  "contact_phone": "string|null",
  "contact_wechat": "string|null",
  "contact_email": "string|null",
  "source": "referral|social_media|returning|walk_in|other|null",
  "remark": "string|null"
}
```

### Success Data

```json
{
  "customer_id": "cust_ab12cd34",
  "customer_name": "Luna Studio",
  "customer_type": "individual",
  "is_new": true,
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Duplicate Rule

Duplicate customers return `CONFLICT` when:

- normalized `customer_name` matches
- and either normalized `contact_phone` or normalized `contact_wechat` matches

## Project Contract

### Input

```json
{
  "customer_id": "string",
  "project_name": "string",
  "project_type": "wedding|portrait|commercial|event|other",
  "start_date": "string|null",
  "due_date": "string|null",
  "budget": "number|string|null",
  "remark": "string|null"
}
```

### Success Data

```json
{
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "project_name": "May Wedding Story",
  "project_type": "wedding",
  "status": "inquiry",
  "is_new": true,
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Duplicate Rule

Duplicate projects return `CONFLICT` when both are true:

- same `customer_id`
- same normalized `project_name`

## Project Status Contract

### Status Enum

- `inquiry`
- `quoted`
- `confirmed`
- `preparing`
- `shooting`
- `editing`
- `reviewing`
- `delivered`
- `completed`
- `archived`
- `cancelled`

### Valid Transitions

- `inquiry -> quoted|cancelled`
- `quoted -> confirmed|cancelled`
- `confirmed -> preparing|cancelled`
- `preparing -> shooting|cancelled`
- `shooting -> editing|cancelled`
- `editing -> reviewing|delivered`
- `reviewing -> editing|delivered`
- `delivered -> completed`
- `completed -> archived`

Invalid transitions return `INVALID_TRANSITION`.

### update_project_status Input

```json
{
  "project_id": "string",
  "new_status": "inquiry|quoted|confirmed|preparing|shooting|editing|reviewing|delivered|completed|archived|cancelled",
  "remark": "string|null"
}
```

Backward-compatible alias:

- `reason` may still be accepted as an alias for `remark`

### Success Data

```json
{
  "project_id": "proj_ab12cd34",
  "previous_status": "inquiry",
  "new_status": "quoted",
  "transition_time": "2026-04-20T00:00:00.000Z",
  "remark": "Quotation sent."
}
```

Status transitions are also appended to `status_log.json`.

## Task Contract

### Input

```json
{
  "project_id": "string",
  "task_template": "wedding_standard|portrait_basic|commercial_standard|event_basic|null",
  "tasks": [
    {
      "task_name": "string",
      "task_type": "shooting|editing|delivery|review|communication|other",
      "sort_order": 1,
      "due_date": "2026-05-10",
      "assignee": "string|null",
      "remark": "string|null"
    }
  ],
  "override_existing": false
}
```

Behavior:

- `task_template` and `tasks` are mutually exclusive.
- If neither is provided, the service uses the default template mapped from `project_type`.
- If tasks already exist and `override_existing !== true`, the service skips creation and returns counts instead of rewriting the task set.

### Shared Task Enums

- `task_type`: `shooting`, `editing`, `delivery`, `review`, `communication`, `other`
- `status`: `pending`, `in_progress`, `completed`, `skipped`

### Default Templates

- `wedding_standard` -> 6 tasks
- `portrait_basic` -> 5 tasks
- `commercial_standard` -> 6 tasks
- `event_basic` -> 4 tasks

## Reply Draft Contract

### Input

```json
{
  "project_id": "string",
  "customer_id": "string|null",
  "context_type": "quotation|schedule|delivery|general",
  "key_points": ["string"],
  "tone": "formal|friendly|warm"
}
```

### Success Data

```json
{
  "project_id": "proj_ab12cd34",
  "customer_name": "Luna Studio",
  "context_type": "quotation",
  "draft_content": "string",
  "generation_time": "2026-04-20T00:00:00.000Z"
}
```

### Degraded Mode

If customer information is missing or incomplete, the draft still succeeds and:

- uses `[客户姓名]` as the fallback name
- sets `meta.degraded = true`

## Runtime Store Layout

The current aligned batch keeps the shared runtime store under:

- `data/photo-studio/customers.json`
- `data/photo-studio/projects.json`
- `data/photo-studio/tasks.json`
- `data/photo-studio/status_log.json`

Runtime path overrides currently supported:

- `PHOTO_STUDIO_DATA_DIR`
- `PhotoStudioDataPath`
