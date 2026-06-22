# M124 Plugin Runtime Registration Default-Off Taskbook

Date: 2026-06-22

Status: PASS_TASKBOOK_ONLY_NO_RUNTIME

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M123_AGGREGATE_GAP_NEXT_LANE_DECISION_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

External package: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`

## 1. Scope

M124 defines the future default-off plugin runtime registration gate.

This is taskbook-only. It does not implement plugin registration, enable `VCP_PLUGIN_DIRS`, write real `.env` or `config.env`, execute plugin entrypoints, start services, overwrite external package content, remove core fallback, read private content, or open upstream PRs.

## 2. Current Runtime Reality

Current code already separates the plugin lanes:

```text
Plugin.js
modules/pluginRootResolver.js
modules/externalPluginSafetyGate.js
modules/externalPluginAllowPolicy.js
modules/pluginRuntimeEnvSandbox.js
```

Relevant current behavior:

```text
VCP_PLUGIN_ALLOWED_ROOTS gates external roots before discovery
VCP_PLUGIN_DIRS points to external legacy plugin discovery roots
VCP_EXTERNAL_PLUGIN_ALLOWLIST gates external runtime registration
external direct or hybrid same-process plugins are blocked
duplicate built-in plugin names are blocked
external plugin config.env files are not loaded
external plugin runtime env is sandboxed
```

M89 already proved:

```text
external Plugin/ package manifests are present
discovery/package completeness is not runtime registration
no-allowlist registration count is 0
service module map count is 0
message preprocessor map count is 0
plugin shadow/default-off tests pass 40/0
real config plugin runtime key counts are 0/0/0/0
```

M119 already closed the existing-external plugin reconcile lane without overwrite or runtime registration.

## 3. Future Implementation Boundary

Any future implementation after M124 must be scoped to plugin runtime registration only.

Allowed future source files:

```text
Plugin.js
modules/pluginRootResolver.js
modules/externalPluginSafetyGate.js
modules/externalPluginAllowPolicy.js
modules/pluginRuntimeEnvSandbox.js
tests/plugin-external-dirs.test.js
tests/plugin-external-runtime-registration-gate.test.js
tests/plugin-external-runtime-direct-policy.test.js
tests/externalPluginAllowPolicy.test.js
scripts/run-plugin-runtime-registration-scoped-shadow-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION_20260622.md
```

Forbidden future source files unless a later taskbook explicitly opens them:

```text
server.js
routes/**
AdminPanel-Vue/**
Agent/**
AgentOverrides/**
Plugin/**
plugins/**
config.env
.env
LocalState/**
.agent_board/**
VCPToolBox-JENN-Extensions/Plugin/**
```

`Plugin/**/dist/**` must not be blanket ignored or stripped. If a plugin declares `dist` as runtime source, future checksum and registration gates must keep it.

## 4. Future Default-Off Rules

Default-off means:

```text
VCP_PLUGIN_ALLOWED_ROOTS unset => external root discovery blocked
VCP_PLUGIN_DIRS unset => no external legacy plugin roots are scanned
VCP_EXTERNAL_PLUGIN_ALLOWLIST unset => discovered external manifests are not registered
VCP_PLUGIN_INSTALL_DIR unset => plugin store installs stay on core legacy behavior
```

Discovery-on but registration-off means:

```text
VCP_PLUGIN_ALLOWED_ROOTS=<external package root>
VCP_PLUGIN_DIRS=<external package root>/Plugin
VCP_EXTERNAL_PLUGIN_ALLOWLIST unset
expected_external_manifest_discovery_count > 0
expected_external_runtime_registration_count = 0
expected_plugin_map_external_count = 0
```

Registration-on in a future scoped gate must use exact plugin-name plus exact plugin path:

```text
PluginName@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\PluginName
```

Forbidden allowlist forms:

```text
*
PluginName
PluginName@*
PluginName@<external package root>
PluginName@<external package root>\Plugin
<path-only>
LocalState/**
.agent_board/**
core Plugin/**
```

## 5. Candidate Order For Future M125

M125 should be a scoped process-env-only shadow validation harness.

Recommended first candidate:

```text
JennAIGentOrchestrator
```

Rationale:

```text
external-only name
stdio command entrypoint, not direct same-process loading
existing bounded exact-resolution policy path in Plugin.js
exact target path already sealed to VCPToolBox-JENN-Extensions/Plugin/JennAIGentOrchestrator
safe to validate registration metadata without calling the entrypoint
```

`NoopJennExternalPlugin` may remain a generic package-shape fixture, but it must not be used to prove package-root or plugin-root allowlist rejection unless a later policy-hardening gate extends exact-path enforcement to all external plugin names.

Same-name copied plugins such as `AIGentPrompt`, `AIGentStyle`, `AIGentWorkflow`, `AIGentQuality`, `ImageAutoRegister`, `ImageRatingManager`, `DingTalkCLI`, `DingTalkTable`, and `CodexMemoryBridge` must not be registered in M125 because duplicate core-name behavior is intentionally blocked.

## 6. Required M125 Validation

M125 must prove all of the following with process-local env only:

```text
default_off_external_root_count=0
discovery_only_external_manifest_count>0
discovery_only_external_registered_count=0
invalid_allowlist_registered_count=0
exact_jenn_allowlist_registered_count=1
duplicate_core_name_registered_count=0
direct_or_hybrid_external_registered_count=0
entrypoint_execution_count=0
processToolCall_invoked=no
executePlugin_invoked=no
initializeStaticPlugins_invoked=no
initializeServices_invoked=no
real_config_env_written=no
provider_call_executed=no
bridge_call_executed=no
LocalState_private_content_read=no
production_server_started=no
```

The harness may call `loadPlugins()` only if it stubs or instruments process spawning and plugin execution methods so that entrypoint execution count is provably zero.

The harness must not call:

```text
processToolCall
executePlugin
initializeStaticPlugins
initializeServices
startPluginWatcher
server initialization
production server start
```

## 7. Rollback Requirements

Future scoped rollback must:

```text
save original process.env values for VCP_PLUGIN_ALLOWED_ROOTS, VCP_PLUGIN_DIRS, VCP_PLUGIN_INSTALL_DIR, and VCP_EXTERNAL_PLUGIN_ALLOWLIST
restore or delete those process.env values at the end of the harness
clear require cache only for harness-local modules if needed
leave real config.env and .env untouched
leave external package content untouched
leave core Plugin/** untouched
```

If any future gate writes real config, it must be a separate real-config unlock decision with explicit current-turn authorization.

## 8. Stop Conditions

Stop before M125 implementation if:

```text
external package worktree is dirty with unrelated changes
registration validation requires real config.env or .env edits
registration validation requires production server startup
registration validation requires executing plugin commands or direct modules
duplicate core-name registration is needed to pass
allowlist would need wildcard, package-root, name-only, or path-only semantics
LocalState/private/.agent_board paths appear in the proposed root or allowlist
core fallback removal is proposed
upstream PR is proposed
```

## 9. M124 Result

```text
M124_PLUGIN_RUNTIME_REGISTRATION_DEFAULT_OFF_TASKBOOK_PASS=yes
TASKBOOK_ONLY=yes
REGISTRATION_IMPLEMENTED=no
VCP_PLUGIN_DIRS_ENABLED=no
VCP_EXTERNAL_PLUGIN_ALLOWLIST_ENABLED=no
PLUGIN_ENTRYPOINT_EXECUTED=no
REAL_CONFIG_ENV_WRITTEN=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
CORE_PLUGIN_MODIFIED=no
CORE_FALLBACK_REMOVED=no
PRIVATE_CONTENT_READ=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION
```
