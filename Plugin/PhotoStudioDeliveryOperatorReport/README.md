# Photo Studio Delivery Operator Report

Generates a read-only local-shadow report for `photo_studio` delivery health.

## Command

- `generate_delivery_operator_report`

## Inputs

- `reference_date` - optional ISO date or date-time string
- `project_id` - optional project filter
- `export_key` - optional export filter
- `target_type` - optional target filter
- `delivery_state` - optional state filter

## Output

The command returns:

- summary counts for delivery states
- operator alerts sorted by severity
- row-level delivery status snapshots
- a plain-text report summary

## Behavior

- local-shadow only
- read-only
- no real Sheet or Notion API calls
