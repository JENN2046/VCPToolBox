# VCPTOOLBOX_REBASELINE_R1_MATRIX_RESULT

```text
PROGRAM: VCPTOOLBOX_UPSTREAM_TRACKING_REBASELINE_R1
STATUS: ACCEPTED_SOURCE_REBASELINE
SOURCE_ACCEPTANCE: CLOSED
RUNTIME_ACTIVATION: NOT_PERFORMED
DEPLOYMENT_CUTOVER: NOT_PERFORMED
STATE_MIGRATION: NOT_PERFORMED
```

## 1. Accepted Source Authority

```text
AUTHOR_UPSTREAM:
lioensky/VCPToolBox::main
9deadda698eb87b4ee2aef5c27ea7c01e8970a02
TREE: 83d9d49f626ea7f782203ba7ad24197dfbc909fc

ACCEPTED_PRODUCT_SOURCE:
JENN2046/VCPToolBox::integration/upstream-tracking-rebaseline-r1
2f8fd1ff6c20de21a5fd2ca1b9c6580b92b13154
TREE: 7750bc30a3ad470bce80fba90cc24d5a13575d27

SOURCE_FORMULA:
Author Upstream + Minimum Required Local Semantic Delta
```

Freshness was re-read immediately after the six package migrations. The author upstream head remained exactly `9deadda698eb87b4ee2aef5c27ea7c01e8970a02` with tree `83d9d49f626ea7f782203ba7ad24197dfbc909fc`.

Final source ancestry receipt from that exact upstream commit to the accepted product source:

```text
STATUS: ahead
AHEAD_BY: 14
BEHIND_BY: 0
MERGE_BASE: 9deadda698eb87b4ee2aef5c27ea7c01e8970a02
```

The legacy `nuobao-vcptoolbox` line remains migration evidence only. It is not an ancestry base and its historical commits were not replayed.

## 2. Classification Result

Classification vocabulary:

```text
A = current upstream already satisfies the package
B = required local semantic delta / compatibility invariant remains
C = stale local override; retire it
D = real unresolved conflict
```

All six frozen packages close as **B at package level**. Some individual sub-semantics are already provided by upstream and were reused rather than forked, but every package still contains at least one consumed local contract that requires a bounded delta.

| Frozen Matrix Package | Result | Accepted source / evidence | Disposition |
| --- | --- | --- | --- |
| `P1_NATIVE_MANIFEST_SURFACE` | **B / PASS** | Native manifest landing `e598ac01d4a4573ce0ec4fe179b13cd684a29a26`, followed by executable-mode preservation `ed6d8565a04bd7767a24fe3fd1020df1a144de93`; final-regression covered | Preserve `native-v1` producer/consumer contract only; no unrelated historical plugin/runtime code |
| `P2_EXTERNAL_PLUGIN_COMPOSITION` | **B / PASS** | `1cf353b4f5c18afdfb4b3bc59e9fc966bc26538f`; final-regression covered | Preserve managed roots, exact admission identity, fail-closed runtime registration and env sandbox; external sources stay external |
| `P3_RESIDENT_HOST_CONTRACT` | **B / PASS** | Accepted Resident host tree `4649281189686742b50cfc9a985170191ed42770`; cumulative tracking correction `2ed4b2e398c188102069056a1768490ef903572c`; P4 focused + regression gates passed | Preserve host seams only; do not vendor/install/allowlist Resident; no production identity activation |
| `P4_HUMAN_AUTHORIZATION_KERNEL` | **B / PASS** | `33dcb35b7ad6911c6844caf385b83de8ac9b37f2`, tree `f718661dd9bde5b8cbe2ce95a5530eef1de186ee`; bounded five-module kernel + dynamic acceptance | Preserve Trusted Client + Explicit Human Intent + Exact Pending Authority Target and execution binding; production profiles remain disabled; no UI migration |
| `P5_VEXUS_NATIVE_ABI_COMPAT` | **B / PASS** | Accepted tree `420455561701a67b07f148291041cd7403af6ee6`; tracking landing `c8493902dad054c4b94c3f035578c3a1d4d14491`; same-tree candidate `3de1ccac3c99907254bbc5fda03aa820643b5649` passed `linux-x64-gnu` CI | Rebuilt from current source; reproducibility/source-match gate; GLIBC ceiling `<= 2.35`; no historical binary pinning |
| `P6_MEMORY_COLD_COMPATIBILITY` | **B / PASS** | `2f8fd1ff6c20de21a5fd2ca1b9c6580b92b13154`, tree `7750bc30a3ad470bce80fba90cc24d5a13575d27`; final P6 gate and P5/P4/P2/P1 regressions passed | Reuse upstream LightMemo/TDB internals; add narrow compatibility decorator only; no `tdbRecovery` migration |

There are no package-level `A`, `C`, or `D` outcomes remaining in this R1 matrix.

## 3. Package Acceptance Notes

### P1 — Native Manifest

The accepted source preserves deterministic native manifest authority and `manifestSurface: native-v1` while retaining the legacy bridge response contract for non-native callers. The P1 line was then carried through every subsequent regression gate.

### P2 — External Plugin Composition

The accepted source preserves:

- `VCP_PLUGIN_ALLOWED_ROOTS`
- `VCP_PLUGIN_DIRS`
- `VCP_EXTERNAL_PLUGIN_ALLOWLIST`
- canonical path / realpath containment
- exact `pluginName@sourceDirectory` admission where applicable
- explicit runtime registration gating
- external runtime environment sandboxing
- no implicit global plugin-config environment inheritance for external roots

Resident and JENN extension source remain outside VCPToolBox core.

### P3 — Resident Host Contract

The accepted source preserves the bounded host surfaces for hybrid/direct Resident composition, ephemeral host presentation, replay-cache bypass, honest UNKNOWN OneRing metadata, provider-attempt sealing/body binding, and fail-closed missing/unadmitted behavior.

Resident source was not copied into VCPToolBox. No Resident install, allowlist, provider activation, service restart, or BOUND production identity claim is part of this acceptance.

### P4 — Human Authorization Kernel

The accepted source contains the authority kernel only. Dynamic acceptance verifies trusted-client proof, exact pending-target human intent, one-time receipt/execution binding, HTTP/WS proof semantics, revocation, and durable authority epochs/anchors.

`vcp_chat.c2` remains `PRODUCTION_DISABLED`. No server route mounting, AdminPanel migration, or production client admission was performed.

### P5 — Vexus Native ABI

The accepted tree contains the rebuilt Linux x64 GNU artifact and a source-bound ABI gate. The same tree passed the `linux-x64-gnu` workflow on the candidate branch. The gate checks reproducible double-build output, tracked artifact/source equality, GLIBC compatibility ceiling, native exports, Vexus index smoke, and current KnowledgeBaseManager load contract.

### P6 — LightMemo / Cold Compatibility

The accepted source leaves current upstream `Plugin/LightMemo/LightMemo.js` and `TDBKnowledge.js` unchanged and adds a narrow wrapper/decorator seam:

- `knowledge_base` remains Cold routing; `folder` remains Hot scope
- `cold_result_mode=structured`
- `cold_text_mode=preview|legacy_full_body`
- preview performs no parent-body expansion
- L03 dedup is performed before body expansion, rerank, and structured projection using library/source identity
- legacy body expansion is bounded and containment-checked
- `include_river_trace` captures the raw result from the same production RiverMemo retrieval before LightMemo formatting, without issuing a second retrieval
- ordinary Hot calls delegate to upstream behavior

No `modules/tdbRecovery` delta was admitted.

## 4. Final Validation State

The final P6 validation gate completed successfully with all of these stages green:

```text
P6 exact ancestry / bounded surface       PASS
P6 syntax                                PASS
P6 wrapper composition                   PASS
P6 LightMemo compatibility seam          PASS
P5 Human Authorization regression        PASS
P3 Resident host regression              PASS
P2 External Plugin Composition regression PASS
P1 Native Manifest regression            PASS
```

The separate Vexus same-tree candidate gate also completed successfully:

```text
linux-x64-gnu                            PASS
reproducible source build               REQUIRED BY GATE
source artifact match                   REQUIRED BY GATE
MAX_ALLOWED_GLIBC                        2.35
```

## 5. Explicitly Retired / Not Migrated

The following are outside the accepted tracking source:

- thick-fork commit history as ancestry
- wholesale old-branch merge/rebase/cherry-pick strategy
- full Runtime V2 framework
- whole `modules/tdbRecovery`
- historical Admin/UI implementation as a prerequisite
- old workaround patches without current consumed-contract evidence
- old Vexus binary merely because it existed historically
- Resident source copy inside VCPToolBox
- automatic external-plugin admission
- automatic Human Authorization production admission
- runtime state/database/memory migration
- deployment, service restart, or runtime cutover

## 6. Numbering Note

The frozen repository matrix is authoritative for package IDs. Some execution discussions used chronological labels in which Vexus was called “P3”, Resident “P4”, and Human Authorization “P5”. This result uses the **frozen matrix IDs**:

```text
P1 Native Manifest
P2 External Plugin Composition
P3 Resident Host Contract
P4 Human Authorization Kernel
P5 Vexus Native ABI
P6 Memory Cold Compatibility
```

## 7. Closeout

```text
RESULT:
PASS_VCPTOOLBOX_UPSTREAM_TRACKING_REBASELINE_R1

ACCEPTED_PRODUCT_SOURCE:
2f8fd1ff6c20de21a5fd2ca1b9c6580b92b13154

ACCEPTED_PRODUCT_TREE:
7750bc30a3ad470bce80fba90cc24d5a13575d27

UPSTREAM_BASE:
9deadda698eb87b4ee2aef5c27ea7c01e8970a02

UNRESOLVED_MATRIX_CONFLICTS:
0

RUNTIME_CUTOVER_AUTHORIZED:
NO
```

Any future activation, deployment, service restart, production client admission, Resident admission, or runtime/state migration is a **separate authorization gate** and is not implied by this source rebaseline acceptance.
