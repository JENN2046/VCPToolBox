# C1-A1 security invariants

1. Admin authentication plus explicit same-origin CSRF POST approves an exact canonical Ed25519 public key; page load alone creates no human intent or identity.
2. Exact private-key proof completes durable enrollment. Native persistent private-key protection is C2 work; no client key is stored in the Host registry.
3. Enrollment, Current Admission and Session are distinct state domains. Session expiry/restart does not delete enrollment. SUSPENDED + AUTHENTICATED does not authorize participation.
4. Durable state and independent continuity anchor must agree in identity, epoch and commitment at each sensitive check. Missing, unreadable, conflicting, partial-write or rollback state produces sticky recovery lockdown. No fresh empty domain or repair is inferred.
5. Production roots are explicit, protected, outside source/runtime/tmp, on distinct filesystem devices and independently operated rollback domains. Test-only logical fault fixtures do not prove deployed storage independence. There is no production initialization path in this candidate.
6. Ed25519 canonical SPKI, 64-byte signature, unpadded base64url, strict import/re-export, noncanonical/small-order rejection and exact Host-owned transcript bytes are unchanged. session-authenticate is a separate recovery domain using the same crypto and canonicalizer.
7. Boot/origin/authority identity, exact path, purpose, key and nonce remain bound. Proofs/capabilities/sessions are never recovered from durable storage.
8. The immutable Host profile catalog admits no production Chat implementation in C1. TEST_ONLY cannot mint production-valid Human Authorization receipts. Client-supplied profile/surface names cannot promote authority. Mobile stays fail closed.
9. Current admission is rechecked after proof verification and at Human Intent acceptance. Revocation or suspension after capability issue blocks claim, channel use and subsequent decisions.
10. Revoke persists enrollment revocation first, then retires future client authority. Once receipt is issued, only shared H1/S2-A lifecycle governs it; no mutable client-state reference or receipt invalidation on revoke remains.
11. Receipt TTL, exact tool/command/digest/request/execution bindings and single consumption are unchanged. Terminal/ACK and consumed authority remain historical truth. No grant store or second receipt engine exists.
12. Generic VCPLog, VCP_Key, UserAuth/tool_password, device names and ordinary messages never prove human identity. Existing Admin and distributed compatibility remain intact.
13. All state has explicit limits; one-use proof/CSRF and final synchronous checks fail closed. Multiple writers or incomplete cross-domain commits lock down rather than auto-heal.
14. No source/deployment authority is implied for C2, Mobile, CodexWorker, frozen AdminPanel, production configuration, real enrollment or live H2.
15. Historical C1 weak-key probe, staged fixture failures, accepted logs/reports and previous FAILs are retained; this correction does not retroactively relabel the old ephemeral candidate.
