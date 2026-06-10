# P3 Jenn External Ecosystem Directory Contract

Date: 2026-06-10
Branch: codex/p3-jenn-external-ecosystem-directory-contract
Mode: docs-only design spec

## 1. Purpose

This document defines the long-term Jenn external ecosystem directory contract
for VCPToolBox.

The contract has three goals:

- Keep the upstream-compatible VCPToolBox core thin, stable, and reviewable.
- Move Jenn-specific extensions toward allowlisted external packages over later
  phases.
- Preserve the P0/P1/P2 safety model: explicit allowlists, secret-safe
  discovery, sanitized display labels, and reviewable migration gates.

P3-B does not move files, enable loaders, change runtime behavior, install
plugins, uninstall plugins, or migrate private/operator state.

## 2. Current Adapter Baseline

P0, P1, P2-B, and P2-C-B establish the current adapter layer baseline.

### P0 Plugin Root Adapter

- External legacy plugin roots are discovered only through
  `VCP_PLUGIN_DIRS`.
- `VCP_PLUGIN_DIRS` is active only when the candidate root is explicitly
  allowlisted by `VCP_PLUGIN_ALLOWED_ROOTS`.
- External root identifiers are non-path labels such as `external:1`.
- External plugin-specific `config.env` loading is suppressed by default.
- Admin and diagnostic surfaces must not expose raw absolute paths.

### P1 Admin External Plugin Management

- Admin backend can list core plugins, allowlisted external legacy plugins,
  and disabled `plugin-manifest.json.block` records.
- Loaded external plugin records must pass current allowlisted realpath
  containment.
- Core plugin names keep priority over external duplicates.
- External `config.env` editing remains deferred and returns 403.
- Admin responses remove `pluginSpecificEnvConfig` and raw `configEnvContent`.

### P2-B Plugin Store External Install Dir

- `VCP_PLUGIN_INSTALL_DIR` uses a hybrid install root policy.
- When `VCP_PLUGIN_INSTALL_DIR` is unset, Plugin Store keeps legacy `Plugin/`
  behavior.
- When `VCP_PLUGIN_INSTALL_DIR` is set, it must exactly match a current
  allowlisted external legacy root.
- External install mode fails closed and never falls back to core `Plugin/`.
- External installs must not overwrite a core same-name plugin, even with
  `force=true`.
- Plugin Store logs, status, and SSE output are scrubbed before display.

### P2-C-B Plugin Store UI/API Polish

- Plugin Store UI/API accepts additive fields for `installedSource`,
  `installedRootId`, `installedDisplayPath`, and `conflictReason`.
- UI displays Core, External, and Conflict state from backend fields.
- UI only displays backend-provided sanitized labels and defensively hides
  absolute-looking paths.

## 3. Directory Contract

The proposed external ecosystem root is:

```text
AGENTS_OS_External/
  vcptoolbox/
```

This umbrella root is a convention, not permission. It must not cause any
loader, installer, or Admin surface to trust or scan content unless a narrower
allowlist/env contract explicitly enables that lane.

### Directory Matrix

| Directory | Purpose | Current status | Allowed contents | Forbidden contents | Safety notes | Future phase dependency |
| --- | --- | --- | --- | --- | --- | --- |
| `plugins-legacy/` | External legacy VCP plugins with `plugin-manifest.json`. | active through P0/P1/P2 only when allowlisted | Legacy plugin folders, manifests, placeholder docs, non-secret examples. | Real `config.env`, unreviewed secrets, core-shadow stubs, symlink escape tricks. | Must be listed in `VCP_PLUGIN_DIRS` and contained by `VCP_PLUGIN_ALLOWED_ROOTS`. | P7 for selected copy-first migration. |
| `plugins-modern/` | Future modern plugin registry/package lane. | deferred | Future `plugins/registry.json` compatible packages after design. | Runtime registry activation before design, secret files, automatic trust metadata. | No P0/P1/P2 support yet; do not infer behavior from legacy plugin support. | Separate modern plugin registry design. |
| `agents/` | Additive Jenn Agent packs. | docs-only | Prompt files, additive `agent_map.json` style maps, pack docs. | Built-in alias overrides, prompt bodies in audit evidence, secrets. | Future loading must not override core aliases by default. | P5 after audit-only classifier. |
| `agent-overrides/` | Explicit Agent override lane. | deferred | Intentional override maps with target alias evidence. | Silent overrides, broad wildcard overrides, private prompt leakage. | Override must require explicit evidence and review. | Later P5 subphase, not first Agent loader. |
| `local-state/` | Future private/operator runtime state root. | deferred | Inventory reports and migration manifests after approval. | Real state moves before P6, secrets, caches, logs, SQLite/vector stores without backup. | Data-governance lane; no loader may scan it by default. | P6 LocalState inventory and migration plan. |
| `memory/` | Memory and ledger-like external packages. | deferred | Sanitized receipts, non-secret memory schema docs, migration manifests. | Raw private memory, dailynote content copies, vector stores, SQLite files before approval. | Treat as private/operator-adjacent. | P6 or later memory-specific package. |
| `adapters/codex/` | Codex bridge/router/capability adapters. | docs-only | Adapter packages, non-secret capability maps, docs. | OAuth tokens, account secrets, raw traces, live credentials. | Keep core provider contracts in repo until a shim exists. | P3-C inventory, later adapter package split. |
| `adapters/vcpchat/` | VCPChat integration adapters. | docs-only | VCPChat bridge packages, compatibility docs, capability maps. | UI runtime assets loaded without AdminPanel extension design, chat logs, tokens. | Do not couple to AdminPanel extension loading. | P4/P7 depending on surface. |
| `adapters/photography/` | PhotoStudio and photography workflow adapters. | docs-only | Selected PhotoStudio plugin packs, workflow docs, non-secret templates. | Live customer/operator data, delivery secrets, external service tokens. | PhotoStudio code is mixed between plugin family, modules, and shared data. | Adapter shim and P6 state split first. |
| `adapters/channelhub/` | Concrete ChannelHub adapter packs. | docs-only | Channel-specific adapters and capability maps. | Core contracts, broad runtime registry changes, credentials. | Keep `modules/channelHub` contracts core until split is designed. | P3-C inventory and later split package. |
| `adapters/dingtalk/` | DingTalk integration packages. | docs-only | DingTalk adapter code, mocked tests, placeholder examples. | Real app keys, tokens, live write probes. | External writes require separate approval. | Adapter package design. |
| `adapters/feishu/` | Feishu integration packages. | docs-only | Feishu adapter code, mocked tests, placeholder examples. | Real credentials and live probes. | Same safety model as other channel adapters. | Adapter package design. |
| `adapters/wecom/` | WeCom integration packages. | docs-only | WeCom adapter code, mocked tests, placeholder examples. | Real credentials and live probes. | Same safety model as other channel adapters. | Adapter package design. |
| `adapters/onebot/` | OneBot integration packages. | docs-only | OneBot adapter code, mocked tests, placeholder examples. | Live bot credentials, chat logs, operator data. | Separate transport behavior from state/log content. | Adapter package design. |
| `governance/` | External governance design docs. | docs-only | Specs, decision records, migration plans. | Secrets, raw private state, unreviewed runtime dumps. | Docs do not grant runtime permission. | Can be used by future docs packages. |
| `receipts/` | Migration and install receipts. | docs-only | Review receipts, path-only migration evidence, hashes if safe. | Secret values, raw env, private content dumps. | Receipts must use sanitized display labels. | Required by migration phases. |
| `capability-maps/` | Non-secret capability descriptions. | docs-only | JSON/YAML capability maps and class labels. | Tokens, private endpoints, credential URLs. | Capability maps describe permissions; they do not grant them. | Needed by adapter/package phases. |
| `env-examples/` | Placeholder-only environment examples. | docs-only | `.example` files with empty placeholders and docs. | Real `.env`, real `config.env`, token-like sample values. | Examples need secret-pattern review before intake. | Per-package review. |
| `shared/photo-studio-data/` | Shared PhotoStudio package candidate. | deferred | Schema docs, empty fixtures, non-secret templates. | Live customer/project/operator data, delivery logs, credentials. | Current repo has shared data/code under `plugins/custom/shared/photo_studio_data`; split needs state policy. | P6 inventory plus PhotoStudio adapter shim. |

## 4. Environment Contract

### Current Active Environment Variables

| Variable | Current role | Rules |
| --- | --- | --- |
| `VCP_PLUGIN_ALLOWED_ROOTS` | Explicit external plugin root allowlist. | Grants visibility/management eligibility only. It does not install, load, or trust arbitrary content by itself. |
| `VCP_PLUGIN_DIRS` | External legacy plugin discovery roots. | Active only when each root is contained by `VCP_PLUGIN_ALLOWED_ROOTS`. |
| `VCP_PLUGIN_INSTALL_DIR` | Plugin Store external install root. | Must exactly match a current allowlisted external legacy root. It must never be guessed from the allowlist or umbrella root. |

### Future Docs-Only Environment Variables

| Variable | Proposed role | Status |
| --- | --- | --- |
| `VCP_EXTERNAL_ECOSYSTEM_ROOT` | Optional umbrella locator for external ecosystem layout. | docs-only; must not grant permission by itself. |
| `VCP_AGENT_DIRS` | Additive external Agent pack roots. | docs-only; no loader behavior in P3-B. |
| `VCP_AGENT_OVERRIDE_DIRS` | Explicit Agent override roots. | docs-only; override behavior requires separate review. |
| `VCP_LOCAL_STATE_DIR` | Future LocalState/runtime data root. | deferred; blocked until P6 inventory and migration plan. |

Rules:

- An umbrella root must not grant permission by itself.
- Allowlists grant visibility and eligibility, not automatic trust.
- Install directories must not be guessed.
- External roots must not leak absolute paths through logs, API, or UI.
- Discovery must not read real `.env`, `config.env`, or
  `Plugin/**/config.env` contents.
- Any future write path must perform fresh realpath containment checks at the
  time of the write.

## 5. Source And Evidence Labels

Stable labels:

- `core:legacy`
- `core:modern`
- `external:N`
- `docs-only`
- `deferred`
- `blocked`

Managed external evidence should expose only safe labels and metadata:

```ts
{
  source: "core" | "external" | "docs-only" | "deferred" | "blocked",
  rootId: "core:legacy" | "core:modern" | "external:N" | null,
  displayPath: "[core]/..." | "[external]/..." | null,
  manifestPathLabel: "[external]/plugin-name/plugin-manifest.json" | null,
  capabilityClass: "plugin" | "agent" | "adapter" | "state" | "governance",
  migrationReceiptRef: "receipts/..." | null
}
```

Evidence must not include:

- raw absolute local paths;
- raw `.env` or `config.env` values;
- tokens, passwords, cookies, API keys, auth codes, or credential URLs;
- raw Agent prompt bodies unless a package explicitly opens prompt-content
  review;
- private/operator state content;
- runtime request bodies or tool arguments.

## 6. Core Vs External Boundary

### Keep Core

The following surfaces remain core until a separate reviewed phase says
otherwise:

- `Plugin.js`
- `modules/pluginRootResolver.js`
- `routes/admin/plugins.js`
- `routes/admin/pluginStore.js`
- `AdminPanel-Vue/` for now
- `modules/agentManager.js`
- `agent_map.json`
- safety, redaction, display label, and containment contracts
- compatibility behavior when external env vars are unset

### Externalizable Later

The following surfaces can move toward external packages in later phases:

- selected legacy plugins;
- Jenn Agent packs;
- PhotoStudio plugin family;
- channel adapter packs;
- Codex and VCPChat bridge adapters;
- capability maps;
- governance receipts;
- non-secret env examples.

### Must Not Move Automatically

The following must never be moved automatically:

- real `.env` and `config.env` files;
- plugin `config.env` files;
- runtime/cache/state/log/image/operator data;
- stashes;
- protected `A:/VCP/apps/VCPToolBox-r10d` worktree;
- SQLite, vector, and private memory stores;
- live credentials, tokens, cookies, or auth material.

## 7. Migration Gates

Each future gate starts with readonly audit, then design, then review. Commit
and push remain separate approvals.

| Gate | Name | Purpose | Minimum requirements |
| --- | --- | --- | --- |
| P3-C | External ecosystem inventory helper | Optional path-only classifier for the proposed ecosystem root. | No secret reads, no loader changes, path-only evidence, tests with fixtures. |
| P4 | AdminPanel extension loader design | Define if and how external UI/admin extensions could exist. | Auth/routing/CSP/build trust review, no runtime loading in design phase. |
| P5 | Agent external directory loader | Add external Agent pack support after audit classifier. | Built-in alias precedence, explicit override lane, no prompt-body evidence by default. |
| P6 | LocalState/runtime data inventory | Inventory private/operator data before any migration. | Backup plan, dry-run, rollback, sensitive-data rules, human approval. |
| P7 | Selected plugin migration dry-run | Copy-first migration of selected plugin packages. | Explicit allowlist, fresh realpath containment, rollback, review before commit. |

Common gate requirements:

- readonly audit first;
- explicit allowlist;
- no secret reads;
- fresh realpath containment checks for writes;
- rollback plan;
- review before commit;
- separate push authorization;
- no release, deploy, or publish side effects.

## 8. Non-Goals

P3-B does not:

- move files;
- copy files;
- delete files;
- stub or replace repo content;
- enable new loaders;
- change runtime behavior;
- implement modern external plugin registry support;
- implement Agent external loading;
- implement AdminPanel extension loading;
- migrate LocalState, memory, or operator data;
- run real Plugin Store install, upload, or uninstall probes;
- modify runtime code;
- commit or push.

## 9. Risk Register

| Risk | Status | Notes |
| --- | --- | --- |
| External plugin allowlist remains a runtime trust boundary. | non-blocking | P0/P1/P2 make roots explicit and fail-closed, but allowed plugin code is still trusted runtime code. |
| Agent loader remains single-directory. | non-blocking | Agent externalization needs P5 and must preserve built-in alias precedence. |
| PhotoStudio and ChannelHub mix core primitives and Jenn business logic. | non-blocking | Split requires adapter shims and state/data separation. |
| `dailynote/` and memory-like content are private/operator-adjacent. | non-blocking | Treat as LocalState/memory lane, not plugin loader work. |
| Modern external plugin registry is deferred. | non-blocking | `plugins-modern/` is a contract placeholder only. |
| AdminPanel extension loading affects authenticated operator surfaces. | non-blocking | P4 must design auth, routing, CSP, asset trust, and build boundaries first. |

## 10. Closeout Checklist

- [x] Docs-only design spec.
- [x] No runtime code changes intended.
- [x] No `Plugin.js` changes intended.
- [x] No Plugin Store backend changes intended.
- [x] No AdminPanel changes intended.
- [x] No files moved, copied, deleted, stubbed, or replaced.
- [x] No new loader enabled.
- [x] No LocalState/runtime/operator data migration.
- [x] No real `.env`, `config.env`, or `Plugin/**/config.env` contents read.
- [x] No real install/upload/uninstall probe.
- [x] No commit before review.
- [x] No push, release, deploy, or npm publish.
