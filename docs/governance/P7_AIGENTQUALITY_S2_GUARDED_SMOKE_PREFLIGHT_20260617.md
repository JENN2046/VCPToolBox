# P7 AIGentQuality S2 Guarded Smoke Preflight

Date: 2026-06-17
Status: preflight/receipt only. This gate does not start `server.js`, import
`server.js`, spawn a server child process, bind a port, execute
`JennAIGentQualityTrial`, create runtime state, or authorize a real guarded
smoke.

## 1. Goal

The extraction track has already proved three local layers:

- the minimal S2 harness dry-run runner;
- the guarded-smoke plan receipt;
- the preload guard synthetic probe.

This gate adds a parent preflight receipt that aggregates those three reviewed
receipts before any real server smoke is considered. The point is to prove that
the next S2 boundary has a stable evidence shape without crossing into runtime
activation.

## 2. Scope

The companion script is:

```text
scripts/aigentquality-server-smoke-s2-guarded-preflight.js
```

It may:

- load the exported `buildReceipt()` functions from the three existing S2
  local gates;
- call them with controlled argument lists;
- validate their result names, review-evidence flags, and safety assertions;
- print a parent receipt.

It must not:

- run `node server.js`;
- import `server.js`;
- spawn a server child process;
- bind any TCP port;
- execute the external plugin;
- write runtime files;
- call provider or network APIs.

## 3. Required Child Receipts

The parent preflight requires these child results:

```text
minimalHarnessDryRun: S2_HARNESS_DRY_RUN_READY
guardedSmokePlan: S2_GUARDED_SMOKE_PLAN_READY
preloadGuardProbe: S2_PRELOAD_GUARD_PROBE_READY
```

For default clean-mode evidence, each child receipt must also keep all server
safety assertions false. The guarded plan must still report
`guardedSmokeReadiness.ready: false`, because this parent gate is not real S2
execution approval.

## 4. Dirty Worktree Policy

Default mode requires reviewed clean evidence. Any core worktree change blocks
`S2_GUARDED_SMOKE_PREFLIGHT_READY`, and the external package worktree must be
clean.

For local branch development only:

```text
--allow-dev-dirty-preflight
```

allows the preflight implementation files and the small child-gate development
allowlist updates needed to run the combined receipt before commit. In that
mode, the parent receipt can still report `S2_GUARDED_SMOKE_PREFLIGHT_READY`,
but `reviewEvidenceUsable` is false. Reviewed gate evidence requires default
clean mode after the branch is committed.

## 5. Receipt Shape

The parent receipt must include at least:

```text
mode: aigentquality-s2-guarded-smoke-preflight
result: S2_GUARDED_SMOKE_PREFLIGHT_READY | S2_GUARDED_SMOKE_PREFLIGHT_BLOCKED
authorization.realServerStartAuthorized: false
authorization.serverImportAuthorized: false
authorization.serverSpawnAuthorized: false
safetyAssertions.startedServer: false
safetyAssertions.importedServer: false
safetyAssertions.spawnedServer: false
safetyAssertions.boundPort: false
safetyAssertions.executedPlugin: false
safetyAssertions.wroteRuntimeFiles: false
safetyAssertions.networkOrProviderCalls: false
dirtyWorktreePolicy.reviewEvidenceUsable: boolean
childGateSummary: result and safety summary for each child gate
guardedSmokeReadiness.ready: false
blockedReasons: array
```

## 6. Local Validation

Syntax:

```powershell
node --check scripts\aigentquality-server-smoke-s2-guarded-preflight.js
```

Development receipt before commit:

```powershell
node scripts\aigentquality-server-smoke-s2-guarded-preflight.js --json --allow-dev-dirty-preflight
```

Reviewed clean-mode receipt after commit:

```powershell
node scripts\aigentquality-server-smoke-s2-guarded-preflight.js --json
```

Strict inventory receipt:

```powershell
node scripts\aigentquality-server-smoke-s2-guarded-preflight.js --json --strict-clean
```

Whitespace:

```powershell
git diff --check -- scripts/aigentquality-server-smoke-s2.js scripts/aigentquality-server-smoke-s2-guarded-plan.js scripts/aigentquality-server-smoke-s2-preload-guards.js scripts/aigentquality-server-smoke-s2-guarded-preflight.js docs/governance/P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PREFLIGHT_20260617.md
```

Expected current-branch development result:

```text
preflight receipt: S2_GUARDED_SMOKE_PREFLIGHT_READY with --allow-dev-dirty-preflight
reviewEvidenceUsable: false
real server start: not run
```

Expected clean result after commit:

```text
preflight receipt: S2_GUARDED_SMOKE_PREFLIGHT_READY
reviewEvidenceUsable: true
real server start: not run
```

## 7. Next Boundary

The next gate may add the real guarded-smoke harness entrypoint only after this
preflight receipt is reviewed in clean mode, strict inventory is clean, and the
user explicitly authorizes S2 guarded smoke execution. Until then, this track
continues to stop before `server.js` import, process spawn, and listen.
