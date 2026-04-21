# PhotoStudioFollowupReminder

Creates structured internal reminders for an existing `photo_studio` project without syncing to any external scheduler.

## Command

- `create_followup_reminder`

## Input

```json
{
  "project_id": "proj_ab12cd34",
  "reminder_type": "delivery_followup",
  "due_date": "2026-05-28",
  "note": "Confirm the client can access the gallery."
}
```

## Notes

- Supported reminder types: `quotation_followup`, `delivery_followup`, `revisit`
- Writes records into `data/photo-studio/reminders.json`
- Re-running the same pending reminder type for the same project returns the existing reminder instead of duplicating it
- Does not create calendar, DING, or external message side effects
