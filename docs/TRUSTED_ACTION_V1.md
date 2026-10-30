# Trusted Action v1

**Protocol owner:** VCPToolBox. **Contract version:** 1.

This is the normative boundary for the existing trusted-action lifecycle:

`capture → preview/propose → present → human-confirm → dispatch-once → reconcile/recover`

It describes the accepted implementation; it does not install a new authorization
service, enable a disabled client profile, or replace target-system permissions.
MUST / MUST NOT identify conformance requirements. The lifecycle is a composition
of owners, not a new wire format or one class implementing every stage.

## Ownership and compatibility

| Owner | Responsibility | Existing implementation |
| --- | --- | --- |
| Client host | Capture physical human input, bind source/message generation, verify current presentation, retire edited/replaced input | VCPChat native conversation IPC and trusted conversation service |
| ToolBox approval host | Authenticate human context, snapshot exact arguments, attest intent, bind and consume one invocation receipt | `modules/approvalReceiptAuthority.js`, `modules/humanClientAdmission.js` |
| ToolBox native transport | Admit a native channel, bind source/plan eligibility to its connection, keep credentials out of tool JSON, preserve business results | `modules/nativeConversationTransport.js`, `modules/nativeConversationWebSocket.js`, `WebSocketServer.js` |
| Application adapter | Bind proposal/presentation to original source, persist cancellation and operation identity where recovery is promised, reconcile original receipts | The configured native conversation adapter; not a second ToolBox authority |
| Target system | Authenticate its own caller, authorize scope, enforce business preconditions and own durable commit/receipt truth | The target's existing API and storage |

`ApprovalReceiptAuthority` and native conversation transport are existing, distinct
surfaces. Native WS does **not** mint an `ApprovalReceiptAuthority` receipt, and its
admission alone does **not** establish human approval or target permission. The
native composition uses the client host's input/presentation checks and the
adapter/target's existing authorization path. Neither surface may bypass the
other owners' obligations. The `vcp_chat.c2` trusted-client implementation profile
remains `PRODUCTION_DISABLED`; synthetic receipt tests do not activate it.

The existing native wire identifier is `trusted-conversation-v1`. Contract version
1 does not introduce a new request field or change that identifier. Existing
request IDs, source IDs, plan IDs, digests and operation IDs retain their original
owners and meaning; they are not interchangeable credentials.

## Normative invariants

### TA-1 — Authority is host-owned

Model/plugin arguments such as `role`, `human`, `approved`, token-like strings,
grants or a claimed principal MUST NOT create authority. Human/session evidence
MUST originate in authenticated host context. Copying serializable fields from a
trusted object MUST NOT reproduce its authority. Owner/application/assistant
credentials MUST stay outside model/plugin argument payloads.

The receipt authority registers actual objects in private maps/sets; it does not
trust a JSON claim to be a pending snapshot, intent or invocation context. Native
transport similarly admits a per-invocation context by object identity. Its stdio
broker passes a temporary, scoped capability, not the underlying credentials; a
model-origin invocation has no native owner-session/delegation authority.

### TA-2 — Bind the original source

An action MUST remain bound to its original client/session, conversation, message
and source generation. Editing input, switching topic, replacing a message or
reconnecting MUST NOT redirect the old source to a new action.

Client host checks own input/message generation; the adapter owns proposal/source
correlation. ToolBox WS namespaces conversation identifiers with the authenticated
distributed server identity, pins session/credential/tool for the connection, and
holds connection-local source/plan sets. Receipt verification binds tool, command,
request identity and the complete argument digest. A correlation session ID is
not an authentication credential. ToolBox alone does not attest a DOM presentation
or the human origin of text supplied in a native payload.

### TA-3 — Bind the exact presentation and arguments

Confirmation MUST authorize only the exact presented proposal and argument
digest. Changed, expired, superseded, ambiguous or unpresented proposals MUST NOT
dispatch. The client host and adapter MUST validate current presentation and
source generation before treating confirmation as authority.

`ApprovalReceiptAuthority.snapshot` freezes canonical arguments; `attestIntent`
binds the exact digest and host approval request; `bindInvocation` and
`verifyAuthorization` recheck the payload. A digest is an integrity binding, not
a grant. Receipt expiry is enforced at invocation verification. A failed bind or
verification of an issued receipt invalidates that receipt rather than allowing
a corrected replay. Native `presented` also consumes connection-local plan
eligibility; it is not by itself proof that a human saw or confirmed a proposal.

### TA-4 — One dispatch opportunity

Once dispatch may have begun, the operation/request identity MUST be frozen.
Consumed eligibility MUST NOT be restored by plugin denial, exception, lost reply
or unknown result. Duplicate/concurrent attempts MUST NOT dispatch the same action
a second time. At most one dispatch opportunity is not a promise of successful
commit or distributed exactly-once delivery.

The receipt authority binds once and consumes synchronously before returning
verification. Duplicate bind invalidates the outstanding eligibility;
`finishInvocation` invalidates an unconsumed receipt and removes its context.
WS validates first, then consumes source/plan eligibility and registers in-flight
work synchronously before calling the plugin. Preflight rejection before admission
may leave eligibility intact; a dispatched failure does not restore it. Closing a
socket does not cancel the call: its session stays reserved until all admitted
calls settle. A never-settling call keeps the reservation.

### TA-5 — Reconcile unknown results by original identity

After an ambiguous outcome, recovery MUST use read-only lookup of the original
operation/request identity. It MUST NOT resend execution, substitute a new
operation ID, mint another approval or acquire fresh business authority. Missing
or unavailable receipt evidence MUST remain unresolved rather than imply failure
or success. A recovered result is a projection of target facts, not permission.

The adapter/target own the durable operation journal and receipt lookup. ToolBox
can carry `recover` and preserves the result; it does not synthesize target
receipts. `ApprovalReceiptAuthority` is in-memory and cannot restore handles after
reconstruction. A new transport must reconcile instead of reviving old source or
plan eligibility. Credentials for any read remain independently checked.

### TA-6 — Cancellation has a dispatch boundary

Before dispatch, accepted cancellation MUST prevent later execution. Where durable
cancellation is promised, the owning adapter/target MUST preserve it through
reconstruction and races with preview/authorization. Delayed cancellation MUST
remain scoped to its original targets rather than invalidate newer work.

After dispatch may have begun, cancellation MUST NOT claim the business write was
cancelled. It MUST reconcile the original operation instead of resending it. An
in-memory denied approval is terminal for that pending receipt, but is **not** a
durable cancellation record. Socket close, timeout and receipt expiry are also
not evidence that the business operation was cancelled. Durable cancellation is
owned by the adapter/target; there is no new generic ToolBox cancellation store.

### TA-7 — Transport provenance is host-owned

Native security MUST derive from recorded upgrade socket facts, not forwarded
headers, display addresses, message fields or copied context. WS admission
requires a known IP and either actual socket TLS or loopback (IPv4 127/8, IPv6 ::1,
including IPv4-mapped loopback). Unknown peers and remote plaintext MUST fail
before binding/consumption/dispatch. Remote clients MUST require WSS before
sending credentials; server rejection cannot undo disclosure over plaintext.

Reconnect MUST create fresh transport/source/plan eligibility. Native WS MUST NOT
silently fall back to HTTP or generic model execution for an admitted/in-flight
execution. The separate existing loopback HTTP entry remains available by explicit
configuration; it is not a retry path. A same-host proxy's loopback peer is not
proof of public-side TLS: see [existing transport boundary](NATIVE_CONVERSATION_WEBSOCKET.md).
This contract does not authorize or change deployment topology.

### TA-8 — Target business authority remains independent

Trusted Action attestation or native transport admission MUST NOT override target
permission. The target MUST independently authenticate the caller, authorize its
scope and validate its own preconditions. Denial MUST stay a denial; the host MUST
NOT upgrade it to success, broaden credentials/scope or retry with new authority.

Native transport validates request framing and credential **format**; the target
validates actual identity. A syntactically valid Bearer value is not authenticated
by this format check. Plugin business results remain business results (including
HTTP 200 with an error body), distinct from host transport failure.

### TA-9 — Fail closed and disclose little

Ambiguous authority, source, presentation, transport or outcome MUST fail closed.
Host failures and diagnostics MUST NOT expose credential values, raw authorization
or private host state. Error codes are not permission to retry a mutation.

Receipt failures use `WRITE_AUTHORITY_RECEIPT_INVALID`. Native host/plugin
exceptions return `NATIVE_RESULT_UNKNOWN` with fixed/allowlisted diagnostics;
sensitive WS envelopes bypass raw logging. The host preserves ordinary plugin
business results instead of rewriting them. Adapters/targets therefore remain
responsible for safe business-result contents; this is not a claim that the host
sanitizes arbitrary output from a malicious plugin.

## Existing interface boundary (not a new schema)

- HTTP: `POST /v1/native-conversation/:toolName`, actual loopback peer required;
  application authorization is host-carried in `x-vcp-application-authorization`.
- WS: `native_conversation_request` / `native_conversation_response` on the existing
  authenticated distributed connection. String request/session IDs, tool name,
  received-byte size, recorded transport and connection identity are validated.
- Native body has exactly `action` and non-array object `payload`. Actions are
  `status`, `prepare`, `execute`, `propose`, `presented`, `invalidate`, `recover`.
  Arbitrary RPC commands or extra top-level body fields are rejected.
- HTTP retains its 32768 JavaScript UTF-16 code-unit body limit. WS additionally
  requires a transformed-body limit of 32768 UTF-8 bytes and an outer received
  frame limit of 40000 bytes. These are different limits, not a new shared parser.
- The stdio envelope is `{nativeAction, payload}`. Host context travels separately
  through the existing per-invocation broker. Payload `human`/`approved` fields
  cannot manufacture that context.

Target resource identifiers, revision semantics, database schemas, business
commands and target receipt fields are outside this public contract. The
following integration evidence uses one application; its fields are not generic
Trusted Action fields.

## Executable conformance map

New `TA-*` tests extend `tests/native-conversation-context.test.cjs`, already
selected by the immutable paired profile. The remaining rows reuse existing tests
rather than copying their implementation. All mapped files run in the canonical
paired profile; any required skip fails that gate.

| Invariant | ToolBox executable protection | Composition protection in the accepted other repositories |
| --- | --- | --- |
| TA-1 | `native-conversation-context.test.cjs`: new forged-context/handle tests, existing JSON provenance and broker/environment checks | VCPChat `native-conversation-ipc.test.cjs`: fabricated renderer source rejection; Extensions `JsoAgentAdapter/test.cjs` |
| TA-2 | New verifier identity mismatch tests; `native-websocket.test.cjs`: connection-bound sources/plans; `native-websocket-connection.test.cjs`: changed credential/tool rejection | VCPChat IPC source-generation/invalidation tests; Extensions `JsoConversation/races.test.cjs`: message invalidation and supersession |
| TA-3 | New snapshot/digest/expiry tests; WS single-use presented-plan eligibility | Extensions `JsoConversation/expiry.test.cjs`: unpresented/expired/ambiguous plans; VCPChat `native-presentation-lifecycle.test.cjs` |
| TA-4 | New duplicate bind/consume/finalization tests; WS concurrent and dispatched-error eligibility tests | Extensions `JsoConversation/stdio.test.cjs`: authorization claim prevents duplicate execution |
| TA-5 | New finalization/reconstruction rejection tests; WS disconnected-execute reservation and recover-only reconnect tests | Extensions `JsoConversation/races.test.cjs`: lost committed reply recovery by original ID; `limits.test.cjs`: unknown operations only read original receipt |
| TA-6 | New terminal denied-intent test (in-memory only) | Extensions `JsoConversation/stdio.test.cjs`: cross-process cancel and after-dispatch reconciliation; JSO `jso-conversation-cancellation-restart.test.mjs`: SQLite close/reopen cancellation |
| TA-7 | `native-websocket-connection.test.cjs`: actual remote plaintext rejection despite forwarded headers, full native routing without HTTP fallback; `native-websocket.test.cjs`: immutable socket facts | VCPChat `native-websocket.test.cjs` and `trusted-conversation-native-port.test.cjs`: client transport and generation checks |
| TA-8 | New target-denial passthrough test; existing scoped stdio broker and `native-http-contract.test.cjs` business-error tests | JSO `jso-agent-api-v1.test.mjs`, `conversation-identity-validation.test.mjs`, `conversation-static-grants.test.mjs`, `jso-conversation-http-boundary.test.mjs` |
| TA-9 | New invalid receipt/expiry tests; `native-transport-diagnostics.test.cjs`, HTTP preflight scrubbed error and WS sensitive-envelope diagnostics | VCPChat `native-websocket-redaction.test.cjs`; Extensions configuration and adapter boundary tests |

Receipt conformance uses real `ApprovalReceiptAuthority` and `HumanClientAdmission`
with synthetic signing keys, in-memory enrollment and `testOnly`. It proves the
module boundary, not production enrollment or physical human input. Native WS
regressions use actual local sockets plus explicit synthetic transport fixtures;
they are not production TLS or deployment acceptance.

For local affected tests with existing isolated express/ws dependencies and an
accepted VCPChat checkout (needed by the HTTP compatibility cases):

```sh
NODE_PATH=/absolute/isolated-deps/node_modules \
JSO_CHAT_SOURCE=/absolute/accepted-vcpchat \
node --test tests/native-conversation-context.test.cjs \
  tests/native-http-contract.test.cjs tests/native-transport-diagnostics.test.cjs \
  tests/native-websocket.test.cjs tests/native-websocket-connection.test.cjs \
  tests/humanAuthorizationKernel.test.cjs
```

Use Node 22.23.1 for this ToolBox profile. The cross-repository runner selects its
own existing runtimes, including the target system's Node 24 requirement. Missing
local prerequisites can skip existing tests; such a run is not paired acceptance.

## Immutable candidate verification and evidence

[Canonical harness](https://github.com/JENN2046/VCPToolBox-JENN-Extensions/tree/77e89fae03202a3d861d6f3e78c8a06666df304d/integrations/jso-agent)
and reusable workflow are pinned to
`77e89fae03202a3d861d6f3e78c8a06666df304d`.
`.github/workflows/jso-agent-paired-candidate.yml` supplies ToolBox PR HEAD (or push
SHA); the other three components retain the manifest's accepted pins. No secret
forwarding, repository dispatch, new runner or profile modification is needed.
Receipts distinguish the candidate SHA from harness SHA and report required skips.

The initial [real daily acceptance #83](https://github.com/JENN2046/jenn-shooting-operations/issues/83#issuecomment-6423599717)
is historical evidence for its exact four-component composition. This candidate's
synthetic tests do not repeat or supersede that real-human acceptance.
[Consolidation #86](https://github.com/JENN2046/jenn-shooting-operations/issues/86)
owns the current review. Contract publication, CI PASS, merge, deployment and
actual-use acceptance remain separate events. If existing behavior contradicts
TA-1–TA-9, report the mismatch before changing runtime semantics.
