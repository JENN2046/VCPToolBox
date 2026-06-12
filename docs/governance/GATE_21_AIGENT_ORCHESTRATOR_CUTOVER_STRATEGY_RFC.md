# Gate 21｜AIGentOrchestrator Cutover Strategy RFC

## Status

Gate 21 is a documentation-only cutover strategy RFC.

This RFC is ready for review, not sealed.

## Scope

This document chooses the safest future strategy for moving the sealed external
`AIGentOrchestrator` shadow copy toward a possible active external form.

Gate 21 only records strategy. It creates no executable cutover state.

Covered:

- sealed Gate 17 through Gate 20 context;
- current same-name shadow behavior;
- future cutover options;
- future gate sequencing;
- future validation and rollback requirements;
- required future authorizations.

## Non-goals

Gate 21 does not execute cutover.

Gate 21 does not activate external `AIGentOrchestrator`.

Gate 21 does not perform temporary env discovery.

Gate 21 does not change resolver priority.

Gate 21 does not modify `Plugin.js`.

Gate 21 does not modify `modules/pluginRootResolver.js`.

Gate 21 does not delete or move the core plugin.

Gate 21 does not modify the external plugin.

Gate 21 does not write to the external package.

Gate 21 does not use Plugin Store live operations.

Gate 21 does not start `server.js`.

Gate 21 does not execute `processToolCall`.

Gate 21 does not persist `.env`, `config.env`, or `VCP_PLUGIN_*` settings.

Gate 21 does not start Gate 22.

## Sealed context

Gate 17 sealed a real external copy under:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

Gate 18 defined the shadow activation ladder and rejected shortcuts such as
priority tricks, core deletion without rollback, persistent env activation, and
Plugin Store live install/uninstall as migration shortcuts.

Gate 19 compared the core and external `AIGentOrchestrator` copies. The expected
files matched by name, length, and SHA256. The normalized manifests matched. The
external copy remained shadow-only.

Gate 20 verified, with temporary env only, that the external same-name
`AIGentOrchestrator` can be detected under the external `Plugin` root while
remaining shadow-only behind the preserved core plugin. Gate 20 also verified
core-first ordering, same-name override prevention, external package root
boundary, LocalState non-discovery, and Plugin Store install target resolution as
metadata only.

## Current state

Core plugin:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox\Plugin\AIGentOrchestrator
```

External package root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions
```

External plugin discovery root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin
```

External shadow copy:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\AIGentOrchestrator
```

Private LocalState root:

```text
A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState
```

The core and external manifests use the same plugin name:

```text
AIGentOrchestrator
```

The manifest entry command is:

```text
node AIGentOrchestrator.js
```

The manifest describes dry-run planning behavior. Its config defaults keep
`AIGENT_ORCHESTRATOR_ALLOW_EXECUTION=false` and
`AIGENT_ORCHESTRATOR_DEFAULT_MODE=dry-run`.

## Cutover problem statement

The external copy proves packaging and discovery shape, but the current
same-name state is intentionally not active.

The remaining question is how a future gate should move from "external
same-name shadow record exists" to "external package path can be tested as an
active candidate" without weakening core-first ordering, bypassing duplicate
protection, deleting the core plugin prematurely, or changing resolver behavior
casually.

## Current constraints

- Core-first ordering remains a sealed contract.
- Same-name external plugins must not override core plugin names while the core
  plugin remains present.
- External roots remain default-off unless explicitly configured.
- The recommended external discovery root is
  `VCPToolBox-JENN-Extensions\Plugin`, not the package root itself.
- `VCPToolBox-JENN-LocalState` is private local state and is not a plugin root by
  default.
- Plugin Store live install/uninstall remains out of scope for cutover strategy.
- `processToolCall` and downstream agent execution require separate high-risk
  authorization.
- Any future persistent env activation requires separate authorization and a
  rollback model.
- Any runtime resolver feature flag or priority mode is a runtime behavior
  change and requires a separate RFC.

## Strategy options

Gate 21 compares four future routes.

## Option A｜Permanent shadow-only

Keep the external `AIGentOrchestrator` copy as a same-name, sealed, shadow-only
artifact. Do not attempt active external execution.

Advantages:

- safest default;
- no runtime behavior changes;
- no env changes;
- no risk of overriding the core plugin;
- rollback is trivial because no active state is created.

Costs:

- does not prove external active execution;
- does not test operator-facing behavior from an external active plugin;
- can leave future migration work indefinitely deferred.

Gate 21 stance:

Option A remains the acceptable fallback if no active externalization is needed.

## Option B｜External rename parallel test

Create a future renamed external candidate, for example a separately authorized
`AIGentOrchestratorExternalTrial`, while preserving the core
`AIGentOrchestrator` plugin.

The renamed candidate would avoid same-name override semantics and allow a
future parallel discovery or controlled execution test without deleting the core
plugin or changing resolver priority.

Advantages:

- preserves core-first ordering;
- avoids duplicate-name override risk;
- keeps the core plugin as rollback source;
- tests the external package path without requiring runtime resolver changes;
- gives operators a distinct trial identity.

Costs:

- plugin identity differs from the production plugin name;
- command names, display name, and approval/operator surfaces must be reviewed;
- future tests must prove the renamed candidate cannot be mistaken for the core
  production plugin.

Gate 21 stance:

Option B is the recommended next experimental route.

## Option C｜Future disable/remove core with rollback

Disable, move, or remove the core `AIGentOrchestrator` so the same-name external
copy can become the active discovered plugin.

Advantages:

- preserves the production plugin name;
- most closely resembles a true migration of the existing plugin identity.

Costs:

- high rollback and operator-impact risk;
- risks accidental service loss if the external path is misconfigured;
- requires a concrete restore path for the core plugin;
- likely requires persistent env review;
- must prove no LocalState, secrets, logs, cache, or generated outputs are
  affected.

Gate 21 stance:

Option C is deferred. It must not start until after a separate high-risk RFC,
remote review, and explicit rollback rehearsal plan.

## Option D｜Future feature-flag / explicit resolver mode

Introduce a runtime feature flag or explicit resolver mode that can prefer,
select, or activate external plugins under controlled conditions.

Advantages:

- can make cutover explicit instead of relying on file movement;
- can potentially support future staged migrations beyond `AIGentOrchestrator`.

Costs:

- changes runtime behavior;
- touches resolver or plugin loading policy;
- expands policy surface and operator expectations;
- may affect Plugin Store and admin behavior;
- needs broader tests and release governance.

Gate 21 stance:

Option D requires a separate high-risk runtime RFC. It is not appropriate as the
next narrow externalization step.

## Evaluation criteria

The options are evaluated against:

- safety;
- rollback simplicity;
- upstream compatibility;
- external package purity;
- resolver contract compatibility;
- operator clarity;
- testability;
- risk of accidental activation;
- need for runtime changes;
- need for env changes;
- impact on Plugin Store behavior.

## Strategy comparison matrix

| Option | Safety | Rollback simplicity | Upstream compatibility | External package purity | Resolver contract compatibility | Operator clarity | Testability | Accidental activation risk | Runtime changes needed | Env changes needed | Plugin Store impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Permanent shadow-only | Highest | Trivial | High | High | High | Clear but inactive | Limited | Lowest | No | No | None |
| B. External rename parallel test | High | Simple | Medium-high | High | High | Clear trial identity | High | Low | No | Temporary env only in future test gates | None |
| C. Disable/remove core with rollback | Medium-low | Complex | Medium | High | Medium | Risky because name stays production-like | Medium | Medium-high | No resolver change, but filesystem/runtime state changes | Likely | Possible operator impact |
| D. Feature-flag / explicit resolver mode | Medium | Medium | Unknown until designed | Medium | Low until implemented | Potentially clear if designed well | High after implementation | Medium | Yes | Possibly | Must be reviewed |

## Recommended strategy

Recommended next experimental route:

```text
Option B｜External rename parallel test
```

Reason:

Option B allows a future external active test without weakening core-first
ordering, without bypassing same-name override prevention, and without deleting
the core plugin. It keeps the core `AIGentOrchestrator` as the active rollback
source while proving whether an external package candidate can be discovered and
validated under a distinct trial identity.

The renamed candidate must remain explicitly non-production until a later gate
authorizes execution or cutover.

## Deferred strategies

Option A remains the default safe state if Commander decides no active
externalization is needed.

Option C is deferred until a high-risk core disable/remove RFC defines:

- exact file/state change;
- rollback target;
- rollback command sequence;
- validation before and after rollback;
- operator-facing impact;
- persistent env handling, if any.

Option D is deferred until a runtime behavior RFC defines:

- resolver mode semantics;
- feature flag defaults;
- admin/operator display;
- Plugin Store interaction;
- test coverage;
- rollback behavior.

## Required future gate sequence

Recommended sequence:

```text
Gate 22｜External Rename Parallel Test RFC
Gate 23｜External Rename Copy Trial
Gate 24｜Temporary Parallel Discovery Dry Run
Gate 25｜Parallel Execution Safety RFC
Gate 26+｜Actual limited execution / cutover trial, only with separate high-risk authorization
```

Gate 21 starts none of these gates.

Gate 22 should remain documentation-only unless separately authorized otherwise.

Gate 23 should create or copy only a renamed trial candidate if explicitly
authorized.

Gate 24 may use temporary process env only if explicitly authorized and must not
persist config.

Gate 25 must decide whether any controlled execution is appropriate before any
`processToolCall`, server startup, provider call, or downstream agent invocation.

Gate 26+ must require high-risk authorization for any actual execution or active
cutover claim.

## Future validation matrix

| Validation area | Required proof | Earliest future gate |
| --- | --- | --- |
| Rename contract | Trial plugin name is distinct and cannot override core | Gate 22 |
| External package contents | Candidate contains no secrets, logs, cache, outputs, or private state | Gate 23 |
| Manifest and command identity | Renamed manifest is intentional and operator-visible | Gate 23 |
| External root mapping | `VCP_PLUGIN_DIRS` points to `VCPToolBox-JENN-Extensions\Plugin` | Gate 24 |
| Package root boundary | `VCPToolBox-JENN-Extensions` itself is not treated as plugin root | Gate 24 |
| LocalState boundary | `VCPToolBox-JENN-LocalState` is not discovered as plugin code | Gate 24 |
| Core-first order | Core `AIGentOrchestrator` remains present and first | Gate 24 |
| Duplicate protection | Same-name shadow copy remains blocked while core exists | Gate 24 |
| Trial discovery | Renamed external candidate is discoverable as a separate external record | Gate 24 |
| No execution | No `processToolCall`, provider, downstream agent, or server startup occurs | Gate 24 |
| Execution safety | Any future dry-run command execution is explicitly bounded | Gate 25 |
| Rollback | Removing or disabling trial state restores previous discovery state | Gate 25+ |

## Rollback model

For Option A:

- no active state exists;
- rollback means preserving current core-first behavior and removing no files.

For Option B:

- delete or quarantine only the renamed external trial candidate;
- clear any temporary env from the current process;
- keep the core `AIGentOrchestrator` unchanged;
- verify core repo status remains clean;
- verify external package contains no unintended runtime data;
- verify LocalState remains marker-only or explicitly classified.

For Option C:

- preserve a verified restore copy of the core plugin before any disable/remove;
- define exact restore commands before making changes;
- define persistent env rollback before activation;
- prove rollback with validation before any production activation claim.

For Option D:

- default flag state must preserve current behavior;
- rollback must disable the new mode without deleting plugins;
- tests must prove default-off behavior and prior discovery semantics.

## Risk register

| Risk | Status | Mitigation |
| --- | --- | --- |
| Same-name external copy mistaken for active | Present | Keep it shadow-only; recommend renamed parallel test for active experiments. |
| Renamed trial identity diverges from production identity | Expected | Mark future trial as non-production and require operator-facing review. |
| Core disable/remove causes service loss | Deferred high risk | Require separate RFC, rollback rehearsal, and explicit approval. |
| Resolver feature flag expands runtime policy | Deferred high risk | Require separate runtime RFC and broad tests. |
| Discovery evidence mistaken for execution approval | Present | This RFC forbids execution and requires future execution safety RFC. |
| Plugin Store live install becomes migration shortcut | Deferred | Keep live install/uninstall forbidden until separately reviewed. |
| Persistent env leaks into normal operation | Deferred | Use temporary env only in future discovery gates unless persistent env is separately authorized. |
| External package receives runtime state | Present | Keep logs, cache, outputs, secrets, and private state out of plugin package source. |

## Required future authorizations

Separate explicit authorization is required for:

- Gate 22;
- creating any renamed external candidate;
- editing any external plugin;
- writing to the external package;
- temporary env discovery;
- persistent env activation;
- `processToolCall`;
- `server.js` startup;
- provider startup/call;
- downstream agent execution;
- Plugin Store live install/uninstall/update;
- core plugin deletion, move, or disablement;
- `Plugin.js` changes;
- `modules/pluginRootResolver.js` changes;
- route or server changes;
- release, deploy, npm publish, push, PR, or merge.

## Open questions

- What exact renamed trial identity should be used if Option B is approved?
- Should the renamed trial expose the same command identifiers, or should command
  names also be trial-prefixed to reduce operator confusion?
- Should future active tests call the plugin directly as a child process, through
  `processToolCall`, or through a purpose-built harness?
- What operator UI label is required to prevent a renamed trial from being
  mistaken for production?
- What validation is sufficient before any real downstream execution is allowed?
- Should a future runtime feature flag be rejected entirely until more than one
  external plugin requires cutover?

## Boundary confirmation

Gate 21 did not start Gate 22.

Gate 21 did not perform actual cutover.

Gate 21 did not execute shadow activation.

Gate 21 did not make the external plugin active.

Gate 21 did not perform temporary env discovery.

Gate 21 did not execute plugin code.

Gate 21 did not execute `processToolCall`.

Gate 21 did not start `server.js`.

Gate 21 did not perform provider startup or provider calls.

Gate 21 did not perform Plugin Store live operations.

Gate 21 did not delete the core plugin.

Gate 21 did not move the core plugin.

Gate 21 did not modify the external plugin.

Gate 21 did not change runtime behavior.

Gate 21 did not modify `Plugin.js`.

Gate 21 did not modify `modules/pluginRootResolver.js`.

Gate 21 did not modify `server.js`.

Gate 21 did not modify routes.

Gate 21 did not activate persistent env.

Gate 21 did not edit `.env` or `config.env`.

Gate 21 did not write LocalState.

Gate 21 did not write the external package.

Gate 21 did not write external receipts.

Gate 21 did not write secrets, logs, cache, or outputs.

## Conclusion

Gate 21 recommends:

```text
Option B｜External rename parallel test
```

Option B is the safest next experiment because it can validate an external
active candidate path without weakening core-first ordering, bypassing same-name
override prevention, deleting the core plugin, changing resolver priority, or
persisting env.

The current safe state remains:

```text
core AIGentOrchestrator active; external same-name AIGentOrchestrator shadow-only
```

Gate 21 does not authorize cutover. It only prepares the strategy for review.

Gate 21 strategy RFC is ready for review, not sealed.

Do not start Gate 22.
