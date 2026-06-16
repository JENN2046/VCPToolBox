# P7 AIGentQuality S2 Minimal Harness Dry-Run

Date: 2026-06-16

Status: minimal implementation dry-run only. This gate creates the future S2
runner and preload artifact names, but it does not start `server.js`, import
`server.js`, spawn a server child process, bind a port, execute
`JennAIGentQualityTrial`, edit persistent env files, call providers, read image
inputs, or authorize a real server listen smoke.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. The previous S2 preplan proved the static prerequisites for a
future isolated server smoke. This dry-run creates the reviewed harness file
shape and proves the parent verifier can build a clean child-env plan and
validate a fail-closed preload contract without activating the server runtime.

## 2. Artifacts

Created artifacts:

```text
scripts/aigentquality-server-smoke-s2.js
tests/harness/aigentquality-server-smoke-preload.js
docs/governance/P7_AIGENTQUALITY_S2_MINIMAL_HARNESS_DRY_RUN_20260616.md
```

The parent runner defaults to dry-run receipt mode. The preload is currently a
contract-only module: it exports the required guard, stub, and PluginManager
patch lists for review, and it refuses accidental real server preload startup
when `VCP_AIGENTQUALITY_S2_HARNESS_CONFIG` is present.

## 3. Dry-Run Boundaries

Allowed in this gate:

- validate core and external repository heads;
- validate the external `JennAIGentQualityTrial` manifest identity;
- inventory sensitive ignored runtime/config artifacts without reading their
  contents;
- build a replacement child-env plan without spreading `process.env`;
- validate that secret-like child env keys are absent except explicit fake
  local-only values;
- validate the preload contract and fail-closed default;
- print a receipt.

Not allowed in this gate:

- `node server.js`;
- `npm start`;
- importing `server.js`;
- spawning a child server process;
- binding a port;
- executing a plugin;
- reading operator image directories;
- writing runtime state;
- using real provider credentials.

## 4. Receipt Expectations

The dry-run receipt must show:

```text
mode: aigentquality-s2-minimal-harness-dry-run
dryRunAuthorized: true
realServerStartAuthorized: false
branch policy: record-only; not tied to the temporary author branch
harness files clean by default: true
startedServer: false
importedServer: false
spawnedServer: false
boundPort: false
executedPlugin: false
networkOrProviderCalls: false
child env built without spreading process.env: true
preload contract validates: true
result: S2_HARNESS_DRY_RUN_READY
```

The receipt may still include `realS2BlockedReasons`, because this gate proves
only the parent runner and contract preload. Hidden ignored runtime/config
artifacts are recorded under `git.*.ignoredRuntimeStatusEntries` and
`realS2Readiness`; by default they do not prevent this contract dry-run from
proving the harness file shape. Run the parent with `--strict-clean` when the
goal is to fail the dry-run on any sensitive ignored runtime artifact before a
future real S2 attempt.

The current branch name is receipt evidence only. The dry-run remains portable
after merge to `main` or another clean checkout as long as the expected baseline
commit is an ancestor of `HEAD`; it must not depend on the temporary author
branch name.

The reviewed harness files must be clean by default. Local edits to the parent
runner, preload, or this implementation note must block `S2_HARNESS_DRY_RUN_READY`
unless the caller explicitly passes `--allow-dev-dirty-harness` during local
development. Do not use that flag as evidence for a reviewed S2 gate.

A real listen smoke remains a later explicit authorization boundary.

## 5. Validation

Planned validation:

```powershell
node --check scripts/aigentquality-server-smoke-s2.js
node --check tests/harness/aigentquality-server-smoke-preload.js
node tests/harness/aigentquality-server-smoke-preload.js
node scripts/aigentquality-server-smoke-s2.js --json
node scripts/aigentquality-server-smoke-s2.js --json --allow-dev-dirty-harness
node scripts/aigentquality-server-smoke-s2.js --json --strict-clean
git diff --check -- scripts/aigentquality-server-smoke-s2.js tests/harness/aigentquality-server-smoke-preload.js docs/governance/P7_AIGENTQUALITY_S2_MINIMAL_HARNESS_DRY_RUN_20260616.md
```

Expected result:

```text
preload self-test: CONTRACT_READY
parent dry-run: S2_HARNESS_DRY_RUN_READY
local dirty harness dry-run: requires --allow-dev-dirty-harness and is not reviewed-gate evidence
strict clean: may block if this operator checkout contains ignored runtime/config artifacts
server start: no
server import: no
server spawn: no
plugin execution: no
provider/network call: no
```

## 6. Next Boundary

The next review may either keep iterating the contract-only preload, or
explicitly authorize a guarded real S2 child-process smoke. Do not run the real
server path until the preload installs the reviewed guards and stubs rather than
only documenting the contract.
