# M4 Shadow Validation And Rollback Receipt

Date: 2026-06-21

Status: SHADOW_VALIDATION_ROLLBACK_PASS

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

External package evidence:

```text
repo: JENN2046/VCPToolBox-JENN-Extensions
commit: b4f250e
pilot: Plugin/JennAIGentOrchestrator/
manifest: JennAIGentOrchestrator
checksum: manifests/MANIFEST.sha256
```

## 1. Scope

M4 validates the copied `JennAIGentOrchestrator` pilot without production activation.

It verifies:

- external root discovery remains gated;
- discovery does not imply runtime registration;
- exact `name@path` allowlist is required for runtime registration;
- unsafe external direct/hybrid plugins remain blocked;
- the renamed external pilot can run a no-provider `HealthCheck` shadow proof when explicitly allowlisted in process-only env;
- rollback works by removing process-only external env overlay.

M4 does not open an upstream PR, modify runtime code, change real env files, start `server.js`, contact providers, call bridges, write LocalState, or delete/untrack/stub core content.

## 2. Commands Run

```powershell
npm run
node tests/plugin-external-dirs.test.js
node tests/plugin-external-runtime-registration-gate.test.js
node tests/plugin-external-runtime-direct-policy.test.js
node scripts/run-jenn-aigent-orchestrator-plugin-execution-validation-harness.js --stage8-no-provider-external-plugin-execution-proof
node scripts/run-jenn-aigent-orchestrator-rollback-drill-harness.js --stage88-rollback-drill-proof
```

## 3. Results

`node tests/plugin-external-dirs.test.js`:

```text
pass 14
fail 0
```

`node tests/plugin-external-runtime-registration-gate.test.js`:

```text
pass 6
fail 0
```

`node tests/plugin-external-runtime-direct-policy.test.js`:

```text
pass 5
fail 0
```

No-provider Jenn shadow harness:

```text
result: PASS
route: 83B
mode: no-provider
external path resolved: yes
external path exact match: yes
core fallback false: yes
external manifest identity matched: yes
external plugin module loaded: yes
plugin execution attempted: yes
processToolCall called: yes
executePlugin called: yes
plugin handler reached: yes
plugin result sanitized: yes
plugin execution result accepted: yes
provider endpoint contact: no
real image generation invoked: no
image output produced: no
LocalState write: no
server route activation: no
runtime cutover: no
core copy removal: no
exact sanitized blocker category: none
exact sanitized branch: no_provider_plugin_execution_harness
```

Rollback drill harness:

```text
result: PASS
route: 88
mode: rollback-drill-static
Gate 86B sealed: yes
Gate 87 preflight block sealed: yes
rollback target values exact: yes
process-only env overlay built: yes
process env mutated: no
overlay rollback performed: yes
overlay rollback accepted: yes
.env read: no
.env modified: no
config.env read: no
config.env modified: no
Plugin.js modified: no
Plugin directory modified: no
external package modified: no
server route activation: no
http request sent: no
listener started: no
provider endpoint contact: no
real image generation invoked: no
image output produced: no
LocalState write: no
plugin execution attempted: no
processToolCall called: no
executePlugin called: no
runtime cutover performed: no
core copy removal: no
exact sanitized blocker category: none
exact sanitized branch: rollback_drill_process_only_overlay
```

## 4. Disabled And Registration Interpretation

M4 treats default-off as external runtime gate behavior:

- Without `VCP_PLUGIN_ALLOWED_ROOTS`, external roots remain rejected.
- Without exact `VCP_EXTERNAL_PLUGIN_ALLOWLIST`, discovery does not register the external plugin.
- Name-only and path-only runtime allowlists do not register external plugins.
- Exact `JennAIGentOrchestrator@<external-plugin-path>` is required for the no-provider shadow proof.
- Removing process-only env overlay is accepted rollback.

This is not `.disabled`-file evidence. `.disabled` remains only a physical fallback marker and is not counted as manifest discovery proof.

## 5. Safety Confirmations

```text
Clean core runtime code changed: no
PluginManager dispatch changed: no
Real .env/config.env changed: no
Provider endpoint contacted: no
Bridge call executed: no
Live external write executed: no
Server listener started: no
HTTP request sent: no
LocalState write: no
.agent_board read/copy/checksum/migration: no
Core copy delete/untrack/stub: no
Upstream PR opened: no
```

## 6. Rollback

Runtime rollback:

- Omit `VCP_PLUGIN_DIRS`.
- Omit `VCP_PLUGIN_ALLOWED_ROOTS`.
- Omit `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.

Evidence rollback:

- Revert this receipt and the tracker M4 update.
- If needed, revert external package commit `b4f250e` to remove the M3 checksum package evidence.

Do not delete LocalState, `.agent_board/**`, secrets, cache, logs, outputs, DB/vector stores, or source core files as rollback shortcuts.
