# Host common approval protocol v1 (S2-A)

This is a source implementation candidate, not production activation. Admin UI migration and Chat/Mobile enrollment are separate gates. CodexWorker is unchanged.

## Ownership and authentication

One `ApprovalProtocol` belongs to each PluginManager. Its private pending map is the authority owner. `create`, `cancel`, and `cancelAll` have no WebSocket mutation endpoints. The receipt subsystem remains `approvalReceiptAuthority`.

The only production human adapter in S2-A is authenticated Admin HTTP. It mints a random 32-byte capability, valid for 60 seconds, consumed once at handshake. The claim binds to one socket for at most 15 minutes. The host attaches `clientSurface=admin_panel`, never copying a field from the request. Chat/Mobile have no admission API in this gate; tests simulate them with dependency injection into an isolated protocol instance. Their eventual strength is equal, not ranked.

Generic VCPLog traffic and request visibility stay unchanged. Existing unrelated tool decisions retain their legacy channel semantics; these never mint a sensitive human receipt. Shared-key connections, automatic-rule clients, and caller-declared surfaces cannot approve sensitive CodexWorker grant/revoke. Possession of an authenticated channel relies on the accepted Admin UI trust boundary; this protocol does not cryptographically measure a physical click. Chat auto-approval exclusion remains mandatory before any future Chat admission.

## Pending and first-valid semantics

Each request owns frozen tool/command/args/digest/matched-rule/createdAt/expiresAt metadata and a host Promise. IDs are at most 200 characters. Request lifetime is positive and at most 24 hours (the configured existing tool timeout is still used). Pending capacity is 256; canonical target limit is 16 KiB. Over-capacity requests fail before broadcast. JSON normalization can reject unsupported values; exact sensitive target semantics remain unchanged.

The response handler reads existence/deadline without mutating pending. Malformed responses fail. Sensitive responses require an unexpired host-bound human connection. In particular, an unauthenticated response arriving after the deadline cannot drive EXPIRED or CANCELLED. The independent timer remains able to expire requests.

At `now == expiresAt`, a valid decision is permitted. At `now > expiresAt`, an authenticated response or host timer expires the request. Early timer callbacks rearm. For valid input, target validation, receipt mint, and pending removal are synchronous with no await. First valid Allow OR Deny wins. Allow mints at most one receipt; Deny/expiry/cancel mint none. A receipt failure cancels and returns INTERNAL_ERROR; no automatic retry or resurrection.

Legacy authenticated Admin `tool_approval_response` remains accepted without a version or digest field. Optional `argsDigest`, if supplied, must match the host snapshot; it never substitutes for that snapshot. Sensitive Allow needs a nonempty projectRoot and literal `propose`, or nonempty revoke grantId. Deny remains possible for an invalid display target.

## Completion, delivery and synchronization

ACK acceptance means the decision won, not that any grant/revoke/downstream action succeeded. Existing boolean `PluginManager.handleApprovalResponse` is retained for internal callers; new WebSocket dispatch uses structured outcomes.

A terminal transition removes pending, clears timer/owner listener, settles the Promise, retains a frozen tombstone, clears old replay-cache entry, and broadcasts a terminal event to connected trusted human sockets. Network delivery is best effort; it never rolls back the authoritative transition. Terminal may arrive before the sender's ACK. Clients must process both idempotently by request ID and terminal state.

Tombstones retain at most 1024 records for 15 minutes, evicted lazily on access/insertion. They contain no target, receipt handle, capability or decision reason. Sync requires trusted human connection and returns bounded active metadata and recent terminal records. It is read/reconcile authority only: never mints receipts. A valid sync can apply overdue host expiry. Untrusted sync cannot mutate pending. After TTL/count eviction or restart, unknown IDs are unknown and cannot reconstruct authority.

## Cancellation and compatibility

Trusted `executionOptions.signal` cancels pending on owner abort. Already aborted invocations are never broadcast. Errors while preparing/broadcasting/waiting cancel in `finally`. Plugin shutdown and WebSocket drain cancel all pending. This gate does not wire new caller abort signals in other modules; callers must use the existing trusted execution options seam. Once ALLOWED, downstream errors never undo the decision or revive the receipt.

Admin UI is unchanged: its old response still works, but it does not yet implement S2 ACK/terminal/reconnect UX. Do not claim full multi-client behavior before S2-B/C/D. No production restart/reload, config change, approval, grant, worktree or Codex task is part of S2-A.

## Tests

`node --test tests/approvalProtocol.test.js tests/approvalProtocolWebSocket.test.js`

The first file tests deterministic clocks, simulated surfaces and actual PluginManager class methods with isolated dependencies (no singleton boot). The second boots only an ephemeral loopback HTTP/WebSocket test server using the production handshake and dispatch modules. It never calls CodexWorker. Production receipt minting is not exercised.
