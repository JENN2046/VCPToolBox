# M76 AI Image Default-Off Diagnostic Route Taskbook

Date: 2026-06-22

Status: TASKBOOK_READY_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M75_AI_IMAGE_REGISTRY_REVIEW_OR_CLOSEOUT_DECISION_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M76 defines the future default-off AI Image adapter diagnostic route gate.

M76 is docs-only. It does not:

- implement a route;
- mount a router in `server.js`, `routes/adminPanelRoutes.js`, or any production router;
- modify `routes/admin/aiImageAgents.js`;
- modify `modules/aiImageExecutionAdapter.js`, `modules/nativeImageDelegateRegistry.js`, provider execution modules, or runtime dispatch;
- write `config.env`, `.env`, provider config, secrets, tokens, credentials, auth material, or endpoints;
- set `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS`, `VCP_AI_IMAGE_ADAPTER_DIRS`, `ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE`, `ENABLE_AI_IMAGE_AGENTS_ROUTE`, or `ENABLE_AI_IMAGE_REAL_EXECUTION` in real env;
- start production server, dev server, preview server, browser smoke, or provider runtime;
- call a provider, generate a real image, write `image/**`, write output data, call a bridge, or perform live external writes;
- read LocalState/private/operator content or `.agent_board/**`;
- open upstream PR.

## 2. Future Route Candidate

Future diagnostic route candidate:

```text
GET /admin_api/ai-image-adapter-registry/diagnostics
```

Future M77 may create only a route factory and test-only local mount for this URL. Production-router integration remains deferred to a later taskbook.

M77 route implementation stop line:

```text
M77_ALLOWED_IMPL=test-only route factory + focused tests + local harness
M77_FORBIDDEN_IMPL=server.js mount, production-router integration, real env write, provider call, image output, bridge call, LocalState/private read
```

If M77 appears to require `server.js`, production router mount, `routes/admin/aiImageAgents.js`, frontend changes, real env changes, provider execution, or image output, stop and write a separate taskbook instead.

## 3. Future Env Contract

Future diagnostic route must be default-off.

Required route gate for any future route mount:

```text
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE=true
```

Required scoped metadata env for future local test harness only:

```text
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS=<external root>
VCP_AI_IMAGE_ADAPTER_DIRS=<external AIImageAdapters root>
```

Must remain unset or false unless a later explicit gate says otherwise:

```text
ENABLE_AI_IMAGE_REAL_EXECUTION != true
ENABLE_AI_IMAGE_AGENTS_ROUTE not modified by M76/M77
ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE != true
```

M76 and future M77 must not write these values into real `config.env` or `.env`.

## 4. Auth Boundary

The diagnostic route is admin-only.

Future implementation must:

- run only under the existing `/admin_api/**` admin-auth boundary when eventually mounted in production;
- use local test-only auth in scoped harnesses, not anonymous production access;
- avoid adding a new bearer token, shared secret, or alternate auth bypass;
- return `401` or `403` when the admin-auth boundary rejects access in any production-router future gate;
- not echo request headers, cookies, admin credentials, auth code, bearer token, session data, or auth diagnostics.

M77 may test route behavior with a local Express app, but that test mount must not be treated as production exposure.

## 5. Metadata Source

Future route must read metadata only from:

```text
modules/aiImageAdapterRegistry.js
buildAiImageAdapterRegistryPlan({ projectRoot, env })
```

Future route must not:

- `require()` or execute adapter entry files;
- read raw binding file contents;
- read provider credentials, endpoints, tokens, cookies, auth material, or `.env` values;
- call `executeAiImagePipelineV2`;
- call `PluginManager.processToolCall`;
- call `nativeImageDelegateRegistry`;
- read LocalState/private/operator data or `.agent_board/**`;
- enumerate `image/**` or output directories.

Discovery success may appear only as read-only metadata. It must not be reported as executable runtime registration.

## 6. Allowed Response Fields

Future route may return only redacted, read-only metadata.

Top-level fields:

```text
ok
status
mode
routeEnabled
metadataRegistryEnabled
allowedRootCount
adapterDirCount
adapterMetadataCount
executableAdapterCount
providerCallCount
imageGenerationCount
outputWriteCount
bridgeCallCount
localStateReadCount
diagnosticsSummary
realExecutionEnabled
productionProviderRuntimeEnabled
```

Adapter fields:

```text
adapterId
displayName
description
schemaVersion
defaultEnabled
metadataRegistered
executable
executionBlockedReason
provider.providerId
provider.providerSpecific
provider.secretsRequired
provider.runtimeProviderCallsAllowed
capabilities
permissions.providerCalls
permissions.imageGeneration
permissions.externalWrites
permissions.bridgeCalls
permissions.localStateReads
entry.relativePath
entry.exists
entry.safeFile
bindings[].bindingId
bindings[].redacted
bindings[].relativePath
bindings[].exists
bindings[].safeFile
fixtures.<name>.relativePath
fixtures.<name>.exists
fixtures.<name>.safeFile
```

Path fields must be relative or sanitized display paths only. Absolute filesystem paths are forbidden in route responses.

## 7. Forbidden Response Fields

Future route must never return:

- raw env values;
- `.env` or `config.env` contents;
- secrets, tokens, credentials, passwords, cookies, auth headers, admin credentials, auth code, session values, or provider endpoints;
- raw binding JSON contents;
- adapter source code;
- raw manifest file contents beyond the allowed fields above;
- absolute filesystem paths;
- LocalState/private/operator paths or contents;
- `.agent_board/**` paths or contents;
- image output paths, generated image references, prompt text, model payloads, provider request/response bodies, or bridge payloads;
- request headers, raw cookies, bearer tokens, Basic auth strings, or auth failure details;
- raw stack traces.

## 8. Future M77 Allowed Files

If explicitly authorized later, M77 may touch only:

```text
routes/admin/aiImageAdapterDiagnostics.js                 # new route factory only, no production mount
tests/ai-image-adapter-diagnostic-route.test.js           # new focused route factory tests
scripts/run-ai-image-default-off-diagnostic-route-gate-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_*.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M77 must not modify:

```text
server.js
routes/adminPanelRoutes.js
routes/admin/aiImageAgents.js
modules/aiImageExecutionAdapter.js
modules/nativeImageDelegateRegistry.js
modules/nativeDoubaoSecretlessRuntimeDelegate.js
Plugin/**
AdminPanel-Vue/**
image/**
LocalState/**
.agent_board/**
config.env
.env
```

Any production-router integration must be a later taskbook after M77 route factory validation passes.

## 9. Future M77 Required Validation

M77 should validate:

```powershell
node --check routes\admin\aiImageAdapterDiagnostics.js
node --test tests\ai-image-adapter-diagnostic-route.test.js
node --check scripts\run-ai-image-default-off-diagnostic-route-gate-harness.js
node scripts\run-ai-image-default-off-diagnostic-route-gate-harness.js
node scripts\run-ai-image-no-provider-runtime-registration-gate-harness.js
node scripts\run-ai-image-persistent-provider-adapter-gate-harness.js
```

Future M77 harness must emit:

```text
AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_GATE_PASS=yes
DEFAULT_OFF_ROUTE_STATUS=404
SCOPED_ROUTE_STATUS=200
SCOPED_METADATA_ADAPTER_COUNT=1
SCOPED_EXECUTABLE_ADAPTER_COUNT=0
SCOPED_PROVIDER_CALL_COUNT=0
SCOPED_IMAGE_GENERATION_COUNT=0
SCOPED_OUTPUT_WRITE_COUNT=0
SCOPED_BRIDGE_CALL_COUNT=0
SCOPED_LOCALSTATE_READ_COUNT=0
RESPONSE_ABSOLUTE_PATH_COUNT=0
RESPONSE_SECRET_FIELD_COUNT=0
REAL_CONFIG_ENV_MODIFIED=no
PRODUCTION_SERVER_STARTED=no
PROVIDER_CALL_EXECUTED=no
REAL_IMAGE_GENERATED=no
IMAGE_OUTPUT_WRITTEN=no
BRIDGE_WRITE_EXECUTED=no
LOCALSTATE_PRIVATE_READ=no
UPSTREAM_PR_OPENED=no
```

## 10. Rollback

M76 rollback is docs-only:

```text
revert this taskbook
revert tracker M76/S97/Q58 updates
```

Future M77 rollback must:

- unset only scoped process env values used by the test harness;
- remove or revert only the new route factory, test, harness, receipt, and tracker updates;
- prove default-off route status returns to `404` in test-only harness;
- leave external AI Image package content intact;
- leave existing AI Image execution routes intact;
- not delete generated images, LocalState/private data, provider config, or `.agent_board/**`.

## 11. Stop Conditions

Stop and mark M77 BLOCK if future implementation would require:

- writing real `config.env` or `.env`;
- setting `ENABLE_AI_IMAGE_REAL_EXECUTION=true`;
- starting production server, dev server, preview server, or browser smoke;
- modifying `server.js`, production router mount, `routes/admin/aiImageAgents.js`, or frontend files;
- calling providers, bridges, plugins, or live external services;
- generating images or writing `image/**`;
- reading provider secrets, tokens, credentials, auth material, cookies, endpoints, or raw binding files;
- reading LocalState/private/operator content or `.agent_board/**`;
- returning absolute paths or secret-like fields in route responses;
- treating diagnostic route success as executable adapter registration.

## 12. Safety Confirmations

```text
M76_TASKBOOK_ONLY=yes
M76_ROUTE_IMPLEMENTED=no
M76_RUNTIME_CODE_MODIFIED=no
M76_REAL_CONFIG_ENV_MODIFIED=no
M76_PROVIDER_TOKEN_READ=no
M76_PROVIDER_CALL_EXECUTED=no
M76_REAL_IMAGE_GENERATED=no
M76_IMAGE_OUTPUT_WRITTEN=no
M76_BRIDGE_WRITE_EXECUTED=no
M76_LOCALSTATE_PRIVATE_READ=no
M76_AGENT_BOARD_READ=no
M76_PRODUCTION_SERVER_STARTED=no
M76_UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_FACTORY_GATE
```
