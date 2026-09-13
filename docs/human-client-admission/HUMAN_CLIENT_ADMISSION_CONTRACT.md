# C1-A1 post-R2 candidate contract

This candidate reconciles C1 through four corrections only: durable enrollment and ephemeral sessions; orthogonal states with rollback continuity; production implementation-profile admission; and restoration of issued receipt independence. The historical ephemeral C1 candidate and its evidence remain immutable. This is not deployment, C2 native implementation, or C1 Freeze.

## Durable identity and ephemeral authentication

Existing Admin browser authentication, explicit Approve/Deny POST, one-use CSRF bound to principal/resource, exact configured Admin Origin, full canonical Ed25519 fingerprint, and native enrollment-claim proof are retained. GET never enrolls. A successful claim commits a Host-generated `clientEnrollmentId`, canonical public key/fingerprint, keyVersion=1, surface=vcp_chat, ENROLLED state, timestamps, revocation data, Host-owned implementationProfileId and bounded label. Private keys, sessions, capabilities, decisions, pending approvals, receipts and grants are never persisted in this registry.

Durable enrollment has no eight-hour expiration. Client/network/application/OS/Host restart or Host upgrade does not erase it. The native protected durable key is C2 work, not implemented by these fixtures. Losing that key cannot authenticate an old identity. Explicit revoke persists REVOKED, and cannot be undone by an ordinary API update. Recovery replacement/security invalidation require separate authority; there is no import or automatic re-enrollment mechanism.

The eight-hour absolute maximum now bounds an ephemeral authenticated session only. A fresh Host-generated `session-authenticate` proof, exact durable ID/keyVersion, authority ID, current Host boot/origin/route and one-use nonce establish a new session, provided Current Admission is valid. No Admin ceremony is repeated. Sessions and proof nonces are memory-only and do not survive Host restart. Network socket replacement still uses fresh capability and channel proof. Local private-key persistence is deliberately not implemented in C1-A1.

## Orthogonal state domains

- Enrollment: UNENROLLED / PENDING_ENROLLMENT / ENROLLED / REVOKED. The short-lived ceremony separately retains PENDING_HUMAN / APPROVED_WAITING_PROOF / CLAIMED / DENIED / EXPIRED for backward protocol clarity.
- Current Admission: UNKNOWN / ADMITTED / DENIED / SUSPENDED. Host policy, durable enrollment, integrity and implementation profile determine effective admission on every authority attempt. A caller cannot promote this state.
- Session: DISCONNECTED / AUTHENTICATING / AUTHENTICATED. A suspended endpoint can remain cryptographically AUTHENTICATED but cannot participate. Expiration or session loss does not change Enrollment State.

`currentAdmission` in isolated TEST_ONLY fixtures is scoped to protocol testing. The separate `productionAdmission` is always DENIED for all C1 profiles. A production-disabled enrollment can complete key proof and persist its identity, but does not establish a participating session.

## Independent durable authority domains

Production configuration requires all four explicit deployment-owned values:

- HUMAN_CLIENT_HOST_ORIGIN and HUMAN_CLIENT_ADMIN_ORIGIN: exact canonical HTTPS origins, never request-header derived.
- TRUSTED_CLIENT_AUTHORITY_ROOT: protected durable registry directory.
- TRUSTED_CLIENT_ANCHOR_ROOT: protected independent continuity directory.

Both directories must already exist and resolve exactly, with no symlink components; be owned by the process UID with no group/other permissions; be outside repository/Git, ordinary runtime and temporary roots; be non-nested and on distinct mounted filesystem devices in production. Different directories on one filesystem are rejected for production. Deployment must place the anchor outside registry backup/snapshot/restore workflows. Distinct mounts are a necessary code-enforced guard, not hardware attestation or protection against a privileged actor deliberately restoring both domains together.

There is **no production initialization, auto-repair, migration or reset endpoint**. An explicit later deployment/recovery authority must provision the virgin pair. Existing/missing/ambiguous state cannot initialize itself. No production authority paths were initialized or exercised by this gate. Test fixtures explicitly provision two independent logical directories under /tmp, in TEST_ONLY mode; those model rollback faults and are not evidence of deployed physical separation.

`authority.json`: version, 32-byte random public hostAuthorityId, monotonic epoch, bounded client records. `anchor.json`: version, same hostAuthorityId, highestCommittedAuthorityEpoch, SHA-256 commitment of the canonical entire registry authority state. The existing canonicalizer is reused. Every access verifies both domains, epoch equality, identity, commitment and input bounds. The instance also remembers its last observed epoch/head.

Writes use one exclusive registry writer lock, temporary files with 0600 permissions, fsync, rename and directory fsync. Registry commits before anchor. Any incomplete write leaves unequal domains or an incomplete lock and causes sticky TRUSTED_CLIENT_RECOVERY_LOCKDOWN; no auto-heal, silent rewind or stale lock removal. A concurrent writer/racing integrity check fails closed. Revoked history remains outside ordinary source/runtime rollback. A registry-only rollback cannot be accepted merely because its own hash is internally consistent.

Anchor missing/unreadable/unavailable, registry missing, one-sided virgin state, either epoch ordering, identity mismatch, commitment mismatch, or stale commit lock deny Current Admission. Registry is bounded to 256 records/4 MiB. Persistent revoked records are retained; exhaustion requires separately authorized lifecycle management, not automatic trust-history deletion.

## Production activation gate

Host-only immutable catalog:

- `vcp_chat.c1.fixture`: TEST_ONLY, selected only by explicit isolated store composition.
- `vcp_chat.c2`: PRODUCTION_DISABLED, selected by production runtime composition.
- PRODUCTION_ADMITTED is a defined activation state with **no admitted catalog entry and no promotion API** in this gate.

Caller payload, persisted spelling, VCP_Key, USER_AUTH_CODE, clientSurface, device names, session IDs and signatures cannot promote a profile. Test fixtures can prove enrollment, session, capability and dedicated channel cryptography; `approvalReceiptAuthority.isHuman` still rejects their sockets. They cannot reach production-valid receipt mint. C2 reviewed native key ownership, Trusted Decision Boundary, renderer/main/preload boundary, exact target presentation, hard auto-approval exclusion and S2-B/A1/A2 delivery semantics plus explicit production authority remain prerequisites for a later gate.

The unchanged dedicated `/VCPlog/vcp-chat-approval` route uses capability in X-VCP-Human-Capability only, exact Host boot/origin/capability digest and <=10s channel-upgrade proof. `human_channel_ready` proves channel cryptography only; it is not implementation admission. C1 profile sockets cannot sync/submit human decisions or receive trusted approval broadcasts. Generic VCPLog and VCPMobile remain non-human; ordinary distributed transport is unchanged.

## Receipt authority reversion

Client revoke, session expiry, DENIED/SUSPENDED admission and profile policy affect future authentication, capability mint/use and Human Intent acceptance. Revocation marks durable REVOKED first, then retires client sockets and invalidates unused capabilities. Final proof checks and authoritative acceptance consult current state; a valid old signature cannot bypass a later state change.

After existing Host approval acceptance, issued receipts contain no mutable enrollment/session/lease/profile dependency. C1 no longer invalidates ISSUED receipts on client revoke, nor checks client liveness on Direct bind or verify-consume. Existing H1/S2-A tool/command/payload/request/execution binding, receipt TTL, finish/cancel behavior and consume-once semantics govern them. Consumed authority and Host terminal/ACK history are not rewritten. Durable grants remain entirely downstream.

Because C1-A1 deliberately has no production-admitted Chat profile, receipt reversion tests use the existing isolated Admin-authorized receipt path and check the actual shared bind/consume source for absence of C1 dependencies. No test-only Chat authority is secretly promoted to produce a receipt. Real admitted Chat execution awaits C2.

## Bounds and compatibility

The 256 durable-identity bound preserves bounded full Admin listing and never silently deletes revocation history to admit a new identity. The existing bounded ceremony, nonce, CSRF, socket and transport limits remain: enrollments 256/5min; proof nonces 1024 total/8 per session, <=30s; pending upgrades <=10s; sessions 256/8h; terminal ceremony records 512/5min; CSRF 512/5min; source buckets 1024/1min, starts 10/min; sockets 4/session and 1024 physical maximum. Limits apply independently of durable identity persistence.

Main HTTP router retains its early 8 KiB parser. Independent Admin retains its pre-existing global parser; execution/forwarding is bounded to 8 KiB. Fixed authenticated loopback proxy retains five seconds/512 KiB. Admin listing shows durable identities and independent state, with CSRF bound to durable clientEnrollmentId, not a dead session. Existing Admin does not need a client key. Ed25519/SPKI/weak-point defenses and the 22-case Node/Rust vector artifact are preserved; session recovery adds a distinct purpose, not a new algorithm or canonicalizer.

No changes to Plugin.js, approvalProtocol/Transport, ToolApprovalManager, CodexWorker, frozen S2-B, VCPChat/Mobile native source, Store or production dist. Mobile root-credential risk remains Class C live-admission prerequisite. Historical weak-key probe, initial compatibility fixture failure, FAILs/timeouts and original C1 reports remain unchanged.

## C1-A2: bounded algorithm agility delta

A2 preserves every preceding authority/lifecycle rule. The Ed25519-only `publicKey` and `verify` implementations, weak-point defenses, shared transcript/canonicalizer and both existing vector files remain byte-identical. New `importPublicKey` derives exactly ED25519 or ECDSA_P256_SHA256 from strict canonical SPKI. This is an additional algorithm, not an Ed25519 migration, provider ranking or new admission protocol.

P-256 SPKI must encode id-ecPublicKey with named prime256v1, exact canonical DER and the 65-byte uncompressed SEC1 point. Node import/re-export and standard ECDH point conversion validate it; compressed/explicit/missing/other-curve/invalid/trailing encodings are rejected. Fingerprint remains SHA256(exact SPKI DER).

P-256 verifies ECDSA over SHA256(M), where M is the unchanged exact Human Client signingInput. Node `crypto.verify('sha256', M, {key, dsaEncoding:'ieee-p1363'}, signature)` hashes M exactly once; independent Rust uses `verify_prehash(SHA256(M), signature)`. Ed25519 still signs/verifies M directly. The common transcript does not acquire an algorithm field or new canonicalizer.

The P-256 wire is strictly 64-byte P1363 r||s, canonical unpadded base64url, 1<=r<n and 1<=s<=floor(n/2). Host rejects high-S and ASN.1 DER signatures without normalization. Test-only native-provider fixtures demonstrate strict DER integer parsing, conversion to P1363 and client-side low-S normalization; no native provider/storage adapter is implemented. Scalar byte/range checks are not custom elliptic-curve arithmetic.

The durable registry now requires Host-derived `publicKeyAlgorithm` matching the imported canonical key. It is persisted as enrollment metadata; stored key type controls proof dispatch. Missing/unknown/mismatched metadata in unexpected prior durable state causes recovery lockdown, never an implicit migration or Ed25519 default. No production registry was initialized or imported. Client body fields cannot select/override the verifier. Nonce-internal algorithm metadata is Host-owned and is not added to the signed boundFields.

All five proof purposes use the same authority semantics for either algorithm. P-256 support leaves TEST_ONLY and PRODUCTION_DISABLED unchanged; no PRODUCTION_ADMITTED profile, receipt change, native C2 implementation, deployment or live authority exercise is introduced.

Crypto API references: [Node crypto verify](https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback), and pinned RustCrypto p256 0.13.2 source in the isolated verifier Cargo.lock. New vectors: `P256_CROSS_RUNTIME_TEST_VECTORS.json`; the Ed25519 vector files are not regenerated.
