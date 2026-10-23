# vcp-dingtalk-adapter Quick Start

## Prerequisites

- Node.js `>=18`
- DingTalk bot app with valid `AppKey` and `AppSecret`
- Reachable VCP service (Channel Hub bridge preferred)

## Install

```powershell
cd A:\VCP\VCPToolBox\Plugin\vcp-dingtalk-adapter
npm install
```

## Configure

Create `.env` under `Plugin/vcp-dingtalk-adapter/` and set at least:

- `DING_APP_KEY`
- `DING_APP_SECRET`
- `VCP_USE_CHANNEL_BRIDGE=true`
- `VCP_CHANNEL_BRIDGE_URL`
- `VCP_CHANNEL_BRIDGE_KEY`
- `VCP_CHANNEL_BRIDGE_BEARER` (set to VCP backend `Key`)
- `VCP_CHANNEL_HUB_VERSION=b2`
- `VCP_ADAPTER_ID`
- `VCP_AGENT_NAME`

Optional fallback (used when bridge is disabled or unavailable):

- `VCP_BASE_URL`
- `VCP_API_KEY`
- `VCP_MODEL`
- `VCP_TIMEOUT_MS`

## Start

```powershell
npm start
```

Expected startup signals:

- `VCP DingTalk Adapter (New Architecture) Starting`
- `DingTalk Adapter initialized successfully`
- `VCP DingTalk Adapter is ready`

## Minimal Verification

1. Send direct text message from DingTalk and verify response.
2. Send group message and `@` the bot.
3. Send image/file/audio once and verify adapter receives and forwards it.

Important behavior:

- Group messages without `@bot` are ignored.
- Supported incoming types: `text`, `image`, `file`, `audio`.

## Dev Command

```powershell
npm run dev
```
