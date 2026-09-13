# Admin approval protocol migration (S2-B candidate)

This client requires the frozen S2-A v1 Host contract. It is source-only; production dist, Host, CodexWorker, Chat and Mobile are unchanged. There is no live approval acceptance in this gate.

`notifications.ts` owns the authenticated Admin HTTP capability request and the exact `/VCPlog/admin-approval` WebSocket. `utils/approvalProtocol.ts` owns reactive presentation records keyed by Host requestId. `NotificationsDrawer.vue` renders the immutable Host target and client state. Local notification IDs never select an approval operation.

## Independent presentation and decision facts

- `state` describes client UX (ACTIVE, SENDING, DELIVERY_UNKNOWN, ACCEPTED, DENIED, TERMINAL_OTHER_CLIENT, EXPIRED, CANCELLED, STALE_UNKNOWN, LOCAL_DEADLINE_REACHED, ACTIVE_RETRY_REQUIRES_RECONNECT, ERROR).
- `hostTerminal` exists only after a valid Host terminal/ACK terminal/snapshot tombstone. A locally elapsed deadline never sets it.
- `localDecisionAccepted` requires the retained sole local submitted decision, the current socket generation and its sole submitted decision for that request, and a matching ACCEPTED ACK (even after the bounded wait ends). Terminal alone, even `clientSurface=admin_panel`, does not prove this window won.

A terminal received during SENDING disables controls immediately but retains the sole current-generation decision identity for a subsequent ACK. The visible state can be terminal while that private ACK wait remains outstanding. ACK-before-terminal and terminal-before-ACK converge. Own accepted Allow and Deny are both described as “审批决定已被服务器接受”; this does not claim a grant, revoke, write or downstream execution succeeded. Without own ACK, an Admin terminal says “某个可信 Admin 会话”; Chat/Mobile fixture events say “另一可信客户端”. No per-surface authority ranking is introduced.

Two incompatible Host terminal values, or a terminal inconsistent with an ACK-proven submitted decision, cause PROTOCOL_STATE_CONFLICT. Local expiry is not a Host terminal and never conflicts with a later ALLOWED/DENIED. Conflicts lock actions and retain the first Host terminal for audit. An invalid ACK shape/outcome combination is not success. A successful ACK lacking terminal requests sync; an incompatible ACTIVE snapshot cannot erase that accepted-decision fact and enable another click.

## Wire mapping

| Incoming event | Client action |
| --- | --- |
| tool_approval_request | Validate v1 identity/deadline/digest, clone and deeply freeze Host args/target, retain exact digest; deduplicate by Host ID. |
| tool_approval_ack ACCEPTED | Correlate sole current-generation decision; only then mark local acceptance. Absorb provided Host terminal. |
| ALREADY_TERMINAL | Absorb the supplied terminal; never infer this window won. |
| REQUEST_EXPIRED | Absorb EXPIRED; no local success. |
| REQUEST_UNKNOWN | STALE_UNKNOWN, disable controls. |
| CLIENT_NOT_AUTHORIZED / INVALID_RESPONSE / TARGET_MISMATCH | ERROR, disable controls. |
| INTERNAL_ERROR | Absorb Host CANCELLED, no accepted-decision claim. |
| tool_approval_terminal | Absorb ALLOWED/DENIED/EXPIRED/CANCELLED idempotently; detect incompatible Host terminals. |
| tool_approval_snapshot | Only accept while awaiting the current generation's sync; validate the complete bounded snapshot before applying. |

Outgoing decision: `tool_approval_response {requestId, approved, protocolVersion:1, argsDigest, reason?}`. The digest is echoed unchanged, never recomputed from presentation. UI bookkeeping compares immutable target metadata for accidental local inconsistency; this is not an authority digest or a verifier. A non-renderable sensitive target disables Allow while Deny remains available if the identity/connection/deadline are valid. Unsupported/missing protocol identity or deadline disables both. Host v1 also covers ordinary approvals; ordinary notifications retain their existing rendering and never confer human authority.

## Waiting, synchronization and transport loss

ACK wait is 10 seconds, measured monotonically, independent of Host expiresAt. Timeout or failed decision send means DELIVERY_UNKNOWN, not rejection, failure, or Host expiry. No decision is automatically replayed. A timeout requests one bounded sync. Sync wait is also 10 seconds. Because v1 snapshots have no sync request identifier, a failed/timed-out sync quarantines further snapshot admission on that connection. The recovery control establishes a fresh connection/capability before another sync, preventing an old response from being mistaken for a later sync round.

On every new socket open, send `tool_approval_sync {protocolVersion:1}` and keep actions disabled until a validated snapshot. ACTIVE after a decision on the same generation does not restore actionability: it requires a fresh capability/socket and ACTIVE sync before a new explicit click. Terminal tombstones disable controls. An absent local nonterminal record becomes STALE_UNKNOWN; it is not labeled approved, denied or expired. Already proven terminals cannot be resurrected by active requests; conflicting active sync fails closed. No secret capability or user reason is retained in approval state or error logs.

Every socket callback closes over its exact socket and generation. Replaced-socket ACKs, snapshots, terminals, open/close/error callbacks and late HTTP capability results are ignored. This architecture can prove listener provenance, so the exception for generation-unattributable event buses does not apply. A terminal missed on the old socket is recovered through the current trusted snapshot; no real Host terminal is inferred from a transport callback. WebSocket.send is synchronous and has no deferred completion callback to reinstate old state. Same-connection processing uses ordered WebSocket delivery and the synchronous frozen Host handler; only one sync is outstanding at a time, and actions are disabled during it.

## Time and bounds

Snapshot serverTime establishes a monotonic anchor. The whole observed sync round trip is added conservatively (never subtracted), so network delay cannot extend the visible deadline. Absolute wall-clock offset must be within 24 hours and the reply within the 10-second sync window; otherwise actions remain disabled and a fresh connection is required. Later browser wall-clock jumps do not move the anchor. At or after Host-estimated expiresAt, ACTIVE becomes LOCAL_DEADLINE_REACHED. Host truth always wins over that display state.

The UI retains at most 1280 approval records (Host pending256 plus terminal1024). It does not evict remembered terminals into newly actionable stale cards. Capacity exhaustion fails closed; a page reload starts a fresh bounded Host reconciliation. Ordinary notifications retain their separate200-item display bound. Removing a card only removes its notification view, not protocol authority memory.

## Verification and deployment boundary

Tests run actual Pinia store, Vue drawer and mocked WebSocket/HTTP fixtures, plus deterministic protocol tests. Accepted H1-A1 target assertions remain, with only Host v1 metadata/sync and outgoing v1 envelope expectations updated. Typecheck and build run in an isolated copy. Existing broad Admin failures are compared with the unmodified baseline; they are not relabeled as green. S2-B candidate requires independent review before any deployment. It does not authorize S2-C/D, live H2 or R5-C.

## S2-B-A1 accepted decision identity corrective

Each explicit click records an immutable attemptedDecision: Host requestId, connection generation, a fresh monotonic decisionEpoch, and ALLOW/DENY. Only the matching current-generation ACCEPTED ACK for its sole submitted decision promotes that exact object to acceptedSubmittedDecision. Sending, timeout, surface provenance and terminal alone never promote it.

Accepted proof is separate from the bounded send wait. ACCEPTED with terminalState=null keeps the exact accepted choice and requests sync without inventing a Host terminal. Both terminal events and snapshot tombstones check this proof: matching ALLOWED/DENIED converges; an opposite outcome (or EXPIRED/CANCELLED after accepted decision) locks PROTOCOL_STATE_CONFLICT. The received Host terminal remains recorded; local choice never overwrites it. Conflict wording takes precedence over accepted-success wording.

Disconnect/sync may invalidate unaccepted send attempts, but must not erase already proven accepted identity. A late old-generation ACK cannot create proof. A new explicit retry after unaccepted DELIVERY_UNKNOWN requires a fresh connection generation and ACTIVE sync, and gets a fresh diagnostic decisionEpoch. No automatic replay occurs. No ACK means an opposite terminal can simply be another responder winning and is not conflict.

Historical FAIL_V2_R5_H2_S2_B_REVIEW_CLOSEOUT and its two counterexamples remain retained; this corrective does not rewrite that review or freeze S2-B.

## S2-B-A2 ambiguous generation quarantine

Host v1 echoes requestId, not a local decisionEpoch. To remove ambiguity, the client permits at most one decision for each request on one trusted connection generation. sentDecisions retains that immutable choice separately from the bounded ACK wait; retryQuarantine records uncertain pairs. No local epoch is sent or treated as Host attestation.

ACK timeout or send failure remains DELIVERY_UNKNOWN and requests bounded current sync. A subsequent ACTIVE snapshot for a previously submitted request becomes ACTIVE_RETRY_REQUIRES_RECONNECT, leaving both decisions disabled. The shared existing recovery control fetches a fresh capability, retires the old socket, opens a strictly newer generation and synchronizes all cards. OPEN alone never enables retry. Only current ACTIVE records after successful fresh sync may accept a new human click; terminal/unknown records cannot. Other cards are paused during rotation and reconciled, not given a fabricated terminal.

The old socket can remain passive before recovery. Its late valid ACK can still prove its sole original decision; accepted identity then participates in A1 terminal/snapshot consistency checks and cannot be retried. Once the socket is retired, old ACK/snapshot/lifecycle callbacks are rejected by generation. Current sync recovers Host truth. The rule repeats after every ambiguous retry; reusing an old generation number is rejected.

This intentionally evolves earlier S2-B/A1 tests that expected immediate same-generation ACTIVE retry or discarded late same-generation ACK attribution. Original failed evidence remains untouched; evolved assertions add blocked sends and fresh-generation sync rather than pretending Host v1 authenticates a local attempt ID. No decision is automatically replayed.
