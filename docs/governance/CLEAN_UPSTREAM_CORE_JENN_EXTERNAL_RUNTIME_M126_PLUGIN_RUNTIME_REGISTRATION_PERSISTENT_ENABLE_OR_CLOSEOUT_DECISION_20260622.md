# M126 Plugin Runtime Registration Persistent-Enable Or Closeout Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_CLOSEOUT_NO_PERSISTENT_ENABLE

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M126 decides whether the plugin runtime registration lane should move from scoped shadow validation into persistent real-config enablement now.

This is decision-only. It does not write real `.env` or `config.env`, enable `VCP_PLUGIN_ALLOWED_ROOTS`, enable `VCP_PLUGIN_DIRS`, enable `VCP_EXTERNAL_PLUGIN_ALLOWLIST`, execute plugin entrypoints, start production server, modify external package content, remove core fallback, read private content, or open upstream PRs.

## 2. Evidence Reviewed

| Evidence | Result |
| --- | --- |
| M89 plugin shadow/default-off validation | External Plugin package integrity PASS; package/discovery did not become runtime registration. |
| M119 plugin existing-external reconcile closeout | Existing external `AIGentOrchestrator` and `AIGentQuality` kept without overwrite; runtime remained off. |
| M124 default-off taskbook | Future scoped validation, exact allowlist, no-entrypoint counters, rollback and stop lines defined. |
| M125 scoped shadow validation | Exact `JennAIGentOrchestrator` registration count `1`; invalid allowlist, duplicate core-name, direct/hybrid, and entrypoint counters all `0`; real env/server/package untouched. |

## 3. Decision Options

| Option | Meaning | Risk | Decision |
| --- | --- | --- | --- |
| A | Persistently enable external plugin runtime in real `config.env` now. | High: creates real executable plugin surface and requires real-config rollback/prod smoke gates. | Not selected. |
| B | Close current plugin runtime registration lane at scoped shadow proof and defer persistent enablement. | Low: preserves validated evidence without changing real runtime. | Selected. |
| C | Write a future real-config unlock taskbook only. | Medium: useful later if there is a concrete operator need. | Deferred; can be selected later from aggregate next-lane decision. |

Selected decision:

```text
PLUGIN_RUNTIME_PERSISTENT_ENABLE_NOW=no
PLUGIN_RUNTIME_LANE_CLOSEOUT_NOW=yes
SELECTED_OPTION=B_CLOSEOUT_AT_SCOPED_SHADOW_PROOF
```

## 4. Rationale

M125 proves the registration policy can safely distinguish:

```text
default-off
discovery-only
invalid allowlist
exact Jenn allowlist
duplicate core-name block
direct/hybrid block
no-entrypoint execution
```

That is enough to close the current low-risk lane.

It is not enough to persistently enable real plugin runtime because persistent enablement would require a separate gate for:

```text
current-turn authorization to write real config.env
exact three-key real-config apply and rollback drill
production-server or no-production-server smoke decision
plugin tool surface visibility review
entrypoint execution/no-provider boundary review
operator-facing rollback instructions
post-enable aggregate runtime review
```

## 5. Current Final State For This Lane

```text
EXTERNAL_PLUGIN_PACKAGE_PRESENT=yes
PLUGIN_DISCOVERY_VALIDATED=yes
SCOPED_RUNTIME_REGISTRATION_VALIDATED=yes
EXACT_JENN_REGISTRATION_VALIDATED=yes
REAL_CONFIG_PLUGIN_RUNTIME_ENABLED=no
PLUGIN_ENTRYPOINT_EXECUTED=no
PRODUCTION_SERVER_STARTED=no
CORE_PLUGIN_FALLBACK_REMOVED=no
UPSTREAM_PR_OPENED=no
```

## 6. Future Reopen Conditions

Reopen this lane only if one of these is true:

```text
operator explicitly needs JennAIGentOrchestrator available as a runtime tool
operator explicitly authorizes real config.env plugin runtime key writes
there is a reviewed no-provider entrypoint execution gate
there is a production-server smoke taskbook with cleanup and redaction rules
```

The next reopen gate should be taskbook-only unless the current turn explicitly authorizes real config writes:

```text
M127_PLUGIN_RUNTIME_REAL_CONFIG_UNLOCK_TASKBOOK
```

## 7. Rollback

M126 rollback is docs-only:

```text
revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M126_PLUGIN_RUNTIME_REGISTRATION_PERSISTENT_ENABLE_OR_CLOSEOUT_DECISION_20260622.md
revert M126 tracker edits
```

No runtime/env/package rollback is required because M126 changes none of those.

## 8. Result

```text
M126_PLUGIN_RUNTIME_REGISTRATION_PERSISTENT_ENABLE_OR_CLOSEOUT_DECISION_PASS=yes
DECISION_ONLY=yes
PERSISTENT_ENABLE_NOW=no
CURRENT_PLUGIN_RUNTIME_LANE_CLOSED=yes
REAL_CONFIG_ENV_WRITTEN=no
VCP_PLUGIN_ALLOWED_ROOTS_ENABLED=no
VCP_PLUGIN_DIRS_ENABLED=no
VCP_EXTERNAL_PLUGIN_ALLOWLIST_ENABLED=no
PLUGIN_ENTRYPOINT_EXECUTED=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
CORE_FALLBACK_REMOVED=no
PRIVATE_CONTENT_READ=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M127_AGGREGATE_GAP_NEXT_LANE_DECISION
```
