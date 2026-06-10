# H1 Plugin Store NPM Install Env Sandbox Remote Receipt

Date: 2026-06-10

Status: remote receipt

## 1. Purpose

This receipt records that H1 blocking #1, Plugin Store npm install env sandbox,
has landed on `origin/main`.

The receipt is conversation-aligned governance evidence. It does not change
runtime behavior, Plugin Store behavior, install roots, Admin APIs, or frontend
code.

## 2. Remote Receipt

Remote head:

```text
b6d2aadeec5cdc155011e12442e1d836973cf89e
```

Included commit:

```text
b6d2aade fix(plugin-store): sandbox npm install env
```

Changed files in the included commit:

- `docs/governance/H1_PLUGIN_STORE_NPM_INSTALL_ENV_SANDBOX_20260610.md`
- `routes/admin/pluginStore.js`
- `tests/plugin-store-install-env-sandbox.test.js`

## 3. Baseline Verification

Baseline verification after remote push:

| Check | Result |
| --- | --- |
| `HEAD` | `b6d2aadeec5cdc155011e12442e1d836973cf89e` |
| `origin/main` | `b6d2aadeec5cdc155011e12442e1d836973cf89e` |
| `refs/heads/main` | `b6d2aadeec5cdc155011e12442e1d836973cf89e` |
| ahead / behind | `0 / 0` |
| worktree | clean |

## 4. Closed Blocking Item

H1 blocking #1 is closed:

- `runNpmInstall()` no longer passes full `process.env` to npm install.
- Plugin Store npm install uses a strict sanitized environment.
- Deny patterns override the optional allowlist.
- `npm_config_*` is not inherited by default.
- Tests use a mocked spawn and do not run real npm install.

## 5. Not Performed

The following were not performed:

- release
- deploy
- npm publish
- real Plugin Store install
- real Plugin Store upload
- real Plugin Store uninstall
- real npm install
- server/adminServer/API probe
- reading or printing real `.env`, `config.env`, or `Plugin/**/config.env`

## 6. Next Gate

Recommended next gate:

```text
H1 blocking #2 | admin_command_description_managed_target
```

That gate should start from a clean synced `main` after this receipt is merged
and pushed.

## 7. Closeout Checklist

- [x] H1 blocking #1 remote head recorded.
- [x] Included commit recorded.
- [x] Changed files recorded.
- [x] Baseline verified clean and synced.
- [x] Release/deploy/npm publish not performed.
- [x] No real secrets read or printed.
