# M8 Upstream PR And Rebase Workflow

Date: 2026-06-21

Status: WORKFLOW_READY_UPSTREAM_PR_DEFERRED_BY_USER

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M8 prepares the upstream PR and long-term rebase workflow for the clean-core route.

This document does not open an upstream PR. It defines the gate that must pass before any future PR to `lioensky/VCPToolBox` is created.

Current user decision: skip opening the `lioensky/VCPToolBox` upstream PR for now.

## 2. Hard Boundaries

The following actions remain forbidden in M8 without explicit current-turn human approval:

- opening an upstream PR;
- pushing to upstream;
- force-pushing or rewriting history;
- deleting, untracking, or stubbing old core files;
- changing runtime dispatch semantics;
- copying, checksumming, or migrating `.agent_board/**`;
- reading or copying LocalState/private/operator data;
- modifying `.env`, secrets, auth material, tokens, or credentials;
- running provider calls, bridge writes, live external writes, releases, or deployments.

## 3. Repository Reality Observed

Read-only evidence collected on 2026-06-21:

```text
Current governance branch: codex/m2-m7-jenn-external-runtime-roadmap
Current governance branch status: clean and synced to origin/codex/m2-m7-jenn-external-runtime-roadmap
Upstream remote: https://github.com/lioensky/VCPToolBox.git
Jenn fork remote: https://github.com/JENN2046/VCPToolBox.git
Latest upstream/main after fetch: f8d4547998ba2767d86ce6bb04e728388bd07c3b
Jenn clean-base candidate: origin/codex/upstream-main-clean-base
Jenn clean-base candidate commit: 86c69e8dc2a1fad6aeb0fe3d2df1d3e2248e2fcb
Common merge-base: f901f1a995fa6f8242e176b8ca66b6addd0be427
```

Read-only rebase preflight:

```text
upstream/main changed files from merge-base: 12
clean-base candidate changed files from merge-base: 11
changed-file intersection: 0
merge-tree conflict markers / CONFLICT lines: none observed
```

This is only a preflight signal. It does not replace a fresh rebase branch and full validation immediately before an upstream PR.

## 4. Upstream PR Candidate Scope

The upstream PR candidate must be recreated from the latest `upstream/main` and carry only the generic Phase 1 clean-core plugin contract.

Current allowed upstream candidate file surface:

```text
Plugin.js
modules/externalPluginAllowPolicy.js
modules/externalPluginSafetyGate.js
modules/pluginRuntimeEnvSandbox.js
modules/pluginRootResolver.js
tests/externalPluginAllowPolicy.test.js
tests/externalPluginSafetyGate.test.js
tests/plugin-external-dirs.test.js
tests/plugin-external-runtime-direct-policy.test.js
tests/plugin-external-runtime-env-sandbox.test.js
tests/plugin-external-runtime-registration-gate.test.js
```

Allowed content:

- generic external plugin root allowlisting through `VCP_PLUGIN_ALLOWED_ROOTS`;
- plugin discovery through `VCP_PLUGIN_DIRS`;
- exact runtime registration gating through `VCP_EXTERNAL_PLUGIN_ALLOWLIST`;
- manifest merge behavior required for generic plugin contracts;
- env sandbox behavior that preserves Windows `PATHEXT` and avoids forwarding manifest-selected global secrets;
- tests proving discovery, registration, direct external manifest policy, and env sandbox boundaries.

Excluded from upstream PR scope:

- M2-M8 Jenn governance proof documents;
- Jenn external package contents or receipts;
- `Plugin/JennAIGentOrchestrator/` external runtime payload;
- Jenn business logic, fixed trial data, private paths, provider-specific adapters, Agent content, PhotoStudio data, or AdminPanel Jenn pages;
- `.agent_board/**`, LocalState/private/operator data, runtime state, cache, logs, images, sqlite/db sidecars, auth material, tokens, credentials, or real `.env` files;
- delete/untrack/stub changes for `Plugin/AIGentOrchestrator/` or any old core fallback.

The current M2-M8 governance branch is not the upstream PR candidate. It is a Jenn fork governance evidence branch.

## 5. Upstream PR Open Gate

Do not open the upstream PR unless all of the following are true in the same execution window:

| Gate | Required evidence | Status now |
| --- | --- | --- |
| Human authorization | Explicit current-turn approval naming `lioensky/VCPToolBox`, source branch, target branch, and action `open upstream PR` | DEFERRED_BY_USER |
| Fresh upstream base | `git fetch upstream` and recorded `git rev-parse upstream/main` | PRECHECK_PASS |
| Candidate branch hygiene | Candidate branch is recreated/rebased from latest `upstream/main`, not from the M2-M8 governance branch | TODO |
| Scope check | `git diff --name-status upstream/main...<candidate>` contains only allowed Phase 1 generic files | TODO |
| Secret/runtime path check | diff path scan excludes `.env`, `config.env`, secret/token/auth files, state/cache/log/image/output/sqlite/db sidecars, `.agent_board/**`, and LocalState | TODO |
| Targeted validation | required syntax and targeted tests pass on the candidate branch | TODO |
| PR body | PR body states default-disabled behavior, discovery versus runtime registration separation, no Jenn payload, no provider/bridge/live write | TODO |

Required targeted validation before any upstream PR:

```powershell
node --check Plugin.js
node --check modules/externalPluginAllowPolicy.js
node --check modules/externalPluginSafetyGate.js
node --check modules/pluginRuntimeEnvSandbox.js
node --check modules/pluginRootResolver.js
node tests/externalPluginAllowPolicy.test.js
node tests/externalPluginSafetyGate.test.js
node tests/plugin-external-dirs.test.js
node tests/plugin-external-runtime-env-sandbox.test.js
node tests/plugin-external-runtime-registration-gate.test.js
node tests/plugin-external-runtime-direct-policy.test.js
git diff --check upstream/main...HEAD -- Plugin.js modules/externalPluginAllowPolicy.js modules/externalPluginSafetyGate.js modules/pluginRuntimeEnvSandbox.js modules/pluginRootResolver.js tests/externalPluginAllowPolicy.test.js tests/externalPluginSafetyGate.test.js tests/plugin-external-dirs.test.js tests/plugin-external-runtime-env-sandbox.test.js tests/plugin-external-runtime-registration-gate.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Required path-only safety scan before any upstream PR:

```powershell
git diff --name-only upstream/main...HEAD |
  Select-String -Pattern '(^|/)(\.env|config\.env|state|cache|logs?|DebugLog|image|output|outputs|secrets|\.agent_board)(/|$)|secret|token|auth|credential|\.sqlite|\.sqlite3|\.db|code\.bin'
```

Expected result: no matches. If the scan matches any path, stop and review manually.

## 6. Long-Term Rebase Workflow

Use this workflow before each future upstream PR attempt and before refreshing Jenn clean core from upstream:

1. Fetch read-only refs:

```powershell
git fetch upstream
git fetch origin
```

2. Record source points:

```powershell
git rev-parse upstream/main
git rev-parse origin/codex/upstream-main-clean-base
git merge-base upstream/main origin/codex/upstream-main-clean-base
```

3. Create or refresh a narrow candidate branch from latest `upstream/main`.

The candidate branch must carry only generic clean-core contract commits. Do not base the upstream candidate on the M2-M8 Jenn governance branch.

4. Preflight conflicts before opening PR:

```powershell
$base = git merge-base upstream/main origin/codex/upstream-main-clean-base
[array]$upstreamFiles = git diff --name-only "$base..upstream/main"
[array]$candidateFiles = git diff --name-only "$base..origin/codex/upstream-main-clean-base"
[array]$intersection = $upstreamFiles | Where-Object { $candidateFiles -contains $_ }
$intersection | Sort-Object
```

5. Apply the conflict budget:

| Result | Meaning | Action |
| --- | --- | --- |
| PASS | conflicts or overlapping files are limited to the generic contract surface and all targeted tests pass | eligible for human PR-open approval |
| PARTIAL | conflicts are small but require manual resolution in generic contract files | resolve locally, rerun full M8 validation |
| BLOCK | conflicts touch Jenn business logic, LocalState, `.agent_board/**`, AdminPanel Jenn pages, provider adapters, state/cache/log/image/output/db files, secrets, or require dispatch rewrite | do not open upstream PR |

6. Keep long-term upstream conflict surface small.

The intended steady state is:

```text
Upstream conflicts should concentrate in Plugin.js and small generic contract modules/tests.
Jenn plugins, Agents, AdminPanel extensions, PhotoStudio data, LocalState, private memory, and external receipts should stay outside upstream PR scope.
```

## 7. Draft Upstream PR Body Template

Do not paste this into an upstream PR until a fresh candidate branch has been rebased and validated.

```markdown
## Summary

- add generic external plugin root allowlisting and discovery contract
- keep external plugin runtime registration behind exact allowlist
- add env sandbox protection for external plugin processes
- add targeted tests for discovery, registration, direct manifest policy, and env sandbox behavior

## Safety

- default behavior remains disabled without explicit external plugin env configuration
- discovery success is not runtime registration success
- no Jenn external runtime payload is included
- no provider, bridge, shell/file live write, LocalState, secret, or auth material is included
- no core fallback is deleted, untracked, or stubbed

## Validation

- node --check Plugin.js
- node --check modules/externalPluginAllowPolicy.js
- node --check modules/externalPluginSafetyGate.js
- node --check modules/pluginRuntimeEnvSandbox.js
- node --check modules/pluginRootResolver.js
- node tests/externalPluginAllowPolicy.test.js
- node tests/externalPluginSafetyGate.test.js
- node tests/plugin-external-dirs.test.js
- node tests/plugin-external-runtime-env-sandbox.test.js
- node tests/plugin-external-runtime-registration-gate.test.js
- node tests/plugin-external-runtime-direct-policy.test.js
```

## 8. M8 Sprint Scoring

```text
S23 Upstream PR readiness packet: PASS, 3 / 3
S24 Long-term rebase workflow: PASS, 4 / 4
S25 Open upstream PR with human approval: DEFERRED_BY_USER, 0 / 3
M8 current score: 7 / 10
```

M8 remains PARTIAL because the upstream PR was skipped by user decision and must not be opened automatically.

## 9. Validation For This Document

This M8 step is documentation and read-only Git preflight only:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "WORKFLOW_READY_UPSTREAM_PR_DEFERRED_BY_USER|DEFERRED_BY_USER|M8 current score: 7 / 10|The current M2-M8 governance branch is not the upstream PR candidate|Do not open the upstream PR" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md
git status --short
```

## 10. Rollback

Rollback M8 documentation by reverting this document and the tracker update.

No code rollback is required because this step does not change runtime code, copy external payloads, read LocalState/private data, open PRs, push upstream, delete files, untrack files, stub files, deploy, or call providers/bridges.
