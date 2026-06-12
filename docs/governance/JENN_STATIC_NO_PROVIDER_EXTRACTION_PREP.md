# Gate 40 Static No-Provider Extraction Prep

**Status:** Gate 40 static/no-provider extraction preparation.
**Scope:** Static documentation and baseline guard only.

Gate 40 implements the accepted Gate 39 recommendation:

```text
RECOMMEND_GATE_40_STATIC_NO_PROVIDER_EXTRACTION_PREP
```

This document persists the first formal extraction boundary for Jenn-specific
capabilities without starting migration, runtime cutover, provider validation,
downstream execution, or LocalState movement.

## Boundary

Core keeps PluginManager/runtime registration.

Core keeps plugin root resolver and external allowlist policy.

Core keeps baseline contract guards.

External package owns Jenn-specific plugin implementation.

External package owns Jenn-specific planning/orchestration code.

External package may receive static Jenn fixture data after explicit gates.

LocalState remains private state, not plugin code.

Provider/downstream execution remains deferred.

No runtime cutover in Gate 40.

No provider calls.

No downstream plugin calls.

No LocalState writes.

No PluginManager.processToolCall invocation.

No PlanImagePipeline execution.

## Current Static Extraction Map

`JennAIGentOrchestrator` is the external renamed parallel candidate for the
core `AIGentOrchestrator` planner surface. `PlanImagePipeline` remains a
planner command for static/no-provider review in this gate, not an invocation
target.

AIGentOrchestrator is no-provider planner scope only.

`aiImageJennTrialFixtures` is a future static data move candidate. It must not
move in Gate 40 and must not expose private operator values in evidence.

`aiImageNativeDelegateBindings` is a future static binding-data move candidate.
It must not move in Gate 40 and must not enable provider or downstream
execution.

AIGentPrompt remains deferred due RAG/KnowledgeBase coupling.

AIGentWorkflow remains blocked by downstream execution assumptions.

AIGentStyle remains deferred due file read/write risk.

AIGentQuality remains deferred due image file inspection risk.

## Gate 40 Non-Goals

Gate 40 is not a migration or cutover.

Gate 40 is only static/no-provider extraction preparation.

External package validation may inspect external package files statically.

Core baseline must not depend on external package filesystem availability.

Provider, downstream, LocalState, Plugin Store, server startup, and runtime
invocation remain out of scope.

Future actual code moves require separate gates.

Future provider or downstream validation requires separate explicit gates.

## Review Notes

Gate 40 may add only static documents and static validation guards. It must not
edit plugin runtime code, route code, provider adapters, execution adapters,
tests, package manifests, persistent env/config files, or LocalState content.

This document is the core governance source for the Gate 40 static
no-provider extraction-prep boundary. It does not authorize Gate 41.
