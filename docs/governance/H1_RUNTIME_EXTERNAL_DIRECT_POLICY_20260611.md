# H1 Runtime External Direct/Hybrid Execution Policy (2026-06-11)

## Purpose

This patch implements a security boundary between:

- external plugin discovery + stdio/static runtime execution (legacy allowlist-driven), and
- external same-process direct/hybrid runtime execution.

## Risk and Findings

Before this hardening, an allowlisted external plugin with `communication.protocol=direct`
could be registered and loaded in-process if its `entryPoint.script` was accepted by the plugin
allowlist check.

Residual external direct/hybrid risk before this patch:

- external plugin code could run `require()` inside the main process during registration;
- external same-process plugins could register service hooks that share process runtime;
- external direct/hybrid with `requiresAdmin` could consume decrypted admin auth context.

## Fix

- External direct/hybrid same-process execution is denied by default in runtime registration.
- Deny condition applies to:
  - `pluginSource === 'external'`
  - `communication.protocol === 'direct'`
  - and a script entrypoint.
- Existing external stdio/static execution policy remains unchanged and still uses
  `VCP_EXTERNAL_PLUGIN_ALLOWLIST`.
- `requiresAdmin` external same-process plugins are denied with explicit admin-guard reason.
- No additional backend behavior is changed for `routes/admin` or Plugin Store code.
- No direct plugin allowlist is added in this patch (separation remains enforced).

## Behavior

- External stdio plugins:
  - still allowed when `VCP_EXTERNAL_PLUGIN_ALLOWLIST` explicitly matches `PluginName@sourceRoot`.
- External direct/hybrid plugins:
  - default deny, regardless of external allowlist match.
  - are not loaded by `require()`, not initialized, and do not register runtime modules.
- Core direct/hybrid plugins:
  - remain unchanged and still register/initialize as before.

## Reason Codes

- `external_direct_runtime_denied`
- `external_hybrid_runtime_denied`
- `external_direct_requires_admin_denied`

## Safety Notes

- Registration warning logs keep only:
  - plugin name
  - `external:...` root id
  - sanitized external display path
  - reason code
- Warning logs avoid raw absolute plugin paths and avoid env/config content.

## Compatibility

- This patch is a hardening boundary and does not enable any new external capability.
- No runtime install/upload/uninstall is performed by this patch.
- No release / deploy / publish action is performed.
