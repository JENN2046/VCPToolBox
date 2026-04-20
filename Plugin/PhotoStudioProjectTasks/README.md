# PhotoStudioProjectTasks

Generates reusable phase-based tasks for an existing `photo_studio` project.

## Command

- `create_project_tasks`

## Input

```json
{
  "project_id": "proj_20260420_ab12cd34",
  "phase": "pre_shoot",
  "project_type": "portrait"
}
```

## Notes

- Supported phases: `pre_shoot`, `post_shoot`, `delivery`
- Re-running the same project and phase returns the existing task set instead of duplicating it.
- Writes to `data/photo-studio/tasks.json`.
