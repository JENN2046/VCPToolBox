# VCPToolBox R2 State Separation Acceptance

Status: **PASS / READY FOR IMMUTABLE RELEASE PREVIEW**

## Source identity

- Author upstream absorbed: `9fb8ef6a5f2ff2634d9a25aa99c34b4f6c5c3e28`
- Branch: `integration/upstream-tracking-rebaseline-r2`
- Local P7: `6763a4d1ef8559964859986a97f0e68b7536154e`
- Remote P7 equivalent: `93a708e0108b16b3e9e59e744d6c2b3d69f981ec`
- Local P8: `1b422e975fabd5323e957e0c0cfe503b7386ec40`
- Remote P8 equivalent: `09d0c13a9fe4a1cbf5b4f8e8e28ac1d60c5f9ec8`

The local and remote commit SHA pairs differ only because the GitHub Git Data API recreated commit metadata. The content trees are the accepted implementation content.

## Canonical state

- State root: `VCPToolBox/state/live`
- Binding authority: `VCPToolBox/state/STATE_BINDINGS_R1.json`
- 115 runtime state bindings
- 115/115 bindings remained symlinks after cold-start acceptance
- Pre-separation snapshot: `snapshots/state-separation-pre-r2-20260926-111331`
- Snapshot: 611 files, hash verification PASS
- SQLite canonical quick check: 9/9 PASS
- Fresh R2 runtime log hits for legacy `upstream-next`: 0
- Dynamic tool catalog legacy refs: 0

## Core acceptance

- P1-P8 / state-binding regression suite: **124/124 PASS**
- State-bound main listener: PASS
- State-bound Admin listener: PASS
- Main secretless probe: HTTP 401, expected
- Admin probe: HTTP 302
- Graceful shutdown: PASS
- Final VCP test ports clear: PASS

P7 preserves state symlinks across atomic temp-file + rename writers. P8 makes Python requirements Linux-portable by restricting `win10toast` to Windows.

## Runtime environment

- Canonical Python entry: `VCPToolBox/env`
- New environment: `envs/r2-1b422e97`
- `pip check`: PASS
- import smoke: PASS
- Legacy `.venv` dependency: removed

## VCP-APP bridge relocation

The bridge remains its separately frozen stable release `vcp-app-0.3.12-r13`; it was not silently upgraded.

- Canonical bridge entry: `VCPToolBox/bridge/vcp-app/current`
- Production-loaded files matched frozen R13 runtime authority: 16/16
- Recoverable frozen test set: 95/95 PASS
- Four unrecoverable historical files are TEST_ONLY forensic gaps and are explicitly not treated as reconstructed evidence.
- Canonical bridge `/healthz`: HTTP 200
- `/readyz` with Core deliberately stopped: HTTP 503, expected
- Old user-scope `vcp-main.service`: masked
- Bridge no longer pulls a second Core runtime into service

## Production boundary

No Core production cutover occurred during State Separation acceptance.

At acceptance time:

- `VCPToolBox/current -> releases/2f8fd1ff`
- Core services stopped
- cleanup enforcement remains `PREPARED_NOT_ACTIVE`
- no destructive cleanup authorized

Next gate: immutable-release preview, release promotion, atomic `current` switch, production cold-start verification.
