# P7 AIGentQuality S2 Preload Guards Minimal Probe

Date: 2026-06-16

Status: preload guard primitive implementation and synthetic probe only. This
gate does not start `server.js`, import `server.js`, spawn a server child
process, bind a real server port, execute `JennAIGentQualityTrial`, create a
temp run root, write runtime state, read operator images, or call providers.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. The previous guarded-smoke plan named the required guard shape.
This step starts turning that shape into local preload guard primitives while
still refusing the real server startup path. It reduces risk before the future
server smoke by proving that the guard layer can block synthetic repository
reads, directory reads, writes, watches, child process execution, copy writes,
and non-localhost listens.

## 2. Artifacts

Created or updated artifacts:

```text
tests/harness/aigentquality-server-smoke-preload.js
scripts/aigentquality-server-smoke-s2-preload-guards.js
docs/governance/P7_AIGENTQUALITY_S2_PRELOAD_GUARDS_MINIMAL_20260616.md
```

The preload still refuses accidental real startup when
`VCP_AIGENTQUALITY_S2_HARNESS_CONFIG` is present at top level. The new
`installPreloadGuards()` function is callable only through direct test harness
code in this gate, and the probe uninstalls all monkeypatches before returning.

## 3. Allowed In This Gate

- install guard primitives in the current test process;
- run synthetic blocked operations against reviewed repository paths;
- verify the guard blocks repository config reads;
- verify the guard blocks repository directory enumeration;
- verify the guard blocks `runRoot` symlink read/write/watch escapes;
- verify the guard blocks repository writes and copy writes;
- verify the guard blocks symlink creation;
- verify the guard blocks `fs.watch`;
- verify the guard blocks child process execution;
- verify the guard blocks implicit-host and non-localhost `http.Server.listen`
  overloads, including missing or non-explicit option ports;
- emit a receipt.

## 4. Not Allowed In This Gate

- `node server.js`;
- `npm start`;
- importing `server.js`;
- spawning a server child process;
- binding a real server port;
- creating a temp run root;
- writing any runtime or operator file;
- executing plugin commands;
- reading operator image directories;
- calling provider, workflow, OCR, generation, moderation, CLIP, or OpenPose
  services.

## 5. Probe Receipt

The probe receipt must show:

```text
mode: aigentquality-s2-preload-guard-probe
preloadGuardProbeAuthorized: true
realServerStartAuthorized: false
startedServer: false
importedServer: false
spawnedServer: false
boundPort: false
executedPlugin: false
wroteRuntimeFiles: false
networkOrProviderCalls: false
result: S2_PRELOAD_GUARD_PROBE_READY
```

The nested synthetic probe must show:

```text
mode: aigentquality-s2-preload-guard-synthetic-probe
result: PRELOAD_GUARD_PROBE_READY
block repository config read: blocked
block repository directory read: blocked
block runRoot symlink read escape: blocked
block repository write: blocked
block runRoot symlink write escape: blocked
block runRoot symlink watch escape: blocked
block symlink creation: blocked
block promises symlink creation: blocked
block promises copy destination write: blocked
block repository watch: blocked
block child process spawn: blocked
block implicit listen host: blocked
block non-localhost listen: blocked
block options implicit listen host: blocked
block options non-localhost listen: blocked
block options undefined listen port: blocked
block options null listen port: blocked
```

The parent runner also requires the blocked event API list to include
`fs.promises.copyFile:to`, so the copy probe proves the destination write guard
and not only a missing source read.

The parent runner also requires blocked `http.Server.listen` events for both
implicit host and `0.0.0.0` host overloads. The guard is fail-closed for
`listen(port)`, `listen(port, callback)`, path/fd/handle overloads, and options
objects that do not explicitly specify TCP `port` plus `localhost`, `127.0.0.1`,
or `::1`.

The read, write, and watch guards must resolve existing targets or their nearest
existing parent before allowing `runRoot` access. A path that is textually under
`runRoot` but resolves outside that root is blocked, and link/symlink creation
is forbidden after guard installation. The listen guard treats `undefined`,
`null`, empty, NaN, and out-of-range option ports as non-explicit ports.

## 6. Dirty Worktree Policy

Default mode requires the probe script, preload harness, and this document to
be clean before reporting `S2_PRELOAD_GUARD_PROBE_READY`.

During local development only, use:

```powershell
node scripts/aigentquality-server-smoke-s2-preload-guards.js --json --allow-dev-dirty-guards
```

Receipts produced with `--allow-dev-dirty-guards` must report
`reviewEvidenceUsable: false`. Reviewed gate evidence requires the default clean
mode after these files are committed.

## 7. Validation

Planned validation:

```powershell
node --check tests/harness/aigentquality-server-smoke-preload.js
node --check scripts/aigentquality-server-smoke-s2-preload-guards.js
node tests/harness/aigentquality-server-smoke-preload.js
node scripts/aigentquality-server-smoke-s2-preload-guards.js --json --allow-dev-dirty-guards
node scripts/aigentquality-server-smoke-s2-preload-guards.js --json --execute-server --allow-dev-dirty-guards
node scripts/aigentquality-server-smoke-s2-guarded-plan.js --json --allow-dev-dirty-plan
node scripts/aigentquality-server-smoke-s2.js --json --allow-dev-dirty-harness
git diff --check -- tests/harness/aigentquality-server-smoke-preload.js scripts/aigentquality-server-smoke-s2-preload-guards.js docs/governance/P7_AIGENTQUALITY_S2_PRELOAD_GUARDS_MINIMAL_20260616.md
```

Expected result:

```text
preload syntax: pass
probe syntax: pass
preload contract self-test: CONTRACT_READY
guard probe: S2_PRELOAD_GUARD_PROBE_READY with --allow-dev-dirty-guards
execute-server negative probe: S2_PRELOAD_GUARD_PROBE_BLOCKED
existing guarded plan: may block while this gate is uncommitted
server start: no
server import: no
server spawn: no
plugin execution: no
provider/network call: no
```

## 8. Next Boundary

The next implementation gate may connect these guard primitives to the future
child-process harness config path, add startup module stubs, and begin proving
receipt ordering. Do not run a real child-process server smoke until the preload
guard/stub chain is reviewed, strict inventory is clean, and the user explicitly
authorizes S2 guarded smoke execution.
