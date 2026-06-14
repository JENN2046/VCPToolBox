# P7 AIGentQuality Copy-First Preflight

Date: 2026-06-14

Status: docs-only preflight for a future explicit copy gate.

Scope: `Plugin/AIGentQuality/` only.

This document is not copy authorization. It does not authorize copying,
moving, deleting, disabling, stub replacement, loader changes, AdminPanel
changes, external package writes, commits, pushes, pull requests, or merge
actions.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. This preflight makes the next copy-first step safer and more
reproducible before any file movement. It turns the merged P7 dry-run into an
execution checklist that still stops before copy.

## 2. Current State

Core repository basis before this document edit:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: codex/p7-aigentquality-copy-preflight
base head: 622991a7bf0f3aae5af22f272b14326f6b90237d
basis: merged PR #260
worktree before this document edit: clean
```

External package repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: f7772c654c2d8d34698f2818fde02ec63df783cb
worktree: clean
Plugin/AIGentQuality exists: false
Plugin/JennAIGentQuality exists: false
```

Authoritative inputs:

- `docs/governance/P7_AIGENTQUALITY_COPY_FIRST_DRY_RUN_20260614.md`
- `docs/governance/P3_JENN_EXTERNALIZATION_INVENTORY_V2_20260614.md`
- `docs/governance/JENN_EXTRACTION_IMPLEMENTATION_PLAN_20260608.md`
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\README.AGENTS_OS.md`
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\README.AGENTS_OS.md`

## 3. Candidate Boundary

Source plugin:

```text
Plugin/AIGentQuality/
```

Allowed future source files:

```text
Plugin/AIGentQuality/AIGentQuality.js
Plugin/AIGentQuality/README.md
Plugin/AIGentQuality/config.env.example
Plugin/AIGentQuality/plugin-manifest.json
```

Git blob SHA256 baseline from merged PR #260:

| Path | SHA256 |
| --- | --- |
| `Plugin/AIGentQuality/AIGentQuality.js` | `437B3E4E6B6A3CAE387294523FFCE25F674E280A8B2124DEF38803B6EAAE5327` |
| `Plugin/AIGentQuality/README.md` | `9FE6E67D62C1F03783E83885B656CEA55E78096D7D23F95A590F5C643A576DBE` |
| `Plugin/AIGentQuality/config.env.example` | `82F702E2C1B75BDABFE7E60B1CDA5D4B2D81C3F3AB5A142EC9B1F5320D922C94` |
| `Plugin/AIGentQuality/plugin-manifest.json` | `6D4F7769659822131E5AF409ED8B6A574C75F6AC6640F87BED90772D61B48803` |

Excluded paths:

```text
Plugin/AIGentQuality/config.env
Plugin/AIGentQuality/.env
Plugin/AIGentQuality/state/
Plugin/AIGentQuality/cache/
Plugin/AIGentQuality/logs/
Plugin/AIGentQuality/output/
Plugin/AIGentQuality/outputs/
```

Out of scope:

- `modules/channelHub/`, still Jenn-authored `keep_core / deferred-core-split`;
- other P7 candidates;
- `modules/photoStudio/`;
- AdminPanel extension loader work;
- Agent loader work;
- LocalState migration;
- core disable, deletion, or stub replacement;
- runtime activation of the external copy.

## 4. Target Design

Future explicit copy gate target:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality\
```

Decision for this preflight:

- use same-name `AIGentQuality` only as an inactive copy-first package;
- do not create `JennAIGentQuality` in this gate;
- do not enable external discovery for this plugin;
- do not change `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, or runtime env;
- do not disable the core copy;
- do not change manifests after copy.

Reason: same-name inactive copy preserves byte-for-byte comparison with the
core source. Runtime activation and duplicate-name policy remain separate
future gates.

## 5. Required Pre-Copy Checks

Run immediately before any future copy authorization:

```powershell
git status -sb
git rev-parse HEAD
git -c core.quotePath=false ls-files Plugin/AIGentQuality
```

Expected core state before copy:

```text
branch is an explicit copy-first branch
worktree is clean except the authorized preflight/copy artifacts
HEAD is reviewed and recorded
exactly four tracked source files exist under Plugin/AIGentQuality/
```

Sensitive path checks:

```powershell
Test-Path Plugin/AIGentQuality/config.env
Test-Path Plugin/AIGentQuality/.env
Test-Path Plugin/AIGentQuality/state
Test-Path Plugin/AIGentQuality/cache
Test-Path Plugin/AIGentQuality/logs
Test-Path Plugin/AIGentQuality/output
Test-Path Plugin/AIGentQuality/outputs
```

All must return `False`.

External package checks:

```powershell
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQuality
```

Expected external state before copy:

```text
worktree clean
target Plugin/AIGentQuality absent
no-conflict target Plugin/JennAIGentQuality absent
```

Git blob hash check:

```powershell
@'
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const files = [
  'Plugin/AIGentQuality/AIGentQuality.js',
  'Plugin/AIGentQuality/README.md',
  'Plugin/AIGentQuality/config.env.example',
  'Plugin/AIGentQuality/plugin-manifest.json',
];
for (const file of files) {
  const data = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'buffer' });
  const hash = crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
  console.log(`${hash}  ${file}`);
}
'@ | node -
```

The output must match the table in section 3, or this preflight must be
updated before copy.

Static safety checks:

```powershell
node --check Plugin/AIGentQuality/AIGentQuality.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('Plugin/AIGentQuality/plugin-manifest.json','utf8')); console.log('manifest ok')"
'{"tool_name":"HealthCheck"}' | node Plugin/AIGentQuality/AIGentQuality.js
rg -n "writeFile|appendFile|createWriteStream|mkdir|unlink|rmSync|spawn\(|exec\(|fetch\(|axios|http\.request|https\.request|openai|processToolCall" Plugin/AIGentQuality/AIGentQuality.js
node --test tests/plugin-external-dirs.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js tests/p3-external-ecosystem-inventory.test.js
```

Expected static safety result:

```text
node --check: pass
manifest parse: pass
HealthCheck: external_vision_enabled=false
forbidden write/network/subprocess/provider/processToolCall marker scan: no matches
external plugin lane and P3 inventory tests: pass
```

## 6. Copy Method Requirement

Future copy must preserve Git blob bytes, not platform-normalized working-tree
bytes. Do not use recursive directory copy as the primary integrity path.

Required design for the future copy gate:

- read each source file from `git show HEAD:<path>` as bytes;
- write each target file as bytes under the external package;
- create only the four allowed files;
- fail closed if any excluded source path exists;
- fail closed if the target directory already exists;
- fail closed if either repository worktree is dirty before copy;
- compute post-copy SHA256 from target bytes and compare with the expected Git
  blob SHA256 table.

The exact write script or command must be generated only in the future
explicit copy gate. This preflight intentionally does not include a runnable
copy command.

## 7. Post-Copy Validation For Future Gate

After a future authorized copy, run:

```powershell
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
Get-ChildItem -LiteralPath A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality -Force
```

Expected target files:

```text
AIGentQuality.js
README.md
config.env.example
plugin-manifest.json
```

Static checks from the external target must then pass without activating the
external plugin:

```powershell
node --check A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality\AIGentQuality.js
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions/Plugin/AIGentQuality/plugin-manifest.json','utf8')); console.log('manifest ok')"
```

Target byte hash validation after a future authorized copy:

```powershell
@'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const targetRoot = 'A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions/Plugin/AIGentQuality';
const expected = {
  'AIGentQuality.js': '437B3E4E6B6A3CAE387294523FFCE25F674E280A8B2124DEF38803B6EAAE5327',
  'README.md': '9FE6E67D62C1F03783E83885B656CEA55E78096D7D23F95A590F5C643A576DBE',
  'config.env.example': '82F702E2C1B75BDABFE7E60B1CDA5D4B2D81C3F3AB5A142EC9B1F5320D922C94',
  'plugin-manifest.json': '6D4F7769659822131E5AF409ED8B6A574C75F6AC6640F87BED90772D61B48803',
};
for (const [file, expectedHash] of Object.entries(expected)) {
  const targetPath = path.join(targetRoot, file);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex').toUpperCase();
  if (hash !== expectedHash) {
    throw new Error(`${file} hash mismatch: ${hash} !== ${expectedHash}`);
  }
  console.log(`ok ${hash} ${file}`);
}
'@ | node -
```

No runtime registration, no server start, and no plugin execution against
operator image paths should occur in the copy gate.

## 8. Stop Conditions

Stop before copy if any condition is true:

- core worktree is dirty for unrelated reasons;
- external package worktree is dirty;
- any excluded env/runtime path exists;
- target directory already exists;
- source hash differs from the merged P7 baseline and has not been reviewed;
- static safety checks fail or forbidden source markers are found;
- `modules/channelHub/` or another plugin becomes part of the proposed change;
- the next step would change runtime env, loader behavior, AdminPanel, core
  manifest state, or core plugin disable state.

Stop after copy and before any commit if:

- copied target file count is not four;
- target SHA256 differs from section 3;
- target byte hash validation cannot be run cleanly;
- external package contains generated outputs, cache, logs, secrets, runtime
  state, or operator data;
- static target checks fail.

## 9. Current Result

Current result: preflight only.

```text
No files copied.
No external package writes.
No core files changed except this governance document.
No runtime behavior changed.
No commit, push, PR, ready marking, or merge authorized by this document.
```

Next safe action:

```text
Review this preflight. If accepted, explicitly authorize the future copy-first
gate for Plugin/AIGentQuality.
```

## 10. Resume Review 2026-06-15

Purpose: confirm this preflight remains current after the calendar moved to
2026-06-15.

Commands rerun:

```powershell
git fetch origin main
git rev-parse HEAD
git rev-parse main
git rev-parse origin/main
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions fetch origin main
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse main
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse origin/main
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality
Test-Path A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQuality
```

Observed result:

```text
core HEAD/main/origin-main: 622991a7bf0f3aae5af22f272b14326f6b90237d
external HEAD/main/origin-main: f7772c654c2d8d34698f2818fde02ec63df783cb
external worktree: clean
Plugin/AIGentQuality target exists: false
Plugin/JennAIGentQuality target exists: false
```

Review conclusion: this preflight is still current. No copy, no external
package write, no commit, no push, and no PR action was performed during this
resume review.

## 11. Preflight Review 2026-06-15

Review focus: make the future copy gate reproducible without embedding a copy
command in this preflight.

Fixes made during this review:

- added explicit pre-copy static safety checks;
- added explicit target byte hash validation for the future post-copy state;
- added stop conditions for failed static safety checks and unavailable target
  byte hash validation.

Validation rerun:

```text
document trailing whitespace: none
Git blob SHA256 table matches current HEAD bytes: pass
node --check Plugin/AIGentQuality/AIGentQuality.js: pass
plugin-manifest.json parse: pass
HealthCheck: pass, external_vision_enabled=false
forbidden write/network/subprocess/provider/processToolCall marker scan: no matches
external plugin lane and P3 inventory targeted tests: 46/46 pass
external Plugin/AIGentQuality target exists: false
external Plugin/JennAIGentQuality target exists: false
```

Review conclusion: preflight is stronger after this review. It still does not
authorize copy, external package writes, commit, push, PR creation, or runtime
activation.

## 12. Commit-Readiness Short Review 2026-06-15

Short-review verdict: suitable for a docs-only PR after explicit approval to
commit, push, and open the PR.

Review checks:

| Check | Result |
| --- | --- |
| Worktree scope is limited to this preflight document | pass |
| Document states it is not copy authorization | pass |
| Document excludes `modules/channelHub/` and other plugins | pass |
| Git blob SHA256 table matches current HEAD bytes | pass |
| Source static checks pass | pass |
| Forbidden write/network/subprocess/provider/processToolCall marker scan has no matches | pass |
| External package worktree is clean | pass |
| External `Plugin/AIGentQuality` target is absent | pass |
| External `Plugin/JennAIGentQuality` target is absent | pass |
| External plugin lane and P3 inventory targeted tests pass | pass, 46/46 |
| Document has no trailing whitespace | pass |

Remaining boundaries:

- no copy has been performed;
- no external package write has been performed;
- no runtime activation has been performed;
- no commit, push, or PR action is authorized by this section.

## 13. Future Authorization Boundary

This preflight separates four future authorization layers. Approval for one
layer must not be treated as approval for another.

| Future layer | What it would allow | What it still would not allow |
| --- | --- | --- |
| Docs-only PR for this preflight | commit, push, and open a PR containing only this governance document | copy files, write the external package, activate runtime loading, disable core copy |
| Copy-first external package gate | create `VCPToolBox-JENN-Extensions/Plugin/AIGentQuality/` and write only the four allowed files after all pre-copy checks pass | change core files, disable core plugin, change loader env, activate external discovery |
| External package PR or commit gate | commit and push the external package copy after post-copy validation passes | modify VCPToolBox core, enable runtime use, delete or stub core copy |
| Runtime/cutover gate | evaluate same-name conflict policy, loader behavior, and activation design | skip copy integrity checks, bypass file-read policy, delete core copy without a rollback gate |

Minimum future copy authorization text should identify:

```text
target source: Plugin/AIGentQuality/
target external package: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
target external path: Plugin/AIGentQuality/
allowed files: AIGentQuality.js, README.md, config.env.example, plugin-manifest.json
copy mode: Git blob bytes only
no core change: required
no runtime activation: required
no external package commit/push unless separately confirmed
```

If a future instruction omits any of those boundaries, treat it as insufficient
for copy and ask for clarification before writing files.
