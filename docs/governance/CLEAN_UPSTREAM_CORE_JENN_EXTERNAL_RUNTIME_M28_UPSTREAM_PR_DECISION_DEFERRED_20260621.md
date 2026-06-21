# M28 Upstream PR Decision Deferred

Date: 2026-06-21

Status: DEFERRED_NO_UPSTREAM_REMOTE_WRITE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Related evidence:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M8_UPSTREAM_PR_REBASE_WORKFLOW_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M27_GOVERNANCE_MIGRATION_LEDGER_FINALIZATION_20260621.md`

## 1. Decision

M28 remains DEFERRED.

The user explicitly instructed:

```text
先跳过开 lioensky/VCPToolBox upstream PR
```

The user later tightened the gate:

```text
upstream PR的开启只会在我们整个计划已经实现了，稳定运转了，才有意义去开启，先在我们本地实现整个计划
```

Therefore no upstream PR is opened, updated, drafted, commented on, or otherwise created by this route. Upstream PR creation is not only missing authorization; it is also blocked until full local implementation and stable-operation evidence exist.

## 2. What Was Not Done

```text
Upstream PR opened: no
Upstream branch pushed: no
Upstream issue/comment/tag/release/workflow updated: no
lioensky/VCPToolBox remote write: no
Jenn runtime overlay proposed upstream: no
M8/S25 completed: no
M28 counted as PASS: no
Full local implementation + stable-operation PR gate passed: no
```

## 3. Local Completion And Authorization Required To Resume

To resume M8/S25 or M28, the following must happen in order:

1. The whole local plan intended for upstream consideration is implemented in the Jenn fork/local route, not only documented as taskbooks.
2. Stable-operation evidence exists for the implemented route, using an agreed validation window or equivalent repeatable validation evidence.
3. Any deferred local domains are either completed or explicitly declared out-of-scope for the upstream payload.
4. After those gates pass, a future current-turn authorization must explicitly state:

```text
target repository: lioensky/VCPToolBox or another exact repo
source branch: exact branch name
base branch: exact branch name
action: open upstream PR
PR mode: draft or ready
```

Explicit authorization alone is not sufficient before the full-local-implementation and stable-operation gates pass.

Ambiguous continuation phrases such as `继续`, `自动推进`, `来吧`, or `go ahead` are not enough to authorize upstream PR creation.

## 4. Current Handling

- M8 remains PARTIAL at `0.7 / 1` global milestone unit.
- M28 remains DEFERRED and counts `0` global milestone units.
- M29 may still perform Jenn fork maintenance closeout because active Jenn fork maintenance domains M9-M27 are PASS and M28 is explicitly deferred.
- M29 closeout is not proof that the whole plan is locally implemented or stably operating.

## 5. Rollback

No remote rollback is required because no upstream remote action occurred.

Rollback this M28 record by reverting this document and the tracker M28/S49 evidence update.

## 6. Safety Confirmations

```text
Runtime code modified: no
Remote upstream PR opened: no
Remote upstream branch pushed: no
Remote upstream comment/issue/tag/release/workflow updated: no
Full local implementation + stable-operation PR gate passed: no
Provider call executed: no
Bridge live write executed: no
LocalState/private content read: no
.agent_board content read/copied/checksummed/migrated: no
Delete/untrack/stub executed: no
Deployment executed: no
```
