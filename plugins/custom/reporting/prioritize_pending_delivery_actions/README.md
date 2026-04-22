# prioritize_pending_delivery_actions

Read-only priority plugin for `photo_studio`.

It derives a bounded operator queue from existing local-shadow delivery records and surfaces:

- critical failed items
- retry-due items
- ready-to-queue work
- in-flight watch items

This plugin does not mutate queue state or call external systems.
