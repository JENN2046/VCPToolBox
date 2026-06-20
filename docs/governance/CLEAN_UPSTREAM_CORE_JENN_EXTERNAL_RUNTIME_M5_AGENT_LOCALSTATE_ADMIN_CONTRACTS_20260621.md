# M5 Agent LocalState AdminPanel Contracts

Date: 2026-06-21

Status: CONTRACTS_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

## 1. Purpose

M5 defines contracts for future Agent, LocalState, and AdminPanel externalization.

It does not implement loaders, change runtime code, create new routes, read LocalState, migrate `.agent_board/**`, build AdminPanel, or copy private data.

## 2. Agent Contract

Future Agent externalization may use:

```text
VCP_AGENT_DIRS
VCP_AGENT_OVERRIDE_DIRS
```

Rules:

- If unset, upstream/core Agent behavior remains unchanged.
- `VCP_AGENT_DIRS` may add reviewed external Agent packages.
- `VCP_AGENT_OVERRIDE_DIRS` may override exact Agent ids only after a reviewed receipt names the source id, target id, and rollback.
- External Agent directories must pass S7 denylist and paths-only secret-risk scan before checksum.
- Agent packages must not contain real `.env`, `config.env`, tokens, credentials, auth material, cache, logs, outputs, DB/vector sidecars, LocalState, or `.agent_board/**`.
- Duplicate Agent ids are blocked unless the override lane explicitly authorizes that exact id.
- External Agent package checksums are source/package evidence only, not runtime behavior proof.

Default decision:

```text
Agent externalization remains design-only in M5.
No Agent files are copied.
No Agent runtime loader is changed.
No Agent override is activated.
```

## 3. LocalState Contract

Future LocalState resolution may use:

```text
VCP_LOCAL_STATE_DIR
```

Rules:

- If unset, upstream/core behavior remains unchanged.
- LocalState is private/operator state, not plugin source.
- LocalState must not be configured in `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, `VCP_EXTERNAL_PLUGIN_ALLOWLIST`, `VCP_AGENT_DIRS`, or `VCP_ADMIN_EXTENSION_DIRS`.
- LocalState checks must be path-only unless a separate reviewed gate explicitly allows content reads.
- `.agent_board/**` remains separately blocked and must not be copied, checksummed, migrated, archived, deleted, untracked, or stubbed automatically.
- LocalState private lanes such as `cache/`, `logs/`, `outputs/`, `secrets/`, `state/`, `private-memory/`, and `project-data/` are excluded from source manifests.
- Tests must not read real secrets, private memory, provider config, auth material, or operator data.

Default decision:

```text
LocalState externalization remains contract-only in M5.
No LocalState content is read.
No LocalState content is copied.
No .agent_board gate is opened.
```

## 4. AdminPanel Contract

Future AdminPanel externalization may use:

```text
VCP_ADMIN_EXTENSION_DIRS
```

Expected extension package shape:

```text
AdminExtensions/
  <ExtensionName>/
    admin-extension-manifest.json
    routes/
    menu/
    ui/
    README.AGENTS_OS.md
```

Rules:

- If unset, upstream/core AdminPanel behavior remains unchanged.
- Admin extension manifests must declare route ids, menu ids, API ids, required permissions, and default disabled state.
- Extension route registration must not bypass existing auth or operator approval behavior.
- Admin extension packages must pass S7 denylist and paths-only secret-risk scan before checksum.
- `AdminPanel-Vue/dist/**` remains build output and is excluded unless an explicit frontend build/release task is opened.
- `Plugin/**/dist/**` rules do not apply to AdminPanel build output; do not use blanket `dist/` ignores.
- Admin extensions must not ship real secrets, runtime logs, LocalState, `.agent_board/**`, provider tokens, or generated image data.
- Build validation must be separate from runtime route activation.

Default decision:

```text
AdminPanel externalization remains design-only in M5.
No AdminPanel code is changed.
No AdminPanel build is run.
No Admin route is registered.
```

## 5. Validation

M5 validation is documentation-only:

```powershell
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "VCP_AGENT_DIRS|VCP_AGENT_OVERRIDE_DIRS|VCP_LOCAL_STATE_DIR|VCP_ADMIN_EXTENSION_DIRS|\\.agent_board|CONTRACTS_ONLY" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M5_AGENT_LOCALSTATE_ADMIN_CONTRACTS_20260621.md
git status --short
```

Do not run service startup, provider calls, bridge calls, AdminPanel build, LocalState reads, `.agent_board/**` reads, external writes, or runtime loader changes as part of M5.

## 6. Rollback

Rollback M5 by reverting this contract document and the tracker M5 update.

No runtime rollback is required because M5 does not change runtime code, env files, AdminPanel, Agent files, LocalState, or external packages.

## 7. Acceptance

M5 is PASS when:

- this contract document exists;
- `VCP_AGENT_DIRS` and `VCP_AGENT_OVERRIDE_DIRS` responsibilities are defined;
- `VCP_LOCAL_STATE_DIR` responsibilities are defined without making LocalState a plugin or Agent root;
- `VCP_ADMIN_EXTENSION_DIRS` responsibilities are defined;
- `.agent_board/**` remains blocked;
- no runtime code, AdminPanel build, Agent files, LocalState, env, secret, provider, bridge, or live external write changes occur.
