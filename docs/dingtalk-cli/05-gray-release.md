# 05 Gray Release Guide

## Phase Plan

1. Phase 1 (`DWS_GRAY_STAGE=query_only`): query only, block all write tools.
2. Phase 2 (`DWS_GRAY_STAGE=low_risk_write`): allow writes for `todo`/`ding`/`chat` only.
3. Phase 3 (`DWS_GRAY_STAGE=full_write`): allow full write scope (including `calendar` and `aitable`).

## Runtime Controls

- `DingTalkCLI` enforces gray stage in `execute_tool` after command alias resolution.
- `apply` gate remains unchanged:
  - `dry_run=true` default
  - `apply=true` forces `dry_run=false`
- `WeeklyReportGenerator` follows the same gray stage and blocks table export in phase 1/2.

## Phase-1 Runbook (Query-Only)

1. Set `Plugin/DingTalkCLI/config.env`:
   - `DWS_GRAY_STAGE=query_only`
2. Restart VCPToolBox plugin host / service process.
3. Verify with probes:
   - `health_check` returns `gray_stage=query_only`
   - one query command succeeds
   - one write command returns `category=security`
4. During phase 1, keep write workflows disabled in production prompts/playbooks.

## Acceptance Gates

- no P0/P1 incidents
- audit log completeness is 100%
- query success rate reaches organization baseline
- write requests in phase 1 are fully blocked and traceable in audit logs

## Rollback

1. Emergency rollback to strict mode: keep `query_only` and disable all write-entry prompts.
2. Forward rollback to previous state: switch to `full_write` only after approval.
3. Compatibility fallback is allowed for reads only; do not bypass write policy with legacy plugin calls.

## Observability Signals

- command failure ratio by `category`
- policy block count (`security` category, gray-stage reason)
- auth failure ratio
- timeout ratio
- workflow checkpoint stalls
