# Gate 77 | Core JennAIGentOrchestrator Plugin / Tool Extraction Design RFC

## 1. Route Identity

- Route: Route Segment 77-77R
- Gate name: Core JennAIGentOrchestrator Plugin / Tool Extraction Design RFC
- Latest sealed route: Route Segment 76-76R
- Classification: CORE_JENN_PLUGIN_TOOL_EXTRACTION_DESIGN_RFC_READY
- Recommendation if ready: RECOMMEND_GATE_78_EXTERNAL_JENN_PLUGIN_TOOL_PARITY_PROOF

Gate 77 is design RFC only. It does not implement extraction, move files,
delete code, create stubs, create redirects, migrate registries, execute runtime,
run harnesses, validate providers, contact provider endpoints, generate images,
or start runtime cutover.

## 2. Baseline

- Core branch before design: main
- Core HEAD before design: c7f27e64760caa68ccfef10b73d89f148338097f
- Core origin/main before design: c7f27e64760caa68ccfef10b73d89f148338097f
- Core worktree before design: clean
- Core ahead/behind before design: 0 / 0
- External HEAD before design: f7772c654c2d8d34698f2818fde02ec63df783cb
- External origin/main before design: f7772c654c2d8d34698f2818fde02ec63df783cb
- External worktree before design: clean
- External ahead/behind before design: 0 / 0

## 3. Gate 76 Source Review Inputs

Gate 77 uses only sealed Gate 76 source-review evidence as design input.

Extraction candidates:
- `Plugin/AIGentOrchestrator/AIGentOrchestrator.js`
- `Plugin/AIGentOrchestrator/plugin-manifest.json`
- `Plugin/AIGentOrchestrator/config.env.example`
- `Plugin/AIGentOrchestrator/README.md`
- tool dispatch for `PlanImagePipeline`, `PlanRetryPipeline`, and `HealthCheck`

VCP core service code to remain core:
- `PluginManager`
- `processToolCall`
- `executePlugin`
- generic server routes
- generic LocalState machinery
- generic downstream dispatch framework
- generic loader / watcher / hot reload behavior
- generic plugin policy framework
- generic external plugin environment sandboxing
- generic plugin callback/auth machinery

Shared boundary/helper areas:
- `Plugin.js` Jenn target constants and exact-resolution wiring
- `modules/externalPluginAllowPolicy.js`
- `evaluateExactExternalPluginResolution`
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`
- `scripts/check-prod-baseline.js`
- no-provider and provider harness scripts as proof anchors

Core fallback / rollback anchors:
- `Plugin/AIGentOrchestrator/**`
- `scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js`
- `scripts/run-jenn-aigent-orchestrator-provider-validation-harness.js`
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`
- Gate 69, Gate 72, Gate 75, and Gate 76 governance proof documents

Unsafe-to-extract-now items:
- runtime cutover behavior
- core copy deletion
- real image generation path
- downstream dispatch behavior
- LocalState behavior
- server route activation
- provider-preserving plugin execution behavior
- name/identity compatibility between `AIGentOrchestrator` and `JennAIGentOrchestrator`

External parity gaps:
- runtime cutover is not sealed
- real image generation validation is not sealed
- LocalState, downstream, and server route behavior after extraction are not sealed
- core deletion/stubbing behavior has no approved design
- `AIGentOrchestrator` to `JennAIGentOrchestrator` name/alias compatibility is not designed
- future external dependencies are unknown if real execution later expands scope

Future proof requirements from Gate 76:
- external tool parity proof
- external manifest parity proof
- provider config parity proof
- no-provider extraction proof
- provider-preserving extraction proof
- real image generation validation, later separate gate
- downstream validation, later separate gate
- LocalState validation, later separate gate
- server route validation, later separate gate
- runtime cutover design, later separate gate
- runtime cutover execution, later separate gate
- core copy removal, later separate gate

## 4. Extraction Design Map

| Current core path / item | External target path, if any | Design classification | Extraction dependency | Future proof required before change | Can move before runtime cutover | Rollback anchor | Deletion forbidden until later gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Plugin/AIGentOrchestrator/AIGentOrchestrator.js` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\AIGentOrchestrator.js` | EXTERNAL_PARITY_EXISTS_BUT_NOT_CUTOVER | formal external tool and dispatch parity proof | source hash/parity proof, no-provider extraction proof, provider-preserving extraction proof | no | yes | yes |
| `Plugin/AIGentOrchestrator/plugin-manifest.json` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\plugin-manifest.json` | SHARED_BOUNDARY_DESIGN_REQUIRED | identity and alias compatibility design | manifest parity proof, tool definition parity proof, name/alias compatibility proof | no | yes | yes |
| `Plugin/AIGentOrchestrator/config.env.example` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\config.env.example` | EXTERNAL_PARITY_EXISTS_BUT_NOT_CUTOVER | config parity proof | provider/config surface parity proof with names only | no | yes | yes |
| `Plugin/AIGentOrchestrator/README.md` | `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\README.md` | EXTRACT_LATER_AFTER_PARITY_PROOF | docs parity and operator compatibility design | README/body containment proof and operator-facing reference review | no | yes | yes |
| `PlanImagePipeline`, `PlanRetryPipeline`, `HealthCheck` tool surface | external Jenn manifest and plugin dispatch | EXTRACT_LATER_AFTER_PARITY_PROOF | external tool parity proof | manifest command parity, dispatch parity, static no-provider output parity | no | yes | yes |
| `Plugin.js` `PluginManager` host/runtime framework | none | REMAIN_CORE_SERVICE_CODE | none | no extraction proof; must remain core | no | n/a | yes |
| `Plugin.js` `processToolCall` | none | REMAIN_CORE_SERVICE_CODE | none | no extraction proof; must remain core | no | n/a | yes |
| `Plugin.js` `executePlugin` | none | REMAIN_CORE_SERVICE_CODE | none | no extraction proof; must remain core | no | n/a | yes |
| `Plugin.js` Jenn exact-resolution constants/wiring | none | SHARED_BOUNDARY_DESIGN_REQUIRED | Gate 78 parity and later cutover design | exact external resolution proof after any target/path/identity design change | no | yes | yes |
| `modules/externalPluginAllowPolicy.js` generic policy functions | none | REMAIN_CORE_SERVICE_CODE | none | generic policy regression proof if later touched | no | n/a | yes |
| `evaluateExactExternalPluginResolution` | none | SHARED_BOUNDARY_DESIGN_REQUIRED | design whether Jenn-specific options stay in `Plugin.js` or move to data config | exact-resolution regression proof | no | yes | yes |
| `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` | none | CORE_FALLBACK_ROLLBACK_ANCHOR | future replacement parity checker | new parity proof must supersede current guard | no | yes | yes |
| `scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js` | none | CORE_FALLBACK_ROLLBACK_ANCHOR | future no-provider extraction proof | no-provider extraction proof that does not execute plugin unless authorized | no | yes | yes |
| `scripts/run-jenn-aigent-orchestrator-provider-validation-harness.js` | none | CORE_FALLBACK_ROLLBACK_ANCHOR | provider-preserving extraction proof | bounded provider-preserving proof without plugin execution | no | yes | yes |
| `scripts/check-prod-baseline.js` Jenn markers | none | SHARED_BOUNDARY_DESIGN_REQUIRED | later baseline update design | baseline regression proof | no | yes | yes |
| generic server routes | none | REMAIN_CORE_SERVICE_CODE | none | separate server route validation if later needed | no | n/a | yes |
| generic LocalState machinery | none | REMAIN_CORE_SERVICE_CODE | none | separate LocalState validation | no | n/a | yes |
| generic downstream dispatch framework | none | REMAIN_CORE_SERVICE_CODE | none | separate downstream validation | no | n/a | yes |
| real image generation path | unknown | UNSAFE_TO_EXTRACT_NOW | real image generation design and validation | separate real image generation validation gate | no | yes | yes |
| operator/UI references to core tool name | unknown | UNKNOWN_NEEDS_LATER_REVIEW | operator compatibility inventory | reference and route compatibility proof | no | yes | yes |

## 5. Core Service Protection Map

The following are protected core service surfaces and are not extraction targets:

- `PluginManager`
- `Plugin.js` host/runtime framework behavior
- `processToolCall`
- `executePlugin`
- generic server routes
- generic LocalState machinery
- generic downstream dispatch framework
- generic loader / watcher / hot reload behavior
- generic plugin policy framework

Later gates must not modify these surfaces unless the gate explicitly narrows
and authorizes a specific local, reversible, tested change. Jenn extraction
should prefer moving or validating Jenn-specific plugin content, not rewriting
VCP host/runtime behavior.

## 6. External Parity Design

Gate 78 should be an external parity proof, not an implementation gate. It
should prove current external Jenn plugin parity against the core fallback
without moving files or invoking runtime.

Manifest parity:
- Compare external `plugin-manifest.json` to core `plugin-manifest.json`.
- Permit only the already-known identity divergence: core name
  `AIGentOrchestrator` and external name `JennAIGentOrchestrator`, plus the
  approved external description divergence.
- Prove entrypoint, protocol, timeout, compatibility, config schema, and
  capabilities remain equivalent.

Tool definition parity:
- Prove command identifiers match:
  - `PlanImagePipeline`
  - `PlanRetryPipeline`
  - `HealthCheck`
- Prove descriptions and required request semantics have no unreviewed
  difference.

Tool dispatch parity:
- Statically compare dispatch cases in the plugin body.
- Prove each manifest command has a dispatch path in the external plugin.
- Prove unknown command behavior remains fail-closed.

Provider config surface parity:
- Record environment variable names only.
- Prove plugin config surface remains limited to the dry-run safety config names.
- Prove provider validation harness config remains a separate proof surface and
  is not plugin runtime config.

Prompt / pipeline / orchestration parity:
- Prove planner functions and planned agent roles remain equivalent.
- Prove returned plan/audit/state field shapes are unchanged.
- Prove no static network, file write, child process, LocalState, or downstream
  dispatch calls are introduced.

Asset/resource parity:
- Prove neither core nor external plugin path contains unreviewed static assets.
- If assets appear later, require a separate asset/resource parity inventory.

Dependency parity:
- Prove external plugin still needs no external package manifest dependency.
- If future real execution introduces dependencies, require a separate
  dependency design and approval before implementation.

Path assumption parity:
- Prove exact external path remains the sealed Jenn external plugin path.
- Prove core fallback path remains present and distinct.
- Prove package-root, LocalState-root, wildcard, name-only, path mismatch, and
  manifest mismatch cases remain blocked.

Rollback/fallback parity:
- Prove core fallback content remains available and unchanged until runtime
  cutover and rollback proof are sealed.
- Prove external success claims do not rely on core fallback execution.

Gate 78 must not implement the parity proof by modifying production code. It
may create a proof document or narrow static checker only if explicitly scoped
by its task book.

## 7. Future Gate Sequence

### Gate 78: External Jenn Plugin Tool Parity Proof

- Objective: prove external manifest, tool, dispatch, config, docs, dependency,
  path, and fallback parity against the core copy.
- Allowed file scope: one governance proof document; optional static checker only
  if explicitly authorized by the Gate 78 task.
- Forbidden actions: no extraction, no file movement, no runtime execution, no
  provider validation, no image generation, no external package edits unless
  separately authorized.
- Required evidence: manifest parity, tool definition parity, dispatch parity,
  config surface parity, source/config hash parity, README parity, path/fallback
  distinction, negative policy cases.
- Stop boundary: stop after parity proof; do not start extraction.

### Gate 79: No-Provider Extraction Proof Design

- Objective: design how a future extraction can prove no-provider behavior
  without invoking provider endpoints or real runtime.
- Allowed file scope: one design document.
- Forbidden actions: no harness execution, no provider calls, no runtime dry-run,
  no plugin execution.
- Required evidence: planned no-provider proof inputs, outputs, forbidden
  boundary fields, rollback conditions.
- Stop boundary: stop before implementation or execution.

### Gate 80: No-Provider Extraction Proof Execution

- Objective: execute the approved no-provider extraction proof exactly as
  designed in Gate 79.
- Allowed file scope: one proof document and only explicitly approved checker
  updates.
- Forbidden actions: no provider validation, no image generation, no runtime
  cutover, no core deletion.
- Required evidence: external path, manifest identity, no core fallback execution,
  no processToolCall, no executePlugin unless explicitly scoped, no LocalState,
  no downstream dispatch, no server route activation.
- Stop boundary: stop after proof; do not start provider-preserving proof.

### Gate 81: Provider-Preserving Extraction Proof Design

- Objective: design a bounded provider-preserving proof that does not execute
  the plugin or generate images.
- Allowed file scope: one design document.
- Forbidden actions: no provider endpoint contact in the design gate, no plugin
  execution, no image generation, no runtime cutover.
- Required evidence: secret-safe preflight design, expected provider contract
  checks, output redaction rules, block conditions.
- Stop boundary: stop before provider contact.

### Gate 82: Provider-Preserving Extraction Proof Execution

- Objective: run the approved provider-preserving proof once, only after
  secret-safe preflight passes.
- Allowed file scope: one proof document.
- Forbidden actions: no plugin execution, no image generation, no runtime cutover,
  no LocalState writes, no downstream dispatch.
- Required evidence: provider contract matched, credential and endpoint values
  not printed, no forbidden boundary fields crossed.
- Stop boundary: stop after proof; do not start image generation validation.

### Gate 83: Real Image Generation Validation Design

- Objective: design real image generation validation as a separate high-risk
  gate.
- Allowed file scope: one design document.
- Forbidden actions: no real image generation, no provider calls, no runtime
  cutover, no core deletion.
- Required evidence: test isolation design, operator approval model, rollback
  plan, output/storage boundaries.
- Stop boundary: stop before any real generation.

### Gate 84: Real Image Generation Validation Execution

- Objective: execute the approved real image generation validation only under
  explicit current-turn authorization.
- Allowed file scope: one proof document and explicitly scoped generated
  artifact references if authorized.
- Forbidden actions: no runtime cutover, no core deletion, no unrelated provider
  or downstream tests.
- Required evidence: generation request, side-effect boundaries, artifact
  handling, failure rollback, no secret exposure.
- Stop boundary: stop after validation.

### Gate 85: Downstream Validation

- Objective: validate downstream dispatch assumptions separately from provider
  validation and image generation.
- Allowed file scope: one proof document and explicitly scoped test updates.
- Forbidden actions: no runtime cutover, no core deletion, no broad dispatch
  refactor.
- Required evidence: downstream calls are blocked or allowed only as designed,
  failure isolation, no unreviewed dispatch.
- Stop boundary: stop after downstream proof.

### Gate 86: LocalState Validation

- Objective: validate LocalState behavior and prove no unintended writes.
- Allowed file scope: one proof document and explicitly scoped local test
  fixtures.
- Forbidden actions: no production LocalState writes, no runtime cutover, no core
  deletion.
- Required evidence: LocalState paths, write/no-write assertions, cleanup and
  rollback evidence.
- Stop boundary: stop after LocalState proof.

### Gate 87: Server Route Validation

- Objective: validate any server route or operator surface affected by the
  future extraction.
- Allowed file scope: one proof document and narrow route tests if authorized.
- Forbidden actions: no production service startup, no runtime cutover, no core
  deletion.
- Required evidence: route activation state, auth boundaries, no unintended
  external writes.
- Stop boundary: stop after server route proof.

### Gate 88: Runtime Cutover Design

- Objective: design runtime cutover from core fallback to external Jenn plugin.
- Allowed file scope: one design document.
- Forbidden actions: no cutover execution, no core deletion, no provider/image
  validation bundled into this design.
- Required evidence: exact toggle or registration design, rollback path,
  operator approval points, proof prerequisites.
- Stop boundary: stop before runtime change.

### Gate 89: Runtime Cutover Execution

- Objective: execute the approved runtime cutover in a narrow reversible change.
- Allowed file scope: explicitly approved core runtime registration/config files
  and proof document only.
- Forbidden actions: no core copy deletion, no real image generation bundled with
  cutover, no broad PluginManager refactor.
- Required evidence: external plugin selected, core fallback false, rollback
  command/path, validation passed.
- Stop boundary: stop after cutover proof.

### Gate 90: Core Fallback Removal / Core Copy Deletion

- Objective: remove or retire the core fallback only after all prior proofs are
  sealed.
- Allowed file scope: core fallback files and explicit docs/tests identified by
  the Gate 90 task.
- Forbidden actions: no runtime cutover bundled with deletion, no provider/image
  validation bundled with deletion, no unrelated cleanup.
- Required evidence: all prerequisite gates sealed, external path active,
  rollback alternative exists, tree/diff limited to approved paths.
- Stop boundary: stop after deletion/removal proof; do not start unrelated cleanup.

## 8. Rollback / Fallback Design

What remains as core fallback:
- `Plugin/AIGentOrchestrator/**`
- exact fallback path references used by current proof harnesses
- copy-integrity and baseline guard assumptions
- sealed proof docs that describe the fallback boundary

How fallback must be proved false before external success claims:
- external path must be resolved as the exact sealed external Jenn plugin path
- manifest identity must match `JennAIGentOrchestrator`
- core fallback path must remain present but not selected
- policy evidence must record `coreFallback` as false
- runtime and proof outputs must not claim external success if execution or
  resolution came from `Plugin/AIGentOrchestrator/**`

Evidence needed before fallback removal:
- external parity proof sealed
- no-provider extraction proof sealed
- provider-preserving extraction proof sealed
- real image generation validation sealed, if future product claims require it
- downstream validation sealed
- LocalState validation sealed
- server route validation sealed
- runtime cutover design and execution sealed
- rollback proof proving a safe path without the core copy

What must not be deleted until runtime cutover and rollback proof are sealed:
- core plugin body
- core plugin manifest
- core plugin config example
- core plugin README
- harness scripts that rely on fallback evidence
- copy-integrity guard
- baseline markers that protect the current proof chain

## 9. Evidence Limits

- Gate 75 sealed bounded provider validation only.
- Gate 75 is not plugin execution.
- Gate 75 is not real image generation validation.
- Gate 75 is not runtime cutover.
- Gate 76 sealed source review only.
- Gate 76 is not extraction implementation.
- Gate 76 is not runtime cutover.
- Gate 76 is not real image generation validation.
- Gate 77 is design RFC only.
- Gate 77 does not authorize extraction implementation.
- Gate 77 does not authorize file movement.
- Gate 77 does not authorize deleting the core copy.
- Gate 77 does not authorize provider validation.
- Gate 77 does not authorize runtime cutover.
- Gate 77 does not authorize image generation validation.

## 10. Non-Goals

Gate 77 is not:

- extraction implementation
- file movement
- code deletion
- core copy removal
- stub implementation
- redirect implementation
- registry migration
- runtime execution
- runtime dry-run
- harness execution
- provider validation execution
- real image generation validation
- downstream validation
- LocalState validation
- server route activation
- runtime cutover
- external package modification

## 11. Blockers Identified

- Runtime cutover is not sealed.
- Real image generation validation is not sealed.
- Downstream, LocalState, and server route behavior are not sealed.
- Core fallback remains required as rollback anchor.
- Core copy deletion remains forbidden until later gates.
- Name/identity compatibility requires a future proof.
- External dependency requirements for future real execution remain unknown.

## 12. Secret Hygiene

- Environment variable names may appear as configuration surface names.
- Environment variable values are not recorded.
- Credential values are not recorded.
- Token values are not recorded.
- Raw authorization headers are not recorded.
- Provider endpoint values are not recorded.
- No secret material is intentionally included in this document.

## 13. Classification

- CORE_JENN_PLUGIN_TOOL_EXTRACTION_DESIGN_RFC_READY

## 14. Recommendation If Ready

- RECOMMEND_GATE_78_EXTERNAL_JENN_PLUGIN_TOOL_PARITY_PROOF
