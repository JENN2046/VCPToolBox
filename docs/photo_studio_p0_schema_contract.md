# photo_studio P0 Schema Contract

This file records the aligned `photo_studio` P0 contract on the clean engineering line in `A:\VCP\VCPToolBox-main`.

Business source of truth:

- [vcp_photo_studio_p0_schema_freeze.md](A:\VCP\docs\vcp_photo_studio_p0_schema_freeze.md)
- [photo_studio_transport_convergence_decision.md](A:\VCP\VCPToolBox-main\docs\photo_studio_transport_convergence_decision.md)

Engineering scope for this batch:

- Align business behavior, IDs, status enums, task/reply interfaces, and tests to the frozen schema.
- Keep the current plugin transport and runtime layout unchanged for now:
  - `pluginType: synchronous`
  - `protocol: stdio`
  - shared runtime store under `data/photo-studio/`

Transport decision note:

- For current implementation, transport authority comes from [photo_studio_transport_convergence_decision.md](A:\VCP\VCPToolBox-main\docs\photo_studio_transport_convergence_decision.md).
- `hybridservice + direct` is not the active implementation target for this branch.

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
- `data/photo-studio/reminders.json` once P1-A reminder support is used
- `data/photo-studio/content_pool.json` once P1-B content-pool support is used
- `data/photo-studio/calendar_events.json` once P2-A calendar coordination support is used
- `data/photo-studio/archive_assets.json` once P2-B asset archive support is used

Runtime path overrides currently supported:

- `PHOTO_STUDIO_DATA_DIR`
- `PhotoStudioDataPath`

## Partial P1-A Addition: Selection Notice

The current `feature/photo-studio-p1-ops-closure` branch adds the first P1-A plugin without changing transport or storage strategy.

### Command

- `create_selection_notice`

### Input

```json
{
  "project_id": "string",
  "selection_deadline": "string|null",
  "selection_method": "string|null",
  "note_to_client": "string|null",
  "tone": "formal|friendly|warm"
}
```

### Status Gate

`create_selection_notice` is allowed only when the project status is:

- `editing`
- `reviewing`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Success Data

```json
{
  "project_id": "proj_ab12cd34",
  "customer_name": "Luna Studio",
  "selection_deadline": "2026-05-21",
  "selection_method": "shared online gallery",
  "notice_content": "string",
  "generation_time": "2026-04-20T00:00:00.000Z"
}
```

### Behavior Notes

- The plugin generates notice content only and does not send external messages.
- If `selection_deadline` is omitted, the service falls back to the project's `due_date` when available.
- If `selection_method` is omitted, the service defaults to `online gallery review`.
- Degraded mode remains explicit via `meta.degraded` when customer context is missing.

## Partial P1-A Addition: Delivery Tasks

The current `feature/photo-studio-p1-ops-closure` branch also adds the second P1-A plugin for delivery-stage task generation.

### Command

- `create_delivery_tasks`

### Input

```json
{
  "project_id": "string",
  "override_existing": false,
  "delivery_mode": "string|null",
  "delivery_deadline": "string|null"
}
```

### Status Gate

`create_delivery_tasks` is allowed only when the project status is:

- `reviewing`
- `delivered`
- `completed`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Success Data

```json
{
  "project_id": "proj_ab12cd34",
  "delivery_mode": "online gallery",
  "delivery_deadline": "2026-05-25",
  "created_tasks": [],
  "created_count": 4,
  "skipped_count": 0
}
```

### Behavior Notes

- The plugin generates exactly 4 delivery-stage tasks per run.
- If `delivery_mode` is omitted, the service defaults to `digital delivery`.
- If `delivery_deadline` is omitted, the service falls back to the project's `due_date` when available.
- Re-running without `override_existing === true` skips only prior delivery-stage tasks generated by this plugin.
- `override_existing === true` replaces only the existing delivery-stage task set and leaves unrelated P0 project tasks intact.

## Partial P1-A Addition: Followup Reminder

The current `feature/photo-studio-p1-ops-closure` branch also adds the third P1-A plugin for internal reminder creation.

### Command

- `create_followup_reminder`

### Input

```json
{
  "project_id": "string",
  "reminder_type": "quotation_followup|delivery_followup|revisit",
  "due_date": "string|null",
  "note": "string|null"
}
```

### Reminder Record

```json
{
  "reminder_id": "rem_ab12cd34",
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "reminder_type": "quotation_followup",
  "due_date": "2026-05-12",
  "status": "pending",
  "note": "string|null",
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Type-Specific Status Gates

- `quotation_followup` -> `quoted`
- `delivery_followup` -> `delivered|completed`
- `revisit` -> `completed|archived`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Behavior Notes

- The plugin writes to `reminders.json` and does not sync to external reminder systems.
- If `due_date` is omitted, the service computes a default due date from project dates or a small type-specific fallback offset.
- Duplicate policy is idempotent for active reminders: the same pending `project_id + reminder_type` pair returns the existing reminder instead of creating a second record.

## Partial P1-B Addition: Content Pool

The current `feature/photo-studio-p1-content-pool` branch adds the content-pool foundation for reusable case drafting.

### Command

- `push_project_to_content_pool`

### Input

```json
{
  "project_id": "string",
  "theme": "string|null",
  "deliverables_summary": "string|null"
}
```

### Status Gate

`push_project_to_content_pool` is allowed only when the project status is:

- `delivered`
- `completed`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Content Item Record

```json
{
  "content_item_id": "content_ab12cd34",
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "customer_name": "Luna Studio",
  "project_name": "May Wedding Story",
  "project_type": "wedding",
  "theme": "romantic wedding story",
  "deliverables_summary": "A polished gallery and social-ready highlights.",
  "usage_status": "candidate",
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Behavior Notes

- The plugin writes to `content_pool.json`.
- Repeated pushes for the same project update the existing content item instead of creating duplicates.
- The plugin stays local and does not publish externally.

### Partial P2-A Addition: Calendar Sync

The current `feature/photo-studio-p2-calendar-sync` branch adds the first P2-A plugin for calendar coordination.

### Command

- `sync_calendar_event`

### Input

```json
{
  "project_id": "string",
  "event_type": "milestone|follow_up|deadline",
  "event_key": "string|null",
  "event_date": "string|null",
  "event_time": "string|null",
  "calendar_surface": "string|null",
  "timezone": "string|null",
  "event_title": "string|null",
  "note": "string|null"
}
```

### Status Gate

`sync_calendar_event` is allowed only when the project status is:

- `quoted`
- `confirmed`
- `preparing`
- `shooting`
- `editing`
- `reviewing`
- `delivered`
- `completed`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Calendar Event Record

```json
{
  "calendar_event_id": "calendar_ab12cd34",
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "customer_name": "Luna Studio",
  "project_name": "May Wedding Story",
  "project_type": "wedding",
  "project_status": "reviewing",
  "event_type": "follow_up",
  "event_key": "client-review-1",
  "event_title": "Client review checkpoint",
  "event_description": "string",
  "event_date": "2026-05-16",
  "event_time": "09:30",
  "timezone": "Asia/Shanghai",
  "calendar_surface": "local_shadow_calendar",
  "sync_state": "local_shadow",
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Behavior Notes

- The plugin writes to `calendar_events.json`.
- Repeated syncs for the same `project_id + calendar_surface + event_key` update the existing shadow event instead of creating duplicates.
- The plugin currently produces a local shadow coordination record and does not publish to an external calendar provider yet.

## Partial P1-B Addition: Case Content Draft

The current `feature/photo-studio-p1-content-pool` branch also adds the case-content drafting plugin.

### Command

- `generate_case_content_draft`

### Input

```json
{
  "content_item_id": "string|null",
  "project_id": "string|null",
  "tone": "formal|friendly|warm"
}
```

### Output

```json
{
  "content_item_id": "content_ab12cd34",
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "customer_name": "Luna Studio",
  "project_name": "May Wedding Story",
  "project_type": "wedding",
  "theme": "romantic wedding story",
  "deliverables_summary": "A polished gallery and social-ready highlights.",
  "usage_status": "candidate",
  "draft_variants": {
    "case_title": "Luna Studio x May Wedding Story",
    "short_case_summary": "string",
    "social_caption": "string",
    "portfolio_description": "string",
    "tone": "warm"
  },
  "generation_time": "2026-04-20T00:00:00.000Z"
}
```

### Behavior Notes

- The plugin reads from normalized content-pool data.
- It accepts either `content_item_id` or `project_id`.
- It keeps degraded behavior explicit via `meta.degraded` when source fields are incomplete.

## Partial P2-B Addition: Asset Archive

The current `feature/photo-studio-p2-asset-lifecycle` branch adds the first P2-B plugin for local shadow asset archiving.

### Command

- `archive_project_assets`

### Input

```json
{
  "project_id": "string",
  "archive_key": "string|null",
  "archive_path": "string|null",
  "archive_label": "string|null",
  "archive_mode": "shadow|copy|move",
  "archive_surface": "string|null",
  "asset_summary": "string|null",
  "note": "string|null"
}
```

### Status Gate

`archive_project_assets` is allowed only when the project status is:

- `completed`
- `archived`

Projects in other states return `CONFLICT` with the current status and allowed statuses in `error.details`.

### Archive Record

```json
{
  "archive_asset_id": "archive_ab12cd34",
  "project_id": "proj_ab12cd34",
  "customer_id": "cust_ab12cd34",
  "customer_name": "Luna Studio",
  "project_name": "May Wedding Story",
  "project_type": "wedding",
  "project_status": "completed",
  "archive_key": "project_assets",
  "archive_path": "archive/photo-studio/proj_ab12cd34",
  "archive_label": "May Wedding Story assets",
  "archive_mode": "shadow",
  "asset_summary": "Project assets archived for review and retention.",
  "archive_description": "string",
  "archive_surface": "local_shadow_archive",
  "sync_state": "local_shadow",
  "created_at": "2026-04-20T00:00:00.000Z"
}
```

### Behavior Notes

- The plugin writes to `archive_assets.json`.
- Repeated archive requests for the same `project_id + archive_surface + archive_key` update the existing record instead of creating duplicates.
- The plugin currently produces a local shadow archive record and does not move files or publish to an external archive provider yet.
