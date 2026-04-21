# Photo Studio Delivery Audit Trail

Inspects a read-only local-shadow audit view for `photo_studio` delivery records.

## Command

- `inspect_delivery_audit_trail`

## Inputs

- `reference_date` - optional ISO date or date-time string
- `project_id` - optional project filter
- `export_key` - optional export filter
- `target_type` - optional target filter
- `delivery_state` - optional state filter

## Output

The command returns:

- audit scope metadata
- derived audit rows ordered by timestamp
- aggregate audit summary counts
- a plain-text audit timeline

## Behavior

- local-shadow only
- read-only
- no real Sheet or Notion API calls
