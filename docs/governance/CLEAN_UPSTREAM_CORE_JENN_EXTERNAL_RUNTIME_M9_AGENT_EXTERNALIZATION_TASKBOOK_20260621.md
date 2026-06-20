# M9 Agent Externalization Taskbook

Date: 2026-06-21

Status: TASKBOOK_ONLY_NO_COPY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related contracts:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S9_MANIFEST_CHECKSUM_RULES_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M0_BASELINE_INVENTORY_SECRET_RISK_EVIDENCE_20260621.md`

## 1. Purpose

M9 starts the next Jenn externalization domain: Agent content.

This taskbook prepares the copy-first plan for future reviewed Agent externalization. It does not copy Agent files, create external Agent directories, change runtime loaders, modify env files, activate overrides, or migrate LocalState.

## 2. Hard Boundaries

M9 taskbook-only work must not:

- copy `Agent/**` into `VCPToolBox-JENN-Extensions`;
- create `Agent/` or `AgentOverrides/` in the external package;
- read Agent file contents beyond path-only inventory;
- read, copy, checksum, migrate, delete, untrack, or stub `.agent_board/**`;
- read or copy LocalState/private/operator data;
- modify `.env`, `config.env`, secrets, tokens, credentials, or auth material;
- change runtime Agent loader behavior;
- activate `VCP_AGENT_DIRS` or `VCP_AGENT_OVERRIDE_DIRS`;
- delete, untrack, or stub core Agent files;
- open upstream PRs, deploy, release, call providers, call bridges, or perform live external writes.

## 3. Current Agent Path Inventory

Path-only inventory collected on 2026-06-21:

| Ref | Agent path count | Risk path count | Role |
| --- | ---: | ---: | --- |
| `origin/main` | 16 | 0 | Jenn fork reference |
| `origin/codex/upstream-main-clean-base` | 9 | 0 | clean-base reference |
| `HEAD` | 16 | 0 | current Jenn governance branch |
| `VCPToolBox-JENN-Extensions` `Agent/` + `AgentOverrides/` | 0 | 0 | future external target; not created |

Diff from clean-base to Jenn fork:

```text
M  Agent/.gitignore
A  Agent/AIImageGenExpert.txt
A  Agent/AuditMaster.txt
A  Agent/MemoriaSorter.txt
M  Agent/Metis.txt
A  Agent/Muse.txt
M  Agent/Nova.txt
A  Agent/动力猛兽.txt
A  Agent/小秋.txt
A  Agent/诺宝.txt
```

Path-only interpretation:

- Additive Agent candidates: `AIImageGenExpert`, `AuditMaster`, `MemoriaSorter`, `Muse`, `动力猛兽`, `小秋`, `诺宝`.
- Override candidates requiring exact-id override review: `Metis`, `Nova`.
- `Agent/.gitignore` is policy/config surface, not an Agent identity.
- No path-only risk pattern matched `Agent/**` in the scanned refs.

This inventory is not content review and not parity proof.

## 4. Future External Layout

Target external package root:

```text
%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions
```

Future Agent source lanes:

```text
Agent/
  reviewed additive Agent files only

AgentOverrides/
  reviewed exact-id overrides only
```

Do not use LocalState, `.agent_board/**`, plugin roots, or AdminPanel extension roots as Agent roots.

## 5. Copy-First Gate

Before any Agent copy-first operation, the future task must provide:

| Gate | Required evidence |
| --- | --- |
| Source ref pin | exact source ref and commit, usually Jenn fork reference commit |
| Target ref pin | exact external package branch and commit before copy |
| Candidate list | exact Agent path list split into additive and override lanes |
| Content review scope | reviewer confirms each Agent file is source/package material, not private state |
| S7 denylist applied | env/config/auth/cache/log/output/db/vector/image/state exclusions reused |
| Paths-only secret-risk scan | source candidate paths clean before copy |
| Copy receipt | copied paths, excluded paths, and no-delete confirmation |
| Target path scan | external package target paths clean after copy |
| Checksum | `manifests/MANIFEST.sha256` regenerated and verified after scan |
| Runtime status | no loader activation unless a separate Agent runtime implementation is reviewed |
| Rollback | omit `VCP_AGENT_DIRS` / `VCP_AGENT_OVERRIDE_DIRS`, or revert external package copy commit |

Copy-first order:

```text
1. Pin source and target commits.
2. Build exact candidate path list.
3. Run paths-only source risk scan.
4. Apply S7 denylist and copy only reviewed Agent source/package files.
5. Run target/package paths-only risk scan.
6. Regenerate package checksum.
7. Write receipt.
8. Only then consider future runtime loader validation.
```

## 6. Additive Lane

Additive lane means external Agents that do not replace a clean-base Agent id.

Current additive candidates from path diff:

```text
Agent/AIImageGenExpert.txt
Agent/AuditMaster.txt
Agent/MemoriaSorter.txt
Agent/Muse.txt
Agent/动力猛兽.txt
Agent/小秋.txt
Agent/诺宝.txt
```

Future additive validation must prove:

- no duplicate Agent id conflicts with clean-base Agent ids;
- external Agent files remain disabled unless `VCP_AGENT_DIRS` is explicitly configured;
- unset `VCP_AGENT_DIRS` keeps core behavior unchanged;
- external Agent path scan and checksum pass.

## 7. Override Lane

Override lane means external files that intentionally replace exact clean-base Agent ids.

Current override candidates from path diff:

```text
Agent/Metis.txt
Agent/Nova.txt
```

Future override validation must prove:

- `VCP_AGENT_OVERRIDE_DIRS` is used only for exact Agent ids;
- each override receipt names source id, target id, source commit, target commit, checksum, and rollback;
- unset `VCP_AGENT_OVERRIDE_DIRS` keeps clean-base Agent files active;
- broad override directories, wildcard ids, and implicit duplicate replacement are blocked.

## 8. Required Future Tests

Taskbook-only M9 does not add tests.

Future Agent runtime implementation should add targeted tests before activation:

```text
Agent root resolver rejects paths outside allowed external package roots.
Unset VCP_AGENT_DIRS preserves core Agent list.
VCP_AGENT_DIRS adds reviewed additive Agents without overriding core ids.
VCP_AGENT_OVERRIDE_DIRS overrides exact ids only.
Duplicate Agent ids are blocked unless explicit override lane is configured.
LocalState and .agent_board paths are rejected as Agent roots.
Agent source/package checksum verification is separate from runtime behavior proof.
```

Do not run provider calls, bridge calls, service startup, or live external writes as Agent validation.

## 9. Stop Conditions

Stop and do not copy if:

- any candidate path matches env/config/auth/secret/token/cache/log/output/image/db/vector/state rules;
- `.agent_board/**` appears in candidate, checksum, or target package paths;
- LocalState/private/operator data is required;
- a candidate requires reading secret/auth material;
- Agent ids cannot be split into additive versus override lanes;
- runtime loader changes are required before the copy-first receipt exists;
- rollback cannot be performed by omitting Agent env vars or reverting the external package copy commit.

## 10. Rollback

M9 taskbook rollback:

```text
revert this taskbook and tracker update
```

Future Agent copy-first rollback:

```text
unset VCP_AGENT_DIRS
unset VCP_AGENT_OVERRIDE_DIRS
revert the external package Agent copy commit
keep core Agent files unchanged
```

No runtime rollback is required for M9 because it does not change code, env, external package contents, LocalState, `.agent_board/**`, or upstream PR state.

## 11. Validation

M9 validation is documentation and path-only inventory:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M9_AGENT_EXTERNALIZATION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "TASKBOOK_ONLY_NO_COPY|VCP_AGENT_DIRS|VCP_AGENT_OVERRIDE_DIRS|Additive Agent candidates|Override lane|LocalState|\\.agent_board|No runtime rollback" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M9_AGENT_EXTERNALIZATION_TASKBOOK_20260621.md
git -c core.quotePath=false diff --name-status "origin/codex/upstream-main-clean-base..origin/main" -- Agent
git status --short
```
