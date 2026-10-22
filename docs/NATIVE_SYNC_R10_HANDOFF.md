# R10 daily-use integration — implementation handoff

Current result: **BLOCKED on deployment conditions**. This is implemented candidate code with targeted checks, not `R10_DAILY_USE_ACCEPTANCE_PASS` or a live daily-use installation.

## Verified reality

- R9 source references are preserved: Chat `15e8675`, ToolBox `8862cf2`. R10 uses separate `codex/vcpchat-daily-r10` / `codex/vcptoolbox-daily-r10` worktrees under `P:/VCPKF/vcp/versions`.
- The user-specified `http://wp10.unicorn.org.cn:13546` responds with Express/Bearer 401 and an AdminPanel login redirect. Its HTTP identity is retained. Port 13546 rejects TLS; a trusted HTTPS connection on 443 could not be established. No credential was submitted there.
- Read-only wp08 inspection finds a complete `/app/VCPToolBox`, Node 24.14.1 and PluginManager service lifecycle support. NativeSync is absent. The public HTTP responses match wp08's local port 6005 responses, but this does **not** prove their deployment/forwarding identity; authoritative mapping is still needed.
- Production Plugin.js and ChatCompletionHandler source hashes match the tested runtime; AgentManager and server.js differ. The host patch is generated against actual production bytes and preserves CRLF. It adds three host hooks only: mobile dispatch before global Key parsing, same-host execution endpoint, and drain notification. No replacement of production server.js, model routing or AgentManager is proposed.
- The actual Windows source is a different baseline with existing uncommitted customizations. A read-only native-sync patch applicability check passes; user source, Rust binary and data have not been modified.
- The user selected two existing Agents and four existing topics. Local read-only preflight fingerprints 189 messages; IDs, content and timestamps are preserved. No real history has entered a central store. Actual selection/title/ID/fingerprint evidence stays in the task artifact area, outside source Git.
- Four selected historical messages have attachment metadata. Source files/attachments remain untouched; this candidate retains the existing text-only mobile scope and does not migrate attachment files or claim mobile attachment rendering. The selected source's timestamp ordering is strictly consistent with its message order.

## Implemented changes

- PWA settings: editable backend URL, connection test, server identity/status, transient manual Key input, save/reauthenticate, disconnect/revoke and pairing fallback. A verified HTTPS/mobile service must explicitly enable the Key field. Public backend input is never an arbitrary forwarding URL.
- Same-host Key exchange: only the configured approved backend identity is accepted. Compare against the existing host authority in memory, issue the existing opaque limited-scope HttpOnly/Secure/SameSite cookie, remove submitted Key from the parsed request, and never store it in the frontend, URL, cache or session database. Exchange defaults off. A local HTTPS reverse proxy must be trusted and strip spoofed forwarding headers; do not enable before the actual topology is verified.
- Session token rotation preserves device identity/task ownership; revocation invalidates the current device. Last selected topic is persisted in the existing central SQLite session metadata, not browser storage.
- Agent/topic catalog: only configured allowlisted identities; metadata publication cannot change Agent aliases, server models or permissions. Missing executable server configuration is shown as read-only and rejected before queuing. Only projected names, old IDs, timestamps and bounded image data are published.
- PWA Agent/topic selectors, complete paged text history, incremental refresh/deletion, preserved reading position and topic-bound submission retries. No new conversation IDs or chat database.
- Existing execution pipeline remains the host's `/v1/chat/completions` plus AgentManager. Long histories forward `contextTokenLimit` to the original host context manager. Uncertain interrupted executions are marked `EXECUTION_INTERRUPTED_REVIEW_REQUIRED`, never automatically retried. Queued work and durable preparing/publishing intents retain their existing recovery paths.
- Desktop daily opt-in: a non-secret `.native-sync/connection.json` explicitly binds selected topics and loopback SSH transport to the existing desktop settings authority. First attachment verifies approved source fingerprints and all remote selected-message hashes/tombstones before capture can enqueue anything. Conflicts stop; existing IDs and source files are preserved. Redirects on native requests are refused. R8 shared-topic Queue/CDS/MobileSync exclusion remains unchanged.

## Validation actually run

- Fourteen focused tests pass on Ubuntu in `/home/admin/VCPKF/vcp/artifacts/native-sync-r10/source`: approved backend/HTTPS/Origin/auth boundaries, scoped metadata, session rotation/revocation/reopen, selected-topic restore, read-only Agent refusal, uncertain-execution recovery, long-history forwarding, desktop opt-in/first-import conflicts and credential-free catalog projection.
- PWA production build passes on Ubuntu with the declared dependency lock, install scripts disabled and task-local dependencies. Public output hashes are recorded by `FRONTEND_BUILD.json`.
- The built settings component was opened in a local browser fixture. Editable HTTP backend and disabled credential/save controls were observed; connection test correctly reports protected-host-not-ready. `settings-protected-gate-preview.png` is **component evidence only**, not real server, Android or daily-use acceptance. No Key, model or real chat entered that fixture. It is closed.
- Production host patch `git apply --check` passes against `/app/VCPToolBox`; Windows candidate patch also passes a read-only applicability check. Neither was applied. An initial host patch generation normalized CRLF incorrectly; the preparation tool now preserves actual bytes and the final dry-run passes.
- R7–R9 full isolated suites were not repeated and are not claimed as fresh R10 validation. Their passed baseline remains separate.

## Reproduce safe checks

The task artifact root is `P:/VCPKF/vcp/artifacts/native-sync-r10`; Ubuntu root is `/home/admin/VCPKF/vcp/artifacts/native-sync-r10`. For the exported candidate source:

```sh
cd /home/admin/VCPKF/vcp/artifacts/native-sync-r10/source
TMPDIR=/home/admin/VCPKF/vcp/artifacts/native-sync-r10 \
NODE_PATH=/home/admin/VCPKF/vcp/artifacts/native-sync-r6/deps/node_modules \
node --test tests/r10-mobile-connection.test.cjs tests/native-sync-daily.test.cjs
node scripts/build-mobile-daily.cjs
```

`scripts/prepare-native-sync-r10-host.py` is a read-only wp08 patch generator/checker. It never installs or restarts. The generated minimal patch is retained in the artifact area with expected production before/after hashes. This is not evidence of a deployed version.

## Required continuation

1. The user fills `CONNECTION_INPUT.example.json` with the stable trusted HTTPS origin, actual backend host/mapping and management mechanism; no secrets in this file. Verify ownership, TLS and the protected path to HTTP before enabling Key exchange. Do not replace the specified backend with HTTPS or a random temporary domain.
2. Verify the mapped host and existing provider/model availability through an authorized protected path. Bind the selected desktop identities to the existing server aliases/models; do not copy Agent private config or overwrite model channels.
3. Finalize exact release files, preview the non-secret configuration, and obtain the user's production restart window as required by R10 E2. Back up actual impacted files and selected history with a verified restore path before installation/first import. The current preparation is not a backup or rollback execution receipt.
4. Apply the checked minimal host/client changes while preserving user customizations and the original Rust binary. Enable only the four selected topics, compare initial source/central IDs/order/content, then perform real mobile/Windows bidirectional and restart tests.
5. Install/launch under the stable production origin and exercise actual manual connection credentials, old-topic continuation, detached execution, reconnect, Outbox, CDS indexing, cancellation and duplicate prevention. `IOS_NOT_RUN` until a physical iPhone is available.

Real R10 model calls, real-history import, production installation/restart/rollback and Android daily-use verification are **NOT RUN**. No Push/Merge, production modification, Rust change or credential extraction has occurred. There is no stable live mobile URL to deliver yet.
