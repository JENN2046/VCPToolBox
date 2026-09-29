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
