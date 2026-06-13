# Gate 78 | External JennAIGentOrchestrator Plugin / Tool Parity Proof

## 1. Route Identity

- Route: Route Segment 78-78R
- Gate name: External JennAIGentOrchestrator Plugin / Tool Parity Proof
- Latest sealed route: Route Segment 77-77R
- Classification: EXTERNAL_JENN_PLUGIN_TOOL_PARITY_PROOF_READY
- Recommendation if ready: RECOMMEND_GATE_79_NO_PROVIDER_EXTRACTION_PROOF

Gate 78 is a bounded static parity proof only. It does not implement extraction,
move files, delete files, create redirects, create stubs, alter registries,
execute plugin runtime, contact providers, generate images, or perform runtime
cutover.

## 2. Baseline

- Core branch before proof: main
- Core HEAD before proof: 0ff04bdd98d63fd7b7f9129c186febdbb9804be2
- Core origin/main before proof: 0ff04bdd98d63fd7b7f9129c186febdbb9804be2
- Core worktree before proof: clean
- Core ahead/behind before proof: 0 / 0
- External branch before proof: main
- External HEAD before proof: f7772c654c2d8d34698f2818fde02ec63df783cb
- External origin/main before proof: f7772c654c2d8d34698f2818fde02ec63df783cb
- External worktree before proof: clean
- External ahead/behind before proof: 0 / 0

## 3. Source Inputs

Reviewed core inputs:
- `docs/governance/GATE_76_AIGENT_ORCHESTRATOR_CORE_JENN_PLUGIN_TOOL_EXTRACTION_SOURCE_REVIEW.md`
- `docs/governance/GATE_77_AIGENT_ORCHESTRATOR_CORE_JENN_PLUGIN_TOOL_EXTRACTION_DESIGN_RFC.md`
- `Plugin/AIGentOrchestrator/**`
- `Plugin.js`
- `modules/externalPluginAllowPolicy.js`
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`
- `package.json`, for dependency parity only

Reviewed external inputs, read-only:
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator\**`
- External package root package manifests were checked by filename and no
  `package.json` or `package-lock.json` was present.

## 4. Relative Tree Parity

Normalization rule:
- Strip the plugin root prefix.
- Compare relative filenames with case-sensitive string equality.
- No wildcard, package-root allowlist, or broad directory allowlist is used as
  passing evidence.

Core relative tree under `Plugin/AIGentOrchestrator/**`:
- `AIGentOrchestrator.js`
- `config.env.example`
- `plugin-manifest.json`
- `README.md`

External relative tree under `Plugin/JennAIGentOrchestrator/**`:
- `AIGentOrchestrator.js`
- `config.env.example`
- `plugin-manifest.json`
- `README.md`

Files present in both by relative filename:
- `AIGentOrchestrator.js`
- `config.env.example`
- `plugin-manifest.json`
- `README.md`

Files present only in core:
- none

Files present only in external:
- none

Directory-level differences:
- none inside the plugin roots after stripping root prefix

Case-sensitive filename differences:
- none

Relative tree parity result:
- PASS

## 5. File Hash / Content Parity

| Core relative path | External relative path | Core SHA-256 | External SHA-256 | Match status |
| --- | --- | --- | --- | --- |
| `AIGentOrchestrator.js` | `AIGentOrchestrator.js` | `D7C3BD2FD285360A50D2DF2EA312D897B88F1B4F676CFF1E5C43BD30F72EC673` | `D7C3BD2FD285360A50D2DF2EA312D897B88F1B4F676CFF1E5C43BD30F72EC673` | match |
| `config.env.example` | `config.env.example` | `6B3A9775E72853600C268C06623067666775788CDAD3F2A16709E86379825E64` | `6B3A9775E72853600C268C06623067666775788CDAD3F2A16709E86379825E64` | match |
| `plugin-manifest.json` | `plugin-manifest.json` | `8D72E0EFEEFF869D55D50CF5AC761D541B10A57B3914A7C68C1B269FD7B39C43` | `D01F65439A00B2CCDE9BCDFD75B0C25DB543C72303F22B3521254CA88336E8E3` | expected difference |
| `README.md` | `README.md` | `76CE828DACCF388C2A9A1158BB90C95E1D2D29EC6C67CE47274F9AAFB067B685` | `8063E7303A2E10F1E6F772BB8A2EF1338F7EC05E3DCA6C24DA9D25CDE3757BE5` | expected difference |

Expected differences:
- `plugin-manifest.json`: core identity is `AIGentOrchestrator`; external
  identity is `JennAIGentOrchestrator`. Static comparison showed the manifests
  are identical except `name` and `description`.
- `README.md`: external README contains a Jenn external preface and ends with
  the full core README body.

Whether expected differences block later no-provider extraction proof:
- no. The differences are known identity/documentation differences and are
  already tracked as later name/alias compatibility proof requirements.

Later proof required:
- manifest identity and alias compatibility proof
- operator/tool-name compatibility proof
- no-provider extraction proof proving external selection without core fallback

## 6. Manifest / Config Parity

Plugin identity/name fields:
- core: `AIGentOrchestrator`
- external: `JennAIGentOrchestrator`
- identity mismatch is expected due to external package naming.

Description/version fields:
- both descriptions are present
- versions match: `0.1.0`

Entrypoint/protocol:
- entrypoint command matches: `node AIGentOrchestrator.js`
- communication protocol matches: `stdio`
- timeout matches: `60000`

Tool declaration locations:
- core: `plugin-manifest.json` `capabilities.invocationCommands`
- external: `plugin-manifest.json` `capabilities.invocationCommands`

Required config keys by name only:
- `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION`
- `AIGENT_ORCHESTRATOR_DEFAULT_MODE`

Provider config surface by env/config key name only:
- no provider endpoint key was found in either plugin manifest/config surface
- no provider credential key was found in either plugin manifest/config surface
- provider validation env names remain harness proof surface only, not plugin
  runtime config

Path assumptions:
- core manifest entrypoint is relative to `Plugin/AIGentOrchestrator`
- external manifest entrypoint is relative to `Plugin/JennAIGentOrchestrator`
- both use the same entrypoint filename

Core-only config entries:
- none

External-only config entries:
- none

Manifest/config parity result:
- PASS for later no-provider extraction proof

## 7. Tool Definition Parity

Tool names:
- `PlanImagePipeline`
- `PlanRetryPipeline`
- `HealthCheck`

Tool descriptions:
- all three tool declarations have descriptions in both manifests
- descriptions are equivalent because the manifests are identical except
  `name` and `description`

Required parameters:
- no explicit required parameter schema is present in either manifest

Optional parameters:
- no explicit optional parameter schema is present in either manifest

Schema differences:
- none identified in manifest tool declarations

Default-value differences:
- none identified in manifest tool declarations

Core-only tools:
- none

External-only tools:
- none

All Jenn-specific tools have external parity:
- yes

Tool definition parity result:
- PASS

## 8. Tool Dispatch Parity

Dispatch entrypoints by filename/function name only:
- core: `AIGentOrchestrator.js` `handleRequest`
- external: `AIGentOrchestrator.js` `handleRequest`

Tool-to-handler mapping:
- `PlanImagePipeline` -> `planImagePipeline`
- `PlanRetryPipeline` -> `planRetryPipeline`
- `HealthCheck` -> health response branch

External handler presence:
- present for `PlanImagePipeline`
- present for `PlanRetryPipeline`
- present for `HealthCheck`

Core handler presence:
- present for `PlanImagePipeline`
- present for `PlanRetryPipeline`
- present for `HealthCheck`

Unresolved handler references:
- none identified

Dispatch source parity:
- core and external `AIGentOrchestrator.js` hashes match exactly, so dispatch
  behavior is statically identical.

Whether dispatch parity is sufficient for later no-provider extraction proof:
- yes, subject to a later proof that external resolution does not fall back to
  the core plugin path.

Tool dispatch parity result:
- PASS

## 9. Provider Surface Parity

Provider adapter filenames:
- none under the core plugin root
- none under the external plugin root

Provider config key names only:
- no provider config keys are declared by either plugin manifest/config surface
- plugin config keys remain:
  - `AIGENT_ORCHESTRATOR_ALLOW_EXECUTION`
  - `AIGENT_ORCHESTRATOR_DEFAULT_MODE`

Provider selection logic locations:
- none inside the plugin body
- provider validation logic exists only in the separate core harness script and
  was not executed in Gate 78

Request/response shape assumptions:
- the plugin body builds dry-run planner responses
- provider request/response contract is not part of the plugin body parity

External-only provider behavior:
- none identified

Core-only provider behavior:
- none identified in the plugin body

Whether provider parity is sufficient for later provider-preserving extraction proof:
- sufficient for a later design/proof starting point, but not sufficient to claim
  provider-preserving runtime behavior. Gate 78 is not provider validation.

Provider surface parity result:
- PASS for static no-provider parity
- later provider-preserving proof still required

## 10. Prompt / Pipeline / Orchestration Parity

Prompt files:
- none found under either plugin root

Pipeline files:
- no separate pipeline files found under either plugin root
- pipeline planning logic is inside `AIGentOrchestrator.js`

Orchestration files:
- `AIGentOrchestrator.js` in both plugin roots

Image-generation path references:
- the planner references planned workflow commands such as `ExecuteWorkflow`
- the source records dry-run behavior and does not execute image generation
- core and external source hashes match exactly

Pipeline step names:
- `AIGentPrompt`
- `AIGentWorkflow`
- `AIGentStyle`
- `AIGentQuality`

Core-only orchestration paths:
- none identified inside the plugin root

External-only orchestration paths:
- none identified inside the plugin root

Hard-coded core path assumptions:
- none identified inside the plugin body
- core fallback path assumptions exist in `Plugin.js` and harness/policy scripts,
  not in the plugin implementation body

Prompt / pipeline / orchestration parity result:
- PASS

## 11. Asset / Resource Parity

Asset filenames:
- none

Resource filenames:
- none outside `README.md`, `plugin-manifest.json`, and `config.env.example`

Hash parity where comparable:
- no asset/resource hash pairs required

Missing assets:
- none

Extra assets:
- none

Whether missing/extra assets block later extraction:
- no

Asset/resource parity result:
- PASS

## 12. Dependency Parity

Package manifests reviewed:
- core `package.json` reviewed only to confirm dependency relevance
- external package root checked for `package.json` and `package-lock.json`; no
  external package manifest was present

Dependencies required by core plugin code:
- `crypto`, a Node built-in module

Dependencies available to external package:
- Node built-in `crypto` is available to the same Node runtime

Missing external dependencies:
- none for the current static plugin body

External-only dependencies:
- none identified because no external package manifest exists

Whether dependency parity blocks later extraction:
- no for later no-provider extraction proof
- any future real-execution dependency expansion requires a separate dependency
  design and approval

Dependency parity result:
- PASS

## 13. Path Assumption Parity

References to `Plugin/AIGentOrchestrator`:
- core plugin root itself
- `Plugin.js` core fallback constant
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`
- Gate 76 and Gate 77 governance documents

References to `Plugin/JennAIGentOrchestrator`:
- external plugin root itself
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js`
- Gate 76 and Gate 77 governance documents

Relative path assumptions:
- `scripts/check-jenn-aigent-orchestrator-copy-integrity.js` maps relative core
  plugin files to relative external plugin files
- both manifests use relative entrypoint command `node AIGentOrchestrator.js`

Absolute path assumptions:
- `Plugin.js` constructs the external Jenn target path from the core repo
  directory and the sibling `VCPToolBox-JENN-Extensions` package
- Gate proof documents record absolute sealed paths as governance evidence

LocalState path references by path key/name only:
- `modules/externalPluginAllowPolicy.js` blocks `LocalState` /
  `VCPToolBox-JENN-LocalState` allowlist roots

Core-root assumptions that would block external execution:
- core fallback remains a deliberate rollback anchor
- later no-provider extraction proof must prove external selection and
  `coreFallback` false
- no blocking core-root assumption was found inside the plugin body itself

Path assumption parity result:
- PASS for later no-provider extraction proof
- later cutover proof still required

## 14. Rollback / Fallback Parity

Core fallback anchor path:
- `Plugin/AIGentOrchestrator`

External candidate path:
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator`

Whether core fallback must remain:
- yes. Gate 78 does not remove fallback and does not authorize fallback removal.

Evidence needed before fallback removal:
- external parity proof sealed
- no-provider extraction proof sealed
- provider-preserving extraction proof sealed
- downstream validation sealed
- LocalState validation sealed
- server route validation sealed
- runtime cutover design sealed
- runtime cutover execution sealed
- rollback proof proving safe operation without the core copy

Confirmation:
- Gate 78 does not remove fallback.
- Gate 78 does not alter fallback policy.
- Gate 78 does not claim runtime cutover.

Rollback/fallback parity result:
- PASS as a current rollback anchor

## 15. Blockers

Blocking parity gaps for a later no-provider extraction proof:
- none identified

Non-blocking blockers for later gates:
- core fallback still required
- runtime cutover not sealed
- real image generation validation not sealed
- LocalState validation not sealed
- downstream validation not sealed
- server route validation not sealed
- provider-preserving behavior not sealed
- name/alias compatibility remains a later proof requirement

Explicit blocker checklist:
- missing external files: no
- tool mismatch: no
- dispatch mismatch: no
- provider surface mismatch: no for static no-provider parity
- dependency mismatch: no
- path assumption mismatch: no for later no-provider proof
- asset/resource mismatch: no
- core fallback still required: yes
- runtime cutover not sealed: yes
- real image generation validation not sealed: yes
- LocalState validation not sealed: yes
- downstream validation not sealed: yes
- server route validation not sealed: yes

## 16. Evidence Limits

- Gate 78 is static external parity proof only.
- Gate 78 is not extraction implementation.
- Gate 78 is not no-provider extraction execution.
- Gate 78 is not provider validation.
- Gate 78 is not plugin execution.
- Gate 78 is not real image generation validation.
- Gate 78 is not runtime cutover.
- Gate 78 does not authorize deleting the core copy.
- Gate 78 does not authorize changing external package files.

## 17. Secret Hygiene

- Credential values were not recorded.
- Token values were not recorded.
- Raw authorization headers were not recorded.
- Provider endpoint values were not recorded.
- Environment variable names may appear as static config key names only.
- No secret material is intentionally included in this document.

## 18. Classification

- EXTERNAL_JENN_PLUGIN_TOOL_PARITY_PROOF_READY

## 19. Recommendation If Ready

- RECOMMEND_GATE_79_NO_PROVIDER_EXTRACTION_PROOF
