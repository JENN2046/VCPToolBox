# PhotoStudioReplyDraft

Generates deterministic communication drafts from the shared `photo_studio` customer and project context.

## Command

- `generate_client_reply_draft`

## Input

```json
{
  "customer_id": "cust_20260420_ab12cd34",
  "project_id": "proj_20260420_ab12cd34",
  "scenario": "schedule_confirm",
  "tone": "warm",
  "extra_context": "请提醒客户准备两套服装。"
}
```

## Notes

- Supported scenarios: `initial_reply`, `quote_reply`, `schedule_confirm`, `shoot_notice`, `selection_notice`, `delivery_notice`, `followup`
- Supported tones: `professional`, `warm`, `premium`
- Project-bound scenarios require `project_id`.
