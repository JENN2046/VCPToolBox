# M113 Plugin Existing External Reconcile Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_COPY_NO_RUNTIME

Decision: `WRITE_NO_OVERWRITE_RECONCILE_PLAN_FOR_EXISTING_EXTERNAL_PLUGIN_DIRS`

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M112_NEXT_UNEXTRACTED_DOMAIN_DECISION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

External package: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`

## 1. Purpose

M113 defines a reconcile plan for existing external plugin directories that were intentionally not overwritten during M87/M88.

This is taskbook-only. It does not copy, overwrite, delete, untrack, stub, enable plugin runtime, execute plugin entrypoints, write env, start services, read private content, or open upstream PRs.

## 2. Scope

M113 covers only:

```text
Plugin/AIGentOrchestrator/**
Plugin/AIGentQuality/**
```

It does not cover:

```text
Plugin/JennAIGentOrchestrator/**
Plugin/JennAIGentQualityTrial/**
other Plugin/**
Agent/**
AdminExtensions/**
LocalState/**
.agent_board/**
provider, bridge, production, or upstream PR lanes
```

## 3. Inputs Reviewed

| Input | Relevant result |
| --- | --- |
| M86 gap matrix | `AIGentOrchestrator` and `AIGentQuality` classified as partial/existing external package items that require no-overwrite reconcile. |
| M87 candidate gate | Both paths were `RECONCILE_REQUIRED_NO_OVERWRITE`. |
| M88 copy-first wave | 9 missing plugin dirs copied; these 2 existing dirs were not overwritten. |
| M89 shadow/default-off validation | external plugin package integrity PASS; discovery still not runtime registration. |
| M112 next-domain decision | selected this M113 taskbook as the next low-risk lane. |

## 4. Path Evidence

Path checks are path-only and did not read plugin source contents.

| Path | Core exists | Core tracked paths | External exists | External tracked paths | Current M113 classification |
| --- | --- | ---: | --- | ---: | --- |
| `Plugin/AIGentOrchestrator/**` | yes | 5 | yes | 4 | RECONCILE_REQUIRED_CORE_EXTERNAL_PATH_DIFF |
| `Plugin/AIGentQuality/**` | yes | 4 | yes | 4 | RECONCILE_REQUIRED_EXISTING_EXTERNAL |

Observed path-only difference:

```text
Plugin/AIGentOrchestrator/.disabled exists in core but not in external
```

External manifest status:

```text
Plugin/AIGentOrchestrator manifest entries=4
Plugin/AIGentQuality manifest entries=4
MANIFEST_VERIFY_COUNT=147
MANIFEST_VERIFY_BAD=0
PLUGIN_RECONCILE_PATH_RISK_HITS=0
```

External history evidence:

```text
Plugin/AIGentOrchestrator first observed external history: f7772c6 chore: initialize Jenn external package baseline
Plugin/AIGentQuality first observed external history: bd9997f [codex] plugin: add inactive AIGentQuality external copy
```

## 5. Reconcile Options For Future Gate

M113 does not choose a content action. It defines future choices for M114.

| Option | Meaning | Risk | M113 recommendation |
| --- | --- | --- | --- |
| A | Keep existing external dirs as-is and document that core fallback remains authoritative for differences. | Low | Allowed future outcome. |
| B | Run path-only plus checksum comparison between core and external, without printing file contents. | Low/medium | Recommended next evidence gate. |
| C | Copy core candidates into a temporary review-only location outside active external `Plugin/`, then compare checksums. | Medium | Only with explicit M114/M115 gate; no runtime. |
| D | Replace or overwrite existing external plugin dirs. | High | Blocked until separate explicit overwrite gate. |
| E | Enable plugin runtime registration. | High | Blocked; reconcile is not runtime registration. |
| F | Delete, stub, untrack, or remove core fallback plugin dirs. | High | Blocked; future decision package only. |

Recommended next gate:

```text
NEXT_RECOMMENDED_GATE=M114_PLUGIN_EXISTING_EXTERNAL_RECONCILE_EVIDENCE_GATE
```

M114 should be evidence-only unless explicitly expanded. It should not overwrite external package directories.

## 6. M114 Proposed Allowed Work

Allowed:

```text
recheck core/external path existence
run path-only denylist/secret-risk scan
compare tracked path sets
compare checksums without printing contents
compare external manifest entries
classify each plugin as KEEP_EXISTING_EXTERNAL, NEEDS_REVIEW_COPY, or BLOCKED_OVERWRITE_REQUIRED
write receipt and rollback notes
```

Forbidden:

```text
copy or overwrite active external Plugin/AIGentOrchestrator/**
copy or overwrite active external Plugin/AIGentQuality/**
enable VCP_PLUGIN_DIRS
edit real config.env or .env
execute plugin entrypoints
start production server
read LocalState/private/.agent_board/**
delete, stub, untrack, or remove core Plugin/**
open upstream PR
commit or push without explicit authorization
```

## 7. Stop Conditions

Stop if:

```text
path scan hits env/secret/auth/token/private/state/cache/log/image paths
checksum comparison requires printing source contents
external package has uncommitted unrelated changes
future comparison implies overwrite as the only path
runtime registration would be needed to validate the result
core fallback removal is requested as part of reconcile
```

## 8. Rollback

M113 rollback is docs-only:

```text
git revert <M113 docs/tracker commit>
```

No package/runtime/env rollback is required because M113 performs no implementation.

## 9. Result

```text
M113_PLUGIN_EXISTING_EXTERNAL_RECONCILE_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
COVERED_PLUGIN_DIRS=Plugin/AIGentOrchestrator,Plugin/AIGentQuality
COPY_EXECUTED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M114_PLUGIN_EXISTING_EXTERNAL_RECONCILE_EVIDENCE_GATE
```
