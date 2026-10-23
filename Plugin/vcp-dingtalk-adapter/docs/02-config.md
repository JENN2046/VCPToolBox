# vcp-dingtalk-adapter Configuration

## Config File

- Runtime env file: `Plugin/vcp-dingtalk-adapter/.env`
- Note: this plugin currently has no committed `.env.example` in the directory.

## Required Keys

| Key | Required | Default | Notes |
|---|---|---|---|
| `DING_APP_KEY` | Yes | none | DingTalk app key |
| `DING_APP_SECRET` | Yes | none | DingTalk app secret |
| `VCP_USE_CHANNEL_BRIDGE` | No | `false` (if unset) | Set `true` to use bridge path |
| `VCP_CHANNEL_BRIDGE_URL` | Bridge mode | none | Bridge endpoint URL |
| `VCP_CHANNEL_BRIDGE_KEY` | Usually | empty | Required when bridge auth is enabled |
| `VCP_CHANNEL_BRIDGE_BEARER` | Recommended | empty | Bearer token for `/internal/channelHub/*` global auth; should match `config.env` `Key` |
| `VCP_CHANNEL_HUB_VERSION` | No | `b2` (from entrypoint) | `b1` or `b2`; recommend `b2` |
| `VCP_ADAPTER_ID` | No | `dingtalk-adapter-01` | Must align with Channel Hub registration |
| `VCP_AGENT_NAME` | Recommended | none | Real VCP agent id/name |
| `VCP_AGENT_DISPLAY_NAME` | No | none | Display label |

## Fallback Chat Keys (OpenAI-compatible path)

| Key | Required in fallback | Default | Notes |
|---|---|---|---|
| `VCP_BASE_URL` | Yes | none | Base URL for fallback chat endpoint |
| `VCP_API_KEY` | Optional | empty | Bearer token for fallback endpoint |
| `VCP_MODEL` | No | `Nova` | Fallback model |
| `VCP_TIMEOUT_MS` | No | `120000` | Request timeout |

## Debug Keys

| Key | Default | Purpose |
|---|---|---|
| `DING_STREAM_SDK_PACKAGE` | auto-select | Force a specific DingTalk stream SDK package |
| `DING_DEBUG_RAW_EVENT` | `false` | Log raw stream events |
| `VCP_DEBUG_RAW_RESPONSE` | `false` | Log raw VCP responses |
| `VCP_DEBUG_RICH_REPLY` | `false` | Log parsed rich reply payload |
| `LOG_LEVEL` | `info` | `debug|info|warn|error` |

## Bridge Behavior Notes

- When bridge mode is enabled and URL exists, adapter sends by bridge.
- Bridge requests include `Authorization: Bearer <token>` when `VCP_CHANNEL_BRIDGE_BEARER` is configured.
- If `VCP_CHANNEL_BRIDGE_BEARER` is empty, adapter falls back to `VCP_API_KEY` as bridge bearer.
- If bridge mode is disabled (or URL missing), adapter falls back to OpenAI-compatible chat path.
- In bridge B2 mode, adapter posts ChannelEventEnvelope format.

## Security Notes

- Do not commit `DING_APP_SECRET`, `VCP_API_KEY`, or bridge keys.
- Keep production secrets in local `.env` only.
