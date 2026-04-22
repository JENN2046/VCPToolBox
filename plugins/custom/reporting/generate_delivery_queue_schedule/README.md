# generate_delivery_queue_schedule

Read-only scheduling plugin for `photo_studio`.

It derives bounded schedule windows from existing local-shadow delivery records and surfaces:

- immediate queue work
- future retry windows
- recommended operator actions

This plugin does not mutate queue state or call external systems.
