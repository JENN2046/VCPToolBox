# Jenn Surface Extraction Plan

**Date:** 2026-06-11
**Status:** plan only
**Source review gate:** Gate 6, `Jenn Surface Extraction Plan`

This note records the narrow extraction path for Jenn-specific runtime surfaces that are currently mixed into the core repository. It does not authorize a broad migration by itself.

## Goal

Move trial-specific AI image, Photo Studio, and operator-memory runtime surfaces out of core implementation paths while keeping upstream-compatible contracts reviewable and reversible.

Core should eventually keep only:

- route factory contracts
- dry-run schemas
- audit interfaces
- execution policy interfaces
- explicit adapter registration points
- tests proving default-off behavior

Core should not keep:

- Jenn trial activation package ids
- runtime-to-review receipt refs
- local `A:\agent-image-lab` path bindings
- live probe history
- Photo Studio business workflow specifics
- route-local assumptions that only hold in one operator workspace

## Current Evidence

The following current core paths contain adapter or operator-specific surface area:

| Path | Current surface | Extraction direction |
| --- | --- | --- |
| `routes/admin/aiImageAgents.js` | `r2r_v2_trial_*`, `serum_bottle_secretless_*`, exact activation ids, receipt refs, output refs, hard-coded `A:\agent-image-lab\...` overrides | Move trial definitions and exact binding fixtures into an external AI image adapter package. Keep only generic route factory, dry-run schema, audit hooks, and policy hook interface in core. |
| `modules/nativeDoubaoSecretlessRuntimeDelegate.js` | Native delegate defaults tied to `agent-image-lab-secretless-runtime` | Keep a generic delegate contract in core. Move concrete Doubao secretless runtime adapter defaults into the external adapter. |
| `modules/nativeImageDelegateRegistry.js` | Serum bottle delegate id is a named runtime binding | Keep registry shape in core. Move named delegate ids to adapter registration data. |
| `modules/photoStudio/*` | Local-shadow studio workflow, calendar/export/delivery business states | Treat as a domain adapter candidate. Do not merge it further into core release gates until it has a package boundary and no real external write defaults. |
| `routes/codexMemoryMcp.js` | Operator memory MCP tools live as a direct route surface | Keep only if local auth hooks and include-content policy are explicit. Otherwise move the MCP bridge behind an operator adapter boundary. |

## Extraction Phases

### Phase 0: default-off stabilization

Purpose: reduce exposure before migration.

Required checks:

- AI Image management route remains behind `ENABLE_AI_IMAGE_AGENTS_ROUTE === 'true'`.
- AI Image real execution remains behind `ENABLE_AI_IMAGE_REAL_EXECUTION === 'true'`.
- Trial runtime-to-review internal routes have a separate explicit gate.
- Codex memory MCP route requires mount-site or route-local auth hooks.
- No trial route, delegate, or Photo Studio path is described as an untrusted sandbox.

### Phase 1: contract split

Purpose: make core contracts independent of Jenn trial data.

Core keeps:

- `createAiImageAgentsRouter(options)`
- route option names and default-off behavior
- dry-run and audit response shapes
- delegate registry interface
- execution policy decision object shape

External adapter owns:

- trial route ids
- exact activation ids
- exact receipt and artifact refs
- exact output directory refs
- local project base path overrides
- probe attempt history
- business workflow fixtures

Validation:

- existing AI Image route tests still pass using adapter-provided fixtures
- core tests prove missing adapter data returns 404 or policy denial, not fallback execution
- no `A:\agent-image-lab` string remains in core source after the split

### Phase 2: external package boundary

Purpose: make adapter installation and registration explicit.

External package requirements:

- manifest declares adapter id, version, and trusted runtime label
- package registers route fragments only through an explicit core adapter API
- package provides fixture data as data files, not hard-coded core constants
- package cannot enable real execution unless core policy gates are already true

Core requirements:

- no direct `require()` of external adapter implementation at startup
- no PluginManager execution dispatch rewrite
- no hot-load before install safety gates pass
- path-safe metadata only in Admin APIs

### Phase 3: Photo Studio boundary

Purpose: keep Photo Studio domain logic from becoming implicit core runtime.

Required split:

- core keeps schema and dry-run command descriptions only
- adapter owns calendar, delivery, export, local-shadow store, and business-state transitions
- any real external sync remains disabled by default and requires explicit operator approval

Validation:

- local tests prove Photo Studio defaults stay local-shadow only
- no real calendar, delivery, or external sync call runs in CI
- Admin UI labels the surface as a trusted adapter, not a sandboxed plugin

### Phase 4: memory MCP boundary

Purpose: make operator-memory exposure explicit.

Required split or hardening:

- router factory must require auth hooks or fail closed
- `include_content` requires a separate permission bit
- mount-site tests prove authenticated paths only
- if used outside core Admin paths, package it as an operator adapter

## Non-Goals

- Do not delete current AI image behavior in a single broad PR.
- Do not migrate `AdminPanel-Vue/dist`.
- Do not change `PluginManager.processToolCall()` dispatch semantics.
- Do not enable low-risk auto-approval.
- Do not describe external direct/hybrid plugins as sandboxed.
- Do not start production services or real image generation as validation.

## PR Slicing

Recommended small PR order:

1. Trial route gate and baseline check.
2. Codex memory MCP auth hook gate.
3. AI Image trial fixture extraction behind unchanged tests.
4. Native delegate registry data split.
5. Photo Studio package-boundary RFC.
6. Photo Studio adapter split.
7. External runner boundary RFC.

Each PR must be revertible without changing production flags or runtime state.

## Release Gate Impact

This plan does not make the release ready by itself. It defines the evidence expected before Gate 6 can close:

- trial-specific routes are default-off and separately gated
- trial-specific fixture data no longer lives in core source
- local Windows paths no longer live in core source
- operator-memory routes have explicit auth evidence
- Photo Studio surfaces are either package-bounded or explicitly excluded from stable release claims
