# M89 Plugin Shadow / Default-Off Validation Receipt

Date: 2026-06-22

Status: PLUGIN_SHADOW_DEFAULT_OFF_VALIDATION_PASS

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M88_PLUGIN_COPY_FIRST_RECEIPT_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M89 validates that the M88 external plugin copy-first wave is complete as package content, but remains default-off and is not mistaken for runtime registration.

M89 does not:

- enable `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_PLUGIN_INSTALL_DIR`, or `VCP_EXTERNAL_PLUGIN_ALLOWLIST`;
- write real `.env`, `config.env`, secret, token, credential, auth, or provider material;
- execute external plugin entry points;
- start production server, bridge runtime, provider runtime, or live external writes;
- read or migrate LocalState/private/operator content or `.agent_board/**`;
- delete, untrack, stub, or remove core `Plugin/**`;
- open upstream PR.

## 2. Repository State

```text
core_repo=A:\AGENTS_OS_Workspace\runtime\VCPToolBox
core_branch=codex/m2-m7-jenn-external-runtime-roadmap
core_pre_M89_head=9735b6b6f5cc01917508811889f109375bb31c6a
core_worktree_status=clean

external_repo=A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
external_branch=main
external_head=ed8544f5feaafebbfeb029be2601a490249c3a71
external_worktree_status=clean
```

## 3. External Package Integrity

```text
external_plugin_directory_count=14
copied_wave_directory_count=9
copied_wave_missing_count=0
plugin_manifest_missing_count=0
all_plugin_file_count=87
copied_wave_file_count=67
plugin_path_risk_count=0
copied_wave_path_risk_count=0
manifest_verify_count=126
manifest_verify_bad=0
manifest_sha256=b178eb30bdb73be4aea6c41604655c35580c77d7ce0c52712a8a95b43a1acb97
```

External `Plugin/` directories present:

```text
AIGentOrchestrator
AIGentPrompt
AIGentQuality
AIGentStyle
AIGentWorkflow
CodexMemoryBridge
DingTalkCLI
DingTalkTable
ImageAutoRegister
ImageRatingManager
JennAIGentOrchestrator
JennAIGentQualityTrial
NoopJennExternalPlugin
PhotoStudioAssetArchive
```

The nine M88 copied plugin directories are present and have no path-risk findings.

## 4. Real Config Presence Check

The real `config.env` was checked only by key line counts. Values were not printed.

```text
VCP_PLUGIN_ALLOWED_ROOTS=0
VCP_PLUGIN_DIRS=0
VCP_PLUGIN_INSTALL_DIR=0
VCP_EXTERNAL_PLUGIN_ALLOWLIST=0
```

This means the real local config does not currently enable external plugin discovery roots, external plugin install root, or external plugin runtime registration allowlist.

## 5. Shadow Runtime Registration Check

A temporary in-process PluginManager state was used with:

```text
external_root=[external]/Plugin
VCP_EXTERNAL_PLUGIN_ALLOWLIST=unset in process only
```

The harness read external plugin manifests from the real external package and attempted registration under the no-allowlist default-off condition. It did not execute plugin entry points.

Result:

```text
discovered_manifest_count=14
copied_wave_manifest_count=9
attempted_registration_count=14
registered_count=0
plugin_map_size=0
service_module_map_size=0
message_preprocessor_map_size=0
allowlist_required_warning_count=13
```

Interpretation:

- package/discovery visibility exists for the external `Plugin/` package;
- runtime registration remains blocked without an exact external allowlist;
- direct/hybrid/runtime maps remain empty;
- discovery success is not treated as runtime registration success.

## 6. Regression Tests

```text
node tests/plugin-external-dirs.test.js
tests=14 pass=14 fail=0

node tests/plugin-external-runtime-registration-gate.test.js
tests=6 pass=6 fail=0

node tests/plugin-external-runtime-direct-policy.test.js
tests=5 pass=5 fail=0

node tests/externalPluginAllowPolicy.test.js
tests=15 pass=15 fail=0
```

Total:

```text
plugin_shadow_default_off_tests=40
plugin_shadow_default_off_failures=0
```

## 7. Safety Counters

```text
external_package_modified=no
core_plugin_modified=no
runtime_env_enabled=no
external_plugin_runtime_registered=no
external_plugin_entrypoint_executed=no
provider_call_executed=no
bridge_call_executed=no
live_external_write_executed=no
production_server_started=no
LocalState_private_content_read=no
.agent_board_copied_checksummed_migrated=no
upstream_pr_opened=no
```

## 8. Decision

M89 is PASS for plugin shadow/default-off validation.

The external plugin package is complete enough to be considered copied package content, but it is still not active runtime. Any future runtime-on plugin gate must separately authorize and validate:

1. exact external root allowlist;
2. exact plugin runtime allowlist entries;
3. duplicate-name behavior;
4. direct/hybrid denial behavior;
5. rollback by removing env keys;
6. no provider/bridge/live-write expansion.

## 9. Rollback

Rollback M89 by reverting this receipt and tracker updates.

No external package commit, real config write, runtime registration, or core plugin mutation was performed in M89.
