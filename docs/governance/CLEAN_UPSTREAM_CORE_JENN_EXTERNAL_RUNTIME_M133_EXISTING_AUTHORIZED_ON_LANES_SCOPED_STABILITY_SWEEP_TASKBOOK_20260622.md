# M133 Existing-Authorized On-Lanes Scoped Stability Sweep Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M132_RUNTIME_ENV_LANE_SELECTION_DECISION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M133 defines a future scoped stability sweep for the two runtime/env lanes that are already authorized on:

```text
AgentOverrides
AdminPanelBackendReadonly
```

This is taskbook-only. It does not run a harness, write real `.env` or `config.env`, add or remove env keys, start production server, execute provider/plugin/bridge calls, read private content, modify external packages, remove core fallback files, or open upstream PRs.

## 2. Inputs

```text
M130 authorized-on lanes:
- AgentOverrides
- AdminPanelBackendReadonly

M130 deferred-off lanes:
- AgentAdditive
- AdminPanelDynamicFrontendApi
- PluginRuntime
- AIImageDiagnostic
- AIImageProvider
- CodexMemory
- PhotoStudio

M132 selected next gate:
- M133_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_TASKBOOK
```

## 3. Future M134 Goal

Future M134 may run a scoped local stability sweep that proves the existing authorized on-lanes are still shaped correctly without expanding runtime surface area.

M134 should answer only:

```text
do the already-authorized AgentOverrides read path and write guard still behave as expected?
do the already-authorized AdminPanel backend readonly route and scoped mount guard still behave as expected?
did the sweep avoid real env writes, production server, provider calls, bridge calls, private reads, and external writes?
```

M134 must not attempt to prove plugin runtime, Agent additive runtime, AI Image provider readiness, Codex/Memory live-write readiness, PhotoStudio project-data readiness, LocalState/private migration, upstream readiness, or core fallback removal.

## 4. Allowed Future Evidence

M134 may use these evidence classes:

| Evidence | Scope | Secret rule |
| --- | --- | --- |
| Redacted key-count scan | Exact known env keys only. | Print key names and counts only, never values. |
| Env unchanged proof | Before/after equality only. | Do not print `config.env` content. Prefer reporting hash equality as `yes/no`, not raw values. |
| AgentOverrides local read smoke | Local process only. | Do not print Agent prompt bodies. |
| AgentOverrides Admin write guard | Local test HTTP server only. | Do not start production server. |
| AdminPanel backend readonly local smoke | Scoped process env / local test server only. | Do not print auth material or secrets. |
| AdminPanel production-router integration scoped env proof | Router/module-level scoped validation only. | Do not start production server. |

## 5. Candidate Future Commands

M133 does not run these commands. M134 may run them after explicit execution authorization:

```text
node --check scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js
node --check scripts/run-agent-overrides-admin-write-guard-harness.js
node --check scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node --check scripts/run-adminpanel-production-router-integration-scoped-env-harness.js

node scripts/run-agent-overrides-runtime-on-local-read-smoke-harness.js
node scripts/run-agent-overrides-admin-write-guard-harness.js
node scripts/run-adminpanel-runtime-on-local-smoke-scoped-env-harness.js
node scripts/run-adminpanel-production-router-integration-scoped-env-harness.js
```

M134 should first inspect the scripts and confirm they still satisfy this taskbook's stop lines before running them.

## 6. Commands Excluded From M134

M134 must not run commands that write or roll real config, start production server, or execute provider/bridge/private lanes.

Explicitly excluded:

```text
scripts/run-agent-env-on-shadow-rollback-harness.js
scripts/run-adminpanel-real-config-apply-rollback-drill-harness.js
scripts/run-ai-image-diagnostic-real-config-apply-rollback-drill-harness.js
node server.js
npm run build --prefix AdminPanel-Vue
```

Any command not listed in the M134 allowlist must be treated as blocked until reviewed.

## 7. Pass Criteria

Future M134 should pass only if all are true:

```text
AgentOverrides local read smoke passes
AgentOverrides Admin write guard passes
AdminPanel backend readonly scoped local smoke passes
AdminPanel production-router integration scoped-env proof passes without production server
redacted key-count scan shows no new off-lane runtime keys
real config/env content is unchanged by the sweep
provider_call_count=0
bridge_call_count=0
private_content_read_count=0
external_write_count=0
production_server_started=no
```

## 8. Block Criteria

Future M134 must block if any are true:

```text
any selected script would write config.env or .env
any selected script would add/remove env keys
any selected script would start production server
any selected script would execute plugin/provider/bridge entrypoints
any selected script would read LocalState/private/.agent_board content
any selected script would write external package content
any selected script would print secret values or prompt bodies
any off-lane runtime key appears unexpectedly
any on-lane behavior fails
```

## 9. Stop Lines

M133 and future M134 both stop before:

```text
writing real config.env or .env
adding VCP_AGENT_DIRS
adding VCP_PLUGIN_ALLOWED_ROOTS, VCP_PLUGIN_DIRS, or VCP_EXTERNAL_PLUGIN_ALLOWLIST
re-enabling AI Image diagnostic keys
enabling AI Image provider execution
enabling Codex/Memory bridge or live writes
enabling PhotoStudio project-data runtime or external writes
reading/copying/checksumming/migrating LocalState/private content
reading/copying/checksumming/migrating .agent_board/**
deleting, stubbing, untracking, or removing core fallback files
starting production server
opening upstream PR
```

## 10. Rollback

M133 rollback is docs-only:

```text
revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M133_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_TASKBOOK_20260622.md
revert M133 tracker edits
```

No runtime rollback is needed because M133 does not run a harness or change runtime/env values.

Operational rollback references for future M134:

```text
AgentOverrides rollback reference: M43
AdminPanel backend readonly rollback reference: M54
AI Image diagnostic final off state: M82/M83
Plugin runtime: no persistent env currently present
Agent additive: no persistent VCP_AGENT_DIRS currently present
Codex/Memory: no live-write/bridge env currently present
PhotoStudio: no package runtime env currently present
```

## 11. Result

```text
M133_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
HARNESS_EXECUTED=no
NO_ENV_WRITE=yes
NO_RUNTIME_CHANGE=yes
NO_PROVIDER_CALL=yes
NO_BRIDGE_CALL=yes
NO_PRIVATE_CONTENT_READ=yes
NO_EXTERNAL_PACKAGE_CHANGE=yes
NO_UPSTREAM_PR=yes
NEXT_RECOMMENDED_GATE=M134_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_EXECUTION_RECEIPT
```
