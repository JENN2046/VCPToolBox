# VCPToolBox R2 Final Promotion Acceptance

Status: **PASS / READY FOR PROMOTION**

## Implementation authority

- Author upstream absorbed: `9fb8ef6a5f2ff2634d9a25aa99c34b4f6c5c3e28`
- Remote implementation commit: `f704d468b8932e5071415abf51f2803367b0afef`
- Implementation tree: `6a5acee42371ee24bc33a53a648fbedb6f8043eb`
- Local equivalent commit: `91ad6844a64cfba1feb9c89525425aae9add2094`

## State Separation

- Canonical state root: `VCPToolBox/state/live`
- State bindings: **115/115**
- Pre-separation snapshot: **611 files, hash verification PASS**
- SQLite canonical quick check: **9/9 PASS**
- Runtime legacy path hits: **0**

## Regression acceptance

- Combined P1-P9/state regression suite: **125/125 PASS**
- P5 native ABI gate: **PASS**
- Maximum observed GLIBC: **2.35**
- Python runtime `pip check`: **PASS**
- Python import smoke: **PASS**

## Immutable release preview

Candidate was made read-only before startup.

- Writable regular files: **0**
- Writable directories: **0**
- Main listener 6015: **PASS**
- Admin listener 6016: **PASS**
- Main secretless probe: HTTP 401, expected
- Admin probe: HTTP 302
- Legacy path hits: **0**
- EROFS / EACCES / permission-denied errors: **0**
- Release regular-file fingerprint before/after: **UNCHANGED**
- FoldingStore state symlink remained intact

## VCP-APP bridge

- Stable bridge release remains `vcp-app-0.3.12-r13`
- Canonical path: `VCPToolBox/bridge/vcp-app/current`
- Production-loaded frozen files: **16/16 exact**
- Recoverable frozen tests: **95/95 PASS**
- `/healthz`: HTTP 200
- `/readyz` with Core intentionally stopped: HTTP 503, expected
- Old user-scope Core unit is masked

## Promotion boundary

At this acceptance point no Core current switch had occurred.
The previous current remained `releases/2f8fd1ff`.
Destructive cleanup remains prohibited.

Next action: move the immutable candidate into `releases/f704d468`, atomically switch `current`, then perform production cold-start verification.
