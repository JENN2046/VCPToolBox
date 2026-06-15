# P7 AIGentQuality Renamed Trial Preflight

Date: 2026-06-15

Status: preflight plus local-only copy gate receipt. The local-only copy gate
created an untracked renamed trial directory after explicit user authorization.
No runtime activation, commit, push, PR, merge, core disablement, core deletion,
persistent environment change, loader priority change, or server start is
authorized by this document.

Scope: renamed external trial candidate for `Plugin/AIGentQuality/`.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. This preflight and local-only copy gate define the next reversible
design step after the inactive AIGentQuality external package copy was merged.
It keeps the core plugin untouched while preparing a renamed external candidate
that will not override the core plugin name.

## 2. Current Evidence

Core repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: codex/aigentquality-shadow-cutover-rfc
head: 851d4e616a381c428ab41e2e51c88052e51b32e8
worktree before this preflight: docs-only governance files untracked
```

External package repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: bd9997f130713f63f3b8d805c71bfb606039d565
source PR: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/1
source PR final head: 7cc63c5ef9e7b51a4d76a04c5340a3b977c2a5a5
source PR squash merge commit: bd9997f130713f63f3b8d805c71bfb606039d565
preserved PR branch: codex/aigentquality-external-copy
external package worktree: clean
```

Source artifact:

```text
source directory: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentQuality
source manifest name: JennAIGentQuality
source command identifiers: InspectImage, InspectBatch, BuildRetryPlan, HealthCheck
source safety boundary: rule-based dry-run only; no external vision, OCR,
OpenPose, moderation, provider, workflow invocation, or generated output write.
```

This preflight depends on the merged external package copy, not on the current
core copy. If external package `main` moves away from
`bd9997f130713f63f3b8d805c71bfb606039d565`, re-check whether the new head
supersedes this source before using it.

## 3. Proposed Renamed Trial

Proposed trial directory:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\
```

Proposed manifest identity:

```text
name: JennAIGentQualityTrial
displayName: Jenn AI Image Quality Trial
```

Proposed entry point:

```text
node AIGentQuality.js
```

Proposed command identifiers:

```text
InspectImage
InspectBatch
BuildRetryPlan
HealthCheck
```

The trial keeps command identifiers unchanged so callers can compare output
contracts between `JennAIGentQuality` and `JennAIGentQualityTrial`. The
manifest `name` is changed to avoid same-name override of the core
`AIGentQuality` plugin and to keep discovery behavior explicit.

Allowed source files for a later copy gate:

```text
AIGentQuality.js
README.md
config.env.example
plugin-manifest.json
```

Allowed mechanical edits for a later copy gate:

- `plugin-manifest.json`: change only `name`, `displayName`, and description
  wording needed to mark the artifact as a renamed trial.
- `README.md`: change title, external package name, command `maid` examples,
  and compatibility note from `JennAIGentQuality` to
  `JennAIGentQualityTrial`.
- No source behavior change in `AIGentQuality.js` during the first renamed
  trial copy.
- No secret, cache, log, generated output, fixture image, or private operator
  data copy.

## 4. Required Invariants

The renamed trial must preserve these invariants:

- the core `Plugin/AIGentQuality/` remains present and unchanged;
- the trial manifest must not use `name: AIGentQuality`;
- the existing external `Plugin/AIGentQuality/` copy remains unchanged unless a
  separate gate authorizes it;
- no loader priority changes;
- no persistent `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_DIRS`, or
  `VCP_PLUGIN_INSTALL_DIR` edits;
- no AdminPanel writes;
- no server start against operator configuration;
- no real operator image directory scanning;
- no provider, OCR, OpenPose, moderation, CLIP, network, workflow, or
  generation invocation;
- no commit, push, PR, merge, or branch deletion without explicit remote gate.

## 5. Future Copy Gate Plan

A future authorized copy gate should use Git blob bytes from external package
`main` at `bd9997f130713f63f3b8d805c71bfb606039d565`.

Exact source blob paths:

```text
bd9997f130713f63f3b8d805c71bfb606039d565:Plugin/AIGentQuality/AIGentQuality.js
bd9997f130713f63f3b8d805c71bfb606039d565:Plugin/AIGentQuality/README.md
bd9997f130713f63f3b8d805c71bfb606039d565:Plugin/AIGentQuality/config.env.example
bd9997f130713f63f3b8d805c71bfb606039d565:Plugin/AIGentQuality/plugin-manifest.json
```

The future copy must be byte-preserving before the allowed manifest and README
identity edits. Do not use clipboard copy, rendered markdown, shell text
concatenation, or formatted transcript output as the source. Record source and
target `git hash-object` evidence for each file after the copy.

The copy gate should:

1. Re-check both repositories are on expected heads and clean except for known
   docs-only governance files.
2. Create `Plugin/JennAIGentQualityTrial/` in the external package only.
3. Copy the four allowed files from `Plugin/AIGentQuality/` to
   `Plugin/JennAIGentQualityTrial/`.
4. Apply only the allowed identity/doc edits listed above.
5. Run static and behavior validation.
6. Stop before commit, push, PR, runtime activation, or any core repository
   change unless explicitly authorized.

This preflight does not authorize step 2 or later.

## 6. Validation Commands For A Later Copy Gate

Run from external package root:

```powershell
git status -sb
git rev-parse HEAD
node --check Plugin/JennAIGentQualityTrial/AIGentQuality.js
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('Plugin/JennAIGentQualityTrial/plugin-manifest.json','utf8')); if (m.name !== 'JennAIGentQualityTrial') throw new Error('bad trial manifest name: '+m.name); console.log('trial manifest ok')"
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('Plugin/AIGentQuality/plugin-manifest.json','utf8')); if (m.name !== 'JennAIGentQuality') throw new Error('source manifest changed: '+m.name); console.log('source manifest ok')"
git hash-object Plugin/AIGentQuality/AIGentQuality.js Plugin/JennAIGentQualityTrial/AIGentQuality.js
git hash-object Plugin/AIGentQuality/config.env.example Plugin/JennAIGentQualityTrial/config.env.example
```

Run from core repository root:

```powershell
git status -sb
node --test tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Static scans for the trial directory:

```powershell
rg -n "sk-[A-Za-z0-9]|BEGIN (RSA|OPENSSH|PRIVATE) KEY|password\s*=|token\s*=|api[_-]?key\s*=" Plugin/JennAIGentQualityTrial
rg -n "writeFile|appendFile|createWriteStream|mkdir|unlink|rmSync|spawn\(|exec\(|fetch\(|axios|http\.request|https\.request|openai|processToolCall" Plugin/JennAIGentQualityTrial
git diff --check
```

Expected scan result:

```text
no secret markers
no provider/network/write/processToolCall markers
no whitespace errors
```

## 7. Validation Run For This Preflight

Commands run during this docs-only preflight:

```text
external package: git rev-parse HEAD
external package: git status --short
external package: node --check Plugin/AIGentQuality/AIGentQuality.js
external package: source manifest name check
external package: git hash-object for the four source files
external package: secret marker scan under Plugin/AIGentQuality
external package: provider/network/write/processToolCall marker scan under Plugin/AIGentQuality
external package: Test-Path Plugin\JennAIGentQualityTrial
core: node --test tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Observed result:

```text
external package head: bd9997f130713f63f3b8d805c71bfb606039d565
external package worktree: clean
source AIGentQuality.js syntax: pass
source manifest name: JennAIGentQuality
trial directory exists: false
secret marker scan: no matches
provider/network/write/processToolCall marker scan: no matches
core external plugin policy tests: 26/26 pass
```

Source file hashes at
`bd9997f130713f63f3b8d805c71bfb606039d565`:

```text
Plugin/AIGentQuality/AIGentQuality.js: 380f09eef8d032ff83a2f674cd5b6b407d62a4d8
Plugin/AIGentQuality/README.md: 1f034ad47ba801b7e806c53cb1b0dc75428aa0d3
Plugin/AIGentQuality/config.env.example: 8f24d3e140baf9b3f596603cbf56cd1eee0031dc
Plugin/AIGentQuality/plugin-manifest.json: 7599b1e6f960ec38433410aacac276d55a5f9e7a
```

Pre-copy checks not run before local-only copy authorization:

```text
trial manifest check
trial node --check
trial hash comparison
trial directory scans
```

Reason at preflight time: `Plugin/JennAIGentQualityTrial/` had not been
created yet. Those checks were run later after explicit local-only copy gate
authorization; see the copy gate receipt below.

## 8. Local-Only Copy Gate Receipt

Authorization received:

```text
确认执行 local-only JennAIGentQualityTrial copy gate
```

Local copy result:

```text
target directory: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
target status: untracked local directory
files created: AIGentQuality.js, README.md, config.env.example, plugin-manifest.json
source commit: bd9997f130713f63f3b8d805c71bfb606039d565
copy method: git cat-file blob bytes from source commit
runtime activation: none
core repository file changes: none
commit/push/PR/merge: none
```

Initial byte-preserving copy hashes before identity edits:

```text
Plugin/AIGentQuality/AIGentQuality.js: 380f09eef8d032ff83a2f674cd5b6b407d62a4d8
Plugin/JennAIGentQualityTrial/AIGentQuality.js: 380f09eef8d032ff83a2f674cd5b6b407d62a4d8
Plugin/AIGentQuality/config.env.example: 8f24d3e140baf9b3f596603cbf56cd1eee0031dc
Plugin/JennAIGentQualityTrial/config.env.example: 8f24d3e140baf9b3f596603cbf56cd1eee0031dc
Plugin/AIGentQuality/README.md: 1f034ad47ba801b7e806c53cb1b0dc75428aa0d3
Plugin/JennAIGentQualityTrial/README.md: 1f034ad47ba801b7e806c53cb1b0dc75428aa0d3
Plugin/AIGentQuality/plugin-manifest.json: 7599b1e6f960ec38433410aacac276d55a5f9e7a
Plugin/JennAIGentQualityTrial/plugin-manifest.json: 7599b1e6f960ec38433410aacac276d55a5f9e7a
```

Allowed identity edits applied:

- `plugin-manifest.json`: changed `name` to `JennAIGentQualityTrial`,
  `displayName` to `Jenn AI Image Quality Trial`, and description wording to
  mark the artifact as a renamed trial.
- `README.md`: changed title, stage, external package name, compatibility note,
  goal wording, and all command `maid` examples to `JennAIGentQualityTrial`.
- `README.md`: after copy-gate review, removed the inherited broken
  `docs/AI_IMAGE_QUALITY_CONTRACT.md` reference because that document is not
  present in the external package; no runtime behavior change.
- `AIGentQuality.js`: no behavior edits; hash still matches source.
- `config.env.example`: no edits; hash still matches source.

Post-edit behavior-preserving hashes:

```text
Plugin/AIGentQuality/AIGentQuality.js: 380f09eef8d032ff83a2f674cd5b6b407d62a4d8
Plugin/JennAIGentQualityTrial/AIGentQuality.js: 380f09eef8d032ff83a2f674cd5b6b407d62a4d8
Plugin/AIGentQuality/config.env.example: 8f24d3e140baf9b3f596603cbf56cd1eee0031dc
Plugin/JennAIGentQualityTrial/config.env.example: 8f24d3e140baf9b3f596603cbf56cd1eee0031dc
```

Validation run after local copy:

```text
node --check Plugin/JennAIGentQualityTrial/AIGentQuality.js
trial manifest name check: JennAIGentQualityTrial
source manifest name check: JennAIGentQuality
trial HealthCheck: success
trial InspectImage without image_path/path: image_path is required
trial InspectBatch without directory/dataset_path: directory or dataset_path is required
trial BuildRetryPlan without directory/dataset_path: directory or dataset_path is required
fixed-string scan found no old maid JennAIGentQuality examples in trial docs
fixed-string scan found no manifest name AIGentQuality or JennAIGentQuality in trial manifest
secret marker scan under Plugin/JennAIGentQualityTrial: no matches
provider/network/write/processToolCall marker scan under Plugin/JennAIGentQualityTrial: no matches
trailing whitespace scan under Plugin/JennAIGentQualityTrial: no matches
trial README AI_IMAGE_QUALITY_CONTRACT broken-link scan: no matches
trial temporary fixture behavior checks: pass
core external plugin policy tests: 26/26 pass
```

The temporary fixture behavior checks covered low-resolution retry routing,
caption compliance manual-review routing, and GIF/AVIF unsupported artifact
reporting in batch inspection.

## 9. Stop Conditions

Stop before any write if:

- external package `main` is not
  `bd9997f130713f63f3b8d805c71bfb606039d565` and the new head has not been
  reviewed as an equivalent or better source;
- core repository head changed unexpectedly;
- either repository has unrelated uncommitted changes;
- `Plugin/JennAIGentQualityTrial/` already exists;
- the proposed manifest name is `AIGentQuality`;
- the copy would touch core runtime files;
- the copy would modify persistent env, loader priority, AdminPanel settings, or
  server runtime state;
- validation cannot be run;
- validation fails.

Stop after local write but before commit/push if:

- the diff includes anything outside `Plugin/JennAIGentQualityTrial/`;
- the diff includes secrets, logs, cache, generated outputs, private data, or
  fixture images;
- source `Plugin/AIGentQuality/` changed unexpectedly;
- trial `AIGentQuality.js` differs from source behavior;
- static scans or targeted checks fail.

## 10. Rollback

Because the future copy gate should be local-only until separately authorized,
rollback is limited to removing only the newly created trial directory from the
working tree before any commit.

Do not run rollback automatically. Before any recursive removal, first resolve
the absolute target path, verify it is exactly
`A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial`,
verify no other files are included, and get explicit user approval for that
destructive local cleanup.

## 11. Current Result

Current result: external package commit/PR gate completed after local-only
renamed-trial copy gate review.
Copy-gate review found and fixed one README-only broken link in the untracked
trial directory.

```text
Plugin/JennAIGentQualityTrial/ committed in the external package worktree.
Trial README no longer references docs/AI_IMAGE_QUALITY_CONTRACT.md.
No runtime activation.
No external discovery env change.
No core disable, deletion, move, or stub replacement.
No merge or branch deletion.
```

External package PR gate receipt:

```text
authorization: 确认外置包 commit/PR gate
repository: JENN2046/VCPToolBox-JENN-Extensions
branch: codex/jennaigentqualitytrial-external-copy
base: main
PR: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/2
PR state: open draft
commit after metadata fix: fc1c62d1584f176c2ab893398bb318655d3a4c0d
changed files: Plugin/JennAIGentQualityTrial/AIGentQuality.js,
  Plugin/JennAIGentQualityTrial/README.md,
  Plugin/JennAIGentQualityTrial/config.env.example,
  Plugin/JennAIGentQualityTrial/plugin-manifest.json
```

Commit metadata correction receipt:

```text
authorization: 确认修正 PR #2 commit email 元数据并 force-with-lease 推送
superseded commit: 31bf36fb590c03887ff37f695d8bbc5666ceddf0
replacement commit: fc1c62d1584f176c2ab893398bb318655d3a4c0d
push mode: --force-with-lease pinned to superseded commit
file content change during metadata fix: none
verified PR commit author/committer email: 515292656@gmail.com
```

PR readiness and review trigger receipt:

```text
authorization: 授权修全局 Git email，再把 PR #2 转 ready-for-review 并触发 review。
global git user.email after fix: 515292656@gmail.com
PR #2 draft state after ready action: false
review trigger comment: @Codex Review
review trigger comment URL: https://github.com/JENN2046/VCPToolBox-JENN-Extensions/pull/2#issuecomment-4704722497
verified PR head commit after review trigger: fc1c62d1584f176c2ab893398bb318655d3a4c0d
verified PR commit author/committer email after review trigger: 515292656@gmail.com
```

PR merge receipt:

```text
authorization: 合并 PR #2。
pre-merge PR state: open, ready-for-review, mergeable
pre-merge Codex Review result: no major issues on fc1c62d158
checks reported by GitHub CLI: none
merge mode: squash
branch deletion: false
merge commit on main: beb072b8ad1530dd62c526c71e4cc09930068685
PR state after merge: merged
remote branch after merge: codex/jennaigentqualitytrial-external-copy retained at fc1c62d1584f176c2ab893398bb318655d3a4c0d
local external package main after sync: beb072b8ad1530dd62c526c71e4cc09930068685
post-merge validation: node --check passed, trial manifest name check passed,
  trial README AI_IMAGE_QUALITY_CONTRACT broken-link scan found no matches
```

Next safe action:

```text
Plan the next extraction or cutover step from external package main at
beb072b8ad1530dd62c526c71e4cc09930068685.
```
