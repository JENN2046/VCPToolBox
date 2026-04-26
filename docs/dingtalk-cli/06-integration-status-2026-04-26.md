# 06 Integration Status - 2026-04-26

## Summary

- Re-checked `DingTalkCLI` gray-stage policy and the WeeklyReport export call chain.
- Added a local gray-stage guard to `WeeklyReportGenerator.export_to_table` so legacy direct MCP export cannot bypass the DingTalk rollout policy.
- `DWS_GRAY_STAGE=query_only` and `DWS_GRAY_STAGE=low_risk_write` block WeeklyReport AI table export before any write attempt.
- `DWS_GRAY_STAGE=full_write` remains the only stage that may attempt the legacy MCP write path.

## Validation

- `node --check Plugin/WeeklyReportGenerator/WeeklyReportGenerator.js`
- Probe with `DWS_GRAY_STAGE=query_only`:
  - result: blocked before write execution
- Probe with `DWS_GRAY_STAGE=full_write` and `DINGTALK_MCP_URL=http://127.0.0.1:9`:
  - result: attempted MCP connection and failed with local connection refusal
  - no real DingTalk write was performed

## Current Boundary

- `DingTalkCLI` remains the rollout target for unified DWS execution and policy enforcement.
- `WeeklyReportGenerator` still contains the legacy MCP export implementation, but it is now guarded by the same gray-stage boundary.
- Cutting WeeklyReport to a true DingTalkCLI-primary path should be handled as a separate change because it affects plugin-to-plugin execution and live write behavior.

## Next Steps

1. Keep production gray rollout on `DWS_GRAY_STAGE=query_only` until query/read-only probes are stable.
2. Implement WeeklyReport DingTalkCLI-primary export in a dedicated change.
3. Retain `DingTalkTable`/legacy MCP only as temporary fallback after explicit write-stage approval.
