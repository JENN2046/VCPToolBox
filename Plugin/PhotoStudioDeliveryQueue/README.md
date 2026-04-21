# Photo Studio Delivery Queue

Process the bounded local-shadow delivery queue for `photo_studio` external exports.

Supported actions:

- `list_due`
- `mark_queued`
- `mark_delivered`
- `mark_failed`
- `reschedule_retry`

This plugin stays local and updates `data/photo-studio/external_exports.json` only. It does not talk to real Sheet or Notion APIs.
