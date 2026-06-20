# S7 Denylist And Gitignore Baseline

Date: 2026-06-21

Status: BASELINE_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Parent task book: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S6_EXTERNAL_RUNTIME_SKELETON_TASKBOOK_20260620.md`

Parent plan: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`

## 1. Purpose

This document lands the S7 reviewed denylist and `.gitignore` baseline for future Jenn External Runtime and Jenn LocalState skeleton work.

It does not create external directories, copy plugins, copy LocalState, generate checksums, enable runtime roots, change clean core code, or modify real secrets/runtime files.

The baseline below is the source to copy into a future `VCPToolBox-JENN-Extensions/.gitignore` only after the skeleton creation step is explicitly approved.

## 2. Source Of Truth

S7 must reuse the current complete governance denylist, not a narrow env/key/db subset.

Reviewed sources:

| Source | What S7 reuses |
| --- | --- |
| `AGENTS.override.md` / project `AGENTS.md` | Forbidden env, config, auth material, runtime state, `Plugin/UserAuth/code.bin`, plugin `*secret*` and `*token*` filename patterns. |
| `.gitignore` | Existing VCP runtime ignores, plugin cache/state/log/output paths, image outputs, dynamic tool runtime catalogs. |
| `scripts/aigentquality-server-smoke-s2-preplan.js` | S2 dry-run sensitive runtime pathspec baseline. |
| `scripts/aigentquality-server-smoke-s2-guarded-plan.js` | Guarded smoke sensitive runtime pathspec baseline and child-env secret protection model. |
| `scripts/p3-external-ecosystem-inventory.js` | Path-only blocked classifications for runtime roots, secret-like paths, private stores, and `.agent_board/**`. |
| `docs/governance/P3E_EXTERNAL_ECOSYSTEM_TAXONOMY_RULES_SPEC_20260610.md` | Taxonomy rule that blocked means never move automatically, plus protected agent board rule. |
| `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md` | A12 denylist reuse, A13 `.agent_board/**` default block, and no blanket `dist/` rule. |

Do not use the repository root `.gitignore` as a direct external-package template. It is a thick-fork working ignore file with legacy local exceptions. This S7 document is the reviewed external runtime baseline.

## 3. Denylist Priority

When rules overlap, the stricter rule wins:

1. Real secrets, credentials, auth codes, tokens, private keys, and env files are blocked.
2. Runtime state, cache, logs, generated outputs, image outputs, local stores, DB/vector sidecars, and operator data are blocked.
3. `.agent_board/**` is protected and must not move, copy, checksum, or migrate automatically.
4. Plugin-local `cache/`, `state/`, `logs/`, `secrets/`, `output/`, `outputs/`, `*secret*`, and `*token*` paths are blocked.
5. `Plugin/**/dist/**` is preserved by default because it may be runtime source.
6. Only explicitly reviewed frontend build output paths, such as `AdminPanel-Vue/dist/**`, may be ignored as build artifacts.

## 4. External Package Gitignore Baseline

Use this as the minimum `.gitignore` for a future `VCPToolBox-JENN-Extensions/` package.

```gitignore
# Jenn External Runtime S7 baseline
# Source: CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md

# Environment and local config files
.env
.env.*
**/.env
**/.env.*
config.env
config.env.local
**/config.env
**/config.env.local
!**/.env.example
!**/config.env.example

# Operator config/state files that must not enter external packages
ModelRedirect.json
agent_map.json
preprocessor_order.json
tag-processor-config.env
SemanticModelRouter.local.json
sarprompt.json
ip_blacklist.json
ToolConfigs/dynamic_tool_catalog.json
ToolConfigs/dynamic_tool_categories.json
ToolConfigs/dynamic_tool_*.json
ToolConfigs/dynamic_tool_catalog.json.*.tmp
pluginStoreSources.json
data/candidate-cache.json
data/chat-history-index.json
data/memory-vectors.json

# Secret material and credential-shaped files
*.key
*.pem
*.p12
*.pfx
*.crt
*.cer
*.der
*.keystore
*.jks
*.kdbx
*.pgpass
id_rsa
id_dsa
id_ecdsa
id_ed25519
*_rsa
*_dsa
*_ecdsa
*_ed25519

# Database, vector, and sidecar stores
*.sqlite
*.sqlite3
*.sqlite-shm
*.sqlite-wal
*.db
*.db3
*.db-shm
*.db-wal
*.duckdb
*.parquet
*.faiss
*.index
VectorStore/
VectorStore/**

# Root runtime state, caches, logs, outputs, and private lanes
node_modules/
.cache/
.cache/**
.tmp/
.tmp/**
cache/
cache/**
state/
state/**
tmp/
tmp/**
output/
output/**
outputs/
outputs/**
logs/
logs/**
secrets/
secrets/**
DebugLog/
DebugLog/**
image/
image/**
VCPTimedContacts/
VCPTimedContacts/**
VCPTimedResults/
VCPTimedResults/**

# Protected agent board state: never automatic copy/checksum/migrate
.agent_board/
.agent_board/**

# Plugin auth, secret, and runtime state paths
Plugin/UserAuth/code.bin
Plugin/**/.cache
Plugin/**/.cache/**
Plugin/**/.cache*
Plugin/**/.cache*/**
Plugin/**/cache
Plugin/**/cache/**
Plugin/**/state
Plugin/**/state/**
Plugin/**/logs
Plugin/**/logs/**
Plugin/**/secrets
Plugin/**/secrets/**
Plugin/*/*secret*
Plugin/*/*token*
Plugin/**/*secret*
Plugin/**/*token*
Plugin/**/*[sS][eE][cC][rR][eE][tT]*
Plugin/**/*[tT][oO][kK][eE][nN]*
Plugin/**/output
Plugin/**/output/**
Plugin/**/outputs
Plugin/**/outputs/**
Plugin/**/*.log
Plugin/**/*.sqlite
Plugin/**/*.sqlite3
Plugin/**/*.sqlite-shm
Plugin/**/*.sqlite-wal
Plugin/**/*.db
Plugin/**/*.db3
Plugin/**/*.db-shm
Plugin/**/*.db-wal

# Known plugin runtime/operator stores from the current governance baseline
Plugin/.backup/
Plugin/AIGentStyle/datasets/
Plugin/AIGentStyle/datasets/**
Plugin/AIGentStyle/outputs/
Plugin/AIGentStyle/outputs/**
Plugin/ArtistMatcher/artist_cache.json
Plugin/DoubaoGen/.doubao_api_cache.json
Plugin/DailyNoteWrite/dailynote/
Plugin/DailyNoteWrite/dailynote/**
Plugin/DailyHot/dailyhot_cache.md
Plugin/EmojiListGenerator/generated_lists
Plugin/EmojiListGenerator/generated_lists/**
Plugin/FRPSInfoProvider/frps_info_cache.txt
Plugin/ImageProcessor/image_cache.json
Plugin/ImageProcessor/multimodal_cache.json
Plugin/MCPOMonitor/mcpo_status_cache.txt
Plugin/MCPOMonitor/mcpo_status_cache.json
Plugin/OneRing/OneRingConfig.json
Plugin/OneRing/OneRingConfig.*.json
Plugin/OneRing/data
Plugin/OneRing/data/**
Plugin/OneRing/*.db
Plugin/OneRing/*.db-wal
Plugin/OneRing/*.db-shm
Plugin/ProjectAnalyst/database
Plugin/ProjectAnalyst/database/**
Plugin/RAGDiaryPlugin/vector_cache.json
Plugin/RAGDiaryPlugin/meta_chain_vector_cache.json
Plugin/RAGDiaryPlugin/rag_tags.json
Plugin/RAGDiaryPlugin/semantic_groups.json
Plugin/RAGDiaryPlugin/semantic_groups.edit.json
Plugin/RAGDiaryPlugin/semantic_vectors/
Plugin/RAGDiaryPlugin/semantic_vectors/**
Plugin/SkillBridge/skill-index.txt
Plugin/TavilySearch/.vcptoolbox_tavily_cache.json
Plugin/VCPLog/log/VCPlog.txt
Plugin/VCPTaskAssistant/task-center-data.json
Plugin/WeatherReporter/weather_cache.json
Plugin/WeatherReporter/weather_cache.txt
Plugin/WeatherReporter/city_cache.txt

# Local developer/runtime diagnostics from the current governance baseline
admin-*.err
server-*.err
AdminPanel-Vue/.vite-cache/
AdminPanel-Vue/vite-*.err

# Reviewed frontend build output only
AdminPanel-Vue/dist/
AdminPanel-Vue/dist/**

# Do not add blanket dist ignores.
# Plugin/**/dist/** is preserved by default because some plugins require it at runtime.
```

## 5. LocalState Baseline

S8 will define the LocalState skeleton in detail. Until S8 is PASS, LocalState remains default-excluded.

The future `VCPToolBox-JENN-LocalState/.gitignore` must start stricter than the external package baseline:

```gitignore
# Jenn LocalState default: private by default
*
!.gitignore
!README.AGENTS_OS.md
!receipts/
!receipts/README.AGENTS_OS.md
```

This means `cache/`, `logs/`, `outputs/`, `secrets/`, `state/`, `private-memory/`, `project-data/`, DB/vector stores, env/config files, and `.agent_board/**` stay excluded unless a later task writes a narrower reviewed allow rule.

## 6. Dist Rule

Do not use these rules in the external package baseline:

```gitignore
dist/
**/dist/
Plugin/**/dist/
Plugin/**/dist/**
```

Reason:

- `Plugin/DailyHot/daily-hot.js` reads `Plugin/DailyHot/dist/routes/**` at runtime.
- Other plugin `dist/` directories may also be source-like runtime payloads.
- A plugin task book may exclude a plugin-specific `dist/` only after proving it is disposable build output.

Allowed build-output ignore:

```gitignore
AdminPanel-Vue/dist/
AdminPanel-Vue/dist/**
```

## 7. Copy-First Exclusion Contract

Any future copy-first task must apply the S7 baseline before copying and before checksum generation.

Required order:

1. Verify source and target worktrees are clean or explicitly accounted.
2. Create or verify the target `.gitignore` from this S7 baseline.
3. Copy only reviewed source paths.
4. Run a paths-only secret/runtime risk scan against the copied result.
5. Fix or exclude blocked paths before generating `MANIFEST.sha256`.
6. Generate checksum only after the scan is clean.

Checksum must not include:

- env/config files;
- auth material;
- token/key/secret-like plugin files;
- cache/state/log/output/image/runtime data;
- DB/vector sidecars;
- `.agent_board/**`;
- LocalState private lanes without a separate gate.

Checksum must include:

- plugin runtime source files;
- plugin manifests;
- reviewed non-secret docs;
- plugin-declared runtime-required `Plugin/**/dist/**` content.

## 8. S7 Acceptance

S7 is PASS when:

- this baseline document exists;
- the baseline includes all categories required by S6 section 7 and the acceptance plan A12/A13;
- the baseline includes plugin `*secret*` and `*token*` filename rules, including case-safe bracket patterns for Linux-sensitive gitignore matching;
- the baseline includes operator config/state paths such as `ModelRedirect.json`, `agent_map.json`, `preprocessor_order.json`, `tag-processor-config.env`, `SemanticModelRouter.local.json`, `VCPTimedContacts/**`, `VCPTimedResults/**`, `sarprompt.json`, `VectorStore/**`, `Plugin/OneRing/data/**`, `Plugin/ProjectAnalyst/database/**`, `ToolConfigs/dynamic_tool_*.json`, and root `.gitignore` plugin-specific runtime cache/log/vector/index paths;
- `.agent_board/**` is default-blocked;
- no blanket `dist/` rule exists;
- `Plugin/**/dist/**` is preserved by default;
- no external package, LocalState directory, plugin copy, checksum, runtime env, service, bridge, or secret file is changed.

S7 does not make M2 PASS. M2 remains PARTIAL until S8 and S9 are also complete.

## 9. Validation

S7 validation:

```powershell
$files = @(
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md',
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md'
)
$bad = foreach ($file in $files) {
  Select-String -Path $file -Pattern '[ \t]+$' | ForEach-Object { "${file}:$($_.LineNumber)" }
}
if ($bad) { $bad; exit 1 }
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "Plugin/\\*\\*/\\*\\[sS\\]\\[eE\\]\\[cC\\]\\[rR\\]\\[eE\\]\\[tT\\]\\*|Plugin/\\*\\*/\\*\\[tT\\]\\[oO\\]\\[kK\\]\\[eE\\]\\[nN\\]\\*|\\.agent_board/|ToolConfigs/dynamic_tool_\\*\\.json|Plugin/RAGDiaryPlugin/semantic_vectors|Plugin/\\*\\*/dist" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md
git status --short
```

Do not run service startup, provider calls, bridge calls, external writes, copy-first, or checksum generation as part of S7.

## 10. Rollback

For S7:

- Revert this baseline document and the tracker S7 update.

For future skeleton implementation:

- Remove only reviewed placeholder skeleton files after verifying the target path is inside the approved external root.
- Do not delete copied plugin packages, LocalState, `.agent_board/**`, secrets, logs, cache, runtime state, DB/vector stores, or generated outputs as a rollback shortcut.
