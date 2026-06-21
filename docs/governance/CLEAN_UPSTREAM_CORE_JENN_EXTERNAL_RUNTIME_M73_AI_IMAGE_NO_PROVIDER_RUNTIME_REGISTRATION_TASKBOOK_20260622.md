# M73 AI Image No-Provider Runtime Registration Taskbook

Date: 2026-06-22

Status: TASKBOOK_READY_AI_IMAGE_NO_PROVIDER_DEFAULT_OFF_RUNTIME_REGISTRATION

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M73 defines the future M74 gate for AI Image adapter runtime registration, with all runtime behavior default-off and no-provider.

M73 is docs-only. It does not:

- modify `server.js`, `routes/admin/aiImageAgents.js`, `modules/aiImageExecutionAdapter.js`, `modules/nativeImageDelegateRegistry.js`, or any runtime module;
- modify the external package repository or `AIImageAdapters/JennImageProviderAdapter/**`;
- write `config.env`, `.env`, provider config, secrets, tokens, auth material, credentials, or production endpoints;
- set `VCP_AI_IMAGE_ADAPTER_DIRS`, `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS`, `ENABLE_AI_IMAGE_AGENTS_ROUTE`, or `ENABLE_AI_IMAGE_REAL_EXECUTION`;
- start production server, dev server, preview server, provider runtime, bridge runtime, browser smoke, or build;
- call a provider, generate a real image, write `image/**`, write output data, call a bridge, or perform live external writes;
- read, copy, checksum, or migrate LocalState/private/operator data or `.agent_board/**`;
- open upstream PR, deploy, delete, untrack, stub, or remove core fallback content.

## 2. Source Evidence

| Evidence | Reusable part | M73 boundary |
| --- | --- | --- |
| M23 AI Image adapter externalization taskbook | Env contract names, manifest shape, source/private split, no-provider validation rules. | M23 did not create runtime registration and did not authorize provider execution. |
| M24 AI Image no-provider shadow validation | Temporary fixture validation shape and zero-counter expectations. | M24 did not create persistent runtime registration. |
| M32 AI Image persistent package gate | Persistent external package `AIImageAdapters/JennImageProviderAdapter` and no-provider harness evidence. | M32 explicitly records runtime adapter registration reference count `0`; M73 must not convert package existence into runtime enablement. |
| M72 next runtime lane decision | Selected future `M73_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_TASKBOOK`. | M72 did not write M73 taskbook or enable runtime. |
| Current core AI Image modules | Existing default-off route/execution gate patterns and tests. | Admin execution route is not an adapter registry and must not be widened by M73. |

## 3. Current Reusable Assets

Persistent external package:

```text
A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions/AIImageAdapters/JennImageProviderAdapter/
  ai-image-adapter-manifest.json
  README.AGENTS_OS.md
  bindings/redacted-provider-binding.json
  fixtures/no-provider/dry-run-plan.json
  fixtures/no-provider/expected-result.json
  src/index.js
```

Core reference modules and tests:

```text
modules/aiImageExecutionAdapter.js
modules/nativeImageDelegateRegistry.js
routes/admin/aiImageAgents.js
server.js
scripts/run-ai-image-persistent-provider-adapter-gate-harness.js
scripts/run-ai-image-no-provider-shadow-validation-harness.js
tests/aiImageExecutionAdapter.test.js
tests/nativeImageDelegateRegistry.test.js
tests/aiImageAgentsServerBinding.test.js
```

M73 review conclusion:

```text
Reusable for M74 planning: yes
Reusable as active provider runtime: no
Reusable as token/provider execution proof: no
Reusable as image output proof: no
```

## 4. Important Risk Note

The persistent external manifest is provider-specific and declares:

```text
providerSpecific=true
secretsRequired=true
runtimeProviderCallsAllowed=false
permissions.providerCalls=false
permissions.imageGeneration=false
```

Therefore, future M74 may register only metadata and diagnostics while no-provider gates are active. M74 must not treat this adapter as executable, credential-ready, token-ready, or image-generation-ready.

## 5. Future M74 Objective

M74 should implement or validate only a default-off AI Image adapter registry shape:

```text
M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_GATE
```

M74 allowed objective:

- parse reviewed `ai-image-adapter-manifest.json`;
- validate allowed roots and adapter directories in a scoped test env only;
- expose in-process metadata/diagnostics proving the adapter can be discovered while disabled;
- keep `defaultEnabled=false` as non-executable;
- keep provider/image/output/bridge/LocalState counters at `0`;
- prove rollback from scoped env-on to default-off.

M74 forbidden objective:

- provider execution;
- token loading;
- image generation;
- output writes;
- bridge calls;
- route execution widening;
- real `config.env` edits;
- production server startup.

## 6. Future M74 Allowed Files

M74 may touch only a narrow set if implementation is approved:

```text
modules/aiImageAdapterRegistry.js                  # new pure/default-off registry module
tests/ai-image-adapter-registry.test.js            # new focused unit tests
scripts/run-ai-image-no-provider-runtime-registration-gate-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_RECEIPT_*.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M74 should not modify these files unless a later taskbook explicitly expands scope:

```text
server.js
routes/admin/aiImageAgents.js
modules/aiImageExecutionAdapter.js
modules/nativeImageDelegateRegistry.js
modules/nativeDoubaoSecretlessRuntimeDelegate.js
config.env
.env
AdminPanel-Vue/**
Plugin/**
image/**
LocalState/**
.agent_board/**
```

If M74 appears to require `server.js` or `routes/admin/aiImageAgents.js`, stop and create a separate production-router/frontend/admin-route taskbook instead.

## 7. Future M74 Env Contract

M74 may use scoped process-only env in a test harness:

```text
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS=<external root>
VCP_AI_IMAGE_ADAPTER_DIRS=<external AIImageAdapters root>
```

M74 must not write these keys into real `config.env` or `.env`.

M74 must keep these unset or false:

```text
ENABLE_AI_IMAGE_REAL_EXECUTION != true
ENABLE_AI_IMAGE_AGENTS_ROUTE not modified by M74
ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE != true
```

## 8. Future M74 Required Validation

M74 validation should include:

```powershell
node --check modules/aiImageAdapterRegistry.js
node --test tests/ai-image-adapter-registry.test.js
node --check scripts/run-ai-image-no-provider-runtime-registration-gate-harness.js
node scripts/run-ai-image-no-provider-runtime-registration-gate-harness.js
node scripts/run-ai-image-persistent-provider-adapter-gate-harness.js
```

The M74 harness must emit and verify:

```text
AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_GATE_PASS=yes
DEFAULT_OFF_ADAPTER_COUNT=0
SCOPED_ENV_ADAPTER_METADATA_COUNT=1
SCOPED_ENV_EXECUTABLE_ADAPTER_COUNT=0
SCOPED_ENV_PROVIDER_CALL_COUNT=0
SCOPED_ENV_IMAGE_GENERATION_COUNT=0
SCOPED_ENV_OUTPUT_WRITE_COUNT=0
SCOPED_ENV_BRIDGE_CALL_COUNT=0
SCOPED_ENV_LOCALSTATE_READ_COUNT=0
REAL_CONFIG_ENV_MODIFIED=no
ENABLE_AI_IMAGE_REAL_EXECUTION_TRUE=no
PRODUCTION_SERVER_STARTED=no
UPSTREAM_PR_OPENED=no
```

## 9. Runtime Registration Semantics

M74 must distinguish these states:

| State | Meaning | Allowed in M74 |
| --- | --- | --- |
| Discovery | manifest file can be found under reviewed scoped env roots | yes |
| Metadata registration | manifest metadata appears in a read-only in-process registry | yes |
| Runtime execution registration | adapter can execute provider/image steps | no |
| Provider activation | credentials are loaded and real provider can be called | no |
| Route exposure | Admin/HTTP route exposes this adapter | no |

Discovery success must not be treated as runtime execution registration success.

## 10. Stop Conditions

Stop and mark M74 BLOCK if implementation would require:

- reading provider secrets, tokens, credentials, auth material, cookies, endpoints, or `.env` values;
- writing real `config.env` or `.env`;
- setting `ENABLE_AI_IMAGE_REAL_EXECUTION=true`;
- starting `server.js`, AdminPanel dev/preview, browser smoke, or production services;
- calling providers, bridges, plugins, or live external services;
- generating images or writing `image/**`;
- reading/writing LocalState/private/operator content or `.agent_board/**`;
- modifying `server.js`, `routes/admin/aiImageAgents.js`, AdminPanel source/dist, or core execution dispatch;
- treating `secretsRequired=true` as satisfied;
- using old AI Image branch diffs or `AdminPanel-Vue/dist` artifacts as source.

## 11. Rollback

M73 rollback is docs-only:

```text
revert this taskbook
revert tracker M73/S94/Q55 update
```

Future M74 rollback must:

- unset only scoped process env values used by the test harness;
- remove or revert only new M74 registry/test/harness files;
- leave external package content and core AI Image fallback/runtime files intact;
- not delete generated images, LocalState/private data, provider config, or `.agent_board/**`.

## 12. Safety Confirmations

```text
M73_TASKBOOK_ONLY=yes
M73_RUNTIME_CODE_MODIFIED=no
M73_EXTERNAL_PACKAGE_MODIFIED=no
M73_REAL_CONFIG_ENV_MODIFIED=no
M73_PROVIDER_TOKEN_READ=no
M73_PROVIDER_CALL_EXECUTED=no
M73_REAL_IMAGE_GENERATED=no
M73_IMAGE_OUTPUT_WRITTEN=no
M73_BRIDGE_WRITE_EXECUTED=no
M73_LOCALSTATE_PRIVATE_READ=no
M73_PRODUCTION_SERVER_STARTED=no
M73_UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M74_AI_IMAGE_NO_PROVIDER_RUNTIME_REGISTRATION_GATE
```
