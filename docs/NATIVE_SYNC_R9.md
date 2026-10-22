# R9 isolated Android / model validation

Baseline: `8838bb70859ea2e6f263c2b84d75dc6eef3fe518`.

PWA changes are limited to Android keyboard viewport resizing, standard PNG installation icons derived from the existing SVG, and a stable manifest id. Installation still failed on the physical test phone after these changes; do not claim home-screen readiness.

`scripts/native-sync-r9-relay-preload.mjs` starts the bounded Ubuntu-only test relay and then the original full `server.js`. It consumes only the explicitly approved isolated config location, passes the approved `doubao-seed-2.0-mini` request through the existing model execution path, and records projected status/hash/numeric usage. It must not be used to read/print credentials or raw provider payloads. The test guard allows only the approved provider hostname over HTTPS; other outbound traffic stays denied.

`scripts/native-sync-r9-tunnel.py` runs an owned temporary HTTPS connector to a trusted SSH reverse loopback forward. The Windows R9 mobile proxy exposes only explicitly allowed mobile paths, never the global-key/admin/native-sync API. A 45-minute lease and stdin/signal cleanup bound its lifetime. This is an experiment, not a production deployment.

The corresponding Chat tree `P:\VCPKF\vcp\versions\vcpchat-android-r9` contains the actual physical-device driver, full Windows app tests, independent SQLite/CDS checks, and `docs/NATIVE_SYNC_R9_HANDOFF.md`. Evidence is in `P:\VCPKF\vcp\artifacts\native-sync-r9`.

Completed: real model long replies, detached execution, failure recovery, cancellation, restart/idempotence; actual Android HTTPS/Chinese input/keyboard/background execution and Windows formal UI continuity. Missing: installed standalone Android launch/session restoration. The full `R9_ANDROID_REAL_MODEL_PASS` result is not authorized by this evidence.

Production `/app/VCPToolBox`, Rust CDS, R8 shared-topic writer exclusion, and the NativeSync protocol/store remain unchanged. No credential, runtime database, browser profile or log payload belongs in Git.
