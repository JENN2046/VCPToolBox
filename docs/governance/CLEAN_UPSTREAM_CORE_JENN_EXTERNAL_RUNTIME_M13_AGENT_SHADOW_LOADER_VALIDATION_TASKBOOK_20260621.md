# M13 Agent Shadow / Loader Contract Validation Taskbook

Date: 2026-06-21

Status: TASKBOOK_READY_NO_RUNTIME

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Predecessor receipt: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_M12_AGENT_CONTENT_COPY_FIRST_RECEIPT_20260621.md`

## 1. Purpose

M13 validates the Agent external package after content copy-first, before any Agent runtime loader activation.

This taskbook defines a no-runtime shadow validation gate. It proves package integrity, target path safety, fallback preservation, and activation absence. It does not prove runtime registration or prompt behavior.

## 2. Scope

Validated source:

```text
core repo: A:/AGENTS_OS_Workspace/runtime/VCPToolBox
external package: A:/AGENTS_OS_Workspace/runtime/VCPToolBox-JENN-Extensions
external content commit: bc287826d47e89204cba536c75e9374fd6db87ab
```

Expected copied Agent targets:

```text
Agent/AIImageGenExpert.txt
Agent/AuditMaster.txt
Agent/MemoriaSorter.txt
Agent/Muse.txt
Agent/动力猛兽.txt
Agent/小秋.txt
Agent/诺宝.txt
AgentOverrides/Metis.txt
AgentOverrides/Nova.txt
```

Expected skeleton targets:

```text
Agent/README.AGENTS_OS.md
AgentOverrides/README.AGENTS_OS.md
```

## 3. Allowed Validation

Allowed in M13:

- verify the external package HEAD matches the M12 content copy commit;
- verify `manifests/MANIFEST.sha256`;
- run paths-only risk scan over reviewed external package paths;
- confirm expected external Agent targets exist;
- confirm core source Agent files still exist and were not deleted, untracked, or stubbed;
- confirm `VCP_AGENT_DIRS` and `VCP_AGENT_OVERRIDE_DIRS` are unset in the validation process;
- inspect current Agent runtime files for direct `VCP_AGENT_DIRS` / `VCP_AGENT_OVERRIDE_DIRS` references;
- record that current validation does not start services, call providers, call bridges, or read LocalState / `.agent_board/**`.

## 4. Explicit Non-Scope

M13 must not:

- activate `VCP_AGENT_DIRS` or `VCP_AGENT_OVERRIDE_DIRS`;
- change `modules/agentManager.js`, `adminServer.js`, or `routes/admin/agents.js` runtime behavior;
- start `server.js`, `adminServer.js`, PM2, bridge processes, or provider calls;
- read, copy, checksum, migrate, archive, delete, untrack, or stub LocalState or `.agent_board/**`;
- delete, untrack, or stub source core `Agent/` files;
- open an upstream PR.

## 5. Harness

M13 uses a read-only harness:

```text
scripts/run-agent-content-copy-first-shadow-validation-harness.js
```

The harness checks:

```text
external package commit pin
Agent content target path count
Agent target path risk count
package path risk count
manifest checksum verification
expected Agent manifest entries
core source Agent fallback presence
Agent runtime env unset status
current runtime env reference count
no provider / bridge / service startup
no LocalState / .agent_board reads
```

## 6. PASS Criteria

M13 may be marked PASS only if all are true:

```text
AGENT_COPY_FIRST_SHADOW_VALIDATION_PASS
EXTERNAL_HEAD=bc287826d47e89204cba536c75e9374fd6db87ab
AGENT_CONTENT_TARGET_RISK_PATH_COUNT=0
PACKAGE_RISK_PATH_COUNT=0
MANIFEST_VERIFY_PASS count=15
CORE_AGENT_SOURCE_FILES_STILL_PRESENT=9
ENV_VCP_AGENT_DIRS_SET=no
ENV_VCP_AGENT_OVERRIDE_DIRS_SET=no
NO_PROVIDER_OR_BRIDGE_CALLS_EXECUTED=yes
NO_SERVICE_STARTUP_EXECUTED=yes
NO_LOCALSTATE_OR_AGENT_BOARD_READS_EXECUTED=yes
```

## 7. Stop Conditions

Stop and do not proceed to loader implementation if:

- the external package HEAD no longer matches the recorded M12 content copy commit;
- manifest verification fails;
- target/package path risk count is non-zero;
- `VCP_AGENT_DIRS` or `VCP_AGENT_OVERRIDE_DIRS` is set during validation;
- LocalState or `.agent_board/**` is needed to validate the package;
- provider, bridge, service startup, or live external writes are required;
- core source Agent files are missing before an approved delete/untrack/stub decision.

## 8. Next Gate

After M13, the next safe gate is test-first Agent loader contract design / implementation, still default-off.

That future gate must treat discovery, checksum, and shadow validation as prerequisites, not as runtime registration proof.

## 9. Rollback

M13 code rollback:

```text
revert this taskbook, receipt, tracker row, and validation harness
```

External package rollback remains:

```text
revert external package commit bc287826d47e89204cba536c75e9374fd6db87ab
keep core Agent files unchanged
leave VCP_AGENT_DIRS and VCP_AGENT_OVERRIDE_DIRS unset
```
