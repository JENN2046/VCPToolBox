# M25 Codex/Memory External Bridge Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_PRIVATE_MEMORY_READ_NO_BRIDGE_WRITE

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Source contract:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M6_AI_IMAGE_MEMORY_PHOTOSTUDIO_CONTRACTS_20260621.md`

## 1. Purpose

M25 defines the taskbook for future Codex/Memory bridge externalization.

This taskbook does not move memory code, activate a bridge, write memory records, read private memory, read LocalState, read `.agent_board/**`, modify `rag_params.json`, sync external systems, or register a new runtime bridge.

## 2. Current Codex/Memory Observations

Read-only source and path inspection:

```text
Plugin/CodexMemoryBridge/
routes/admin/codexMemory.js
routes/codexMemoryMcp.js
modules/codexMemoryConstants.js
modules/codexMemorySearch.js
modules/codexMemoryOverview.js
modules/codexMemoryAdaptive.js
docs/CODEX_MEMORY_BRIDGE.md
docs/MEMORY_SYSTEM.md
MEMORY.md
tests/codex-memory-bridge.test.js
tests/codex-memory-admin.test.js
tests/codex-memory-search.test.js
tests/codex-memory-recall.test.js
tests/codex-memory-mcp.test.js
```

Observed runtime pattern:

```text
Plugin/CodexMemoryBridge can write process / knowledge memory records when invoked with Codex execution context.
Codex memory tests use temporary project roots for write/read validation.
routes/admin/codexMemory.js reads audit / recall summaries from configured project paths.
modules/codexMemoryAdaptive.js reads codex-memory JSONL logs and rag_params.json from the configured project base.
```

Observed private lanes:

```text
dailynote/Codex/**
dailynote/Codex的知识/**
logs/codex-memory-bridge.jsonl
logs/codex-memory-recall.jsonl
memory vector stores / DB sidecars / cache
rag_params.json dynamic tuning config
```

Only path names and source/test files were inspected for M25. No private memory content was read.

## 3. Future Env Contract

Future Codex/Memory external bridge discovery may use:

```text
VCP_CODEX_MEMORY_BRIDGE_ALLOWED_ROOTS
VCP_CODEX_MEMORY_BRIDGE_DIRS
```

Rules:

- If unset, current Codex/Memory behavior remains unchanged.
- Bridge discovery must be separate from bridge write activation.
- Bridge registration must be default-off until manifest validation and no-live-write validation pass.
- A bridge manifest may describe capabilities, schemas, and redacted fixtures, but must not contain raw memory records, secrets, tokens, or operator-private data.
- LocalState, `.agent_board/**`, dailynote private memory content, logs, vector stores, DB sidecars, cache, and output roots must not be bridge source roots.

## 4. Proposed External Package Shape

Future reviewed source package shape:

```text
MemoryBridges/
  <BridgeName>/
    memory-bridge-manifest.json
    README.AGENTS_OS.md
    schemas/
      write-request.schema.json
      recall-request.schema.json
    fixtures/
      no-live-write/
        write-request.redacted.json
        expected-decision.json
    src/
      index.js
    tests/
```

M25 does not create this shape. Future validation may create only a temporary fixture package for manifest/no-live-write checks.

## 5. Manifest Schema Draft

`memory-bridge-manifest.json` should be JSON and contain only metadata, relative paths, and redacted fixtures:

```json
{
  "schemaVersion": 1,
  "bridgeId": "jenn.example.codex-memory-bridge",
  "displayName": "Jenn Example Codex Memory Bridge",
  "description": "Reviewed no-live-write memory bridge fixture.",
  "defaultEnabled": false,
  "capabilities": [
    "memory.write.dryRun",
    "memory.recall.dryRun"
  ],
  "entry": "src/index.js",
  "schemas": {
    "writeRequest": "schemas/write-request.schema.json",
    "recallRequest": "schemas/recall-request.schema.json"
  },
  "fixtures": {
    "noLiveWriteRequest": "fixtures/no-live-write/write-request.redacted.json",
    "expectedDecision": "fixtures/no-live-write/expected-decision.json"
  },
  "permissions": {
    "bridgeWrites": false,
    "privateMemoryReads": false,
    "localStateReads": false,
    "externalWrites": false,
    "providerCalls": false
  }
}
```

## 6. Source / Private Lane Split

Reviewed external source may include:

- bridge adapter source code;
- schemas;
- redacted dry-run fixtures;
- manifest metadata;
- tests that use temporary project roots and do not read real private memory;
- documentation that does not embed raw memory content.

Private/default-excluded lanes must include:

- real dailynote Codex memory content;
- process / knowledge memory files;
- recall and write audit logs;
- vector stores, SQLite / DB sidecars, cache, output, and runtime logs;
- `rag_params.json` unless a later reviewed gate classifies a sanitized source-like template;
- `.agent_board/**`;
- tokens, credentials, auth material, OAuth data, cookies, and provider config.

## 7. Candidate Gate

Before any Codex/Memory content is copied to Jenn External Runtime, a separate reviewed candidate gate must classify source paths:

```text
possible external source candidates:
  Plugin/CodexMemoryBridge/
  docs/CODEX_MEMORY_BRIDGE.md
  docs/MEMORY_SYSTEM.md
  modules/codexMemoryConstants.js
  schemas / redacted fixtures, if created later

private / blocked by default:
  dailynote/Codex/**
  dailynote/Codex的知识/**
  logs/codex-memory-*.jsonl
  vector stores / DB sidecars / cache
  .agent_board/**
  real memory payloads and operator notes
```

This taskbook does not approve copying those files. It only defines the gate.

Candidate review must record:

- source path;
- source-like / private / blocked classification;
- paths-only secret-risk scan result;
- whether content review is allowed;
- additive / override / blocked decision;
- rollback path.

## 8. No-Live-Write Validation Plan

Future validation may be fixture-only:

- parse manifest JSON;
- validate schema-required fields;
- reject path escapes and blocked paths;
- run a temporary-project-root dry-run only if no real memory store is touched;
- assert bridge write count `0`;
- assert private memory read count `0`;
- assert LocalState read count `0`;
- assert external write count `0`;
- record checksum for reviewed fixture files only;
- rollback by deleting or ignoring only the temporary fixture package.

No live memory write, bridge external write, or real private memory read may be used as validation for this route.

## 9. Stop Conditions

Stop and mark BLOCK if future work requires:

- reading real dailynote Codex memory content;
- reading LocalState/private/operator memory stores;
- reading `.agent_board/**`;
- writing memory records outside a temporary test root;
- modifying `rag_params.json`;
- syncing or publishing to external systems;
- bridge writes, provider calls, live external writes, or production service startup;
- copying logs, vector stores, SQLite/DB sidecars, cache, outputs, or raw recall traces;
- recording raw memory content, secrets, tokens, OAuth material, cookies, or auth headers in receipts.

## 10. Rollback

M25 rollback:

```text
revert this taskbook and the tracker M25/S46 update
```

Future fixture rollback:

```text
remove only reviewed temporary fixture files after verifying the target path is inside the approved fixture root
do not delete dailynote memory, LocalState, logs, vector stores, DB sidecars, rag_params.json, or .agent_board/**
```

## 11. Safety Confirmations

```text
Codex/Memory runtime code modified: no
Memory bridge package created: no
Memory bridge activated: no
Real memory content read: no
Memory write executed: no
LocalState content read/copied: no
.agent_board content read/copied/checksummed/migrated: no
rag_params.json modified: no
Bridge external write executed: no
Provider call executed: no
Production deploy/service startup executed: no
Live external write executed: no
Upstream PR opened: no
```

## 12. Validation

M25 validation is documentation-only:

```powershell
git diff --check
rg -n "TASKBOOK_READY_NO_PRIVATE_MEMORY_READ_NO_BRIDGE_WRITE|VCP_CODEX_MEMORY_BRIDGE_DIRS|privateMemoryReads|bridgeWrites|No-Live-Write|Real memory content read: no|Memory write executed: no|Upstream PR opened: no" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M25_CODEX_MEMORY_EXTERNAL_BRIDGE_TASKBOOK_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
git status --short --branch
```
