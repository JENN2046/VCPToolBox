# Gate 16 | First Real External Plugin Migration RFC

## Status

Gate 16 is a documentation-only RFC checkpoint.

This gate performed static inspection only. It did not migrate any plugin, copy plugin code, move
plugin files, delete plugin files, activate env configuration, run Plugin Store operations, start
the server, execute plugin commands, call providers, release, deploy, publish, or push.

## Scope

This RFC decides the safest first real plugin migration candidate for a future Jenn external
package trial after:

- Gate 8 locked the external root resolver contract.
- Gate 9 defined the external package layout contract.
- Gate 11 defined the future external package skeleton.
- Gate 12 created the real external package and LocalState skeleton marker directories.
- Gate 14 created `NoopJennExternalPlugin` as an inert external placeholder.
- Gate 15 verified that the real placeholder is discoverable through temporary process env.

The future target package remains:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

The private local state root remains:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
```

## Non-goals

- No real plugin migration.
- No copying plugin implementation code.
- No moving plugin files.
- No deleting plugin files.
- No runtime behavior change.
- No `Plugin.js` change.
- No `modules/pluginRootResolver.js` change.
- No `server.js` or route change.
- No persistent env activation.
- No `.env` or `config.env` edit.
- No Plugin Store live install, uninstall, or update.
- No LocalState writes.
- No secrets, logs, cache, outputs, or generated artifacts written.
- No plugin execution or `processToolCall`.
- No provider call.
- No release, deploy, npm publish, or push.

## Current Sealed Context

The core repo remains the source of runtime policy:

- Core plugin discovery remains owned by `Plugin.js`.
- External root policy remains owned by `modules/pluginRootResolver.js`.
- External package discovery remains default-off and allowlist-gated.
- The recommended external layout still requires `VCP_PLUGIN_DIRS` to point at
  `VCPToolBox-JENN-Extensions\Plugin`, not the package root.
- `VCPToolBox-JENN-LocalState` is not a plugin root by default.
- Duplicate external plugin names must not override core plugin names.

Gate 16 should make Gate 17 safer by selecting a low-risk migration candidate and defining the
future validation and rollback path.

## Candidate Inspection Method

Static inspection covered plugin manifests, entry files, existing governance contracts, and external
root tests. The inspection criteria were:

- secret exposure risk
- external service dependency
- default write behavior
- provider execution behavior
- runtime coupling
- LocalState coupling
- plugin manifest simplicity
- import-time side effects
- testability
- rollback simplicity
- suitability as first real external migration

No plugin command was executed.

## Candidate Decision Matrix

| Candidate | Static evidence | Main risk | First-candidate fit |
| --- | --- | --- | --- |
| `AIGentOrchestrator` | Manifest describes a dry-run orchestration planner. Entry uses Node stdio. Config defaults keep `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false` and `AIGENT_ORCHESTRATOR_DEFAULT_MODE=dry-run`. Code builds pipeline/retry plans and reports `real_workflow_invoked=false`, `real_training_invoked=false`, and `external_service_called=false`. No filesystem writes, network calls, provider calls, or LocalState dependency were observed in static inspection. | It references downstream agent names in planned steps, so future migration must prove packaging does not imply downstream execution. | Best first real migration candidate. |
| `AIGentQuality` | Manifest describes rule-based dry-run inspection and external vision disabled by default. | Entry reads image files and walks directories for inspection; this introduces file-read and LocalState/path policy questions. | Good second candidate, not first. |
| PhotoStudio read/draft/audit class | Manifests commonly declare `PHOTO_STUDIO_DATA_DIR` and local-shadow project/customer/delivery behavior. | Tied to local private state, JSON stores, project records, queues, and Photo Studio data policy. | Defer until LocalState inventory and policy. |
| `AIGentWorkflow` | Manifest depends on `ComfyUIGen` and `AIGentPrompt`, has `COMFYUI_BASE_URL`, and describes workflow execution. | Workflow/provider/backend coupling and potential image generation path. | Not first. |
| `AIGentPrompt` | Depends on knowledge/RAG components. | Knowledge-base and prompt library coupling; less self-contained than orchestrator. | Not first. |
| `AIGentStyle` | Has dataset/output roots and optional write paths for manifests/jobs/captions. | Local file writes and future training execution boundary. | Not first. |
| `ImageAutoRegister` | Service plugin shape and image catalog/registration behavior. | Service/runtime and image metadata state coupling. | Not first. |
| `ImageRatingManager` | Contains SQLite-backed image rating state and agent write commands. | Local database/state migration risk. | Not first. |
| `CodexMemoryBridge` | Memory bridge writes audit logs and uses execution context. | Memory/state/audit boundary. | Not first. |
| `DoubaoGen` | Provider plugin with API key configuration, network calls, cache/image writes, and generation commands. | Secrets, provider execution, external network, image outputs. | Not first. |
| `DingTalk*` | Live-service integration and write-capable commands. | Credentials, external service writes, gray-stage policy. | Not first. |
| `VCPBridgeServer` | Service plugin with bridge enablement, upstream URL/key, and server behavior. | Bridge runtime and upstream proxy risk. | Not first. |

## Recommended First Real Migration Candidate

Recommended first real migration candidate: `AIGentOrchestrator`.

This recommendation is limited to a future copy trial. It does not authorize migration in Gate 16.

## Why This Candidate Is First

`AIGentOrchestrator` is the smallest useful real plugin candidate because:

- Its manifest states it is a dry-run orchestration planner.
- Its default safety gate keeps execution disabled.
- Its default mode is `dry-run`.
- Its code builds plan objects and safety metadata instead of invoking downstream plugins.
- Static inspection found no filesystem write path.
- Static inspection found no network/provider call path.
- Static inspection found no LocalState dependency.
- It does not require Plugin Store behavior.
- It should exercise real external plugin packaging without immediately exercising image providers,
  live-service connectors, bridge services, SQLite state, or Photo Studio data.
- Rollback for a future copy trial should be limited to deleting the copied external candidate while
  preserving the core original.

The main caution is that the generated plan names downstream agents such as `AIGentPrompt`,
`AIGentWorkflow`, `AIGentStyle`, and `AIGentQuality`. A future migration gate must prove those
references remain plan metadata and do not cause downstream execution.

## Why Other Candidates Are Deferred

`AIGentQuality` is deferred because it reads image files and walks directories. It remains a good
candidate after LocalState/path policy is clearer.

Photo Studio read/draft/audit plugins are deferred because they are tied to `PHOTO_STUDIO_DATA_DIR`
and local-shadow records. They need a LocalState inventory and rollback policy before migration.

`AIGentWorkflow`, provider plugins, and image generation plugins are deferred because they are closer
to generation backends, provider execution, or external service calls.

`AIGentStyle` is deferred because static inspection shows dataset/output roots and write-capable
paths for generated planning artifacts.

`ImageAutoRegister` and `ImageRatingManager` are deferred because they connect to image catalog
state, services, or SQLite-backed state.

`CodexMemoryBridge` is deferred because memory writes and audit logs require a separate memory
boundary review.

`DingTalk*` plugins are deferred because they cross live-service and credential boundaries.

`VCPBridgeServer` is deferred because it is a service/proxy boundary and not an appropriate first
external migration trial.

## Future Gate 17 Migration Path

Suggested future gate:

```text
Gate 17 | AIGentOrchestrator External Package Copy Trial
```

Gate 17 should require separate authorization and should:

- copy `Plugin\AIGentOrchestrator` into
  `VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator`
- preserve the core original
- not delete any core plugin files
- not persist env activation unless separately authorized
- use temporary process env only for discovery verification
- verify the external copy is discoverable from the external `Plugin` root
- verify core-first ordering still protects the core plugin name
- verify duplicate-name behavior blocks external override while the core original exists
- decide whether a future non-duplicate external name or staged core removal is needed before
  runtime registration can be safely exercised
- avoid `processToolCall` unless separately authorized
- avoid Plugin Store live install/uninstall
- avoid provider calls and downstream plugin execution
- rollback by deleting only the copied external candidate

Because the core original has the same plugin name, Gate 17 must treat duplicate-name behavior as a
feature to verify, not as a failure to bypass.

## Future Validation Matrix

Future migration validation should prove:

- external root configuration points to `VCPToolBox-JENN-Extensions\Plugin`
- external package root itself is not treated as the plugin root
- LocalState is not discovered
- `AIGentOrchestrator` external copy is discoverable as a manifest record
- the core original remains first
- duplicate external copy cannot override the core plugin
- no plugin command is executed during discovery
- external copy contains no real secrets or generated state
- no LocalState writes occur
- no env/config persistence occurs
- no `Plugin.js` or `modules/pluginRootResolver.js` behavior change is needed
- rollback removes only the copied external candidate

Suggested validation commands for a future gate:

```text
git status --short
node --test tests/plugin-external-dirs.test.js
npm run test:baseline
temporary-env discovery check for the external copy
```

Do not start `server.js`, call providers, run Plugin Store operations, or execute
`processToolCall` unless a later gate explicitly authorizes those actions.

## Rollback Plan

For Gate 16:

- Revert this documentation commit or delete
  `docs/governance/GATE_16_FIRST_REAL_EXTERNAL_PLUGIN_MIGRATION_RFC.md`.

For future Gate 17:

- Delete only the copied external candidate under
  `VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator`.
- Keep the core original unchanged.
- Clear only temporary process env used for verification.
- Do not touch LocalState.
- Do not edit core runtime files.

## Risk Register

| Risk | Status | Mitigation |
| --- | --- | --- |
| External copy duplicates a core plugin name | Expected future risk | Verify core-first and duplicate-blocking behavior before any runtime registration claim. |
| Plan metadata could be mistaken for downstream execution | Open | Gate 17 must inspect and document that no downstream command is executed during discovery. |
| Future external packaging might accidentally include config/state | Open | Copy trial must exclude real `config.env`, logs, cache, outputs, and private state unless separately authorized. |
| External process plugins are trusted local child processes | Existing runtime reality | Keep migration default-off and avoid command execution in first real copy trial. |
| Plugin Store behavior remains unexercised | Deferred | Keep Plugin Store live install/uninstall out of Gate 17 unless separately reviewed. |

## Open Questions

- Should the first external real copy keep the same plugin name to test duplicate protection only, or
  use a deliberately suffixed name for a later runtime registration test?
- Should a future Gate 17 copy include `config.env.example`, or should the first copy be limited to
  manifest, README, and entry source?
- Should runtime registration ever be tested before core removal, or should it remain discovery-only
  until a dedicated de-duplication/removal gate?
- Should a baseline guard be added after this RFC to keep the first-candidate decision from being
  silently changed?

## Boundary Confirmation

Gate 16 performed no real plugin migration.

Gate 16 copied no plugin code.

Gate 16 moved no plugin files.

Gate 16 deleted no plugin files.

Gate 16 changed no runtime behavior.

Gate 16 activated no env.

Gate 16 did not edit `.env` or `config.env`.

Gate 16 did not touch Plugin Store live operations.

Gate 16 did not write LocalState.

Gate 16 did not start `server.js`.

Gate 16 did not execute `processToolCall`.

Gate 16 did not call providers.

Gate 16 did not release, deploy, npm publish, or push.

## Conclusion

Recommended first real migration candidate: `AIGentOrchestrator`.

Gate 16 should be treated as a decision lock only. The next implementation gate should be a
separately authorized `AIGentOrchestrator` external package copy trial that preserves the core
original and verifies discovery, core-first order, duplicate protection, and rollback without
executing plugin behavior.
