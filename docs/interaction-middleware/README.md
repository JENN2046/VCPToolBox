# Interaction Middleware Docs

This folder is the canonical home for VCP interaction-middleware documentation.

## What this is

VCP is the middle layer for multi-platform interaction:
- ingest events from QQ, DingTalk, WeCom, Feishu, web, and internal API callers
- normalize them into a shared event/session model
- route them to agents, tools, workflows, or plugins
- normalize replies and deliver them back to the originating platform
- keep control-plane features such as config, metrics, audit, retries, and dead letters separate from data-plane processing

## Current state

- Core `ChannelHub` control plane is implemented.
- Inbound event normalization, session binding, identity mapping, routing, runtime invocation, reply normalization, and outbox storage are in place.
- Outbound delivery now requires a real adapter runtime instance and a supported send method, so the pipeline no longer reports fake success.
- `messageProcessor.js` now fully resolves recursive `SarPrompt` and `Tar/Var` file content.
- A small regression test file covers the highest-risk `messageProcessor` paths.

## Recommended reading order

1. [`VCP_INTERACTION_MIDDLEWARE_TARGET.md`](./VCP_INTERACTION_MIDDLEWARE_TARGET.md)
2. [`VCP_INTERACTION_MIDDLEWARE_SCHEMA.md`](./VCP_INTERACTION_MIDDLEWARE_SCHEMA.md)
3. [`CHANNEL_MIDDLEWARE_DESIGN.md`](./CHANNEL_MIDDLEWARE_DESIGN.md)
4. [`CHANNEL_MIDDLEWARE_IMPLEMENTATION_PLAN.md`](./CHANNEL_MIDDLEWARE_IMPLEMENTATION_PLAN.md)
5. [`CHANNEL_MIDDLEWARE_FILE_TODOS.md`](./CHANNEL_MIDDLEWARE_FILE_TODOS.md)
6. [`ASTRBOT_QQ_VS_CHANNELHUB.md`](./ASTRBOT_QQ_VS_CHANNELHUB.md)
7. [`CHANNEL_HUB_USER_GUIDE.md`](./CHANNEL_HUB_USER_GUIDE.md)
8. [`UPDATE_2026-03-24.md`](./UPDATE_2026-03-24.md)

## Templates

- [`CHANNEL_HUB_ADAPTER_CONFIG_TEMPLATE.json`](./CHANNEL_HUB_ADAPTER_CONFIG_TEMPLATE.json)
- [`CHANNEL_HUB_ADAPTER_CONFIG_TEMPLATE.jsonc`](./CHANNEL_HUB_ADAPTER_CONFIG_TEMPLATE.jsonc)
- [`CHANNEL_HUB_BINDING_TEMPLATE.json`](./CHANNEL_HUB_BINDING_TEMPLATE.json)
- [`CHANNEL_HUB_BINDING_TEMPLATE.jsonc`](./CHANNEL_HUB_BINDING_TEMPLATE.jsonc)

## Notes

- The older root-level copies are compatibility artifacts and should not be treated as the canonical entry point.
- If you are updating docs, prefer this folder and keep the links consistent with the implementation state.
