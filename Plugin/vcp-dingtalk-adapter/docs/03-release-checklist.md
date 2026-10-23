# vcp-dingtalk-adapter Release Checklist

## Functional Checks

- [ ] Direct message flow works (DingTalk -> adapter -> VCP -> DingTalk)
- [ ] Group mention flow works (`@bot` required)
- [ ] Text/image/file/audio inbound messages are parsed correctly
- [ ] Rich reply path works (text + optional media)

## Bridge and Routing Checks

- [ ] `VCP_USE_CHANNEL_BRIDGE=true` in production profile
- [ ] `VCP_CHANNEL_HUB_VERSION=b2`
- [ ] `VCP_CHANNEL_BRIDGE_URL` points to reachable bridge endpoint
- [ ] `VCP_ADAPTER_ID` matches Channel Hub registration
- [ ] `VCP_AGENT_NAME` resolves to an existing VCP agent

## Fallback Safety Checks

- [ ] Fallback path configured (`VCP_BASE_URL`, optional `VCP_API_KEY`) for emergency use
- [ ] Fallback request tested once with bridge temporarily disabled

## Observability and Security

- [ ] Debug flags are off in production unless troubleshooting
- [ ] No secrets are present in docs, screenshots, or shared logs
- [ ] Rollback procedure prepared (previous `.env` + restart)
