# VCPToolBox Upstream Tracking Rebaseline R2 Acceptance

Status: IMPLEMENTATION_ACCEPTED / RELEASE_NOT_CUT_OVER
Date: 2026-09-26
Branch: `integration/upstream-tracking-rebaseline-r2`

## Exact baseline

Author repository: `lioensky/VCPToolBox`
Author branch: `main`
Exact absorbed upstream commit: `9fb8ef6a5f2ff2634d9a25aa99c34b4f6c5c3e28`

Fresh GitHub readback at closure confirmed that author `main` still pointed to the exact commit above.

Implementation HEAD before this documentation-only closure:
`9dc746ec81ccae6e71d26b943f1c81fbb21fdaa1`

Implementation tree:
`626953784e2c7c00b25dc2b275111a8afbea9566`

## Re-admitted local packages

- P1 Native manifest / FMS native-v1 authority: `4478c86fc1d0724094f55223623336aa0be72d5c`
- P2 External plugin composition and admission: `6ec832e190a5b28712159ca3054654b3bdac7659`
- P3 AGENTS OS Resident host contract: `6802e07e760125ea9561a3a8fe9b4daec3b60533`
- P4 Trusted Human authorization kernel: `0eadd1aeddc80b637efc4a1357e25203b3da42bd`
- P5 Vexus Linux native ABI compatibility: `d9707c89f5c3829fcd109c3e91bf64c6afa1cc94`
- P6 VCP-APP LightMemo / Cold TDB compatibility: `9dc746ec81ccae6e71d26b943f1c81fbb21fdaa1`

The R2 line was rebuilt from current author upstream. The old thick fork was not merged wholesale and the current production release was not used as an ancestry base.

## Acceptance evidence

JavaScript syntax check across the material modified host files and new authority modules: **PASS**.

Combined P1-P6 targeted suite:
- tests: **101**
- pass: **101**
- fail: **0**
- skipped: **0**

P5 native build:
- build OS: Ubuntu 22.04
- build GLIBC: 2.35
- GCC/G++: 12.3
- Rust: 1.89.0
- Node: 20.20.2
- @napi-rs/cli: 2.18.4
- build 1 SHA-256: `5d14ac48e15c01af06ece516da098f1adced4846957d7d1fbac524dddaaf8976`
- build 2 SHA-256: `5d14ac48e15c01af06ece516da098f1adced4846957d7d1fbac524dddaaf8976`
- reproducible: **PASS**
- maximum observed GLIBC: **2.35**

P5 runtime gate:
- abiContract: **PASS**
- currentLoaderExports: **PASS**
- currentVexusIndexSmoke: **PASS**
- knowledgeBaseManagerLoad: **PASS**

## Safety / deployment boundary

No production cutover was performed.

At acceptance:
- `vcp-main.service`: inactive
- `vcp-admin.service`: inactive
- VCP ports 6005/6006/6015/6016: no listener
- legacy database backup cron: paused
- `VCPToolBox/current` still points to accepted release `2f8fd1ff`
- persistent State Separation remains pending
- no database or memory-state migration was performed

R2 is therefore accepted as a **source implementation candidate**, not yet as the production runtime.

## Next gate

Generate an immutable staging runtime from the exact accepted R2 source, then perform staging/cold-start acceptance. Production `current` must not move until that separate cutover gate passes.
