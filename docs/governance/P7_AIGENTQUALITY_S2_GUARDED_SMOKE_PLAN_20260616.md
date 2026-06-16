# P7 AIGentQuality S2 Guarded Smoke Minimal Plan

Date: 2026-06-16

Status: guarded smoke plan/preflight only. This gate does not start
`server.js`, import `server.js`, spawn a server child process, bind a port,
execute `JennAIGentQualityTrial`, create a temp run root, edit persistent env
files, read image inputs, call providers, or authorize a real S2 listen smoke.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. The previous S2 dry-run proved the parent runner and fail-closed
preload contract shape. This gate adds a repeatable guarded-smoke plan receipt
that verifies the reviewed guard, stub, PluginManager patch, and future success
evidence lists before any real server process is allowed.

## 2. Artifacts

Created or updated artifacts:

```text
scripts/aigentquality-server-smoke-s2-guarded-plan.js
tests/harness/aigentquality-server-smoke-preload.js
docs/governance/P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PLAN_20260616.md
```

The preload remains fail-closed for real startup. This gate only adds
`buildGuardedSmokePlanReceipt()` and `validateGuardedSmokePlanReceipt()` so a
parent verifier can prove the next guarded smoke shape without installing hooks.

## 3. Authorization Boundary

Allowed in this gate:

- read S0/S1/S2 governance docs;
- read the external `JennAIGentQualityTrial` manifest;
- inspect Git branch, head, dirty worktree, and scoped ignored runtime status;
- require the reviewed S2 dry-run runner and preload only after core dirty
  policy passes;
- build a redacted child-env plan by reusing the reviewed dry-run env builder;
- validate the guarded-smoke plan receipt;
- print a JSON or text receipt.

Not allowed in this gate:

- `node server.js`;
- importing `server.js`;
- spawning a child server process;
- binding a port;
- installing read/write/watch/spawn hooks in the current process;
- creating a temp run root;
- executing plugin commands;
- reading operator image directories;
- calling provider, workflow, OCR, generation, moderation, CLIP, or OpenPose
  services;
- writing runtime state.

## 4. Guarded Plan Receipt

The receipt must show:

```text
mode: aigentquality-s2-guarded-smoke-plan
planAuthorized: true
realServerStartAuthorized: false
startedServer: false
importedServer: false
spawnedServer: false
boundPort: false
executedPlugin: false
networkOrProviderCalls: false
guardInstallImplemented: false
harnessConfigPathUnderRunRoot: true
result: S2_GUARDED_SMOKE_PLAN_READY
guardedSmokeReadiness.ready: false
```

`guardedSmokeReadiness.ready` must stay `false` in this gate because the real
server smoke still requires explicit authorization and implemented fail-closed
guards.

## 5. Required Guard Shape

The guarded plan validates these minimum surfaces from the S1 design:

```text
repository-read-guard
repository-directory-read-guard
repository-write-watch-guard
child-process-spawn-guard
dotenv-config-guard
http-listen-localhost-guard
```

It must also carry the reviewed startup stubs, including:

```text
./modules/toolApprovalManager.js
./modules/semanticModelRouter.js
./routes/adminPanelRoutes.js
./routes/codexOAuthResponses.js
./routes/taskScheduler.js
./modules/sarPromptManager.js
./WebSocketServer.js
./FileFetcherServer.js
```

This step does not claim those stubs are installed. It only proves the future
receipt shape is explicit and reviewable.

## 6. Dirty Worktree Policy

Default mode requires the plan script, guarded plan doc, existing dry-run
runner, and preload to be clean before reporting
`S2_GUARDED_SMOKE_PLAN_READY`.

During local development only, use:

```powershell
node scripts/aigentquality-server-smoke-s2-guarded-plan.js --json --allow-dev-dirty-plan
```

That flag allows only the three current gate artifacts to be dirty:

```text
scripts/aigentquality-server-smoke-s2-guarded-plan.js
tests/harness/aigentquality-server-smoke-preload.js
docs/governance/P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PLAN_20260616.md
```

Any other core worktree change blocks the receipt. The external package
worktree must be clean.

Receipts produced with `--allow-dev-dirty-plan` must report
`reviewEvidenceUsable: false`. Reviewed gate evidence requires the default clean
mode after these files are committed.

Scoped ignored runtime/config artifacts are inventoried without reading
contents. They are recorded as real guarded-smoke blockers by default and block
the plan receipt under `--strict-clean`.

## 7. Validation

Planned validation:

```powershell
node --check scripts/aigentquality-server-smoke-s2-guarded-plan.js
node --check tests/harness/aigentquality-server-smoke-preload.js
node tests/harness/aigentquality-server-smoke-preload.js
node scripts/aigentquality-server-smoke-s2-guarded-plan.js --json --allow-dev-dirty-plan
node scripts/aigentquality-server-smoke-s2-guarded-plan.js --json --strict-clean --allow-dev-dirty-plan
node scripts/aigentquality-server-smoke-s2.js --json --allow-dev-dirty-harness
git diff --check -- scripts/aigentquality-server-smoke-s2-guarded-plan.js tests/harness/aigentquality-server-smoke-preload.js docs/governance/P7_AIGENTQUALITY_S2_GUARDED_SMOKE_PLAN_20260616.md
```

Expected result:

```text
guarded plan syntax: pass
preload syntax: pass
preload self-test: CONTRACT_READY
guarded plan receipt: S2_GUARDED_SMOKE_PLAN_READY with --allow-dev-dirty-plan
strict clean: may block if the operator checkout contains ignored runtime/config artifacts
existing S2 dry-run: may block while this new gate is still uncommitted
server start: no
server import: no
server spawn: no
plugin execution: no
provider/network call: no
```

## 8. Next Boundary

The next implementation gate may replace the plan-only receipt with reviewed
preload hook installation. Do not run a real child-process server smoke until
that guard implementation exists, the core and external worktrees are clean
under strict inventory, and the user explicitly authorizes S2 guarded smoke
execution.
