# R9 isolated Android / model validation

Result: **R9_ANDROID_REAL_MODEL_PASS**. This supersedes the earlier installation blocker. Tested ToolBox runtime delivery remains `e0ac7e92ee673466c46a0183e559cf4bc6134fda`; this follow-up changes this document only.

PWA changes in that delivery are limited to Android keyboard viewport resizing, standard PNG installation icons derived from the existing SVG, and a stable manifest id. Actual installed WebAPK startup and recovery are now proven on the physical phone.

`scripts/native-sync-r9-relay-preload.mjs` starts the bounded Ubuntu-only test relay and then the original full `server.js`. It consumes only the explicitly approved isolated config location, passes the approved `doubao-seed-2.0-mini` request through the existing model execution path, and records projected status/hash/numeric usage. It must not be used to read/print credentials or raw provider payloads. The test guard allows only the approved provider hostname over HTTPS; other outbound traffic stays denied.

`scripts/native-sync-r9-tunnel.py` runs an owned temporary HTTPS connector to a trusted SSH reverse loopback forward. The Windows R9 mobile proxy exposes only explicitly allowed mobile paths, never the global-key/admin/native-sync API. A 45-minute lease and stdin/signal cleanup bound its lifetime. This is an experiment, not a production deployment.

Final evidence is `P:/VCPKF/vcp/artifacts/native-sync-r9/run-1792671713255`: `R9_APP_PASS_RECEIPT.json`, `INSTALL_RECOVERY_ACCEPTANCE.json` and independent SQLite/CDS/shutdown proofs. Actual full host entry: `/home/admin/VCPKF/vcp/artifacts/native-sync-r7/run-1792671713255/source/server.js`; the R7 name retains the proven isolation profile.

Completed: real model long replies, detached execution, failure recovery, cancellation, restart/idempotence; actual Android HTTPS/Chinese input/keyboard/background execution and Windows formal UI continuity. Final installed-app verification uses its actual Android MAIN/LAUNCHER activity, preserves authentication and task state across full host restart, closes the PWA while a real reply runs, then reopens the installed app after the result is persisted. Earlier manual desktop-icon startup is recorded separately. Ten central messages match both Windows histories and original CDS indices; Sync-Off and Plugin-Off controls also pass.

All 14 R9 experiment roots have no remaining owned hosts/connectors. Temporary endpoints/forwards and task-only ADB are closed. Test icons remain with their temporary server offline. Historical failed attempts are retained; successful installation does not establish a permanent external WebAPK-service fix. No phone security, proxy, certificate or browser-login settings were changed by the agent.

The Chat tree `P:/VCPKF/vcp/versions/vcpchat-android-r9` contains the driver and complete handoff in `docs/NATIVE_SYNC_R9_HANDOFF.md`. Final source IDs, regressions and screenshots are indexed by `P:/VCPKF/vcp/artifacts/native-sync-r9/R9_FINAL_REPORT.json`.

Production `/app/VCPToolBox`, Rust CDS, R8 shared-topic writer exclusion, and the NativeSync protocol/store remain unchanged. No credential, runtime database, browser profile or log payload belongs in Git. No Push/Merge.
