# S6 External Runtime Skeleton Task Book

Date: 2026-06-20

Status: TASKBOOK_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Parent plan: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`

Related contract: `docs/JENN_EXTERNAL_RUNTIME_ALLOWLIST_CONTRACT.md`

## 1. Purpose

This task book defines the minimum reviewed skeleton for the Jenn External Runtime and Jenn LocalState route.

It does not create external directories, copy plugins, move LocalState, generate checksums, enable runtime roots, or change clean core code.

The goal is to make the next Phase 2 work executable without confusing these boundaries:

- external package root
- external plugin discovery root
- runtime registration allowlist
- private LocalState root
- copy-first package contents
- checksum evidence
- protected `.agent_board/**` state

## 2. Authorized Scope

S6 is documentation-only and may define:

- intended external package layout
- intended LocalState layout
- required README / manifest / receipt placeholders
- required gate sequence before any copy-first migration
- validation commands for a future skeleton implementation
- rollback expectations

S6 must not:

- modify `Plugin.js`, loader code, AdminPanel, server routes, or runtime modules
- create `VCPToolBox-JENN-Extensions`
- create `VCPToolBox-JENN-LocalState`
- copy `Plugin/**`, `Agent/**`, `AdminPanel-Vue/**`, `image/**`, or private state
- write `.env`, `config.env`, credentials, tokens, logs, cache, image outputs, SQLite files, or operator data
- generate `MANIFEST.sha256`
- change `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_INSTALL_DIR`, or `VCP_EXTERNAL_PLUGIN_ALLOWLIST`
- treat discovery success as runtime registration success
- treat `.disabled` as manifest discovery evidence

## 3. Required Root Boundaries

Use placeholder paths in docs. Do not hard-code a single operator machine path as the contract.

```text
%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions
  managed Jenn external package root

%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin
  legacy-compatible external plugin discovery root

%WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState
  private local state root; not a plugin root by default
```

The only approved Phase 1 discovery/install shape remains:

```text
VCP_PLUGIN_ALLOWED_ROOTS=%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin
VCP_PLUGIN_INSTALL_DIR=%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin
```

Runtime registration remains a separate exact-plugin scoped gate:

```text
VCP_EXTERNAL_PLUGIN_ALLOWLIST=<PluginName>@%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin/<PluginName>
```

Forbidden runtime allowlist forms:

- wildcard
- name-only
- package-root
- discovery-root
- LocalState-root
- broad source directory
- multiple-plugin allowlist when a single pilot is under review

## 4. External Package Skeleton

Future implementation should create the smallest source-only external package skeleton after explicit approval.

```text
VCPToolBox-JENN-Extensions/
  README.AGENTS_OS.md
  .gitignore
  Plugin/
    README.AGENTS_OS.md
  manifests/
    README.AGENTS_OS.md
  receipts/
    README.AGENTS_OS.md
  docs/
    README.AGENTS_OS.md
```

Rules:

- `Plugin/` is the only legacy plugin discovery root in the first skeleton.
- `manifests/` stores future package-level manifest templates and checksum notes; it must not contain real secrets or raw private state.
- `receipts/` stores sanitized migration receipts only.
- `docs/` stores external package governance notes only.
- No real plugin folder is copied in S6.
- No same-name external plugin may be presented as registration-ready while a core fallback of the same name exists.
- The first no-conflict pilot remains `Plugin/JennAIGentOrchestrator/`, not `Plugin/AIGentOrchestrator/`.

## 5. LocalState Skeleton

Future LocalState implementation must remain private and default-excluded.

```text
VCPToolBox-JENN-LocalState/
  README.AGENTS_OS.md
  receipts/
    README.AGENTS_OS.md
```

The following names are expected runtime/private lanes, but S6 does not create or populate them:

```text
cache/
logs/
outputs/
secrets/
state/
private-memory/
project-data/
```

Rules:

- LocalState is not a plugin discovery root.
- LocalState must not be configured in `VCP_PLUGIN_DIRS`.
- LocalState must not be used as a runtime registration source.
- `.agent_board/**` remains blocked and must not be copied, checksummed, or migrated automatically.
- Any `.agent_board/**` handling requires a separate explicit human gate and must be excluded by default.

## 6. Required S7 / S8 / S9 Follow-Up Gates

S6 only writes the task book. The next M2 tasks must close these gates before copy-first begins.

| Sprint | Gate | Required output | Must not do |
| --- | --- | --- | --- |
| S7 | Full denylist / `.gitignore` baseline | `.gitignore` baseline derived from current governance denylist sources | Use only a small env/key/db ignore list |
| S8 | LocalState skeleton and `.agent_board/**` gate | LocalState default exclusions plus manual gate language | Move or checksum `.agent_board/**` automatically |
| S9 | Manifests / checksum rules | `MANIFEST.sha256` generation and verification rules | Generate checksum before secret-risk scan |

## 7. Denylist Sources For S7

S7 must reuse the full current denylist sources, not a simplified subset:

- `AGENTS.override.md` forbidden or sensitive paths
- `scripts/aigentquality-server-smoke-s2-preplan.js` sensitive pathspecs
- `scripts/aigentquality-server-smoke-s2-guarded-plan.js` sensitive pathspecs
- `scripts/p3-external-ecosystem-inventory.js` blocked classifications
- `docs/governance/P3E_EXTERNAL_ECOSYSTEM_TAXONOMY_RULES_SPEC_20260610.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`

Minimum categories S7 must cover:

- `.env`, `.env.*`, `config.env`, and local config variants
- API keys, tokens, secrets, passwords, credentials, private keys, and plugin `*secret*` / `*token*` filenames
- `Plugin/UserAuth/code.bin`
- cache, state, tmp, logs, output, outputs, image, generated lists, DebugLog
- SQLite / DB / WAL / SHM sidecars
- `ModelRedirect.json`, `agent_map.json`, `preprocessor_order.json`, `tag-processor-config.env`, `SemanticModelRouter.local.json`, `sarprompt.json`
- `VCPTimedContacts/**`, `VCPTimedResults/**`, `VectorStore/**`
- `Plugin/OneRing/data/**`, `Plugin/ProjectAnalyst/database/**`
- `ToolConfigs/dynamic_tool_*.json`, `ToolConfigs/dynamic_tool_catalog.json`, `ToolConfigs/dynamic_tool_categories.json`
- `.agent_board/**`

`dist` rule:

- Do not use blanket `dist/` or `**/dist/`.
- `AdminPanel-Vue/dist/**` may be ignored as frontend build output.
- `Plugin/**/dist/**` must be kept by default because it may be runtime source.
- A plugin task book may exclude `Plugin/**/dist/**` only after proving that plugin does not require it at runtime.

## 8. Copy-First Preconditions

No copy-first task may start until all of the following are true:

1. S7 full denylist baseline exists and is reviewed.
2. S8 LocalState default exclusions and `.agent_board/**` manual gate exist and are reviewed.
3. S9 checksum rules exist and are reviewed.
4. Source and target repositories have clean or explicitly accounted worktrees.
5. Source inventory records the old fork reference commit.
6. Target package path is named and does not collide with core fallback identity.
7. Secret-risk paths-only scan command is defined.
8. Rollback path is written before copying.

## 9. Future Implementation Checklist

When explicitly authorized to implement the real skeleton, use this order:

1. Verify current workspace, branch, remotes, and clean worktree.
2. Verify external package repository/root status.
3. Verify LocalState root status without reading private contents.
4. Create only reviewed skeleton directories and README placeholders.
5. Add `.gitignore` only after S7 baseline is accepted.
6. Do not copy plugins or LocalState in the skeleton slice.
7. Run path-only secret-risk scan against the skeleton.
8. Record validation evidence and rollback notes.
9. Update tracker only after evidence exists.

## 10. Validation Plan

S6 validation:

```powershell
git diff --check
git status --short
```

Future skeleton validation after approval:

```powershell
git -C %WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions status --short
git -C %WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions branch --show-current
git -C %WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions rev-parse HEAD
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState
```

Future runtime contract validation remains separate:

```powershell
VCP_PLUGIN_ALLOWED_ROOTS=%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin
VCP_EXTERNAL_PLUGIN_ALLOWLIST=<PluginName>@%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions/Plugin/<PluginName>
```

Do not run provider calls, downstream plugin calls, bridge calls, Plugin Store live installs, service startup, or external writes as part of S6.

## 11. Rollback

For S6:

- Revert this task book and the tracker S6 update.

For future skeleton implementation:

- Remove only the newly created placeholder skeleton files after verifying paths are inside the approved external package root.
- Do not delete migrated plugin copies, LocalState, `.agent_board/**`, secrets, logs, cache, or runtime data as a rollback shortcut.
- Disable runtime use by omitting `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, and `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.

## 12. S6 Acceptance

S6 can be marked PASS when:

- this task book exists;
- it defines external package and LocalState skeleton boundaries;
- it preserves discovery versus runtime registration separation;
- it names S7/S8/S9 as required follow-up gates;
- it keeps `.agent_board/**` default-blocked;
- it keeps `Plugin/**/dist/**` preserved by default;
- it defines copy-first preconditions;
- it changes no clean core runtime code;
- it creates no external package and copies no plugin/state.

S6 does not make M2 PASS. M2 stays PARTIAL until S7, S8, and S9 are also complete.
