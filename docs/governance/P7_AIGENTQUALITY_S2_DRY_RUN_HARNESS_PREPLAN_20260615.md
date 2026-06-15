# P7 AIGentQuality S2 Dry-Run Harness Preplan

Date: 2026-06-15

Status: S2 preplan only. This document and its companion static preflight
script do not implement the future server harness, start `server.js`, import
`server.js`, spawn a child server process, bind a port, execute
`JennAIGentQualityTrial`, edit persistent env files, call providers, or
authorize Gate S2.

Scope:

- core repository: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox`
- branch: `codex/aigentquality-s2-server-smoke-dry-run`
- base main: `7b283ca704c541ba69270a9e86b2cd8606a71aaf`
- external package repository:
  `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`
- external package head observed for this preplan:
  `beb072b8ad1530dd62c526c71e4cc09930068685`
- target plugin: `Plugin/JennAIGentQualityTrial/`
- S0 evidence:
  `docs/governance/P7_AIGENTQUALITY_S0_PREFLIGHT_EVIDENCE_20260615.md`
- S1 design:
  `docs/governance/P7_AIGENTQUALITY_S1_HARNESS_DESIGN_20260615.md`

## 1. Goal Gate

Question:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

Answer: yes. This preplan converts the reviewed S1 design into a minimal,
repeatable local checklist before any runnable server harness exists. It keeps
the next S2 step bounded to an external `JennAIGentQualityTrial` proof while
preventing an accidental real server start or runtime activation.

## 2. Current Authorization Boundary

Allowed in this gate:

- write this S2 preplan document;
- add a static, read-only preflight script;
- read S0/S1 governance docs;
- read the external plugin manifest;
- inspect Git branch, head, and worktree state;
- report whether the future S2 parent runner and preload files are still
  absent.

Not allowed in this gate:

- `node server.js`;
- `npm start`;
- importing `server.js`;
- spawning a child server process;
- creating `scripts/aigentquality-server-smoke-s2.js`;
- creating `tests/harness/aigentquality-server-smoke-preload.js`;
- calling `pluginManager.processToolCall()` or `executePlugin()`;
- executing `JennAIGentQualityTrial`;
- binding a port;
- writing runtime state;
- editing persistent `config.env` or plugin `config.env` files;
- copying, moving, deleting, or activating plugin files;
- reading operator image directories;
- calling providers, OCR, OpenPose, moderation, CLIP, generation, or workflow
  services.

## 3. Minimal Local Artifact

This branch adds only one executable planning helper:

```text
scripts/aigentquality-server-smoke-s2-preplan.js
```

The helper is intentionally not the future S2 runner. It only checks local,
static prerequisites and prints a receipt. It must not import `server.js`, spawn
`server.js`, create a preload, execute the plugin, open a port, or write files.

The future S2 artifacts remain uncreated in this gate:

```text
scripts/aigentquality-server-smoke-s2.js
tests/harness/aigentquality-server-smoke-preload.js
```

If either future artifact appears before the S2 implementation gate, this
preplan should be treated as stale and reviewed again.

## 4. Static Receipt Fields

The preplan script must print a receipt containing at least:

```text
mode: s2-preplan-static-only
startedServer: false
importedServer: false
spawnedServer: false
executedPlugin: false
wroteFiles: false
networkOrProviderCalls: false
core branch/head/status
external package branch/head/status
S0/S1 document marker checks
target plugin manifest identity checks
future S2 artifact absence checks
strict-clean readiness if requested
default dirty-worktree allowlist result
sensitive ignored runtime inventory result
real S2 blocked reasons, if any
```

Default mode may pass only while the current branch has this preplan's own
uncommitted doc/script edits:

```text
docs/governance/P7_AIGENTQUALITY_S2_DRY_RUN_HARNESS_PREPLAN_20260615.md
scripts/aigentquality-server-smoke-s2-preplan.js
```

Any other core worktree change, including `server.js`, `config.env`, runtime
state, plugin files, generated files, or unrelated docs, must block
`PREPLAN_STATIC_READY`. A future real S2 run must require a fully clean
worktree.

The dirty-worktree check must also include scoped ignored-status inventory for
sensitive runtime/config/generated paths that plain `git status --short` hides,
including:

```text
config.env and **/config.env
ModelRedirect.json
agent_map.json
preprocessor_order.json
tag-processor-config.env
SemanticModelRouter.local.json
state/
DebugLog/
ip_blacklist.json
VectorStore
Plugin/EmojiListGenerator/generated_lists/
Plugin/**/state/
Plugin/**/*.sqlite, Plugin/**/*.sqlite-shm, Plugin/**/*.sqlite-wal,
Plugin/**/*.db
Plugin/OneRing/data/
Plugin/ProjectAnalyst/database/
ToolConfigs/dynamic_tool_catalog.json
ToolConfigs/dynamic_tool_categories.json
```

If any scoped ignored runtime artifact exists, default mode must block
`PREPLAN_STATIC_READY` and include the ignored-status receipt entries. The
script must not read file contents from these paths.

## 5. Manifest Identity Checks

The static preplan must verify the external package manifest at:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentQualityTrial\plugin-manifest.json
```

Required values:

```text
name: JennAIGentQualityTrial
pluginType: synchronous
entryPoint.type: nodejs
entryPoint.command: node AIGentQuality.js
communication.protocol: stdio
configSchema.AIGENT_QUALITY_EXTERNAL_VISION.default: false
commands: InspectImage, InspectBatch, BuildRetryPlan, HealthCheck
```

This does not execute the manifest entry point.

## 6. Future S2 Minimum Sequence

Future S2 remains a separate implementation gate. The smallest reviewed S2 path
should be:

1. Keep the current static preplan passing.
2. Implement `tests/harness/aigentquality-server-smoke-preload.js` with
   fail-closed guards and reviewed stubs from S1.
3. Implement `scripts/aigentquality-server-smoke-s2.js` as the parent verifier
   that creates a temp run root, replacement child env, harness config, and
   receipt path.
4. Run the future child process only with explicit S2 authorization.
5. Stop after listen evidence and post-listen stub receipts; do not execute
   plugin commands.
6. Verify receipts, process exit, repository diffs, and ignored runtime
   inventory.

## 7. Future S2 Must Still Prove

The future real dry-run harness cannot pass unless all reviewed S1 success
evidence is present, including:

```text
child env built without spreading process.env
server reached app.listen: yes
listen host constrained to 127.0.0.1 or localhost-only equivalent
read guard installed before startup modules loaded: yes
directory read guard installed before startup modules loaded: yes
write/watch guard installed before startup modules loaded: yes
repository-root config.env read attempted: no
plugin-level config.env read attempted: no
no secret-like env key inherited
ToolApprovalManager real config read/watch attempted: no
SemanticModelRouter real config read/write/watch attempted: no
adminPanelRoutes stub receipt: yes
codexOAuthResponses stub receipt: yes
EmbeddingUtils stub receipt: yes
image-rating route stub receipt: yes
legacy plugin directory enumeration stubbed: yes
EmojiListGenerator generated_lists real directory read: no
taskScheduler.initialize intercepted: yes
WebSocketServer post-listen interception receipt: yes
FileFetcherServer post-listen interception receipt: yes
JennAIGentQualityTrial manifest discovered from external package: yes
core Plugin/AIGentQuality fallback used: no
plugin command executed: no
provider/network call: no
repository dirty after run: no
```

This preplan does not claim any of those runtime facts. It only checks that the
reviewed S1 design still names them before later implementation.

## 8. Stop Conditions

Stop before future S2 implementation if:

- S0 or S1 governance docs are missing;
- S1 no longer says `S2 authorized: no` before this gate;
- the external manifest identity differs from the expected
  `JennAIGentQualityTrial` stdio plugin;
- `AIGENT_QUALITY_EXTERNAL_VISION.default` is not `false`;
- a future S2 artifact already exists without a reviewed implementation gate;
- the static preplan would need to import or spawn `server.js`;
- the next step requires runtime activation, remote writes, provider access,
  secret changes, file moves, file deletion, or overwriting user-owned work.

## 9. Local Validation

Planned validation for this gate:

```powershell
node --check .\scripts\aigentquality-server-smoke-s2-preplan.js
node .\scripts\aigentquality-server-smoke-s2-preplan.js --json
git diff --check
```

Expected result:

```text
static preplan script syntax: pass
static preplan receipt in a clean checkout: PREPLAN_STATIC_READY
static preplan receipt with sensitive ignored runtime artifacts:
  PREPLAN_STATIC_BLOCKED
real server start: not run
server import: not run
plugin execution: not run
provider/network call: not run
S2 authorization: not granted
```

## 10. Current Gate Result Template

After validation, record the result as:

```text
S2 preplan doc written: yes/no
static preplan script written: yes/no
server started: no
server imported: no
server spawned: no
plugin executed: no
runtime activation: no
validation command(s): <commands>
result: COMPLETED_VALIDATED / COMPLETED_UNVALIDATED / PARTIAL / BLOCKED
```
