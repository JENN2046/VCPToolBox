# Photo Studio Field Audit

`check_missing_project_fields` audits `photo_studio` project records for missing required and recommended fields.

## Current Behavior

- Keeps the existing `Plugin/*/plugin-manifest.json` loader contract.
- Runs as `synchronous` over `stdio`.
- Reads from the shared `customers.json` and `projects.json` stores.
- Returns a deterministic audit summary and a human-readable audit text block.
- Does not create a new runtime store.

## Supported Input

- `project_id`
- `include_recommended_fields`

## Notes

- The plugin is deterministic for the same snapshot.
- It is local audit output only and does not create follow-up work or publish externally.
