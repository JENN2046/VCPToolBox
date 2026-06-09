# Jenn Extraction Agent External Directory Design - 2026-06-09

This package is docs-only. It opens A1 from the Jenn extraction architecture
track and does not modify Agent loading behavior.

It does not modify `modules/agentManager.js`, `server.js`, `adminServer.js`,
`agent_map.json`, Agent prompt files, runtime state, secrets, config files,
AdminPanel routes, plugin loading, branch remotes, PRs, deployments, or
production services.

## 1. Context

| Item | Value |
| --- | --- |
| Workspace | `A:/AGENTS_OS_Workspace/runtime/VCPToolBox` |
| Starting branch | `main` at PR #229 merge |
| Package branch | `codex/agent-external-directory-design-20260609` |
| Package type | docs-only Agent external-directory design |
| Prior package | `JENN_EXTRACTION_ARCHITECTURE_PREFLIGHT_20260609.md` |

The architecture preflight split extraction into four independent lanes:

1. Plugin registration/loading;
2. Agent external directories;
3. AdminPanel extensions;
4. LocalState/runtime data.

This document covers only lane 2. It does not authorize copying, moving,
deleting, or enabling external Agent content.

## 2. Current Local Reality

Current Agent loading is centered on `modules/agentManager.js`.

Observed facts:

- `agent_map.json` is the only alias-to-file map.
- `server.js` and `adminServer.js` resolve one active Agent directory through
  `AGENT_DIR_PATH`, defaulting to `Agent/`.
- `agentManager.setAgentDir(AGENT_DIR)` selects that single directory before
  initialization.
- `AgentManager.loadMap()` reads `agent_map.json` and clears prompt cache.
- `AgentManager.scanAgentFiles()` recursively scans the selected Agent
  directory for `.txt` and `.md` files.
- `AgentManager.watchFiles()` watches `agent_map.json` and the selected Agent
  directory.
- `AgentManager.getAgentPrompt(alias)` resolves aliases through `agent_map.json`
  and reads the mapped prompt file from the selected Agent directory.
- Symlinks are followed for prompt reads and recursive scans.

Current limitations:

- There is no layered Agent directory list.
- There is no external Agent source label.
- There is no external Agent allow policy.
- There is no override-map protocol.
- There is no path-only audit evidence for Agent source selection.

## 3. Design Goals

- Keep built-in Agent behavior unchanged when no new env vars are set.
- Add future support for external Agent directories without changing prompt
  content in this package.
- Preserve a conservative precedence model where built-in aliases remain stable
  unless an explicit override lane is configured.
- Keep prompt content out of audit evidence by default.
- Make future behavior testable without reading real private Agent prompts.
- Keep Agent externalization independent from plugin registration and
  AdminPanel extension work.

## 4. Non-Goals

This design does not authorize:

- enabling `VCP_AGENT_DIRS`;
- enabling `VCP_AGENT_OVERRIDE_DIRS`;
- changing `agent_map.json`;
- copying Agent files into external directories;
- moving or deleting existing `Agent/*.txt`;
- generating override prompts;
- reading or printing real Agent prompt bodies;
- changing AdminPanel Agent file APIs;
- changing plugin execution or `ToolApprovalManager`;
- changing LocalState handling.

## 5. Proposed Future Surfaces

Future implementation should use two separate env surfaces:

```text
VCP_AGENT_DIRS=../VCPToolBox-JENN-Extensions/Agent
VCP_AGENT_OVERRIDE_DIRS=../VCPToolBox-JENN-Extensions/AgentOverrides
```

`VCP_AGENT_DIRS` should add new external Agent files and maps.

`VCP_AGENT_OVERRIDE_DIRS` should be a stricter lane for intentional overrides of
built-in aliases or prompt files. Override behavior should never be implied by
ordinary external Agent directories.

## 6. Recommended Precedence Model

Future Agent loading should use explicit layers:

| Layer | Source | Purpose | Default precedence |
| --- | --- | --- | --- |
| 1 | built-in `Agent/` + `agent_map.json` | upstream/core Agent behavior | wins by default |
| 2 | external Agent dirs | add new Jenn Agents | cannot override built-in aliases |
| 3 | external override dirs | intentional Jenn overrides | may override only with explicit override evidence |

Recommended rules:

- Built-in aliases remain exact and stable.
- External Agent directories may add aliases that do not exist in the built-in
  map.
- External Agent directories must not silently override a built-in alias.
- Override directories may override only when the override file/map names the
  target alias explicitly.
- Missing external directories should be ignored with path-only evidence.
- Malformed external maps should not break built-in Agent loading.

## 7. Map Protocol Options

Two safe map options are available for future review.

### Option A - Layered Map Files

Each external Agent root may contain:

```text
agent_map.json
```

The map shape stays compatible with the built-in map:

```json
{
  "JennAgent": "JennAgent.txt"
}
```

Pros:

- smallest conceptual change;
- mirrors existing behavior;
- easy to test with inert fixture prompts.

Cons:

- needs explicit source evidence to explain which map supplied an alias;
- needs duplicate handling to avoid silent override.

### Option B - Manifest With Source Metadata

Each external Agent root may contain:

```text
agent-pack.manifest.json
```

Possible shape:

```json
{
  "packId": "jenn.agent-pack",
  "agents": {
    "JennAgent": "JennAgent.txt"
  },
  "overrides": {
    "Metis": "Metis.override.txt"
  }
}
```

Pros:

- clearer distinction between additions and overrides;
- room for future non-secret metadata.

Cons:

- larger design surface;
- requires more migration and docs.

Recommended first implementation later: start with Option A for additions and
reserve Option B or a separate override map for explicit override behavior.

## 8. Path And Symlink Rules

Future implementation should keep path handling conservative:

- Normalize configured roots with `path.resolve()`.
- Resolve mapped prompt paths relative to the Agent root that supplied the map.
- Reject absolute mapped prompt paths by default.
- Reject mapped paths that resolve outside their Agent root.
- Treat symlink traversal as a separate decision.
- If symlinks are supported, record only path/source evidence, not prompt
  content.

Open decision:

- Current code follows symlinks. A future external-Agent package must decide
  whether external roots inherit that behavior or require a stricter default.

Conservative recommendation:

- Built-in Agent roots keep current symlink behavior.
- External Agent roots should initially classify symlinked files as
  `would_block` in audit-only mode until explicitly allowed.

## 9. Suggested Evidence Shape

Future Agent evidence should be path/name/source only:

```ts
{
  surface: "agent",
  alias: "JennAgent",
  sourceKind: "built-in" | "external" | "override",
  mapPath: "agent_map.json",
  basePath: "A:/ReviewedAgents",
  relativePromptPath: "JennAgent.txt",
  decision: "observe" | "would_allow" | "would_block" | "allowed" | "blocked",
  reasons: []
}
```

Evidence must not include:

- Agent prompt body;
- prompt excerpts;
- `.env` or `config.env` values;
- operator/private state content;
- user chat content;
- raw runtime request bodies.

## 10. Future Package Split

### A2 - Agent Directory Audit-Only Classifier

Pure local helper and tests only.

Suggested scope:

```text
modules/agentExternalDirectoryClassifier.js
tests/agentExternalDirectoryClassifier.test.js
docs/governance/JENN_EXTRACTION_AGENT_EXTERNAL_DIRECTORY_DESIGN_20260609.md
```

Expected behavior:

- parse raw directory list supplied by caller;
- classify existing/missing roots;
- parse inert map fixtures;
- detect duplicate aliases;
- detect path traversal and absolute mapped paths;
- return path-only evidence;
- do not read real Agent prompt content.

### A3 - Agent Directory Loader Preflight

Docs-only implementation preflight after A2 is reviewed.

Expected questions:

- exact insertion point in `AgentManager`;
- cache invalidation across layered roots;
- watcher behavior for external roots;
- AdminPanel Agent file listing behavior;
- fallback behavior when external roots fail.

### A4 - Agent Directory Loader Implementation

Requires explicit approval because it changes runtime behavior.

Allowed only after A2/A3:

- modify `modules/agentManager.js`;
- add targeted inert tests;
- keep built-in behavior unchanged when env vars are absent.

## 11. Validation Plan

For this docs-only package:

```powershell
git diff --name-status
git diff --stat
git diff --check
```

For future A2 audit-only helper:

```powershell
node --check modules/agentExternalDirectoryClassifier.js
node --check tests/agentExternalDirectoryClassifier.test.js
node --test tests/agentExternalDirectoryClassifier.test.js
git diff --check
```

Do not run tests that read real private Agent prompt bodies or modify Agent
files.

## 12. Stop Conditions

Stop before any change that would:

- edit `modules/agentManager.js`, `server.js`, `adminServer.js`, or admin
  routes;
- edit `agent_map.json`;
- edit, copy, move, delete, or generate `Agent/*`;
- read or print real Agent prompt bodies;
- enable `VCP_AGENT_DIRS` or `VCP_AGENT_OVERRIDE_DIRS`;
- touch `.env`, `config.env`, runtime, cache, state, dailynote, image, SQLite,
  vector-store, or operator/private data;
- add dependencies or change lockfiles;
- commit, push, open PRs, merge, deploy, or write to remote services without
  explicit approval.

## 13. Rollback

Rollback for this package is deleting this document or reverting the docs-only
commit/PR that contains it.

No runtime cleanup should be required because this package does not change
Agent loading behavior or move prompt content.

## 14. Recommended Next Step

After review, choose one:

1. implement A2 audit-only classifier using inert fixtures;
2. write B1 AdminPanel extension-loader design;
3. write C1 LocalState risk inventory.

Do not implement `VCP_AGENT_DIRS` until A2 and A3 are reviewed.
