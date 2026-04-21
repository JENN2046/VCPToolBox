# Photo Studio Weekly Project Digest

`generate_weekly_project_digest` builds a deterministic local digest of `photo_studio` project state.

## Current Behavior

- Keeps the existing `Plugin/*/plugin-manifest.json` loader contract.
- Runs as `synchronous` over `stdio`.
- Reads from the shared `customers.json`, `projects.json`, and `status_log.json` stores.
- Produces a structured weekly summary plus a human-readable digest text block.
- Does not create a new runtime store.

## Supported Input

- `reference_date`
- `lookback_days`
- `upcoming_days`

## Notes

- The plugin is deterministic for the same snapshot and reference date.
- It is local report generation only and does not publish externally.
