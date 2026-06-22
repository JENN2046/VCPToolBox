# M116 AIGentQuality Temp Review-Copy Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_COPY_NO_RUNTIME

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M115_PLUGIN_RECONCILE_DECISION_REVIEW_COPY_TASKBOOK_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M116 defines the exact future temp review-copy gate for `Plugin/AIGentQuality/**`.

This taskbook exists because M114 found that the external and core `AIGentQuality` path sets match, but three shared files differ by SHA256. M116 does not decide that core should replace external. It only defines how a future review-copy can be prepared outside the active external `Plugin/` runtime package.

M116 is taskbook-only. It does not copy, overwrite, delete, untrack, stub, enable plugin runtime, execute plugin entrypoints, write env, start services, read private content, or open upstream PRs.

## 2. Scope

Allowed source path:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentQuality\
```

Allowed future temp target root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\.tmp\m116-aigentquality-review-copy\
```

The temp target must stay outside:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality\
```

## 3. Future M117 Source Allowlist

Future M117 may consider only these tracked source files:

```text
Plugin/AIGentQuality/AIGentQuality.js
Plugin/AIGentQuality/README.md
Plugin/AIGentQuality/config.env.example
Plugin/AIGentQuality/plugin-manifest.json
```

No other `Plugin/**`, `Agent/**`, `AdminExtensions/**`, `LocalState/**`, `.agent_board/**`, provider, bridge, production, or upstream PR paths are in scope.

## 4. Future M117 Required Preflight

Before any temp review-copy, M117 must confirm:

```text
core worktree clean or only current docs changes
external package worktree clean
active external Plugin/AIGentQuality/** is not modified
source path allowlist exactly matches M116
path-risk hits are 0
no LocalState/private/.agent_board paths are included
```

M117 must stop if:

```text
external package has unrelated uncommitted changes
source allowlist expands
path scan hits env/secret/auth/token/private/state/cache/log/image paths
temp copy would require writing into active external Plugin/AIGentQuality/**
checksum comparison requires printing source contents
runtime registration is needed to validate
```

## 5. Future M117 Temp Copy Rules

If explicitly executed later, M117 may copy only into:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\.tmp\m116-aigentquality-review-copy\Plugin\AIGentQuality\
```

Required future evidence:

```text
TEMP_REVIEW_COPY_FILE_COUNT=4
TEMP_REVIEW_COPY_PATH_RISK_HITS=0
TEMP_REVIEW_COPY_HASH_COMPARE_RECORDED=yes
ACTIVE_EXTERNAL_PLUGIN_AIGENTQUALITY_UNCHANGED=yes
RUNTIME_ENABLED=no
```

M117 must compare checksums without printing source bodies. It may record file names and hash equality/difference counts.

## 6. Future M117 Cleanup And Rollback

M117 cleanup target must be exactly:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\.tmp\m116-aigentquality-review-copy\
```

Cleanup must verify:

```text
TEMP_REVIEW_COPY_REMOVED=yes
ACTIVE_EXTERNAL_PLUGIN_AIGENTQUALITY_UNCHANGED=yes
EXTERNAL_MANIFEST_UNCHANGED=yes
```

No destructive cleanup may target any path outside the exact temp review-copy root.

## 7. Future Decision Outcomes

After M117 evidence, a later M118 decision may choose one of:

```text
KEEP_EXISTING_EXTERNAL_AS_FORK_SPECIFIC
PROMOTE_REVIEWED_COPY_LATER_WITH_EXPLICIT_OVERWRITE_GATE
BLOCK_AND_DEFER_AIGENTQUALITY_RECONCILE
```

M116 does not authorize active external overwrite.

## 8. Rollback

M116 rollback is docs-only:

```text
git revert <M116 docs/tracker commit>
```

No package/runtime/env rollback is required because M116 performs no implementation.

## 9. Result

```text
M116_AIGENTQUALITY_TEMP_REVIEW_COPY_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
COPY_EXECUTED=no
TEMP_COPY_EXECUTED=no
ACTIVE_EXTERNAL_PLUGIN_MODIFIED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M117_AIGENTQUALITY_TEMP_REVIEW_COPY_EVIDENCE_GATE
```
