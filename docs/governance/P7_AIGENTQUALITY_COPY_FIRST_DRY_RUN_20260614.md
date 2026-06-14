# P7 AIGentQuality Copy-First Dry-Run

Date: 2026-06-14

Status: docs-only dry-run design.

Scope: `Plugin/AIGentQuality/` only.

This document is a reproducible dry-run inventory and execution design for a
future copy-first package. It does not authorize copying, moving, deleting,
stub replacement, route cutover, runtime loader changes, external package
writes, commits, pushes, pull requests, or production use.

Explicit scope exclusions:

- no other P7 candidate plugin is included in this dry-run;
- no `AIGentWorkflow`, `AIGentStyle`, `AgentMessage`, `CodexMemoryBridge`,
  `DingTalkTable`, `MagiAgent`, Image, or PhotoStudio package movement is
  included;
- no `modules/channelHub/` work is included because P3 Inventory V2 classifies
  it as Jenn-authored `keep_core / deferred-core-split`;
- no `modules/photoStudio/` work is included because it needs a separate
  business-logic split design;
- no AdminPanel, Agent loader, LocalState, or runtime lane work is included.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes, but only at the design and validation layer. This dry-run records
the exact boundary for a low-risk Jenn AIGent plugin before any file movement.
The immediate result is safer future externalization, not a thinner core yet.

## 2. Source State

Core repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: codex/p7-dry-run
head: 69a0a8bd8ea09bda6d2d37e2bce245588aabb8b9
worktree: clean before this document edit
```

External package repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: f7772c654c2d8d34698f2818fde02ec63df783cb
worktree: clean
target exists: false for Plugin/AIGentQuality
```

Planning basis:

- `docs/governance/JENN_EXTRACTION_IMPLEMENTATION_PLAN_20260608.md`
- `docs/governance/P3_JENN_EXTERNALIZATION_INVENTORY_V2_20260614.md`
- `Plugin/AGENTS.md`
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\README.AGENTS_OS.md`
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\README.AGENTS_OS.md`

P3 Inventory V2 recommends `Plugin/AIGentQuality` as the first P7 dry-run
design target by semantic risk. That recommendation remains dry-run only.

Historical deferral reconciliation:

- `docs/governance/JENN_STATIC_NO_PROVIDER_EXTRACTION_PREP.md` records
  `AIGentQuality remains deferred due image file inspection risk`.
- `docs/governance/GATE_16_FIRST_REAL_EXTERNAL_PLUGIN_MIGRATION_RFC.md` records
  `AIGentQuality` as deferred because it reads image files and walks
  directories, while still calling it a good later candidate.
- This P7 document does not override those runtime cautions. It narrows the
  scope to dry-run design and keeps real copy, activation, and path-policy
  decisions blocked.

## 3. Source File Inventory

Tracked source files:

```text
Plugin/AIGentQuality/AIGentQuality.js
Plugin/AIGentQuality/README.md
Plugin/AIGentQuality/config.env.example
Plugin/AIGentQuality/plugin-manifest.json
```

Observed source file sizes:

| Path | Bytes | Dry-run disposition |
| --- | ---: | --- |
| `Plugin/AIGentQuality/AIGentQuality.js` | 15077 | future copy candidate |
| `Plugin/AIGentQuality/README.md` | 2571 | future copy candidate |
| `Plugin/AIGentQuality/config.env.example` | 299 | future copy candidate; template only |
| `Plugin/AIGentQuality/plugin-manifest.json` | 2296 | future copy candidate |

Source SHA256 baseline:

| Path | SHA256 |
| --- | --- |
| `Plugin/AIGentQuality/AIGentQuality.js` | `90B4F545FB108653C90D5F3FEC794D33CE23575352FE84743583E91DA92EEA86` |
| `Plugin/AIGentQuality/README.md` | `3AE1902FC40D31525E8EF19FEDD57B0A98509A9AAA5AA4BD1624827988EAA4A6` |
| `Plugin/AIGentQuality/config.env.example` | `62C817C9BC627778986D32EB50AF868EF1B9352A5C1BB8FACE3A6C80E885B48C` |
| `Plugin/AIGentQuality/plugin-manifest.json` | `775E3C96FC1091C0974B366BED63CC3251146815FD32C350E3449969EC1A02E4` |

These hashes are evidence for this dry-run only. A future real copy gate must
recompute them immediately before copying and compare copied files after the
copy.

Filesystem env/runtime path check at review time:

| Path | Exists | Disposition |
| --- | --- | --- |
| `Plugin/AIGentQuality/config.env` | false | must remain excluded |
| `Plugin/AIGentQuality/.env` | false | must remain excluded |
| `Plugin/AIGentQuality/state` | false | must remain excluded |
| `Plugin/AIGentQuality/cache` | false | must remain excluded |
| `Plugin/AIGentQuality/logs` | false | must remain excluded |
| `Plugin/AIGentQuality/output` | false | must remain excluded |
| `Plugin/AIGentQuality/outputs` | false | must remain excluded |

## 4. Plugin Contract Summary

Manifest facts:

- `name`: `AIGentQuality`
- `pluginType`: `synchronous`
- `entryPoint`: `node AIGentQuality.js`
- `communication.protocol`: `stdio`
- `communication.timeout`: `60000`
- declared commands: `InspectImage`, `InspectBatch`, `BuildRetryPlan`,
  `HealthCheck`
- config template keys:
  - `AIGENT_QUALITY_MIN_WIDTH`
  - `AIGENT_QUALITY_MIN_HEIGHT`
  - `AIGENT_QUALITY_MAX_FILE_SIZE_MB`
  - `AIGENT_QUALITY_EXTERNAL_VISION`

Runtime behavior observed from source review:

- reads JSON from stdin;
- reads image files with `fs.readFileSync`;
- walks image directories with `fs.readdirSync`;
- reads file metadata with `fs.statSync`;
- writes JSON response to stdout;
- exports functions for local checks;
- does not use `spawn`, `exec`, `fetch`, `axios`, `http.request`, or
  `https.request`;
- does not use `writeFile`, `appendFile`, or `createWriteStream`;
- keeps `AIGENT_QUALITY_EXTERNAL_VISION=false` by default.

The main safety risk is local file read scope. `InspectImage`, `InspectBatch`,
and `BuildRetryPlan` accept operator-supplied paths and can inspect arbitrary
readable image files or directories. That is acceptable for this docs-only
dry-run, but any real runtime activation outside the core must preserve the
same or stronger file-read policy as the core runtime.

## 5. Core Reference Scan

No direct hard-coded reference was found in:

```text
AdminPanel-Vue
routes
modules
server.js
Plugin.js
tests
```

Non-core or indirect references found:

| Path | Reference type | Effect on dry-run |
| --- | --- | --- |
| `Plugin/AIGentOrchestrator/AIGentOrchestrator.js` | names `AIGentQuality` as the quality agent and plans `BuildRetryPlan` | preserve manifest name for exact contract review; activation remains blocked until duplicate-name/cutover gate |
| `Plugin/AIGentOrchestrator/README.md` | documentation reference | no loader coupling |
| `Plugin/AIGentOrchestrator/plugin-manifest.json` | command description mentions QualityInspector retry queue | no loader coupling |
| `Plugin/AIGentStyle/AIGentStyle.js` | note says QualityInspector integration is later | no loader coupling |
| `scripts/jenn-extraction-audit-readonly.ps1` | path appears in read-only extraction candidate list | supports externalization inventory only |
| `docs/AI_IMAGE_QUALITY_CONTRACT.md` | owner and output contract | should remain in core docs until broader AI image contract packaging is designed |
| `docs/AI_IMAGE_ORCHESTRATION_CONTRACT.md` | pipeline contract names quality agent | should remain in core docs until broader AI image contract packaging is designed |

Conclusion: `Plugin/AIGentQuality/` is a leaf plugin from the core loader point
of view. It has semantic coupling to the AI image agent documents and
`AIGentOrchestrator`, but no direct core loader, route, AdminPanel, or module
hardcoding was found.

## 6. Copy-First Decision

Decision: suitable for a P7 copy-first dry-run design.

Reasoning:

- small plugin: four tracked direct-child files;
- standard legacy plugin layout;
- stdio synchronous contract;
- no plugin-local real `config.env` or `.env` path at review time;
- no plugin-local runtime state/cache/log/output directory at review time;
- no direct network or subprocess markers in source;
- no direct core runtime hardcoding outside normal plugin discovery;
- P3 semantic review already ranked it lower risk than the other candidates.

Conditions before any real copy:

- rerun the env/runtime path check immediately before copy;
- confirm target external package worktree is clean;
- decide whether exact same-name `Plugin/AIGentQuality` is acceptable as an
  inactive copy, or whether a future no-conflict active package needs a renamed
  `JennAIGentQuality` manifest;
- keep the external copy default-off unless a later explicit runtime gate
  authorizes loader activation;
- do not remove, disable, or stub the core copy in this P7 package.

## 7. Future Target Path Design

Preferred copy-first target for a future explicit copy gate:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality\
```

This preserves source path identity for integrity comparison, but it must not
be active at the same time as the core plugin unless a later duplicate-name
policy explicitly allows it. Existing external package guidance says external
plugins must not override core plugin names.

No-conflict future activation option:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQuality\
```

That option would require a separate explicit gate because it changes manifest
identity and downstream tool name expectations.

## 8. Files Allowed And Excluded For A Future Copy

Allowed future copy candidates:

```text
Plugin/AIGentQuality/AIGentQuality.js
Plugin/AIGentQuality/README.md
Plugin/AIGentQuality/config.env.example
Plugin/AIGentQuality/plugin-manifest.json
```

Excluded unless separately authorized:

```text
Plugin/AIGentQuality/config.env
Plugin/AIGentQuality/.env
Plugin/AIGentQuality/state/
Plugin/AIGentQuality/cache/
Plugin/AIGentQuality/logs/
Plugin/AIGentQuality/output/
Plugin/AIGentQuality/outputs/
```

Also excluded:

- generated images;
- test input image corpora;
- operator-local datasets;
- logs, receipts, cache, outputs, secrets, or private LocalState;
- core loader changes;
- AdminPanel changes;
- docs contract relocation.

## 9. Reproducible Commands

Read-only basis checks:

```powershell
git status -sb
git branch --show-current
git rev-parse HEAD
git -c core.quotePath=false ls-files Plugin/AIGentQuality
Get-ChildItem -LiteralPath Plugin/AIGentQuality -Force | Select-Object Mode,Length,Name
```

Sensitive path existence checks:

```powershell
Test-Path Plugin/AIGentQuality/config.env
Test-Path Plugin/AIGentQuality/.env
Test-Path Plugin/AIGentQuality/state
Test-Path Plugin/AIGentQuality/cache
Test-Path Plugin/AIGentQuality/logs
Test-Path Plugin/AIGentQuality/output
Test-Path Plugin/AIGentQuality/outputs
```

Reference scans:

```powershell
rg -n "AIGentQuality|QualityInspector|AI_IMAGE_QUALITY_CONTRACT|InspectImage|InspectBatch|BuildRetryPlan" -g "!Plugin/AIGentQuality/**"
rg -n "AIGentQuality|QualityInspector" AdminPanel-Vue routes modules server.js Plugin.js tests scripts --glob "!scripts/jenn-extraction-audit-readonly.ps1"
rg -n "require\(|process\.env|fs\.|path\.|write|mkdir|unlink|spawn|exec|http|https|fetch|axios|openai|AIGentWorkflow|AIGentPrompt|image_path|directory|config" Plugin/AIGentQuality/AIGentQuality.js
```

Static validation:

```powershell
node --check Plugin/AIGentQuality/AIGentQuality.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('Plugin/AIGentQuality/plugin-manifest.json','utf8')); console.log('manifest ok')"
'{"tool_name":"HealthCheck"}' | node Plugin/AIGentQuality/AIGentQuality.js
```

External target preflight:

```powershell
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions branch --show-current
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQuality
```

Source hash baseline:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath `
  Plugin/AIGentQuality/AIGentQuality.js,`
  Plugin/AIGentQuality/README.md,`
  Plugin/AIGentQuality/config.env.example,`
  Plugin/AIGentQuality/plugin-manifest.json |
  Select-Object Algorithm,Hash,Path
```

Observed validation results from this dry-run:

```text
core branch: codex/p7-dry-run
core head: 69a0a8bd8ea09bda6d2d37e2bce245588aabb8b9
core worktree before edit: clean
tracked source files: 4
Plugin/AIGentQuality/config.env: false
Plugin/AIGentQuality/.env: false
Plugin/AIGentQuality/state: false
Plugin/AIGentQuality/cache: false
Plugin/AIGentQuality/logs: false
Plugin/AIGentQuality/output: false
Plugin/AIGentQuality/outputs: false
external package worktree: clean
external target exists: false
external no-conflict target exists: false
AdminPanel-Vue/routes/modules/server.js/Plugin.js/tests/scripts hard references: none, after excluding scripts/jenn-extraction-audit-readonly.ps1
node --check Plugin/AIGentQuality/AIGentQuality.js: pass
plugin-manifest.json parse: pass
HealthCheck: pass, external_vision_enabled=false
```

Scope review result:

```text
P3 target alignment: yes, Plugin/AIGentQuality is the recommended first P7 dry-run design target by semantic risk.
ChannelHub exclusion: yes, modules/channelHub remains Jenn-authored keep_core/deferred-core-split.
Other P7 candidates excluded: yes, no other plugin is part of this package.
Runtime lane assumption: none, VCP_AGENT_DIRS/VCP_LOCAL_STATE_DIR/VCP_ADMIN_EXTENSION_DIRS are not assumed available.
```

Future copy integrity commands, not run in this dry-run:

```powershell
# NOT AUTHORIZED IN THIS PACKAGE.
# Copy-Item commands are intentionally omitted.

$source = 'A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentQuality'
$target = 'A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality'
$files = @(
  'AIGentQuality.js',
  'README.md',
  'config.env.example',
  'plugin-manifest.json'
)
foreach ($file in $files) {
  Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $source $file)
  Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $target $file)
}
```

## 10. Stop Conditions

Stop and require explicit approval before:

- creating `Plugin/AIGentQuality/` in the external package;
- copying any file;
- deleting or disabling the core copy;
- creating a `.block` marker;
- renaming the plugin or manifest;
- changing loader search paths;
- changing AdminPanel plugin views;
- moving AI image contract docs;
- reading or writing real env files;
- moving LocalState, generated images, logs, cache, outputs, or secrets;
- committing, pushing, opening a PR, or merging.

## 11. Current Dry-Run Result

Result: proceed with documentation review only.

Current P7 dry-run classification:

```text
Plugin/AIGentQuality/: copy-first candidate, default-off external copy only,
blocked before real copy, blocked before activation, blocked before core
retirement.
```

Next safe action after this document is reviewed:

```text
Review this dry-run document. If accepted, request an explicit future copy gate
for Plugin/AIGentQuality, still with no core deletion and no runtime cutover.
```

## 12. Self-Review And Fixes

Self-review pass:

| Finding | Fix |
| --- | --- |
| External package HEAD was recorded as a short hash, which is weaker for reproduction. | Replaced it with the full external package commit SHA. |
| Earlier governance docs deferred `AIGentQuality` because of image path reads, which could be mistaken as a conflict with this package. | Added a historical deferral reconciliation section and kept runtime activation blocked. |
| The document listed commands but did not summarize observed results. | Added observed validation results, including sensitive path checks and `HealthCheck`. |
| The first draft did not explicitly exclude `modules/channelHub/` and the other P7 candidates. | Added explicit scope exclusions and a scope review result block. |

Post-fix decision: no copy, delete, move, stub, loader, AdminPanel, external
package write, commit, push, or PR action is authorized by this document.

## 13. Commit-Readiness Checklist

This section is for a future docs-only PR. It does not authorize commit, push,
or PR creation by itself.

| Check | Status |
| --- | --- |
| documents the three-day goal gate | yes |
| limits scope to `Plugin/AIGentQuality/` | yes |
| excludes `modules/channelHub/` as keep_core/deferred-core-split | yes |
| excludes other P7 candidates | yes |
| records tracked source files | yes |
| records source file sizes | yes |
| records source SHA256 hashes | yes |
| records env/runtime path absence checks | yes |
| records core reference scan result | yes |
| records external package target absence | yes |
| records historical deferral reconciliation | yes |
| keeps real copy blocked | yes |
| keeps runtime activation blocked | yes |
| keeps core deletion/stub blocked | yes |
| keeps commit/push/PR blocked pending explicit approval | yes |

## 14. Pre-Commit Short Review

Short-review verdict: suitable for a docs-only PR after human approval to
commit, push, and open the PR.

Review checks:

| Check | Result |
| --- | --- |
| Source SHA256 hashes match current files | pass |
| Sensitive plugin-local paths remain absent | pass |
| External target paths remain absent | pass |
| External package worktree remains clean | pass |
| Core hard references remain absent in AdminPanel-Vue, routes, modules, server, Plugin.js, tests, and scripts after excluding the read-only audit script | pass |
| Source has no write, network, subprocess, provider, or `processToolCall` markers | pass |
| `node --check` passes | pass |
| manifest JSON parse passes | pass |
| `HealthCheck` returns `external_vision_enabled=false` | pass |
| External plugin lane and P3 inventory targeted tests pass | pass, `node --test tests/plugin-external-dirs.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js tests/p3-external-ecosystem-inventory.test.js`, 46/46 |
| No trailing whitespace was found in this document | pass |

Remaining review notes:

- This document is still not copy authorization.
- The real copy gate must rerun every path, hash, and worktree check.
- Runtime activation remains blocked until same-name collision and file-read
  path policy are explicitly designed.
- Commit, push, and PR creation remain blocked until explicit user approval.
