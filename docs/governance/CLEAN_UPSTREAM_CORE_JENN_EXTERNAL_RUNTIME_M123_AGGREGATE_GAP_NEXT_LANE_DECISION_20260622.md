# M123 Aggregate Gap / Next-Lane Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_IMPLEMENTATION

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M122_AGENT_ADDITIVE_RESOLVER_POLICY_DECISION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M123 compares the remaining unresolved lanes after the Agent additive resolver policy closeout.

This is decision-only. It does not copy, overwrite, delete, untrack, stub, enable runtime, execute providers or plugins, write env, start services, read private content, or open upstream PRs.

## 2. Current Closed Or Held States

```text
AGENT_ADDITIVE_POLICY=core-precedence-retained-runtime-off
PLUGIN_EXISTING_EXTERNAL_RECONCILE=closed-no-overwrite
ADMINPANEL_PAGE_API=package-and-metadata-closed-dynamic-runtime-off
AI_IMAGE_DIAGNOSTIC=closed-no-persistent-enable
CODEX_MEMORY_RUNTIME=deferred
PHOTOSTUDIO_RUNTIME_DATA=deferred
LOCALSTATE_PRIVATE=blocked-private-gate-required
UPSTREAM_PR=deferred-current-turn-auth-required
```

## 3. Candidate Lanes

| Candidate lane | Current state | Risk if implemented | M123 decision |
| --- | --- | --- | --- |
| Plugin runtime registration default-off taskbook | External plugin package exists; M89 proved discovery/package completeness is not runtime registration; M119 closed existing-external reconcile. | High if implemented because plugin registration changes executable surface. Low as taskbook-only. | SELECTED as M124 taskbook-only. |
| AIGentQuality active overwrite / promotion | M117 temp copy evidence exists; M118 kept active external as fork-specific. | High because it overwrites active external package behavior. | Defer; explicit overwrite gate only. |
| AdminPanel dynamic external frontend/API runtime | Package, copied content, and metadata registry exist; dynamic runtime remains deferred. | High UI/runtime surface. | Defer. |
| Codex/Memory runtime | Persistent package exists; live-write/private memory runtime remains deferred. | High private/live-write-adjacent. | Defer. |
| PhotoStudio runtime/data | Source package exists; real data roots and external sync/write remain deferred. | High project-data/external-write-adjacent. | Defer. |
| LocalState/private | Private-by-default gates exist. | High private/operator-data. | Block unless explicit private gate. |
| Core fallback removal/stub/untrack | Explicitly deferred throughout route. | High irreversible/review-sensitive. | Defer; decision package only later. |
| Upstream PR | Explicitly deferred until full local implementation and stable evidence plus current-turn authorization. | Remote side effect. | Defer. |

## 4. Selected Next Gate

```text
NEXT_SELECTED_GATE=M124_PLUGIN_RUNTIME_REGISTRATION_DEFAULT_OFF_TASKBOOK
```

M124 should only write the taskbook for a future default-off plugin runtime registration design. It should define:

```text
allowed runtime source files for a future implementation
default-off behavior
allowlist requirements
no-entrypoint-execution validation
discovery-vs-registration proof
rollback plan
real config stop line
production server stop line
upstream PR stop line
```

M124 must not implement registration, enable `VCP_PLUGIN_DIRS`, write real env, execute plugin entrypoints, overwrite external package content, remove core fallback, or open an upstream PR.

## 5. Why This Lane Is Next

Plugin runtime registration is the next best taskbook-only lane because:

```text
external plugin copy-first package already exists
M89 proved package/discovery can be validated without runtime registration
M113-M119 closed the existing-external reconcile lane without overwrite
M124 can be useful as taskbook-only while still stopping before executable surface changes
```

The runtime implementation itself remains blocked until a later explicit implementation gate.

## 6. Rollback

M123 has no runtime, env, package, source, or external side effects.

Rollback is docs-only:

```text
remove/revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M123_AGGREGATE_GAP_NEXT_LANE_DECISION_20260622.md
revert the M123 tracker edits
```

## 7. Result

```text
M123_AGGREGATE_GAP_NEXT_LANE_DECISION_PASS=yes
DECISION_ONLY=yes
SELECTED_NEXT_GATE=M124_PLUGIN_RUNTIME_REGISTRATION_DEFAULT_OFF_TASKBOOK
COPY_EXECUTED=no
OVERWRITE_EXECUTED=no
RUNTIME_ENABLED=no
PLUGIN_ENTRYPOINT_EXECUTED=no
REAL_CONFIG_ENV_WRITTEN=no
PRIVATE_CONTENT_READ=no
CORE_FALLBACK_REMOVED=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
```
