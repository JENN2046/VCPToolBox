# Gate 44 | External Remote Binding Evidence and First Static Slice Plan RFC

## Status

This RFC is ready for review, not runtime cutover authorization.

Gate 44 records external remote binding evidence after Gate 43.

Gate 44 does not modify external remotes.

Gate 44 does not push core or external.

Gate 44 does not authorize provider validation.

Gate 44 is documentation-only governance evidence. It does not authorize Gate
45 work.

## Current evidence

Core HEAD:

```text
2ae93f647e466d927ab105b47a7db33cab1348a5
```

Core `origin/main`:

```text
2ae93f647e466d927ab105b47a7db33cab1348a5
```

External HEAD:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin:

```text
https://github.com/JENN2046/VCPToolBox-JENN-Extensions
```

External remote `main`:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External tags:

```text
none
```

External branch tracking:

```text
main tracks origin/main
```

Core validation commands:

```text
node --check scripts/check-prod-baseline.js
npm run test:baseline
```

External validation commands:

```text
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

## Remote hygiene

The recorded remote URL is credential-free.

Command receipts must not record credential-bearing URLs.

No access tokens, raw authorization headers, SSH private keys, session material,
or secret-like values may be recorded.

Future remote changes require a separate gate.

Force-push and history rewrite remain forbidden.

## Post-binding invariants

External package remains a dedicated external package repository.

Core baseline must not depend on external package filesystem availability.

External package validator may read external package files only.

Runtime discovery root remains separate from LocalState.

LocalState remains private state, not plugin root.

No wildcard/name-only/package-root/LocalState-root allowlists.

Exact Gate 31D runtime allowlist remains:

```text
JennAIGentOrchestrator@A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions\Plugin\JennAIGentOrchestrator
```

## First static slice survey conclusion

JennAIGentOrchestrator external copy remains the safest first static slice
candidate.

The external `JennAIGentOrchestrator` copy is intentionally renamed. The current
observed differences from core `Plugin/AIGentOrchestrator` are governance
identity differences: README boundary preface and manifest name / description
updates. No unexpected source/config divergence was observed in this gate.

This is still not runtime cutover.

This is still not provider validation.

`modules/aiImageJennTrialFixtures.js` remains low-risk static data, but it is
still referenced by core runtime paths.

`modules/aiImageNativeDelegateBindings.js` remains static binding data, but
provider-binding semantics require non-runtime preparation before any move.

Deferred candidates:

- `AIGentPrompt`
- `AIGentWorkflow`
- `AIGentStyle`
- `AIGentQuality`
- provider/downstream adapters
- PluginManager/root resolver/allowlist
- LocalState

## Runtime exclusion

No runtime cutover.

No provider calls.

No downstream plugin dispatch.

No LocalState writes.

No `Plugin/**` modifications.

No `modules/**` modifications.

No `scripts/**` modifications; this gate does not modify scripts.

No server route activation.

No Plugin Store live operation.

No real image generation/provider validation.

Gate 31D remains planner-only no-provider evidence, not provider validation.

## Recommended next gate

Recommendation:

```text
RECOMMEND_GATE_45_AIGENT_ORCHESTRATOR_EXTERNAL_COPY_INTEGRITY_GUARD
```

Rationale:

Core and external validations passed. External `origin/main` was verified at the
expected external package baseline. External tags are absent. Static comparison
showed expected renamed-candidate README and manifest identity differences only,
with no unexpected source/config divergence. The next safe step is an integrity
guard for the external orchestrator copy, not runtime cutover, provider
validation, module movement, or downstream execution.
