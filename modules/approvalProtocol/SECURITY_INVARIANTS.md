# Security invariants

1. Only the host creates request IDs, frozen targets, deadlines, terminal states and receipts.
2. Client message visibility and `socket.send` completion confer no human authority.
3. Shared VCP_Key, deviceName, auto-rule response and self-reported surface never bind a human socket.
4. Unauthenticated sensitive responses and sync do not change pending, even after its deadline.
5. The independent timer expires only when host now > expiresAt; equality follows the response admission rule.
6. One synchronous first-valid transition, at most one receipt. Untrusted Deny cannot cancel pending.
7. Allow and Deny compete equally. Later valid responses observe terminal state; they never mint again.
8. Frozen args are used for receipt binding and sensitive execution. Optional client digest is only compared.
9. Terminal event, ACK and sync expose no capability/receipt secrets. Reasons are not retained in tombstones or broadcast.
10. Reconnect metadata cannot rehydrate an unknown/expired/terminal request into authority.
11. Bounded pending targets and tombstones prevent unbounded protocol storage; sync result is correspondingly bounded.
12. Admin remains the only production human adapter. Chat/Mobile identities in tests are fixture injection only.
13. Receipt provenance is host-attested and does not change CodexWorker verification or rank surfaces.
14. Client cancellation is not exposed over generic WebSocket. Owner signal, host drain/shutdown and invocation failure provide bounded cancellation.
15. Failed receipt mint cancels without an ACCEPTED result. Downstream failure cannot resurrect a consumed receipt.
16. Existing legacy unrelated-tool approvals are a compatibility domain, not sensitive human authorization.
17. A trusted channel is not proof of physical user gesture in isolation: accepted client UI and future sensitive auto-approval exclusion are required admission dependencies.
18. No S2-A production deployment or live authority exercise is implied by passing isolated tests.
