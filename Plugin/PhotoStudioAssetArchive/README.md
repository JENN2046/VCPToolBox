# Photo Studio Asset Archive

`archive_project_assets` creates a local shadow archive record for a completed `photo_studio` project.

## Current Behavior

- Keeps the existing `Plugin/*/plugin-manifest.json` loader contract.
- Runs as `synchronous` over `stdio`.
- Stores the shadow record under `archive_assets.json`.
- Uses per-project plus archive-key idempotency to avoid duplicate archive records.

## Supported Input

- `project_id`
- `archive_key`
- `archive_path`
- `archive_label`
- `archive_mode`
- `archive_surface`
- `asset_summary`
- `note`

## Notes

- This batch is intentionally local-shadow first.
- It does not move files or integrate an external archive provider yet.
