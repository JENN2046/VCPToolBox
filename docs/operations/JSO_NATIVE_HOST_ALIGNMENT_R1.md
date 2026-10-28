# JSO native host alignment candidate R1

Status: review candidate only. This is not a production native-write acceptance.

## Runtime base and review target

The observed 106.52.85.232 service uses upstream
`afc089973f0c34b6cab2d5d67f0f97f204ba7a56` plus an existing NativeSync overlay.
`codex/runtime-afc0899-base` at
`4b395e75f2ab29e16e189e7f9d7014137060ef3b` records that source baseline.
Review this candidate against that branch, not against the fork's main branch.
Merging this review branch does not upgrade main or deploy a service.

The accepted compatibility reference
`b0552cd3e109a8cfe38ac5ee292cc026891d7442` is a reference for the native
transport modules and tests. Its history diverges from the current runtime;
replacing/resetting the entire runtime to that reference would discard other
work. This candidate ports the host seams while preserving the captured
NativeSync listener, cancellation, approval wait, invocation settlement, prompt
snapshot and drain behavior. No dependency manifest or runtime config changes.

## Scope and security

- `server.js` mounts the existing loopback native route behind existing bearer
  authentication. `Plugin.js` supplies a host-owned, invocation-scoped loopback
  broker, cleans it up on process exit/error and does not accept JSON authority.
- Native stdio children receive only the existing sandbox's public config and
  expiring broker handle. Inherited provider secrets, JSO assistant credentials
  and application authorization remain in the host. Legacy plugin environment
  behavior is unchanged. Native async invocations do not log raw environments.
- `WebSocketServer.js` ports the reviewed transport provenance, socket/session
  binding, replay/unknown handling, native-frame log redaction, heartbeat and
  drain cleanup. Native heartbeat is 60 seconds. Ordinary heartbeat, when
  explicitly enabled, uses the reference's 20-second cadence (previously 60).
  Its existing default remains disabled. No forwarded header admits a socket.
- The current upstream has no external-root discovery API. The test fixture
  injects a temporary manifest registry entry using the existing built-in
  loader's fields. This proves parser/launcher/broker behavior; it does not
  prove production plugin discovery or enrollment.
- Trusted Action implementation profile `vcp_chat.c2` remains
  `PRODUCTION_DISABLED`. Synthetic fixture enrollment is TEST_ONLY. Imported
  authority modules and passing conformance tests do not activate a production
  admission store, enrollment UI, signing client or approval route.
- No JSO plugin manifest/policy, Owner delegation, credential, journal, receipt,
  business database, DNS or nginx change is included.

## Validation

Linux target host, Node 24.22.1, isolated `/tmp/jso-native-review-20261028-r1`,
without production settings/state: native host group 194/194 and Extensions
profile 38/38 passed with zero skips. Both use actual stdio processes; the latter
also stages the tracked local VCPChat transport and chart implementation source.
The initial 191 host tests also passed on Windows with no skips. Extensions
journal tests require Linux directory fsync; Windows EPERM is not treated as a
business failure or a passing substitute.

The existing upstream regression selection covers distributed timeout/cancel,
wrong-node result rejection, approval feedback and approval allowlist rules.
It initially had one failure on both baseline and candidate: its AST fixture
omitted the NativeSync overlay's imported `nativeExecutionContext`. The fixture
now supplies the real module, preserving the actual no-request behavior; all
32 tests pass. Three additional native-profile tests exercise live context
cancellation, unconfirmed settlement and rejection of forged JSO provenance.
The real stdio fixture rejects inherited synthetic secret/environment leakage.

CI invokes the immutable Extensions harness at
`a6c7d447ddaa29799c60aa109d5119b102d1eae4`; it does not repin the accepted release,
change the manifest/profile or use a candidate-owned conformance validator.
The independent existing-host job runs the 32 upstream regression tests.

## Gates before any production application

1. Complete code review and candidate CI. Record the exact reviewed commit.
2. Re-read all five live source hashes in
   `jso-native-host-runtime-baseline.json` and the upstream runtime HEAD. If any
   differs, stop and rebase the small patch on the new source. Do not reset,
   overwrite concurrent edits, or apply a whole repository checkout.
3. Capture and verify a rollback archive of every replacement file and original
   service metadata. New module paths must be absent or match an explicitly
   reviewed existing version. Preserve file ownership, mode, config and state.
4. Before registering a native manifest, block external nginx access to
   `/v1/native-conversation/`. A request proxied by local nginx has a loopback
   peer and must not bypass remote-client admission by using the HTTP fallback.
   Keep existing authenticated WebSocket handling; do not expose a new port.
5. Apply only reviewed files during a controlled VCP restart, preserving
   NativeSync's drain/unknown handling. Check ordinary VCP/NativeSync behavior,
   read-only JSO dispatch, original receipt IDs, credentials and journals.
   Restore only code/config backups if host checks fail; never roll back JSO
   business data because of a ToolBox host failure.
6. Keep JSO read-only/native inactive until the actual daily VCPChat build,
   trusted client admission and application session/identity path have been
   independently reviewed and tested. A local HTTP fixture cannot supply that
   evidence. Do not flip `PRODUCTION_DISABLED` as an operational workaround.
7. Any synthetic business mutation still requires a concrete human confirmation
   under the existing acceptance rules. The JSO proposalDecision receipt is
   outside the legacy scoped-reschedule adapter contract. Do not remove the
   resource/kind check to manufacture native receipt coverage.

Remaining acceptance: actual client/admission chain, scoped receipt acceptance,
isolated cross-host rollback with latest writes retained, fixture disposition
and final issue #89 review. The production acceptance issue stays open.

## PR review corrections

Two P2 findings were reproduced against the initial candidate and corrected:

- Enrollment claim verification now checks the consumed nonce's enrollment ID
  and key fingerprint against the selected approved record before consuming the
  proof or modifying enrollment/client state. Regression cases use both distinct
  keys and the same key for two enrollments; a rejected cross-target attempt
  leaves both legitimate proofs usable after their own human approval.
- The WebSocket dispatcher rejects all new native requests with SERVER_DRAINING
  once drain begins, including requests on already connected/bound sockets.
  Existing message/result settlement remains active. Real socket regression
  cases cover every native action and already dispatched success, failure and
  unknown outcomes without re-dispatch.

All six new regression cases failed before the fixes. After correction, the
native host profile has 200 passing tests and the existing-host selection has
32 passing tests (232 total, zero skips) on local Node. CI re-runs the immutable
four-component paired matrix for the updated candidate. These changes do not
activate production admission, native writes or any production deployment.

## Shutdown settlement correction

The server now tracks native WebSocket handler promises independently of socket
lifetime. `shutdown()` closes admission first and waits for those promises to
settle before closing the response sockets or allowing plugin teardown. This
also covers a client disconnecting while an execution is still running.

The native drain deadline is 30 seconds from the first `beginDrain()`, not a new
30-second period after the server's HTTP wait. This keeps both waits within the
existing outer 60-second shutdown guard. A native drain timeout logs
`NATIVE_EXECUTION_DRAIN_TIMEOUT` with the remaining count; it neither removes
pending identities nor marks them successful/cancelled or retries them. Late
settlement still removes its own promise normally. Recovery must use the
original operation receipt/unknown handling after restart. Socket close
handshakes get a separate five-second bound before transport termination so an
unresponsive peer cannot consume the remaining shutdown budget indefinitely.

The first seven new shutdown regressions reproduced premature closure/no wait
on the previous candidate. Ten new cases now cover connected/disconnected
success, rejection and unknown settlement, an unresponsive execution with a
partly spent/expired shared budget, a stuck socket close handshake, and the actual server gracefulShutdown
function holding plugin teardown/process exit until native settlement. The
local native/existing-host selection passes 242 tests with zero skips; CI runs
the updated candidate against the unchanged immutable paired harness.
