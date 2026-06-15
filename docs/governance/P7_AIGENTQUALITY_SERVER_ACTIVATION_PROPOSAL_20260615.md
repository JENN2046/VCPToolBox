# P7 AIGentQuality Server Activation Proposal

Date: 2026-06-15

Status: proposal only. This document plans a future server-level runtime
activation proof for `JennAIGentQualityTrial`; it does not authorize starting
`server.js`, changing persistent environment variables, editing loader priority,
copying files, moving files, deleting files, disabling core plugins, scanning
operator image directories, committing, pushing, merging, or deleting branches.

Scope: core `server.js`, core `Plugin.js`, external package
`Plugin/JennAIGentQualityTrial/`, and temporary process-only external plugin
discovery settings.

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. The previous layers proved resolver behavior, registration
policy, stdio execution, and isolated `pluginManager.loadPlugins`
discovery-to-registration. The remaining risk is server-level activation. This
proposal defines that risk before any server process is started.

## 2. Current Evidence

Core repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: codex/aigentquality-server-activation-proposal
base head: 483266b5228a1ee9aba3737b10f58ac9d1a15c4a
base source: PR #263 squash merge
worktree before this proposal: clean
```

External package repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: beb072b8ad1530dd62c526c71e4cc09930068685
target plugin path: Plugin/JennAIGentQualityTrial/
target manifest name: JennAIGentQualityTrial
target protocol: stdio
```

Prior proof chain:

```text
Layer 1 resolver-only proof: passed
Layer 2 registration-only proof: passed
Layer 3 stdio smoke proof with temporary fixtures: passed
Layer 4 isolated pluginManager.loadPlugins legacy-external proof: passed
server-level runtime activation: not proven
```

Relevant records:

- `docs/governance/P7_AIGENTQUALITY_RENAMED_TRIAL_PREFLIGHT_20260615.md`
- `docs/governance/P7_AIGENTQUALITY_SHADOW_CUTOVER_RFC_20260615.md`

## 3. Why Direct Server Start Is Not The Next Safe Step

Directly running `node server.js` or `npm start` is broader than the Layer 4
proof. The current `server.js` startup path:

- reads `config.env` through `dotenv.config({ path: 'config.env' })`;
- resolves and creates `Agent/` and `TVStxt/` directories unless overridden;
- initializes `KnowledgeBaseManager`;
- initializes `dynamicToolRegistry`;
- calls `pluginManager.loadPlugins`;
- initializes service plugins and mounts admin/internal routes;
- initializes ChannelHub and its state stores;
- initializes static plugins and prewarms Python plugins;
- may run static plugin scripts that read repository-root `config.env`
  directly from plugin code, independent of the server child process cwd;
- imports `node-fetch`;
- starts `app.listen(port)`;
- initializes WebSocketServer and FileFetcherServer.

The file also calls `startServer()` at module top level, so importing
`server.js` is itself a startup action. A future harness must treat server
startup as a child-process operation or first introduce a separately reviewed
test seam.

Known write surfaces during or near server startup include:

- `AGENT_DIR_PATH` target;
- `TVSTXT_DIR_PATH` target;
- `KNOWLEDGEBASE_ROOT_PATH` / vector store target;
- ChannelHub `state/channelHub/*` under its configured base directory;
- static plugin generated outputs;
- logs and runtime state under project-local or configured paths, including
  ignored paths such as `DebugLog/*` and `ToolConfigs/dynamic_tool_*.json`.

Therefore the next authorized step must not be an ordinary server start. It
must first define an isolated server harness and prove all writes are confined
to temporary paths.

## 4. Non-Authorization

This proposal does not authorize:

- `node server.js`;
- `npm start`;
- PM2 start or restart;
- Docker start;
- AdminPanel writes;
- persistent `config.env` edits;
- persistent `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_DIRS`,
  `VCP_PLUGIN_INSTALL_DIR`, or `VCP_EXTERNAL_PLUGIN_ALLOWLIST` edits;
- real operator image path scans;
- provider, OCR, OpenPose, moderation, CLIP, workflow, or generation calls;
- enabling AI image real execution;
- changing core `Plugin/AIGentQuality/`;
- changing loader priority;
- same-name external override;
- deleting or disabling any core plugin.

## 5. Proposed Gate Sequence

### Gate S0 - Server Activation Preflight Only

Purpose: confirm the future server proof can be isolated before starting any
process.

Allowed actions:

- read files;
- inspect `server.js`, `Plugin.js`, and related tests;
- verify both repositories are clean and on expected heads;
- choose temporary directories, candidate test ports, and a network-bind
  containment option;
- create a future command plan without executing it.

Required evidence:

```text
core head is 483266b5228a1ee9aba3737b10f58ac9d1a15c4a or a reviewed successor
external package head is beb072b8ad1530dd62c526c71e4cc09930068685 or a reviewed successor
no unrelated worktree changes
no server process started
no persistent env file changed
no repository file copied, moved, deleted, or generated
```

### Gate S1 - Isolated Server Harness Review

Purpose: define how a future server process can be started without reading real
operator configuration or writing operator state.

Proposed harness constraints:

- spawn a child process only after a later explicit gate;
- run from a temporary current working directory that does not contain
  `config.env`; this only prevents the root
  `dotenv.config({ path: 'config.env' })` read and does not cover plugin-level
  `Plugin/*/config.env` loading or plugin scripts that directly resolve the
  repository-root `config.env`;
- set all required environment values explicitly in the child process env;
- set `PORT` to a reviewed free test port;
- set fake local-only `API_Key`, `Key`, `Image_Key`, `File_Key`,
  `VCP_Key`, `AdminUsername`, and `AdminPassword`;
- set `API_URL` to an inert local-only value such as `http://127.0.0.1:9`,
  and do not call provider routes;
- set `DebugMode=false`;
- set `AGENT_DIR_PATH`, `TVSTXT_DIR_PATH`, `KNOWLEDGEBASE_ROOT_PATH`, and
  `CHANNELHUB_BASE_DIR` to temporary directories;
- set `ENABLE_AI_IMAGE_AGENTS_ROUTE=false`;
- set `ENABLE_AI_IMAGE_REAL_EXECUTION=false`;
- set `ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE=false`;
- set `VCP_PLUGIN_ALLOWED_ROOTS` to the external package root;
- set `VCP_PLUGIN_DIRS` to the external package `Plugin` root;
- set `VCP_EXTERNAL_PLUGIN_ALLOWLIST` to the exact target plugin path:
  `JennAIGentQualityTrial@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial`;
- leave `VCP_PLUGIN_INSTALL_DIR` unset.

Known unresolved harness question:

```text
server.js calls app.listen(port) without an explicit host argument.
Before any real server smoke, decide whether to:
1. introduce a reviewed host-binding test seam,
2. run inside a network-isolated environment, or
3. explicitly accept the bind behavior for a very short local smoke.

server.js initializes static plugins and prewarms Python plugins.
Before any real server smoke, decide whether to:
1. accept only temporary-path writes and prove no repo diff after exit, or
2. add a separate test harness that disables static plugin side effects.

server.js and pluginManager.loadPlugins use the real core Plugin/ root and
plugins/registry.json from __dirname.
Before any real server smoke, inventory which core direct, service,
message-preprocessor, and static plugins can initialize, then decide whether
to:
1. accept them with temporary-path proof plus post-shutdown git-diff evidence,
or
2. add a reviewed harness/test seam that filters or stubs non-target side
effects.

PluginManager also reads plugin-level config.env files through
_loadPluginEnvConfig() while loading manifests. A temporary cwd only blocks the
root config.env read; it does not block untracked Plugin/*/config.env files in
the operator checkout. Before any real server smoke, either:
1. prove every loaded core and target external plugin directory has no
config.env file, or
2. add a reviewed harness/test seam that disables plugin-level env loading.

Some static plugins also read the repository-root `config.env` directly from
their own scripts, bypassing the temporary cwd guard and PluginManager's
plugin-level env loader. Current examples include
`Plugin/WeatherReporter/weather-reporter.js` and
`Plugin/MCPOMonitor/mcpo_monitor.js`, which resolve `../../config.env` from the
plugin directory. Before any real server smoke, either:
1. add a reviewed harness/test seam that prevents static plugin execution or
   disables repository-root config reads from plugin scripts, or
2. provide an explicit inventory proving no loaded plugin script can read the
   repository-root `config.env`.

Under ordinary server startup, core legacy plugins are expected to register.
Do not require core AIGentOrchestrator to be absent unless a reviewed core
plugin filtering seam is part of the harness. The S2 success criteria must
distinguish core plugin registration from external plugin registration.

Git-tracked diff checks are not enough for server smoke validation because
startup can write ignored runtime files. Known examples include
DebugLog/ServerLog.txt from logger initialization and
ToolConfigs/dynamic_tool_catalog.json or dynamic_tool_categories.json from
dynamicToolRegistry initialization. Before any real server smoke, either:
1. redirect or disable these writes through a reviewed harness seam, or
2. take explicit before/after inventories of approved ignored runtime paths and
fail the smoke on any unapproved ignored-file change.
```

These questions must be resolved before Gate S2.

### Gate S2 - Isolated Server Listen Smoke

Purpose: prove server-level activation can reach `app.listen` with the external
trial discovered under process-only environment settings.

This gate requires a later explicit authorization.

Minimum success evidence:

```text
server process started from temporary cwd: yes
real config.env read: no
plugin-level config.env read: no
plugin-script repository-root config.env read: no
network bind containment reviewed and accepted: yes
pluginManager.loadPlugins invoked by server.js: yes
JennAIGentQualityTrial registered from external package: yes
NoopJennExternalPlugin not registered unless explicitly allowlisted: yes
JennAIGentQuality not registered unless explicitly allowlisted: yes
core AIGentOrchestrator may register from core legacy root: yes
external AIGentOrchestrator not registered unless explicitly allowlisted: yes
external JennAIGentOrchestrator not registered unless exact policy permits it: yes
server reached app.listen: yes
processToolCall invoked: no
executePlugin invoked: no
operator image path read: no
provider/network/workflow/generation call: no
persistent env changed: no
core plugin changed: no
tracked repository diff after shutdown: none
ignored runtime-state inventory after shutdown: no unapproved changes
temporary directories cleaned or retained only as explicit evidence: yes
```

Allowed smoke observations:

- child process stdout/stderr lines needed to prove plugin registration and
  listen success;
- process exit code after controlled shutdown;
- `git status --short --branch` before and after;
- ignored-file before/after inventory for approved runtime-state paths;
- temporary directory inventory.

Not allowed in S2:

- request `/v1/chat/completions`;
- call `JennAIGentQualityTrial`;
- scan a real image directory;
- trigger workflow or provider calls;
- use real API keys or operator secrets;
- leave the child process running.

### Gate S3 - Optional Authenticated Read-Only Endpoint Smoke

This gate is optional and must not start until S2 passes.

Candidate endpoints must be read-only and must not reach providers. The initial
candidate is `/admin_api/server/lifecycle` with temporary admin credentials,
because it reports server state without invoking a tool or image path.

This gate requires a later explicit authorization.

## 6. Stop Conditions

Stop before any server process is started if:

- core repository is not clean;
- external package repository is not clean;
- core head differs from the expected reviewed head and has not been explained;
- external package head differs from the expected reviewed head and has not
  been explained;
- a temp cwd without `config.env` cannot be guaranteed;
- plugin-level `config.env` files in loaded plugin roots cannot be ruled out or
  disabled by a reviewed harness seam;
- plugin scripts that directly resolve repository-root `config.env` cannot be
  ruled out or disabled by a reviewed harness seam;
- a free test port cannot be selected;
- server bind containment cannot be guaranteed or explicitly accepted;
- required temp data roots cannot be created;
- ignored runtime-state paths cannot be redirected, disabled, or inventoried;
- static plugin side effects cannot be bounded or explicitly deferred;
- core plugin initialization side effects cannot be inventoried or bounded;
- the future command would read real operator `config.env`;
- the future command would write to core repo runtime state;
- the future command would start PM2, Docker, or a production listener;
- the future command would call providers, workflows, OCR, OpenPose,
  moderation, or generation.

Stop during a future server smoke if:

- server reads real `config.env`;
- a plugin script reads repository-root `config.env`;
- server binds an unexpected address or port;
- any unexpected external plugin registers;
- `JennAIGentQualityTrial` fails to register under exact allowlist;
- repository diff appears after shutdown;
- ignored runtime-state inventory shows unapproved changes after shutdown;
- operator image path is accessed;
- any provider/network/workflow/generation call is observed;
- child process does not exit after the controlled timeout.

## 7. Rollback And Cleanup

For this proposal document:

```text
rollback: remove this docs-only proposal before commit, or revert the future
docs-only commit after review.
```

For any future server smoke:

- terminate the child process;
- remove only temporary directories created by the smoke after verifying their
  absolute paths;
- restore no persistent env because no persistent env may be edited;
- verify both repositories with `git status --short --branch`;
- record any unexpected diff before deciding whether cleanup is safe.

Do not run recursive deletion automatically. Any cleanup outside an OS temp
root requires separate explicit approval.

## 8. Validation For This Proposal

Proposal validation is docs-only:

```text
git status --short --branch
git diff --check
rg -n "[ \t]+$" docs/governance/P7_AIGENTQUALITY_SERVER_ACTIVATION_PROPOSAL_20260615.md
```

No server process, plugin execution, provider call, workflow call, image scan,
or runtime activation is part of this proposal.

## 9. Current Result

Current result: proposal drafted.

```text
No runtime activation.
No server start.
No persistent external discovery env change.
No core disable, deletion, move, or stub replacement.
No loader priority change.
No operator image path read.
No provider/network/workflow/generation call.
No repository file copied, moved, or deleted.
```

Next safe action:

```text
Review the docs-only PR carrying this proposal. If accepted, either keep the
activation stopped at proposal state, authorize Gate S0 preflight-only
evidence, or prepare a separate Gate S1 harness design review. Do not authorize
Gate S2 server listen smoke until the S1 harness questions are resolved.
```
