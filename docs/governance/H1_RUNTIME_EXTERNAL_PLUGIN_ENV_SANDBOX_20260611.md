# H1 Runtime External Plugin Env Sandbox

Date: 2026-06-11
Mode: narrow backend runtime hardening

## Purpose

This patch prevents explicitly runtime-allowed external stdio/static plugins
from inheriting the full VCPToolBox server process environment.

The previous H1 runtime registration gate made external plugin runtime
registration fail closed unless `VCP_EXTERNAL_PLUGIN_ALLOWLIST` matched
`PluginName@sourceRoot`. This patch keeps that gate and narrows the environment
given to external child processes after they are explicitly allowed.

## Scope

Changed files:

- `modules/pluginRuntimeEnvSandbox.js`
- `Plugin.js`
- `tests/plugin-external-runtime-env-sandbox.test.js`
- `docs/governance/H1_RUNTIME_EXTERNAL_PLUGIN_ENV_SANDBOX_20260611.md`

No Plugin Store backend, Admin backend, AdminPanel, server startup, release,
deploy, npm publish, or real external plugin execution is part of this patch.

## Sandbox Contract

Core plugin runtime behavior remains unchanged.

External legacy plugins with `pluginSource: "external"` use
`buildExternalPluginRuntimeEnv()` for stdio/static child process execution.

Default base environment keys preserved:

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

Allowed runtime-injected keys:

- `PROJECT_BASE_PATH`
- `VCP_REQUEST_IP`
- `VCP_REQUEST_SOURCE`
- `VCP_AGENT_ALIAS`
- `VCP_AGENT_ID`
- `VCP_EXECUTION_CONTEXT`
- `SERVER_PORT`
- `PYTHONIOENCODING`
- `CALLBACK_BASE_URL`
- `PLUGIN_NAME_FOR_CALLBACK`

Deny patterns always win across base env, plugin config, and runtime-injected
env:

- admin password / password / passwd / pwd
- secret
- token
- API key / apikey
- authorization / bearer
- cookie / session
- credential
- private key
- provider names such as OpenAI, Anthropic, Gemini, Google, Azure, AWS, Slack,
  Discord, Telegram, DingTalk, Feishu, WeCom
- decrypted auth code
- standalone `Key`

## Admin Auth Policy

External stdio plugins with `requiresAdmin: true` are denied before
`DECRYPTED_AUTH_CODE` is read or injected. Passing admin auth material to
external child processes is deferred.

## Direct Plugins

This patch does not sandbox external direct/hybrid plugins. Direct plugins are
same-process trusted code and remain governed by the runtime registration gate.

## Admin Runtime Trust Metadata

Admin plugin list responses expose `runtimeTrust` metadata so operators and UI
surfaces can distinguish trusted external child-process execution from a real
untrusted sandbox.

For external stdio/static plugins the metadata is:

- `boundary: "trusted_external_process"`
- `execution: "local_child_process"`
- `environmentSandbox: true`
- `processSandbox: false`
- `fileSystemSandbox: false`
- `untrustedSandbox: false`
- `warningCode: "external_process_not_untrusted_sandbox"`

This metadata is descriptive only. It does not allow a plugin to run, does not
change runtime registration, and does not add a bypass for the existing external
allowlist.

## Debug Logging

For external asynchronous stdio plugins, debug logging reports sandboxed env key
names only, not env values. Core debug behavior is unchanged.

## Tests

Targeted tests cover:

- safe operational base env keys are preserved;
- secret-like base env keys are removed;
- secret-like plugin config keys are removed;
- external stdio spawn receives sanitized env through mocked spawn;
- external static spawn receives sanitized env through mocked spawn;
- core stdio spawn keeps legacy full-env behavior;
- external admin-required stdio plugins are denied before auth code read;
- no real plugin process is executed.

## Non-Goals

- No Plugin Store changes.
- No AdminPanel changes.
- No server startup changes.
- No full sandbox for direct/hybrid same-process plugins.
- No real Plugin Store install/upload/uninstall probe.
- No real external plugin execution.
- No reading or printing real `.env`, `config.env`, or `Plugin/**/config.env`
  contents.

## Closeout Checklist

- [x] External stdio/static runtime env no longer inherits full `process.env`.
- [x] Core runtime env behavior remains unchanged.
- [x] Secret-like env keys are denied across base env, plugin config, and
      runtime-injected env.
- [x] External admin auth env injection is deferred/denied.
- [x] Tests use mocked spawn only.
- [x] No release, deploy, or npm publish performed.
