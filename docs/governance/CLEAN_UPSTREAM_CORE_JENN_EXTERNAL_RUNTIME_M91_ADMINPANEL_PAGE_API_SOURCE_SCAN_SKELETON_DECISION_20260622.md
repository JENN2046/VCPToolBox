# M91 AdminPanel Page / API Source Scan And Skeleton Decision

Date: 2026-06-22

Status: SOURCE_PATH_SCAN_AND_SKELETON_DECISION_PASS_NO_COPY

Parent taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M90_ADMINPANEL_PAGE_API_EXTENSIONIZATION_TASKBOOK_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M91 performs only the path-level source scan, target skeleton decision, and blocker classification for the planned AdminPanel page/API extensionization lane.

M91 does not:

- read or copy AdminPanel page/API source content;
- create external `AdminExtensions/**` skeleton directories;
- modify `AdminPanel-Vue/**`;
- modify `AdminPanel-Vue/dist/**`;
- enable dynamic external Vue runtime;
- write real `.env`, `config.env`, secret, token, credential, auth, provider, or OAuth material;
- start production server, provider runtime, bridge runtime, or live external writes;
- read LocalState/private/operator/project data or `.agent_board/**`;
- delete, untrack, stub, or remove core AdminPanel fallback files;
- open upstream PR.

## 2. Repository State

```text
core_repo=A:\AGENTS_OS_Workspace\runtime\VCPToolBox
core_branch=codex/m2-m7-jenn-external-runtime-roadmap
core_pre_M91_head=44e234fb16840d4b75fa44ca08d1859a6714dc67
core_worktree_status=clean

external_repo=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
external_branch=main
external_head=ed8544f5feaafebbfeb029be2601a490249c3a71
external_worktree_status=clean
existing_admin_extension_packages=JennAdminStatus
```

## 3. Source Path Scan Summary

M91 scanned the ten M90 candidate source paths by path only.

```text
candidate_source_count=10
candidate_source_missing_count=0
source_hard_risk_count=0
source_review_risk_count=2
target_file_exists_count=0
target_hard_risk_count=0
target_review_risk_count=2
hard_block_group_count=0
metadata_skeleton_allow_count=5
review_required_group_count=1
```

Hard-risk path keywords checked:

```text
.env
config.env
LocalState
.agent_board
state
cache
log
image output
database
sqlite
vector store
AdminPanel-Vue/dist
```

Review-risk keywords checked:

```text
secret
token
credential
password
auth
oauth
provider key
```

The review-risk hits are expected AdminPanel surface names:

```text
AdminPanel-Vue/src/views/OAuthAuthCenter.vue
AdminPanel-Vue/src/api/oauthAuth.ts
AdminExtensions/OAuthAuthCenter/**
```

These are not treated as PASS-by-name. They are classified as `REVIEW_REQUIRED_BEFORE_COPY` for the future M93 content copy gate.

## 4. Candidate Matrix

| Group | Source files | Source missing | Hard path risk | Review path risk | Target package exists | M92 skeleton decision | M93 copy decision |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| `AiImageAgents` | 2 | 0 | 0 | 0 | no | `ALLOW_METADATA_SKELETON` | `SOURCE_REVIEW_REQUIRED_BEFORE_COPY` |
| `ChannelHub` | 2 | 0 | 0 | 0 | no | `ALLOW_METADATA_SKELETON` | `SOURCE_REVIEW_REQUIRED_BEFORE_COPY` |
| `CodexImagegenRelay` | 2 | 0 | 0 | 0 | no | `ALLOW_METADATA_SKELETON` | `SOURCE_REVIEW_REQUIRED_BEFORE_COPY` |
| `CodexMemoryMonitor` | 2 | 0 | 0 | 0 | no | `ALLOW_METADATA_SKELETON` | `SOURCE_REVIEW_REQUIRED_BEFORE_COPY` |
| `OAuthAuthCenter` | 2 | 0 | 0 | 2 | no | `ALLOW_METADATA_SKELETON_WITH_REVIEW_NOTE` | `REVIEW_REQUIRED_BEFORE_COPY` |

## 5. Target Skeleton Decision

M91 approves M92 to create metadata-only skeleton packages for:

```text
AdminExtensions/AiImageAgents/
AdminExtensions/ChannelHub/
AdminExtensions/CodexImagegenRelay/
AdminExtensions/CodexMemoryMonitor/
AdminExtensions/OAuthAuthCenter/
```

M92 may add only:

```text
README.AGENTS_OS.md
admin-extension-manifest.json
```

M92 must not copy:

```text
frontend/views/*.vue
frontend/api/*.ts
AdminPanel-Vue/dist/**
runtime loader code
real config/env material
LocalState/private/operator/project data
```

M92 must keep all skeleton manifests metadata-only and default-off:

```text
defaultEnabled=false
runtimeEnabled=false
dynamicVueImport=false
copyFirstContentIncluded=false
```

## 6. Blocker Classification

```text
HARD_BLOCK_GROUPS=0
M92_METADATA_SKELETON_ALLOWED_GROUPS=5
M93_SOURCE_REVIEW_REQUIRED_GROUPS=5
M93_EXTRA_AUTH_SURFACE_REVIEW_GROUPS=1
IMMEDIATE_COPY_ALLOWED_GROUPS=0
```

All future content copy remains blocked until M93 performs source content review and target scan. `OAuthAuthCenter` additionally requires auth/OAuth display guard review before any copy-first content gate.

## 7. Validation

```text
core git status --short: clean before M91 edits
external git status --short: clean
candidate source existence check: 10 / 10 present
source hard path-risk count: 0
source review path-risk count: 2
target hard path-risk count: 0
target review path-risk count: 2
target package exists count: 0
```

No content scan was performed in M91 by design. Content review belongs to M93.

## 8. Decision

M91 is PASS for source path scan and skeleton decision.

Next safe action:

```text
M92_ADMINPANEL_PAGE_API_EXTERNAL_SKELETON_PACKAGE_GATE
```

M92 may create empty metadata-only skeleton package directories under external `AdminExtensions/`, regenerate manifest checksum, and validate path risk. It must still not copy source content or enable runtime.

## 9. Rollback

Rollback M91 by reverting this receipt and tracker updates.

No external package files, AdminPanel source files, build artifacts, runtime env, or real config were changed in M91.
