# M125 Plugin Runtime Registration Scoped Shadow Validation

Date: 2026-06-22

Status: PASS_SCOPED_PROCESS_ENV_NO_ENTRYPOINT_NO_REAL_CONFIG

Parent taskbook: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M124_PLUGIN_RUNTIME_REGISTRATION_DEFAULT_OFF_TASKBOOK_20260622.md`

Tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Harness: `scripts/run-plugin-runtime-registration-scoped-shadow-harness.js`

External package: `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions`

## 1. Scope

M125 validates plugin runtime registration gates with process-local env only.

It does not write real `.env` or `config.env`, start production server, call `processToolCall`, call `executePlugin`, call `initializeStaticPlugins`, call `initializeServices`, execute plugin entrypoints, modify external package content, delete core fallback, read LocalState/private content, or open upstream PRs.

## 2. Self-Review Correction From M124

The first local harness attempt used `NoopJennExternalPlugin` to prove exact-path rejection. That was too broad.

Observed result:

```text
NoopJennExternalPlugin is a valid generic external plugin fixture.
Current generic external allow policy can allow a matching source directory that contains the plugin path.
Therefore NoopJennExternalPlugin must not be used to prove package-root or plugin-root rejection.
```

M124 was corrected to use:

```text
JennAIGentOrchestrator
```

Reason:

```text
Plugin.js already has bounded exact-resolution policy for JennAIGentOrchestrator.
The exact policy rejects wildcard, name-only, path-only, package-root, plugin-root, LocalState-root, and core fallback forms.
```

No runtime module was changed for this correction.

## 3. Harness Design

The harness:

```text
saves and restores VCP_PLUGIN_ALLOWED_ROOTS
saves and restores VCP_PLUGIN_DIRS
saves and restores VCP_PLUGIN_INSTALL_DIR
saves and restores VCP_EXTERNAL_PLUGIN_ALLOWLIST
uses process-local env only
reads real external plugin manifests
uses PluginManager registration logic without calling plugin execution APIs
stubs process/tool/service/static execution entrypoints to fail if invoked
does not call loadPlugins, initializeStaticPlugins, initializeServices, startPluginWatcher, processToolCall, or executePlugin
```

The harness intentionally uses lower-level registration checks instead of full server startup so the validation stays focused on registration policy and cannot execute static plugins.

## 4. Validation Output

Command:

```text
node scripts/run-plugin-runtime-registration-scoped-shadow-harness.js
```

Result:

```text
DEFAULT_OFF_EXTERNAL_ROOT_COUNT=0
DISCOVERY_ONLY_EXTERNAL_ROOT_COUNT=1
DISCOVERY_ONLY_EXTERNAL_MANIFEST_COUNT=14
DISCOVERY_ONLY_EXTERNAL_REGISTERED_COUNT=0
INVALID_ALLOWLIST_REGISTERED_COUNT=0
EXACT_JENN_ALLOWLIST_REGISTERED_COUNT=1
EXACT_JENN_SERVICE_MODULE_COUNT=0
EXACT_JENN_MESSAGE_PREPROCESSOR_COUNT=0
DUPLICATE_CORE_NAME_REGISTERED_COUNT=0
DIRECT_OR_HYBRID_EXTERNAL_REGISTERED_COUNT=0
DIRECT_OR_HYBRID_SERVICE_MODULE_COUNT=0
DIRECT_OR_HYBRID_MESSAGE_PREPROCESSOR_COUNT=0
ENTRYPOINT_EXECUTION_COUNT=0
PROCESS_TOOL_CALL_INVOKED=no
EXECUTE_PLUGIN_INVOKED=no
INITIALIZE_STATIC_PLUGINS_INVOKED=no
INITIALIZE_SERVICES_INVOKED=no
START_PLUGIN_WATCHER_INVOKED=no
REAL_CONFIG_ENV_WRITTEN=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_CALL_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
PRODUCTION_SERVER_STARTED=no
M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION=PASS
```

## 5. Regression Tests

```text
node --check scripts/run-plugin-runtime-registration-scoped-shadow-harness.js
PASS

node tests/plugin-external-dirs.test.js
14 pass / 0 fail

node tests/plugin-external-runtime-registration-gate.test.js
6 pass / 0 fail

node tests/plugin-external-runtime-direct-policy.test.js
5 pass / 0 fail

node tests/externalPluginAllowPolicy.test.js
15 pass / 0 fail
```

Total existing plugin gate regression tests:

```text
40 pass / 0 fail
```

## 6. Safety Confirmations

```text
PROCESS_ENV_ONLY=yes
REAL_CONFIG_ENV_WRITTEN=no
PLUGIN_ENTRYPOINT_EXECUTED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_CALL_EXECUTED=no
BRIDGE_CALL_EXECUTED=no
LOCALSTATE_PRIVATE_CONTENT_READ=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
CORE_PLUGIN_FALLBACK_REMOVED=no
UPSTREAM_PR_OPENED=no
```

External package status after M125:

```text
external_package_worktree_clean=yes
```

## 7. Deferred Work

Deferred:

```text
real config plugin runtime enablement
persistent VCP_PLUGIN_ALLOWED_ROOTS / VCP_PLUGIN_DIRS / VCP_EXTERNAL_PLUGIN_ALLOWLIST writes
production server smoke with plugin runtime keys
plugin entrypoint execution validation
same-name copied plugin runtime policy changes
generic exact-path policy hardening for all external plugin names
core fallback removal/stub/untrack
upstream PR
```

## 8. Rollback

Rollback M125 by reverting:

```text
scripts/run-plugin-runtime-registration-scoped-shadow-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION_20260622.md
M125 tracker edits
```

No env, package, runtime, production, provider, bridge, or private-data rollback is required because M125 changed none of those.

## 9. Result

```text
M125_PLUGIN_RUNTIME_REGISTRATION_SCOPED_SHADOW_VALIDATION_PASS=yes
SCOPED_PROCESS_ENV_ONLY=yes
EXACT_JENN_ALLOWLIST_REGISTERED_COUNT=1
INVALID_ALLOWLIST_REGISTERED_COUNT=0
DUPLICATE_CORE_NAME_REGISTERED_COUNT=0
DIRECT_OR_HYBRID_EXTERNAL_REGISTERED_COUNT=0
ENTRYPOINT_EXECUTION_COUNT=0
REAL_CONFIG_ENV_WRITTEN=no
EXTERNAL_PACKAGE_CONTENT_MODIFIED=no
CORE_FALLBACK_REMOVED=no
UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M126_PLUGIN_RUNTIME_REGISTRATION_PERSISTENT_ENABLE_OR_CLOSEOUT_DECISION
```
