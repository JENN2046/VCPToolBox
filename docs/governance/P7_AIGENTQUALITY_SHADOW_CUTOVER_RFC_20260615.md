# P7 AIGentQuality Shadow And Cutover RFC

Date: 2026-06-15

Status: docs-only RFC refreshed after external package `main@beb072b` and
core-side Layer 4 isolated `pluginManager.loadPlugins` legacy-external
discovery-to-registration proof.

Scope: core `Plugin/AIGentQuality/`, external `Plugin/AIGentQuality/`,
external `Plugin/JennAIGentQualityTrial/`, and core external-plugin discovery
and runtime-registration policy only.

This document is not runtime activation authorization. It does not authorize
copying more files, deleting core files, disabling the core plugin, changing
loader priority, changing persistent environment variables, committing,
pushing, merging, starting a server, or scanning operator image directories.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. This RFC defines the next boundary after the AIGentQuality
copy-first package work. It prevents the inactive same-name copy from being
mistaken for an active runtime cutover.

## 2. Current Evidence

Core repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
initial RFC branch: codex/aigentquality-shadow-cutover-rfc
initial RFC base head: 851d4e616a381c428ab41e2e51c88052e51b32e8
Layer 4 branch: codex/aigentquality-loadplugins-dry-run
Layer 4 base head: a0e816e9fe62eee8970dc6e6bc957953de98a25e
worktree during Layer 4 receipt update: this governance doc modified only
```

External package repository PR #1 evidence:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
preserved PR branch: codex/aigentquality-external-copy
initial copy commit: 7f392bef6a5df7795a9d317e8d0f4cea3b5e34b1
merged PR: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/1
final PR head: 7cc63c5ef9e7b51a4d76a04c5340a3b977c2a5a5
clean Codex Review comment covered: 7cc63c5ef9
squash merge commit: bd9997f130713f63f3b8d805c71bfb606039d565
external package main after sync: bd9997f130713f63f3b8d805c71bfb606039d565
PR state observed after merge: merged, branch preserved, no reported checks
```

Current external package state for Layer 4:

```text
branch: main
head: beb072b8ad1530dd62c526c71e4cc09930068685
renamed trial path: Plugin/JennAIGentQualityTrial/
```

PR #1 source state:

- `7f392bef6a5df7795a9d317e8d0f4cea3b5e34b1` is the inactive same-name
  external copy seed. Its four allowed files matched the core copy-first
  baseline from PR #261.
- The current PR head intentionally diverges in `AIGentQuality.js` because PR
  review fixes were applied after the copy seed:
  - `ea6cd931f411b256747330ccf4e7a3320975764b` rejects missing
    `directory` / `dataset_path` before path resolution.
  - `a5e1488e7440bb1e05d4bea07a29a604bf02cfa0` reads image dimensions from
    bounded header bytes instead of loading whole images before size checks.
  - `2ce879254956f95ff1a8c3f82cfd81722e05985d` rejects missing
    `image_path` / `path` before path resolution and keeps the rule-based
    validation-limit finding even when the reserved external vision flag is
    set.
  - `bcd0f7c2a92cd6763db3647ead095d71c774f13f` catches header read failures
    as `unreadable_dimensions` findings and derives batch verdicts from
    per-image failures instead of average score alone.
  - `106a1ac5a947728c609fd2eb65c9713c5d006ac5` routes manual-review actions
    away from `accept` and keeps pass-score manual-review findings in
    `BuildRetryPlan` queues.
  - `467f4ddc0c230e5cf1dd3d128934217464b4c0f7` keeps the inactive external
    copy from publishing the core plugin name from the discovered plugin root.
  - `56437443e41ae59d1a607cb0a5e3a727528bc0c3` scans both `prompt` and
    `caption` for compliance review keywords.
  - `86f31c6281346fe8757ecc6fe0d906d30cc6672e` makes retry-only workflow
    advice route to `retry_generation` explicitly.
  - `4c4a2ab2729a60b530c6213b86e7a4112ce9cbb9` reports unsupported
    image-like artifacts in batch inspection and falls back invalid numeric
    thresholds instead of letting `NaN` disable quality gates.
  - `942c500d6d15bfa1c9bf35984b8685531e9f997c` rejects non-regular image
    paths before header reads so named pipes or directories cannot block
    `InspectImage`.
  - `b83bd32f88d5cbea6492f6cb0f59aef124f3d378` validates the full PNG
    signature and `IHDR` marker before trusting PNG dimensions.
  - `711c53eb25e6d21b3791df01cd19fd91fd2a866e` includes symlinked image
    entries in batch scans instead of silently dropping image-like symlinks.
  - `f73478ccfc4802e2824589c09025336c61dace66` keeps broken symlink or
    otherwise unreadable per-file image entries from aborting full batch scans.
  - `b458a1b061b021ef4f654cafbe2ca92785e3349f` chooses the first nonblank
    image and batch path aliases instead of letting blank preferred aliases
    hide valid fallback aliases.
  - `7cc63c5ef9e7b51a4d76a04c5340a3b977c2a5a5` uses the same nonblank image
    path alias normalization when `BuildRetryPlan` chooses single-image versus
    batch mode.
- As observed during this RFC refresh, all existing PR #1 P2 review threads are
  outdated. No current non-outdated P2 review thread was observed.
- A clean Codex Review issue comment covered final head
  `7cc63c5ef9e7b51a4d76a04c5340a3b977c2a5a5` with no major issues found.
- PR #1 was squash merged to external package `main` as
  `bd9997f130713f63f3b8d805c71bfb606039d565` without deleting the PR branch.
- Future renamed-trial source selection should use external package `main` at
  `bd9997f130713f63f3b8d805c71bfb606039d565`, unless it is superseded by an
  equivalent reviewed external package commit.
- This RFC does not authorize using PR #1 as an active runtime plugin.

Completed PR #1 remote gate evidence:

```text
review trigger comment: @Codex Review
clean review receipt: Codex Review did not find major issues on 7cc63c5ef9
merge mode: squash
delete branch: no
merged PR URL: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/1
mergedAt: 2026-06-15T04:18:37Z
squash merge commit: bd9997f130713f63f3b8d805c71bfb606039d565
external package main after sync: bd9997f130713f63f3b8d805c71bfb606039d565
preserved branch: codex/aigentquality-external-copy
external package worktree after sync: clean
```

Completed PR #2 renamed-trial package evidence:

```text
merged PR URL: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/2
pre-merge Codex Review receipt: no major issues on fc1c62d158
merge mode: squash
delete branch: no
head commit before squash: fc1c62d1584f176c2ab893398bb318655d3a4c0d
squash merge commit: beb072b8ad1530dd62c526c71e4cc09930068685
external package main after sync: beb072b8ad1530dd62c526c71e4cc09930068685
preserved branch: codex/jennaigentqualitytrial-external-copy
external package worktree after sync: clean
renamed trial path: Plugin/JennAIGentQualityTrial/
renamed trial manifest name: JennAIGentQualityTrial
renamed trial entry point: node AIGentQuality.js
runtime activation: none
```

Do not repeat the PR #1 or PR #2 review and merge gates. The next gate is a
core-side minimum shadow/cutover dry-run plan starting from external package
`main@beb072b8ad1530dd62c526c71e4cc09930068685`.

Relevant prior records:

- `docs/governance/P7_AIGENTQUALITY_COPY_FIRST_DRY_RUN_20260614.md`
- `docs/governance/P7_AIGENTQUALITY_COPY_FIRST_PREFLIGHT_20260614.md`
- `docs/governance/P3_JENN_EXTERNAL_ECOSYSTEM_DIRECTORY_CONTRACT_20260610.md`
- `docs/governance/GATE_21_AIGENT_ORCHESTRATOR_CUTOVER_STRATEGY_RFC.md`

Relevant current tests:

- `tests/plugin-external-runtime-registration-gate.test.js`
- `tests/externalPluginAllowPolicy.test.js`
- `tests/plugin-external-runtime-direct-policy.test.js`

## 3. Constraints That Must Stay True

The same-name external copy is intentionally inactive.

Required invariants:

- same-name external plugins must not override core plugin names while the core
  plugin remains present;
- external roots remain default-off unless explicitly configured;
- `VCP_PLUGIN_DIRS` is active only when the candidate root is contained by
  `VCP_PLUGIN_ALLOWED_ROOTS`;
- `VCPToolBox-JENN-Extensions\Plugin` is the external legacy discovery root,
  not the package root itself;
- external `config.env` files remain out of scope;
- no persistent runtime environment change is allowed by this RFC;
- no core disable, delete, move, or stub replacement is allowed by this RFC.

AIGentQuality-specific runtime caution:

- `AIGentQuality.js` reads image files and walks image directories;
- any active external test must use reviewed fixture paths or a temporary test
  directory, not operator image paths;
- active tests must not upload images or call external vision, OCR, OpenPose,
  moderation, or provider APIs;
- `AIGENT_QUALITY_EXTERNAL_VISION=false` must remain the default.

## 4. Options

### Option A - Permanent Same-Name Shadow

Keep the external `AIGentQuality` copy as a sealed, same-name, shadow-only
artifact. Do not attempt active external execution.

Advantages:

- lowest risk;
- preserves copy provenance and PR-reviewed delta history;
- does not weaken same-name override prevention;
- does not require loader, env, or core changes.

Limitations:

- does not prove active external execution;
- does not make the core thinner by itself;
- downstream orchestrators still resolve the core `AIGentQuality` plugin.

Option A is the safe fallback.

### Option B - Renamed External Trial

A separate renamed external candidate now exists:

```text
Plugin/JennAIGentQualityTrial/
manifest name: JennAIGentQualityTrial
external package main: beb072b8ad1530dd62c526c71e4cc09930068685
```

The renamed trial avoids same-name override semantics and allows a controlled
external discovery or stdio child-process dry-run without deleting the core
`AIGentQuality` plugin or changing resolver priority.

Resolved external-package design decisions:

- exact directory name;
- exact manifest `name` and `displayName`;
- command examples remain `InspectImage`, `InspectBatch`, `BuildRetryPlan`,
  and `HealthCheck`;
- source uses reviewed external package history, ending at `main@beb072b`;
- fixture-only file-read policy for image path and directory inputs;
- explicit rollback path.

Option B is the selected path and has completed the external package merge.

Reason:

Option B can now validate an external active candidate path without weakening
core-first ordering, bypassing same-name override prevention, deleting the core
plugin, changing resolver priority, or persisting environment variables.

### Option C - Future Core Disable Or Remove With Rollback

Disable, move, or remove the core `AIGentQuality` so the same-name external
copy can become the active discovered plugin.

Option C is deferred.

It must not start until a separate high-risk RFC defines:

- exact core file or manifest state change;
- verified restore target;
- rollback command sequence;
- validation before and after rollback;
- persistent environment rollback;
- review and explicit authorization for core behavior change.

### Option D - Resolver Override Feature Flag

Introduce a future explicit resolver mode that can prefer an external same-name
plugin over a core plugin.

Option D is deferred.

It would weaken a safety invariant and needs a separate loader design, targeted
tests, migration plan, and rollback plan.

## 5. Recommended Route

Recommended next route:

```text
Core-side minimum shadow/cutover dry-run against Option B
```

Reason:

Option B is now present in the external package at `main@beb072b` as
`Plugin/JennAIGentQualityTrial/`. The next safe move is to prove the core can
discover, policy-check, register, and optionally stdio-smoke-test that renamed
external trial under temporary process-only environment variables.

The next gate should still be dry-run only. It must not delete, disable, or move
core `Plugin/AIGentQuality/`; it must not change resolver priority; it must not
persist environment configuration; and it must not start the production server.

## 6. Completed Renamed Trial Gate Evidence

The renamed trial preflight, local copy gate, PR gate, review gate, and merge
gate are recorded in
`docs/governance/P7_AIGENTQUALITY_RENAMED_TRIAL_PREFLIGHT_20260615.md`.
Key evidence needed by this RFC:

- core repository head;
- external package repository head;
- PR #1 merge commit or superseding external package commit;
- PR #1 review-fix commit list and final reviewed head;
- exact source used for the renamed trial;
- exact target directory;
- exact manifest changes;
- exact README command-label changes, if any;
- file-read fixture policy;
- validation commands;
- rollback conditions;
- stop conditions.

Baseline static checks to keep for later dry-runs:

```powershell
git status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
node --check Plugin/AIGentQuality/AIGentQuality.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('Plugin/AIGentQuality/plugin-manifest.json','utf8')); console.log('manifest ok')"
node --test tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Historical stop conditions from the renamed-trial write gate:

- PR #1 is not merged or superseded by an equivalent reviewed external copy;
- either repository worktree is dirty for unrelated reasons;
- proposed trial still uses manifest name `AIGentQuality`;
- proposed trial changes core files;
- proposed trial changes persistent env;
- proposed trial changes loader priority;
- proposed trial uses real operator image paths;
- proposed trial introduces secrets, logs, cache, state, generated outputs, or
  private operator data;
- static checks fail.

For the next core-side dry-run, use the updated stop conditions in section 8.

## 7. Runtime Test Boundary For Later Gates

A later runtime test gate may use temporary process environment variables only.

Allowed only after explicit authorization:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions\Plugin
```

Still not allowed without another gate:

- persistent env file changes;
- AdminPanel configuration writes;
- server start against operator configuration;
- real image directory scanning;
- same-name override;
- core plugin disablement;
- core plugin deletion.

## 8. Minimum Core-Side Dry-Run Plan From External Main

Starting external package source:

```text
repository: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: beb072b8ad1530dd62c526c71e4cc09930068685
external package root: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
external legacy plugin root: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
target external trial path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
target external trial manifest name: JennAIGentQualityTrial
core plugin path that must remain active and unchanged: Plugin/AIGentQuality/
```

Purpose:

```text
Prove a reversible core-side shadow/cutover path for the renamed external trial
without making it persistent, without changing core plugin priority, and without
using operator image paths.
```

Minimum dry-run layers:

1. Resolver-only proof.
2. Registration-only proof.
3. Optional stdio smoke proof with temporary image fixtures.
4. Isolated `pluginManager.loadPlugins` legacy-external
   discovery-to-registration proof.

Layer 1 - resolver-only proof:

- Use a temporary in-process environment object, not persistent env files.
- Set only:
  - `VCP_PLUGIN_ALLOWED_ROOTS` to the external package root.
  - `VCP_PLUGIN_DIRS` to the external package `Plugin` root.
- Instantiate `createPluginRootResolver` with that temporary env.
- Expected result:
  - `legacyLoadRoots` order remains `core:legacy` then `external:1`;
  - external root resolves to the package `Plugin` directory;
  - external root has `allowConfigEnv: false`;
  - package root itself is not treated as a plugin directory;
  - `Plugin/JennAIGentQualityTrial/plugin-manifest.json` is discoverable only
    below the external `Plugin` root.

Layer 2 - registration-only proof:

- Use isolated `PluginManager` state and temporary process env restoration.
- Keep the core `Plugin/AIGentQuality/` present and unchanged.
- First prove the target is blocked without runtime allowlist:
  - no `VCP_EXTERNAL_PLUGIN_ALLOWLIST`;
  - expected code: `external_runtime_allowlist_required`.
- Then prove the exact renamed trial can register:
  - `VCP_EXTERNAL_PLUGIN_ALLOWLIST=JennAIGentQualityTrial@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial`
  - expected result: `JennAIGentQualityTrial` registers as an external
    synchronous stdio plugin.
- Also prove core identity remains separate:
  - core `AIGentQuality` remains available as the core plugin name;
  - external `JennAIGentQualityTrial` does not publish `AIGentQuality`;
  - no same-name override occurs.
- This layer must not call `processToolCall`, `executePlugin`, generation
  workflows, provider APIs, OCR, OpenPose, moderation, or external vision.

Layer 3 - optional stdio smoke proof:

- Only after Layer 1 and Layer 2 pass.
- Use temporary fixture files under an OS temp directory.
- Execute only `JennAIGentQualityTrial` through core stdio execution path.
- Allowed calls:
  - `HealthCheck`;
  - `InspectImage` with a generated tiny PNG fixture;
  - `BuildRetryPlan` with that same fixture or temp fixture directory.
- Expected result:
  - `dry_run: true`;
  - external vision remains disabled;
  - low-resolution fixture routes to `retry_generation`;
  - compliance keyword fixture routes to `manual_review`;
  - no workflow invocation, generation retry, provider call, persistent write,
    or operator path read occurs.

Layer 4 - isolated loadPlugins legacy-external discovery-to-registration proof:

- Only after Layer 1, Layer 2, and Layer 3 pass.
- Use isolated `PluginManager` singleton state and restore it before exit.
- Use a temporary empty core legacy `Plugin/` root so the proof does not
  initialize real core direct/service plugins.
- Use the real external package `Plugin/` root under temporary process env.
- Patch modern plugin discovery to empty in-process for this proof only.
- Expected result:
  - `pluginManager.loadPlugins` is invoked;
  - resolver order remains `core:legacy` then `external:1`;
  - only `JennAIGentQualityTrial` is registered;
  - other external package plugins remain blocked by runtime allowlist policy;
  - no `processToolCall`, `executePlugin`, server start, provider call,
    persistent env change, or repository file copy/move/delete occurs.
- This is not a production full-plugin-universe proof, not a modern registry
  proof, and not server-level runtime activation.

Minimum validation commands for dry-run gates:

```powershell
git status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD
node --check A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\AIGentQuality.js
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

If a harness is written later, its first version should be read-only against the
repositories. It may create temporary fixtures under the OS temp directory and
must remove them before exit. It must restore all process env values it changes.

Success definition for the minimum dry-run:

```text
core plugin unchanged: yes
external package main is beb072b: yes
resolver discovered external Plugin root only under temporary env: yes
JennAIGentQualityTrial blocked without runtime allowlist: yes
JennAIGentQualityTrial registerable with exact name@plugin-path allowlist: yes
isolated pluginManager.loadPlugins legacy-external discovery-to-registration proof: yes
AIGentQuality still resolves to core identity: yes
no persistent env/config/admin/server change: yes
no operator image path read: yes
no provider/network/workflow/generation call: yes
```

Layer 1 resolver-only proof receipt:

```text
authorization: 授权执行 Layer 1 resolver-only proof
core branch: codex/aigentquality-shadow-cutover-rfc
core head: 851d4e616a381c428ab41e2e51c88052e51b32e8
external package branch: main
external package head: beb072b8ad1530dd62c526c71e4cc09930068685
temporary env only:
  VCP_PLUGIN_ALLOWED_ROOTS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
  VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
resolver result: pass
legacyLoadRoots: core:legacy -> external:1
external root source: external
external root path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
external root allowConfigEnv: false
external root diagnostics: none
target manifest relative to external root: JennAIGentQualityTrial/plugin-manifest.json
target manifest name: JennAIGentQualityTrial
persistent env changed: no
pluginManager.loadPlugins invoked: no
plugin registration invoked: no
plugin execution invoked: no
server start: no
operator image path read: no
```

Layer 2 registration-only proof receipt:

```text
authorization: 授权执行 Layer 2 registration-only proof
core branch: codex/aigentquality-shadow-cutover-rfc
core head: 851d4e616a381c428ab41e2e51c88052e51b32e8
external package branch: main
external package head: beb072b8ad1530dd62c526c71e4cc09930068685
proof mode: isolated PluginManager state with process env restoration
proof boundary: layered registration-policy evidence only, not full
  discovery-to-registration pipeline via pluginManager.loadPlugins
core registration seed: Plugin/AIGentQuality/plugin-manifest.json
core registration result: AIGentQuality registered as core
blocked proof env: no VCP_EXTERNAL_PLUGIN_ALLOWLIST
blocked proof result: JennAIGentQualityTrial not registered
blocked proof warning code: external_runtime_allowlist_required
exact allowlist proof:
  VCP_EXTERNAL_PLUGIN_ALLOWLIST=JennAIGentQualityTrial@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
exact allowlist proof result: JennAIGentQualityTrial registered as external synchronous stdio plugin
identity separation:
  external publishes core name AIGentQuality: no
  core AIGentQuality still registered as core: yes
  same-name override occurred: no
direct module initialization queued: 0
preprocessors discovered: 0
persistent env changed: no
pluginManager.loadPlugins invoked: no
plugin registration invoked: yes, isolated registration only
processToolCall invoked: no
executePlugin invoked: no
child process spawn invoked: no
server start: no
operator image path read: no
```

Layer 3 stdio smoke proof receipt:

```text
authorization: 授权 Layer 3 stdio smoke proof with temporary image fixtures
core branch: codex/aigentquality-shadow-cutover-rfc
core head: 851d4e616a381c428ab41e2e51c88052e51b32e8
external package branch: main
external package head: beb072b8ad1530dd62c526c71e4cc09930068685
proof mode: isolated PluginManager state with process env restoration
registration seed: core AIGentQuality plus external JennAIGentQualityTrial
temporary fixture root: OS temp directory
fixture files created: low-resolution.png
fixture type: minimal PNG header fixture for parser/smoke routing only, not a
  full real-image decode or visual-quality validation fixture
fixture cleanup: completed in script finally block
stdio execution path: pluginManager.executePlugin
stdio spawn count: 4
stdio spawn cwd: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
calls:
  HealthCheck: success, external_vision_enabled=false, .png supported
  InspectImage low-resolution fixture: success, dry_run=true,
    route=retry_generation, verdict=review
  InspectImage caption compliance fixture: success, dry_run=true,
    route=manual_review, verdict=review
  BuildRetryPlan low-resolution fixture: success, dry_run=true,
    source=single_image, overall_verdict=review, retry_count=1,
    retry_routes=retry_generation
safety flags:
  real_generation_retried=false
  workflow_invoked=false
  external_service_called=false
identity separation:
  core AIGentQuality still registered as core: yes
  external publishes core name AIGentQuality: no
  same-name override occurred: no
persistent env changed: no
pluginManager.loadPlugins invoked: no
server start: no
operator image path read: no
provider/network/workflow/generation call: no
observed warning: Node DEP0190 warning from existing executePlugin shell:true
  spawn behavior; no behavior change made in this gate
warning disposition: record as a separate future hardening candidate; do not
  mix shell:true spawn hardening into this extraction dry-run gate
```

Layer 4 isolated loadPlugins legacy-external discovery-to-registration proof receipt:

```text
authorization: 授权执行 full loadPlugins discovery-to-registration proof，只用临时进程环境和隔离 PluginManager 状态。
core branch: codex/aigentquality-loadplugins-dry-run
core head: a0e816e9fe62eee8970dc6e6bc957953de98a25e
external package branch: main
external package head: beb072b8ad1530dd62c526c71e4cc09930068685
proof mode: one-shot Node harness with isolated PluginManager singleton state;
  not production full-plugin-universe loading and not modern registry proof
temporary process env:
  VCP_PLUGIN_ALLOWED_ROOTS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
  VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
  VCP_EXTERNAL_PLUGIN_ALLOWLIST=JennAIGentQualityTrial@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
  VCP_PLUGIN_INSTALL_DIR unset
temporary core legacy root: OS temp directory with an empty Plugin/ subdirectory
external legacy root: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
resolver roots:
  core:legacy, source=core, allowConfigEnv=true, temp Plugin/ root
  external:1, source=external, allowConfigEnv=false, external package Plugin/ root
modern plugin discovery: patched to empty in-process for this proof only
pluginManager.loadPlugins invoked: yes
registered plugins:
  JennAIGentQualityTrial, source=external, rootId=external:1, protocol=stdio
blocked external plugins:
  NoopJennExternalPlugin: external_runtime_allowlist_required
  JennAIGentQuality: external_runtime_allowlist_required
  AIGentOrchestrator: external_runtime_allowlist_required
  JennAIGentOrchestrator: external_runtime_exact_allowlist_required
preprocessors discovered: 0
service modules registered: 0
tools_changed emitted: yes, local_reload
processToolCall invoked: no
executePlugin invoked: no
server start: no
operator image path read: no
persistent env changed: no; all temporary env keys restored
files copied, moved, or deleted in repositories: no
temporary proof directory cleanup: completed
observed warning: VectorDBManager not set; expected because server.js was not
  started and this proof only verifies discovery-to-registration
execution note: one-shot process explicitly shut down ToolApprovalManager before
  exit so the proof process did not leave a node - handle behind
```

Stop conditions:

- external package `main` is not
  `beb072b8ad1530dd62c526c71e4cc09930068685`;
- `Plugin/JennAIGentQualityTrial/` is missing from the external package;
- trial manifest name is not `JennAIGentQualityTrial`;
- core `Plugin/AIGentQuality/` changed unexpectedly;
- either repository has unrelated worktree changes;
- dry-run would require persistent env, AdminPanel writes, server start,
  loader priority edits, core disablement, or branch movement;
- a validation step fails and the fix is not a narrow docs/test-harness fix.

Deferred cutover gates:

- disabling or removing core `Plugin/AIGentQuality/`;
- resolver priority changes;
- same-name external override;
- persistent external runtime env configuration;
- server-level runtime activation against operator configuration;
- any real operator image batch scan.

## 9. Validation Run For This RFC

Commands run while refreshing this RFC from external package `main@beb072b`:

```text
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Observed result:

```text
40/40 pass
```

Additional Layer 4 receipt validation:

```text
isolated loadPlugins legacy-external one-shot Node proof: COMPLETED_VALIDATED
git diff --check: pass
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js tests/plugin-external-runtime-env-sandbox.test.js
observed result: 54/54 pass
```

Additional PR #1 behavior checks observed in the external package branch:

```text
node --check Plugin/AIGentQuality/AIGentQuality.js
plugin-manifest.json parsed successfully
InspectImage without image_path/path returned image_path is required
InspectBatch without directory/dataset_path returned directory or dataset_path is required
BuildRetryPlan without directory/dataset_path returned directory or dataset_path is required
oversized image check reported large_file without full-image readFileSync
AIGENT_QUALITY_EXTERNAL_VISION=true still kept vision_model_not_enabled
header read failure returned unreadable_dimensions without aborting inspectImage
batch verdict followed per-image retry queue and BuildRetryPlan overall_verdict
large_file routed to manual_review and stayed in BuildRetryPlan retry_queue
caption-only and prompt-plus-caption compliance keywords routed to manual_review
low-resolution-only retry plans routed to retry_generation
GIF and AVIF batch artifacts reported unsupported_extension instead of being skipped
invalid numeric env thresholds fell back to defaults and kept quality gates active
HealthCheck reported config_warnings without echoing raw env values
non-regular .png path returned non_regular_file without calling fs.openSync
corrupt xPNG header returned unreadable_dimensions instead of pass/accept
symlinked .png batch entry was included in InspectBatch reports
broken symlink .png produced a per-file file_read_error report without aborting InspectBatch
blank preferred image and batch aliases fell back to nonblank path/dataset_path
BuildRetryPlan with whitespace image_path/path and valid directory/dataset_path used batch mode
manifest name stayed JennAIGentQuality
secret marker scan found no matches under Plugin/AIGentQuality
provider/network/write marker scan found no matches under Plugin/AIGentQuality
git diff --check
node scripts/check-jenn-static-no-provider.mjs
```

Important covered behavior:

- external same-name plugin cannot override an existing core plugin;
- external plugin discovery does not imply runtime registration without
  allowlist;
- exact name and source root policy is required;
- external direct and hybrid runtime registration remains denied.

## 10. Handoff Checkpoint

Current open gate:

```text
Layer 1 resolver-only proof, Layer 2 registration-only proof, Layer 3 stdio
smoke proof, and Layer 4 isolated pluginManager.loadPlugins legacy-external
discovery-to-registration proof are complete.
These are still not server-level runtime activation.
```

This is no longer a PR #1 or PR #2 review or merge blocker. External package
PR #1 and PR #2 are merged, their PR branches are preserved, and local external
package `main` is synced to `beb072b8ad1530dd62c526c71e4cc09930068685`. The
renamed trial now exists on external package `main` as
`Plugin/JennAIGentQualityTrial/`.

Resume rule:

- if the next user message asks to continue the minimum dry-run, first re-check
  both repository heads and worktrees, then decide whether the next requested
  proof is docs-only submission, a deferred cutover RFC, or a server-level
  runtime activation proposal;
- if the external package `main` head changed before dry-run execution,
  re-check PR #2 merge evidence and explain whether the new head supersedes
  `beb072b8ad1530dd62c526c71e4cc09930068685`;
- if writing a harness is authorized, keep it read-only against repositories,
  fixture-only for images, and process-env-only for external discovery;
- do not copy, move, delete, disable, rename, enable runtime discovery, change
  persistent env, modify loader priority, commit, push, PR, or merge without a
  later explicit gate.

## 11. Current Result

Current result: docs-only RFC.

```text
No runtime activation.
No persistent external discovery env change; Layer 4 used temporary process env
only.
No core disable, deletion, move, or stub replacement.
External package PR #1 was squash merged after explicit user request.
Local-only JennAIGentQualityTrial copy gate was completed after explicit user
request.
External package PR #2 was squash merged after explicit user request.
Local external package main is synced to beb072b8ad1530dd62c526c71e4cc09930068685.
Core-side minimum dry-run Layer 1 resolver-only proof executed and passed.
Core-side minimum dry-run Layer 2 registration-only proof executed and passed.
Core-side minimum dry-run Layer 3 stdio smoke proof executed and passed.
Core-side Layer 4 isolated loadPlugins legacy-external
discovery-to-registration proof executed and passed.
Layer 3 is stdio execution evidence only; server-level runtime activation
remains unproven.
No core repository runtime change, merge, server activation, or branch movement
is authorized by this document. Docs-only commit/PR publication requires a
separate explicit gate.
```

Next safe action:

```text
Review the docs-only PR carrying this Layer 4 receipt. If accepted, either keep
the dry-run stopped before server activation or prepare a separate server-level
runtime activation proposal.
```
