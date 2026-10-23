# R10 P1 integration

P1 source: `85fd0de1dbedf4f34918c19d545c3d895eec328c` (ToolBox),
`3fd74d8339a73aa6f3a642041d924f7999e9013b` (Chat).

The existing R10 `mobile-gateway.cjs` now passes the optional
`NativeMobileMaxConcurrency` profile value to the existing plugin configuration;
the default remains four. The reviewed scheduler and scoped-pull implementations
are retained; the direct runtime fixes below add deadline/lifecycle wiring. There is no
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

A real Kerr request hit the fixed request deadline at 120,012 ms, although its
configured model was present in the existing6005 model directory. The executor now
accepts a bounded `NativeMobileExecutionTimeoutMs` setting (1000–300000, unchanged
120000 default); R10 explicitly selects300000. Timeouts are marked as requiring
review and never requeued. The same model, tool interface, hashes and SQLite schema
remain unchanged. Three deadline tests verify bounds/default, cleanup/Topic release
and failed-request non-replay, plus portal wiring. All77 affected tests pass.

## Actual daily acceptance, 2026-10-23

Result: `R10_P1_INTEGRATION_AND_DAILY_ACCEPTANCE_PASS`.
This is actual deployment/device evidence, separate from the earlier isolated PASS.

- Deployed product commit: `fcf9f539573fa4a4aa47f1fcae3d2d9d7ff1d4bc`;
  seven deployed files match exact Git blob bytes. Subsequent documentation-only
  commits are not claimed as deployed runtime changes.
- Final R10 PID1035955, HTTPS8888, public
  `https://dnvcp.skmt617.top:13848/mobile/`. Verified certificate chain and public
  health response. Original6005 PID371083 remains running, never restarted here.
- Existing SQLite/history/session identities retained in place. Journal193 ->202;
  all original193 journal rows and materialized message hashes remain unchanged.
  Four selected topics contain23/20/37/122 messages. Android, Windows histories,
  NativeSync hashes and CDS SQLite projection agree. Cursor202, Outbox0, no pending.
- Real Android installed fixed-Origin WebAPK reopened from its desktop icon,
  authenticated without another Key, switched both Agents/all four topics and
  displayed the same messages. A fresh Kerr request completed once in129305ms;
  observed Dozing/sleep timestamp precedes durable completion by about114s.
  Android input injection was denied; Jenn sent/locked/unlocked manually. No phone
  security settings changed. The earlier request without actual lock is excluded.
- Actual Nova/Kerr tasks ran concurrently while a second Nova task stayed queued.
  Kerr cancellation left Nova running and queued work intact. Exact request replay
  returned the same job. A deliberate in-flight restart left uncertain work failed
  for review and recovered queued work once, without replaying cancelled/failed jobs.
- One normal Windows composer request used the user's existing credential and
  model connection successfully. Disconnecting only its own sync SSH tunnel
  produced durable Outbox1; automatic reconnect delivered user/reply to Android.
- Final controlled restart: PID1029579 exited0, plugin initialize/shutdown1/1,
  zero active requests/connections, held TLS preconnect closed; stop224ms.
  PID1035955 recovered the same job states, attempt counts, sessions and database.
- Online/cold/final SQLite backups include committed WAL; isolated restores and
  encrypted credential recovery passed. Old-code rollback drill passed against a
  copied backup, and old code also loaded the latest202-row backup without changing
  any task state/attempt/reply ID. No live rollback or replacement of newer history
  was needed.
-77 targeted Node tests passed on Linux. Fresh Windows R8 full-app/CDS/MobileSync
  coexistence and independent storage/index/shutdown verification passed; fresh R3
  full cold start, offline/pending recovery, streaming/group and Sync-Off passed.
  These are relevant regressions, not a claim that the whole repository passed.
- CDS original search RPC reached content/index revision10/10 with202 messages.
  Final normal startup has its original lazy search-index state (topic indexed
  revision0 until CDS search is initialized); SQLite ingest/hashes remain correct.
  The frontend's existing global search reads history and was separately checked.
  No Rust/CDS code or lazy-index policy was changed to make an assertion pass.

Six real-model attempts were made in this integration session: five mobile jobs
(completed2, deliberately interrupted1, cancelled1, old deadline failure1) and one
successful Windows request. The initial four-attempt test plan was extended with
one fresh manual-lock verification after the timeout fix and the desktop smoke.
Old failures are retained and never automatically retried. No cost total is claimed.

Evidence: run root above; `FINAL.json`, `ANDROID_FINAL_ACCEPTANCE.json`,
`ANDROID_MANUAL_LOCK.json`, `MANUAL_TASK_STATUS.json`, `WINDOWS_REAL_CONTINUE.json`,
`WINDOWS_OFFLINE_OUTBOX.json`, `CDS_FINAL.json`, `CDS_FINAL_NORMAL_LAUNCH.json`,
`CLEAN_DRAIN_PROOF.json`, `NODE_RECEIPT.json`, `BACKUP_*.json`, `ROLLBACK_DRILL.json`
and private Android/Windows screenshots. Never publish that runtime directory:
private recovery backups and real history remain outside Git.

Daily entry: existing installed Android icon; Windows task-owned
`VCPChat R10 P1.lnk` / `Start-VCPChat-R10-P1.ps1` under the manual-client artifact
directory. The launcher uses the integration source tree and existing AppData,
with strict SSH host/TLS checks and loopback-only forwards. Final app is left
running without acceptance debug port or temporary CDS observer.

Remaining limits: `IOS_NOT_RUN`; manual certificate renewal is still required
before2027-01-20; no OS-reboot/autostart guarantee was tested. Shared Topics retain
Queue/NativeSync write authority, CDS/MobileSync read-only. Other Agent/Topic
permissions, missing historical attachments and tools' external side effects are
not expanded by this acceptance. Ready for V1 final review within this scope;
no Push/Merge,6005 migration, schema change or new public HTTP service.
