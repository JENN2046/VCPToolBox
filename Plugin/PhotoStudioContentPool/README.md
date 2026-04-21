# PhotoStudioContentPool

Promotes a delivered or completed `photo_studio` project into a reusable content-pool candidate.

## Command

- `push_project_to_content_pool`

## Input

```json
{
  "project_id": "proj_ab12cd34",
  "theme": "romantic wedding story",
  "deliverables_summary": "A polished gallery and social-ready highlights."
}
```

## Notes

- Allowed project states: `delivered`, `completed`
- Writes records into `data/photo-studio/content_pool.json`
- Repeated pushes for the same project update the existing content item instead of creating duplicates
- Does not publish or sync content externally
