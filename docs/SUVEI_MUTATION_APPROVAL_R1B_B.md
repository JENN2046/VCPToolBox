# SUVEI mutation approval R1B-B

`SUVEIStudio:RequestMutationGrantAuthorization` always requires the existing manual approval transport, independently of generic enable/whitelist settings. Proposal and read commands remain unprotected reads/control-state proposal; they create no grant.

PluginManager sends `requiresTrustedHumanAuthorization=true` with that approval request. VCPChat's bound local Human Owner reads the canonical Core mutation intent and approves/rejects/revokes its exact fingerprint/revision. ToolBox approval is only release transport, never Core authority. The resumed assistant command reads an already-committed, unexpired exact grant and returns its ID for the existing preview/apply/receipt engine.

This change does not authorize production activation, provider calls, user-memory writes or automatic PR merges.

For this protected request, PluginManager stores an immutable request/project/intent target and asks the resident SUVEIStudio host-only verifier for a fresh authenticated Core decision proof. A strict boolean must agree with the exact committed state: AUTHORIZED releases; REJECTED/REVOKED rejects. Missing verifier, PENDING, unavailable Core, malformed proof, mismatched scope, timeout or conflicting response preserves the pending call instead of consuming it. Concurrent responses share one Core read and settle at most once. WebSocketServer awaits this result; generation/correction responses retain their existing synchronous behavior.
