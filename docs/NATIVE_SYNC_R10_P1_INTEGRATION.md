# R10 P1 integration

P1 source: `85fd0de1dbedf4f34918c19d545c3d895eec328c` (ToolBox),
`3fd74d8339a73aa6f3a642041d924f7999e9013b` (Chat).

The existing R10 `mobile-gateway.cjs` now passes the optional
`NativeMobileMaxConcurrency` profile value to the existing plugin configuration;
the default remains four. The reviewed execution, portal, manifest and scoped-pull
implementations are retained unchanged from the P1 source commit. There is no
schema, hash, provider interface, Rust CDS or shared-Topic authority change.

Delivery is limited to the existing R10 source root and its PM2 namespace/app:
`/home/admin/VCPKF/vcp/versions/vcptoolbox-daily-r10`,
`/home/admin/VCPKF/vcp/runtime-data/native-sync-r10/pm2`, `vcp-mobile-r10`.
The database, HTTPS Origin, sessions and selected four owner/topic identities stay
in place. `/app/VCPToolBox` / port6005 is never stopped, replaced or restarted.

Upgrade order: live inventory; online SQLite/source/profile backup and isolated
restore/decryption check; stop/drain only R10; consistent cold backup; exact bounded source
replacement and profile release/concurrency update; restart the same R10 app;
verify HTTPS, database prefix, sessions, real Android/Windows and controlled tasks.
Rollback restores the old source files/profile with R10 stopped, preserving
the current compatible database and any newer committed results. Database backup
restoration is tested in an isolated directory, never over newer live histories.

Test receipt before deployment: 71 targeted Node tests passed, including P1
concurrency/cancel/recovery, scoped empty-page/pending crashes, R10 auth/session,
native IPC/refresh and R8 writer exclusion. Only synthetic tests ran at that stage.
Actual deployment/daily acceptance is a separate receipt; this source commit alone
does not claim it passed. Evidence root:
`P:/VCPKF/vcp/artifacts/native-sync-r10-p1-integration/run-20261023T021129460Z`.

The real in-flight restart retained the queued job and interrupted-state semantics,
but lacked a normal exit receipt within the existing PM2 deadline. A focused HTTPS
fixture independently reproduced `server.close()` waiting on a TCP/TLS preconnect
with no HTTP request. The existing HTTPS listener now tracks connections/active
responses, closes only idle/unrequested sockets at drain, and lets accepted partial
JSON pushes finish before HTTP/SQLite close. The R10 host also records sanitized
drain phases and explicit failure receipts. No timeout forcibly discards accepted
requests, and the reviewed execution engine remains unchanged.

Three new HTTPS tests cover the pre-fix stall, unfinished/idle TLS drainage and an
accepted partial NativeSync push persisted/acknowledged before close. All 74 related
Node tests pass after this direct integration fix. Actual clean exit and device
acceptance remain separate required runtime evidence.
