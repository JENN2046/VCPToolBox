# 03 Operations

## Required Environment

- `DWS_BIN`
- `DWS_MIN_VERSION` (`>=1.0.8`)
- `AUTH_MODE` (`auto|org|custom_app`)
- `DWS_GRAY_STAGE` (`query_only|low_risk_write|full_write`)
- `DWS_CLIENT_ID`
- `DWS_CLIENT_SECRET`
- `DWS_TRUSTED_DOMAINS`
- `AUDIT_LOG_PATH`

## Boot Checklist

1. Ensure `dws --version` is available on host.
2. Set plugin `config.env` from `config.env.example`.
3. Run `health_check`.
4. Run `auth_status`; if unauthenticated run `auth_login`.
5. Run `schema_list` and verify expected products/tools.

## Audit Logging

Audit log format is JSONL. Required fields include:

- request ID
- operator
- command/args summary
- result category
- duration
- mapped error

## Security Gate

- write-like tools default to dry-run
- real write requires `apply=true`
- gray-stage policy can block writes even with `apply=true`
- URL args can be restricted by `DWS_TRUSTED_DOMAINS`
- oversized payload and large batch arrays are blocked

## Compatibility Mode

`DingTalkTable` remains callable during migration and forwards to DingTalkCLI.
