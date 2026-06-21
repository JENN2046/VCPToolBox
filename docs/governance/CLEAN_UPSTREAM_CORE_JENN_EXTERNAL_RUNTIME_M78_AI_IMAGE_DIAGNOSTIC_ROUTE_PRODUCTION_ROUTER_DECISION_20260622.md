# M78 AI Image Diagnostic Route Production-Router Decision

Date: 2026-06-22

Status: PASS_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_DECISION

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M77_AI_IMAGE_DEFAULT_OFF_DIAGNOSTIC_ROUTE_RECEIPT_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M78 is a decision gate only.

M78 does not:

- mount the M77 route factory in `server.js`, `routes/adminPanelRoutes.js`, or any production router;
- modify `routes/admin/aiImageAdapterDiagnostics.js`;
- modify `routes/admin/aiImageAgents.js`;
- modify `modules/aiImageAdapterRegistry.js`, `modules/aiImageExecutionAdapter.js`, `modules/nativeImageDelegateRegistry.js`, or provider execution modules;
- write `config.env`, `.env`, provider config, secrets, tokens, credentials, auth material, or endpoints;
- set `ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE`, `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS`, `VCP_AI_IMAGE_ADAPTER_DIRS`, `ENABLE_AI_IMAGE_AGENTS_ROUTE`, or `ENABLE_AI_IMAGE_REAL_EXECUTION` in real env;
- start production server, dev server, preview server, browser smoke, or provider runtime;
- call a provider, generate a real image, write `image/**`, write output data, call a bridge, or perform live external writes;
- read LocalState/private/operator content or `.agent_board/**`;
- open upstream PR.

## 2. Inputs Reviewed

| Input | Result |
| --- | --- |
| M76 diagnostic route taskbook | M77 was limited to test-only route factory, focused tests, and local harness; production-router integration was explicitly deferred. |
| M77 route factory receipt | Default-off `404`, scoped auth `200`, unauthorized `403`, POST `404`, real execution env `409`; response absolute path and secret field counts both `0`. |
| M74 metadata registry receipt | Scoped env can discover one reviewed adapter metadata record; executable adapter count remains `0`; provider/image/output/bridge/LocalState counters stay `0`. |
| M32 persistent provider-adapter package gate | External package validates no-provider behavior; provider runtime and image generation remain off. |
| Current tracker | AI Image provider runtime, real image generation, executable adapter registration, real env, LocalState/private, and upstream PR remain deferred/blocked. |

## 3. Decision Options

| Option | Meaning | Benefit | Risk |
| --- | --- | --- | --- |
| Keep route factory unmounted and stop | Treat M77 as local factory proof only and pause AI Image route work. | Lowest immediate change surface. | Future production-router integration would still lack a formal taskbook for mount point, auth, default-off env, rollback, and validation. |
| Keep route factory unmounted now, then write a production-router integration taskbook | Do not mount anything in M78; define M79 as docs-only integration planning before code. | Preserves default-off safety while keeping the route lane moving with an auditable gate. | Adds one more docs-only milestone before any production-router implementation. |
| Mount production router now | Directly connect the route factory to production router in this gate. | Fastest visible route integration. | Crosses a runtime surface without a fresh production-router taskbook; would expand M78 beyond decision-only scope. |

## 4. Decision

M78 decision:

```text
M78_DECISION=WRITE_M79_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK
AI_IMAGE_DIAGNOSTIC_ROUTE_FACTORY_UNMOUNTED_NOW=yes
AI_IMAGE_PRODUCTION_ROUTER_IMPLEMENTATION_NOW=no
AI_IMAGE_REAL_ENV_UNLOCK=no
AI_IMAGE_PROVIDER_RUNTIME_UNLOCK=no
AI_IMAGE_REAL_IMAGE_GENERATION_UNLOCK=no
```

Reason:

M77 proved the route factory is locally safe under a test-only mount, but it did not prove production-router integration. The next safe step is to keep the factory unmounted and write a narrow M79 taskbook that defines the exact production-router mount strategy, admin-auth boundary, default-off env behavior, validation, rollback, and stop conditions.

## 5. Future M79 Boundary

Recommended next gate:

```text
M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK
```

M79 should be taskbook-only.

Allowed M79 content:

- exact candidate production-router file and mount point;
- exact route URL and method list, preserving `GET /admin_api/ai-image-adapter-registry/diagnostics`;
- admin-auth expectations and rejected access behavior;
- default-off env contract for `ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE`;
- scoped test env contract for `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS` and `VCP_AI_IMAGE_ADAPTER_DIRS`;
- explicit response redaction and forbidden-field rules inherited from M76/M77;
- required validation commands for a later implementation gate;
- rollback plan proving route returns to `404` when disabled or integration is reverted;
- stop line for any future implementation gate.

Forbidden M79 content:

- no production-router code change;
- no `server.js` change;
- no real `config.env` or `.env` write;
- no production server start;
- no provider call;
- no image generation or `image/**` output write;
- no bridge call or live external write;
- no LocalState/private/`.agent_board/**` read;
- no upstream PR.

## 6. Future Implementation Stop Line

If a future implementation gate follows M79, it must remain narrower than provider runtime enablement.

It may only consider:

```text
production-router default-off mount for GET diagnostics
focused route integration tests
scoped local harness with env set in-process only
rollback proof to default-off 404
```

It must not include:

```text
real config env write
ENABLE_AI_IMAGE_REAL_EXECUTION=true
provider token read
provider call
real image generation
output write
bridge call
LocalState/private read
frontend build or route/nav
production deploy
upstream PR
```

## 7. Safety Confirmations

```text
M78_DECISION_ONLY=yes
M78_ROUTE_FACTORY_LEFT_UNMOUNTED=yes
M78_PRODUCTION_ROUTER_MOUNTED=no
M78_RUNTIME_CODE_MODIFIED=no
M78_REAL_CONFIG_ENV_MODIFIED=no
M78_PROVIDER_TOKEN_READ=no
M78_PROVIDER_CALL_EXECUTED=no
M78_REAL_IMAGE_GENERATED=no
M78_IMAGE_OUTPUT_WRITTEN=no
M78_BRIDGE_WRITE_EXECUTED=no
M78_LOCALSTATE_PRIVATE_READ=no
M78_AGENT_BOARD_READ=no
M78_PRODUCTION_SERVER_STARTED=no
M78_UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M79_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_TASKBOOK
```

## 8. Rollback

Rollback is docs-only:

```text
revert this M78 decision document
revert tracker M78/S99/Q60 updates
```

No production route mount, provider state, image output, LocalState/private data, `.agent_board/**`, or real env cleanup is required because M78 did not create or modify them.
