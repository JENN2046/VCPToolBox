# PhotoStudioCaseContentDraft

Generates structured case-study and promotional copy from an existing `photo_studio` content-pool record.

## Command

- `generate_case_content_draft`

## Input

```json
{
  "content_item_id": "content_ab12cd34",
  "tone": "warm"
}
```

## Notes

- Supported tones: `formal`, `friendly`, `warm`
- Accepts either `content_item_id` or `project_id`
- Reads from `data/photo-studio/content_pool.json`
- Falls back explicitly when customer or theme fields are incomplete
