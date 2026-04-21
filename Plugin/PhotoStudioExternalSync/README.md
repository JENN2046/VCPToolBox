# Photo Studio External Sync

`sync_to_external_sheet_or_notion` builds a local shadow export for `photo_studio` project data toward sheet or Notion targets.

## Current Behavior

- Keeps the existing `Plugin/*/plugin-manifest.json` loader contract.
- Runs as `synchronous` over `stdio`.
- Reads from the shared `projects.json` and `customers.json` stores.
- Writes a normalized export record to `external_exports.json`.
- Updates the same export record when the same target/scope combination is synced again.
- Does not call an external Sheet or Notion API yet.

## Supported Input

- `target_type`
- `target_name`
- `project_id`
- `reference_date`
- `upcoming_days`
- `include_closed_projects`
- `note`

## Notes

- The plugin is deterministic for the same snapshot and target key.
- It is local export output only and does not publish externally.
