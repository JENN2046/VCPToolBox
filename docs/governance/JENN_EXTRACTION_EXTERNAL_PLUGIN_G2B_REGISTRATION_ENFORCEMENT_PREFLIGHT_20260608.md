# Jenn Extraction External Plugin G2B Registration Enforcement Preflight - 2026-06-08

This package is docs-only. It does not modify `Plugin.js`, does not read new
runtime environment variables, does not block or allow registration, does not
execute plugin entrypoints, and does not change external plugin runtime
behavior.

## 1. Context

| Item | Value |
| --- | --- |
| Local base | `5ed5afa7` / `origin/main` after #226 |
| Current branch | `codex/external-plugin-safety-gate-g2b-registration-enforcement-preflight-20260608` |
| Prior packages | #224 design, #225 G1 audit classifier, #226 G2A allow-policy helper |
| Package type | docs-only design/preflight |

G2A now provides pure local helpers:

- `classifyExternalPluginManifest()` in `modules/externalPluginSafetyGate.js`;
- `parseExternalPluginAllowPolicy()` and
  `evaluateExternalPluginAllowPolicy()` in
  `modules/externalPluginAllowPolicy.js`.

G2B is the first package that may change `PluginManager.loadPlugins()` behavior.
It must remain separately approved.

## 2. Current Local Reality

External legacy plugin loading currently follows this path:

1. `_getExternalLegacyPluginDirs()` reads `VCP_PLUGIN_DIRS`.
2. `_discoverLegacyPluginManifestsFromDir(externalDir, 'external')` reads
   external `plugin-manifest.json` files and labels manifests with
   `pluginSource: 'external'`.
3. The same discovery path currently calls `_loadPluginEnvConfig()` for each
   discovered manifest, including external manifests, before registration.
4. `_discoverLegacyPluginManifests()` appends external manifests after built-in
   legacy manifests.
5. `loadPlugins()` iterates all legacy manifests and calls
   `_registerLocalPlugin()`.
6. `_registerLocalPlugin()` may `require()` direct script preprocessors/services
   during registration.

Therefore the enforcement check must happen after external manifest metadata is
read but before external plugin config is loaded and before
`_registerLocalPlugin()`. Running it after `_discoverLegacyPluginManifests()` is
too late because external `config.env` may already have been read. Running it
after registration is also too late for direct script plugins.

## 3. Proposed G2B Behavior

When `VCP_PLUGIN_DIRS` is unset, behavior should remain unchanged.

When `VCP_PLUGIN_DIRS` is set and external manifests are discovered:

- built-in legacy manifests continue to register normally;
- modern plugin manifests continue to register normally;
- external legacy manifests require an explicit allow policy;
- the allow policy must bind plugin name and reviewed source directory;
- unallowed external manifests are skipped before registration;
- unallowed external manifests must be skipped before their `config.env` or
  plugin-specific env/config values are read;
- skipped manifests emit name/path/reason-only audit evidence;
- plugin env/config values and raw args must not be logged.

Proposed env surface for implementation review:

```text
VCP_EXTERNAL_PLUGIN_ALLOWLIST=ExternalEcho@A:\VCPExternal\plugins;ExternalSearch@D:\ReviewedVcpPlugins
```

This preflight does not add or read that env var.

## 4. Minimal Implementation Shape

Suggested imports in `Plugin.js`:

```js
const { classifyExternalPluginManifest } = require('./modules/externalPluginSafetyGate');
const {
  parseExternalPluginAllowPolicy,
  evaluateExternalPluginAllowPolicy
} = require('./modules/externalPluginAllowPolicy');
```

Suggested new constant:

```js
const EXTERNAL_PLUGIN_ALLOWLIST_ENV = 'VCP_EXTERNAL_PLUGIN_ALLOWLIST';
```

Suggested helper boundary:

```js
_filterLegacyPluginManifestsByExternalAllowPolicy(manifests)
```

Expected helper behavior:

```text
legacy or modern source -> keep
external source metadata + matched allow policy -> keep and load config later
external source metadata + no matched allow policy -> skip before config read
external source metadata + invalid/broad allow policy -> skip before config read
duplicate external name that is already registered -> still skipped by existing
  loadPlugins() duplicate check before registration
```

The helper should return both:

- `allowedManifests`;
- `decisions` or summarized audit evidence for skipped external manifests.

Do not store raw manifest env/config values in decisions.

The implementation must not use `pluginSpecificEnvConfig` to decide whether an
external manifest is allowed. For external manifests, `pluginSpecificEnvConfig`
should remain empty or absent until after the allow decision passes.

## 5. Insertion Point

Recommended minimal insertion point:

```text
const builtInLegacyManifests =
  await this._discoverLegacyPluginManifestsFromDir(LEGACY_PLUGIN_DIR, 'legacy');
const externalLegacyMetadata =
  await this._discoverExternalLegacyPluginManifestMetadata();

const {
  allowedManifests: allowedLegacyManifests,
  decisions: externalAllowPolicyDecisions
} =
  this._filterLegacyPluginManifestsByExternalAllowPolicy([
    ...builtInLegacyManifests,
    ...externalLegacyMetadata
  ]);

for (const manifest of allowedLegacyManifests) {
  if (manifest.pluginSource === 'external') {
    manifest.pluginSpecificEnvConfig =
      await this._loadPluginEnvConfig(manifest.basePath, manifest.name);
  }
}

for (const manifest of allowedLegacyManifests) {
  if (this.plugins.has(manifest.name)) continue;
  await this._registerLocalPlugin(manifest, discoveredPreprocessors, modulesToInitialize);
}
```

`externalAllowPolicyDecisions` should be consumed only for sanitized audit or
debug evidence. It must not affect the iteration target, and it must not include
raw manifest env/config values.

The future implementation may use a different helper name than
`_discoverExternalLegacyPluginManifestMetadata()`, but the key contract is that
external metadata discovery reads only the manifest JSON, name, source label,
base path, entrypoint, communication metadata, and non-secret manifest fields
needed by the classifier. It must not call `_loadPluginEnvConfig()` before the
allow filter.

This keeps execution dispatch unchanged. The gate is registration/loading only.

## 6. Test Plan

Future G2B implementation should use inert manifests and temporary directories
only.

Minimum targeted tests:

1. Built-in legacy manifests still register normally when no external dirs are
   configured.
2. External command plugin without allow policy is skipped before registration.
3. External direct script plugin without allow policy is skipped and its script
   is not required.
4. External plugin without allow policy and with `config.env` is skipped without
   reading that config file.
5. External plugin with matching `PluginName@SourceDirectory` policy loads
   config only after the allow decision passes, then registers.
6. Same external plugin name from a different source directory is skipped.
7. Name-only, wildcard, filesystem-root, and malformed policies do not allow
   registration.
8. Skipped decision evidence does not include `pluginSpecificEnvConfig` values.
9. Existing duplicate-name behavior remains preserved.

Suggested validation commands:

```powershell
node --check Plugin.js
node --check modules/externalPluginSafetyGate.js
node --check modules/externalPluginAllowPolicy.js
node --check tests/plugin-external-dirs.test.js
node --test tests/externalPluginSafetyGate.test.js
node --test tests/externalPluginAllowPolicy.test.js
node --test tests/plugin-external-dirs.test.js
git diff --check
```

Do not run tests that execute real external plugin code, shell/file/bridge
plugins, live external writes, `.env`, `config.env`, or operator data.

## 7. Approval Boundary

Requires explicit approval before implementation:

- modifying `Plugin.js`;
- adding `VCP_EXTERNAL_PLUGIN_ALLOWLIST` runtime reads;
- blocking or allowing external plugin registration;
- changing PluginManager registration behavior;
- adding or changing runtime logs;
- committing, pushing, opening a PR, or merging.

Still forbidden for G2B:

- changing plugin execution dispatch;
- changing `ToolApprovalManager`;
- changing shell/file/bridge execution semantics;
- auto-approving live side effects;
- reading external plugin `config.env` before an allow decision passes;
- reading unallowed external plugin config/env data;
- reading or printing env/config/secret/operator data in tests.

## 8. Rollback

Rollback for this docs-only preflight is deleting this document.

Rollback for future G2B implementation should revert only the `Plugin.js`
metadata discovery / registration filter and related tests. It must not require
plugin migration, content deletion, or external directory cleanup.

## 9. Recommended Next Step

Stop here for review.

If G2B is explicitly approved, proceed with a narrow implementation package that
modifies only `Plugin.js` and focused tests around external registration
filtering. Do not connect the gate to execution dispatch.
