# 07 WeeklyReport Cutover Checklist

## Goal

- Cut WeeklyReport export path to `DingTalkCLI` as primary.
- Keep compatibility fallback while preventing policy bypass in gray phase 1.

## Current Call Chain

1. `WeeklyReportGenerator` action `export_to_table`
2. primary: `PluginManager.executePlugin("DingTalkCLI", action=execute_tool)`
3. fallback: `PluginManager.executePlugin("DingTalkTable", action=add_record)` (legacy compatibility)

## Phase-1 Query-Only Checklist

1. Set gray policy:
   - `Plugin/DingTalkCLI/config.env`: `DWS_GRAY_STAGE=query_only`
   - `Plugin/WeeklyReportGenerator/config.env`: `DWS_GRAY_STAGE=query_only` (optional but recommended for local consistency)
2. Restart plugin host.
3. Validation:
   - `generate_from_logs` and `generate_from_diary` succeed
   - `export_to_table` is blocked with policy error
   - no fallback write is executed when blocked by security policy
4. Observability:
   - audit records include blocked write requests
   - no unexpected `DingTalkTable` write in phase-1 window

## Cutover Steps (When Entering Write Phase)

1. Move to approved stage:
   - phase 2: `DWS_GRAY_STAGE=low_risk_write` (WeeklyReport still blocked because `aitable` is high-risk)
   - phase 3: `DWS_GRAY_STAGE=full_write` (WeeklyReport export allowed)
2. Keep `DingTalkTable` enabled only as temporary fallback.
3. Run smoke cases:
   - export success via `DingTalkCLI`
   - failure path returns clear error mapping (`category/reason/hint/actions`)
4. If stable, deprecate fallback by policy and remove `DINGTALK_TABLE_UUID` dependency from deployments.

## Rollback

1. Immediate: set `DWS_GRAY_STAGE=query_only` and restart service.
2. Keep report generation (without export) available.
3. Reopen export only after issue root-cause and acceptance review.
