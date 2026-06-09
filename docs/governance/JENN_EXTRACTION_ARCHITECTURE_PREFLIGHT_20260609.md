# Jenn Extraction Architecture Preflight - 2026-06-09

This package opens the next Jenn extraction architecture track as a docs-only
preflight.

It does not modify runtime code, configuration, secrets, state, cache, logs,
AdminPanel build output, Agent files, plugin files, LocalState data, branch
remotes, PRs, deployments, or production services.

## 1. Context

| Item | Value |
| --- | --- |
| Workspace | `A:/AGENTS_OS_Workspace/runtime/VCPToolBox` |
| Starting branch | `main` |
| Package branch | `codex/extraction-architecture-preflight-20260609` |
| Package type | docs-only architecture preflight |
| Current merged track | external legacy plugin discovery, safety classifier, allow policy helper, and registration enforcement preflight |

The extraction track has already established a narrow plugin externalization
spine:

- `VCP_PLUGIN_DIRS` discovers external legacy plugin directories.
- External legacy manifests are labelled with `pluginSource: "external"`.
- Built-in legacy plugins are discovered before external legacy plugins.
- Existing duplicate-name behavior keeps the first loaded plugin.
- G1/G2 helper modules classify external manifests and evaluate explicit
  allow-policy shape.
- G2B preflight identifies that external registration enforcement must happen
  before external `config.env` is read and before `_registerLocalPlugin()`.

This architecture preflight maps the remaining extraction surfaces before any
new loader, migration, deletion, or runtime behavior is implemented.

## 2. Current Architecture Facts

### Plugin Layer

`Plugin.js` currently owns both modern and legacy plugin discovery.

Current relevant flow:

1. `_discoverModernPluginManifests()` reads `plugins/registry.json`, then reads
   modern plugin manifests under `plugins/`.
2. `_discoverLegacyPluginManifestsFromDir(root, sourceLabel)` reads
   `Plugin/*/plugin-manifest.json` for built-ins and external legacy roots.
3. `_discoverLegacyPluginManifests()` appends external legacy manifests after
   built-in legacy manifests.
4. `_registerLocalPlugin()` stores each manifest and may `require()` direct
   script preprocessors or services during registration.
5. `loadPlugins()` resets local plugin state, discovers modern plugins, then
   legacy plugins, then initializes registered modules.

Architecture consequence:

- Plugin extraction has a registration/load boundary before execution dispatch.
- External plugin authorization must remain at discovery/registration time.
- Execution dispatch must remain unchanged unless a later explicit package opens
  that high-risk surface.

### Agent Layer

`modules/agentManager.js` currently uses:

- a single `agent_map.json`;
- a single active Agent directory, defaulting to `Agent/`;
- `AGENT_DIR_PATH` resolution in `server.js` and `adminServer.js`;
- recursive scanning for `.txt` and `.md` Agent files;
- cache invalidation and watchers for the active Agent directory and map file.

Architecture consequence:

- Agent extraction is not the same as plugin extraction.
- Agent prompts are content and operator behavior, not executable plugin
  manifests.
- Any future external Agent directory support needs an explicit map/precedence
  design before implementation.

### AdminPanel Layer

`adminServer.js` currently hosts the Vue AdminPanel build from:

```text
AdminPanel-Vue/dist
```

It also mounts authenticated admin API routes and keeps legacy route
compatibility. `server.js` redirects `/AdminPanel` to the separate admin process
port.

Architecture consequence:

- AdminPanel extraction is a UI/runtime-extension problem, not a plugin
  manifest problem.
- AdminPanel extension loading would touch authentication, routing, frontend
  asset trust, and build/release boundaries.
- It should stay observe/design-only until plugin and Agent boundaries are
  stable.

### LocalState And Runtime Data Layer

Current runtime/state-sensitive surfaces include:

- `state/`;
- `cache/`;
- `DebugLog/`;
- `image/`;
- `dailynote/`;
- plugin-specific caches, SQLite files, vector stores, and operator data;
- `.env`, `config.env`, plugin config files, credentials, and tokens.

Architecture consequence:

- LocalState migration is a data-governance problem, not a code-loader problem.
- It must not be bundled with plugin, Agent, or AdminPanel extraction.
- Any migration requires an explicit source/target inventory, backup plan,
  sensitive-data handling rules, dry-run, rollback path, and human approval.

## 3. Extraction Architecture Model

The extraction architecture should use four independent lanes.

| Lane | Current status | First safe package | Implementation gate |
| --- | --- | --- | --- |
| Plugin | in progress | registration enforcement review | external registration behavior change |
| Agent | not started | readonly Agent external-directory design | enabling external Agent loading |
| AdminPanel | observe only | readonly extension-loader design | loading external UI/routes/assets |
| LocalState | observe only | readonly risk/inventory assessment | copying, moving, deleting, or migrating private state |

The lanes share governance evidence, but they should not share implementation
packages. A bug or rollback in one lane must not require reverting another lane.

## 4. Recommended Dependency Order

1. Finish plugin registration safety before expanding other external loaders.
2. Add Agent external-directory design only after plugin source/allow evidence is
   stable.
3. Add AdminPanel extension-loader design only after Agent and plugin boundaries
   are clear.
4. Keep LocalState migration observe-only until all loader boundaries are stable
   and a separate migration authorization exists.

Rationale:

- Plugin registration can load code and expand tool surface.
- Agent prompts alter model behavior but should not execute code directly.
- AdminPanel extensions can affect authenticated operator surfaces and route
  trust.
- LocalState contains private/operator data and needs the strictest migration
  controls.

## 5. Shared Evidence Contract

Future extraction lanes should converge on path/name/source evidence without
recording secrets or raw runtime data.

Suggested shared evidence fields:

```ts
{
  surface: "plugin" | "agent" | "admin-panel" | "local-state",
  sourceKind: "built-in" | "external" | "runtime" | "unknown",
  requestedName: string | null,
  canonicalName: string | null,
  basePath: string | null,
  relativePath: string | null,
  decision: "observe" | "would_allow" | "would_block" | "allowed" | "blocked",
  reasons: string[]
}
```

Evidence must not include:

- raw `.env` or `config.env` values;
- tokens, passwords, API keys, cookies, auth codes, webhook URLs;
- raw Agent prompt bodies unless the package explicitly reviews prompt content;
- operator/private state content;
- runtime request bodies or tool arguments.

## 6. Future Package Split

### A1 - Agent External Directory Design

Docs-only.

Expected questions:

- Should the map remain single-source, or support layered maps?
- Do built-in Agent aliases always win over external aliases?
- Should external Agent paths require name + source-directory allow policy?
- How should symlinks and path traversal be handled?
- Should watchers cover external directories by default?

No implementation in A1.

### A2 - Agent External Directory Audit-Only Classifier

Pure local helper and tests only.

No Agent loading behavior change.

### B1 - AdminPanel Extension Loader Design

Docs-only.

Expected questions:

- What is an extension: static asset, route module, menu item, admin API, or
  build-time plugin?
- How are extensions authenticated?
- Can extensions define routes, or only frontend navigation entries?
- How are CSP, asset paths, and package integrity handled?
- Does this belong in the main process, admin process, or build pipeline?

No implementation in B1.

### C1 - LocalState Risk Inventory

Read-only inventory only.

Expected questions:

- Which paths are source, generated cache, runtime state, private operator data,
  or secrets?
- Which paths are safe to relocate, mirror, ignore, or never touch?
- What backup and rollback artifact is required?
- What validation proves no private data leaked into Git?

No copy, move, delete, archive, restore, or migration in C1.

### P-next - Plugin Registration Enforcement

Separate from this architecture package.

If explicitly approved later, continue from the G2B preflight and keep scope to:

- `Plugin.js`;
- existing external plugin safety/allow helpers;
- focused inert manifest tests.

Do not couple plugin enforcement to Agent, AdminPanel, or LocalState work.

## 7. Stop Conditions

Stop before any change that would:

- modify `Plugin.js`, `server.js`, `adminServer.js`, `modules/agentManager.js`,
  or admin routes;
- read or write real `.env`, `config.env`, token, credential, runtime, state,
  cache, log, image, dailynote, SQLite, vector-store, or operator data;
- execute real plugin entrypoints, shell/file/bridge tools, or external writes;
- enable external Agent directories;
- enable AdminPanel extensions;
- copy, move, delete, stub, or replace plugin, Agent, AdminPanel, or LocalState
  content;
- change `ToolApprovalManager` or plugin execution dispatch;
- add dependencies or change lockfiles;
- commit, push, open PRs, merge, deploy, or write to remote services without
  explicit approval.

## 8. Validation Plan

For this docs-only architecture preflight:

```powershell
git diff --name-status
git diff --stat
git diff --check
```

No runtime tests are required because no source behavior changes.

## 9. Rollback

Rollback is deleting this document or reverting the docs-only commit/PR that
contains it.

No runtime cleanup should be required because this package does not modify
runtime behavior or move data.

## 10. Recommended Next Step

After review, choose exactly one next lane:

1. continue Plugin G2B implementation review;
2. start A1 readonly Agent external-directory design;
3. start B1 readonly AdminPanel extension-loader design;
4. start C1 readonly LocalState risk inventory.

Do not combine lanes in one implementation package.
