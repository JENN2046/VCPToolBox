# M132 Runtime / Env Lane Selection Decision

Date: 2026-06-22

Status: PASS_RUNTIME_ENV_LANE_SELECTION_DECISION

Parent handoff: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M131_CURRENT_ROUTE_HANDOFF_RESUME_ENTRY_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M132 selects the next low-risk runtime/env route after M130 and M131.

This is decision-only. It does not write real `.env` or `config.env`, enable new runtime, start production server, execute provider/plugin/bridge calls, read private content, modify external packages, remove core fallback files, or open upstream PRs.

## 2. Inputs

```text
M130 current authorized-on lanes:
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

M130 blocked/private lanes:
- LocalStatePrivate
- .agent_board

M131 candidate next gates:
- Runtime/env lane selection decision
- Stability evidence sweep
- Agent additive resolver design taskbook
- Plugin persistent enablement taskbook
- Upstream-readiness evidence plan
```

## 3. Candidate Comparison

| Candidate | Risk | Reason to select or defer |
| --- | --- | --- |
| Existing-authorized on-lanes scoped stability sweep | Low to medium | Select. It only rechecks lanes that are already authorized-on: AgentOverrides and AdminPanel backend readonly. It does not add env keys or open a new runtime lane. |
| Agent additive resolver design taskbook | Low if docs-only | Defer. Useful, but it is not the lowest-risk runtime/env action because it leads toward `VCP_AGENT_DIRS` policy changes. |
| Plugin persistent enablement taskbook | Medium | Defer. It would aim at real plugin env keys and eventual entrypoint concerns. |
| AI Image diagnostic/provider lane | Medium to high | Defer. Diagnostic was intentionally rolled back; provider lane needs token/output gates. |
| Codex/Memory lane | High/private-adjacent | Defer. Live-write and private recall risks remain out of scope. |
| PhotoStudio lane | High/project-data-adjacent | Defer. Project-data roots and external writes remain out of scope. |
| LocalState/private or `.agent_board/**` | High/private | Block. Requires separate private gate. |
| Upstream PR | Remote/high | Defer. Requires explicit upstream PR authorization and stronger readiness evidence. |

## 4. Decision

```text
SELECTED_NEXT_GATE=M133_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_TASKBOOK
OPEN_NEW_RUNTIME_LANE=no
WRITE_REAL_ENV=no
ENABLE_VCP_AGENT_DIRS=no
ENABLE_PLUGIN_RUNTIME=no
ENABLE_AI_IMAGE_RUNTIME=no
ENABLE_CODEX_MEMORY_RUNTIME=no
ENABLE_PHOTOSTUDIO_RUNTIME=no
READ_PRIVATE_CONTENT=no
OPEN_UPSTREAM_PR=no
```

M132 chooses to stay inside already-authorized runtime surface area instead of expanding runtime/env coverage.

## 5. M133 Intended Scope

M133 should be taskbook-only unless separately authorized to implement a harness.

Allowed M133 planning scope:

```text
define a scoped local stability sweep for AgentOverrides
define a scoped local stability sweep for AdminPanel backend readonly
define exact no-secret evidence rules
define no-real-env-write requirement
define no-production-server requirement
define rollback references to M43 and M54
define pass/block criteria
define stop line before execution
```

M133 must not:

```text
write config.env or .env
add or remove env keys
start production server
enable VCP_AGENT_DIRS
enable plugin runtime
enable provider/runtime/image generation
enable bridge/live-write behavior
read LocalState/private/.agent_board content
execute external writes
remove core fallback files
open upstream PR
```

## 6. Rollback

M132 rollback is docs-only:

```text
revert docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M132_RUNTIME_ENV_LANE_SELECTION_DECISION_20260622.md
revert M132 tracker edits
```

No runtime rollback is needed because M132 does not change runtime or env values.

## 7. Result

```text
M132_RUNTIME_ENV_LANE_SELECTION_DECISION_PASS=yes
DECISION_ONLY=yes
SELECTED_LOW_RISK_GATE=M133_EXISTING_AUTHORIZED_ON_LANES_SCOPED_STABILITY_SWEEP_TASKBOOK
NO_NEW_RUNTIME_LANE=yes
NO_ENV_WRITE=yes
NO_RUNTIME_CHANGE=yes
NO_PROVIDER_CALL=yes
NO_BRIDGE_CALL=yes
NO_PRIVATE_CONTENT_READ=yes
NO_EXTERNAL_PACKAGE_CHANGE=yes
NO_UPSTREAM_PR=yes
```
