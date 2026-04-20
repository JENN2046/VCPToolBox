# 04 Troubleshooting

## `health_check` fails with binary unavailable

Cause:
- `DWS_BIN` not installed or not in PATH

Fix:
1. install `dingtalk-workspace-cli`
2. set absolute `DWS_BIN` path
3. re-run `health_check`

## `auth_status` reports unauthenticated

Fix:
1. run `auth_login`
2. if `custom_app`, verify `DWS_CLIENT_ID`/`DWS_CLIENT_SECRET`
3. validate tenant permissions

## `execute_tool` validation error

Cause:
- missing required args
- unsupported product/tool

Fix:
1. run `schema_tool`
2. update `args`

## parse error on JSON output

Fix:
1. set `format=raw` to inspect upstream output
2. refine `jq` expression
3. verify tool supports JSON output

## write blocked unexpectedly

Cause:
- write operation without `apply=true`

Fix:
1. set `apply=true` for real write
2. keep default dry-run for gray verification

## schema refresh failed

Behavior:
- plugin returns stale cache when available

Fix:
1. verify DWS connectivity
2. run `schema_list` with `force_refresh=true`
3. inspect audit log and stderr