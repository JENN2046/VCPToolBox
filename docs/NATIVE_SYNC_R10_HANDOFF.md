# R10 daily-use integration — implementation handoff

Current phase: **BLOCKED — R10_TLS_CERTIFICATE_REQUIRED**. The final public origin is exclusively `https://wp10.unicorn.org.cn:13848`, mapped to port8888. The earlier HTTP startup proof is historical and superseded: that listener is stopped. No public HTTP fallback, external hosting or new gateway framework is authorized. The final mobile login requires only one manually entered Key.

## Verified reality

- R9 source references are preserved: Chat `15e8675`, ToolBox `8862cf2`. R10 uses separate `codex/vcpchat-daily-r10` / `codex/vcptoolbox-daily-r10` worktrees under `P:/VCPKF/vcp/versions`.
- The user-specified `http://wp10.unicorn.org.cn:13546` responds with Express/Bearer 401 and an AdminPanel login redirect. Its HTTP identity is retained. Port 13546 rejects TLS; a trusted HTTPS connection on 443 could not be established. No credential was submitted there.
- Read-only wp08 inspection finds a complete `/app/VCPToolBox`, Node 24.14.1 and PluginManager service lifecycle support. NativeSync is absent. The existing Cephalon port table now authoritatively confirms `6005 → wp10:13546` and `8888 → wp10:13848` using TCP. Only that port-table projection is persisted.
- Production Plugin.js and ChatCompletionHandler source hashes match the tested runtime; AgentManager and server.js differ. The host patch is generated against actual production bytes and preserves CRLF. It adds three host hooks only: mobile dispatch before global Key parsing, same-host execution endpoint, and drain notification. No replacement of production server.js, model routing or AgentManager is proposed.
- The actual Windows source is a different baseline with existing uncommitted customizations. A read-only native-sync patch applicability check passes; user source, Rust binary and data have not been modified.
- The user selected two existing Agents and four existing topics. Local read-only preflight fingerprints 189 messages; IDs, content and timestamps are preserved. No real history has entered a central store. Actual selection/title/ID/fingerprint evidence stays in the task artifact area, outside source Git.
- Four selected historical messages have attachment metadata. Source files/attachments remain untouched; this candidate retains the existing text-only mobile scope and does not migrate attachment files or claim mobile attachment rendering. The selected source's timestamp ordering is strictly consistent with its message order.

## Implemented changes

- PWA settings: editable backend URL, connection test, server identity/status, transient manual Key input, save/reauthenticate, disconnect/revoke and pairing fallback. A verified HTTPS/mobile service must explicitly enable the Key field. Public backend input is never an arbitrary forwarding URL.
- Same-host Key exchange: only the configured approved backend identity is accepted. Compare against the existing host authority in memory, issue the existing opaque limited-scope HttpOnly/Secure/SameSite cookie, remove submitted Key from the parsed request, and never store it in the frontend, URL, cache or session database. Exchange defaults off. The separate R10 host requires a validated TLS listener and does not trust forwarded headers.
- Session token rotation preserves device identity/task ownership; revocation invalidates the current device. Last selected topic is persisted in the existing central SQLite session metadata, not browser storage.
- Agent/topic catalog: only configured allowlisted identities; metadata publication cannot change Agent aliases, server models or permissions. Missing executable server configuration is shown as read-only and rejected before queuing. Only projected names, old IDs, timestamps and bounded image data are published.
- PWA Agent/topic selectors, complete paged text history, incremental refresh/deletion, preserved reading position and topic-bound submission retries. No new conversation IDs or chat database.
- Existing execution pipeline remains the host's `/v1/chat/completions` plus AgentManager. Long histories forward `contextTokenLimit` to the original host context manager. Uncertain interrupted executions are marked `EXECUTION_INTERRUPTED_REVIEW_REQUIRED`, never automatically retried. Queued work and durable preparing/publishing intents retain their existing recovery paths.
- Desktop daily opt-in: a non-secret `.native-sync/connection.json` explicitly binds selected topics and loopback SSH transport to the existing desktop settings authority. First attachment verifies approved source fingerprints and all remote selected-message hashes/tombstones before capture can enqueue anything. Conflicts stop; existing IDs and source files are preserved. Redirects on native requests are refused. R8 shared-topic Queue/CDS/MobileSync exclusion remains unchanged.

## Validation actually run

- Twenty focused tests pass on Ubuntu in `/home/admin/VCPKF/vcp/artifacts/native-sync-r10/source`: approved backend/HTTPS/Origin/auth boundaries, scoped metadata, session rotation/revocation/reopen, selected-topic restore, read-only Agent refusal, uncertain-execution recovery, long-history forwarding, desktop opt-in/first-import conflicts, credential-free catalog projection, encrypted host credential recovery, history-import gating and TLS-only server/desktop transport. TLS fixtures use ephemeral synthetic certificates and process-local trust; they do not prove the public certificate or change device/system trust.
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
node --test tests/r10-mobile-connection.test.cjs tests/native-sync-daily.test.cjs tests/r10-gateway.test.cjs
node scripts/build-mobile-daily.cjs
```

`scripts/prepare-native-sync-r10-host.py` is a read-only wp08 patch generator/checker. It never installs or restarts. The generated minimal patch is retained in the artifact area with expected production before/after hashes. This is not evidence of a deployed version.

## Required continuation

1. Manual connection-file filling is superseded by the user's Key-only requirement. Existing Cephalon mapping is confirmed. Finish trusted HTTPS inside the existing-server boundary before enabling Key input; no Render or random-tunnel fallback. The shared domain's TLS certificate or platform HTTPS termination is the remaining unavailable authority.
2. Verify existing provider/model availability through the approved protected path after the single manual Key entry. Bind the selected desktop identities to the existing server aliases/models; do not copy Agent private config or overwrite model channels.
3. Finish the separately installed R10 release. It does not require restarting the existing full ToolBox; the earlier three-hook production patch remains an unapplied alternative. Any later change requiring an existing production restart still needs the R10 E2 window. Back up the actual impacted client files and selected history before installation/first import.
4. Apply the checked client changes while preserving user customizations and the original Rust binary. Enable only the four selected topics, compare initial source/central IDs/order/content, then perform real mobile/Windows bidirectional and restart tests.
5. Install/launch under the stable production origin and exercise actual manual connection credentials, old-topic continuation, detached execution, reconnect, Outbox, CDS indexing, cancellation and duplicate prevention. `IOS_NOT_RUN` until a physical iPhone is available.

Real R10 model calls, real-history import, existing-ToolBox/client installation or restart and Android daily-use verification are **NOT RUN**. The separate R10 host is installed but stopped pending the real certificate. No Push/Merge, existing ToolBox modification, Rust change or production credential extraction has occurred.

## Existing-server deployment on port 8888

- Runtime source: `/home/admin/VCPKF/vcp/versions/vcptoolbox-daily-r10`; private persistent state: `/home/admin/VCPKF/vcp/runtime-data/native-sync-r10`. Only the real NativeSync service is loaded by the existing PluginManager dependency closure. It reuses the original production AgentManager module read-only and executes through the original full ToolBox at `http://127.0.0.1:6005/v1/chat/completions`; no second model/tool/Agent implementation or KB host starts.
- Dedicated PM2 namespace/home manages only `vcp-mobile-r10`, with restart backoff and saved process descriptor. Existing production PM2/apps and port6005/13546 are untouched. Container/OS reboot autostart is not claimed.
- Backend Key is never extracted from production config.env. After HTTPS is ready, the user-entered Key is verified against the loopback full-ToolBox models endpoint, encrypted with AES-GCM in the same central SQLite and restored server-side using a private mode0600 master file. Those private files/values must not be read, copied into artifacts or committed. Cookie sessions remain limited/revocable.
- The first-use UI auto-tests its configured backend and folds address settings. The user supplies only the Key. Until trusted HTTPS is available, Key submission remains disabled. Selected original message IDs gate model execution until their history materializes; tombstones preserve that readiness after later deletion.
- Historical HTTP public/local probes matched before the HTTPS-only instruction. They do not satisfy the current acceptance. The current listener refuses legacy HTTP profiles and requires `httpsOrigin` plus existing `tls.certFile` / `tls.keyFile` paths. Node's existing HTTPS implementation terminates TLS directly on8888, verifies SAN, validity, key match and OS-trusted chain before plugin/database initialization, and opens no cleartext listener. The original13546 backend remains HTTP and is reached only over loopback6005 by this host.
- The daily desktop SSH forward carries TLS to the same8888 listener. Requests use the public SNI/hostname and normal CA verification through the existing adapter's request override; they do not fall back to HTTP, ignore certificate errors or change the NativeSync wire protocol.
- Existing-server HTTPS inspection found a private IPv4-only container, no existing certificate/ACME/proxy installation in the checked standard locations, and only TCP mapping controls. The shared `wp10.unicorn.org.cn` DNS/80/443 authority is unavailable through current SSH/port controls. Port13848 alone cannot satisfy normal ACME HTTP01/TLS-ALPN01 validation. No self-signed bypass, phone certificate/security change, or external hosting fallback is used.
- Current deployment and source hashes, management commands, own-service restart receipt and tests are indexed in the R10 artifact report. Rollback stops only the dedicated R10 PM2 app and retains its database; it never restores over newer user history or touches the original backend.

The actual remaining external prerequisite is certificate/domain authority for `wp10.unicorn.org.cn` (or platform-managed TLS termination for this exact mapping). Current container SSH and TCP port controls do not provide it. Do not request a Key or import real history until a normal client verifies the actual public HTTPS endpoint. Do not overwrite the TLS-only guard with the historical HTTP backup during rollback.
