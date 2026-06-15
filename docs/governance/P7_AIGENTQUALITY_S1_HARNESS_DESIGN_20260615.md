# P7 AIGentQuality S1 Harness Design

Date: 2026-06-15

Status: S1 design only. This document defines a future isolated server harness
for `JennAIGentQualityTrial`; it does not implement the harness, start
`server.js`, run `npm start`, execute a plugin, bind a port, edit persistent
env files, copy files, move files, delete files, call providers, or authorize
Gate S2.

Scope:

- core repository: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox`
- external package repository:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`
- target plugin:
  `Plugin/JennAIGentQualityTrial/`
- S0 evidence:
  `docs/governance/P7_AIGENTQUALITY_S0_PREFLIGHT_EVIDENCE_20260615.md`
- server activation proposal:
  `docs/governance/P7_AIGENTQUALITY_SERVER_ACTIVATION_PROPOSAL_20260615.md`

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. S1 does not activate server runtime. It defines the isolation
strategy required before a future server-level proof can safely show that the
external `JennAIGentQualityTrial` can be discovered through `server.js` without
reading operator configuration, executing scheduled/plugin work, or writing
operator state.

## 2. Design Boundary

Allowed in S1:

- inspect startup code and existing tests;
- write this docs-only design;
- define future harness files, future command shape, and future evidence;
- run non-server validation such as syntax checks and external plugin policy
  tests.

Not allowed in S1:

- start `server.js`;
- import `server.js` in the current process;
- spawn a child server process;
- call `pluginManager.processToolCall()` or `executePlugin()`;
- execute `JennAIGentQualityTrial`;
- bind a port;
- write runtime state outside docs;
- change persistent `config.env` or plugin `config.env` files;
- modify `Plugin/AIGentQuality/`;
- change loader priority;
- disable or delete core plugins.

## 3. Current Inputs

Core repository:

```text
branch: codex/aigentquality-s0-preflight
head before this design: 2650cd1f
base main: f35bd937a758247eb4f0a4447d8defcbc1678d60
S0 evidence commit: 2650cd1f docs: record AIGentQuality S0 preflight evidence
worktree before S1 design: clean
```

External package:

```text
branch: main
head: beb072b8ad1530dd62c526c71e4cc09930068685
target manifest name: JennAIGentQualityTrial
target protocol: stdio
target external vision default: false
```

## 4. Startup Facts That Drive The Harness

The future harness must treat `server.js` as an executable entrypoint, not as a
library:

```text
server.js:5      calls dotenv.config({ path: 'config.env' })
server.js:33-35  initializes and overrides the server logger during import
server.js:361    starts a process-level interval during import
server.js:649    reads PORT from process.env
server.js:2010   invokes pluginManager.loadPlugins()
server.js:2119   invokes pluginManager.initializeStaticPlugins()
server.js:2121   invokes pluginManager.prewarmPythonPlugins()
server.js:2161   invokes taskScheduler.initialize(...)
server.js:2210   constructs ChannelHubService
server.js:2234   calls app.listen(port) without an explicit host argument
server.js:2262   initializes WebSocketServer after listen
server.js:2268   initializes FileFetcherServer after listen
server.js:2274   calls startServer().catch(...)
```

The future harness must also account for plugin manager behavior:

```text
Plugin.js:282    core plugin child env inherits process.env
Plugin.js:313    static plugin execution can spawn with shell: true
Plugin.js:434    initializeStaticPlugins starts background static updates
Plugin.js:472    prewarmPythonPlugins can spawn python
Plugin.js:601    _loadPluginEnvConfig reads Plugin/*/config.env
Plugin.js:1048   direct service/preprocessor manifests can require plugin code
Plugin.js:1069   loadPlugins discovers and registers plugin manifests
Plugin.js:1169   loadPlugins can call module.initialize for direct modules
Plugin.js:1961   initializeServices mounts service plugin routes
```

Scheduler behavior must be isolated:

```text
routes/taskScheduler.js:11  uses repository-root VCPTimedContacts
routes/taskScheduler.js:143 can call pluginManager.processToolCall
routes/taskScheduler.js:263 reads pending timed tasks
routes/taskScheduler.js:283 initializes scheduler and watcher
```

Post-listen behavior must also be isolated:

```text
WebSocketServer.js:102 initializes a WebSocket server on the HTTP server
WebSocketServer.js:43  can create repository-root VCPAsyncResults during
  distributed callback handling
FileFetcherServer.js:10 defines repository-root .file_cache
FileFetcherServer.js:21 initializes FileFetcherServer
FileFetcherServer.js:28 creates repository-root .file_cache
```

## 5. Chosen Harness Shape

Preferred future shape:

```text
parent verifier process
  -> builds temp run root
  -> builds clean child env from allowlist
  -> writes harness config under temp run root
  -> spawns node with --require <reviewed preload seam>
       cwd: temp cwd without config.env
       entry: A:\AGENTS_OS_Workspace\runtime\VCPToolBox\server.js
  -> waits only for listen evidence
  -> controlled shutdown
  -> verifies receipt, process exit, repo diffs, ignored runtime inventory
```

Future implementation artifacts, if later authorized:

```text
tests/harness/aigentquality-server-smoke-preload.js
scripts/aigentquality-server-smoke-s2.js
```

These files are not created by S1. They are listed so the S1 review can judge
the proposed approach before any runnable harness exists.

## 6. Clean Child Env Design

The child env must not be built by spreading `process.env`.

Allowed baseline categories:

- minimal Windows process variables required to launch Node, such as
  `SystemRoot`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`, and a reviewed `PATH`;
- explicit fake application values;
- explicit Jenn external plugin discovery values;
- explicit harness control values pointing only to the temporary run root.

Application values:

```text
PORT=<rechecked free local test port>
DebugMode=false
CHAT_LOG_ENABLED=false
API_URL=http://127.0.0.1:9
API_Key=fake-local-only
Key=fake-local-only
Image_Key=fake-local-only
File_Key=fake-local-only
VCP_Key=fake-local-only
AdminUsername=fake-local-only
AdminPassword=fake-local-only
AGENT_DIR_PATH=<run root>\Agent
TVSTXT_DIR_PATH=<run root>\TVStxt
KNOWLEDGEBASE_ROOT_PATH=<run root>\dailynote
CHANNELHUB_BASE_DIR=<run root>\channelHub
ENABLE_AI_IMAGE_AGENTS_ROUTE=false
ENABLE_AI_IMAGE_REAL_EXECUTION=false
ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE=false
VCP_PLUGIN_ALLOWED_ROOTS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
VCP_PLUGIN_DIRS=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
VCP_EXTERNAL_PLUGIN_ALLOWLIST=JennAIGentQualityTrial@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
```

Required absence:

```text
VCP_PLUGIN_INSTALL_DIR
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
DOUBAO keys
provider keys
bearer tokens
cookies
session values
operator passwords
production endpoints
```

The verifier must fail before spawn if any inherited env key looks secret-like,
unless it is one of the explicit fake local-only values above.

## 7. Preload Seam Design

The preload seam must run before `server.js` and record a receipt under the
temporary run root. Its job is to make unsafe startup paths fail closed.

Required preload behavior:

```text
load harness config from a temp-only path
install repository write guard before server.js loads
install child_process spawn guard before Plugin.js loads
intercept selected local module loads
patch pluginManager after Plugin.js loads
patch http/https listen behavior if host binding is not otherwise solved
intercept post-listen WebSocketServer and FileFetcherServer initialization
record every allowed interception in a receipt
```

The preload may read source files from the core repository. It must not write
to the core repository or external package repository.

## 8. Required Interceptions

### Logger

Problem:

```text
server.js requires modules/logger.js and calls initializeServerLogger during
import. The current logger writes under repository-root DebugLog.
```

Required S2 harness behavior:

```text
logger.initializeServerLogger intercepted: yes
logger.overrideConsole intercepted or redirected to temp receipt logging: yes
repository-root DebugLog write attempted: no
```

Preferred method: return a reviewed stub for `./modules/logger.js` from the
preload module loader.

### Dotenv And Config

Problem:

```text
server.js calls dotenv.config({ path: 'config.env' }) against cwd. PluginManager
can also read plugin-level config.env. Some plugin scripts directly resolve the
repository-root config.env.
```

Required S2 harness behavior:

```text
child cwd contains config.env: no
dotenv root config path resolved inside temp cwd: yes
repository-root config.env read attempted: no
plugin-level config.env loading disabled or intercepted: yes
static plugin scripts executed: no
```

Preferred method: run from temp cwd, patch `pluginManager._loadPluginEnvConfig`
to return `{}`, block repository-root `config.env` reads in the read guard, and
prevent static plugin execution.

### PluginManager Startup Execution

Problem:

```text
initializeStaticPlugins can spawn static commands; prewarmPythonPlugins can
spawn python; loadPlugins can require and initialize direct service or
preprocessor modules; executePlugin can spawn stdio plugin processes.
```

Required S2 harness behavior:

```text
pluginManager.loadPlugins invoked: yes
pluginManager.loadPlugins limited to manifest-only registration: yes
direct service/preprocessor plugin code required: no
direct service/preprocessor module.initialize invoked: no
pluginManager.initializeServices intercepted or bounded: yes
pluginManager.initializeStaticPlugins intercepted: yes
pluginManager.prewarmPythonPlugins intercepted: yes
pluginManager.processToolCall invoked: no
pluginManager.executePlugin invoked: no
child_process.spawn invoked: no
```

Preferred method: patch the PluginManager singleton after `Plugin.js` loads:

- keep `loadPlugins` as the server-invoked entrypoint, but patch its risky
  internals to manifest-only behavior;
- replace `_discoverModernPluginManifests` with an empty result unless a later
  S1 revision inventories and accepts modern registry loading;
- wrap `_registerLocalPlugin` so it evaluates external runtime policy and
  records manifests without requiring direct service/preprocessor code or
  queueing module initialization;
- wrap `initializeServices` as a no-op receipt entry for S2 unless a later S1
  revision inventories and accepts service plugin initialization;
- replace `initializeStaticPlugins` with a no-op receipt entry;
- replace `prewarmPythonPlugins` with a no-op receipt entry;
- replace `_loadPluginEnvConfig` with a no-op receipt entry;
- wrap `processToolCall` and `executePlugin` to fail if called;
- wrap `_spawnPluginProcess` to fail if called.

### Task Scheduler

Problem:

```text
taskScheduler.initialize reads repository-root VCPTimedContacts and can execute
overdue tasks before app.listen.
```

Required S2 harness behavior:

```text
taskScheduler.initialize intercepted: yes
operator VCPTimedContacts read/write attempted: no
scheduler pending task inventory before startup: empty temp directory
scheduler task execution attempted: no
```

Preferred method: return a reviewed stub for `./routes/taskScheduler.js` with
`initialize()` and `shutdown()` no-ops that record receipt entries. A later
revision may instead introduce a real scheduler directory seam, but it must
prove the directory is an empty temp path before startup.

### Dynamic Tool Registry

Problem:

```text
dynamicToolRegistry.initialize writes ToolConfigs files under projectBasePath,
and server.js passes __dirname as projectBasePath.
```

Required S2 harness behavior:

```text
repository ToolConfigs write attempted: no
dynamicToolRegistry initialization intercepted or redirected: yes
```

Preferred method: return a reviewed stub for
`./modules/dynamicToolRegistry.js` that records `initialize()` and does not
write. If a later revision redirects instead of stubbing, it must prove every
path stays under the temp run root.

### KnowledgeBaseManager

Problem:

```text
server.js initializes KnowledgeBaseManager before loading plugins.
```

Required S2 harness behavior:

```text
operator dailynote/vector store write attempted: no
KnowledgeBaseManager initialize intercepted or redirected: yes
```

Preferred method: return a reviewed stub for `./KnowledgeBaseManager.js` with
`initialize()` and `shutdown()` no-ops plus any methods needed by plugin
registration. Do not initialize real vector stores during S2.

### ChannelHub

Problem:

```text
server.js constructs ChannelHubService and calls initialize before app.listen.
```

Required S2 harness behavior:

```text
CHANNELHUB_BASE_DIR is temp-only: yes
ChannelHub state write outside temp root attempted: no
```

Preferred method: first rely on `CHANNELHUB_BASE_DIR=<run root>\channelHub`.
If future S2 still observes unexpected initialization side effects, intercept
`ChannelHubService` with a reviewed stub in a later S1 revision before trying
S2 again.

### Network Bind

Problem:

```text
server.js calls app.listen(port) without an explicit host argument.
```

Required S2 harness behavior:

```text
test port rechecked immediately before spawn: yes
listen host containment reviewed: yes
server reached app.listen: yes
server binds only accepted address: yes
```

Preferred method: patch `http.Server.prototype.listen` in the preload seam so a
port-only listen is rewritten to `127.0.0.1`. The patch must record original
arguments, final arguments, address, and port in the receipt.

Fallback: add a tiny reviewed core test seam for host binding before S2. Do not
use an unreviewed production behavior assumption.

### Post-Listen WebSocket And FileFetcher

Problem:

```text
server.js treats app.listen as the start of a callback, not the end of startup.
Inside that callback it initializes WebSocketServer and then
FileFetcherServer.initialize. FileFetcherServer.initialize creates the
repository-root .file_cache directory.
```

Required S2 harness behavior:

```text
WebSocketServer.initialize intercepted: yes
WebSocketServer.setPluginManager intercepted: yes
WebSocketServer upgrade server created: no
WebSocketServer VCPAsyncResults write attempted: no
FileFetcherServer.initialize intercepted: yes
FileFetcherServer .file_cache write attempted: no
post-listen interception receipt written: yes
```

Preferred method: return reviewed stubs for `./WebSocketServer.js` and
`./FileFetcherServer.js` from the preload module loader. The WebSocket stub must
provide the methods server startup expects, including `initialize`,
`setPluginManager`, broadcast helpers, lookup helpers, and `shutdown`, but each
method should only record a receipt or return an inert value. The FileFetcher
stub must provide `initialize`, `fetchFile`, and `resolveFileUrl`; `initialize`
must only record a receipt and must not create `.file_cache`.

S2 cannot claim success at `server reached app.listen: yes` until both
post-listen stubs have recorded their expected receipt entries.

## 9. Repository Write Guard

The preload seam must install a fail-closed write guard for common write APIs:

```text
fs.writeFile / writeFileSync
fs.appendFile / appendFileSync
fs.mkdir / mkdirSync
fs.rename / renameSync
fs.unlink / unlinkSync
fs.rm / rmSync
fs.createWriteStream
fs.watch
```

Allowed write roots in future S2:

```text
<run root>\
```

Blocked write roots:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
```

The guard must fail the child process if any write or watcher target resolves
outside the temp run root. If a Windows system temp path is needed by Node
internals, it must be the same `<run root>` or explicitly listed in the receipt.

## 10. Future S2 Command Plan

This is a future plan only. Do not run it during S1.

```powershell
$runRoot = Join-Path $env:TEMP "vcptoolbox-aigentquality-server-smoke-<timestamp>"
$cwd = Join-Path $runRoot "cwd"
$config = Join-Path $runRoot "harness-config.json"

node `
  --require A:\AGENTS_OS_Workspace\runtime\VCPToolBox\tests\harness\aigentquality-server-smoke-preload.js `
  A:\AGENTS_OS_Workspace\runtime\VCPToolBox\server.js
```

Future child process attributes:

```text
cwd: <run root>\cwd
env: clean allowlist only
stdio: captured
timeout: short and reviewed
shutdown: controlled after listen evidence
```

The parent verifier must not send `/v1/chat/completions` or invoke any plugin.

## 11. Future S2 Success Evidence

S2 may pass only if all of these are true:

```text
core repo clean before and after: yes
external repo clean before and after: yes
server child cwd is temp and has no config.env: yes
child env built from clean allowlist: yes
secret-like parent env inherited: no
logger writes to core DebugLog: no
repository-root config.env read: no
plugin-level config.env read: no
dynamicToolRegistry core ToolConfigs write: no
KnowledgeBaseManager real store init: no
pluginManager.loadPlugins invoked by server.js: yes
loadPlugins manifest-only registration seam active: yes
JennAIGentQualityTrial registered from external package: yes
unexpected external plugins registered: no
direct service/preprocessor plugin code required: no
direct service/preprocessor module.initialize invoked: no
initializeServices real service side effects: no
static plugin startup execution: no
Python prewarm: no
taskScheduler real initialize: no
operator VCPTimedContacts read/write: no
WebSocketServer real initialize: no
WebSocketServer post-listen interception receipt: yes
FileFetcherServer real initialize: no
FileFetcherServer .file_cache write attempted: no
FileFetcherServer post-listen interception receipt: yes
processToolCall invoked: no
executePlugin invoked: no
child_process.spawn invoked: no
server reached app.listen: yes
bind address accepted: yes
provider/network/workflow/generation call: no
operator image path read: no
ignored runtime-state inventory changed outside allowed temp root: no
temporary evidence retained or cleaned by explicit policy: yes
```

## 12. Stop Conditions

Stop before implementing or running the harness if:

- either repository is dirty for unrelated reasons;
- core head is not `2650cd1f` or a reviewed successor;
- external package head is not `beb072b8ad1530dd62c526c71e4cc09930068685` or
  a reviewed successor;
- the S1 design is not reviewed;
- the child env cannot be constructed without inheriting secret-like parent env;
- the write guard cannot fail closed;
- the preload seam cannot intercept logger, scheduler, static execution,
  Python prewarm, plugin env loading, and dynamic registry writes;
- `loadPlugins` cannot be limited to reviewed manifest-only registration
  without requiring or initializing direct service/preprocessor modules;
- post-listen WebSocketServer and FileFetcherServer initialization cannot be
  stubbed or recorded before S2;
- the host bind cannot be restricted or explicitly accepted;
- the future run would require real API keys, operator image paths, provider
  calls, workflow calls, PM2, Docker, AdminPanel writes, or persistent env
  edits.

Stop during future S2 if:

- any repository write is attempted outside the temp run root;
- any repository-root `config.env` or plugin `config.env` is read;
- any static plugin command, Python prewarm process, or plugin process is
  spawned;
- `taskScheduler` reads or writes operator `VCPTimedContacts`;
- `processToolCall` or `executePlugin` is invoked;
- real WebSocketServer initialization creates an upgrade server;
- FileFetcherServer initializes or writes `.file_cache` under the repository;
- an unexpected external plugin registers;
- the target external plugin fails to register;
- the server binds an unexpected address or port;
- any provider, workflow, generation, OCR, OpenPose, moderation, or operator
  image path access is observed.

## 13. S1 Result

```text
S1 harness design drafted: yes
server started: no
server imported in current process: no
child process spawned: no
plugin executed: no
runtime state written: no
persistent env changed: no
S2 authorized: no
```

## 14. Validation For This Design

Validation commands:

```powershell
git diff --check
rg -n "[ \t]+$" docs/governance/P7_AIGENTQUALITY_S1_HARNESS_DESIGN_20260615.md
node --check A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\AIGentQuality.js
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

No server process, plugin execution, provider call, workflow call, or runtime
activation is part of S1 validation.

## 15. Next Safe Action

Review this S1 design together with the S0 evidence. If accepted, open one PR
containing both docs-only commits. Do not implement or run the S2 harness until
that PR is reviewed and a later explicit S2 authorization is given.
