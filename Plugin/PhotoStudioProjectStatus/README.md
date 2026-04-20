# PhotoStudioProjectStatus

Updates the shared `photo_studio` project status and appends a status history entry to the existing project record.

## Command

- `update_project_status`

## Input

```json
{
  "project_id": "proj_20260420_ab12cd34",
  "new_status": "shot",
  "reason": "拍摄已完成，进入选片前准备"
}
```

## Notes

- Uses the shared P0 project status enum and transition guard.
- Writes changes back into `data/photo-studio/projects.json`.
