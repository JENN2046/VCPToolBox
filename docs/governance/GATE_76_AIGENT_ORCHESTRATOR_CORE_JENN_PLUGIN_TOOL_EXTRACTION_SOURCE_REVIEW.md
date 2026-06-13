# Gate 76 | Core JennAIGentOrchestrator Plugin / Tool Extraction Source Review

## 1. Route Identity

- Route: Route Segment 76-76R
- Gate name: Core JennAIGentOrchestrator Plugin / Tool Extraction Source Review
- Latest sealed route: Route Segment 75-75R
- Classification: CORE_JENN_PLUGIN_TOOL_EXTRACTION_SOURCE_REVIEW_READY
- Recommendation: RECOMMEND_GATE_77_CORE_JENN_PLUGIN_TOOL_EXTRACTION_DESIGN_RFC

Gate 76 is source review only. It does not authorize extraction implementation,
file movement, code deletion, registry migration, runtime execution, provider
validation, image generation validation, or runtime cutover.

## 2. Baseline

- Core HEAD before review: 91cf6cbe9019c0a031b389c2f52b7b91f64d12ad
- Core origin/main before review: 91cf6cbe9019c0a031b389c2f52b7b91f64d12ad
- Core worktree before review: clean
- Core ahead/behind before review: 0 / 0
- External HEAD before review: f7772c654c2d8d34698f2818fde02ec63df783cb
- External origin/main before review: f7772c654c2d8d34698f2818fde02ec63df783cb
- External worktree before review: clean
- External ahead/behind before review: 0 / 0

## 3. Source Review Scope

| Path | Location | Why reviewed | Key findings | Classification | Future change proposed | Edited in Gate 76 |
| --- | --- | --- | --- | --- | --- | --- |
| `Plugin/AIGentOrchestrator/AIGentOrchestrator.js` | core | Core Jenn plugin body | Dry-run planner implementation; exports `planImagePipeline`, `planRetryPipeline`, `handleRequest`; dispatches `PlanImagePipeline`, `PlanRetryPipeline`, and `HealthCheck`; no static `fetch`, `writeFile`, `appendFile`, `spawn`, or `exec` matches in the plugin body; byte-for-byte equal to the external Jenn copy. | Jenn-specific extraction candidate; core fallback / rollback anchor | Yes, later design may externalize or stub only after parity and cutover proof. | no |
| `Plugin/AIGentOrchestrator/plugin-manifest.json` | core | Core manifest/tool surface | Plugin name is `AIGentOrchestrator`; entrypoint is `node AIGentOrchestrator.js`; tool commands are `PlanImagePipeline`, `PlanRetryPipeline`, and `HealthCheck`; config schema exposes only `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION` and `AIGENT_ORCHESTRATOR_DEFAULT_MODE`. | Jenn-specific extraction candidate; core fallback / rollback anchor | Yes, later design must decide identity, alias, and rollback behavior. | no |
| `Plugin/AIGentOrchestrator/config.env.example` | core | Core provider/safety config surface | Contains only the dry-run safety defaults for `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION` and `AIGENT_ORCHESTRATOR_DEFAULT_MODE`; byte-for-byte equal to the external Jenn copy. | Jenn-specific extraction candidate; already externalized / parity exists | Yes, parity can be preserved externally; core copy remains until cutover proof. | no |
| `Plugin/AIGentOrchestrator/README.md` | core | Core plugin docs/tool examples | Documents the dry-run planner and three tool request examples; states no downstream plugin, workflow, training, or external service invocation. | Jenn-specific extraction candidate; core fallback / rollback anchor | Yes, later docs design may move or replace with redirect after cutover. | no |
| `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\AIGentOrchestrator.js` | external | External Jenn plugin body | Byte-for-byte equal to core `AIGentOrchestrator.js`; same dry-run planner and dispatch map. | already externalized / parity exists | Yes, future design can treat as current parity target. | no |
| `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\plugin-manifest.json` | external | External manifest/tool surface | Name is `JennAIGentOrchestrator`; entrypoint, protocol, config schema, and tool commands match core after allowing approved name/description divergence. | already externalized / parity exists; shared boundary needs design | Yes, later design must prove name/alias behavior before core deletion. | no |
| `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\config.env.example` | external | External config surface | Byte-for-byte equal to core config example. | already externalized / parity exists | Yes, preserve as external safety config. | no |
| `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\README.md` | external | External docs parity | Adds an external Jenn preface and then contains the core README body as suffix. | already externalized / parity exists | Yes, later design can clarify final external docs. | no |
| `Plugin.js` | core | Host runtime and Jenn exact resolution hook | Generic PluginManager, loader, watcher, `processToolCall`, and `executePlugin` remain VCP core service code. Jenn-specific constants and the call to `evaluateExactExternalPluginResolution` are narrow policy hooks for `JennAIGentOrchestrator`. | VCP core service code remain core; shared boundary/helper design required for Jenn hook | Only design-level future changes; no Gate 76 code change. | no |
| `modules/externalPluginAllowPolicy.js` | core | External plugin allow policy and exact Jenn resolver | Generic allow-policy framework plus a reusable exact-resolution helper. The helper records boundary evidence and blocks core fallback, package-root, LocalState-root, wildcard, name-only, path mismatch, and manifest mismatch cases. | shared boundary/helper, design required | Future design may keep helper in core while removing only hard-coded Jenn target wiring if safe. | no |
| `scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js` | core | Prior Stage 1-5 harness source | Contains bounded no-provider probes and Stage 5 registration dry-run logic; references external target path, core fallback path, `PlanImagePipeline`, negative policy cases, and forbidden boundary fields. Not executed in Gate 76. | core fallback / rollback anchor; unsafe to extract now | Should remain until replacement no-provider extraction proofs exist. | no |
| `scripts/run-jenn-aigent-orchestrator-provider-validation-harness.js` | core | Stage 6 provider validation harness source | Uses provider validation env variable names and bounded HTTPS provider probe logic; records false boundary fields for plugin execution, downstream dispatch, LocalState, server route activation, image generation, and runtime cutover. Not executed in Gate 76. | core fallback / rollback anchor; unsafe to extract now | Should remain until provider-preserving extraction proof and later validation strategy exist. | no |
| `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` | core | Copy-integrity/parity guard | Checks source/config byte equality, manifest equality except name/description, and README external preface/body containment; records no provider calls, no downstream dispatch, no runtime cutover, and no LocalState writes. | shared boundary/helper; rollback/parity guard | Keep until a new external parity proof supersedes it. | no |
| `scripts/check-prod-baseline.js` | core | Baseline guard referencing Jenn markers | Baseline checks preserve Jenn markers, `PlanImagePipeline`, byte-for-byte equality expectations, and no-provider / not-provider-validation boundaries. | shared baseline guard; design required | Future design must update baseline only with reviewed proof. | no |
| `docs/governance/GATE_69_AIGENT_ORCHESTRATOR_BOUNDED_RUNTIME_INTEGRATION_STATIC_OR_HARNESS_PROOF.md` | core docs | Prior exact-resolution proof | Proves positive exact allowlist and negative fail-closed cases for external Jenn runtime resolution; not provider validation and not runtime cutover. | prior evidence / rollback anchor | No change until later proof chain supersedes it. | no |
| `docs/governance/GATE_72_AIGENT_ORCHESTRATOR_BOUNDED_NO_PROVIDER_RUNTIME_REGISTRATION_DRY_RUN_EXECUTION_PROOF.md` | core docs | Prior no-provider runtime registration proof | Records PASS, exact external path, manifest identity match, core fallback false, all runtime/provider/downstream/LocalState/server/image boundaries false. | prior evidence / rollback anchor | No change until future extraction proof supersedes it. | no |
| `docs/governance/GATE_75_AIGENT_ORCHESTRATOR_BOUNDED_PROVIDER_VALIDATION_EXECUTION_PROOF.md` | core docs | Latest sealed provider validation proof | Records Stage 6 PASS, provider contract matched, no plugin execution, no image generation, no runtime cutover, and recommendation for Gate 76. | prior evidence / rollback anchor | No change. | no |

## 4. Core Jenn Plugin / Tool Inventory

Entrypoints:
- `Plugin/AIGentOrchestrator/plugin-manifest.json` declares `entryPoint.type` as `nodejs`
  and `entryPoint.command` as `node AIGentOrchestrator.js`.
- `Plugin/AIGentOrchestrator/AIGentOrchestrator.js` starts `main()` only when
  invoked as the main module and otherwise exports functions for static tests.

Manifest and config:
- Core plugin identity: `AIGentOrchestrator`.
- Version: `0.1.0`.
- Protocol: stdio.
- Timeout: `60000`.
- Config schema keys:
  - `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION`
  - `AIGENT_ORCHESTRATOR_DEFAULT_MODE`
- `config.env.example` sets dry-run defaults only and contains no credential surface.

Tool list / tool definitions:
- `PlanImagePipeline`: builds a dry-run Prompt -> Workflow -> Quality pipeline plan.
- `PlanRetryPipeline`: builds a dry-run retry workflow plan from a retry queue.
- `HealthCheck`: reports safety gate state and known agent roles.

Tool dispatch map:
- `AIGentOrchestrator.js` dispatches by request action or tool name:
  - `PlanImagePipeline` -> `planImagePipeline(request)`
  - `PlanRetryPipeline` -> `planRetryPipeline(request)`
  - `HealthCheck` -> health response
- Unknown commands return an error response; no VCP runtime dispatch is performed by the plugin body itself.

Prompts / pipelines / orchestration:
- The plugin builds planned steps for `AIGentPrompt`, `AIGentWorkflow`,
  optional `AIGentStyle`, and `AIGentQuality`.
- It returns `state_plan` and `audit_plan` sections for later integration.
- It is a planner, not an executor.

Provider adapter / provider config surface:
- The core plugin itself exposes no provider credential or endpoint config.
- The Stage 6 provider validation harness uses provider validation env variable
  names only; those names belong to proof harness config, not the plugin body.

Image generation path references:
- The planner names downstream workflow commands such as `ExecuteWorkflow`, but
  static inspection found the plugin records `real_workflow_invoked: false` and
  `external_service_called: false`.
- Gate 75 proved provider contract readiness only, not image generation.
- Real image generation validation remains a later separate gate.

Downstream references:
- The planner references downstream agent roles and planned commands, but does not
  call `processToolCall`, `executePlugin`, or downstream dispatch code.

LocalState references:
- The plugin creates a planned state/audit structure but does not persist LocalState.
- Stage 5 and Stage 6 proof surfaces keep `localStateWrites` false.

Server route references:
- No plugin-specific server route was identified under the core plugin path.
- Generic server routes remain VCP core service code.

Static assets / resources:
- No static asset files were found under `Plugin/AIGentOrchestrator/**`.
- Core tracked files under the plugin path are exactly:
  - `AIGentOrchestrator.js`
  - `README.md`
  - `config.env.example`
  - `plugin-manifest.json`

Dependencies:
- The plugin body uses built-in Node APIs only in the reviewed source.
- No package manifest dependency change is needed for Gate 76.

Tests / harnesses / proofs:
- `scripts/run-jenn-aigent-orchestrator-no-provider-runtime-harness.js` covers
  prior bounded no-provider probes and Stage 5 registration dry-run.
- `scripts/run-jenn-aigent-orchestrator-provider-validation-harness.js` covers
  Stage 6 provider validation.
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` covers source,
  config, manifest, and README parity rules.
- `scripts/check-prod-baseline.js` includes Jenn / `PlanImagePipeline` baseline markers.
- Required prior proof docs reviewed: Gate 69, Gate 72, Gate 75.

Copy-integrity / parity scripts:
- Source and config are byte-for-byte equal between core and external Jenn paths.
- Manifest parity permits only `name` and `description` divergence.
- README parity permits an external Jenn preface followed by the core README body.

## 5. External Plugin Parity Inventory

External entrypoints:
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\plugin-manifest.json`
  declares `node AIGentOrchestrator.js`.

External manifest / config:
- External plugin identity: `JennAIGentOrchestrator`.
- Entry point, stdio protocol, timeout, config schema, compatibility, and tool
  commands match core after the approved name/description divergence.

External tool list / definitions:
- `PlanImagePipeline`
- `PlanRetryPipeline`
- `HealthCheck`

External provider config surface:
- External plugin config surface matches core and contains only:
  - `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION`
  - `AIGENT_ORCHESTRATOR_DEFAULT_MODE`
- No external provider endpoint or credential config was found in the external
  plugin body or manifest during this static review.

External prompts / pipelines / orchestration:
- `AIGentOrchestrator.js` is byte-for-byte equal to the core plugin body, so
  planner behavior and dispatch map are currently equivalent.

External assets / resources:
- No static assets were found under the external Jenn plugin path.

External dependencies:
- No package manifest exists at the external package root.
- External plugin code uses the same built-in Node API surface as the core copy.

Parity matches:
- Plugin source: byte-for-byte match.
- Config example: byte-for-byte match.
- Manifest: identical except approved `name` and `description` identity divergence.
- README: external preface plus core README body.
- Tool commands: match.
- Entrypoint: match.
- Config schema: match.

Parity gaps:
- Runtime cutover is not sealed.
- Real image generation validation is not sealed.
- LocalState, downstream, and server route behavior after extraction are not sealed.
- Core deletion/stubbing behavior has no approved design.
- Name/alias behavior between `AIGentOrchestrator` and `JennAIGentOrchestrator`
  requires a Gate 77 design before implementation.

Unknowns:
- Whether future consumers require the core `AIGentOrchestrator` identity after cutover.
- Whether future real image generation gates need additional external dependencies.
- Whether any operator UI or documentation references must be migrated later.

## 6. Extraction Classification Table

| Item | Classification | Reason |
| --- | --- | --- |
| Core `AIGentOrchestrator.js` planner body | Jenn-specific extraction candidate; core fallback / rollback anchor | External byte-for-byte parity exists, but deletion/cutover is not sealed. |
| Core `plugin-manifest.json` | Jenn-specific extraction candidate; shared boundary needs design | Manifest identity differs from external target name; alias/compatibility needs design. |
| Core `config.env.example` | Jenn-specific extraction candidate; already externalized / parity exists | External copy is byte-for-byte equal. |
| Core `README.md` | Jenn-specific extraction candidate; rollback anchor | External README contains approved preface plus core body. |
| External Jenn plugin files | already externalized / parity exists | Current external parity target exists and is clean. |
| `Plugin.js` PluginManager, loader, watcher, `processToolCall`, `executePlugin` | VCP core service code, remain core | These are generic host/runtime framework components. |
| `Plugin.js` Jenn constants and exact resolution wiring | shared boundary/helper, design required | Narrow Jenn-specific policy hook in core; should not be changed without RFC. |
| `modules/externalPluginAllowPolicy.js` generic parser/evaluator | VCP core service code, remain core | Generic external allowlist policy framework. |
| `evaluateExactExternalPluginResolution` | shared boundary/helper, design required | Reusable helper currently used for Jenn target exact resolution. |
| No-provider and provider harness scripts | core fallback / rollback anchor; unsafe to extract now | Existing proof chain depends on these scripts until replacement proofs exist. |
| Copy-integrity and baseline scripts | shared boundary/helper; design required | They protect parity and sealed assumptions. |
| Generic server routes | VCP core service code, remain core | No Jenn-specific server route extraction authorized. |
| Generic LocalState machinery | VCP core service code, remain core | No LocalState behavior is sealed for extraction. |
| Generic downstream dispatch framework | VCP core service code, remain core | Planner references downstream roles but does not dispatch. |
| Real image generation path | unsafe to extract now | Real image generation validation is not sealed. |

## 7. Core Service Protection Findings

The following VCP core service code should remain untouched by the Jenn plugin
extraction effort unless a later approved design explicitly scopes a narrow
change:

- `PluginManager`
- `processToolCall`
- `executePlugin`
- generic server routes
- generic LocalState machinery
- generic downstream dispatch framework
- generic loader / watcher / hot reload behavior
- generic plugin policy framework
- generic external plugin env sandboxing
- generic plugin callback/auth machinery

Gate 76 found only narrow Jenn-specific policy wiring in `Plugin.js` and the
exact external resolution helper path. Those are shared boundary areas, not
extraction implementation targets for this gate.

## 8. Future Extraction Seam Findings

Can later be extracted or externalized after design and proof:
- Core plugin body under `Plugin/AIGentOrchestrator/AIGentOrchestrator.js`.
- Core plugin manifest and tool definitions.
- Core plugin config example.
- Core plugin README/body docs.
- Tool dispatch map for `PlanImagePipeline`, `PlanRetryPipeline`, and `HealthCheck`.

Must remain until runtime cutover:
- Core `Plugin/AIGentOrchestrator/**` as rollback anchor.
- `Plugin.js` Jenn exact-resolution constants and wiring.
- External allow policy helper and baseline guard surfaces.

Must remain until real image generation validation:
- Any planner-to-real-execution assumptions.
- Any downstream workflow references to `AIGentWorkflow`, `ComfyUIGen`,
  StyleTrainer training, or QualityInspector external vision checks.

Must remain until LocalState/downstream/server validation:
- Generic LocalState machinery.
- Generic downstream dispatch framework.
- Generic server route activation paths.
- Harness/proof scripts that assert these boundaries remain false.

Must be frozen as rollback anchor:
- Core plugin copy.
- No-provider and provider harness scripts.
- Copy-integrity script.
- Gate 69, Gate 72, and Gate 75 proof docs.

Must be proved with parity before deletion or stubbing:
- External tool parity.
- External manifest identity and alias behavior.
- External config parity.
- External planner output parity.
- External no-provider behavior.
- External provider-preserving behavior.
- Operator-facing route/tool-name compatibility.

## 9. Future Blockers

- Provider validation is sealed only as bounded Stage 6 provider contract proof.
- Real image generation validation is not sealed.
- Runtime cutover is not sealed.
- Core copy deletion is not authorized.
- LocalState validation is not sealed.
- Downstream validation is not sealed.
- Server route validation is not sealed.
- Tool parity is likely strong but still needs formal external parity proof.
- External dependency parity may need proof if future real execution adds dependencies.
- File path assumptions still explicitly reference both external target and core fallback.
- Fallback or rollback dependency on the core copy remains.
- Name/identity migration from `AIGentOrchestrator` to `JennAIGentOrchestrator`
  needs a design before any implementation.

## 10. Future Proof Requirements

Before implementation or deletion, later gates should produce:

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

## 11. Non-Goals

Gate 76 is not:

- extraction implementation
- file movement
- code deletion
- core copy removal
- stub or redirect implementation
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

## 12. Evidence Limits

- Gate 75 sealed bounded provider validation execution only.
- Gate 75 is not plugin execution.
- Gate 75 is not image generation validation.
- Gate 75 is not runtime cutover.
- Gate 76 evidence is source-review evidence only.
- Gate 76 does not authorize extraction implementation.
- Gate 76 does not authorize deleting the core copy.
- Gate 76 does not authorize runtime cutover.

## 13. Secret Hygiene

- Environment variable names may be recorded.
- Environment variable values were not recorded.
- Credential values were not recorded.
- Token values were not recorded.
- Raw authorization headers were not recorded.
- No provider endpoint value was recorded.
- No secret material is intentionally included in this document.

## 14. Classification

- CORE_JENN_PLUGIN_TOOL_EXTRACTION_SOURCE_REVIEW_READY

## 15. Recommendation If Ready

- RECOMMEND_GATE_77_CORE_JENN_PLUGIN_TOOL_EXTRACTION_DESIGN_RFC
