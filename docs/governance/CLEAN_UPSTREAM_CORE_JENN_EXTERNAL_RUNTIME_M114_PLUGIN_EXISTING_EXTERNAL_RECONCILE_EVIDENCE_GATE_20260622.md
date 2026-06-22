# M114 Plugin Existing External Reconcile Evidence Gate

Date: 2026-06-22

Status: PASS_EVIDENCE_ONLY_NO_COPY_NO_RUNTIME

Parent taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M113_PLUGIN_EXISTING_EXTERNAL_RECONCILE_TASKBOOK_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Core repo: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox`

External package: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`

## 1. Purpose

M114 performs the evidence-only reconcile gate for two existing external plugin directories that M87/M88 intentionally did not overwrite.

This gate compares path sets, path-risk results, manifest coverage, external history, and SHA256 equality without printing source contents.

M114 does not copy, overwrite, delete, untrack, stub, enable plugin runtime, execute plugin entrypoints, write env, start services, read private content, or open upstream PRs.

## 2. Scope

M114 covers only:

```text
Plugin/AIGentOrchestrator/**
Plugin/AIGentQuality/**
```

M114 does not cover:

```text
other Plugin/**
Agent/**
AdminExtensions/**
LocalState/**
.agent_board/**
provider, bridge, production, or upstream PR lanes
```

## 3. Workspace Evidence

```text
CORE_HEAD=9465def7 docs: add plugin reconcile taskbook
EXTERNAL_HEAD=ca5c9c4 agent: add XiaoQiu override package
CORE_WORKTREE_BEFORE_M114=clean
EXTERNAL_WORKTREE_BEFORE_M114=clean
```

## 4. Path And Manifest Evidence

Path checks are path-only. Plugin source bodies were not printed.

| Evidence | Result |
| --- | --- |
| core tracked path count | `9` |
| external tracked path count | `8` |
| core path-risk hits | `0` |
| external path-risk hits | `0` |
| external `Plugin/AIGentOrchestrator/` manifest entries | `4` |
| external `Plugin/AIGentQuality/` manifest entries | `4` |
| full external manifest verify | `MANIFEST_VERIFY_COUNT=147`, `MANIFEST_VERIFY_BAD=0` |

External history evidence:

```text
Plugin/AIGentOrchestrator first observed external history: f7772c6 chore: initialize Jenn external package baseline
Plugin/AIGentQuality first observed external history: bd9997f [codex] plugin: add inactive AIGentQuality external copy
```

## 5. Reconcile Evidence Matrix

| Path | Core tracked paths | External tracked paths | Path-set diff | Shared-file hash result | M114 classification |
| --- | ---: | ---: | --- | --- | --- |
| `Plugin/AIGentOrchestrator/**` | 5 | 4 | core-only `.disabled` | 4 same, 0 different | KEEP_EXISTING_EXTERNAL |
| `Plugin/AIGentQuality/**` | 4 | 4 | none | 1 same, 3 different | NEEDS_REVIEW_COPY |

Observed path-set difference:

```text
Plugin/AIGentOrchestrator/.disabled exists in core but not in external
```

Observed hash differences:

```text
Plugin/AIGentQuality/AIGentQuality.js
Plugin/AIGentQuality/plugin-manifest.json
Plugin/AIGentQuality/README.md
```

Checksum comparison note:

```text
SHA256 values were computed for comparison, but file bodies and full source contents were not printed in this receipt.
```

## 6. Decisions

`Plugin/AIGentOrchestrator/**`:

```text
M114_CLASSIFICATION=KEEP_EXISTING_EXTERNAL
RATIONALE=shared files match; only core has .disabled marker
FUTURE_ACTION=do not overwrite; document .disabled as core-only difference unless a future runtime policy explicitly handles it
```

`Plugin/AIGentQuality/**`:

```text
M114_CLASSIFICATION=NEEDS_REVIEW_COPY
RATIONALE=path set matches but three shared files differ by SHA256
FUTURE_ACTION=write a follow-up decision gate before any copy, overwrite, or temp review copy
```

## 7. Recommended Next Gate

```text
NEXT_RECOMMENDED_GATE=M115_PLUGIN_RECONCILE_DECISION_OR_REVIEW_COPY_TASKBOOK
```

M115 should choose one of:

```text
KEEP_EXISTING_EXTERNAL_AS_FORK_SPECIFIC
WRITE_TEMP_REVIEW_COPY_TASKBOOK_FOR_AIGENTQUALITY
BLOCK_UNTIL_HUMAN_OVERWRITE_DECISION
```

M115 should not copy into the active external `Plugin/AIGentQuality/**` directory.

## 8. Rollback

M114 rollback is docs-only:

```text
git revert <M114 docs/tracker commit>
```

No package/runtime/env rollback is required because M114 performs no implementation.

## 9. Result

```text
M114_PLUGIN_EXISTING_EXTERNAL_RECONCILE_EVIDENCE_GATE_PASS=yes
EVIDENCE_ONLY=yes
COVERED_PLUGIN_DIRS=Plugin/AIGentOrchestrator,Plugin/AIGentQuality
CORE_PATH_RISK_HITS=0
EXTERNAL_PATH_RISK_HITS=0
MANIFEST_VERIFY_BAD=0
AIGENT_ORCHESTRATOR_CLASSIFICATION=KEEP_EXISTING_EXTERNAL
AIGENT_QUALITY_CLASSIFICATION=NEEDS_REVIEW_COPY
COPY_EXECUTED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M115_PLUGIN_RECONCILE_DECISION_OR_REVIEW_COPY_TASKBOOK
```
