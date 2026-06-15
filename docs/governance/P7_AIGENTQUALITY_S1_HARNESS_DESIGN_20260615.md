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
server.js:131    defines repository-root ip_blacklist.json
server.js:361    starts a process-level interval during import
server.js:471-490 loadBlacklist can call saveBlacklist and write ip_blacklist.json
server.js:649    reads PORT from process.env
server.js:2010   invokes pluginManager.loadPlugins()
server.js:2119   invokes pluginManager.initializeStaticPlugins()
server.js:2121   invokes pluginManager.prewarmPythonPlugins()
server.js:2131   enumerates Plugin/EmojiListGenerator/generated_lists
server.js:2161   invokes taskScheduler.initialize(...)
server.js:2168   invokes loadBlacklist before pre-listen manager initialization
server.js:2178   loads ModelRedirect.json through modelRedirectHandler
server.js:2182   invokes semanticModelRouter.initialize(...)
server.js:2188   invokes agentManager.initialize(...)
server.js:2193   invokes tvsManager.initialize(...)
server.js:2198   invokes toolboxManager.initialize(...)
server.js:2202   invokes sarPromptManager.initialize(...)
server.js:2206   invokes initialize(), which loads plugins and initializes services
server.js:2210   constructs ChannelHubService
server.js:2234   calls app.listen(port) without an explicit host argument
server.js:2262   initializes WebSocketServer after listen
server.js:2268   initializes FileFetcherServer after listen
server.js:2274   calls startServer().catch(...)
```

The future harness must also account for plugin manager behavior:

```text
Plugin.js:49     defines repository-root preprocessor_order.json
Plugin.js:131    constructs ToolApprovalManager for toolApprovalConfig.json
Plugin.js:282    core plugin child env inherits process.env
Plugin.js:313    static plugin execution can spawn with shell: true
Plugin.js:434    initializeStaticPlugins starts background static updates
Plugin.js:472    prewarmPythonPlugins can spawn python
Plugin.js:601    _loadPluginEnvConfig reads Plugin/*/config.env
Plugin.js:963    _discoverLegacyPluginManifestsFromDir enumerates plugin roots
Plugin.js:1048   direct service/preprocessor manifests can require plugin code
Plugin.js:1069   loadPlugins discovers and registers plugin manifests
Plugin.js:1132   reads repository-root preprocessor_order.json
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
modules/sarPromptManager.js:78 can write repository-root sarprompt.json through
  fs.promises.writeFile during startup migration
modules/toolApprovalManager.js:16 constructs and immediately loads/watches
  toolApprovalConfig.json
modules/semanticRouterConfig.js:164 can create SemanticModelRouter.json
modules/semanticModelRouter.js:75 initializes config and starts a watcher
modules/semanticModelRouter.js:178 can fs.watch repository-root config dir
modelRedirectHandler.js:19 can read repository-root ModelRedirect.json
modules/agentManager.js:38 reads repository-root agent_map.json
modules/agentManager.js:72 and :82 can watch agent_map.json and Agent files
modules/tvsManager.js:26 can watch TVStxt
modules/toolboxManager.js:49 reads repository-root toolbox_map.json
modules/toolboxManager.js:78 and :86 can watch toolbox_map.json and TVStxt
```

## 5. Chosen Harness Shape

Preferred future shape:

```text
parent verifier process
  -> builds temp run root
  -> builds clean child env from allowlist without inheriting parent env
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

The child spawn mechanism must replace the environment, not merely override the
parent process environment. `Start-Process -Environment` alone is disallowed for
S2 because it inherits parent variables by default. Preferred future S2 runner:
a Node parent verifier uses `child_process.spawn(process.execPath, args, {
cwd, env: childEnv, stdio })`, where `childEnv` is a newly constructed object.

The receipt must record the exact child env key set before spawn and the preload
must record the child env key set after startup. S2 fails if either set contains
any key outside the reviewed allowlist.

Allowed baseline categories:

- minimal Windows process variables required to launch Node, such as
  `SystemRoot`, `ComSpec`, `PATHEXT`, `TEMP`, `TMP`, and a reviewed `PATH`;
- explicit fake application values;
- explicit Jenn external plugin discovery values;
- explicit harness control values pointing only to the temporary run root.

Application values:

```text
VCP_AIGENTQUALITY_S2_HARNESS_CONFIG=<run root>\harness-config.json
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
load harness config from VCP_AIGENTQUALITY_S2_HARNESS_CONFIG
verify harness config path resolves under the temp run root
install repository read guard before server.js loads
install repository write guard before server.js loads
install child_process spawn guard before Plugin.js loads
intercept fs.watch, fs.watchFile, and chokidar.watch before startup modules load
intercept or redirect repository-root ip_blacklist.json before loadBlacklist
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
to return `{}`, intercept `dotenv.config` receipt evidence, block
repository-root `config.env` reads in the read guard, and prevent static plugin
execution.

### IP Blacklist State

Problem:

```text
server.js defines BLACKLIST_FILE as repository-root ip_blacklist.json.
startServer calls loadBlacklist before pre-listen manager initialization.
When ip_blacklist.json is absent, loadBlacklist calls saveBlacklist, which
writes repository-root ip_blacklist.json through fs.writeFile.
```

Required S2 harness behavior:

```text
loadBlacklist path interception installed before startServer executes: yes
repository-root ip_blacklist.json read attempted: no
repository-root ip_blacklist.json write attempted: no
temp ip_blacklist fixture path used: yes
blacklist interception receipt written before pluginManager.loadPlugins: yes
```

Preferred method: install a targeted fs path redirect in the preload seam before
`server.js` loads, mapping the core repository `ip_blacklist.json` path to
`<run root>\state\ip_blacklist.json`. The receipt must record the original
path, redirected path, read/write operation, and whether the temp fixture was
created. Any unredirected repository-root `ip_blacklist.json` access fails
closed.

### Startup Config Watchers

Problem:

```text
Plugin.js constructs ToolApprovalManager during PluginManager construction.
ToolApprovalManager reads repository-root toolApprovalConfig.json and starts a
chokidar watcher.

server.js calls semanticModelRouter.initialize before app.listen.
SemanticModelRouter can create/read SemanticModelRouter.json and fs.watch the
repository-root config directory.
```

Required S2 harness behavior:

```text
ToolApprovalManager construction intercepted: yes
repository-root toolApprovalConfig.json read attempted: no
ToolApprovalManager chokidar watcher started: no
semanticModelRouter.initialize intercepted: yes
repository-root SemanticModelRouter.json read/write attempted: no
repository-root SemanticModelRouter config watcher started: no
startup config watcher receipts written before app.listen: yes
```

Preferred method: return reviewed stubs for `./modules/toolApprovalManager.js`
and `./modules/semanticModelRouter.js` from the preload module loader. The
ToolApprovalManager stub must expose the methods PluginManager expects while
returning inert local-only decisions and recording construction; required
methods include `getApprovalDecision`, `shouldApprove`, `getTimeoutMs`, and
`shutdown`. The SemanticModelRouter stub must expose `initialize`,
`closeWatchers`, `getVirtualModels`, `isRoutingModel`, and request-time helpers
used by `server.js`, but `initialize` must only record a receipt. A later S1
revision may choose temp-path redirection instead, but it must prove all reads,
writes, and watchers resolve under `<run root>` before S2.

### Pre-Plugin Config Managers

Problem:

```text
Before PluginManager.loadPlugins, startServer loads ModelRedirect.json and
initializes AgentManager, TvsManager, and ToolboxManager. These managers can
read repository-root ModelRedirect.json, agent_map.json, toolbox_map.json, scan
operator Agent/TVStxt trees, and start fs/chokidar watchers.

During loadPlugins, PluginManager can also read repository-root
preprocessor_order.json while constructing message preprocessor order.
```

Required S2 harness behavior:

```text
modelRedirectHandler.loadModelRedirectConfig intercepted: yes
repository-root ModelRedirect.json read attempted: no
AgentManager.initialize intercepted: yes
repository-root agent_map.json read/watch attempted: no
operator Agent directory scan/watch attempted: no
TvsManager.initialize intercepted: yes
operator TVStxt watch attempted: no
ToolboxManager.initialize intercepted: yes
repository-root toolbox_map.json read/watch attempted: no
operator TVStxt read/watch attempted: no
preprocessor_order.json read intercepted: yes
pre-plugin config manager receipts written before pluginManager.loadPlugins: yes
```

Preferred method: return reviewed stubs for `./modelRedirectHandler.js`,
`./modules/agentManager.js`, `./modules/tvsManager.js`, and
`./modules/toolboxManager.js` from the preload module loader. Each stub must
expose the methods `server.js` calls and must record initialization without
reading or watching operator files. Patch PluginManager's preprocessor-order
step to use an empty harness-configured order and receipt instead of reading
`preprocessor_order.json`. A later S1 revision may redirect these managers to
temp fixtures, but S2 must prove every map/config read, directory scan, and
watch target resolves under `<run root>`.

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
server/plugin child_process.spawn invoked: no
```

Preferred method: patch the PluginManager singleton after `Plugin.js` loads:

- keep `loadPlugins` as the server-invoked entrypoint, but patch its risky
  internals to manifest-only behavior;
- replace `_discoverLegacyPluginManifestsFromDir` with a harness-configured
  manifest list so plugin root discovery does not enumerate core or external
  plugin directories;
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
- replace preprocessor-order loading with an empty harness-configured order and
  a receipt entry;
- wrap `processToolCall` and `executePlugin` to fail if called;
- wrap `_spawnPluginProcess` to fail if called.

### Emoji List Directory Cache

Problem:

```text
server.js enumerates Plugin/EmojiListGenerator/generated_lists before
taskScheduler.initialize. That directory contains runtime/generated plugin
state and is not needed for AIGentQuality registration proof.
```

Required S2 harness behavior:

```text
EmojiListGenerator generated_lists enumeration intercepted: yes
repository-root generated_lists directory read attempted: no
emoji cache temp fixture list returned: yes
emoji cache receipt written before taskScheduler.initialize: yes
```

Preferred method: intercept the exact `fs.promises.readdir` call for
`Plugin\EmojiListGenerator\generated_lists` and return an empty temp fixture
list with a receipt. S2 must not read the real repository generated_lists
directory or any files inside it.

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

### SarPromptManager

Problem:

```text
server.js calls sarPromptManager.initialize before app.listen. The current
manager writes repository-root sarprompt.json through fs.promises.writeFile
when the file is missing.
```

Required S2 harness behavior:

```text
sarPromptManager.initialize intercepted: yes
repository-root sarprompt.json write attempted: no
sarPromptManager watcher started: no
```

Preferred method: return a reviewed stub for `./modules/sarPromptManager.js`
with `initialize()` and any server-required accessors as inert receipt-only
methods. A later revision may instead add a reviewed temp path seam, but S2
must not rely on the write guard as the only protection for this known startup
write.

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

## 9. Repository Read Guard

The preload seam must install a fail-closed read guard before `server.js` or
any startup module can bind `require('fs')` or `require('fs').promises`.

Required guarded read APIs:

```text
fs.readFile / readFileSync
fs.open / openSync
fs.createReadStream
fs.readdir / readdirSync
fs.opendir / opendirSync
fs.stat / statSync
fs.access / accessSync
fs.existsSync
fs.promises.readFile
fs.promises.open
fs.promises.readdir
fs.promises.opendir
fs.promises.stat
fs.promises.access
FileHandle.read
FileHandle.readFile
FileHandle.createReadStream
Dir.read / readSync / async iterator
dotenv.config
```

Sensitive read targets that must fail closed:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\config.env
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\.env
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\ip_blacklist.json
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\*\config.env
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\*\config.env
secret-like files under either repository, including token, cookie, session,
password, credential, key, private, and bearer material
```

Allowed repository reads:

```text
source files needed to load server.js and reviewed stubs
plugin-manifest.json files needed for manifest-only registration
non-secret governance/test files needed by the harness
```

Directory enumeration is denied by default. Any allowed repository directory
read must be named in the harness config and receipt before spawn. S2 must not
claim success if PluginManager discovery enumerates core or external plugin
roots, if EmojiListGenerator `generated_lists` is enumerated from the operator
checkout, or if any runtime/generated directory is scanned without an explicit
stub.

The read guard must record every blocked sensitive read and every allowed
exception class in the receipt. S2 must fail if any repository-root `config.env`
or plugin `config.env` read is attempted, even if the read would have returned
ENOENT. `dotenv.config` must be intercepted or wrapped so the receipt proves it
resolved only against the temporary cwd and never against the operator checkout.

## 10. Repository Write Guard

The preload seam must install a fail-closed write guard for common write APIs:

```text
fs.writeFile / writeFileSync
fs.appendFile / appendFileSync
fs.mkdir / mkdirSync
fs.rename / renameSync
fs.unlink / unlinkSync
fs.rm / rmSync
fs.open / openSync when flags allow write, append, truncate, or create
fs.createWriteStream
fs.watch
fs.watchFile
chokidar.watch
fs.promises.writeFile
fs.promises.appendFile
fs.promises.mkdir
fs.promises.rename
fs.promises.unlink
fs.promises.rm
fs.promises.open
FileHandle.write
FileHandle.writeFile
FileHandle.appendFile
FileHandle.createWriteStream
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
The guard must wrap both the callback/sync `fs` API surface and the
`require('fs').promises` surface before any startup module loads, because many
startup modules bind `const fs = require('fs').promises` at import time.

## 11. Future S2 Command Plan

This is a future plan only. Do not run it during S1.

```powershell
$runRoot = Join-Path $env:TEMP "vcptoolbox-aigentquality-server-smoke-<timestamp>"
$cwd = Join-Path $runRoot "cwd"
$config = Join-Path $runRoot "harness-config.json"

node A:\AGENTS_OS_Workspace\runtime\VCPToolBox\scripts\aigentquality-server-smoke-s2.js `
  --run-root $runRoot `
  --config $config
```

The future parent verifier script must spawn the server child with an explicit
replacement environment:

```javascript
const childEnv = buildReviewedAllowlistEnv(config);
const child = spawn(process.execPath, [
  '--require',
  'A:\\AGENTS_OS_Workspace\\runtime\\VCPToolBox\\tests\\harness\\aigentquality-server-smoke-preload.js',
  'A:\\AGENTS_OS_Workspace\\runtime\\VCPToolBox\\server.js',
], {
  cwd,
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Future child process attributes:

```text
cwd: <run root>\cwd
env: clean allowlist only
spawn mechanism: child_process.spawn with replacement env object
harness config env: VCP_AIGENTQUALITY_S2_HARNESS_CONFIG=<run root>\harness-config.json
stdio: captured
timeout: short and reviewed
shutdown: controlled after listen evidence
```

The parent verifier must not send `/v1/chat/completions` or invoke any plugin.

## 12. Future S2 Success Evidence

S2 may pass only if all of these are true:

```text
core repo clean before and after: yes
external repo clean before and after: yes
server child cwd is temp and has no config.env: yes
child env built from clean allowlist: yes
child process spawned with replacement env object: yes
child env exact key set matches reviewed allowlist: yes
harness config loaded from explicit temp env path: yes
harness config path resolves under temp run root: yes
secret-like parent env inherited: no
read guard installed before startup modules loaded: yes
directory read guard installed before startup modules loaded: yes
logger writes to core DebugLog: no
repository-root config.env read attempted: no
plugin-level config.env read attempted: no
dotenv resolved only against temp cwd: yes
blacklist path redirected before startServer: yes
repository-root ip_blacklist.json read/write attempted: no
temp ip_blacklist fixture used: yes
ToolApprovalManager real config read/watch attempted: no
ToolApprovalManager stub receipt: yes
SemanticModelRouter real config read/write/watch attempted: no
SemanticModelRouter stub receipt: yes
ModelRedirect real config read attempted: no
ModelRedirect stub receipt: yes
AgentManager real map read or Agent scan/watch attempted: no
AgentManager stub receipt: yes
TvsManager real TVStxt watch attempted: no
TvsManager stub receipt: yes
ToolboxManager real map read or TVStxt watch attempted: no
ToolboxManager stub receipt: yes
dynamicToolRegistry core ToolConfigs write: no
KnowledgeBaseManager real store init: no
sarPromptManager real initialize: no
sarPromptManager sarprompt.json write attempted: no
pluginManager.loadPlugins invoked by server.js: yes
loadPlugins manifest-only registration seam active: yes
legacy plugin directory enumeration stubbed: yes
preprocessor_order real read attempted: no
preprocessor_order harness receipt: yes
JennAIGentQualityTrial registered from external package: yes
unexpected external plugins registered: no
direct service/preprocessor plugin code required: no
direct service/preprocessor module.initialize invoked: no
initializeServices real service side effects: no
static plugin startup execution: no
Python prewarm: no
EmojiListGenerator generated_lists real directory read: no
directory read receipts complete: yes
taskScheduler real initialize: no
operator VCPTimedContacts read/write: no
WebSocketServer real initialize: no
WebSocketServer post-listen interception receipt: yes
FileFetcherServer real initialize: no
FileFetcherServer .file_cache write attempted: no
FileFetcherServer post-listen interception receipt: yes
processToolCall invoked: no
executePlugin invoked: no
server/plugin child_process.spawn invoked: no
server reached app.listen: yes
bind address accepted: yes
provider/network/workflow/generation call: no
operator image path read: no
ignored runtime-state inventory changed outside allowed temp root: no
temporary evidence retained or cleaned by explicit policy: yes
```

## 13. Stop Conditions

Stop before implementing or running the harness if:

- either repository is dirty for unrelated reasons;
- core head is not `2650cd1f` or a reviewed successor;
- external package head is not `beb072b8ad1530dd62c526c71e4cc09930068685` or
  a reviewed successor;
- the S1 design is not reviewed;
- the child env cannot be constructed without inheriting secret-like parent env;
- the child spawn mechanism cannot replace the parent environment with an exact
  reviewed allowlist;
- the harness config path cannot be passed through an explicit clean child env
  key under the temp run root;
- the read guard cannot fail closed before `server.js` and startup modules load;
- the read guard does not cover `fs` callback/sync, `fs.promises`,
  FileHandle, stream, access/stat, directory enumeration, and `dotenv.config`
  read paths;
- the write guard cannot fail closed;
- the preload seam cannot intercept logger, scheduler, static execution,
  Python prewarm, plugin env loading, blacklist state, startup config watchers,
  SarPromptManager, and dynamic registry writes;
- ToolApprovalManager and SemanticModelRouter cannot be stubbed or redirected
  before they read or watch repository-root config files;
- ModelRedirect, AgentManager, TvsManager, and ToolboxManager cannot be stubbed
  or redirected before they read, scan, or watch repository/operator paths;
- legacy plugin discovery cannot use a reviewed harness manifest list without
  enumerating plugin roots;
- PluginManager preprocessor-order loading cannot be replaced with an empty
  harness-configured receipt;
- EmojiListGenerator `generated_lists` enumeration cannot be stubbed or
  redirected before `initialize()` reaches task scheduler startup;
- the write guard does not cover `fs.promises.*` and FileHandle write methods
  before startup modules bind `require('fs').promises`;
- the write guard does not reject callback/sync `fs.open` and `fs.openSync`
  calls when flags allow write, append, truncate, or create outside the temp
  run root;
- `loadPlugins` cannot be limited to reviewed manifest-only registration
  without requiring or initializing direct service/preprocessor modules;
- post-listen WebSocketServer and FileFetcherServer initialization cannot be
  stubbed or recorded before S2;
- the host bind cannot be restricted or explicitly accepted;
- the future run would require real API keys, operator image paths, provider
  calls, workflow calls, PM2, Docker, AdminPanel writes, or persistent env
  edits.

Stop during future S2 if:

- preload cannot load harness config from
  `VCP_AIGENTQUALITY_S2_HARNESS_CONFIG`;
- the harness config path is outside the temp run root;
- the observed child env contains any key outside the reviewed allowlist;
- any repository write is attempted outside the temp run root;
- any repository-root `config.env`, `.env`, plugin `config.env`, or
  secret-like file read is attempted;
- any repository directory enumeration occurs outside the reviewed allowlist or
  without a receipt;
- repository-root `ip_blacklist.json` is read or written instead of the temp
  fixture;
- ToolApprovalManager reads or watches repository-root `toolApprovalConfig.json`;
- SemanticModelRouter reads, writes, or watches repository-root
  `SemanticModelRouter.json` or its config directory;
- ModelRedirect reads repository-root `ModelRedirect.json`;
- AgentManager reads or watches repository-root `agent_map.json` or scans or
  watches the operator Agent directory;
- TvsManager watches the operator TVStxt directory;
- ToolboxManager reads or watches repository-root `toolbox_map.json` or watches
  the operator TVStxt directory;
- PluginManager reads repository-root `preprocessor_order.json`;
- PluginManager legacy discovery uses real `fs.readdir` on a core or external
  plugin root;
- EmojiListGenerator `generated_lists` is enumerated from the operator
  checkout;
- any static plugin command, Python prewarm process, or plugin process is
  spawned;
- `taskScheduler` reads or writes operator `VCPTimedContacts`;
- SarPromptManager initializes for real or writes repository-root
  `sarprompt.json`;
- `processToolCall` or `executePlugin` is invoked;
- real WebSocketServer initialization creates an upgrade server;
- FileFetcherServer initializes or writes `.file_cache` under the repository;
- an unexpected external plugin registers;
- the target external plugin fails to register;
- the server binds an unexpected address or port;
- any provider, workflow, generation, OCR, OpenPose, moderation, or operator
  image path access is observed.

## 14. S1 Result

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

## 15. Validation For This Design

Validation commands:

```powershell
git diff --check
rg -n "[ \t]+$" docs/governance/P7_AIGENTQUALITY_S1_HARNESS_DESIGN_20260615.md
node --check A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\AIGentQuality.js
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

No server process, plugin execution, provider call, workflow call, or runtime
activation is part of S1 validation.

## 16. Next Safe Action

Review this S1 design together with the S0 evidence. If accepted, open one PR
containing both docs-only commits. Do not implement or run the S2 harness until
that PR is reviewed and a later explicit S2 authorization is given.
