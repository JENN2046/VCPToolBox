# Gate 94C Jenn AI Image Fixture / Binding Extraction Plan

Route Segment: 94C
Title: Jenn AI Image Fixture / Binding Extraction Plan
Result: PASS
Classification: JENN_AI_IMAGE_FIXTURE_BINDING_EXTRACTION_PLAN
Mode: A1 documentation-only
Authorization token used: AUTHORIZE_ROUTE_94C_JENN_AI_IMAGE_FIXTURE_BINDING_EXTRACTION_PLAN_DOCS_ONLY

## Boundary

94C is a documentation-only extraction plan.

94C does not perform extraction.
94C does not edit runtime source.
94C does not edit tests.
94C does not edit external repo files.
94C does not remove the core copy.
94C does not modify `.disabled`.
94C does not commit or push.

## Sealed State Acknowledged

```text
93E - SEALED
94A - SEALED
94B - SEALED
```

Current repo truth:

```text
core branch: main
core HEAD / local origin/main / remote origin/main:
  2694576724bf1de1ea403a2dd1d60fe5b1f74ee0

core worktree before 94C:
  dirty only because docs/governance/GATE_94B_JENN_CORE_SURFACE_EXTRACTION_CLEANUP_TASK_BOOK_RFC.md is authorized and untracked

external repo: clean
core copy: physically retained
core copy status: reversibly disabled via Plugin/AIGentOrchestrator/.disabled
core copy physical removal: not authorized
release/tag: not authorized
```

## Purpose

94C converts the 94A inventory and 94B task-book RFC into a precise plan for a future 94D extraction proof. It defines how Jenn-specific AI Image fixture and binding data can be moved or decoupled from core runtime surfaces without doing the extraction now.

Primary target surfaces:

- `modules/aiImageJennTrialFixtures.js`
- `modules/aiImageNativeDelegateBindings.js`
- `routes/admin/aiImageAgents.js`
- `server.js` Jenn fixture binding
- `tests/aiImageJennTrialFixtures.test.js`
- `tests/aiImageAgentsRoute.test.js`
- `tests/aiImageAgentsServerBinding.test.js`
- `tests/nativeImageDelegateRegistry.test.js`
- `tests/nativeDoubaoSecretlessRuntimeDelegate.test.js`

## Current Surface Map

### `modules/aiImageJennTrialFixtures.js`

Current role:

- side-effect-free holder for Jenn AI Image trial activation ids
- stores exact receipt refs, artifact refs, output refs, route ids, and allowed route ids
- stores `A:\agent-image-lab` project path overrides for known trial authorizations

Jenn-specific coupling:

- hardcoded Jenn trial ids and runtime-to-review fixture data
- hardcoded local machine path overrides

Runtime risk:

- low while side-effect-free
- medium if consumers begin treating the module as execution policy rather than data

Test coverage risk:

- tests assert the side-effect-free split and local path isolation
- extraction must preserve the same values or provide a compatibility adapter

Proposed future handling:

- move the data model toward an external Jenn extension adapter package
- keep core consumers behind a generic fixture/provider interface
- avoid reading LocalState or env during data loading

May 94D edit it:

- yes, only if 94D declares this exact file in its allowed file set

### `modules/aiImageNativeDelegateBindings.js`

Current role:

- side-effect-free holder for native delegate binding defaults
- exports Doubao secretless binding metadata and runtime metadata defaults

Jenn-specific coupling:

- request source and delegate metadata tied to Jenn AI Image runtime
- imported by native delegate implementation and related tests

Runtime risk:

- low while side-effect-free and redacted
- medium if moved without preserving registry import shape

Test coverage risk:

- native delegate tests expect the current binding split
- registry compatibility can regress if export names change

Proposed future handling:

- move concrete binding data to the external Jenn adapter
- keep a generic native delegate binding contract in core
- preserve redaction semantics

May 94D edit it:

- yes, only if 94D declares this exact file in its allowed file set

### `routes/admin/aiImageAgents.js`

Current role:

- generic admin route factory with Jenn trial fixture imports
- gates runtime-to-review trial internal routes via `enableRuntimeToReviewTrialInternalRoutes`

Jenn-specific coupling:

- imports `modules/aiImageJennTrialFixtures.js`
- still wires route behavior to core Jenn fixture data

Runtime risk:

- medium because it is route source
- extraction must preserve default-off behavior and avoid route activation

Test coverage risk:

- route tests cover exact payload and path behavior
- careless extraction could widen route access or change audit behavior

Proposed future handling:

- keep generic route factory in core
- pass Jenn-specific fixture data through an adapter/provider boundary
- keep trial route enablement explicit and default-off

May 94D edit it:

- yes, only if 94D declares this exact file in its allowed file set

### `server.js` Jenn Fixture Binding

Current role:

- imports `modules/aiImageJennTrialFixtures.js`
- passes `enableRuntimeToReviewTrialInternalRoutes` into the AI Image route wiring

Jenn-specific coupling:

- core server mount layer still depends on Jenn fixture module

Runtime risk:

- medium because this is server mount logic
- future edit must not start server or activate routes as validation

Test coverage risk:

- server binding tests assert fixture import and route enablement propagation

Proposed future handling:

- remove direct Jenn fixture dependency from server mount when a generic adapter hook exists
- preserve default-off behavior
- keep server validation source/test-only unless a later gate authorizes runtime checks

May 94D edit it:

- yes, only if 94D declares this exact file in its allowed file set

### `tests/aiImageJennTrialFixtures.test.js`

Current role:

- verifies Jenn trial fixture module remains side-effect-free
- verifies local path literals are isolated out of route/server source

Jenn-specific coupling:

- asserts `A:\agent-image-lab` presence inside fixture data

Runtime risk:

- none by itself

Test coverage risk:

- must be rewritten if fixture data moves out of core

Proposed future handling:

- convert to adapter contract tests or move to external adapter tests

May 94D edit it:

- yes, only if 94D declares related narrow tests in its exact file set

### `tests/aiImageAgentsRoute.test.js`

Current role:

- verifies AI image route behavior
- includes Jenn trial route cases and `A:\agent-image-lab` expected values

Jenn-specific coupling:

- exact trial payloads and local path literals

Runtime risk:

- none by itself

Test coverage risk:

- high if route source changes without targeted test updates

Proposed future handling:

- split generic route tests from Jenn adapter fixture tests
- keep route policy and audit behavior covered in core

May 94D edit it:

- yes, only if 94D declares related narrow tests in its exact file set

### `tests/aiImageAgentsServerBinding.test.js`

Current role:

- verifies server and route imports/wiring for Jenn fixture data
- verifies route enablement propagation

Jenn-specific coupling:

- direct references to current fixture module import strings

Runtime risk:

- none by itself

Test coverage risk:

- must change with any server binding extraction

Proposed future handling:

- update to assert generic adapter hook and default-off route behavior

May 94D edit it:

- yes, only if 94D declares related narrow tests in its exact file set

### `tests/nativeImageDelegateRegistry.test.js`

Current role:

- verifies native delegate registry imports Jenn binding data instead of defining literals

Jenn-specific coupling:

- references external adapter direction and Jenn binding exports

Runtime risk:

- none by itself

Test coverage risk:

- registry contract must remain covered if binding data moves

Proposed future handling:

- update to assert generic native delegate binding contract

May 94D edit it:

- yes, only if 94D declares related narrow tests in its exact file set

### `tests/nativeDoubaoSecretlessRuntimeDelegate.test.js`

Current role:

- verifies native Doubao secretless runtime delegate behavior

Jenn-specific coupling:

- related to the same Jenn AI Image delegate lane

Runtime risk:

- none by itself

Test coverage risk:

- must remain narrow and avoid provider calls

Proposed future handling:

- keep only generic delegate behavior in core tests
- move concrete adapter defaults to external adapter tests if external repo edits are later authorized

May 94D edit it:

- yes, only if 94D declares related narrow tests in its exact file set

## Extraction Strategy Options

### Option A - External Jenn Adapter Data With Core Adapter Hooks

Move Jenn fixture and binding data into the external Jenn extension package, while leaving core with generic adapter hooks and default-off route wiring.

Benefits:

- removes Jenn-specific runtime data from core
- keeps core route/server logic generic
- keeps future provider/image/LocalState behavior outside this gate

Risks:

- may require external repo edits
- may require a compatibility shim while core and external package are versioned separately
- test updates must be narrow and explicit

Recommendation:

- recommended as the long-term direction
- execute only in narrow phases

### Option B - Keep Core Fixture Modules And Abstract Local Paths

Keep the side-effect-free core modules for now, but replace hardcoded local path literals with a config abstraction.

Benefits:

- smaller near-term source change
- avoids external repo coupling in 94D
- reduces local-machine path exposure

Risks:

- leaves Jenn-specific data in core
- can turn into config churn without true extraction
- may require package/test updates

Recommendation:

- useful as 94E/94F if path abstraction is needed
- not enough as the long-term extraction direction

### Option C - Remove Core AI Image Trial Route Wiring

Remove the core Jenn trial route wiring entirely after an external operator route is proven.

Benefits:

- strongest separation from core
- reduces route-level coupling

Risks:

- high blast radius
- requires a proven external operator route first
- can break existing internal trial workflows

Recommendation:

- do not choose this for 94D
- revisit only after external operator route proof exists

### Recommended Strategy

Recommend Option A as the long-term direction, but execute in narrow phases.

94D should not edit the external repo by default. If external package changes are required, split them into a separate external-repo gate before or after 94D.

## Proposed Future 94D Scope

Future route:

```text
94D - Jenn AI Image Fixture / Binding Extraction Proof
```

Likely editable file set, subject to exact 94D authorization:

- `modules/aiImageJennTrialFixtures.js`
- `modules/aiImageNativeDelegateBindings.js`
- `routes/admin/aiImageAgents.js`
- `server.js`
- related narrow tests
- one 94D proof doc

94D must choose an exact file set before editing. It must not inherit this likely list as automatic authorization.

94D should prove:

- core no longer owns concrete Jenn trial fixture data, or the remaining core surface is explicitly generic
- route/server behavior stays default-off
- test coverage tracks the new adapter boundary
- no provider endpoint contact occurs
- no real image generation occurs
- no LocalState write occurs
- no external repo edit occurs unless separately authorized
- `Plugin.js` is unchanged
- `Plugin/AIGentOrchestrator/.disabled` remains present
- core copy remains physically retained

## Required Future 94D Safety

Future 94D must prove:

```text
no server start
no route activation
no HTTP request
no provider endpoint contact
no real image generation
no LocalState write
external repo not edited unless separately authorized
core copy remains disabled and physically retained
Plugin.js not changed
.disabled marker retained
tests updated only if explicitly scoped
```

94D must stop as BLOCK if any of these conditions require violation.

## External Repo Dependency Decision

Default decision:

```text
94D should not edit external repo.
If external package changes are required, split into a separate external-repo gate.
```

Reason:

- external repo edits are a separate side-effect domain
- 94D can first decouple core through an interface or plan a staged adapter handoff
- Commander should review the external package edit scope independently

## Local Path Handling

Known local path risks:

- `A:\agent-image-lab`
- `A:\AGENTS_OS_Workspace`
- `VCPToolBox-JENN-Extensions`
- `VCPToolBox-JENN-LocalState`

Plan:

- path abstraction should be split into 94E/94F unless directly required for 94D
- `VCPToolBox-JENN-LocalState` must remain private state and must not become a plugin root
- `A:\agent-image-lab` literals in tests and fixtures should not be broadened into runtime discovery
- non-Jenn local path hits are not blockers for 94D

## Future Validation Plan

94C does not run validation beyond documentation checks.

Future 94D may use these checks if explicitly authorized:

- `node --check` on changed JavaScript files
- targeted unit tests only
- targeted route binding tests only
- `git diff --check`
- secret-like scan over changed files

Future 94D must not run these unless separately authorized:

- server start
- HTTP route calls
- provider calls
- real image generation
- LocalState writes
- broad `npm test`
- `npm run`
- external repo mutation

## Stop / Fallback Conditions For Future 94D

Future 94D must return BLOCK if:

- extraction requires external repo edits not separately authorized
- route/server coupling cannot be changed without server activation
- test relocation requires broad package or test script changes
- LocalState or provider access is needed
- `.disabled` or core-copy state would be disturbed
- `Plugin.js` must be changed
- the exact file set cannot be narrowed before editing

## 94C Safety Confirmation

94C created only this plan.
94C did not perform extraction.
94C did not edit runtime source.
94C did not edit route source.
94C did not edit tests.
94C did not edit external repo files.
94C did not remove the core copy.
94C did not remove or modify `.disabled`.
94C did not edit `Plugin.js`.
94C did not stage, commit, push, tag, or release.
