# Upstream integration — 2026-09-29

## Scope and ancestry

- Delivery branch: `codex/vcptoolbox-upstream-20260929`.
- Base: current fork `master`, `12380d7dbd47219c012d3bda029dafdfed4b0224` (PR #281).
- Upstream source range: `lioensky/VCPToolBox` `c112bd68510de398ad8878f6551a72b8c5f87a29..7f3867195ce2d9170ad397bf79070e6a2f89d0c3` (seven commits).
- Apply source changes with three-way reconciliation; rebuild the tracked admin bundle from the integrated sources instead of copying upstream binaries.
- Preserve the previous delivery branch as a comparison reference. This delivery does not merge master or deploy services.

## Integrated changes and compatibility

- Experimental third-party JEV declaration registry, strict tool-name routing, admin inspection and plugin declaration display. `JEV_THIRD_PARTY_EXP` remains **off by default**; no runtime configuration is changed.
- Admin scrolling/topbar fixes. Base configuration editing now preserves existing text instead of automatically merging/reordering it against the example. Newly introduced template keys are not automatically inserted into existing configurations.
- Updated plugin developer documentation and white paper, including its filename and README references.
- No dependency lock, native code/binary, CI workflow, actual environment file, database or private content changes.

## Downstream preservation and reconciliation

- PR #280 safety fixes remain in the base: reasoning snapshots, RAG unscored tail, proxy opt-in, provider-error redaction, catalog-scoped model discovery, safe generated image writes, media restoration, tool context/sleep handling and Chrome bridge redaction.
- PR #281 `semantic_passthrough` remains supported, including invalid argument-mode rejection and UTF-8 resource/envelope/final-call limits.
- Direct resident plugins retain their existing JEV runtime declaration and native-manifest authority on metadata refresh when execution semantics change; a reload is required to adopt new semantics.
- New third-party requests are capped at 16 KiB (UTF-8), including the final expanded call and inherited metadata. Reserved object keys, oversized fixed values/descriptions and non-finite/out-of-range decisions are rejected. Provider failure messages are not echoed to debug logs.
- Admin plan preview uses an isolated offline planner; it cannot call the shared provider or execute tools. Ambiguous input can therefore differ from online planning or fail without a declared fallback.
- Upstream lamp/game tests referenced manifests outside this repository. Replace those dependencies with explicit synthetic fixtures; these prove schema/routing behavior, **not actual device/game compatibility**.

## Validation

Windows isolated regression and admin build were explicitly authorized for this batch. Environment: Node.js `v24.21.0`, npm `11.19.0`.

**PASS: 215 tests, zero failed/skipped**, using synthetic fixtures, temporary directories, mocked providers and loopback protocol tests:

```text
node --require ./tests/fixtures/offlineRegressionSetup.cjs --test tests/pr280SelfAudit.test.cjs tests/protocolBridgeResponses.test.js tests/jevClient.test.js tests/jevToolCallExp.test.js tests/jevThirdPartyRegistry.test.js tests/jevBladeGame.test.js tests/jevTableLampRemote.test.js tests/jevRiverRerank.test.js tests/upstreamDeliveryReviewFixes.test.cjs tests/chromeBridge/runtime-core-test.js tests/chromeBridge/page-runtime-handle-test.js tests/chromeBridge/page-runtime-image-test.js tests/chromeBridge/contenteditable-reply-editor-test.js tests/plugin-external-runtime-registration-gate.test.js tests/plugin-external-runtime-env-sandbox.test.js tests/plugin-external-runtime-direct-policy.test.js tests/plugin-external-dirs.test.js tests/externalPluginSafetyGate.test.js tests/externalPluginAllowPolicy.test.js tests/vcpToolBridgeNativeManifest.test.js
```

The opt-in preload disables checkout approval-config loading/watching and blocks checkout runtime environment-file reads. It is test scaffolding, not a general-purpose sandbox or production change. An earlier targeted run used the checkout's tracked approval defaults; the final batch runs with this preload. No production host was accessed.

**PASS: admin typecheck and production bundle build**:

```powershell
# In AdminPanel-Vue; process-local variables, no persisted configuration edits.
npm ci --ignore-scripts --no-audit --no-fund
$env:VCP_ADMIN_API_TARGET='http://127.0.0.1:1'
$env:ANALYZE='false'
npm run build
```

The explicit target prevents Vite configuration from reading root `config.env`. No frontend runtime env files were present. Tracked `dist` is intentionally regenerated; no source maps or local workspace paths were found in the bundle.

**NOT RUN in the initial Windows batch:** Linux regression, native rebuild, real providers, real distributed hardware, production startup, browser end-to-end tests. Subsequent Linux results are recorded below and in the PR. Native code is unchanged. Local build success is not production readiness.

CI limitations: the main workflow targets `main`, not this PR's `master`; native ABI CI has path filters that this change does not touch. No workflow changes or manual release/build dispatch are part of this delivery. PR checks and review threads must still be inspected after opening; absent CI is not a passing CI run.

## PR #282 review follow-up

Addressed three P2 findings with regressions: palette keyboard scrolling now compares viewport-relative rectangles (including container border); disabled/invalid declarations do not expose call templates; single-character aliases match exact primary/wrapper text, without unsafe substring matching. Re-ran the complete 215-test batch and rebuilt the admin bundle after these changes.

### Second review batch

- Reject third-party names that normalize to the configured virtual JEV tool name, including case, hyphen and underscore variants.
- Reject multiple unprefixed `constraints` text parameters per command; retain one catch-all alongside explicitly prefixed fields.
- Give the login page its own viewport-height scroll container and overflow-safe vertical centering, including mobile widths.
- Suppress global error toasts for the optional registry lookup by default; missing entries and other failures remain distinct inline messages. Explicit caller overrides still work.
- Guard registry lookup success and failure against navigation, declaration changes, overlapping refreshes and component unmount.

**Windows PASS: 226/226, zero failed/skipped.** Run the command above with `tests/pr282AdminReview.test.cjs` appended. The new admin tests transpile actual source using the frontend's locked TypeScript dependency; install both root and frontend dependencies before running this expanded batch. Admin typecheck/build also passed and the tracked bundle was rebuilt. Existing ineffective dynamic-import warnings remain non-fatal.

**Windows isolated browser layout PASS:** actual Login.vue CSS with synthetic login content in a fresh headless Chromium session, network requests blocked, at 1024x300, 667x375, 320x240, 390x844 and 1280x900. The card top remained reachable and the bottom button was reachable by scrolling. This is a layout regression check, not authenticated browser end-to-end testing.

Linux validation of the earlier `9d9da273` snapshot passed 215/215 plus the admin build, as recorded in the PR. That result does not cover this second review batch: its exact-commit Linux rerun and final result will be recorded in the PR after publication. No native code or dependency lock changed; no Vexus rebuild is required.

### Boolean alias follow-up

The five-fix snapshot `565946fb` subsequently passed Linux 226/226 and the admin build; the full evidence is in the PR. Review of that snapshot identified one more ambiguity: true and false aliases could normalize to the same token. Validation now rejects that overlap, while variants on the same side remain valid. Added rejection cases for punctuation, case, spacing and identical Chinese aliases, plus deterministic positive/negative expansion checks.

Windows final regression: **228/228, zero failed/skipped**; admin typecheck/build passed again with no bundle changes. The new positive fixture initially omitted the required boolean description; the fixture was corrected before the final passing run. The final exact-commit Linux rerun is recorded separately in the PR, not inferred from the prior 226-test result.

### Boolean prefix validation

Review of `ca2f9321` identified that boolean planning does not consume prefixed constraints. Reject non-empty boolean `prefixes` during declaration validation rather than accepting a non-executable schema. Omitted/empty prefixes remain compatible; enum and constraints-text prefixes retain their behavior. Updated the plugin developer manual with the supported syntax.

The new rejection regression failed against the previous implementation, then passed after the fix. Added coverage for required/optional parameters, defaults and offline/configured mock-provider paths, including no provider call or callable template for invalid declarations. Windows full regression: **231/231, zero failed/skipped**; admin typecheck/build passed with no dist change. The exact-commit Linux result is recorded in the PR after publication. No real configuration, native code, dependency lock or CI workflow changes.

### Enum key/alias ownership

Review of `4d1a137c` identified cross-option normalized enum collisions. Validation now assigns each normalized option key and alias to one option within that enum parameter and rejects ownership conflicts. Equivalent spellings within the same option remain valid. Updated the developer manual with this rule.

Three rejection regressions reproduced alias/alias, key/key and key/alias collisions on the old implementation. All pass after the fix, including prefixed/unprefixed inputs, offline/configured mock-provider modes and reversed option order. A positive regression preserves same-option duplicates and deterministic matching without provider calls. Self-review added an own-property lookup guard and regression so prototype-named keys are not interpreted as inherited alias lists. Windows full regression: **236/236, zero failed/skipped**; admin typecheck/build passed without dist changes. Exact-commit Linux results follow in the PR; no runtime configuration, dependency, native or CI change.

### Command identifier/alias ownership

Review of `5c4fc2d6` identified the corresponding cross-command ambiguity. Declaration validation now requires normalized command identifiers and aliases to have a single owning command, while preserving same-command equivalent spellings and exact identifier validation against capabilities. Added three failing-before/passing-after collision tests plus deterministic same-command compatibility across constraint/wrapper inputs, with offline/configured mock-provider modes and reversed command order. Windows full regression: **240/240, zero failed/skipped**; admin typecheck/build passed with no bundle changes. The exact-commit Linux result is recorded in the PR after publication, separately from the previous 236-test snapshot.

### Substring containment in enum and command aliases

The collision check now mirrors the planner's actual substring rule: across different enum options or commands, reject normalized equality and containment by a token of at least two characters. Preserve same-owner containment and the existing exact-only single-character behavior. The planner and ordinary plugin loading are unchanged; affected third-party JEV declarations need non-ambiguous keys/aliases before becoming valid again.

Both new rejection tests fail on `c45221aa` and pass after this fix. Added enum/command matrices for key/key, alias/alias and key/alias containment, normalized case/punctuation, Chinese aliases, reverse order, primary/wrapper inputs, offline/configured mock-provider modes, plus same-owner and single-character positive controls. Windows regression: **244/244, zero failed/skipped**; admin typecheck/build passed with no bundle changes. The exact-commit Linux result is recorded in the PR after publication. No production configuration, provider, native, dependency or CI changes.

### Boolean substring collision follow-up

The final PR review identified the same ambiguity across `trueAliases` and `falseAliases`. Boolean validation now uses the shared planner-aligned conflict helper, rejecting cross-value equality or multi-character containment while preserving same-value aliases and exact-only single-character matches. Existing declarations such as `静音` / `不要静音` need disjoint alternatives such as `静音` / `有声`; general planner precedence and ordinary plugin loading are unchanged.

The new rejection regression fails on `df8d1da6`; positive controls already pass there. Coverage includes both containment directions, normalized punctuation/case, Chinese negations, primary/wrapper/constraint input, offline/configured mock providers, null templates and zero provider decisions. Windows: **246/246, zero failed/skipped**, with admin typecheck/build passed. Linux exact-commit results are added to the PR after publication. No runtime configuration, real provider, production, native, dependency or CI changes.

### Command selector consumption and trimmed required prompts

Command selection now returns the exact constraint indices responsible for a unique match in the constraint-tag layer. Argument collection consumes those indices before prefixed/free text handling. Primary/wrapper selection, a single command and semantic/default fallback do not remove merely similar payload tags; non-exact free text remains intact. Required prompts are also checked after trimming, rejecting whitespace-only declarations before template generation or provider decisions. Optional blank prompts remain valid.

Both reported failures reproduce on `c769e332`. Four new regressions cover command identifiers/normalized aliases, tag position, free-text preservation, missing required payload, primary/wrapper/default/single-command paths, whitespace variants and optional prompt compatibility. Windows: **250/250, zero failed/skipped**, and admin typecheck/build passed. Exact-commit Linux results are recorded in the PR after publication. No real configuration/provider/production access or native/dependency/CI changes.

### Shared parameter prefix follow-up

Final review found that multiple enum/text parameters could share a prefix and race to consume the same tag. Validation now assigns each case-insensitive prefix a unique parameter owner within a command. It mirrors the parser (no alias-style punctuation stripping), permits duplicate spelling within one parameter and reuse across commands, and rejects collisions before planning/provider fallback. Existing shared prefixes need distinct names.

The new rejection regression fails on `30c464e0`; positive controls pass. Added matrices for enum/enum, enum/text, text/enum, text/text, case variants, trimmed prefixes, Chinese and offline/configured mock providers, plus same-owner/cross-command/punctuation-distinct compatibility. Windows: **252/252, zero failed/skipped**, and admin typecheck/build passed; exact-commit Linux evidence follows in the PR. No real configuration/provider/production access or native/dependency/CI changes.

### Cross-parameter alias ownership and prefix delimiters

Deterministic tokens now have a unique parameter owner per command: enum keys/aliases and boolean true/false aliases use the shared planner-aligned collision helper, rejecting normalized equality and multi-character containment. Prefixed enums are included because they still fall back to shared matching. Cross-command reuse and single-character exact semantics remain supported. Prefix declarations additionally reject both parser delimiters (`:` and `：`), while values may contain either unchanged. Existing overlapping declarations need distinct parameter vocabularies or delimiter-free prefixes; ordinary plugin loading is unchanged.

Both rejection regressions fail on `0acff017`. Four added tests cover enum/boolean combinations, true/false aliases, enum keys, normalized equality/containment in both directions, Chinese, offline/configured mock providers, prefix order and both delimiters, alongside valid ownership/cross-command reuse and verbatim text values. Windows: **256/256, zero failed/skipped**, admin typecheck/build passed. Exact-commit Linux evidence is recorded in the PR after publication. No real configuration/provider/production access or native/dependency/CI changes.

### Editable template-only base settings

The base configuration form now retains the existing file's entry order, values, comments and custom keys, then appends active template keys that are absent. Existing empty values count as present, template duplicates are not appended twice, and template comments do not become assignments. Missing/empty files still initialize from the full template. Added entries use template documentation without borrowing custom-file line markers. Loading only populates the editable model; an explicit form save persists the displayed settings, including supplemented defaults. No real configuration is read or saved during validation.

Two regression tests execute the actual load/save code with synthetic API responses and the production ENV parser/serializer. They fail on `64e409e1` and pass after the fix, covering JEV_THIRD_PARTY_EXP editing/save/reload, existing order and values, empty sources, duplicate keys, comments and multiline template values. Windows: **258/258, zero failed/skipped**, admin typecheck/build passed; rebuilt tracked distribution assets accompany the source change. No source maps or local paths were found in the bundle. Exact-commit Linux evidence follows in the PR; no production, provider, native, dependency or CI changes.

### Consumed command selectors cannot also match parameters

Final review found that consumed selector indices only protected text collection, while enum/boolean matching still saw the original tag layer. Parameter match layers are now rebuilt with those consumed constraints excluded; raw parsing and argument indices remain intact, and other explicit parameter tags still match. The regression reproduces `urgent=true` from a selector-only request on `e3bbcd22`, then verifies fallback/default and mock-provider paths for enum/boolean identifiers and aliases. Two new tests bring Windows to **260/260, zero failed/skipped**, with admin typecheck/build passed; final Linux evidence follows in the PR. The template-form fix and rebuilt dist are retained. No real configuration/provider/production access or native/dependency/CI changes.
