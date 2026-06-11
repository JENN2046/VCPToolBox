# External Runner Boundary RFC

Date: 2026-06-11
Status: RFC only
Priority: P2 release-gate governance

## Purpose

This RFC defines what VCPToolBox must mean by "untrusted external plugin
runner" before the project describes external plugins as sandboxed.

Current external stdio/static runtime hardening is a trusted-adapter boundary:

- external plugin registration requires an explicit allow policy;
- external stdio/static child processes receive a narrowed environment;
- external direct/hybrid same-process runtime is denied by default.

That is useful, but it is not an untrusted sandbox. The current process still
runs as the VCPToolBox service user and can use the service user's filesystem,
network, local sockets, CPU, memory, and process table permissions.

## Non-Goals

This RFC does not implement the runner.

This RFC does not:

- enable untrusted plugin execution;
- relax the external allowlist;
- change PluginManager dispatch;
- change Plugin Store install behavior;
- add auto-approval for low-risk plugins;
- start services, deploy, release, or run real external plugins.

## Current Boundary

External stdio/static plugins are "trusted external process" plugins when they
pass all current gates.

Current controls:

- source root must be explicitly allowlisted;
- runtime registration must match `PluginName@sourceRoot`;
- direct/hybrid same-process external plugins are denied;
- child process environment is narrowed and secret-like keys are denied;
- Admin surfaces should label the runtime as trusted external process, not
  untrusted sandbox.

Current missing controls:

- no lower-privilege OS user;
- no filesystem sandbox;
- no read-only project mount;
- no network deny-by-default policy;
- no CPU, memory, process, file descriptor, or runtime time quota boundary;
- no IPC broker with typed capabilities;
- no per-plugin audit envelope for all side effects;
- no runner image/version attestation;
- no kill/reap isolation for subprocess trees beyond the spawned process path.

## Runner Contract

An untrusted runner is only acceptable when all of the following are true.

### Identity

- Each run has a unique execution id.
- The runner records plugin name, plugin source, source root id, manifest hash,
  package hash when available, runner version, and policy version.
- The plugin cannot override its own identity evidence.

### Filesystem

- The repository and core runtime are mounted read-only.
- The plugin gets an isolated writable workspace.
- Output must be copied out through a broker that enforces path containment.
- Symlinks, hardlinks, junctions, and device files are rejected or resolved by
  a no-follow policy before brokered writes.
- The plugin cannot read `.env`, `config.env`, auth code, runtime state,
  debug logs, cache, vector stores, private stores, or unrelated plugin data by
  default.

### Environment

- Environment is deny-by-default.
- Only explicit non-secret operational keys are injected.
- Secret-like keys are denied even if requested by plugin config.
- Admin auth material is never injected into untrusted runs.

### Process

- The plugin runs outside the VCPToolBox server process.
- Direct JavaScript module loading is not allowed for untrusted plugins.
- `shell` is disabled by default; manifests must provide command and args as
  structured fields.
- Child process trees are tracked and reaped.
- CPU, wall time, memory, process count, and file descriptor limits are set.

### Network

- Network is deny-by-default.
- Outbound access requires an explicit allow policy.
- DNS, redirects, and final connection targets are policy checked.
- Localhost, private, link-local, multicast, reserved, and metadata endpoints
  are denied unless a separate reviewed broker capability exists.

### IPC And Capabilities

- Tool, file, shell, bridge, and network effects are brokered capabilities.
- Capabilities are explicit, least-privilege, and auditable.
- High-impact capabilities require operator approval.
- The runner cannot call VCPToolBridge, SnowBridge, Admin APIs, Codex memory,
  or Plugin Store internals directly.

### Output

- stdout, stderr, structured results, and errors are scrubbed before returning
  to VCPToolBox or the AI.
- Path and token patterns are redacted in diagnostics.
- Large output is capped and truncation is recorded.

### Audit

- Each run emits a side-effect summary.
- Denied capability attempts are recorded.
- The audit record does not include raw secrets, raw env values, raw source
  URLs with credentials, or raw private paths.

## Required Policy States

The project should model at least these runtime states:

- `core_same_process`: existing trusted core plugin behavior.
- `trusted_external_process`: external stdio/static adapter with env narrowing.
- `blocked_external_same_process`: external direct/hybrid denied.
- `untrusted_runner_candidate`: plugin can be evaluated but not executed.
- `untrusted_runner_enabled`: plugin runs only through the isolated runner.

Only `untrusted_runner_enabled` may be described as sandboxed.

## Minimum Acceptance Tests

Before enabling untrusted plugin execution, tests must prove:

- the runner cannot read root `.env` or `config.env`;
- the runner cannot write outside its workspace through symlink, junction, or
  hardlink tricks;
- the runner cannot access localhost/private network by default;
- the runner cannot spawn untracked long-lived child processes;
- resource limits terminate runaway CPU, memory, and output cases;
- direct/hybrid same-process manifests remain denied;
- brokered writes require explicit capability and path containment;
- diagnostics redact secrets and private paths;
- audit records contain identity, policy, outcome, denied effects, and
  truncation metadata without raw secrets.

## Migration Plan

1. Keep the current trusted external adapter lane.
2. Keep UI and docs explicit: env sandbox is not an untrusted sandbox.
3. Add runner policy types and dry-run validation before execution.
4. Add a no-op runner harness that only validates identity and policy.
5. Add isolated filesystem and env execution.
6. Add network and resource controls.
7. Add brokered capabilities.
8. Only then expose `untrusted_runner_enabled`.

## Release Gate Guidance

Until this RFC is implemented and verified:

- do not call external plugins "sandboxed";
- do not enable broad third-party Plugin Store installs as untrusted execution;
- keep external plugins described as reviewed or trusted external adapters;
- keep external direct/hybrid same-process runtime denied by default.
