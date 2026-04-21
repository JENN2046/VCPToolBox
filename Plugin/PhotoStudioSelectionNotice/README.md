# PhotoStudioSelectionNotice

Generates a client-facing image-selection notice for an existing `photo_studio` project.

## Command

- `create_selection_notice`

## Input

```json
{
  "project_id": "proj_ab12cd34",
  "selection_deadline": "2026-05-21",
  "selection_method": "shared online gallery",
  "note_to_client": "Please mark the hero images first.",
  "tone": "warm"
}
```

## Notes

- Allowed project states: `editing`, `reviewing`
- Generates text only. It does not send messages externally.
- Reuses the shared `photo_studio` runtime and JSON data store.
