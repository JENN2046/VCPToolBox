# P7 AIGentQuality S0 Preflight Evidence

Date: 2026-06-15

Status: S0 evidence only. This document does not authorize starting
`server.js`, running `npm start`, editing persistent env files, changing loader
priority, disabling core plugins, copying files, moving files, deleting files,
scanning operator image directories, calling providers, or activating a runtime
workflow.

Scope:

- core repository: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox`
- external package repository:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`
- external target plugin:
  `Plugin/JennAIGentQualityTrial/`
- gate source:
  `docs/governance/P7_AIGENTQUALITY_SERVER_ACTIVATION_PROPOSAL_20260615.md`

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. S0 does not activate runtime behavior. It records the exact
repository heads, plugin identity, startup risk surfaces, temporary isolation
plan, and stop conditions needed before any future server-level proof. This
keeps the Jenn extraction path reproducible and prevents a premature server
start from reading operator config or executing scheduled/plugin work.

## 2. S0 Authorization Boundary

Allowed in this gate:

- read files;
- inspect `server.js`, `Plugin.js`, `routes/taskScheduler.js`, and related
  tests;
- verify both repositories are clean and on expected heads;
- choose candidate temporary directories and candidate test ports without
  creating, binding, or using them;
- write this docs-only evidence record.

Not allowed in this gate:

- `node server.js`;
- `npm start`;
- PM2 or Docker start;
- importing `server.js`, because it calls `startServer()` at module top level;
- executing `JennAIGentQualityTrial`;
- calling `pluginManager.processToolCall()` or `executePlugin()`;
- spawning plugin child processes;
- editing persistent `config.env` or plugin `config.env` files;
- reading real operator image paths;
- calling provider, OCR, OpenPose, moderation, CLIP, generation, or workflow
  services;
- writing runtime state outside this docs-only governance record.

## 3. Repository Evidence

Core repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: codex/aigentquality-s0-preflight
head: f35bd937a758247eb4f0a4447d8defcbc1678d60
head source: PR #264 squash merge
PR #264 state: MERGED
PR #264 mergedAt: 2026-06-15T11:57:45Z
worktree at S0 start: clean
```

External package repository:

```text
path: A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
branch: main
head: beb072b8ad1530dd62c526c71e4cc09930068685
worktree at S0 start: clean
```

The core head is a reviewed successor of the original server activation
proposal base because PR #264 merged the docs-only server activation gate into
`main`.

## 4. Target Plugin Evidence

Target plugin:

```text
external plugin path:
  A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial
manifest name: JennAIGentQualityTrial
plugin type: synchronous
entry point: node AIGentQuality.js
communication protocol: stdio
external vision default: false
```

Expected file set:

```text
Plugin/JennAIGentQualityTrial/AIGentQuality.js
Plugin/JennAIGentQualityTrial/README.md
Plugin/JennAIGentQualityTrial/config.env.example
Plugin/JennAIGentQualityTrial/plugin-manifest.json
```

Observed SHA-256 hashes from external package `main@beb072b`:

```text
0967B4E418F73903EAA1D9E4B685EBE38588447A1D6A0B55D4657D44B7BBF823  Plugin/JennAIGentQualityTrial/AIGentQuality.js
BB71CF71060DD20B0B7CBE2BA749E7F46FCE5E9703ACE1FB007F83F8C08E4822  Plugin/JennAIGentQualityTrial/README.md
62C817C9BC627778986D32EB50AF868EF1B9352A5C1BB8FACE3A6C80E885B48C  Plugin/JennAIGentQualityTrial/config.env.example
C3640CBB7FB7AD7FD81FADB16CD273748EBE9D4974FA3AC31EFAF40578E0CEB6  Plugin/JennAIGentQualityTrial/plugin-manifest.json
```

## 5. Startup Risk Surface Evidence

The future server-level proof cannot be a direct `node server.js` run. Current
startup surfaces include:

```text
server.js:5      reads config.env through dotenv.config({ path: 'config.env' })
server.js:41     resolves AGENT_DIR_PATH fallback under core repo
server.js:85     resolves TVSTXT_DIR_PATH fallback under core repo
server.js:150    resolves KNOWLEDGEBASE_ROOT_PATH fallback under core repo
server.js:1242   defines repository-root VCPTimedContacts path
server.js:2010   calls pluginManager.loadPlugins()
server.js:2119   calls pluginManager.initializeStaticPlugins()
server.js:2121   calls pluginManager.prewarmPythonPlugins()
server.js:2161   calls taskScheduler.initialize(...)
server.js:2212   resolves CHANNELHUB_BASE_DIR fallback under core repo
server.js:2234   calls app.listen(port)
server.js:2274   calls startServer().catch(...)
Plugin.js:282    builds plugin child-process env
Plugin.js:434    initializes static plugins
Plugin.js:472    prewarms Python plugins
Plugin.js:601    loads plugin-level config.env files
Plugin.js:1069   loads plugins
routes/taskScheduler.js:143 calls pluginManager.processToolCall(...)
routes/taskScheduler.js:263 schedules all pending timed tasks
routes/taskScheduler.js:283 initializes the task scheduler
```

Implication:

```text
S0 result: direct server start remains unsafe.
Required next gate: S1 harness design.
Reason: S2 must isolate config, plugin env loading, static plugin execution,
Python prewarm, scheduler startup, runtime-state writes, and network bind
behavior before any server process starts.
```

## 6. Candidate Isolation Plan

These paths are candidate future paths only. S0 does not create them.

```text
candidate run root:
  %TEMP%\vcptoolbox-aigentquality-server-smoke\<timestamp>\
candidate cwd:
  <run root>\cwd\
candidate AGENT_DIR_PATH:
  <run root>\Agent\
candidate TVSTXT_DIR_PATH:
  <run root>\TVStxt\
candidate KNOWLEDGEBASE_ROOT_PATH:
  <run root>\dailynote\
candidate CHANNELHUB_BASE_DIR:
  <run root>\channelHub\
candidate ignored-runtime inventory root:
  <run root>\runtime-inventory\
candidate scheduler temp root:
  <run root>\VCPTimedContacts\
```

Candidate test ports checked for listening sockets at S0 time:

```text
61264: no listener observed
61265: no listener observed
61266: no listener observed
```

The final S2 gate must recheck the chosen port immediately before use. S0 does
not reserve, bind, or use any port.

Network-bind containment decision:

```text
preferred S1 outcome:
  introduce or document a reviewed host-binding test seam
fallback only with explicit later authorization:
  network-isolated environment or short local listen acceptance
```

## 7. Future Child Env Plan

The future child environment must be built from an empty or reviewed allowlist
baseline, not by spreading `process.env`.

Required future values:

```text
PORT=<free port rechecked immediately before S2>
DebugMode=false
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
VCP_PLUGIN_INSTALL_DIR=<unset>
```

S1 must define the minimal non-application environment needed for Node to
launch on Windows, such as path/system variables, without inheriting provider
keys, tokens, passwords, bearer values, API keys, cookie/session values, or
other operator secrets.

## 8. S1 Entry Blockers

Do not enter S2 until S1 resolves these blockers:

- `server.js` calls `app.listen(port)` without an explicit host argument;
- root `config.env` read is only blocked by temp cwd and must be proven;
- plugin-level `Plugin/*/config.env` loading must be disabled or inventoried;
- plugin scripts that directly resolve repository-root `config.env` must be
  disabled, intercepted, or ruled out;
- static plugin startup command execution must be disabled or intercepted;
- Python prewarm must be disabled or intercepted;
- `taskScheduler.initialize()` must be disabled/intercepted, or the scheduler
  must be redirected to an empty temporary timed-contact directory with
  before-start inventory evidence;
- ignored runtime-state writes such as `DebugLog/*` and
  `ToolConfigs/dynamic_tool_*.json` must be redirected, disabled, or
  inventoried;
- core plugin initialization side effects must be inventoried or bounded;
- the harness must prove `processToolCall invoked: no` before claiming S2
  success.

## 9. S0 Result

```text
core head is reviewed successor f35bd937: yes
external package head is beb072b: yes
no unrelated worktree changes at S0 start: yes
server process started by this gate: no
plugin execution by this gate: no
provider/network/workflow/generation call by this gate: no
operator image path read by this gate: no
persistent env file changed by this gate: no
runtime/source file copied, moved, deleted, or generated by this gate: no
docs-only governance evidence file created: yes
S2 server listen smoke authorized: no
```

## 10. Reproduction Commands

Commands used for this S0 evidence:

```powershell
git status -sb
git branch --show-current
git rev-parse HEAD
gh pr view 264 --repo JENN2046/VCPToolBox --json number,state,mergedAt,mergeCommit,headRefName,baseRefName,url

git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions status -sb
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions branch --show-current
git -C A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions rev-parse HEAD

Get-ChildItem A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial -Force
Get-Content -Raw A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\plugin-manifest.json
Get-FileHash A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\AIGentQuality.js,A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\README.md,A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\config.env.example,A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\plugin-manifest.json -Algorithm SHA256

rg -n "dotenv\.config|startServer\(|taskScheduler\.initialize|app\.listen|loadPlugins\(|initializeStaticPlugins|prewarm|VCP_TIMED_CONTACTS_DIR|CHANNELHUB_BASE_DIR|AGENT_DIR_PATH|TVSTXT_DIR_PATH|KNOWLEDGEBASE_ROOT_PATH" server.js Plugin.js routes/taskScheduler.js modules/channelHub/ChannelHubService.js modules/dynamicToolRegistry.js
rg -n "VCP_PLUGIN_ALLOWED_ROOTS|VCP_PLUGIN_DIRS|VCP_EXTERNAL_PLUGIN_ALLOWLIST|allowConfigEnv|_loadPluginEnvConfig|_buildPluginProcessEnv|external_runtime_allowlist_required|external_runtime_exact_allowlist_required" Plugin.js modules tests

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 61264,61265,61266 }
```

Validation commands for this docs-only artifact:

```powershell
git diff --check
rg -n "[ \t]+$" docs/governance/P7_AIGENTQUALITY_S0_PREFLIGHT_EVIDENCE_20260615.md
```

Additional non-server validation run for this S0 evidence:

```powershell
node --check A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\AIGentQuality.js
node --test tests/plugin-external-dirs.test.js tests/plugin-external-runtime-registration-gate.test.js tests/externalPluginAllowPolicy.test.js tests/plugin-external-runtime-direct-policy.test.js
```

Observed result:

```text
external plugin syntax check: pass
external plugin policy tests: pass, 40/40
server start: no
plugin execution: no
```

## 11. Next Safe Action

Prepare S1 harness design as a separate docs-only review. S1 should define the
test seam or harness strategy for config isolation, static plugin interception,
Python prewarm interception, scheduler isolation, ignored runtime-state
inventory, clean child env construction, and network-bind containment. Do not
start S2 server listen smoke until S1 is reviewed.
