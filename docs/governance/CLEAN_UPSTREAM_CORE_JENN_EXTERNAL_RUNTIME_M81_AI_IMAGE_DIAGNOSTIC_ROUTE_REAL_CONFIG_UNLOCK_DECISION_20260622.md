# M81 AI Image Diagnostic Route Real-Config Unlock Decision

Date: 2026-06-22

Status: PASS_AI_IMAGE_DIAGNOSTIC_ROUTE_REAL_CONFIG_UNLOCK_DECISION

Parent receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M80_AI_IMAGE_DIAGNOSTIC_ROUTE_PRODUCTION_ROUTER_INTEGRATION_RECEIPT_20260622.md`

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Scope

M81 is a decision gate only.

M81 does not:

- write `config.env`, `.env`, provider config, secrets, tokens, credentials, auth material, or endpoints;
- set `ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE`, `VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS`, `VCP_AI_IMAGE_ADAPTER_DIRS`, `ENABLE_AI_IMAGE_AGENTS_ROUTE`, or `ENABLE_AI_IMAGE_REAL_EXECUTION` in real env;
- start production server, dev server, preview server, browser smoke, or provider runtime;
- call a provider, generate a real image, write `image/**`, write output data, call a bridge, or perform live external writes;
- modify `server.js`, `routes/adminPanelRoutes.js`, `routes/admin/aiImageAdapterDiagnostics.js`, or AI Image execution modules;
- read LocalState/private/operator content or `.agent_board/**`;
- open upstream PR.

## 2. Inputs Reviewed

| Input | Result |
| --- | --- |
| M80 production-router integration receipt | Default-off production-router integration is implemented; route env unset returns `404`; scoped env returns `200`; unauthorized returns `403`; real execution env returns `409`; provider/image/output/bridge/LocalState counters remain `0`. |
| M79 taskbook | Future real-config work must stay narrower than provider runtime and must retain default-off rollback proof. |
| M74 metadata registry receipt | Scoped metadata registry can discover one reviewed adapter metadata record; executable adapter count remains `0`. |
| M32 persistent provider-adapter package gate | External AI Image package validates no-provider behavior; provider runtime and image generation remain off. |
| Current tracker | AI Image provider runtime, real image generation, executable adapter registration, LocalState/private, and upstream PR remain deferred/blocked. |

## 3. Decision Options

| Option | Meaning | Benefit | Risk |
| --- | --- | --- | --- |
| Stop at M80 default-off integration | Leave diagnostic route integrated but off in real config. | Lowest operational change. | No real-config local proof that the reviewed diagnostic metadata route can be enabled and rolled back. |
| Select metadata-only real-config candidate for a future apply/rollback gate | Do not write config now; define exact future candidate and M82 evidence requirements. | Keeps momentum while preserving an auditable stop before touching real config. | Requires a later explicit authorization before any real `config.env` edit. |
| Write real config now | Add diagnostic route env keys immediately. | Fastest route to runtime-on metadata diagnostics. | Violates the current M81 scope and user instruction to decide first without writing `config.env`. |

## 4. Decision

M81 decision:

```text
M81_DECISION=SELECT_M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL
M81_REAL_CONFIG_WRITE_NOW=no
M81_PROVIDER_RUNTIME_UNLOCK=no
M81_REAL_IMAGE_GENERATION_UNLOCK=no
M81_BRIDGE_WRITE_UNLOCK=no
M81_LOCALSTATE_PRIVATE_UNLOCK=no
M81_UPSTREAM_PR_UNLOCK=no
```

Reason:

M80 proves the production-router integration is default-off and metadata-only. The next useful step is a future real-config apply/rollback drill for the diagnostic metadata route only. M81 must not perform that write. It only records the candidate and the exact stop line for a future M82 gate.

## 5. Future M82 Candidate

Recommended next gate:

```text
M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL
```

M82 requires future explicit current-turn authorization before writing real `config.env`.

Candidate keys:

```text
ENABLE_AI_IMAGE_ADAPTER_DIAGNOSTIC_ROUTE=true
VCP_AI_IMAGE_ADAPTER_ALLOWED_ROOTS=<reviewed external root>
VCP_AI_IMAGE_ADAPTER_DIRS=<reviewed external AIImageAdapters root>
```

Keys that must remain unset, false, or unchanged in M82:

```text
ENABLE_AI_IMAGE_REAL_EXECUTION != true
ENABLE_AI_IMAGE_AGENTS_ROUTE unchanged
ENABLE_NATIVE_DOUBAO_SECRETLESS_RUNTIME_DELEGATE != true
VCP_AGENT_DIRS unchanged
provider token / credential keys unchanged
bridge / LocalState / private keys unchanged
```

M82 must not print config values. It may report only redacted presence, counts, route status, hashes, and diagnostic codes.

## 6. Future M82 Required Proof

If authorized later, M82 must prove:

```text
pre-apply default-off route status=404
after applying exactly the three candidate keys, diagnostic route status=200
unauthorized status=403
POST/write methods status=404
ENABLE_AI_IMAGE_REAL_EXECUTION=true remains blocked with 409 in scoped test only
adapter metadata count=1
executable adapter count=0
provider/image/output/bridge/LocalState counters=0
response absolute path count=0
response secret field count=0
rollback remove exact three keys returns route status=404
restore exact three keys returns route status=200 if M82 final state chooses enabled
config.env values printed=no
config.env remains ignored/not committed
```

M82 final state must be declared before the write:

```text
M82_FINAL_STATE_OPTION_A=restore three diagnostic metadata keys after rollback proof
M82_FINAL_STATE_OPTION_B=leave diagnostic metadata keys removed after rollback proof
```

M81 does not choose final state. A future M82 authorization must choose it.

## 7. Stop Conditions

Stop before or during M82 if it would require:

- writing any key beyond the three candidate diagnostic metadata keys;
- setting `ENABLE_AI_IMAGE_REAL_EXECUTION=true` in real config;
- enabling provider runtime, image generation, bridge writes, LocalState/private reads, or external live writes;
- modifying `server.js`, AI Image execution route, frontend files, `AdminPanel-Vue/dist/**`, provider modules, or external package content;
- starting production server without a separate smoke taskbook and explicit authorization;
- printing raw `config.env` values, secrets, tokens, credentials, provider endpoints, cookies, or auth material;
- reading LocalState/private/operator content or `.agent_board/**`;
- treating diagnostic route success as executable adapter registration;
- opening upstream PR.

## 8. Safety Confirmations

```text
M81_DECISION_ONLY=yes
M81_REAL_CONFIG_ENV_MODIFIED=no
M81_ROUTE_CODE_MODIFIED=no
M81_SERVER_JS_MODIFIED=no
M81_PROVIDER_TOKEN_READ=no
M81_PROVIDER_CALL_EXECUTED=no
M81_REAL_IMAGE_GENERATED=no
M81_IMAGE_OUTPUT_WRITTEN=no
M81_BRIDGE_WRITE_EXECUTED=no
M81_LOCALSTATE_PRIVATE_READ=no
M81_AGENT_BOARD_READ=no
M81_PRODUCTION_SERVER_STARTED=no
M81_UPSTREAM_PR_OPENED=no
NEXT_RECOMMENDED_GATE=M82_AI_IMAGE_DIAGNOSTIC_METADATA_REAL_CONFIG_APPLY_ROLLBACK_DRILL
```

## 9. Rollback

Rollback is docs-only:

```text
revert this M81 decision document
revert tracker M81/S102/Q63 updates
```

No real env cleanup is required because M81 did not write `config.env` or `.env`.
