# S8 LocalState And Agent Board Gate

Date: 2026-06-21

Status: GATE_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Parent task books:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S6_EXTERNAL_RUNTIME_SKELETON_TASKBOOK_20260620.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md`

Parent plan: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`

## 1. Purpose

This document closes the S8 gate for Jenn LocalState default exclusions and protected `.agent_board/**` handling.

It does not create `VCPToolBox-JENN-LocalState`, read private LocalState contents, copy runtime state, generate checksums, modify runtime code, enable bridge behavior, or migrate `.agent_board/**`.

S8 makes two decisions reviewable before copy-first work begins:

- LocalState is private by default and must not become a plugin discovery or runtime registration root.
- `.agent_board/**` is separately protected and remains blocked from automatic copy, checksum, migration, deletion, untracking, or stubbing.

## 2. Authorized Scope

S8 may define:

- the future LocalState skeleton shape;
- the LocalState `.gitignore` baseline;
- allowed placeholder files for a reviewed skeleton;
- `.agent_board/**` gate triggers;
- gate evidence requirements;
- gate allowed and forbidden scopes;
- rollback rules for this documentation gate and future skeleton placeholders.

S8 must not:

- create `VCPToolBox-JENN-LocalState`;
- create or modify `.agent_board/**`;
- traverse, read, copy, checksum, archive, migrate, delete, untrack, or stub private LocalState contents;
- modify `.env`, `config.env`, credentials, tokens, auth material, or provider config;
- modify `Plugin.js`, `server.js`, bridge code, AdminPanel code, runtime loaders, or plugin execution behavior;
- run provider calls, bridge calls, shell/file external writes, production services, or live external writes;
- treat discovery success as runtime registration success;
- generate `MANIFEST.sha256`.

## 3. LocalState Skeleton Contract

Future skeleton creation, after explicit skeleton approval, may create only this reviewed placeholder shape:

```text
%WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState/
  .gitignore
  README.AGENTS_OS.md
  receipts/
    README.AGENTS_OS.md
```

Expected private lanes may be documented but must not be created or populated by S8:

```text
cache/
logs/
outputs/
secrets/
state/
private-memory/
project-data/
.agent_board/
```

Rules:

- LocalState is private/operator state, not source package content.
- LocalState must not be configured in `VCP_PLUGIN_DIRS`.
- LocalState must not be configured in `VCP_PLUGIN_ALLOWED_ROOTS`.
- LocalState must not be used in `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.
- LocalState must not be scanned as plugin code by default.
- LocalState must not be included in external plugin `MANIFEST.sha256`.
- Any future LocalState manifest must be separate from plugin source checksums.

## 4. LocalState Gitignore Baseline

The future `VCPToolBox-JENN-LocalState/.gitignore` must start private by default:

```gitignore
# Jenn LocalState default: private by default
*
!.gitignore
!README.AGENTS_OS.md
!receipts/
!receipts/README.AGENTS_OS.md
```

This means the following remain excluded unless a later reviewed LocalState task writes a narrower allow rule:

- env/config files;
- credentials, tokens, auth codes, private keys, and secret-like files;
- `cache/`, `logs/`, `outputs/`, `secrets/`, `state/`, `private-memory/`, and `project-data/`;
- SQLite, DB, vector, WAL, SHM, and sidecar stores;
- generated images, runtime outputs, operator data, and local diagnostics;
- `.agent_board/**`.

No future LocalState `.gitignore` may add a broad allow rule such as `!*` or `!**/*` without a separate reviewed migration task.

## 5. Protected Agent Board Gate

`.agent_board/**` is blocked by default even inside LocalState. It is not ordinary LocalState content for automated handling and must not be copied, checksummed, or migrated automatically.

The gate is triggered by any planned action that would:

- read `.agent_board/**` file contents;
- enumerate `.agent_board/**` children beyond an approved paths-only check;
- copy, archive, migrate, checksum, delete, untrack, stub, rewrite, or normalize `.agent_board/**`;
- include `.agent_board/**` in a plugin source package;
- include `.agent_board/**` in `MANIFEST.sha256`;
- include `.agent_board/**` in a LocalState migration package;
- use `.agent_board/**` as evidence for runtime registration, shadow validation, rollback proof, or stub/remove readiness.

If a candidate copy list, checksum list, manifest list, migration list, or rollback drill includes `.agent_board/**`, the task is blocked until the path is removed or a later explicit gate is opened.

## 6. Gate Confirmation Requirements

Codex self-review may identify, document, and block `.agent_board/**` risk without interrupting the user.

Codex self-review may not unlock `.agent_board/**` content handling. Unlocking requires a separate current-turn human approval that explicitly names:

- source root;
- target root;
- exact `.agent_board/**` path subset;
- operation type;
- whether content reads are allowed;
- whether copy, checksum, archive, migration, delete, untrack, or stub is allowed;
- reason for touching protected agent-board state;
- evidence file to be written;
- rollback plan.

Generic phrases such as `continue`, `go ahead`, `do it`, `approve LocalState`, or `approve M2-M7` do not unlock `.agent_board/**`.

## 7. Allowed Scope Before A Separate Gate

Before a separate `.agent_board/**` gate is opened, allowed handling is limited to:

- documenting that `.agent_board/**` is blocked;
- confirming future `.gitignore` rules exclude `.agent_board/**`;
- checking that planned copy/checksum/migration manifests do not include `.agent_board/**`;
- recording a blocked decision in a sanitized receipt that does not include private agent-board content;
- using path literals in governance docs.

Path-only checks must avoid private content reads. A future check may only prove exclusion or top-level presence and must not traverse child content unless the separate gate explicitly allows it.

## 8. Forbidden Scope Before A Separate Gate

Before a separate `.agent_board/**` gate is opened, the following remain forbidden:

- automatic copy-first of `.agent_board/**`;
- automatic checksum of `.agent_board/**`;
- automatic LocalState migration of `.agent_board/**`;
- automatic archival of `.agent_board/**`;
- using `.agent_board/**` as rollback-drill payload;
- reading `.agent_board/**` file contents for summarization or inventory;
- migrating `.agent_board/**` into `VCPToolBox-JENN-Extensions`;
- treating `.agent_board/**` as plugin source, plugin config, or runtime registration evidence;
- deleting, untracking, stubbing, or replacing `.agent_board/**`.

This S8 gate does not approve any of those actions.

## 9. Evidence Required For Future Gate Opening

A future `.agent_board/**` gate request must produce a short gate record before any content handling.

Minimum record fields:

```text
Gate:
Source root:
Target root:
Exact path subset:
Operation:
Content read allowed: yes/no
Copy allowed: yes/no
Checksum allowed: yes/no
Migration allowed: yes/no
Delete/untrack/stub allowed: yes/no
Reason:
Expected evidence:
Rollback:
Approver:
Date:
```

The evidence must be reviewable and blocking:

- If required fields are missing, the task remains blocked.
- If the target root is an external plugin package, the task remains blocked.
- If checksum is requested before secret-risk scan and explicit approval, the task remains blocked.
- If delete, untrack, or stub is requested before M7 decision completion, the task remains blocked.
- If content read would expose secrets, private notes, operator data, or auth material, the task remains blocked.

## 10. Copy-First Interaction

S8 adds these preconditions to every future copy-first task:

1. Apply the S7 external package denylist before copying.
2. Keep LocalState private by default.
3. Exclude `.agent_board/**` from source selection.
4. Run a paths-only secret/runtime risk scan after copying reviewed source paths.
5. Remove or block any `.agent_board/**` candidate before checksum.
6. Generate checksum only after the paths-only scan is clean.
7. Keep LocalState and plugin source checksum records separate.

Copy-first success cannot prove `.agent_board/**` migration success, because `.agent_board/**` is intentionally outside the automatic copy-first package.

## 11. Shadow Validation And Rollback Interaction

Shadow validation may prove external plugin discovery or disabled registration behavior only for reviewed source package paths.

Shadow validation must not:

- use LocalState as a plugin root;
- use `.agent_board/**` as fixture data;
- read private LocalState contents;
- treat discovery success as runtime registration success;
- make provider calls, bridge calls, live external writes, or production service changes.

Rollback drill may verify that runtime use can be disabled by omitting external plugin env values, but it must not delete or rewrite LocalState and must not use `.agent_board/**` as rollback payload.

## 12. Future Skeleton Validation

S8 validation is documentation-only. A future skeleton implementation may use commands like these after explicit skeleton approval:

```powershell
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState/.gitignore
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState/README.AGENTS_OS.md
Test-Path %WORKSPACE_PARENT%/VCPToolBox-JENN-LocalState/receipts/README.AGENTS_OS.md
```

Do not use recursive content reads for LocalState validation. Do not run provider calls, bridge calls, external writes, service startup, copy-first, checksum generation, or private content reads as part of S8.

## 13. S8 Validation

S8 validation:

```powershell
$files = @(
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md',
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md'
)
$bad = foreach ($file in $files) {
  Select-String -Path $file -Pattern '[ \t]+$' | ForEach-Object { "${file}:$($_.LineNumber)" }
}
if ($bad) { $bad; exit 1 }
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "Status: GATE_ONLY|LocalState default: private by default|\\.agent_board/|Codex self-review may not unlock|MANIFEST\\.sha256|must not be copied, checksummed, or migrated automatically" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md
git status --short
```

## 14. Rollback

For S8:

- Revert this document and the tracker S8 update.

For a future LocalState skeleton:

- Remove only newly created placeholder skeleton files after verifying the resolved path is inside the approved `VCPToolBox-JENN-LocalState` root.
- Do not delete, rewrite, archive, or clean LocalState private contents.
- Do not delete, rewrite, archive, checksum, migrate, untrack, or stub `.agent_board/**` as a rollback shortcut.

For runtime rollback:

- Disable runtime use by omitting `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, and `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.
- LocalState is not runtime plugin registration state, so no LocalState delete is required to roll back plugin discovery or registration.

## 15. S8 Acceptance

S8 is PASS when:

- this gate document exists;
- LocalState is defined as private-by-default;
- the future LocalState `.gitignore` starts with deny-all plus narrow placeholder allow rules;
- `.agent_board/**` is blocked by default;
- `.agent_board/**` has a separate explicit gate with trigger conditions, confirmation fields, evidence, allowed scope, forbidden scope, and rollback rules;
- `.agent_board/**` is not automatically copied, checksummed, migrated, deleted, untracked, or stubbed;
- no LocalState directory is created;
- no private LocalState or `.agent_board/**` content is read;
- no external package, checksum, runtime env, bridge, provider, service, or clean core code is changed.

S8 does not make M2 PASS. M2 remains PARTIAL until S9 checksum rules are also complete.
