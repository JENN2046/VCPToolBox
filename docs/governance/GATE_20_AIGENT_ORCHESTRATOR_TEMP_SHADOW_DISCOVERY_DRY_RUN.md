# Gate 20｜AIGentOrchestrator Temporary Shadow Discovery Dry Run

## Status

Gate 20 is a temporary-process-env shadow discovery dry run.

This gate verified that the sealed external `AIGentOrchestrator` copy can be discovered under the
external legacy plugin root contract while remaining shadow-only behind the preserved core
`AIGentOrchestrator`.

Gate 20 did not activate the external copy. It did not execute plugin code, call `processToolCall`,
start `server.js`, call providers, run Plugin Store live operations, persist environment settings,
change runtime behavior, modify resolver behavior, or write to the external package or LocalState.

## Scope

The dry run covered:

- static sealed-state checks;
- temporary `VCP_PLUGIN_*` process environment;
- resolver snapshot behavior;
- legacy manifest discovery records;
- core-first ordering;
- same-name external override prevention;
- external package root boundary;
- LocalState non-discovery;
- Plugin Store install target resolution under temporary env only;
- env and temporary script cleanup.

## Non-goals

- No Gate 21 work.
- No real activation.
- No shadow activation execution.
- No external `AIGentOrchestrator` activation.
- No plugin execution.
- No `processToolCall`.
- No `server.js` startup.
- No provider startup or provider/network call.
- No Plugin Store live install, uninstall, or update.
- No runtime behavior change.
- No `Plugin.js` change.
- No `modules/pluginRootResolver.js` change.
- No `server.js` or route change.
- No persistent env activation.
- No `.env` or `config.env` edit.
- No resolver priority change.
- No core plugin deletion or move.
- No external plugin modification.
- No external package write.
- No external receipt write.
- No LocalState write.
- No secrets, logs, cache, outputs, or generated artifacts written.
- No push, PR, merge, release, deploy, npm publish, or force push.

## Sealed context

Gate 17 sealed the external `AIGentOrchestrator` copy under:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

Gate 18 documented the shadow activation ladder.

Gate 19 statically compared the sealed external copy with the preserved core source and found the
copied files metadata-equivalent.

Current core anchor before Gate 20:

```text
Branch: main
HEAD / origin/main: 38f64bd5ea46bae66e444e59cbf8273452ff764d
Worktree: clean
```

Gate 20 created the local working branch:

```text
codex/gate-20-aigent-orchestrator-temp-shadow-discovery-dry-run-20260612
```

## Compared / discovered paths

Core plugin:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

External package root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
```

External legacy plugin discovery root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

External sealed copy:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

External no-op placeholder:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\NoopJennExternalPlugin
```

Gate 17 seal receipt:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\receipts\GATE_17_AIGENT_ORCHESTRATOR_EXTERNAL_COPY_SEAL_RECEIPT_20260612.md
```

LocalState:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
```

## Temporary env strategy

Gate 20 used temporary process environment values only:

```text
VCP_PLUGIN_ALLOWED_ROOTS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

The preflight check found no pre-existing `VCP_PLUGIN_*` variables in the shell.

The values were set inside a guarded PowerShell `try` block and removed in `finally`.

Post-run `Get-ChildItem Env:VCP_PLUGIN_* -ErrorAction SilentlyContinue` returned no variables.

No `.env`, `config.env`, project config, shell profile, or persistent environment store was edited.

## Temporary script policy

A temporary script was used because the existing test suite proves fixture behavior but does not
record real external `AIGentOrchestrator` discovery classification.

Temporary script path:

```text
A:\AGENTS_OS_Workspace\runtime\_gate20_tmp\gate20-shadow-discovery.mjs
```

The script was outside:

- the core repo;
- `VCPToolBox-JENN-Extensions`;
- `VCPToolBox-JENN-LocalState`.

The script imported only `modules/pluginRootResolver.js` and read `Plugin.js` source text for the
duplicate-name skip guard. It did not import or execute `AIGentOrchestrator.js`.

The script did not call `processToolCall`, start `server.js`, call providers, perform Plugin Store
live operations, write LocalState, or write the external package.

Cleanup result:

```text
Test-Path A:\AGENTS_OS_Workspace\runtime\_gate20_tmp
False
```

## Static pre-discovery checks

The required sealed paths existed:

- core `AIGentOrchestrator`;
- external package root;
- external `Plugin` root;
- external `AIGentOrchestrator`;
- external `NoopJennExternalPlugin`;
- Gate 17 seal receipt;
- LocalState root.

Expected external `AIGentOrchestrator` files were present:

```text
AIGentOrchestrator.js
config.env.example
plugin-manifest.json
README.md
```

Forbidden external file scan returned no results for:

```text
^.env$
config.env
secret
token
credential
.log
cache
output
node_modules
ToolConfigs
```

LocalState remained marker-only:

```text
README.AGENTS_OS.md
cache\README.AGENTS_OS.md
logs\README.AGENTS_OS.md
outputs\README.AGENTS_OS.md
receipts\README.AGENTS_OS.md
secrets\README.AGENTS_OS.md
```

No real logs, cache files, outputs, secrets, generated artifacts, or operator state were observed.

## Discovery method

Gate 20 used the existing resolver/discovery contract:

- `createPluginRootResolver`;
- `getPluginRootSnapshot`;
- `discoverAdminLegacyManifestRecords`;
- `discoverLegacyManifestRecordsFromRoot`;
- `getPluginStoreInstallRoot`;
- `pathKey`.

The temporary script also read `Plugin.js` source text to confirm the duplicate-name runtime skip
guard remains present:

```text
if (this.plugins.has(manifest.name)) {
    this._warnDuplicateLocalPluginSkipped(manifest, this.plugins.get(manifest.name));
    continue;
}
```

The dry run did not call `PluginManager.loadPlugins()` and did not register or execute any plugin.

## Resolver behavior results

The resolver accepted the external allowed root and external legacy plugin discovery root.

Snapshot legacy load roots:

| Order | Root ID | Source | Root path |
| ---: | --- | --- | --- |
| 1 | `core:legacy` | `core` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin` |
| 2 | `external:1` | `external` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin` |

External legacy roots:

| Root ID | Source | Root path | `allowConfigEnv` |
| --- | --- | --- | --- |
| `external:1` | `external` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin` | `false` |

Resolver diagnostics were empty.

## Core-first ordering result

Core-first ordering remained intact.

`legacyLoadRoots[0]` was `core:legacy`.

`legacyLoadRoots[1]` was `external:1`.

The discovered core `AIGentOrchestrator` record appeared before the external
`AIGentOrchestrator` record.

## Same-name override prevention result

The dry run found two manifest records named `AIGentOrchestrator`:

| Source | Root ID | Display path |
| --- | --- | --- |
| `core` | `core:legacy` | `[core]/AIGentOrchestrator` |
| `external` | `external:1` | `[external]/AIGentOrchestrator` |

The external record appeared after the core record.

The duplicate-name skip guard remains present in `Plugin.js`.

Therefore the same-name external copy remains prevented from overriding the core plugin under the
current core-first discovery and registration contract.

## Shadow-only result

The external `AIGentOrchestrator` was detected/classified as an external manifest record, but it did
not become active.

Shadow-only evidence:

- core same-name record exists;
- core same-name record is discovered first;
- external same-name record is discovered later;
- duplicate-name skip guard remains present;
- no plugin registration path was executed by Gate 20;
- no `processToolCall` was executed;
- no server/provider was started.

## LocalState result

LocalState was not discovered as plugin code.

No discovered record path started with:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
```

LocalState remained marker-only and received no writes.

## Plugin Store install target result

Under temporary env only, `getPluginStoreInstallRoot()` resolved to the external legacy plugin root:

| Field | Value |
| --- | --- |
| `mode` | `external` |
| `source` | `external` |
| `rootId` | `external:1` |
| `rootPath` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin` |
| `allowConfigEnv` | `false` |

No Plugin Store live install, uninstall, update, package download, or file operation was performed.

## Env cleanup result

Temporary env was cleaned up.

Post-cleanup command:

```text
Get-ChildItem Env:VCP_PLUGIN_* -ErrorAction SilentlyContinue
```

Result:

```text
no variables returned
```

No env/config persistence occurred.

## Findings

Gate 20 verified that the corrected Gate 9 / Gate 11 layout works for the real sealed external
`AIGentOrchestrator` copy when configured with:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<path>\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=<path>\VCPToolBox-JENN-Extensions\Plugin
VCP_PLUGIN_INSTALL_DIR=<path>\VCPToolBox-JENN-Extensions\Plugin
```

The external package root itself was not treated as a nested plugin root. Direct discovery from:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
```

returned no `AIGentOrchestrator` manifest records.

`NoopJennExternalPlugin` remained discoverable as the external placeholder under the external
`Plugin` root.

The real external `AIGentOrchestrator` remained shadow-only because the core same-name plugin was
discovered first and the duplicate skip guard remains in force.

## Risk assessment

| Risk | Status | Mitigation |
| --- | --- | --- |
| External same-name copy is discoverable | Expected | Core-first ordering and duplicate skip keep it shadow-only. |
| Temporary env could leak into later commands | Mitigated | Env was cleared in `finally` and verified absent afterward. |
| Temporary script could persist outside core | Mitigated | `_gate20_tmp` was deleted and `Test-Path` returned `False`. |
| Discovery evidence could be mistaken for activation | Open | This report states no registration, execution, server, provider, or Plugin Store live operation occurred. |
| Future activation still lacks a cutover strategy | Open | Defer to Gate 21 cutover strategy RFC. |

## Future Gate 21 recommendation

Recommended next gate, if separately authorized:

```text
Gate 21｜AIGentOrchestrator Cutover Strategy RFC
```

Gate 21 should remain documentation/planning first and decide whether to:

- keep the external copy same-name and shadow-only;
- create a renamed external parallel candidate for non-overriding tests;
- design a controlled core disable/remove cutover with rollback;
- or postpone any runtime activation until additional governance exists.

Gate 21 should not be started automatically by Gate 20.

## Boundary confirmation

Gate 20 did not start Gate 21.

Gate 20 did not execute plugin code.

Gate 20 did not execute `processToolCall`.

Gate 20 did not start `server.js`.

Gate 20 did not perform provider startup or provider calls.

Gate 20 did not make the external plugin active.

Gate 20 did not change external plugin priority.

Gate 20 did not delete or move the core plugin.

Gate 20 did not modify the external plugin.

Gate 20 did not change runtime behavior.

Gate 20 did not change `Plugin.js`.

Gate 20 did not change `modules/pluginRootResolver.js`.

Gate 20 did not change `server.js` or routes.

Gate 20 did not activate env persistently.

Gate 20 did not edit `.env` or `config.env`.

Gate 20 did not perform Plugin Store live install, uninstall, or update.

Gate 20 did not write LocalState.

Gate 20 did not write the external package.

Gate 20 did not write external receipts.

Gate 20 did not write secrets, logs, cache, outputs, or generated artifacts.

Gate 20 did not push, open a PR, merge, release, deploy, or npm publish.

## Conclusion

Gate 20 used temporary env only and verified the real sealed external `AIGentOrchestrator` can be
detected under the external `Plugin` root while remaining shadow-only behind the preserved core
plugin.

The env was cleaned up. The temporary script was deleted. The external package and LocalState were
not modified.

Gate 20 dry run is ready for review, not sealed.
