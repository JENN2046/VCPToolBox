# generate_delivery_operator_report

Read-only delivery visibility plugin for `photo_studio`.

It summarizes the current local-shadow delivery queue and surfaces:

- operator alerts
- stalled or retry-due exports
- ready / queued / failed / delivered counts

This plugin does not write to external systems.
