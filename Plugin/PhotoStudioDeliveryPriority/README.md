# Photo Studio Delivery Priority

Produces a read-only priority queue from the local-shadow `photo_studio` delivery records.

## Command

- `prioritize_pending_delivery_actions`

## Inputs

- `reference_date` - optional ISO date or date-time string
- `project_id` - optional project filter
- `export_key` - optional export filter
- `target_type` - optional target filter
- `delivery_state` - optional state filter
- `max_items` - optional positive integer limit

## Output

The command returns:

- prioritized pending actions
- summary counts by urgency
- a compact plain-text priority view

## Behavior

- local-shadow only
- read-only
- no real Sheet or Notion API calls
