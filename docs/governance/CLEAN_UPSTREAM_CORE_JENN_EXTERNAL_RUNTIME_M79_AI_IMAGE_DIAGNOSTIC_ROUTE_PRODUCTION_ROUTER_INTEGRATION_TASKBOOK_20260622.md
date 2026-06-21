# M79 AI Image Diagnostic Route Production-Router Integration Taskbook

Date: 2026-06-22

Status: TASKBOOK_READY_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION

Parent decision: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M78_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M79 defines the future M80 default-off production-router integration gate for the AI Image adapter diagnostic route.

M79 is docs-only. It does not:

- modify production router code;
- modify `server.js`;
- write `config.env`, `.env`, provider config, secrets, tokens, credentials, auth material, or endpoints;
- set `ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE`, `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS`, `VCP_AI_IMAGE_ADAPTER_DIRS`, `ENABLE_AI_IMAGE_AGENTS_ROUTE`, or `ENABLE_AI_IMAGE_REAL_EXECUTION` in real env;
- start production server, dev server, preview server, browser smoke, or provider runtime;
- call a provider, generate a real image, write `image/**`, write output data, call a bridge, or perform live external writes;
- read LocalState/private/operator content or `.agent_board/**`;
- open upstream PR.

## 2. Future M80 Allowed Files

M80 may touch only:

```text
modules/aiImageAdapterDiagnosticRuntimeMount.js
routes/adminPanelRoutes.js
tests/ai-image-adapter-diagnostic-runtime-mount.test.js
scripts/run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_*.md
docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
```

M80 may also rerun existing checks for:

```text
routes/admin/aiImageAdapterDiagnostics.js
tests/ai-image-adapter-diagnostic-route.test.js
scripts/run-ai-image-default-off-diagnostic-route-gate-harness.js
scripts/run-ai-image-no-provider-runtime-registration-gate-harness.js
scripts/run-ai-image-persistent-provider-adapter-gate-harness.js
```

M80 must not modify:

```text
server.js
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

## 3. Future Mount Strategy

Future M80 should integrate through the existing Admin API router:

```text
server.js already mounts routes/adminPanelRoutes.js at /admin_api
routes/adminPanelRoutes.js may call a small helper
helper may mount /ai-image-adapter-registry on the adminApiRouter only when ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE=true
final URL remains GET /admin_api/ai-image-adapter-registry/diagnostics
```

Default-off behavior:

```text
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE unset => no production-router mount and GET returns 404
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE=true with scoped metadata env => route mounts and GET may return sanitized metadata
ENABLE_AI_IMAGE_REAL_EXECUTION=true => route stays fail-closed with 409
```

## 4. Auth Boundary

The route is admin-only.

M80 must:

- rely on the existing `/admin_api/**` admin-auth middleware in production;
- require an explicit request marker from the admin-auth boundary or a scoped test marker before returning metadata;
- return `403` when the route env is enabled but the admin-auth marker is missing;
- not add a new bearer token, shared secret, header bypass, cookie parser, or alternate auth path;
- not echo request headers, cookies, admin credentials, auth code, bearer tokens, sessions, or auth diagnostics.

The local harness may simulate the production admin-auth boundary with a marker such as:

```text
req.adminAuthBoundaryReached = true
```

That marker is test-only and must not be treated as a new production auth mechanism.

## 5. Response Contract

M80 must preserve the M76/M77 response contract:

- metadata-only response;
- relative paths only;
- no absolute paths;
- no raw env values;
- no `.env` or `config.env` contents;
- no secrets, tokens, credentials, passwords, cookies, auth headers, admin credentials, provider endpoints, or session values;
- no raw binding JSON contents;
- no adapter source code;
- no prompt, generated image reference, output path, provider request/response body, or bridge payload;
- provider/image/output/bridge/LocalState counters remain `0`;
- executable adapter count remains `0`.

Discovery or route reachability must not be reported as executable runtime registration.

## 6. Required Validation

M80 should run:

```powershell
node --check modules\aiImageAdapterDiagnosticRuntimeMount.js
node --check routes\adminPanelRoutes.js
node --check scripts\run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js
node --test tests\ai-image-adapter-diagnostic-route.test.js tests\ai-image-adapter-diagnostic-runtime-mount.test.js
node scripts\run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js
node scripts\run-ai-image-default-off-diagnostic-route-gate-harness.js
node scripts\run-ai-image-no-provider-runtime-registration-gate-harness.js
node scripts\run-ai-image-persistent-provider-adapter-gate-harness.js
git diff --check
```

Required harness evidence:

```text
AI_IMAGE_DIAGNOSTIC_PRODUCTION_ROUTER_INTEGRATION_SCOPED_ENV_PASS=yes
DEFAULT_OFF_ROUTE_STATUS=404
SCOPED_ROUTE_STATUS=200
UNAUTHORIZED_ROUTE_STATUS=403
SCOPED_POST_STATUS=404
REAL_EXECUTION_BLOCKED_STATUS=409
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

## 7. Rollback

M80 rollback must be narrow:

```text
revert modules/aiImageAdapterDiagnosticRuntimeMount.js
revert routes/adminPanelRoutes.js M80 lines
revert tests/ai-image-adapter-diagnostic-runtime-mount.test.js
revert scripts/run-ai-image-diagnostic-production-router-integration-scoped-env-harness.js
revert M80 receipt
revert tracker M80/S101/Q62 updates
```

Rollback proof must show the production-router URL returns `404` with route env unset.

## 8. Stop Conditions

Stop and mark M80 BLOCK if implementation requires:

- editing `server.js`;
- writing real `config.env` or `.env`;
- setting `ENABLE_AI_IMAGE_REAL_EXECUTION=true` outside scoped in-process tests;
- starting production server, dev server, preview server, or browser smoke;
- modifying AI Image execution routes;
- calling providers, bridges, plugins, or live external services;
- generating images or writing `image/**`;
- reading provider secrets, tokens, credentials, auth material, cookies, endpoints, raw binding files, LocalState/private/operator content, or `.agent_board/**`;
- returning absolute paths or secret-like fields in route responses;
- treating diagnostic route success as executable adapter registration.

## 9. Safety Confirmations

```text
M79_TASKBOOK_ONLY=yes
M79_RUNTIME_CODE_MODIFIED=no
M79_PRODUCTION_ROUTER_MOUNTED=no
M79_REAL_CONFIG_ENV_MODIFIED=no
M79_PROVIDER_TOKEN_READ=no
M79_PROVIDER_CALL_EXECUTED=no
M79_REAL_IMAGE_GENERATED=no
M79_IMAGE_OUTPUT_WRITTEN=no
M79_BRIDGE_WRITE_EXECUTED=no
M79_LOCALSTATE_PRIVATE_READ=no
M79_AGENT_BOARD_READ=no
M79_PRODUCTION_SERVER_STARTED=no
M79_UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_GATE
```
