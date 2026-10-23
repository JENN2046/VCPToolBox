# Seamless communication R1 candidate

This is a separate feature branch, based on `8471844` (product blobs identical
to the reviewed `0e983f1` patch). It does not modify V1 or the existing Draft PR.

## Configuration publication

Enable `NativeMobileConfigSync=true` only in an isolated candidate host to
require an execution snapshot before accepting new jobs. Existing text-only
hosts retain their previous behavior when this opt-in is absent. Once a topic
has a published configuration, new jobs bind that snapshot even in legacy mode.

The existing host Bearer gate protects GET/POST
`/api/plugins/NativeSync/mobile/execution-configs`. Mobile cookies cannot
publish configurations. POST uses explicit identity, `expectedVersion`, and a
whitelist of private execution fields. Unchanged payloads are idempotent;
updates increment a server-owned version with compare-and-swap conflict checks.

`owner_execution_configs` resides in the same NativeSync SQLite, with immutable
rows `(topic_key,version,hash,config_json,created_at)`. It stores private prompt,
model parameters, Group DTO/member snapshots and Tavern rules, never API keys.
The host topic scope/native AgentManager retain identity and alias authority.
The table is not exposed by the mobile API. Old versions are retained because
accepted jobs may reference them; no automatic pruning/migration is provided.

An accepted job persists its complete private `config_snapshot` before writing
its user-message intent. Public task/catalog projections contain version/hash
and model display information only. Queued snapshots survive SQLite reopen.

The effective prompt is the desktop prompt. A prompt consisting exclusively of
the explicitly mapped native alias (`{{alias}}` or `{{agent:alias}}`) instead
uses a native AgentManager prompt snapshot captured at publication. Mixed Agent
authority and recursive Agent references are rejected; no second prompt is
appended. RAG, other native variables and tools still belong to the original
host handler. Group membership requires explicit host `memberAliases` bindings.

The accompanying desktop branch adds explicit `publishExecutionConfigs:true`
in the non-secret connection selection. Publication reads native DTOs through
the original managers, refreshes on a five-second check, and never serializes a
whole Agent config. The mobile screen displays the current configuration version.

## Validation boundary

2026-10-23: Ubuntu Node 24.14.1, 44 focused tests passed (42 ToolBox, 2 desktop
publisher tests), including real PluginManager on an isolated HTTPS fixture,
concurrency, cancellation, durable intents, restart, authorization, pagination,
private projection, version conflict and alias snapshot checks. Synthetic model
transport only. This is not the final full `server.js` or physical three-device
acceptance for this R1 candidate. A/B/C/D final milestones remain evidence-gated.

Author pure rules are deployed under `Plugin/NativeSync/nativeRules` with fixed
Git blob provenance. No Electron group runtime is copied to Ubuntu.
