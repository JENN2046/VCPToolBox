# Gate 94B Jenn Core Surface Extraction / Cleanup Task Book RFC

Route Segment: 94B
Title: Jenn Core Surface Extraction / Cleanup Task Book RFC
Result: PASS
Classification: JENN_CORE_SURFACE_EXTRACTION_CLEANUP_TASK_BOOK_RFC
Mode: A1 documentation-only
Authorization token used: AUTHORIZE_ROUTE_94B_JENN_CORE_SURFACE_EXTRACTION_CLEANUP_TASK_BOOK_RFC_DOCS_ONLY

## Boundary

94B is a documentation-only planning layer.

94B does not perform extraction.
94B does not perform cleanup.
94B does not remove the disabled core copy.
94B does not remove or modify `.disabled`.
94B does not edit `Plugin.js`.
94B does not touch external repo files.
94B does not commit or push.

## Sealed State Acknowledged

```text
93A - SEALED
93B - SEALED
93C - SEALED
93D - SEALED
93E - SEALED
94A - SEALED
```

Current repo truth:

```text
core branch: main
core HEAD / local origin/main / remote origin/main:
  2694576724bf1de1ea403a2dd1d60fe5b1f74ee0

core worktree before 94B: clean
external repo: clean
core copy: physically retained
core copy status: reversibly disabled via Plugin/AIGentOrchestrator/.disabled
core copy physical removal: not authorized
release/tag: not authorized
```

## 94A Inventory Summary

94A inventoried the remaining Jenn core surfaces without modifying files.

```text
total matched files reviewed: 143
governance/proof docs: 109
bounded proof harnesses: 10
runtime/source surfaces: 6
disabled fallback/core-copy surfaces: 5
hardcoded local path surfaces: 94
unexpected surfaces: 0
```

94A concluded that the inventory is clean enough to plan a narrow follow-up gate. It did not authorize extraction, cleanup, physical retirement, config abstraction, tag, release, commit, or push.

## Surface Buckets

### Bucket A - Keep Sealed Artifacts

These surfaces are evidence or governance records. They should remain unless a later Commander route explicitly authorizes documentation cleanup.

- `docs/governance/GATE_92*.md`
- `docs/governance/JENN_*.md`
- `docs/JENN_EXTERNAL_RUNTIME_ALLOWLIST_CONTRACT.md`
- `scripts/run-jenn-aigent-orchestrator-*.js`
- `scripts/p3-external-ecosystem-inventory.js`
- relevant governance assertions in `scripts/check-prod-baseline.js`

Default handling: keep as sealed artifacts.

### Bucket B - Keep Runtime Patch

These surfaces are current runtime safety controls created or retained by the sealed extraction path.

- `Plugin.js`
- `modules/externalPluginAllowPolicy.js`

Current role:

- `Plugin.js` keeps exact Jenn external path constants, core fallback path constants, external resolution wiring, and `.disabled` loader skip behavior.
- `modules/externalPluginAllowPolicy.js` keeps exact external Jenn policy validation and rejects package-root, LocalState-root, wildcard, and name-only allowlists.

Default handling: keep until a separate runtime safety review authorizes changes.

### Bucket C - Disabled Rollback Anchor

These surfaces keep the reversible fallback copy physically available while disabled.

- `Plugin/AIGentOrchestrator/.disabled`
- `Plugin/AIGentOrchestrator/plugin-manifest.json`
- `Plugin/AIGentOrchestrator/AIGentOrchestrator.js`
- `Plugin/AIGentOrchestrator/config.env.example`
- `Plugin/AIGentOrchestrator/README.md`

Default handling:

- keep `.disabled`
- keep the physical core copy
- do not remove or re-enable the core copy in 94B
- physical retirement requires later 94G/94H gates

Rollback command remains:

```powershell
Remove-Item Plugin\AIGentOrchestrator\.disabled
```

## Future Route Plan

The following gates are proposed but not executed by 94B.

```text
94C - Jenn AI Image Fixture / Binding Extraction Plan
94D - Jenn AI Image Fixture / Binding Extraction Proof
94E - Hardcoded Local Path Config-Abstraction Plan
94F - Hardcoded Local Path Config-Abstraction Proof
94G - Disabled Core Copy Physical Retirement RFC
94H - Disabled Core Copy Physical Retirement Proof
94I - Governance / Legacy Docs Cleanup Plan
94J - Governance / Legacy Docs Cleanup Proof
```

The gates must stay narrow and ordered. Runtime/source coupling should be planned before physical core-copy retirement. Documentation cleanup should happen after runtime surfaces are settled.

## Extraction Candidates

### `modules/aiImageJennTrialFixtures.js`

Current role:

- stores Jenn AI image trial activation ids
- stores exact receipt/output references
- stores `A:\agent-image-lab` project path overrides
- is side-effect-free and contains no route activation by itself

Why it remains in core:

- existing route/server/tests depend on this shared fixture module
- previous gates split the data out of route/server implementation but did not yet move it to an external adapter

Future extraction risk:

- route behavior and tests may depend on exact constants
- extraction must preserve side-effect-free behavior
- extraction must not introduce LocalState writes or provider contact

Future validation needed:

- source inspection
- targeted route binding tests, if later authorized
- no real provider/image/LocalState execution

Recommended next gate:

- 94C

### `modules/aiImageNativeDelegateBindings.js`

Current role:

- stores Jenn AI image native delegate registration defaults
- stores Doubao secretless delegate binding metadata
- remains side-effect-free

Why it remains in core:

- native image delegate registry still imports this binding data
- prior split isolated the literals but did not relocate them to the external adapter

Future extraction risk:

- registry compatibility can regress if exports or identifiers change
- provider-binding references must remain redacted

Future validation needed:

- native delegate registry source review
- targeted delegate binding tests, if later authorized

Recommended next gate:

- 94C

### `routes/admin/aiImageAgents.js`

Current role:

- imports `modules/aiImageJennTrialFixtures.js`
- contains gated runtime-to-review trial route wiring
- does not run during 94B

Why it remains in core:

- core still owns the generic admin route factory and policy hook integration
- Jenn trial data is currently passed into this route from core fixture modules

Future extraction risk:

- route schema and audit hooks must remain generic
- extraction must not activate trial routes by default

Future validation needed:

- route source review
- targeted route tests, if later authorized

Recommended next gate:

- 94C

### `server.js` Jenn Fixture Binding

Current role:

- imports `modules/aiImageJennTrialFixtures.js`
- passes `enableRuntimeToReviewTrialInternalRoutes` into AI image route wiring

Why it remains in core:

- server mount wiring still references the core fixture module

Future extraction risk:

- mount behavior can change if fixture source or enable flag handling changes
- must preserve default-off behavior

Future validation needed:

- server binding source review
- targeted server binding test, if later authorized

Recommended next gate:

- 94C

### Related Tests

Candidate test surfaces:

- `tests/aiImageJennTrialFixtures.test.js`
- `tests/aiImageAgentsRoute.test.js`
- `tests/aiImageAgentsServerBinding.test.js`
- `tests/nativeImageDelegateRegistry.test.js`
- `tests/nativeDoubaoSecretlessRuntimeDelegate.test.js`

Current role:

- preserve side-effect-free fixture behavior
- preserve route/server binding expectations
- preserve native delegate import boundaries
- include some `A:\agent-image-lab` expected literals

Why they remain in core:

- tests still verify current core ownership and split boundaries

Future extraction risk:

- tests must move or be rewritten with the implementation
- test updates must not hide behavior changes

Future validation needed:

- targeted tests only, if later authorized

Recommended next gate:

- 94C

## Physical Retirement Candidates

Physical retirement is not authorized by 94B.
Physical retirement requires a separate RFC and proof gate.
The core copy must remain physically present until that later gate.

Candidates:

- `Plugin/AIGentOrchestrator/AIGentOrchestrator.js`
- `Plugin/AIGentOrchestrator/config.env.example`
- `Plugin/AIGentOrchestrator/README.md`
- `scripts/jenn-extraction-audit-readonly.ps1`
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`

Notes:

- `Plugin/AIGentOrchestrator/.disabled` remains the rollback anchor.
- `Plugin/AIGentOrchestrator/plugin-manifest.json` remains useful for rollback verification while the core copy is retained.
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` may become retirement or cleanup material only after the physical retirement route is approved.

Recommended retirement RFC gate:

- 94G

Recommended retirement proof gate:

- 94H

## Config Abstraction Candidates

Candidates:

- `modules/aiImageJennTrialFixtures.js` `A:\agent-image-lab` path overrides
- `tests/aiImageAgentsRoute.test.js` `A:\agent-image-lab` literals
- `plugins/registry.json` `A:\docs` `source_guide`
- `Plugin/vcp-dingtalk-adapter` local path references

Decision:

- Non-Jenn local path hits are not blockers for Jenn extraction.
- They should be routed to a separate config-abstraction gate if pursued.
- Jenn trial path literals should be planned with runtime/source extraction, then abstracted in 94E/94F if needed.

Recommended config abstraction plan gate:

- 94E

Recommended config abstraction proof gate:

- 94F

## Documentation Cleanup Candidates

Candidates:

- `docs/governance/JENN_*` legacy extraction docs
- `README.AGENTS_OS.md` Jenn core patch notes
- `package.json` Jenn-related test naming after extraction/test relocation
- old gate docs that become superseded after runtime/source extraction and physical retirement

Decision:

- do not clean documentation in 94B
- do not clean documentation before runtime/source surfaces are settled
- keep sealed governance artifacts as evidence unless a later Commander route authorizes cleanup

Recommended documentation cleanup plan gate:

- 94I

Recommended documentation cleanup proof gate:

- 94J

## HOLD / No-Action Surfaces

The following surfaces should not be touched in the next execution gate:

- `Plugin.js`
- `.disabled` loader patch
- `Plugin/AIGentOrchestrator/.disabled`
- `docs/governance/GATE_92*.md`
- `docs/JENN_EXTERNAL_RUNTIME_ALLOWLIST_CONTRACT.md`
- `modules/externalPluginAllowPolicy.js`

Default recommendation:

- keep as sealed artifacts or runtime safety surfaces
- do not alter unless a separate Commander route authorizes cleanup or runtime safety review

## Required Planning Decision

Recommended next execution line:

```text
94C - Jenn AI Image Fixture / Binding Extraction Plan
```

Reason:

- it targets live runtime/source Jenn coupling first
- it avoids touching the disabled core fallback copy
- it avoids premature physical retirement
- it avoids documentation churn before runtime surfaces are settled
- it creates a safer plan before any implementation proof gate

Immediate 94H physical retirement is explicitly rejected unless Commander separately authorizes it.

## 94B Safety Confirmation

94B created only this RFC.
94B did not edit runtime source.
94B did not edit route source.
94B did not edit tests.
94B did not edit scripts.
94B did not remove the core copy.
94B did not remove or modify `.disabled`.
94B did not edit `Plugin.js`.
94B did not edit external repo files.
94B did not stage, commit, push, tag, or release.
