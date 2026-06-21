# M23 AI Image Adapter Externalization Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_PROVIDER_RUNTIME_CHANGE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Source contract:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`

## 1. Purpose

M23 defines the taskbook for future AI Image adapter externalization.

This taskbook does not move AI Image code, modify runtime wiring, create adapter packages, read `.env`, read provider config, call providers, generate images, write `image/**`, write LocalState, or activate external adapter discovery.

## 2. Current AI Image Observations

Read-only source inspection:

```text
modules/aiImageExecutionAdapter.js
modules/aiImageJennTrialFixtures.js
modules/aiImageNativeDelegateBindings.js
modules/nativeImageDelegateRegistry.js
modules/nativeDoubaoSecretlessRuntimeDelegate.js
routes/admin/aiImageAgents.js
server.js
tests/aiImageExecutionAdapter.test.js
tests/aiImageAgentsRoute.test.js
tests/aiImageAgentsServerBinding.test.js
tests/aiImageJennTrialFixtures.test.js
tests/nativeImageDelegateRegistry.test.js
```

Observed core runtime pattern:

```text
modules/aiImageExecutionAdapter.js maps normalized image steps to PluginManager tool calls.
routes/admin/aiImageAgents.js defaults to dry-run and requires explicit gates before requested execution.
server.js mounts ai-image agents route only behind env gates.
```

Observed Jenn-specific source pattern:

```text
modules/aiImageJennTrialFixtures.js contains Jenn trial activation ids, receipt refs, output refs, and path override metadata.
modules/aiImageNativeDelegateBindings.js contains frozen Doubao binding metadata and redacted runtime metadata defaults.
nativeImageDelegateRegistry imports binding data rather than duplicating provider literals.
tests assert these aggregates are frozen and side-effect-free.
```

Current state is not yet clean externalization:

```text
Jenn-specific AI Image trial and provider binding metadata still exists in core source.
The current route/server consume generic aggregate boundaries, but external package discovery is not implemented.
Provider runtime validation remains out of scope for this route.
```

## 3. Future Env Contract

Future AI Image adapter discovery may use:

```text
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS
VCP_AI_IMAGE_ADAPTER_DIRS
```

Rules:

- If unset, current AI Image behavior remains unchanged.
- Discovery must be separate from runtime activation.
- Adapter registration must be default-off until manifest validation and shadow validation pass.
- Provider execution must remain disabled unless a later explicit provider gate authorizes it.
- LocalState, `.agent_board/**`, runtime output roots, `image/**`, provider credential roots, and private operator media must not be adapter source roots.

## 4. Proposed External Package Shape

Future reviewed source package shape:

```text
AIImageAdapters/
  <AdapterName>/
    ai-image-adapter-manifest.json
    README.AGENTS_OS.md
    bindings/
      redacted-provider-binding.json
    fixtures/
      no-provider/
        dry-run-plan.json
        expected-result.json
    src/
      index.js
    tests/
```

M23 does not create this shape. M24 may create only a temporary or reviewed fixture package for no-provider shadow validation.

## 5. Manifest Schema Draft

`ai-image-adapter-manifest.json` should be JSON and contain only metadata, redacted binding references, and relative paths:

```json
{
  "schemaVersion": 1,
  "adapterId": "jenn.example.ai-image-adapter",
  "displayName": "Jenn Example AI Image Adapter",
  "description": "Reviewed no-provider AI Image adapter fixture.",
  "defaultEnabled": false,
  "provider": {
    "providerId": "fixture-only",
    "providerSpecific": true,
    "secretsRequired": false,
    "runtimeProviderCallsAllowed": false
  },
  "capabilities": [
    "generate_image"
  ],
  "entry": "src/index.js",
  "bindings": [
    {
      "bindingId": "fixture-redacted-binding",
      "path": "bindings/redacted-provider-binding.json",
      "redacted": true
    }
  ],
  "fixtures": {
    "noProviderDryRunPlan": "fixtures/no-provider/dry-run-plan.json",
    "expectedResult": "fixtures/no-provider/expected-result.json"
  },
  "permissions": {
    "providerCalls": false,
    "imageGeneration": false,
    "externalWrites": false,
    "bridgeCalls": false,
    "localStateReads": false
  }
}
```

## 6. Source / Private Lane Split

Reviewed external source may include:

- generic adapter source code;
- redacted binding metadata;
- no-provider dry-run fixtures;
- schema manifests;
- tests that use mock providers or no-provider harnesses.

LocalState/private lanes must contain, or continue to exclude:

- real provider credentials, tokens, API keys, cookies, auth headers, and `.env` values;
- real generated images, image outputs, operator media, exports, cache, logs, DB/vector sidecars, and runtime queues;
- private prompt payloads, operator notes, project delivery data, or non-redacted provider request/response bodies;
- `.agent_board/**`.

## 7. Future Candidate Gate

Before any AI Image content is copied out of core, a separate reviewed candidate gate must classify source files:

```text
possible external source candidates:
  modules/aiImageJennTrialFixtures.js
  modules/aiImageNativeDelegateBindings.js
  modules/nativeDoubaoSecretlessRuntimeDelegate.js

possible clean core generic contracts:
  modules/aiImageExecutionAdapter.js
  modules/nativeImageDelegateRegistry.js
  routes/admin/aiImageAgents.js
```

This taskbook does not approve copying those files. It only defines the gate.

Candidate review must record:

- source path;
- whether the content is source-like or private/operator data;
- secret-risk path scan result;
- content-risk review result without printing secrets;
- additive / override / blocked decision;
- rollback path.

## 8. M24 No-Provider Shadow Validation Plan

M24 may create a temporary fixture package only if:

```text
M23 is PASS
core worktree is clean or accounted
fixture target is inside a reviewed temp or external package root
manifest paths are relative and do not escape root
paths-only risk scan is clean
provider calls are disabled
image generation is disabled
no real image output path is written
no LocalState/private/operator data is read
no .agent_board/** content is read, copied, checksummed, or migrated
```

M24 validation should be no-provider only:

- parse manifest JSON;
- validate schema-required fields;
- reject path escapes and blocked paths;
- execute only a mock/no-provider adapter path;
- assert provider call count `0`;
- assert image generation count `0`;
- assert output write count `0`;
- record checksum for reviewed fixture files;
- rollback by deleting or ignoring only the temporary fixture package.

Provider success must not be used as a prerequisite for source package integrity.

## 9. Stop Conditions

Stop and mark BLOCK if future work requires:

- reading `.env`, provider config, credentials, tokens, cookies, auth headers, or production endpoints;
- calling a provider, plugin bridge, or live external service;
- generating a real image or writing to `image/**`;
- reading LocalState/private/operator content;
- copying `.agent_board/**`;
- enabling `ENABLE_AI_IMAGE_REAL_EXECUTION`;
- setting real `VCP_AI_IMAGE_ADAPTER_DIRS`;
- modifying server route mounting before manifest and no-provider validation pass;
- moving Jenn-specific constants without a reviewed content gate;
- treating mock/no-provider PASS as provider validation.

## 10. Rollback

M23 rollback:

```text
revert this taskbook and the tracker M23/S44 update
```

Future M24 rollback:

```text
remove only reviewed temporary fixture files after verifying the target path is inside the approved fixture root
do not delete core AI Image files
do not delete LocalState/private data, generated images, provider config, or .agent_board/**
```

## 11. Safety Confirmations

```text
AI Image runtime code modified: no
AI Image adapter package created: no
Provider call executed: no
Real image generated: no
image/** written: no
Real VCP_AI_IMAGE_ADAPTER_DIRS activated: no
ENABLE_AI_IMAGE_REAL_EXECUTION enabled: no
LocalState content read/copied: no
.agent_board content read/copied/checksummed/migrated: no
Bridge call executed: no
Production deploy/service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 12. Validation

M23 validation is documentation-only:

```powershell
git diff --check
rg -n "TASKBOOK_READY_NO_PROVIDER_RUNTIME_CHANGE|VCP_AI_IMAGE_ADAPTER_DIRS|providerCalls|imageGeneration|M24 No-Provider|Provider call executed: no|Real image generated: no|Upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M23_AI_IMAGE_ADAPTER_EXTERNALIZATION_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```
