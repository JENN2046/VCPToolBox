# P3 Jenn Externalization Inventory V2 - 2026-06-14

Status: docs-only, path-oriented, reproducible inventory with a non-secret
manifest metadata exception

## 1. Purpose

This report is the `P3 Inventory V2` work package requested by the
2026-06-14 V2 forward plan in
`docs/governance/JENN_EXTRACTION_IMPLEMENTATION_PLAN_20260608.md`.

The goal is to produce a reproducible path-level inventory for the current
Jenn externalization track:

- core repository surfaces that still contain Jenn-specific material;
- existing `VCPToolBox-JENN-Extensions` package state;
- existing `VCPToolBox-JENN-LocalState` package state;
- candidate leaf plugins for a later dry-run package;
- blocked, deferred, secret-like, runtime, generated, and private-state
  surfaces that must not move automatically.

This report does not authorize copy, move, delete, stub replacement, route
cutover, Agent loader implementation, AdminPanel loader implementation,
LocalState migration, commit, push, PR, release, or remote write.

## 2. Goal Gate

This package moves the three-day goal forward because it makes the externalized
Jenn surface measurable before any migration action. It helps reduce future
upstream conflict pressure by identifying what can be discussed as an external
package later, while keeping all current actions readonly except this document.

## 3. Source Revisions

| Source | State |
| --- | --- |
| Core workspace | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox` |
| Core branch | `main` |
| Core HEAD | `ee61d579b2e0fda4ad2d76ccfbd4fa530cf2dddf` |
| Core `origin/main` | `ee61d579b2e0fda4ad2d76ccfbd4fa530cf2dddf` |
| Core `upstream/main` | `22899aedd076c8c27434a66b4fa468515e17bcae` |
| Core merge-base | `8b8a71d80672d2f0a060d4bc47384d1e3ad2d05e` |
| Core worktree before this report | modified docs-only plan file: `docs/governance/JENN_EXTRACTION_IMPLEMENTATION_PLAN_20260608.md` |
| Extensions workspace | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions` |
| Extensions branch | `main` |
| Extensions HEAD | `f7772c654c2d8d34698f2818fde02ec63df783cb` |
| Extensions worktree | clean |
| LocalState workspace | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState` |
| LocalState revision | not a Git repository |

The core path counts below were captured before this report file existed.
Rerunning the default inventory after this report is added should increase
`docs_only` / `governance` counts by at least one path record.

## 4. Generation Commands

Core repository metadata:

```powershell
git branch --show-current
git status --short
git diff --stat
git rev-parse HEAD
git rev-parse origin/main
git rev-parse upstream/main
git merge-base origin/main upstream/main
```

Core path-only inventory:

```powershell
node scripts/p3-external-ecosystem-inventory.js --summary
node scripts/p3-external-ecosystem-inventory.js --summary --files-only
```

Core tracked Jenn-surface aggregation:

```powershell
git -c core.quotePath=false ls-files
```

Filters applied to that tracked-file list:

```text
exact paths:
  AGENTS.override.md
  MEMORY.md
  README For VCPChat.md

prefixes:
  Agent/
  .agent_board/
  data/photo-studio/
  modules/photoStudio/
  plugins/custom/shared/photo_studio_data/

admin route files:
  AdminPanel-Vue/src/app/routes/components.ts
  AdminPanel-Vue/src/app/routes/manifest.ts

plugin families:
  /^(AIGent|Agent|MagiAgent|CodexMemoryBridge|DingTalk|Image|PhotoStudio)/i
```

External package metadata:

```powershell
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions branch --show-current
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status --short
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions -c core.quotePath=false ls-files
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState\.git
Get-ChildItem -LiteralPath A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState -Force | Select-Object Name,Mode
```

Derived aggregation commands for sections 7, 9, and 10:

```powershell
$tracked = git -c core.quotePath=false ls-files
$tracked.Count
$tracked | Where-Object { $_ -eq 'AGENTS.override.md' } | Measure-Object
$tracked | Where-Object { $_ -eq 'MEMORY.md' } | Measure-Object
$tracked | Where-Object { $_ -eq 'README For VCPChat.md' } | Measure-Object
$tracked | Where-Object { $_ -like 'Agent/*' } | Measure-Object
$tracked | Where-Object { $_ -like '.agent_board/*' } | Measure-Object
$tracked | Where-Object { $_ -like 'data/photo-studio/*' } | Measure-Object
$tracked | Where-Object { $_ -like 'modules/photoStudio/*' } | Measure-Object
$tracked | Where-Object { $_ -like 'plugins/custom/shared/photo_studio_data/*' } | Measure-Object
$tracked | Where-Object { $_ -match '^AdminPanel-Vue/src/app/routes/(components|manifest)\.ts$' }
$tracked | Where-Object { $_ -match '^Plugin/(AIGent|Agent|MagiAgent|CodexMemoryBridge|DingTalk|Image|PhotoStudio)[^/]*/' } |
  ForEach-Object { ($_ -split '/')[1] } |
  Group-Object |
  Sort-Object Name |
  Select-Object Name,Count
```

Derived env-path existence check for candidate plugins:

```powershell
'AIGentWorkflow','AgentMessage','CodexMemoryBridge','MagiAgent','AIGentQuality','AIGentStyle','DingTalkTable' |
  ForEach-Object {
    [pscustomobject]@{
      Plugin = $_
      ConfigEnvExists = Test-Path -LiteralPath "Plugin\$_\config.env"
      DotEnvExists = Test-Path -LiteralPath "Plugin\$_\.env"
    }
  }
```

External package and LocalState path-record aggregation:

```powershell
function Measure-PathRecordsWithSkippedChildren {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string[]]$SkipChildRoots
  )

  $records = New-Object System.Collections.Generic.List[string]

  function Visit-PathRecord {
    param([string]$Directory, [string]$Relative)

    Get-ChildItem -LiteralPath $Directory -Force | ForEach-Object {
      $childRelative = if ($Relative) { "$Relative/$($_.Name)" } else { $_.Name }
      $records.Add($childRelative)

      $top = ($childRelative -split '/')[0]
      if ($_.PSIsContainer -and -not ($SkipChildRoots -contains $top)) {
        Visit-PathRecord -Directory $_.FullName -Relative $childRelative
      }
    }
  }

  Visit-PathRecord -Directory $Root -Relative ''
  $records | Measure-Object
}

Get-ChildItem -LiteralPath A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions -Force
Measure-PathRecordsWithSkippedChildren `
  -Root A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions `
  -SkipChildRoots '.git','node_modules'

Get-ChildItem -LiteralPath A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState -Force
Measure-PathRecordsWithSkippedChildren `
  -Root A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState `
  -SkipChildRoots 'secrets','cache','logs','outputs'
```

## 5. Classification Rules

Classification helper:

```text
scripts/p3-external-ecosystem-inventory.js
schemaVersion: p3c.path-only.inventory.v1
mode: path-only
classification audit date: 2026-06-14
```

Default helper skip directories:

```text
.git
node_modules
.local-retain
```

Extra path-only aggregation skips:

| Source | Skipped child traversal | Reason |
| --- | --- | --- |
| `VCPToolBox-JENN-Extensions` | `.git`, `node_modules` | repository metadata and dependency folders are not inventory material |
| `VCPToolBox-JENN-LocalState` | `secrets`, `cache`, `logs`, `outputs` children | secret/runtime/private state must remain path-only and blocked |

Evidence boundary:

- no arbitrary file content reads for classification evidence;
- controlled non-secret `plugin-manifest.json` metadata reads are allowed only
  where this report documents external plugin manifest names and duplicate-name
  risk;
- no real `.env` or `config.env` content reads;
- no plugin `config.env` content reads;
- no LocalState `secrets/`, `cache/`, `logs/`, or `outputs/` child traversal;
- no runtime loader, install, server, API, or Admin action;
- no copy, move, delete, or migration action.

## 6. Core Inventory Summary

Default filesystem path inventory:

| Metric | Count |
| --- | ---: |
| total path records | 7516 |
| truncated | false |
| limit | 100000 |
| `blocked` | 1852 |
| `keep_core` | 954 |
| `unknown` | 1 |
| `deferred` | 3234 |
| `externalizable` | 1186 |
| `docs_only` | 289 |

Files-only path inventory:

| Metric | Count |
| --- | ---: |
| total file records | 6620 |
| truncated | false |
| limit | 100000 |
| `blocked` | 1553 |
| `keep_core` | 863 |
| `deferred` | 2989 |
| `externalizable` | 931 |
| `docs_only` | 284 |

Important default surface counts:

| Surface | Count |
| --- | ---: |
| `plugin-legacy` | 999 |
| `adapter` | 879 |
| `admin-panel` | 618 |
| `runtime-state` | 477 |
| `memory` | 2079 |
| `generated-build-artifact` | 1314 |
| `private-store` | 30 |
| `secret-config` | 6 |
| `secret-like-path` | 8 |
| `protected-agent-board` | 6 |
| `agent` | 16 |
| `shared-state` | 17 |

## 7. Tracked Jenn Core Surfaces

Tracked core file count:

```text
git tracked files: 5426
```

Tracked Jenn-adjacent roots and exact paths:

| Path or filter | Tracked path count | Current decision |
| --- | ---: | --- |
| `Agent/` | 16 | externalizable later, Agent loader not implemented |
| `.agent_board/` | 5 | blocked / protected agent board |
| `AGENTS.override.md` | 1 | docs_only / governance-adjacent |
| `MEMORY.md` | 1 | docs_only / memory-adjacent |
| `README For VCPChat.md` | 1 | docs_only |
| `data/photo-studio/` | 1 | blocked local-cache-state |
| `modules/photoStudio/` | 30 | deferred adapter split |
| `plugins/custom/shared/photo_studio_data/` | 17 | deferred shared-state |
| `AdminPanel-Vue/src/app/routes/components.ts` | 1 | keep_core until AdminPanel extension design |
| `AdminPanel-Vue/src/app/routes/manifest.ts` | 1 | keep_core until AdminPanel extension design |

Tracked Jenn plugin family paths:

| Plugin family or plugin | Tracked files | Decision |
| --- | ---: | --- |
| `AIGentOrchestrator` | 5 | externalizable; already has external copy-first sample |
| `AIGentPrompt` | 7 | externalizable candidate; has nested paths |
| `AIGentQuality` | 4 | externalizable dry-run candidate |
| `AIGentStyle` | 4 | externalizable dry-run candidate |
| `AIGentWorkflow` | 2 | externalizable dry-run candidate |
| `AgentAssistant` | 8 | externalizable candidate |
| `AgentDream` | 7 | externalizable candidate; no tracked manifest in path-only check |
| `AgentMessage` | 2 | externalizable dry-run candidate |
| `CodexMemoryBridge` | 2 | externalizable adapter dry-run candidate |
| `DingTalkCLI` | 25 | externalizable but larger/nested candidate |
| `DingTalkTable` | 4 | externalizable dry-run candidate |
| `ImageAutoRegister` | 5 | externalizable candidate |
| `ImageProcessor` | 6 | externalizable candidate |
| `ImageRatingManager` | 12 | externalizable candidate |
| `ImageServer` | 3 | externalizable candidate, but local untracked `config.env` path exists and blocks first-pass dry-run selection |
| `MagiAgent` | 3 | externalizable dry-run candidate |
| `PhotoStudio*` plugin directories | 20 directories, 3 tracked files each | externalizable later, but tied to deferred PhotoStudio state/modules |

PhotoStudio leaf plugin directories observed:

```text
PhotoStudioAssetArchive
PhotoStudioCalendarSync
PhotoStudioCaseContentDraft
PhotoStudioContentPool
PhotoStudioCustomerRecord
PhotoStudioDeliveryAuditTrail
PhotoStudioDeliveryOperatorReport
PhotoStudioDeliveryPriority
PhotoStudioDeliveryQueue
PhotoStudioDeliveryTasks
PhotoStudioExternalSync
PhotoStudioFieldAudit
PhotoStudioFollowupReminder
PhotoStudioProjectRecord
PhotoStudioProjectStatus
PhotoStudioProjectTasks
PhotoStudioQueueScheduler
PhotoStudioReplyDraft
PhotoStudioSelectionNotice
PhotoStudioWeeklyProjectDigest
```

## 8. External Package State

`VCPToolBox-JENN-Extensions`:

| Metric | Value |
| --- | --- |
| exists | yes |
| Git repository | yes |
| branch | `main` |
| HEAD | `f7772c654c2d8d34698f2818fde02ec63df783cb` |
| worktree | clean |
| tracked files | 17 |
| top-level path count | 7 |
| recursive path records after skipping `.git` and `node_modules` children | 30 |

Tracked external plugin directories:

| Plugin directory | Manifest name | Tracked files | Collision note |
| --- | --- | ---: | --- |
| `Plugin/AIGentOrchestrator` | `AIGentOrchestrator` | 4 | same manifest name as core `Plugin/AIGentOrchestrator`; duplicate-name behavior must be treated as intentional copy-first evidence, not an independent no-conflict candidate |
| `Plugin/JennAIGentOrchestrator` | `JennAIGentOrchestrator` | 4 | renamed parallel external candidate |
| `Plugin/NoopJennExternalPlugin` | `NoopJennExternalPlugin` | 3 | no core collision observed |

Top-level external package paths:

```text
.git
.gitignore
docs
Plugin
README.AGENTS_OS.md
receipts
scripts
```

`VCPToolBox-JENN-LocalState`:

| Metric | Value |
| --- | --- |
| exists | yes |
| Git repository | no |
| revision | not a Git repository |
| top-level path count | 6 |
| recursive path records after skipping `secrets`, `cache`, `logs`, and `outputs` children | 7 |

Top-level LocalState paths:

| Path | Classification |
| --- | --- |
| `cache` | blocked runtime/cache state; children not traversed |
| `logs` | blocked runtime/log state; children not traversed |
| `outputs` | blocked generated/private output state; children not traversed |
| `receipts` | path-only receipt area; one child record observed: `receipts/README.AGENTS_OS.md` |
| `secrets` | blocked secret state; children not traversed |
| `README.AGENTS_OS.md` | docs-only local package note |

## 9. Candidate Next Dry-Run Set

These are candidates for a later `P7 Plugin Copy-First` dry-run discussion only.
They are not copy authorization and not migration authorization.

Path-only candidate criteria used here:

- tracked under `Plugin/<name>/`;
- classified as `externalizable`;
- has a tracked `plugin-manifest.json`;
- has no tracked `Plugin/<name>/config.env`;
- has no filesystem `Plugin/<name>/config.env` or `Plugin/<name>/.env` path at
  candidate review time;
- has at most four tracked files;
- all tracked files are direct children of the plugin directory.

The filesystem env-path check is intentionally path-only and does not read file
contents. It was run for the seven candidates below during this report review;
all returned `false` for both `config.env` and `.env`. P7 must rerun this check
before any dry-run design because ignored local env files can appear without
changing Git status.

Jenn-adjacent file-count candidates:

| Candidate | Tracked files | Target lane | File-count reason |
| --- | ---: | --- | --- |
| `Plugin/AIGentWorkflow` | 2 | `plugins-legacy/` | smallest AIGent candidate |
| `Plugin/AgentMessage` | 2 | `plugins-legacy/` | small Agent-related candidate |
| `Plugin/CodexMemoryBridge` | 2 | `adapters/codex/` | small Codex bridge adapter |
| `Plugin/MagiAgent` | 3 | `plugins-legacy/` | small Agent-related candidate |
| `Plugin/AIGentQuality` | 4 | `plugins-legacy/` | small AIGent candidate |
| `Plugin/AIGentStyle` | 4 | `plugins-legacy/` | small AIGent candidate |
| `Plugin/DingTalkTable` | 4 | `plugins-legacy/` | small DingTalk candidate |

Semantic-risk review for first P7 dry-run design:

| Candidate | Semantic risk | Review note |
| --- | --- | --- |
| `Plugin/AIGentQuality` | lower | manifest states rule-based inspection and no external vision model call by default |
| `Plugin/AIGentStyle` | medium | manifest states dry-run training, but has dataset/output roots and optional write-like behaviors that need closer review |
| `Plugin/AIGentWorkflow` | medium-high | manifest references ComfyUI and AIGentPrompt workflow execution dependencies |
| `Plugin/AgentMessage` | medium-high | manifest enables WebSocket push behavior |
| `Plugin/CodexMemoryBridge` | medium-high | manifest handles memory write requests and audit behavior |
| `Plugin/DingTalkTable` | high | manifest is a DingTalk compatibility layer and includes real write actions behind apply/gating semantics |
| `Plugin/MagiAgent` | high | manifest uses `hybridservice` and `direct` communication rather than the safer stdio-only lane |

Recommended first P7 dry-run design target by this semantic-risk review:

```text
Plugin/AIGentQuality
```

This recommendation is still only for dry-run design. It does not authorize
copying, extraction, route cutover, stub replacement, runtime loading, or
execution behavior changes.

PhotoStudio leaf plugins also match the path-only size rule, but they should
not be first unless the next package explicitly handles `modules/photoStudio/`
and `plugins/custom/shared/photo_studio_data/` as deferred dependencies.

## 10. Blocked And Deferred Surfaces

Default helper blocked counts:

| Surface | Count |
| --- | ---: |
| `runtime-state` | 477 |
| `generated-build-artifact` | 1314 |
| `private-store` | 30 |
| `secret-config` | 6 |
| `secret-like-path` | 8 |
| `protected-agent-board` | 6 |
| `local-cache-state` | 11 |

Tracked-file blocked or sensitive-adjacent counts:

| Surface | Tracked count |
| --- | ---: |
| `.agent_board/` protected agent board | 5 |
| `secret-config` | 0 |
| `secret-like-path` | 7 |
| `local-cache-state` | 1 |
| `private-store` | 0 |
| `generated-build-artifact` | 0 |
| `runtime-state` | 395 |

Additional path-only filesystem env observations:

| Path | Tracked by Git | Review impact |
| --- | --- | --- |
| `Plugin/ImageServer/config.env` | no | blocks `Plugin/ImageServer` from first-pass dry-run candidate selection until separately reviewed |

Deferred surfaces that need separate design gates:

| Surface | Reason |
| --- | --- |
| `modules/photoStudio/` | business logic split required before PhotoStudio package movement |
| `plugins/custom/shared/photo_studio_data/` | shared data/state policy required |
| AdminPanel Jenn routes | extension loader design required |
| `Agent/` | external Agent loader contract not implemented |
| LocalState package | private/runtime/secret governance required |

## 11. Missing Runtime Lanes

These environment/runtime lanes are still not implemented and must not be
assumed available:

```text
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
VCP_LOCAL_STATE_DIR
VCP_ADMIN_EXTENSION_DIRS
```

The only mature externalization lane observed in this inventory is the external
plugin lane built around `VCP_PLUGIN_DIRS`, allowed roots, install roots,
allowlists, and safety gates.

## 12. Exit Criteria Check

| Required by V2 plan | Status |
| --- | --- |
| inventory reflects current `main` | yes, core HEAD and worktree state recorded |
| records core commit | yes |
| records external package revision state | yes |
| records LocalState revision state | yes, not a Git repository |
| records generation commands | yes |
| records filters and excluded path classes | yes |
| separates candidates and blocked surfaces | yes |
| records derived aggregation commands | yes |
| records candidate filesystem env-path check | yes |
| records external AIGent manifest name collision note | yes |
| path-only for sensitive files | yes |
| no file movement | yes |
| no file deletion | yes |
| no plugin copy/extraction | yes |
| no secret content reads | yes |

## 13. Next Safe Action

The next safe action is to review this report and select one candidate for a
P7 dry-run design only. By file count, the lowest-friction candidates are:

```text
Plugin/AIGentWorkflow
Plugin/AgentMessage
Plugin/CodexMemoryBridge
```

By semantic risk, the recommended first P7 dry-run design target is:

```text
Plugin/AIGentQuality
```

Any real copy, extraction, move, delete, stub replacement, or route cutover
still requires explicit authorization under the V2 plan.

## 14. Validation

Validation run after this report was created:

```powershell
git diff --check
node --check scripts/p3-external-ecosystem-inventory.js
node --test tests/p3-external-ecosystem-inventory.test.js
node scripts/p3-external-ecosystem-inventory.js --summary
```

Observed result:

```text
git diff --check: pass; Git emitted only the existing LF-to-CRLF warning for the modified plan file
node --check scripts/p3-external-ecosystem-inventory.js: pass
node --test tests/p3-external-ecosystem-inventory.test.js: 12/12 pass
post-report summary total: 7517
post-report docs_only: 290
post-report governance: 200
```

The post-report summary increased by one path record compared with the captured
baseline in section 6, as expected, because this report became one additional
`docs_only` / `governance` path.

Review-fix validation run after addressing the first P3 Inventory V2 review:

```powershell
git diff --check
node --check scripts/p3-external-ecosystem-inventory.js
node --test tests/p3-external-ecosystem-inventory.test.js
node scripts/p3-external-ecosystem-inventory.js --summary
Select-String -Path docs/governance/P3_JENN_EXTERNALIZATION_INVENTORY_V2_20260614.md -Pattern 'ImageProcessor|ImageServer|top-level path count|recursive path records|Derived aggregation|filesystem env-path|Manifest name|collision|records derived'
```

Observed result:

```text
git diff --check: pass; Git emitted only the existing LF-to-CRLF warning for the modified plan file
node --check scripts/p3-external-ecosystem-inventory.js: pass
node --test tests/p3-external-ecosystem-inventory.test.js: 12/12 pass
post-report summary total: 7517
review-fix markers: present
```

Second review-fix validation run after tightening reproducibility and evidence
boundary language:

The first two commands require the `Measure-PathRecordsWithSkippedChildren`
function defined in section 4.

```powershell
Measure-PathRecordsWithSkippedChildren -Root A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions -SkipChildRoots '.git','node_modules'
Measure-PathRecordsWithSkippedChildren -Root A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState -SkipChildRoots 'secrets','cache','logs','outputs'
$tracked = git -c core.quotePath=false ls-files
$tracked | Where-Object { $_ -eq 'AGENTS.override.md' } | Measure-Object
$tracked | Where-Object { $_ -eq 'MEMORY.md' } | Measure-Object
$tracked | Where-Object { $_ -eq 'README For VCPChat.md' } | Measure-Object
$tracked | Where-Object { $_ -like 'data/photo-studio/*' } | Measure-Object
Select-String -Path docs/governance/P3_JENN_EXTERNALIZATION_INVENTORY_V2_20260614.md -Pattern 'arbitrary file content|controlled non-secret|plugin-manifest|Measure-PathRecordsWithSkippedChildren'
```

Observed result:

```text
Extensions path records with skipped child traversal: 30
LocalState path records with skipped child traversal: 7
AGENTS.override.md tracked count: 1
MEMORY.md tracked count: 1
README For VCPChat.md tracked count: 1
data/photo-studio/ tracked count: 1
evidence-boundary markers: present
```

Third review-fix validation run after clarifying candidate ranking and status
language:

```powershell
Select-String -Path docs/governance/P3_JENN_EXTERNALIZATION_INVENTORY_V2_20260614.md -Pattern 'path-oriented|manifest metadata exception|Semantic-risk|AIGentQuality|By file count|first two commands require'
git diff --check
node --check scripts/p3-external-ecosystem-inventory.js
node --test tests/p3-external-ecosystem-inventory.test.js
node scripts/p3-external-ecosystem-inventory.js --summary
```

Observed result:

```text
status and semantic-risk markers: present
git diff --check: pass; Git emitted only the existing LF-to-CRLF warning for the modified plan file
node --check scripts/p3-external-ecosystem-inventory.js: pass
node --test tests/p3-external-ecosystem-inventory.test.js: 12/12 pass
post-report summary total: 7517
```
