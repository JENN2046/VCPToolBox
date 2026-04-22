# inspect_delivery_audit_trail

Read-only audit inspection plugin for `photo_studio`.

It derives a timeline from existing local-shadow delivery records and helps operators inspect:

- record creation
- current delivery state
- retry scheduling
- failed or acknowledged delivery snapshots

This plugin does not mutate queue state or call external systems.
