# SUVEI native Human Approval B1: kernel only

Base: `2835f6a429bee82d5f077dd01ba97d7971eefc2c`.

This change hardens the existing authority kernel. It does not mount routes,
admit a production client, handle Owner credentials, call Core, change VCPChat,
or deploy anything.

## Exact enrollment

Before storing an identity, claim validates the target enrollment's original
nonce, canonical key/algorithm, fingerprint, enrollment ID, purpose, Host,
method, path and body digest. Proof verification and consumption are synchronous.
A failed target/signature check creates no session or durable client record.
One proof can successfully claim its exact enrollment only once.

## Host pending contract for B2

The trusted Host must construct `ApprovalReceiptAuthority` with a synchronous,
side-effect-free `hostPendingVerifier(binding)`. Only literal true accepts.
Absent, throwing, asynchronous or false verification denies.

`snapshot` now requires `config.hostPending` containing:
- `identity`: the actual opaque pending object owned by the Host;
- `hostApprovalRequestId`: its exact ID;
- `expiresAt`: its bounded deadline.

The kernel adds the immutable args digest and operation to the binding.
The verifier must check that the live Host registry still owns that same object,
ID, operation, target digest and deadline. It must also enforce any target-client
restriction. The kernel does not provide a replacement registry.
B2 must derive this input from the Host, never from a client-supplied object.
Missing integration remains fail closed. Test Maps are fixture-only.

## Human lease lifecycle

Receipts retain the original admission lease and enrollment/session/profile
identity. Their lifetime is bounded by receipt, channel, session and pending
deadlines. Issuance, binding and final consumption check authority. Lifecycle
retirement actively invalidates all matching unconsumed receipts, including
already-bound receipts. Admission sweeps reconcile expiry/profile withdrawal;
consumption repeats fresh synchronous validation even before a sweep.
B2 must call the existing lifecycle hooks/sweep when its admission state changes;
no production scheduler or route is installed here.

`revokeSession` is a trusted Host lifecycle primitive, not an authenticated
public endpoint. Durable enrollment revocation remains the existing revoke path.
Production Human admission now also requires the record's ADMITTED state; the
implementation profile itself remains PRODUCTION_DISABLED.

## Decision separation and dispatch

`config.operation` is authorize, reject or revoke (legacy default: authorize).
`attestIntent` must match the Host's exact request ID and target.
`issueDecisionReceipt` accepts approve for authorize, deny for reject/revoke.
The old `approve` refuses negative operations/intents.

`dispatchDecision(expected, invocationContext, dispatch)` verifies the operation,
tool/command, exact Host object/ID, target digest, args, invocation and live lease.
It consumes once and immediately calls the trusted dispatch callback without
an intervening await. The callback must start its bounded dispatch synchronously;
it may return a Promise for the outcome. No callback may queue an unvalidated
future authority use. Core calls are not implemented in B1.

Every decision proof returns `permitsAgentExecution: false`. Even authorize
decisions cannot pass the legacy execution-receipt verifier. A later Core commit
and independent canonical verification are still necessary before Agent resume.
Reject/revoke must never become execution approvals.

A thrown or rejected dispatch remains CONSUMED. There is no retry/reissue in this
primitive. B2 must reconcile the exact Core target after an uncertain outcome.
Revocation after consumption cannot recall a dispatched operation; it prevents
new authority use. Host restart loses sessions, receipts and invocation contexts;
old handles fail closed. No persistent reusable receipts are added.

## Validation

Run the dependency-free kernel/adjacent suite:
```sh
node --test tests/humanAuthorizationB1.test.cjs tests/humanAuthorizationKernel.test.cjs tests/rebaselineMigrationMatrix.test.cjs tests/toolApprovalPathSafety.test.cjs
```

Additional existing approval-policy and Core-before-resume regressions:
```sh
node --test tests/toolApprovalManager.test.js tests/suveiMutationApprovalResponse.test.js
```

Negative tests use synthetic keys, in-memory Host/identity fixtures and fake
dispatch only. The existing durable-store regression uses disposable temp files.
CI checks the exact PR head on Node 22 and 24; it neither installs production
configuration nor runs deployment/publishing workflows.
