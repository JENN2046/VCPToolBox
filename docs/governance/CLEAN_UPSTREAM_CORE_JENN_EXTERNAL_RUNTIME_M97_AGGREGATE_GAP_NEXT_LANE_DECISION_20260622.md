# M97 Aggregate Gap / Next-Lane Decision

Date: 2026-06-22

Status: PASS_DECISION_ONLY_NO_RUNTIME

Decision: `DEFER_ADMINPANEL_RESIDUALS_SELECT_AGENT_ADDITIVE_DECISION_TASKBOOK`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M86_EXTRACTION_GAP_MATRIX_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M85_JENN_FORK_LOCAL_RUNTIME_ROUTE_FINAL_CLOSEOUT_RECEIPT_20260622.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M96_ADMINPANEL_PAGE_API_ROUTE_NAV_CLOSEOUT_RECEIPT_20260622.md`

## 1. Scope

M97 is an aggregate decision gate only.

M97 does not:

```text
modify source code
modify AdminPanel-Vue/src/**
modify AdminPanel-Vue/dist/**
modify external package content
modify real .env or config.env
enable VCP_AGENT_DIRS
enable AdminPanel dynamic frontend runtime
enable AI Image provider runtime
enable Codex/Memory bridge runtime
enable PhotoStudio runtime
start production server
run AdminPanel build/dev/preview
call provider, OAuth, bridge, live write, sync, publish, or deployment endpoints
read LocalState/private/operator data
read/checksum .agent_board/**
remove, stub, untrack, or delete core fallback content
open upstream PR
```

## 2. Current Aggregate State

M96 closes the AdminPanel page/API route-nav lane for the current route:

```text
external package content copied=yes
default-off metadata registry=yes
core static fallback retained=yes
ChannelHub route-id mapping recorded=yes
static metadata surface implemented now=no
dynamic external Vue/API runtime implemented now=no
real config env write now=no
build/dist now=no
production server now=no
```

M86 and M85 still list these deferred or partial areas:

| Lane | Current state | Risk if opened now |
| --- | --- | --- |
| AdminPanel residuals | Current route closed at M96; residuals are dynamic runtime, static metadata surface, real config/build/deploy/fallback removal | Medium to high; broad frontend/runtime/build surface, low immediate value |
| Agent additive `VCP_AGENT_DIRS` | Agent content copied; AgentOverrides runtime-on; additive lane still off | Medium; can start with decision-only duplicate/core fallback review |
| Codex/Memory runtime | Persistent no-live-write package exists; runtime bridge/live-write/private recall off | High; bridge/live-write/private-memory adjacent |
| PhotoStudio runtime/data | Source package exists; real project data roots and sync/publish/write off | High; project-data/external-write adjacent |
| AI Image provider runtime | Metadata/diagnostic lanes completed; provider/image generation/executable adapter off | High; provider token/image output side effects |
| LocalState/private | Private-by-default gates only; real private content not read/copied | Highest; private/operator/project data |
| Stub/remove/untrack | Explicitly deferred | High; irreversible-ish and upstream-sensitive |

## 3. AdminPanel Residual Decision

M97 does not continue AdminPanel residuals now.

Deferred AdminPanel residuals:

```text
dynamic frontend runtime
runtime execution of external Vue/API
metadata-backed route creation
static metadata surface implementation
real config persistent enablement for page/API metadata
AdminPanel build/dist artifact update
production server smoke
production deploy
core fallback deletion/stub/untrack
external AdminPanel write surfaces
OAuth/provider action enablement
```

Reason:

```text
The current AdminPanel page/API extraction lane is already closed at the package + default-off metadata + core fallback boundary.
Continuing AdminPanel now would move into runtime/build/deploy/fallback-removal surfaces rather than low-risk extraction bookkeeping.
Those gates should remain future explicit work, not automatic continuation.
```

## 4. Next-Lane Options

| Candidate next lane | Decision | Reason |
| --- | --- | --- |
| Continue AdminPanel residuals | DEFER | M96 closed current route; remaining work is runtime/build/deploy/fallback-removal adjacent. |
| Agent additive decision taskbook | SELECTED | Already copied, no private content required, no provider/bridge/live-write required; next safe step can be decision-only. |
| Codex/Memory runtime taskbook | DEFER | Runtime bridge/live-write/private recall adjacent. |
| PhotoStudio runtime/data taskbook | DEFER | Real project data and external sync/publish/write adjacent. |
| AI Image provider runtime taskbook | DEFER | Provider credentials, tokens, image output, and executable adapter registration adjacent. |
| LocalState/private gate | BLOCKED_FOR_NOW | Highest privacy risk; only paths-only or separately authorized content review may proceed. |
| Stub/remove/untrack | BLOCKED_FOR_NOW | Requires stronger runtime/shadow/rollback evidence and explicit deletion/stub decision. |

Selected next gate:

```text
M98_AGENT_ADDITIVE_RUNTIME_DECISION_TASKBOOK
```

M98 must be taskbook-only unless separately authorized. It should decide whether the additive `VCP_AGENT_DIRS` lane is worth opening, but must not enable it.

## 5. M98 Stop Lines

Future M98 must not:

```text
write real config.env or .env
enable VCP_AGENT_DIRS
change VCP_AGENT_ALLOWED_ROOTS or VCP_AGENT_OVERRIDE_DIRS
modify AgentManager runtime behavior
copy additional Agent content
delete/stub/untrack core Agent fallback
read LocalState/private/operator content
start production server
call providers, bridge, live writes, sync, publish, or deployment endpoints
```

Future M98 should define:

```text
whether additive Agent roots should stay deferred or move to a scoped test-only gate
duplicate/core fallback behavior expectations
allowlist and ordering expectations
rollback drill shape if a later scoped additive smoke is authorized
validation commands that do not start production services or read private data
stop line before real config writes
```

## 6. Rollback

M97 rollback is docs-only:

```text
git revert <M97 core commit>
```

Rollback must not touch external package content, core route/nav source, real config, private data, or build artifacts.

## 7. Validation

M97 validation is docs/read-only only:

```text
git diff --check
changed-path risk scan
secret-shape scan over M97/tracker docs
```

No runtime, build, production server, provider/OAuth action, bridge write, live external write, or private data read is required or allowed.

## 8. Result

```text
M97_AGGREGATE_GAP_NEXT_LANE_DECISION_PASS=yes
CONTINUE_ADMINPANEL_RESIDUALS_NOW=no
NEXT_LANE=M98_AGENT_ADDITIVE_RUNTIME_DECISION_TASKBOOK
M98_IMPLEMENTATION_AUTHORIZED=no
REAL_CONFIG_ENV_WRITTEN=no
RUNTIME_ENABLED=no
PRIVATE_CONTENT_READ=no
UPSTREAM_PR_OPENED=no
```
