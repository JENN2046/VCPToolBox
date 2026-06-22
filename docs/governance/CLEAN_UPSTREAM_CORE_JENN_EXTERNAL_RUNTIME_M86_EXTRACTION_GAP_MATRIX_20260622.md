# M86 Extraction Gap Matrix

Date: 2026-06-22

Status: GAP_MATRIX_PASS_NO_COPY

Input plan: `C:/Users/51529/Downloads/vcptoolbox_jenn_extraction_package/01-extraction-architecture-plan.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M86 compares the original extraction architecture plan against the current Jenn fork / external package state.

M86 does not:

- copy plugin, Agent, AdminPanel, LocalState, or private content;
- read `.env`, `config.env`, secret, token, auth, credential, or provider values;
- enumerate or read `.agent_board/**`, `MEMORY.md`, `AGENTS.override.md`, `data/photo-studio/**`, or other LocalState/private content;
- checksum LocalState/private/operator data;
- enable `VCP_AGENT_DIRS`, `VCP_PLUGIN_DIRS`, provider runtime, bridge runtime, live-write runtime, PhotoStudio runtime, or dynamic AdminPanel runtime;
- delete, untrack, stub, or remove core fallback content;
- open upstream PR or run production deploy.

This is a gap matrix only. It creates the next safe ordering before additional copy-first work.

## 2. Repository Reality Snapshot

```text
workspace=A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch=codex/m2-m7-jenn-external-runtime-roadmap
pre-M86-head=2bd7564d0b7d563076219a817fdcc98ed2e6dc2e
external_package=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
worktree-before-M86=clean
```

Observed external package top-level directories:

```text
AdminExtensions
Agent
AgentOverrides
AIImageAdapters
docs
manifests
MemoryBridges
PhotoStudioPackages
Plugin
receipts
scripts
```

Plan naming note:

```text
architecture plan names AdminPanelExtensions/
current external package uses AdminExtensions/
```

This naming mismatch is not treated as a runtime failure in M86, but future AdminPanel extension taskbooks should either preserve the current `AdminExtensions/` contract or explicitly write a migration/alias decision.

## 3. Summary

Current state by extraction class:

| Class | Planned target | Current state | M86 classification |
| --- | --- | --- | --- |
| Leaf Plugin copy-first | move Jenn plugin directories to external `Plugin/` first | partially done | GAP_REMAINS |
| Agent pack | external `Agent/` and `AgentOverrides/` | content copied; override lane runtime-on; additive lane off; core fallback kept | PARTIAL |
| AdminPanel extensions | external AdminPanel extension pages/API | only `JennAdminStatus` package and route lane complete; original planned pages/API still in core | GAP_REMAINS |
| LocalState/private | private/local-only repo or directory | only private-by-default skeleton/gates; real private content not read/copied | BLOCKED_PRIVATE |
| Core loader patches | thin core patches only | several loader/registry lanes exist; core patch minimization not final | PARTIAL |
| Stub/remove/untrack | replace core content after validation | explicitly deferred; no delete/untrack/stub executed | DEFERRED |

## 4. Plugin Extraction Gap Matrix

Plan source: section `3.1 第一批：可以立刻抽离`.

Path check was existence-only and did not inspect secret values.

| Planned item | Core exists | External package exists | Current status | Next safe gate |
| --- | --- | --- | --- | --- |
| `Plugin/AIGentOrchestrator/**` | yes | yes | PARTIAL_COPY_PRESENT_CORE_RETAINED | Reconcile with current `Plugin/JennAIGentOrchestrator` pilot and decide whether same-name external package needs fresh copy-first or existing pilot is sufficient. |
| `Plugin/AIGentPrompt/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/AIGentQuality/**` | yes | yes | PARTIAL_COPY_PRESENT_CORE_RETAINED | Review existing external package evidence before any new copy; do not overwrite blindly. |
| `Plugin/AIGentStyle/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/AIGentWorkflow/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/CodexMemoryBridge/**` | yes | no | NOT_EXTRACTED_AS_PLUGIN | M87 plugin candidate gate, separate from M33 `MemoryBridges/JennCodexMemoryBridge` skeleton. |
| `Plugin/DingTalkCLI/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/DingTalkTable/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/ImageAutoRegister/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/ImageRatingManager/**` | yes | no | NOT_EXTRACTED | M87 plugin candidate source/package gate. |
| `Plugin/PhotoStudioAssetArchive/**` | yes | no | NOT_EXTRACTED_AS_PLUGIN | M87 plugin candidate gate, separate from M34 `PhotoStudioPackages/JennPhotoStudioPackage` skeleton. |

M86 plugin counts:

```text
PLAN_PLUGIN_ITEMS=11
EXTERNAL_PLUGIN_PRESENT=2
NOT_EXTRACTED_OR_NOT_RECONCILED=9
CORE_PLUGIN_FALLBACK_RETAINED=11
PLUGIN_STUB_REMOVE_UNTRACK_EXECUTED=0
```

Important interpretation:

```text
external directory present != current copy-first proof
copy-first proof != runtime registration
runtime discovery != allowlisted execution
```

## 5. Agent Extraction Gap Matrix

Plan source: section `3.2 第二批：先做 loader，再抽离`.

M12 copied Agent content. M41-M45 enabled only `AgentOverrides` in real local config. `VCP_AGENT_DIRS` additive remains off.

| Planned item | Core exists | External target | Current status | Next safe gate |
| --- | --- | --- | --- | --- |
| `Agent/AIImageGenExpert.txt` | yes | `Agent/AIImageGenExpert.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/AuditMaster.txt` | yes | `Agent/AuditMaster.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/MemoriaSorter.txt` | yes | `Agent/MemoriaSorter.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/Muse.txt` | yes | `Agent/Muse.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/动力猛兽.txt` | yes | `Agent/动力猛兽.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/小秋.txt` | yes | `Agent/小秋.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/诺宝.txt` | yes | `Agent/诺宝.txt` exists | COPIED_NOT_RUNTIME_ON | Keep deferred until additive duplicate/core fallback decision. |
| `Agent/Metis.txt` | yes | `AgentOverrides/Metis.txt` exists | OVERRIDE_RUNTIME_ON | Runtime-on proof exists; core fallback retained. |
| `Agent/Nova.txt` | yes | `AgentOverrides/Nova.txt` exists | OVERRIDE_RUNTIME_ON | Runtime-on proof exists; core fallback retained. |

M86 Agent counts:

```text
PLAN_AGENT_ITEMS=9
COPIED_TO_EXTERNAL=9
OVERRIDE_RUNTIME_ON=2
ADDITIVE_RUNTIME_ON=0
CORE_AGENT_FALLBACK_RETAINED=9
AGENT_STUB_REMOVE_UNTRACK_EXECUTED=0
```

## 6. AdminPanel Extraction Gap Matrix

Plan source: section `3.2 第二批：先做 loader，再抽离`.

Current AdminPanel lane completed `JennAdminStatus` readonly backend/static frontend/artifact route, but it did not externalize the original planned AdminPanel pages/API listed below.

| Planned item | Core exists | External extension equivalent | Current status | Next safe gate |
| --- | --- | --- | --- | --- |
| `AdminPanel-Vue/src/views/AiImageAgents.vue` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | AdminPanel page/API extension taskbook after plugin copy-first wave. |
| `AdminPanel-Vue/src/views/ChannelHubManager.vue` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | AdminPanel page/API extension taskbook. |
| `AdminPanel-Vue/src/views/CodexImagegenRelay.vue` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | AdminPanel page/API extension taskbook. |
| `AdminPanel-Vue/src/views/CodexMemoryMonitor.vue` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | AdminPanel page/API extension taskbook. |
| `AdminPanel-Vue/src/views/OAuthAuthCenter.vue` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | AdminPanel page/API extension taskbook with auth-field display guard. |
| `AdminPanel-Vue/src/api/aiImageAgents.ts` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | Pair with `AiImageAgents.vue` extensionization. |
| `AdminPanel-Vue/src/api/channelHub.ts` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | Pair with `ChannelHubManager.vue` extensionization. |
| `AdminPanel-Vue/src/api/codexImagegenRelay.ts` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | Pair with `CodexImagegenRelay.vue` extensionization. |
| `AdminPanel-Vue/src/api/codexMemory.ts` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | Pair with `CodexMemoryMonitor.vue` extensionization. |
| `AdminPanel-Vue/src/api/oauthAuth.ts` | yes | no equivalent recorded in M86 | NOT_EXTRACTED | Pair with `OAuthAuthCenter.vue` extensionization; no secret display. |

M86 AdminPanel counts:

```text
PLAN_ADMINPANEL_ITEMS=10
EXTERNALIZED_PLAN_ADMINPANEL_ITEMS=0
JENN_ADMIN_STATUS_EXTENSION_DONE=yes
DYNAMIC_EXTERNAL_VUE_RUNTIME_ENABLED=no
ADMINPANEL_PLAN_ITEMS_STILL_IN_CORE=10
```

## 7. LocalState / Private Gap Matrix

Plan source: sections `1.1`, `2.4`, and `3.1`.

M86 performed existence checks only. It did not read or enumerate private content.

| Planned item | Core/local path exists | Current status | Why not lower risk | Next safe gate |
| --- | --- | --- | --- | --- |
| `.agent_board/**` | yes | BLOCKED_PRIVATE | Explicit manual gate; no automatic copy/checksum/migrate. | Separate human-approved `.agent_board/**` gate only. |
| `MEMORY.md` | yes | BLOCKED_PRIVATE | May contain private memory/operator state. | LocalState paths-only gate, then content review only if explicitly authorized. |
| `AGENTS.override.md` | yes | BLOCKED_PRIVATE | Operator-local override material. | LocalState paths-only gate. |
| `data/photo-studio/**` | yes | BLOCKED_PRIVATE_DATA | Real project data/media/export risk. | PhotoStudio data lane gate after source/runtime package gates. |
| `README For VCPChat.md` | yes | NOT_EXTRACTED_LOW_PRIVATE_UNKNOWN | Listed in first batch but not classified by current M85 route. | Paths-only review before copy-first. |

M86 LocalState counts:

```text
LOCALSTATE_PRIVATE_ITEMS_LISTED=5
PRIVATE_CONTENT_READ=0
PRIVATE_CONTENT_COPIED=0
LOCALSTATE_RUNTIME_ENABLED=0
```

## 8. Core Patch Compression Matrix

Plan source: section `3.3 第三批：不要抽离，压缩成 core patch`.

These are not extraction misses by default. They should remain in core as thin loader/contract patches, but the current fork has not completed a final "less than 10 core patch files" upstream-readiness reduction.

| Planned core-patch item | Core exists | M86 classification |
| --- | --- | --- |
| `Plugin.js` | yes | CORE_PATCH_KEEP |
| `adminServer.js` | yes | CORE_PATCH_KEEP_OR_REVIEW |
| `KnowledgeBaseManager.js` | yes | CORE_PATCH_KEEP_OR_REVIEW |
| `EmbeddingUtils.js` | yes | CORE_PATCH_KEEP_OR_REVIEW |
| `TagMemoEngine.js` | yes | CORE_PATCH_KEEP_OR_REVIEW |
| `modelRedirectHandler.js` | yes | CORE_PATCH_KEEP_OR_REVIEW |
| `AdminPanel-Vue/src/api/index.ts` | yes | CORE_PATCH_KEEP |
| `AdminPanel-Vue/src/app/routes/manifest.ts` | yes | CORE_PATCH_KEEP |
| `AdminPanel-Vue/src/app/routes/components.ts` | yes | CORE_PATCH_KEEP |
| `.gitignore` | yes | CORE_PATCH_KEEP |
| `config.env.example` | yes | CORE_PATCH_KEEP_EXAMPLE_ONLY |
| `package.json` | yes | CORE_PATCH_KEEP |
| `package-lock.json` | yes | CORE_PATCH_KEEP |

## 9. Continuation Order By Risk

The next work should proceed in this order:

| Order | Lane | Why first/later | Next milestone |
| ---: | --- | --- | --- |
| 1 | Plugin copy-first gap wave | Leaf-plugin packages are lower risk than private state and easier to validate with paths-only scan + manifest checksum. | M87 plugin copy-first candidate gate/taskbook. |
| 2 | Plugin copy-first execution | Copy reviewed plugin candidates only; denylist/secret-risk scan first, checksum after; no runtime enablement. | M88 plugin copy-first receipt. |
| 3 | Plugin shadow/default-off validation | Prove external package integrity without treating discovery as runtime registration. | M89 plugin shadow validation. |
| 4 | AdminPanel planned page/API extensionization | Higher UI/API surface; must avoid secrets, auth leaks, build/dist churn, and dynamic external Vue ambiguity. | M90 AdminPanel planned page/API extension taskbook. |
| 5 | AdminPanel implementation gates | Only after taskbook names exact files, metadata source, auth/display limits, and rollback. | M91+ scoped implementation. |
| 6 | LocalState/private | Highest risk because it may expose operator/private/project data. | Future explicit LocalState content gate; not automatic. |
| 7 | Stub/remove/untrack/core fallback retirement | Irreversible-ish and upstream-sensitive; only after copy-first, checksum, runtime/shadow validation, rollback drill. | Future decision packet only unless explicitly authorized. |

## 10. M87 Proposed Stop Line

M87 should be a plugin copy-first candidate gate, not an immediate broad copy.

Recommended M87 scope:

```text
read architecture-plan plugin list
check core/external path existence
classify already-present external plugin dirs vs missing external plugin dirs
run paths-only denylist/secret-risk scan against candidate source path names
write candidate allow/block table
define exact M88 copy list and forbidden paths
do not copy content yet unless M87 explicitly reaches ALLOW_COPY for each candidate and M88 is opened
```

M87 must not:

```text
read or copy .env/config.env/secret/auth/token material
copy LocalState/private/.agent_board/**
enable VCP_PLUGIN_DIRS or runtime registration
delete, untrack, stub, or remove core Plugin/**
overwrite existing external plugin dirs without a separate reconcile decision
open upstream PR
```

## 11. Validation

M86 validation is docs/read-only:

```text
git branch --show-current
git status --short
read architecture plan headings and extraction lists
existence-only path checks for planned plugin/Agent/AdminPanel/LocalState/core-patch items
no private content reads
```

Expected result:

```text
M86_GAP_MATRIX_PASS_NO_COPY=yes
NEXT_LOW_RISK_LANE=plugin_copy_first_candidate_gate
NEXT_MILESTONE=M87
```

## 12. Rollback

M86 rollback is docs-only:

```text
revert this M86 gap matrix document
revert tracker M86/S107/Q68 updates
```

No runtime, env, external package, private content, provider, bridge, production, upstream, delete, untrack, or stub rollback is required because M86 does not perform those actions.
