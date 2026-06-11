# Gate 18｜AIGentOrchestrator Shadow Activation Plan

## Status

Gate 18 is a documentation-only shadow activation plan.

This gate does not activate the external `AIGentOrchestrator` copy. It does not change resolver
priority, runtime behavior, plugin dispatch, environment configuration, Plugin Store behavior, or
the sealed external package contents.

## Scope

Gate 18 defines the future path from a sealed external copy to a possible shadow activation
candidate.

The sealed external copy remains:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

The core source of truth remains:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

This document only records the planning boundary, required future gates, validation expectations,
rollback model, and open questions.

## Non-goals

- No Gate 19 or Gate 20 work.
- No shadow activation execution.
- No external plugin priority change.
- No external `AIGentOrchestrator` activation.
- No core `AIGentOrchestrator` deletion or move.
- No core plugin code edit.
- No external plugin code edit.
- No external plugin recopy.
- No runtime behavior change.
- No `Plugin.js` change.
- No `modules/pluginRootResolver.js` change.
- No `server.js` or route change.
- No persistent env activation.
- No temporary env discovery.
- No `.env` or `config.env` edit.
- No `processToolCall` execution.
- No server or provider startup.
- No provider or network call.
- No Plugin Store live install, uninstall, or update.
- No LocalState writes.
- No secrets, logs, cache, outputs, or generated artifacts written.
- No push, PR, merge, release, deploy, or npm publish.

## Sealed context

Gate 17 sealed an external package copy of `AIGentOrchestrator` after verifying:

- the core repo stayed on `main` at `43a4da6098971d0157c5715d70685e09775edbfd`;
- the core worktree stayed clean;
- the external copy contained only the expected four copied files;
- no forbidden config, secret, log, cache, output, `node_modules`, or `ToolConfigs` content was copied;
- the source and target file hashes matched;
- the core original was preserved;
- LocalState remained marker-only;
- temporary-env discovery passed during Gate 17;
- duplicate-name behavior preserved core-first protection;
- no plugin command, provider, server, or Plugin Store live operation was executed.

The Gate 17 seal receipt is:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\receipts\GATE_17_AIGENT_ORCHESTRATOR_EXTERNAL_COPY_SEAL_RECEIPT_20260612.md
```

## Current external copy state

The external copy is a sealed duplicate-name package candidate. It is not active by default.

Expected external files:

```text
AIGentOrchestrator.js
config.env.example
plugin-manifest.json
README.md
```

The external copy is useful as a future comparison and discovery target. It is not currently a
runtime replacement for the core plugin.

## Current resolver constraint

The resolver contract remains default-off and allowlist-gated:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=<path>\VCPToolBox-JENN-Extensions\Plugin
```

The package root itself is not the legacy plugin discovery root:

```text
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions
```

is incompatible with the recommended nested `Plugin` layout unless a future separately reviewed
runtime patch changes discovery behavior.

Core-first ordering and same-name override prevention are sealed contracts. Because the core
`AIGentOrchestrator` has the same plugin name and remains first, the external copy must not become
active while the core original remains first unless a future separately authorized cutover strategy
changes that state safely.

## Definition of shadow activation

Shadow activation means a future, non-production validation state where the external copy is
compared, discovered, or evaluated as a candidate without becoming the executable runtime plugin.

For this project, shadow activation must mean:

- metadata comparison before execution;
- temporary discovery checks before runtime registration claims;
- no core-first bypass;
- no same-name override bypass;
- no plugin command execution;
- no provider or downstream agent execution;
- no persistent env activation;
- no Plugin Store live install or uninstall;
- no deletion or disabling of the core original.

Shadow activation is not a cutover. It is not production activation.

## Why Gate 18 does not activate anything

Gate 18 is a plan gate. It does not activate the external `AIGentOrchestrator` because the current
safe state depends on:

- core-first ordering;
- duplicate-name external override prevention;
- default-off external roots;
- no persistent external-root env;
- no runtime or resolver behavior changes;
- preserved core original as rollback source.

Activating the external copy would require a separate high-risk review of discovery, registration,
execution dispatch, rollback, and operator-facing behavior. Gate 18 intentionally stops before that
boundary.

## Shadow activation ladder

```text
L0: External copy exists and is sealed.
    Current state after Gate 17.

L1: Shadow plan exists.
    Gate 18 target.

L2: Shadow metadata comparison gate.
    Future only. Compare manifests, tool names, descriptions, config templates, and expected
    runtime entry shape. No activation.

L3: Temporary shadow discovery gate.
    Future only. Use temporary process env only. Confirm resolver behavior and duplicate-name
    protection. No processToolCall, no server startup, and no provider calls.

L4: Cutover strategy RFC.
    Future only. Choose whether the external copy stays shadow-only, is renamed for parallel
    testing, waits for core removal/disablement, or requires a future runtime feature flag.

L5: Cutover dry run.
    Future only. Exercise the chosen cutover model without production activation and with a concrete
    rollback path.

L6: Real cutover.
    Future only. High-risk, separate authorization required.
```

## Denied activation paths

These shortcuts are explicitly rejected:

- making the external same-name plugin override core by a priority trick;
- deleting the core plugin without a rollback plan;
- moving the core plugin before shadow validation is complete;
- editing `modules/pluginRootResolver.js` to prefer external roots by default;
- weakening core-first ordering;
- bypassing same-name override prevention;
- persisting env activation before cutover review;
- testing by executing `processToolCall`;
- starting `server.js` or a provider to prove discovery;
- using Plugin Store live install or uninstall as a migration shortcut;
- copying real secrets, runtime logs, cache, outputs, or operator state into the external package;
- writing LocalState as part of shadow activation planning.

## Future cutover options

Future gates may evaluate one of these options. Gate 18 chooses none of them.

| Option | Description | Main risk | Gate 18 stance |
| --- | --- | --- | --- |
| A | Keep core plugin active and external copy shadow-only. | No execution parity proof. | Safest default. |
| B | Rename external plugin for parallel non-overriding tests. | Name and command identity may diverge from production plugin. | Candidate for later RFC. |
| C | Remove or disable core plugin in a controlled cutover. | High rollback and operator-impact risk. | Requires separate high-risk gate. |
| D | Add a runtime feature flag or resolver mode. | Runtime behavior change and policy expansion. | Forbidden unless separately approved. |

## Recommended future gate sequence

```text
Gate 19｜AIGentOrchestrator Shadow Metadata Comparison
- compare core and external manifests
- compare tool names, descriptions, entry commands, and config expectations
- compare README/operator warnings
- confirm copied external files still match the sealed source baseline or record intentional drift
- no activation

Gate 20｜Temporary Shadow Discovery Dry Run
- temporary process env only
- no processToolCall
- no server startup
- no provider calls
- confirm resolver behavior
- confirm LocalState is not discovered
- confirm same-name external copy remains shadow-only while core exists

Gate 21｜Cutover Strategy RFC
- choose one cutover strategy:
  A. keep core plugin and external shadow only
  B. rename external plugin for parallel testing
  C. remove or disable core only in a separately authorized cutover
  D. runtime feature flag, if explicitly approved later

Gate 22+｜Actual Cutover Trial
- high-risk gate
- separate authorization
- concrete rollback plan required
```

No future gate listed above is executed by Gate 18.

## Future validation matrix

| Validation area | Future proof required | Minimum gate |
| --- | --- | --- |
| Manifest parity | Core and external manifests are compared and differences are intentional. | Gate 19 |
| Entry shape | External entry command matches the expected plugin shape without execution. | Gate 19 |
| Config template | `config.env.example` contains no live secrets and matches intended defaults. | Gate 19 |
| External root mapping | `VCP_PLUGIN_DIRS` points to `VCPToolBox-JENN-Extensions\Plugin`. | Gate 20 |
| Package root boundary | `VCPToolBox-JENN-Extensions` itself is not treated as the plugin root. | Gate 20 |
| LocalState boundary | `VCPToolBox-JENN-LocalState` is not discovered as plugin code. | Gate 20 |
| Core-first order | Core plugin remains before external roots until cutover. | Gate 20 |
| Duplicate protection | External same-name copy cannot override the core plugin while core exists. | Gate 20 |
| No execution | No `processToolCall`, provider, downstream agent, or server startup occurs. | Gate 20 |
| Rollback | Restoring the prior state is possible without touching LocalState. | Gate 21 |
| Operator impact | Operator-facing behavior and approval expectations are reviewed before cutover. | Gate 21 |

## Future rollback model

Rollback must be defined before any cutover gate.

For shadow-only gates:

- clear temporary env from the current process;
- keep the core plugin unchanged;
- keep the external copy unchanged unless the gate explicitly created a disposable comparison copy;
- do not touch LocalState;
- do not delete Gate 17 receipts.

For a future cutover gate:

- preserve a verified copy of the core plugin or a clean revert path;
- define how plugin discovery returns to core-first behavior;
- define whether the external copy is disabled, renamed, or removed;
- define how persistent env changes are reverted, if they are ever authorized;
- verify no secrets, logs, cache, outputs, or operator state are lost;
- prove rollback with validation before any production activation claim.

## Risk register

| Risk | Status | Mitigation |
| --- | --- | --- |
| External copy has the same plugin name as core | Expected | Preserve core-first ordering and same-name override prevention until a cutover strategy is approved. |
| Shadow planning is mistaken for activation approval | Open | This document explicitly states Gate 18 does not activate anything. |
| Temporary discovery expands into persistent env | Deferred risk | Gate 18 forbids temporary and persistent env discovery. Future Gate 20 must clean process env. |
| Runtime resolver changes are requested to simplify cutover | Deferred risk | Keep resolver changes out of Gate 18 and require separate high-risk review. |
| Plugin Store live operations become a migration shortcut | Deferred risk | Keep Plugin Store live install/uninstall forbidden until separately reviewed. |
| Downstream agent names in orchestrator plans are mistaken for execution | Open | Future gates must prove plan metadata does not trigger downstream `processToolCall`. |
| LocalState gets coupled to a plugin migration | Open | Keep LocalState marker-only and outside plugin discovery until a specific LocalState policy gate. |

## Required future authorizations

Separate explicit authorization is required for:

- Gate 19 metadata comparison;
- Gate 20 temporary shadow discovery;
- any temporary env discovery;
- any persistent env activation;
- any Plugin Store live install, uninstall, or update;
- any `Plugin.js` or `modules/pluginRootResolver.js` change;
- any `server.js` startup for validation;
- any `processToolCall` execution;
- any provider or network call;
- any core plugin deletion, move, disablement, or rename;
- any external plugin modification after the Gate 17 sealed copy;
- any real cutover trial;
- any push, PR, merge, release, deploy, or npm publish.

## Open questions

- Should the external `AIGentOrchestrator` remain same-name shadow-only until core removal, or
  should a future gate create a renamed parallel candidate?
- Should Gate 19 treat `config.env.example` as part of parity, or should config template policy be
  separated into its own gate?
- Should a future cutover prefer core plugin disablement, external plugin rename, or a runtime feature
  flag if runtime behavior change is ever approved?
- What operator-facing receipt should prove that no downstream agent was executed during temporary
  discovery?
- Should there be a baseline guard after Gate 18 to prevent the plan from being silently removed?

## Boundary confirmation

Gate 18 does not start Gate 19.

Gate 18 does not execute shadow activation.

Gate 18 does not make the external plugin active.

Gate 18 does not delete or move the core plugin.

Gate 18 does not modify the external plugin.

Gate 18 does not change runtime behavior.

Gate 18 does not change `Plugin.js`.

Gate 18 does not change `modules/pluginRootResolver.js`.

Gate 18 does not change `server.js` or routes.

Gate 18 does not perform temporary env discovery.

Gate 18 does not activate env persistently.

Gate 18 does not edit `.env` or `config.env`.

Gate 18 does not use Plugin Store live operations.

Gate 18 does not write LocalState.

Gate 18 does not write secrets, logs, cache, outputs, or generated artifacts.

Gate 18 does not start `server.js`.

Gate 18 does not execute `processToolCall`.

Gate 18 does not call providers.

Gate 18 does not push, open a PR, merge, release, deploy, or npm publish.

## Conclusion

Gate 18 defines a shadow activation plan only.

The external `AIGentOrchestrator` copy remains sealed but inactive. The core `AIGentOrchestrator`
remains the protected runtime source while core-first ordering and same-name override prevention
remain in force.

The next safe gate, if approved separately, should be Gate 19 metadata comparison. Gate 19 should
compare the core and external candidate without activation, without discovery env, and without
executing plugin behavior.
