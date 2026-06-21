# M37 Stable Operation Window Cycle 1 Opening Receipt

Date: 2026-06-21

Status: PASS_OPENING_CYCLE_WINDOW_STARTED_STABILITY_NOT_PASSED

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related taskbooks / receipts:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M30_LOCAL_IMPLEMENTATION_STABILITY_WINDOW_TASKBOOK_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M35_AGGREGATE_FULL_LOCAL_MATRIX_REVIEW_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M36_STABLE_OPERATION_WINDOW_ENTRY_20260621.md`

## 1. Window Start

```text
WINDOW_START=yes
cycle position: opening
cycle number: 1 / 3
cycle timestamp: 2026-06-21T15:15:51+08:00
minimum final-cycle date: 2026-06-28 local date
opening cycle result: PASS
mid-window cycle result: pending
final-window cycle result: pending
full-local/stability gate passed: no
upstream PR opened: no
```

## 2. Baseline Refs

Core repository:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox
branch: codex/m2-m7-jenn-external-runtime-roadmap
cycle-start HEAD: 522e0816e5824db1c43ccc2cc046fde4ee6b61b9
worktree status before cycle: clean
```

External package repository:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions
branch: main
cycle-start HEAD: 3a63904e753aa8b8869f588fc0b8fc862354e123
worktree status before cycle: clean
```

## 3. Environment Sanity

The opening cycle checked runtime/package environment variables by presence only. It did not read `.env`, secrets, auth material, tokens, or credentials.

```text
VCP_PLUGIN_ALLOWED_ROOTS=unset
VCP_PLUGIN_DIRS=unset
VCP_PLUGIN_INSTALL_DIR=unset
VCP_ADMIN_EXTENSION_DIRS=unset
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS=unset
VCP_AI_IMAGE_ADAPTER_DIRS=unset
ENABLE_AI_IMAGE_REAL_EXECUTION=unset
VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS=unset
VCP_CODEX_MEMORY_BRIDGE_DIRS=unset
ENABLE_CODEX_MEMORY_LIVE_WRITE=unset
VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS=unset
VCP_PHOTOSTUDIO_PACKAGE_DIRS=unset
ENABLE_PHOTOSTUDIO_AUTO_WRITE=unset
PHOTO_STUDIO_DATA_DIR=unset
VCP_LOCAL_STATE_DIR=unset
```

## 4. Validation Commands

```powershell
node --check scripts/run-adminpanel-persistent-package-gate-harness.js
node scripts/run-adminpanel-persistent-package-gate-harness.js
node --check scripts/run-ai-image-persistent-provider-adapter-gate-harness.js
node scripts/run-ai-image-persistent-provider-adapter-gate-harness.js
node --check scripts/run-codex-memory-no-live-write-package-gate-harness.js
node scripts/run-codex-memory-no-live-write-package-gate-harness.js
node --check scripts/run-photostudio-source-package-gate-harness.js
node scripts/run-photostudio-source-package-gate-harness.js
```

Key results:

```text
ADMINPANEL_PERSISTENT_PACKAGE_GATE_PASS
AI_IMAGE_PROVIDER_ADAPTER_PACKAGE_GATE_PASS
CODEX_MEMORY_NO_LIVE_WRITE_PACKAGE_GATE_PASS
PHOTOSTUDIO_SOURCE_PACKAGE_GATE_PASS
CURRENT_AGGREGATE_CHECKSUM_MANIFEST_SHA256=9e01af36f0ecd99c27294addc99d44d6592a5883fb5b41b2e2ee585f721809fd
```

## 5. Opening Cycle Counter Review

| Domain | Target risk | Runtime registration refs | Side-effect counters |
| --- | ---: | ---: | --- |
| AdminPanel | 0 | 0 | AdminPanel build `no`; provider/bridge/live external writes not executed |
| AI Image | 0 | 0 | provider/image/output/bridge/LocalState counters all `0` |
| Codex/Memory | 0 | 0 | bridge/private-memory/LocalState/external/provider counters all `0` |
| PhotoStudio | 0 | 0 | project-data/external/provider/bridge/LocalState counters all `0` |

## 6. Reset Checklist

Opening cycle reset conditions checked:

```text
package checksum changed before cycle: no
new in-scope external package content landed after opening cycle: no
runtime wiring changed during cycle: no
package gate harness failed: no
real env/secret/auth/token/credential modified: no
provider call executed: no
bridge live write executed: no
production deploy/build/startup used as validation: no
LocalState/private/operator data read/copied outside gate: no
.agent_board/** read/copied/checksummed/migrated: no
upstream PR opened: no
core fallback deleted/untracked/stubbed: no
```

Because this is the opening cycle, future changes after this receipt must be evaluated against M30/M36 reset rules.

## 7. What This Proves

M37 proves:

- the 7-day stable-operation window has formally started;
- opening cycle validation passed at the recorded timestamp;
- M31-M34 package gate harnesses still pass against the current external package HEAD;
- reviewed package checksum verification still matches the current aggregate manifest;
- runtime registration remains off;
- provider, bridge, live external write, project data write, image generation, LocalState/private reads, `.agent_board/**`, production deploy, and upstream PR actions were not used.

M37 does not prove:

```text
mid-window cycle passed: no
final-window cycle passed: no
7-day minimum duration satisfied: no
full-local/stability gate passed: no
upstream PR readiness: no
```

## 8. Next Cycle

The next cycle is the mid-window cycle.

Recommended timing:

```text
earliest mid-window local date: 2026-06-24
final-window local date must be no earlier than: 2026-06-28
```

The mid-window cycle must be recorded in a separate future receipt and must re-check the reset conditions before it can pass.

## 9. Rollback

Rollback M37 by reverting:

```text
core governance commit that records this opening cycle and tracker update
```

If the opening cycle receipt is reverted or contradicted by later evidence, the stable-operation window must be treated as not started until a new opening cycle receipt is created.
