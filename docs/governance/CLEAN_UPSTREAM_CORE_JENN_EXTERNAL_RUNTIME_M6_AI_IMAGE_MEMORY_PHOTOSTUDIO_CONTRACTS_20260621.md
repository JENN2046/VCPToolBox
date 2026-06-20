# M6 AI Image Memory PhotoStudio Contracts

Date: 2026-06-21

Status: CONTRACTS_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M6 defines contracts for AI Image, Codex/Memory, and PhotoStudio externalization.

It does not implement adapters, call providers, generate images, read private memory, write LocalState, publish external records, or move PhotoStudio data.

## 2. AI Image Contract

Future AI Image externalization must use a generic adapter boundary.

Core may define only generic concepts:

```text
adapter id
capability id
fixture id
dry-run validation result
provider disabled/enabled state
```

Rules:

- Clean core must not contain Jenn trial ids, provider-specific constants, private fixture payloads, real provider keys, or operator paths.
- Provider-specific adapters live in Jenn External Runtime.
- Fixtures and binding data live in reviewed external package paths or LocalState, depending on whether they are source-like or private/operator data.
- Default behavior is provider-off and dry-run.
- Tests must not call real provider endpoints, generate real images, write `image/**`, or print base64 image data.
- External adapter checksums cover reviewed source/package files only.
- Private image outputs and operator media remain LocalState/private data and are excluded from source manifests.

Default decision:

```text
AI Image externalization remains contract-only in M6.
No provider call is executed.
No image is generated.
No route/server code is changed.
```

## 3. Codex/Memory Contract

Future Codex/Memory externalization may use a generic bridge interface or no clean-core change.

Rules:

- Clean core must not read real private memory for validation.
- Jenn memory tools and bridge-specific payloads belong in Jenn External Runtime.
- Private memory stores belong in LocalState and remain excluded by default.
- Validation must be manifest-only, path-only, or fixture-only unless a later reviewed gate explicitly permits private content reads.
- Memory vector stores, DB sidecars, cache, logs, outputs, and `.agent_board/**` remain excluded from source manifests.
- No secret, token, raw memory content, or operator private data may be written into receipts.

Default decision:

```text
Codex/Memory externalization remains contract-only in M6.
No private memory is read.
No memory bridge is activated.
No LocalState migration is performed.
```

## 4. PhotoStudio Contract

Future PhotoStudio externalization must separate source-like plugin logic from private project data.

Rules:

- PhotoStudio plugins, templates, and reviewed source files may live in Jenn External Runtime.
- PhotoStudio projects, media, exports, delivery queues, operator notes, and generated output belong in LocalState or another private data lane.
- Default external behavior is no-auto-write.
- External sync, publish, sheet, Notion, calendar, provider, or delivery writes require separate explicit approval.
- Tests may use dry-run fixtures or local shadow records only when they do not touch real operator data.
- Source manifests must exclude private media, exports, cache, logs, DB/vector sidecars, and `.agent_board/**`.
- Rollback must be possible by disabling external package env, not by deleting private data.

Default decision:

```text
PhotoStudio externalization remains contract-only in M6.
No PhotoStudio project data is copied.
No external publish/sync/write is executed.
No LocalState data is read.
```

## 5. Package Lane Rules

Use these lanes:

```text
VCPToolBox-JENN-Extensions
  source-like adapters, plugins, manifests, dry-run fixtures, templates

VCPToolBox-JENN-LocalState
  private memory, project data, real config, generated outputs, operator state
```

Rules:

- Do not mix private LocalState into source packages.
- Do not checksum LocalState as plugin source.
- Do not copy `.agent_board/**` automatically.
- Do not use provider success as a prerequisite for source package integrity.
- Do not mark a migration complete without copy-first, paths-only risk scan, checksum, shadow validation, and rollback evidence.

## 6. Validation

M6 validation is documentation-only:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "AI Image|Codex/Memory|PhotoStudio|provider-off|no-auto-write|LocalState|\\.agent_board|CONTRACTS_ONLY" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md
git status --short
```

Do not run provider calls, image generation, external sync/publish, bridge calls, LocalState reads, `.agent_board/**` reads, or runtime code changes as part of M6.

## 7. Rollback

Rollback M6 by reverting this contract document and the tracker M6 update.

No runtime rollback is required because M6 does not change runtime code, provider config, memory stores, PhotoStudio data, LocalState, or external package files.

## 8. Acceptance

M6 is PASS when:

- this contract document exists;
- AI Image adapter boundaries are generic and default-off;
- Codex/Memory validation is manifest/path/fixture-only and does not read private memory;
- PhotoStudio externalization is no-auto-write by default;
- LocalState and `.agent_board/**` remain excluded from source manifests;
- clean core remains free of private Jenn state, trial/provider constants, and external package data;
- no provider, bridge, image generation, LocalState, external publish, runtime code, or secret changes occur.
