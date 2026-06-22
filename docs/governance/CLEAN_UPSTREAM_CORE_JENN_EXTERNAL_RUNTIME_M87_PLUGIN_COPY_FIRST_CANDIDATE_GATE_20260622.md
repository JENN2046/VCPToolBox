# M87 Plugin Copy-First Candidate Gate

Date: 2026-06-22

Status: PLUGIN_COPY_FIRST_CANDIDATE_GATE_PASS_NO_COPY

Parent matrix: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M86_EXTRACTION_GAP_MATRIX_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M87 is the plugin copy-first candidate gate after M86.

M87 does not:

- copy plugin content into the external package;
- overwrite existing external plugin directories;
- read `.env`, `config.env`, secrets, tokens, auth material, credentials, or provider values;
- read or copy LocalState/private/operator data or `.agent_board/**`;
- enable `VCP_PLUGIN_DIRS`, `VCP_EXTERNAL_PLUGIN_ALLOWLIST`, provider runtime, bridge runtime, live writes, or production server;
- delete, untrack, stub, or remove core `Plugin/**`;
- open upstream PR.

M87 only checks candidate source path existence, external target presence, path-risk counts, and the next M88 allow/reconcile list.

## 2. Inputs

```text
architecture_plan=C:/Users/51529/Downloads/vcptoolbox_jenn_extraction_package/01-extraction-architecture-plan.md
core_repo=A:\AGENTS_OS_Workspace\runtime\VCPToolBox
external_package=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
external_branch=main
external_status_before_M87=clean
external_head_before_M87=3a63904e753aa8b8869f588fc0b8fc862354e123
core_head_before_M87=2bd7564d0b7d563076219a817fdcc98ed2e6dc2e
```

External `Plugin/` baseline:

```text
EXTERNAL_PLUGIN_DIRS=AIGentOrchestrator,AIGentQuality,JennAIGentOrchestrator,JennAIGentQualityTrial,NoopJennExternalPlugin
EXTERNAL_PLUGIN_FILE_COUNT=20
EXTERNAL_PLUGIN_PATH_RISK_COUNT=0
```

## 3. Path-Only Candidate Scan

M87 used path-only enumeration and risk counting. It did not read plugin file contents.

Risk path patterns covered env/config, secret/token/auth/credential/key names, LocalState, `.agent_board`, state/cache/log/output/image paths, DB/vector sidecars, temp paths, and private/data-style paths.

| Candidate plugin | Core exists | External exists | Source file count | Path risk count | M87 decision |
| --- | --- | --- | ---: | ---: | --- |
| `Plugin/AIGentOrchestrator/**` | yes | yes | 5 | 0 | RECONCILE_REQUIRED_NO_OVERWRITE |
| `Plugin/AIGentPrompt/**` | yes | no | 7 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/AIGentQuality/**` | yes | yes | 4 | 0 | RECONCILE_REQUIRED_NO_OVERWRITE |
| `Plugin/AIGentStyle/**` | yes | no | 4 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/AIGentWorkflow/**` | yes | no | 2 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/CodexMemoryBridge/**` | yes | no | 2 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/DingTalkCLI/**` | yes | no | 25 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/DingTalkTable/**` | yes | no | 4 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/ImageAutoRegister/**` | yes | no | 5 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/ImageRatingManager/**` | yes | no | 15 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |
| `Plugin/PhotoStudioAssetArchive/**` | yes | no | 3 | 0 | ALLOW_M88_COPY_FIRST_CANDIDATE |

M87 counts:

```text
PLAN_PLUGIN_CANDIDATE_COUNT=11
SOURCE_PATH_RISK_COUNT=0
EXTERNAL_TARGET_PATH_RISK_COUNT=0
ALLOW_M88_COPY_FIRST_CANDIDATE_COUNT=9
RECONCILE_REQUIRED_NO_OVERWRITE_COUNT=2
BLOCK_COUNT=0
CONTENT_COPIED=0
RUNTIME_ENABLED=0
CORE_PLUGIN_STUB_REMOVE_UNTRACK=0
```

## 4. M88 Proposed Copy List

M88 may copy only these missing external directories, after repeating the same path-risk preflight and before generating a new manifest checksum:

```text
Plugin/AIGentPrompt/**
Plugin/AIGentStyle/**
Plugin/AIGentWorkflow/**
Plugin/CodexMemoryBridge/**
Plugin/DingTalkCLI/**
Plugin/DingTalkTable/**
Plugin/ImageAutoRegister/**
Plugin/ImageRatingManager/**
Plugin/PhotoStudioAssetArchive/**
```

M88 must not overwrite these existing external directories:

```text
Plugin/AIGentOrchestrator/**
Plugin/AIGentQuality/**
```

Those require a separate reconcile decision because an external directory already exists.

## 5. M88 Safety Rules

M88 copy-first must:

```text
repeat source and target path-risk scan
copy only the M87 allowlist
exclude .env/config.env/secret/auth/token/credential files if discovered
preserve existing external Plugin directories
generate or update external manifest checksum after copy
run package path-risk scan after copy
write receipt with source counts, target counts, checksum, and rollback commit
```

M88 must not:

```text
enable VCP_PLUGIN_DIRS
enable external plugin runtime registration
treat discovery as execution permission
copy LocalState/private/.agent_board/**
delete/untrack/stub core Plugin/**
start production server
call provider or bridge
open upstream PR
```

## 6. Validation

Commands / checks represented:

```text
git branch --show-current
git status --short
path-only existence check for 11 planned plugin candidates
path-only source risk count for 11 planned plugin candidates
external Plugin/ baseline path-risk count
external package branch/status/head check
```

Validation summary:

```text
PLUGIN_COPY_FIRST_CANDIDATE_GATE_PASS_NO_COPY=yes
SOURCE_PATH_RISK_COUNT=0
EXTERNAL_PLUGIN_PATH_RISK_COUNT=0
ALLOW_M88_COPY_FIRST_CANDIDATE_COUNT=9
RECONCILE_REQUIRED_NO_OVERWRITE_COUNT=2
BLOCK_COUNT=0
```

## 7. Rollback

M87 rollback is docs-only:

```text
revert this M87 candidate gate document
revert tracker M87/S108/Q69 updates
```

No external package rollback is needed because M87 does not copy or modify external package content.
