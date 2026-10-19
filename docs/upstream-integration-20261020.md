# Author upstream integration, 2026-10-20

Fork base: `8f489ff09808e26b8469d97b893e1cec6226845c` (PR #292).
Author target: `252c6321607c31e3d6509219a866e1200f7b82ad` (`lioensky/VCPToolBox`, `main`).
Previously imported author source: `30193c89249345479e03be6d4913c35d583df84e`, recorded in `docs/native-delivery-30193c89.json` and PR #290.

The previous snapshot imports did not advance author ancestry. A normal merge therefore includes conflicts from older, already-imported changes. Resolution compares each path against the recorded imported source: retain fork changes when author content has not changed since that import; adopt new author changes when fork content equals that import; review and merge paths changed on both sides. This is not a repository-wide ours/theirs choice. The resulting merge must retain both the fork and frozen author parents.

## Compatibility retained

- External plugin admission, scoped host configuration, trusted Human authorization, strict native transports, and JEV declaration constraints remain fork contracts.
- LightMemo Cold result/body-state compatibility remains in `modules/lightMemoCompatibility.js`; source files and private runtime bindings are not migrated by this integration.
- Native River queries intersect caller `fileIdFilter` with the native diary-derived file IDs, so callers can narrow but cannot widen the scope.
- DreamWave obtains `{ id, path }` metadata through the Rust read pool before author filtering and native TopK. The optional third `includePaths` argument to `getFileIdsByDiaries` preserves ID-only callers. Missing metadata support fails closed instead of silently omitting the permission filter.
- JS-owned SQL schema and checkpoint code are replaced by author Rust storage, publication gates, revision signatures, and snapshot validation. Existing chunk-baseline regressions are migrated to these interfaces rather than restoring a second SQL owner.
- Admin assets are rebuilt from the combined source, including retained fork UI changes.

## Validation and release boundary

This is an isolated source candidate. It does not authorize a push, remote merge, service restart, database migration, external-plugin admission, release, or production switch.

The old native delivery receipt remains historical evidence for its recorded inputs and artifacts. It must not be relabeled as proof for this new Rust source. Updated Linux artifacts require exact-source rebuild, repeatability and ABI evidence. Windows artifacts also require a matching build and provenance update before cross-platform delivery can be accepted. Loading an older author binary is not source validation.

Task-specific build outputs, failures, baseline comparisons and acceptance status are recorded outside source under workspace `ops/reports/vcptoolbox-update-20261020/`. Check that record for current results; this document does not assert that all release checks have passed.

The regenerated Linux artifact is recorded separately in `docs/native-delivery-252c6321.json`. Verify its payload and complete Rust input inventory with:

```bash
node scripts/check-native-delivery.cjs x86_64-unknown-linux-gnu vexus codesearcher daily --receipt docs/native-delivery-252c6321.json
```

The current-source native regression run uses `TDB_NATIVE_BINDING` pointing to the candidate Linux artifact and `TDB_BASELINE_BINDING` pointing to the preserved, historically verified pre-TDB artifact. These are synthetic-fixture tests, including legacy schema preservation and a seeded old/new retrieval comparison. They do not open production stores.

Local evidence: two pinned Linux builds are byte-identical, require at most GLIBC 2.34, and match the regenerated candidate payload. Current-source native regressions pass (156 tests); host/transport contracts report 231 passes and five optional paired-project skips. Initial JEV and Admin unit failures were reproduced on the fork baseline and preserved in the task record. A follow-up repairs the three ambiguous plugin declarations and updates Admin fixtures to the current asynchronous confirmation, Pinia, request, server-side search and configuration serialization contracts. The previously missing pointer DOM helper is now tracked. All 70 Admin tests and 165 applicable JEV tests pass; 48 optional-plugin ecosystem cases remain skipped when their source is absent. Registry collision rules and production authorization are unchanged. The scoped Admin/JEV workflow runs these suites and the Admin typecheck/build so the native CI result no longer stands in for their coverage. Other Vexus platform payloads are explicitly unverified for the new Rust source; matching builds and CI provenance are required before cross-platform delivery. The regeneration used the documented tracked-comparison override; strict tracked-artifact CI comparison is still a separate check.

Windows Vexus was rebuilt from commit `2131b39717f6c908f18a80e07217fa35f71eb608` in GitHub Actions run `39295570024` (Rust 1.89.0, Node 22.23.1, NAPI CLI 2.18.4). Source build and in-memory vector smoke passed. The artifact archive digest, build identity, complete source inventory and payload hash were verified before replacing the bundled Windows Vexus file. The receipt records that the bootstrap run failed at the bundled provenance gate before this payload was recorded; the follow-up PR revision must pass that gate. Existing DailyNoteSearcher payloads retain their unchanged historical evidence. Other Vexus platforms remain unverified; this candidate is not a cross-platform release or production acceptance.

## Tool-call audit follow-up

A source-wide declaration audit found another pre-existing collision in FluxGen: landscape `壁纸` was a substring of portrait `手机壁纸`. The portrait alias is now `手机全屏`; all resolution keys/defaults, commands, plugin entrypoints and permissions are preserved. FluxGen routing now tests square, landscape and portrait formats, and conflicting tags fail closed. Its regression depends only on FluxGen, so unrelated absent generators cannot skip it.

The registry suite now independently validates every present plugin with an enabled JEV declaration, including disabled-source manifests without enabling them. This closes the verified gap where a whole optional-plugin group was skipped if one peer was absent. The 92 source manifests parse; all 23 JEV declarations validate (21 enabled-source manifests, two disabled-source manifests). Local JEV regressions now report 190 passed, zero failed and 47 optional-source skips. An additional 90 invocation/approval/cancellation/Cold compatibility regressions pass. These are candidate-source and synthetic protocol checks; external API-backed tools and the paired Chat/JSO integration are not production or actual-use acceptance.
