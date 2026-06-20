# M0 Baseline Inventory Secret-Risk Evidence

Date: 2026-06-21

Status: PASS_WITH_PATH_RISK_FINDINGS

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M0 closes the missing Phase 0 evidence for the Clean Upstream Core + Jenn External Runtime route.

This document records:

- upstream and Jenn fork remote evidence;
- clean-core branch creation evidence;
- old Jenn fork inventory evidence;
- external package and LocalState boundary evidence;
- paths-only secret-risk scan results.

No file contents, secrets, LocalState data, `.agent_board/**` contents, provider data, bridge data, or runtime private state were read.

## 2. Safety Scope

Allowed in this M0 closeout:

- `git fetch` for read-only remote-tracking refs;
- `git remote -v`;
- `git rev-parse`;
- `git show --no-patch`;
- `git ls-tree -r --name-only`;
- `git ls-files -co --exclude-standard`;
- path-count and path-pattern scans.

Not performed:

- no upstream PR;
- no upstream push;
- no delete, untrack, or stub action;
- no `.env`, secret, token, credential, or auth material read;
- no LocalState/private/operator data enumeration;
- no `.agent_board/**` content read, copy, checksum, or migration;
- no provider call, bridge call, live external write, deploy, or release.

## 3. Baseline Refs

Observed after read-only fetch on 2026-06-21:

```text
Workspace: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
Current branch: codex/m2-m7-jenn-external-runtime-roadmap
Pre-M0 evidence collection HEAD: df314cd2bf69bd91290e65127c7a48f1479647f5
M0 closeout commit: 0e813f6de7fcbd470b3954c75664376ffafbc9a1

origin fetch/push: https://github.com/JENN2046/VCPToolBox.git
upstream fetch/push: https://github.com/lioensky/VCPToolBox.git

origin/main: e5874076cf7946911815ac100bb2027038a6cc73
origin/codex/upstream-main-clean-base: 86c69e8dc2a1fad6aeb0fe3d2df1d3e2248e2fcb
origin/codex/phase1-clean-core-plugin-contract: a4225acaafd0cf6019c843d65f374b499febe165
upstream/main: f8d4547998ba2767d86ce6bb04e728388bd07c3b
merge-base(upstream/main, origin/codex/upstream-main-clean-base): f901f1a995fa6f8242e176b8ca66b6addd0be427
```

## 4. Clean-Core Creation Record

Clean-base candidate:

```text
ref: origin/codex/upstream-main-clean-base
commit: 86c69e8dc2a1fad6aeb0fe3d2df1d3e2248e2fcb
parents:
  f901f1a995fa6f8242e176b8ca66b6addd0be427
  a4225acaafd0cf6019c843d65f374b499febe165
subject: Merge pull request #272 from JENN2046/codex/phase1-clean-core-plugin-contract
date: 2026-06-20 20:37:20 +0800
```

Interpretation:

- `f901f1a9` is the upstream-line parent used for the clean-base merge.
- `a4225aca` is the final Phase 1 clean-core plugin contract head.
- `86c69e8d` is the Jenn clean-base merge commit for PR #272.
- Latest `upstream/main` is now `f8d45479`, so any future upstream PR candidate must follow the M8 rebase workflow before opening a PR.

This is sufficient M0 creation evidence for the Jenn fork route. It is not a claim that an upstream PR has been opened.

## 5. Old Fork Inventory

Old Jenn fork reference:

```text
ref: origin/main
commit: e5874076cf7946911815ac100bb2027038a6cc73
subject: docs: add S7 external runtime denylist baseline
date: 2026-06-21 04:13:23 +0800
role: inventory / parity reference only
```

Path-only inventory:

| Ref | Total tracked paths | Plugin paths | Plugin manifests | Agent txt | Admin views | Admin routes | Tests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `origin/main` | 5449 | 1501 | 141 | 12 | 51 | 31 | 114 |
| `origin/codex/upstream-main-clean-base` | 2954 | 1395 | 115 | 8 | 48 | 28 | 8 |
| pre-M0 evidence `HEAD` (`df314cd2`) | 5456 | 1501 | 141 | 12 | 51 | 31 | 114 |

Inventory conclusion:

- `origin/main` / pre-M0 evidence `HEAD` remain Jenn governance and inventory surfaces.
- `origin/codex/upstream-main-clean-base` remains the Phase 1 clean-base candidate.
- M2-M8 governance docs and external receipts are not upstream PR candidate content.
- Old fork paths are reference material only; this M0 closeout does not migrate, copy, checksum, delete, untrack, or stub them.

## 6. Paths-Only Secret-Risk Scan

Scan method:

```powershell
git ls-tree -r --name-only <ref>
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions ls-files -co --exclude-standard
```

Risk patterns were path-only and intentionally conservative:

```text
.env
config.env
state/
cache/
log/
logs/
DebugLog/
image/
output/
outputs/
secrets/
.agent_board/
Plugin/UserAuth/code.bin
ModelRedirect.json
agent_map.json
preprocessor_order.json
tag-processor-config.env
SemanticModelRouter.local.json
sarprompt.json
ip_blacklist.json
*.sqlite
*.sqlite3
*.db
*.log
```

Summary:

| Surface | Path count scanned | High-risk path count | Result |
| --- | ---: | ---: | --- |
| `origin/main` | 5449 | 8 | FINDINGS_RECORDED_REFERENCE_ONLY |
| `origin/codex/upstream-main-clean-base` | 2954 | 28 | FINDINGS_RECORDED_UPSTREAM_INHERITED |
| pre-M0 evidence `HEAD` (`df314cd2`) | 5456 | 8 | FINDINGS_RECORDED_GOVERNANCE_BRANCH |
| `VCPToolBox-JENN-Extensions` | 29 | 0 | PASS |

Important interpretation:

- A path match is not proof of secret content; no file contents were read.
- `origin/codex/upstream-main-clean-base` includes upstream-inherited `config.env` paths and image paths. They are recorded as baseline reality, not copied into an external package.
- `origin/main` / pre-M0 evidence `HEAD` include tracked `.agent_board/**` path names. They remain blocked from automatic copy, checksum, migration, or LocalState handling.
- `VCPToolBox-JENN-Extensions` path scan is clean for the current reviewed package surface.

Observed high-risk path findings:

```text
origin/main:
  .agent_board/CHECKPOINT.md
  .agent_board/HANDOFF.md
  .agent_board/RUN_STATE.md
  .agent_board/TASK_QUEUE.md
  .agent_board/VALIDATION_LOG.md
  image/doubaogen/1ec83c74-1c7c-4871-991d-f9160a105634.png
  image/magi/MagiResolved.gif
  image/magi/MagiUnresolved.gif

origin/codex/upstream-main-clean-base:
  docs/image/* path matches
  image/fluxgen/* path matches
  image/magi/* path matches
  Plugin/CodeSearcher/config.env
  Plugin/DailyNote/config.env
  Plugin/DailyNoteWrite/config.env
  Plugin/FileOperator/config.env
  Plugin/JapaneseHelper/config.env
  Plugin/LinuxLogMonitor/state/*
  Plugin/LinuxShellExecutor/config.env
  Plugin/MagiAgent/config.env
  Plugin/MCPO/config.env
  Plugin/MCPOMonitor/config.env
  Plugin/NCBIDatasets/config.env
  Plugin/PowerShellExecutor/config.env
  Plugin/UserAuth/code.bin
  preprocessor_order.json

pre-M0 evidence HEAD (df314cd2):
  .agent_board/CHECKPOINT.md
  .agent_board/HANDOFF.md
  .agent_board/RUN_STATE.md
  .agent_board/TASK_QUEUE.md
  .agent_board/VALIDATION_LOG.md
  image/doubaogen/1ec83c74-1c7c-4871-991d-f9160a105634.png
  image/magi/MagiResolved.gif
  image/magi/MagiUnresolved.gif

VCPToolBox-JENN-Extensions:
  no high-risk path matches
```

## 7. External Runtime And LocalState Boundary

External runtime package:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
repo exists: yes
branch: main
status: clean and synced to origin/main
external package HEAD: bb1e35a0ccc8b4bc4e77bae30330b9a85b23a9fb
origin: https://github.com/JENN2046/VCPToolBox-JENN-Extensions
candidate path count: 29
high-risk path count: 0
```

LocalState:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
exists: yes
enumeration: skipped_private_by_default
```

LocalState remains private-by-default. Existence is recorded only to preserve the lane boundary.

## 8. M0 Decision

M0 status: PASS_WITH_PATH_RISK_FINDINGS.

Acceptance mapping:

| Requirement | Evidence | Result |
| --- | --- | --- |
| upstream remote recorded | `upstream = https://github.com/lioensky/VCPToolBox.git` | PASS |
| Jenn fork remote recorded | `origin = https://github.com/JENN2046/VCPToolBox.git` | PASS |
| fetch after upstream commit recorded | `upstream/main = f8d4547998ba2767d86ce6bb04e728388bd07c3b` | PASS |
| clean-core creation record | `origin/codex/upstream-main-clean-base = 86c69e8d`, parents `f901f1a9` and `a4225aca` | PASS |
| old fork inventory | `origin/main` path-only inventory recorded | PASS |
| secret-risk scan evidence | path-only scan recorded for old fork, clean-base, pre-M0 evidence HEAD, and external package | PASS_WITH_FINDINGS |
| LocalState protection | existence only; no enumeration | PASS |
| `.agent_board/**` protection | path findings recorded; no content read/copy/checksum/migration | PASS |

M0 is now complete for the Jenn fork internal maintenance route.

## 9. Validation

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M0_BASELINE_INVENTORY_SECRET_RISK_EVIDENCE_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "PASS_WITH_PATH_RISK_FINDINGS|origin/codex/upstream-main-clean-base|VCPToolBox-JENN-Extensions|enumeration: skipped_private_by_default|M0 status: PASS" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M0_BASELINE_INVENTORY_SECRET_RISK_EVIDENCE_20260621.md
git status --short
```

## 10. Rollback

Rollback by reverting this M0 evidence document and the tracker M0 update.

No code rollback is required because M0 performs no runtime code change, external copy, checksum migration, LocalState read, `.agent_board/**` read, provider call, bridge call, upstream PR, delete, untrack, stub, deployment, or release.
