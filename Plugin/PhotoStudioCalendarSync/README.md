# Photo Studio Calendar Sync

`sync_calendar_event` creates a local shadow calendar coordination record for a `photo_studio` project.

## Current Behavior

- Keeps the existing `Plugin/*/plugin-manifest.json` loader contract.
- Runs as `synchronous` over `stdio`.
- Stores the shadow record under `calendar_events.json`.
- Uses per-project plus event-key idempotency to avoid duplicate calendar records.

## Supported Input

- `project_id`
- `event_type`
- `event_key`
- `event_date`
- `event_time`
- `calendar_surface`
- `timezone`
- `event_title`
- `note`

## Notes

- This batch is intentionally local-shadow first.
- It does not integrate an external calendar provider yet.
