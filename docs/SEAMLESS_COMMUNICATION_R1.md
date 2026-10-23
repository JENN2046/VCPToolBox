# Seamless communication R1 candidate

> **NativeSync R2 产品定位：** 请先阅读 [NATIVE_SYNC_CONTINUITY_POSITIONING_R2.md](NATIVE_SYNC_CONTINUITY_POSITIONING_R2.md)。R1 文档记录已实现候选功能及其限定验收范围；R2 决定最终的跨终端连续性服务职责。R2 接入合同尚未实施和验收，不能将下述 R1 结果等同于 R2 通过。

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

The effective prompt is the desktop prompt. A template referencing only the
explicitly mapped native alias (`{{alias}}` or `{{agent:alias}}`) retains its
original prefix/suffix and native variable placeholders, while that alias uses
a native AgentManager prompt snapshot captured at publication. The original
native expansion/AgentGuard path performs the substitution. Foreign/recursive
Agent references and unknown explicit `agent:` references are rejected; no
second prompt is appended. RAG, other native variables and tools still belong
to the original host handler. Group membership requires explicit host
`memberAliases` bindings. Old exact-alias snapshots remain readable.

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

## Versioned control metadata

The existing upsert/Journal contract now accepts an independent `metadata`
envelope `{version,hash,fields}` only from the trusted host publication path.
Content identity/fingerprint remains unchanged. Same-hash metadata changes use
consecutive versions, compare-and-swap against the content hash and ordinary
Journal upsert events. Exact metadata retries do not append another event.
Legacy upserts preserve existing validated metadata; stale/conflicting versions
and metadata updates on tombstones are rejected.

`messages` and `journal` each add `metadata_version` (default 0) and
`metadata_hash`. These authority columns and the message projection commit in
the same transaction. Old JSON cannot self-assert authority by containing an
envelope-shaped field. All product readers project/validate the same columns.
No live database was migrated during development; upgrade fixtures are synthetic.

The bounded whitelist retains Checkpoint kind/version/body and the author's
diary/audit state, thinking flags, tool-call identity and attachment content
metadata. Checkpoint body must be present in the original user-message text.
There is no content rewrite or historical reimport.

Desktop Queue/Outbox capture compares metadata digest independently of content
hash; ACK/Pending retain its version and digest. New clients send
`X-NativeSync-Protocol: 2`. A legacy HTTP reader encountering validated metadata
receives `METADATA_PROTOCOL_UPGRADE_REQUIRED`, rather than silently stripping it.

Published tasks use the deployed author `effectiveContextHistory`, Checkpoint
predicate, timestamp projection, hidden-tool-result scanner and Tavern engine.
The original Checkpoint message body enters the model; complete history remains
in the Journal. Native ToolBox RAG/model/tool handling remains downstream.

2026-10-23: 90/90 focused Linux tests and fixed-source parity checks passed,
including same-hash backfill through the real desktop Queue, Pending recovery,
schema-upgrade forgery rejection and metadata durability. Final full-host/RAG
and physical three-device acceptance remain pending for this candidate.

## Attachments candidate

`NativeMobileAttachments=true` additionally requires versioned configuration.
The existing host Bearer namespace and mobile scoped session expose the same
CAS service, not another history store. Uploads use 64 KiB resumable chunks,
actual server-side SHA-256, type validation, fsync/atomic rename, idempotent
request identities and durable finalization state. The dedicated NativeSync
root owns `attachments/<hash-prefix>/<sha256>` and temporary uploads only.

Limits: 20 MiB per file, 8 submitted attachments, 512 MiB allocated storage,
16 unfinished uploads per principal, 200 starts/hour and 96 MiB HTTP request
budget/minute. Unassociated grants expire after 24 hours; bounded expiry cleanup
does not remove blobs retained by message/frame links. No real database or
production attachment tree was read or changed during development.

Blob existence does not grant access. Downloads name a scoped Topic/message/
attachment, never an arbitrary hash or host path. A verified upload grant must
associate with that actual message before download. Tombstoned/removed references
do not authorize reads. Mobile principals are the existing restricted sessions;
the existing shared host Bearer authority remains the desktop administrative
principal (no additional device credential registry is introduced).

Text/PDF extraction uses the existing PDFParse contract. Windows extraction
metadata remains independently versioned. Large native PDF image frames become
scoped CAS references under that same metadata envelope, retaining the original
message fingerprint. A legacy metadata client lacking `attachments-v1` receives
an explicit upgrade refusal. R1-B metadata digests remain readable.

Image model execution requires the effective model to appear in the host topic's
explicit `imageModels` list, captured in the immutable config version. Unknown or
unsupported image capability, missing/corrupt binary and unavailable PDF text
return explicit states. The original ChatCompletionHandler remains the executor.

The PWA uploads files, shows scoped previews/downloads/extracted text, retains
unconfirmed selections on the open page and resumes interrupted chunks. After a
page closes before submission, selecting the same file resumes its staged upload;
unsubmitted local file bytes are not durably cached by this UI. Accepted task
payloads are persisted, so reopening and checking/retrying the same submission
retains attachment IDs and does not execute another model request.

## Durable Group candidate (Phase D)

`NativeMobileConfigSync=true` admits explicitly scoped Group topics with the
original `ownerType`, owner/topic IDs and host-owned `memberAliases`. Private
versioned configurations retain native Group DTOs, ordered member snapshots,
stream/model parameters, active Tavern rules and the whitelisted execution
policy. Unavailable native member configurations are excluded from selection.
JEV/Game remain history-readable and return `GROUP_MODE_REQUIRES_DESKTOP`.

The existing ConversationExecution owns all scheduling, per-topic locks,
concurrency, cancellation and lifecycle. `mobile_execution_steps` extends its
same SQLite database; there is no second scheduler, timer or history writer.
Each accepted turn persists its configuration version and author-selected plan
before committing the user-message intent. Random plans are never selected
again after acceptance. Each member has a stable step/request/reply identity;
its result intent commits through CentralStore.apply before the next member.
Original group context windows apply only to requests, never persistent history.

The deployed pure author modules provide member selection, model resolution,
Tavern rules, speaker formatting conventions, timestamp/request-context
projection, stream delta precedence and watchdog notes. SOURCE_PROVENANCE.json
records byte mirrors and minimal extractions. A central Journal watcher is
truthfully identified as `storage:NativeSyncJournal`, with `filePath:null`;
it does not pretend to be a Windows file watcher. User Canvas placeholders are
explicitly unavailable in cloud requests. Desktop-only workspace/Canvas state
is not fabricated or implicitly copied to the server.

The original ToolBox HTTP handler still owns Agent expansion/AgentGuard, RAG,
variables, model routing, tools and approval decisions. Request-scoped frozen
native alias lookup preserves this AgentGuard path rather than inlining a
ToolBox Agent prompt. The middleware activates only internally registered
request IDs. Its observer exposes only waiting/started booleans and identity;
it neither approves tools nor changes approval policies. Cancelling a pending
request denies that original pending approval and fences later dispatch.

Known member HTTP failures append an identified `[System Message]` and continue
the original plan. Existing streamed text is retained. Header/idle timeout,
malformed/incomplete streams, host interruption or uncertain dispatched tools
pause dependent work without rerunning it. Original approval waits pause the
transport watchdog. The bounded idle timeout is configured by
`NativeMobileGroupIdleTimeoutMs` (default 62000, range 1000–300000 ms).

Only the owning mobile session can cancel or resolve its task. Private HTTP
`POST /mobile/api/conversations/:key/invitations` takes `{requestId,agentId}`.
`POST /mobile/api/executions/:id/resolve` accepts only
`{action:acknowledge_and_abandon_remaining}` after the person checks the original
host. It abandons that task's remaining steps and releases the dependency hold;
it never approves a tool or retries an uncertain step. Other sessions' queued
work is not cancelled. This adds no public MCP tool or schema.

The PWA separates Agent and Group identities, shows config versions and member
progress, supports manual invitations, cancellation and explicit abandonment.
Inviting a member preserves any unsent draft/files. Accepted attachment intents
pin their staged grants across TTL expiry and restart until the same Journal
intent associates them. No real database was inspected or changed in tests.

Safety adaptation: context/thought/hidden-tool filtering failure blocks model
execution. Automatic approval rejected a proposed catch-and-send fallback as a
possible disclosure path; that fallback was not applied. This deliberate
fail-closed behavior is covered by a negative-path test.

Current development validation: 125/125 Ubuntu Node24 focused tests, including
fixed-author-output parity, native PluginManager approval cancellation, Group
Scope, crash/cancel recovery, three-mode plans and attachment-intent lifetime.
An independent full `server.js` fixture additionally exercises native Agent,
variables, RAG direct diary, ContextFolding, multimodal bytes, three-member relay,
ordinary error continuation, a native read-only tool and restart without replay.
That fixture uses synthetic models. Additional original Windows Electron and
real provider acceptance is recorded in [the integrated report](R1_INTEGRATED_ACCEPTANCE.md),
with device limits kept explicit. [The release verdict](R1_RELEASE_VERDICT.md)
governs overall readiness; synthetic and API fixtures do not replace phones.
