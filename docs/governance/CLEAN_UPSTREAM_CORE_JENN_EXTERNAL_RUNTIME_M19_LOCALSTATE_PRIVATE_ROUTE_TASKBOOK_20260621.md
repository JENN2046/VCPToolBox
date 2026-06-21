# M19 LocalState Private-By-Default Route Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_LOCALSTATE_READ

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Source gates:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md`

## 1. Purpose

M19 defines the reviewed route for future LocalState skeleton work.

This taskbook does not create a LocalState directory, read private LocalState contents, enumerate `.agent_board/**`, copy state, generate checksums, enable runtime use, modify env files, or migrate operator data.

## 2. Current Decision

```text
LocalState is private/operator state, not source package content.
LocalState remains excluded by default.
VCP_LOCAL_STATE_DIR is a future path resolver contract only.
.agent_board/** remains separately protected and blocked by default.
Next executable gate: M20 LocalState skeleton / paths-only gate.
```

## 3. Allowed M20 Skeleton Scope

M20 may create only reviewed placeholder files under an approved LocalState root:

```text
VCPToolBox-JENN-LocalState/
  .gitignore
  README.AGENTS_OS.md
  receipts/
    README.AGENTS_OS.md
```

Allowed placeholder file contents:

- public governance text;
- no secrets;
- no operator notes;
- no real config;
- no real runtime data;
- no private memory;
- no `.agent_board/**` data;
- no provider credentials;
- no auth material.

Expected private lanes may be documented but must not be created or populated by M20 unless a later reviewed taskbook explicitly opens them:

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

## 4. Required LocalState `.gitignore`

M20 must start with deny-all plus narrow placeholder allow rules:

```gitignore
# Jenn LocalState default: private by default
*
!.gitignore
!README.AGENTS_OS.md
!receipts/
!receipts/README.AGENTS_OS.md
```

No broad allow rule such as `!*` or `!**/*` may be added in M20.

## 5. Root Separation Rules

LocalState must not be configured as:

```text
VCP_PLUGIN_DIRS
VCP_PLUGIN_ALLOWED_ROOTS
VCP_EXTERNAL_PLUGIN_ALLOWLIST
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
VCP_ADMIN_EXTENSION_DIRS
```

LocalState may only be referenced by a future `VCP_LOCAL_STATE_DIR` resolver after a separate runtime taskbook and tests.

## 6. `.agent_board/**` Gate Matrix

`.agent_board/**` remains blocked by default.

| Planned action | M19/M20 decision |
| --- | --- |
| Mention `.agent_board/**` as a protected literal in governance docs | ALLOW |
| Confirm LocalState `.gitignore` excludes `.agent_board/**` by deny-all rule | ALLOW |
| Check planned skeleton paths do not include `.agent_board/**` | ALLOW |
| Read `.agent_board/**` file contents | BLOCK |
| Enumerate `.agent_board/**` children | BLOCK unless a later exact paths-only gate explicitly allows it |
| Copy `.agent_board/**` | BLOCK |
| Checksum `.agent_board/**` | BLOCK |
| Migrate `.agent_board/**` | BLOCK |
| Archive `.agent_board/**` | BLOCK |
| Delete, untrack, stub, rewrite, or normalize `.agent_board/**` | BLOCK |
| Use `.agent_board/**` as rollback payload | BLOCK |

Unlocking `.agent_board/**` requires a separate current-turn human approval naming exact source root, target root, path subset, operation, whether content reads are allowed, evidence, rollback, and approver.

## 7. M20 Required Preflight

Before M20 creates placeholder files:

```text
core worktree clean or explicitly accounted
target LocalState root path resolved and reviewed
target path verified inside approved workspace parent
no real VCP_LOCAL_STATE_DIR env activation required
no real LocalState/private/operator data read
no .agent_board/** traversal
no provider/bridge/live external write
no production service startup
```

If any preflight item fails, M20 is BLOCK.

## 8. M20 Paths-Only Validation

M20 may validate only the reviewed skeleton path list:

```text
.gitignore
README.AGENTS_OS.md
receipts/README.AGENTS_OS.md
```

Validation must be paths-only and must not recursively inspect LocalState private lanes.

Risk scan must report:

```text
target skeleton path count
target risk path count
.agent_board path count
env/config/auth/secret/token path count
runtime/cache/log/output/db/vector path count
```

Expected M20 pass values:

```text
target risk path count = 0
.agent_board path count = 0
secret/env/auth risk count = 0
runtime/private data copied = no
```

## 9. Stop Conditions

Stop and mark BLOCK if M20 would require:

- reading real LocalState content;
- reading, enumerating, copying, checksumming, migrating, deleting, untracking, stubbing, or archiving `.agent_board/**`;
- touching `.env`, `config.env`, tokens, credentials, auth material, or provider config;
- using LocalState as plugin, Agent, AdminPanel, or external registration root;
- creating runtime private lanes with real data;
- generating a LocalState content checksum;
- bridge writes, provider calls, production service startup, live external writes, or deployments;
- deleting or rewriting existing LocalState/private/operator data.

## 10. M20 Receipt Template

M20 must produce a receipt with:

```text
Status:
Approved skeleton root:
Created placeholder paths:
Paths-only target scan:
Risk path count:
.agent_board path count:
Private data read/copied:
Real env modified:
Provider/bridge/live write executed:
Rollback:
Validation commands:
```

## 11. Rollback

M19 rollback:

```text
revert this taskbook and the tracker M19/S40 update
```

Future M20 rollback:

```text
remove only newly created placeholder files after verifying the resolved target path is inside the approved LocalState skeleton root
do not delete real LocalState private contents
do not delete, rewrite, checksum, migrate, untrack, stub, or archive .agent_board/**
do not use destructive cleanup shortcuts
```

Operational runtime rollback:

```text
unset VCP_LOCAL_STATE_DIR
```

M19 does not set or require `VCP_LOCAL_STATE_DIR`.

## 12. Safety Confirmations

```text
LocalState directory created: no
LocalState content read: no
LocalState content copied: no
.agent_board content read: no
.agent_board copied/checksummed/migrated: no
Real .env/config.env modified: no
Real VCP_LOCAL_STATE_DIR activated: no
Provider call executed: no
Bridge call executed: no
Production service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 13. Validation

M19 validation is documentation-only:

```powershell
git diff --check
rg -n "TASKBOOK_READY_NO_LOCALSTATE_READ|LocalState is private/operator state|VCP_LOCAL_STATE_DIR|\\.agent_board/\\*\\* remains blocked|M20 Receipt Template|LocalState directory created: no|Real VCP_LOCAL_STATE_DIR activated: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M19_LOCALSTATE_PRIVATE_ROUTE_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```
