# Photo Studio Queue Scheduler

Generates a read-only local-shadow delivery queue schedule for `photo_studio`.

## Command

- `generate_delivery_queue_schedule`

## Inputs

- `reference_date` - optional ISO date or date-time string
- `project_id` - optional project filter
- `export_key` - optional export filter
- `target_type` - optional target filter
- `delivery_state` - optional state filter
- `max_items` - optional positive integer limit

## Output

The command returns:

- prioritized schedule rows
- grouped schedule windows
- summary counts for actionable queue records
- a plain-text schedule view

## Behavior

- local-shadow only
- read-only
- no real Sheet or Notion API calls
