# WeeklyReportGenerator

Generate weekly reports from work logs/diary and export to DingTalk AI table.

## Key actions

- `generate_from_logs`
- `generate_from_diary`
- `export_to_table`

## Export path

`export_to_table` now uses:

1. `DingTalkCLI` `execute_tool` on `aitable`
2. fallback to deprecated `DingTalkTable` for compatibility

## Config

```env
VCP_API_URL=http://127.0.0.1:6005
VCP_API_KEY=your_vcp_api_key
DEFAULT_MODEL=Nova

DINGTALK_BASE_ID=your_base_id
DINGTALK_TABLE_ID=your_table_id
DINGTALK_WEEKLY_TABLE_WRITE_TOOL=record create
DWS_GRAY_STAGE=full_write

# legacy fallback only (DingTalkTable)
DINGTALK_TABLE_UUID=your_table_uuid
```

## Notes

- Keep `DingTalkCLI` enabled for the primary path.
- Keep `DingTalkTable` enabled during migration window.
- When `DWS_GRAY_STAGE=query_only` or `low_risk_write`, weekly export to AI table is blocked by policy (no fallback write bypass).
