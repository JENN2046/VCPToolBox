# Jenn Extraction External Plugin G2 Allow Policy Preflight - 2026-06-08

This package is docs-only. It does not modify `Plugin.js`, does not read
`process.env`, does not block or allow plugin registration, does not execute
plugin entrypoints, and does not change external plugin runtime behavior.

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `f1c028c3` / `origin/main` after #225 |
| Current branch | `codex/external-plugin-safety-gate-g2-allow-policy-preflight-20260608` |
| Prior packages | #224 external plugin safety-gate design, #225 G1 audit-only classifier |
| Package type | docs-only design/preflight |

G1 added `modules/externalPluginSafetyGate.js` and tests. It classifies
external plugin manifests as `would_block` without changing
`PluginManager.loadPlugins()` behavior.

G2 is the first layer that can change behavior for users who configure
`VCP_PLUGIN_DIRS`. This preflight splits the remaining work into a pure local
policy helper package and a separately approved enforcement package.

## 2. Current Local Reality

`Plugin.js` currently loads external legacy plugins through this path:

1. `_getExternalLegacyPluginDirs()` parses `VCP_PLUGIN_DIRS`.
2. `_discoverLegacyPluginManifestsFromDir(externalDir, 'external')` reads
   `plugin-manifest.json` files and labels manifests with
   `pluginSource: 'external'`.
3. `_discoverLegacyPluginManifests()` appends external manifests after built-in
   legacy manifests.
4. `loadPlugins()` registers each manifest through `_registerLocalPlugin()`.
5. `_registerLocalPlugin()` stores the manifest and, for direct script
   preprocessors/services, can `require()` the plugin script during
   registration.

This means an enforcement gate must run after external manifests are discovered
and before `_registerLocalPlugin()` is called. Running it later would be too
late for direct script plugins because registration itself can load code.

## 3. Risk Being Closed

The #224 design requires external plugin approval to bind both:

- the plugin `name`;
- the reviewed source directory that supplied the manifest.

A name-only allow policy is unsafe when multiple `VCP_PLUGIN_DIRS` roots are
configured. Any configured external directory could provide a manifest with the
same name.

The G2 gate must therefore compare normalized absolute paths as part of the
policy decision:

```text
ExternalEcho@A:\VCPExternal\plugins
```

should not allow:

```text
ExternalEcho@D:\OtherExternalPlugins
```

## 4. Package Split

### G2A - Pure Allow Policy Helper

Allowed without runtime behavior change:

- create a pure parser/evaluator module;
- accept raw policy text from the caller instead of reading `process.env`;
- parse entries in the shape `PluginName@SourceDirectory`;
- reject name-only entries;
- reject empty names, empty paths, filesystem roots, and broad wildcard
  entries;
- normalize source directories with `path.resolve()`;
- evaluate a G1 classification result against the parsed policy;
- return structured decisions such as `would_allow` or `would_block`;
- add tests with inert strings and temp-path-style inputs only.

Suggested file scope:

```text
modules/externalPluginAllowPolicy.js
tests/externalPluginAllowPolicy.test.js
docs/governance/JENN_EXTRACTION_EXTERNAL_PLUGIN_G2_ALLOW_POLICY_PREFLIGHT_20260608.md
```

Suggested module surface:

```js
parseExternalPluginAllowPolicy(rawPolicy, options)
evaluateExternalPluginAllowPolicy(classification, policy, options)
```

Suggested parser output:

```js
{
  entries: [
    {
      pluginName: "ExternalEcho",
      sourceDirectory: "A:\\VCPExternal\\plugins",
      normalizedSourceDirectory: "A:\\VCPExternal\\plugins"
    }
  ],
  errors: [
    {
      entry: "ExternalEcho",
      reason: "missing-source-directory"
    }
  ]
}
```

Suggested evaluation output:

```js
{
  pluginName: "ExternalEcho",
  basePath: "A:\\VCPExternal\\plugins\\ExternalEcho",
  decision: "would_allow" | "would_block" | "observe",
  matchedPolicy: {
    pluginName: "ExternalEcho",
    normalizedSourceDirectory: "A:\\VCPExternal\\plugins"
  } | null,
  reasons: [
    "external plugin matched explicit name and source directory policy"
  ]
}
```

G2A must not:

- read `process.env`;
- modify `Plugin.js`;
- block or allow registration;
- load plugin code;
- read plugin files;
- print env/config values;
- treat plugin names alone as sufficient approval.

### G2B - PluginManager Registration Enforcement

Requires separate explicit approval because it changes runtime behavior:

- read the reviewed env surface, likely `VCP_EXTERNAL_PLUGIN_ALLOWLIST`;
- classify external manifests during `loadPlugins()`;
- evaluate the allow policy before `_registerLocalPlugin()`;
- skip or block unallowed external manifests before registration;
- emit path/name/reason-only audit evidence.

Suggested minimal insertion point:

```text
PluginManager.loadPlugins()
  -> discover modern manifests
  -> register modern manifests unchanged
  -> discover legacy + external manifests
  -> classify/evaluate external manifests
  -> register only allowed external manifests
```

Do not move the gate into execution dispatch. The gate is for registration and
loading only. Tool approval and human approval for live side effects remain
separate layers.

## 5. Path Matching Rules

Minimum matching rules for G2A/G2B:

- compare exact plugin names after trimming;
- normalize policy source directories and manifest `basePath` with
  `path.resolve()`;
- allow a plugin only when the manifest `basePath` is inside the allowed source
  directory for that same plugin name;
- reject `*`, `.`-only, filesystem roots, path-only, and name-only allow
  entries by default;
- treat POSIX roots, Windows drive roots, and Windows UNC share roots as too
  broad for source-directory approval;
- preserve parse errors as audit evidence without treating them as allow rules.

Open decision for implementation review:

- whether Windows path comparison should case-fold normalized paths.

The conservative default is to case-fold only for comparison on Windows
platforms and keep the original normalized path in evidence.

## 6. Validation Plan

For this docs-only preflight:

```powershell
git diff --name-status
git diff --stat
git diff --check
```

For a future G2A pure helper package:

```powershell
node --check modules/externalPluginAllowPolicy.js
node --check tests/externalPluginAllowPolicy.test.js
node --test tests/externalPluginAllowPolicy.test.js
node --test tests/externalPluginSafetyGate.test.js
git diff --check
```

For a future G2B enforcement package, add focused tests that use inert
manifests and temporary directories only. Do not run tests that execute real
external plugins, shell/file/bridge plugins, live external writes, `.env`,
`config.env`, or operator data.

## 7. Approval Boundaries

Requires explicit approval before implementation:

- `G2B` registration enforcement;
- any `Plugin.js` runtime behavior change;
- reading a new env var inside runtime code;
- blocking or allowing external plugin registration;
- changing `ToolApprovalManager`;
- changing plugin execution dispatch;
- committing, pushing, opening a PR, or writing to any remote service.

Does not require G2B approval if kept pure and local:

- `G2A` policy parser/evaluator module;
- inert unit tests for parser/evaluator behavior;
- docs updates that clarify boundaries.

## 8. Stop Conditions

Stop before implementation if the next change requires:

- direct edits to plugin execution dispatch;
- external plugin code execution;
- reading real env/secret/config/operator data in tests;
- bridge enablement;
- runtime/state/cache/log/image/operator data changes;
- broad refactors;
- replacing the existing `VCP_PLUGIN_DIRS` parser;
- allowing plugin names without reviewed source directories.

## 9. Rollback

Rollback for this preflight is deleting this document.

Rollback for a future G2A helper package should remove the helper and tests
only.

Rollback for G2B enforcement must be a separate reviewed rollback because it
will change runtime registration behavior.

## 10. Recommended Next Package

Proceed next with **G2A pure allow policy helper + tests** only.

Do not wire enforcement into `PluginManager.loadPlugins()` until G2A behavior is
reviewed and G2B registration enforcement is explicitly approved.
