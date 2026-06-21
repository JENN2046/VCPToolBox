# M26 PhotoStudio Externalization Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_PHOTOSTUDIO_DATA_READ_NO_EXTERNAL_WRITE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Source contract:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`

## 1. Purpose

M26 defines the taskbook for future PhotoStudio externalization.

This taskbook does not move PhotoStudio code, copy project data, read project data files, activate external package discovery, run external sync/publish, write LocalState, or modify runtime data paths.

## 2. Current PhotoStudio Observations

Read-only source and path inspection:

```text
modules/photoStudio/**
Plugin/PhotoStudio*/**
tests/photo-studio/**
docs/photo_studio_*.md
docs/PHOTO_STUDIO_GUIDE_CONTRACT_PHASE2_GATE.md
docs/governance/PHOTO_STUDIO_NEXT_DIRTY_REVIEW_20260525.md
plugins/custom/shared/photo_studio_data/*.json
plugins/custom/shared/photo_studio_data/*.js
```

Observed source-like pattern:

```text
modules/photoStudio/* contains services, templates, runtime helpers, and store abstractions.
Plugin/PhotoStudio* contains plugin wrappers and manifests.
tests/photo-studio/* uses temporary workspaces / temp data roots for validation.
```

Observed private/data-like pattern:

```text
plugins/custom/shared/photo_studio_data/*.json contains PhotoStudio data collections.
PhotoStudio services read/write collections through configured data roots.
External sync / delivery / calendar / archive flows can create local shadow records.
```

Only path names and source/test files were inspected for M26. PhotoStudio data JSON contents, media, exports, operator notes, and project records were not read.

## 3. Future Env Contract

Future PhotoStudio source package discovery may use:

```text
VCP_PHOTOSTUDIO_PACKAGE_ALLOWED_ROOTS
VCP_PHOTOSTUDIO_PACKAGE_DIRS
```

Existing and future data roots remain separate:

```text
PHOTO_STUDIO_DATA_DIR
PhotoStudioDataPath
VCP_LOCAL_STATE_DIR
```

Rules:

- If package env vars are unset, current PhotoStudio behavior remains unchanged.
- Source package discovery must be separate from data root selection.
- `PHOTO_STUDIO_DATA_DIR` / `PhotoStudioDataPath` must point only to private data lanes or temporary test roots, never to reviewed source packages.
- Package registration must be default-off until manifest validation and no-auto-write validation pass.
- External sync, publish, sheet, Notion, calendar, delivery, provider, or bridge writes require separate explicit approval.
- LocalState, `.agent_board/**`, media, exports, generated outputs, project data, caches, logs, DB/vector sidecars, and operator notes must not be package source roots.

## 4. Proposed External Package Shape

Future reviewed source package shape:

```text
PhotoStudioPackages/
  <PackageName>/
    photo-studio-package-manifest.json
    README.AGENTS_OS.md
    plugins/
    services/
    templates/
    schemas/
    fixtures/
      no-auto-write/
        request.redacted.json
        expected-result.json
    tests/
```

M26 does not create this shape. Any future fixture must be temporary or explicitly reviewed.

## 5. Manifest Schema Draft

`photo-studio-package-manifest.json` should be JSON and contain only metadata, source paths, schemas, templates, and redacted fixtures:

```json
{
  "schemaVersion": 1,
  "packageId": "jenn.example.photo-studio-package",
  "displayName": "Jenn Example PhotoStudio Package",
  "description": "Reviewed no-auto-write PhotoStudio package fixture.",
  "defaultEnabled": false,
  "source": {
    "plugins": [
      "plugins/PhotoStudioProjectRecord"
    ],
    "services": [
      "services/projectService.js"
    ],
    "templates": [
      "templates/replyTemplates.js"
    ]
  },
  "fixtures": {
    "noAutoWriteRequest": "fixtures/no-auto-write/request.redacted.json",
    "expectedResult": "fixtures/no-auto-write/expected-result.json"
  },
  "permissions": {
    "projectDataReads": false,
    "projectDataWrites": false,
    "externalWrites": false,
    "providerCalls": false,
    "bridgeCalls": false,
    "localStateReads": false
  }
}
```

## 6. Source / Private Lane Split

Reviewed external source may include:

- PhotoStudio plugin wrappers and manifests;
- service code;
- template builders;
- schemas;
- redacted no-auto-write fixtures;
- docs that do not embed real project records;
- tests that use temporary data roots only.

Private/default-excluded lanes must include:

- `plugins/custom/shared/photo_studio_data/*.json` real data collections;
- project records, customer records, tasks, calendar events, reminders, content pool, archive assets, external export records, delivery queues, status logs;
- media, generated output, exports, delivery artifacts, operator notes, external service payloads;
- LocalState/private data;
- cache, logs, DB/vector sidecars, runtime queues;
- `.agent_board/**`;
- secrets, tokens, auth material, provider config, sheet/API credentials, webhooks, Notion/calendar credentials.

## 7. Candidate Gate

Before any PhotoStudio content is copied to Jenn External Runtime, a separate reviewed candidate gate must classify source paths:

```text
possible external source candidates:
  Plugin/PhotoStudio*/**
  modules/photoStudio/**/*Service.js
  modules/photoStudio/**/*Templates.js
  modules/photoStudio/runtime.js
  modules/photoStudio/constants.js
  docs/photo_studio_*.md
  tests/photo-studio/*.test.js

private / blocked by default:
  plugins/custom/shared/photo_studio_data/*.json
  media / exports / generated output
  LocalState/private/operator data
  .agent_board/**
  real external sync payloads and credentials
```

This taskbook does not approve copying those files. It only defines the gate.

Candidate review must record:

- source path;
- source-like / private / blocked classification;
- paths-only secret-risk scan result;
- whether content review is allowed;
- additive / override / blocked decision;
- rollback path.

## 8. No-Auto-Write Validation Plan

Future validation may be fixture-only:

- parse manifest JSON;
- validate schema-required fields;
- reject path escapes and blocked paths;
- use a temporary data root only;
- assert project data read count `0` for package manifest validation;
- assert project data write count `0` for package manifest validation;
- assert external write count `0`;
- assert provider / bridge call count `0`;
- record checksum for reviewed fixture/source files only;
- rollback by deleting or ignoring only the temporary fixture package.

Tests that need data behavior must use temp roots created during the test and must not read or copy real `photo_studio_data/*.json`.

## 9. Stop Conditions

Stop and mark BLOCK if future work requires:

- reading real PhotoStudio project data JSON contents;
- copying media, exports, generated output, delivery queues, archive assets, operator notes, or external service payloads;
- reading LocalState/private/operator data;
- reading `.agent_board/**`;
- writing real PhotoStudio data collections;
- external sync, publish, sheet, Notion, calendar, provider, bridge, or delivery writes;
- modifying `PHOTO_STUDIO_DATA_DIR`, `PhotoStudioDataPath`, `.env`, `config.env`, credentials, tokens, auth material, or provider config;
- recording raw customer/project/media/operator data in receipts.

## 10. Rollback

M26 rollback:

```text
revert this taskbook and the tracker M26/S47 update
```

Future fixture rollback:

```text
remove only reviewed temporary fixture files after verifying the target path is inside the approved fixture root
do not delete PhotoStudio data collections, media, exports, LocalState, logs, DB/vector sidecars, or .agent_board/**
```

## 11. Safety Confirmations

```text
PhotoStudio runtime code modified: no
PhotoStudio package created: no
PhotoStudio project data read: no
PhotoStudio project data copied: no
PhotoStudio project data written: no
External sync/publish/write executed: no
LocalState content read/copied: no
.agent_board content read/copied/checksummed/migrated: no
Provider call executed: no
Bridge call executed: no
Production deploy/service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 12. Validation

M26 validation is documentation-only:

```powershell
git diff --check
rg -n "TASKBOOK_READY_NO_PHOTOSTUDIO_DATA_READ_NO_EXTERNAL_WRITE|VCP_PHOTOSTUDIO_PACKAGE_DIRS|PHOTO_STUDIO_DATA_DIR|No-Auto-Write|PhotoStudio project data read: no|External sync/publish/write executed: no|Upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M26_PHOTOSTUDIO_EXTERNALIZATION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```
