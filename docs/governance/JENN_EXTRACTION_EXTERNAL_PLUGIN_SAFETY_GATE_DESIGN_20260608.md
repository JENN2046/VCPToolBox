# Jenn Extraction External Plugin Safety Gate Design - 2026-06-08

## 0. Scope

This document is a docs-only design package for the next Jenn extraction track
after PR #223.

It does not change:

- `Plugin.js`
- plugin discovery, registration, initialization, or execution behavior
- `.env`, `config.env`, or plugin config values
- runtime/cache/state/log/image/operator data
- AdminPanel, Agent loading, LocalState, or modern `plugins/registry.json`
- branch, remote, PR, deployment, or production state

## 1. Current Baseline

Current `main` includes the minimal `VCP_PLUGIN_DIRS` legacy discovery package:

```text
c99724b34bed7cff4a994e122a47b3c29538215d docs: close out jenn extraction plan state
a64b7846756a548a306f5aad1d40732ce4ffcde1 Merge pull request #223 from JENN2046/codex/jenn-extraction-readonly-preflight-20260608
```

Current merged contract:

- built-in `Plugin/` discovery runs first
- external legacy plugin directories run after built-in discovery
- external duplicate plugin names do not override already loaded built-in plugins
- missing and empty external directories are ignored
- external directory parsing supports `;`, and supports `:` when the value is
  not a Windows drive path
- discovery reads `plugin-manifest.json` and plugin config metadata, but the
  discovery tests only prove discovery itself does not execute plugin entrypoint
  code

The current package intentionally did not create a safety policy engine. It only
made external legacy plugin discovery possible when `VCP_PLUGIN_DIRS` is set.

## 2. Problem Statement

External plugin discovery is not the same as external plugin authorization.

The current system has multiple stages with different risk levels:

| Stage | Meaning | Risk |
| --- | --- | --- |
| Discovery | read external directory and parse manifests/config metadata | path disclosure, config handling, malformed manifest |
| Registration | add an external plugin manifest to the local plugin registry | tool surface expansion |
| Direct module load | require a direct service/preprocessor module | external code load |
| Initialization | call plugin initialization hooks | runtime side effects |
| Tool execution | run tool, static plugin, shell command, bridge, or external API | live side effects |

A future safety gate must make those stages explicit. It must not treat
`VCP_PLUGIN_DIRS` alone as permission to execute all discovered plugin code.

## 3. Design Goals

- Preserve built-in plugin behavior by default.
- Keep external plugin support opt-in and auditable.
- Separate external discovery from external registration, initialization, and
  execution authorization.
- Keep duplicate-name behavior conservative: built-ins remain first and are not
  overridden by external plugins.
- Keep secret handling path-only in logs and governance evidence.
- Make future enforcement testable without executing real external plugins.
- Avoid introducing low-risk auto-approval or high-autonomy execution.

## 4. Non-Goals

This design does not authorize:

- moving plugins out of the repository
- deleting, stubbing, or replacing in-repo plugins
- enabling external Agent directories
- enabling AdminPanel extension loading
- migrating LocalState or operator/private state
- supporting external modern `plugins/registry.json`
- changing ToolApprovalManager policy
- bypassing human approval
- allowing external shell/file/bridge writes by default
- running real external plugin code in tests

## 5. Proposed Gate Model

The safety gate should be introduced in stages.

### G1 - Audit-Only Classification

First implementation package should classify external legacy plugin manifests
without changing current runtime behavior.

Suggested decision shape:

```ts
{
  pluginName: string,
  pluginSource: "legacy" | "external" | "modern",
  basePath: string,
  isExternal: boolean,
  duplicateOfBuiltIn: boolean,
  pluginType: string | null,
  communicationProtocol: string | null,
  entryPointKind: "script" | "command" | "unknown",
  risk: "metadata_only" | "loads_code" | "executes_process" | "unknown",
  decision: "observe" | "would_allow" | "would_block",
  reasons: string[]
}
```

G1 should not execute plugin entrypoints and should not print env/config values.
It may log only path names, plugin names, source labels, and summarized
classification reasons.

### G2 - Explicit Allow Policy

Enforcement requires separate approval because it changes behavior for users who
set `VCP_PLUGIN_DIRS`.

A safe enforcement package should be deny-by-default for external plugins unless
an explicit allow policy is present. The minimum policy should identify plugin
names and expected source directories. Broad wildcards should be rejected by
default.

Suggested policy surface for later review:

```text
VCP_EXTERNAL_PLUGIN_ALLOWLIST=ExternalEcho@A:\VCPExternal\plugins;ExternalSearch@D:\ReviewedVcpPlugins
```

Each entry should bind the plugin name to the reviewed external source
directory that may provide it. A name-only allow entry is not sufficient when
multiple `VCP_PLUGIN_DIRS` roots are configured, because any configured root
could otherwise provide the same plugin name.

Policy matching should use normalized absolute paths. A plugin should be allowed
only when both the manifest `name` and discovered `basePath` match an allowed
name/source-directory pair. If a plugin name matches but the source directory is
different, the enforcement package should block registration and report a
path-only reason.

The policy should be scoped to registration/loading only. It must not replace
tool approval, command approval, or human approval for live side effects.

### G3 - Execution Evidence Integration

If enforcement is adopted, approval evidence should preserve whether a tool came
from a built-in or external plugin.

Useful evidence fields:

```ts
{
  pluginSource?: "legacy" | "external" | "modern",
  isExternalPlugin?: boolean,
  externalPluginBasePath?: string
}
```

Do not record raw args, env values, tokens, config contents, or secret-like
values.

## 6. Recommended First Implementation Package

Recommended next package after this docs-only design:

```text
external plugin safety-gate audit-only classifier
```

Suggested narrow file scope:

```text
modules/externalPluginSafetyGate.js
tests/externalPluginSafetyGate.test.js
tests/plugin-external-dirs.test.js
docs/governance/JENN_EXTRACTION_EXTERNAL_PLUGIN_SAFETY_GATE_DESIGN_20260608.md
```

Expected behavior:

- pure classifier module
- no file writes
- no plugin execution
- no external service calls
- no default behavior change in `PluginManager.loadPlugins()`
- tests use temporary directories and inert manifests only

## 7. Approval Boundaries

Requires explicit approval before implementation:

- blocking or allowing external plugin registration
- requiring new env vars for external plugins
- changing `PluginManager.loadPlugins()` behavior
- reading a workspace-external ZIP package
- migrating, copying, deleting, or stubbing plugin content
- changing ToolApprovalManager behavior
- committing, pushing, opening a PR, or writing to any remote service

Requires explicit approval before validation:

- any test that executes real external plugin code
- any test that runs shell/file/bridge/external-write plugins
- any test that reads real `.env`, `config.env`, or operator data

## 8. Validation Plan

For this docs-only package:

```powershell
git diff --name-status
git diff --stat
git diff --check
```

For a future G1 audit-only classifier package:

```powershell
node --check modules/externalPluginSafetyGate.js
node --check tests/externalPluginSafetyGate.test.js
node --test tests/externalPluginSafetyGate.test.js
node --test tests/plugin-external-dirs.test.js
git diff --check
```

Do not run tests that execute real external plugins, shell/file/bridge tools, or
live external writes.

## 9. Rollback

Rollback for this docs-only package is removing this file.

Rollback for a future G1 implementation package should remove the classifier and
tests only. It should not require plugin migration cleanup because G1 must not
move, copy, delete, or execute plugin content.
