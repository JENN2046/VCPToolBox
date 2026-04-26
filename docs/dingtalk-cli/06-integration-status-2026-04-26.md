# 06 Integration Status - 2026-04-26

## Summary

- Re-checked `DingTalkCLI` gray-stage policy and the WeeklyReport export call chain.
- Added a local gray-stage guard to `WeeklyReportGenerator.export_to_table` so legacy direct MCP export cannot bypass the DingTalk rollout policy.
- `DWS_GRAY_STAGE=query_only` and `DWS_GRAY_STAGE=low_risk_write` block WeeklyReport AI table export before any write attempt.
- `DWS_GRAY_STAGE=full_write` remains the only stage that may attempt the legacy MCP write path.
- Updated DingTalkCLI and WeeklyReport defaults to `query_only` so missing runtime config fails closed instead of allowing writes.
- Updated `WeeklyReportGenerator.export_to_table` to use DingTalkCLI as the primary path; legacy MCP is now explicit fallback only.

## Validation

- `node --check Plugin/WeeklyReportGenerator/WeeklyReportGenerator.js`
- Probe with `DWS_GRAY_STAGE=query_only`:
  - result: blocked before write execution
- Probe with `DWS_GRAY_STAGE=full_write` and `DINGTALK_MCP_URL=http://127.0.0.1:9`:
  - result: attempted MCP connection and failed with local connection refusal
  - no real DingTalk write was performed
- Probe without `DWS_GRAY_STAGE`:
  - DingTalkCLI default: `query_only`
  - write gate: blocked
  - read gate: allowed
  - WeeklyReport export: blocked before write execution
- Probe WeeklyReport primary path:
  - default backend: DingTalkCLI
  - query-only response: DingTalkCLI structured security error
  - legacy fallback is not attempted after DingTalkCLI security/policy blocks
  - legacy backend remains blocked unless `full_write`

## Current Boundary

- `DingTalkCLI` remains the rollout target for unified DWS execution and policy enforcement.
- `WeeklyReportGenerator` still contains the legacy MCP export implementation, but it is now guarded by the same gray-stage boundary and disabled unless explicitly selected/fallback-enabled.

## Next Steps

1. Keep production gray rollout on `DWS_GRAY_STAGE=query_only` until query/read-only probes are stable.
2. Run full_write smoke in an approved environment with `apply=false` first, then `apply=true` only after explicit write approval.
3. Retain legacy MCP only as temporary fallback after explicit write-stage approval.
