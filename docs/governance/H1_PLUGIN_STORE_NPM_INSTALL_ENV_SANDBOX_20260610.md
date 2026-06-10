# H1 Plugin Store NPM Install Env Sandbox

Date: 2026-06-10

Status: hardening implementation

## 1. Purpose

Hardening-1B prevents Plugin Store `npm install` child processes from inheriting
the full VCPToolBox server environment.

Before this patch, the install flow used `env: { ...process.env }` when running
`npm install` for plugins with `package.json`. That allowed npm lifecycle
scripts to observe any secret or operator credential present in the server
process environment.

## 2. Scope

Changed files:

- `routes/admin/pluginStore.js`
- `tests/plugin-store-install-env-sandbox.test.js`
- `docs/governance/H1_PLUGIN_STORE_NPM_INSTALL_ENV_SANDBOX_20260610.md`

No Plugin Store install, upload, uninstall, server, adminServer, API probe, npm
install, release, deploy, or npm publish was performed.

## 3. Env Sandbox Contract

`buildPluginInstallEnv(baseEnv = process.env, options = {})` builds a minimal
environment for Plugin Store npm install subprocesses.

Default allowed operational keys:

- `PATH`
- `Path`
- `HOME`
- `USERPROFILE`
- `TEMP`
- `TMP`
- `TMPDIR`
- `SystemRoot`
- `windir`
- `ComSpec`
- `NO_COLOR`
- `CI`

Denied key patterns always win, case-insensitively:

- `admin.*pass`
- `password|passwd|pwd`
- `secret`
- `token`
- `api[_-]?key|apikey`
- `authorization|bearer`
- `cookie|session`
- `credential`
- `private[_-]?key`
- `github_token|gh_token`
- provider names such as `openai`, `anthropic`, `gemini`, `google`, `azure`,
  `aws`, `s3`, `slack`, `discord`, `telegram`, `dingtalk`, `feishu`, and
  `wecom`
- standalone `key`

`npm_config_*` values are not inherited by default.

## 4. Optional Allowlist

Operators may set:

```text
VCP_PLUGIN_STORE_INSTALL_ENV_ALLOWLIST=FOO,BAR
```

Allowlist behavior:

- exact key names only;
- additive only;
- no wildcard expansion;
- deny patterns still override allowlisted names;
- no legacy full-env passthrough mode is added in this patch.

## 5. Runtime Integration

`runNpmInstall()` now passes:

```js
env: buildPluginInstallEnv(process.env)
```

instead of passing the full process environment.

The npm command, arguments, cwd behavior, install-root policy, backup policy,
reload behavior, and Plugin Store API behavior are otherwise unchanged.

## 6. Log Redaction

This patch keeps the existing Plugin Store log redaction path:

- `pushLog()` scrubs npm stdout and stderr before storage and SSE replay;
- `safeErrorMessage()` scrubs thrown error messages;
- credential URLs, Bearer/Authorization values, token-like assignments, and
  absolute local paths remain redacted.

The full install environment and env values are not logged.

## 7. Compatibility Notes

The default mode is strict. Plugins whose npm lifecycle scripts require custom
non-secret environment variables may need explicit allowlisting via
`VCP_PLUGIN_STORE_INSTALL_ENV_ALLOWLIST`.

Secret-like names remain denied even when allowlisted. This is intentional:
Plugin Store installs are not allowed to receive server secrets by default.

## 8. Tests

Added tests verify:

- safe operational keys are preserved;
- secret-like keys are removed;
- optional allowlist is additive;
- deny patterns override allowlist;
- `npm_config_*` is excluded by default;
- `runNpmInstall()` passes sanitized env to a mocked spawn call;
- npm log output redacts token-like values, credential URLs, and absolute paths.

Tests do not run real npm install.

## 9. Non-Goals

Hardening-1B does not:

- change Plugin loading;
- change Admin plugin management;
- change Plugin Store install root selection;
- change SSRF policy;
- change source URL display policy;
- modify AdminPanel UI;
- read or print real `.env`, `config.env`, or `Plugin/**/config.env` contents;
- add legacy full-env passthrough mode.

## 10. Closeout Checklist

- [x] Full `process.env` inheritance removed from Plugin Store npm install.
- [x] Strict env sandbox added.
- [x] Deny patterns override allowlist.
- [x] Mocked spawn test confirms sanitized env.
- [x] Log redaction coverage added.
- [x] No real npm install performed.
- [x] No real Plugin Store install/upload/uninstall performed.
- [x] No real secrets read or printed.
