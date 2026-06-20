# S9 Manifest And Checksum Rules

Date: 2026-06-21

Status: RULES_ONLY

Parent tracker: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md`

Parent task books:

- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S6_EXTERNAL_RUNTIME_SKELETON_TASKBOOK_20260620.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S7_DENYLIST_GITIGNORE_BASELINE_20260621.md`
- `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S8_LOCALSTATE_AGENT_BOARD_GATE_20260621.md`

Parent plan: `docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_ACCEPTANCE_PLAN_20260618.md`

## 1. Purpose

This document closes the S9 gate for manifest and checksum rules before copy-first work begins.

It defines how future reviewed external packages must produce `MANIFEST.sha256` evidence after denylist and paths-only secret-risk checks pass.

S9 is rules-only. It does not create an external package, copy plugins, copy LocalState, generate `MANIFEST.sha256`, modify runtime code, enable runtime roots, call providers, write live services, or touch secrets.

## 2. Non-Negotiable Order

Future copy-first work must use this order:

1. Verify source and target worktrees are clean or explicitly accounted.
2. Name the exact reviewed source paths.
3. Apply the S7 external package denylist and S8 `.agent_board/**` gate before copy.
4. Copy only reviewed source/package paths.
5. Run a paths-only secret/runtime risk scan against the copied result.
6. Block and fix any denied path before checksum.
7. Generate `MANIFEST.sha256` only after the paths-only scan is clean.
8. Verify `MANIFEST.sha256` against the copied package.
9. Record a sanitized receipt with commands and results.
10. Only then consider shadow validation, rollback drill, or later stub/remove decision packages.

Checksum generation before denylist and paths-only scan is invalid evidence.

## 3. Evidence Boundaries

`MANIFEST.sha256` proves only that reviewed copied files match the package state at checksum time.

It does not prove:

- runtime registration success;
- provider behavior;
- bridge behavior;
- live external write safety;
- clean core dispatch changes;
- LocalState migration safety;
- `.agent_board/**` migration safety;
- readiness to delete, untrack, stub, or remove core copies.

Discovery success is not runtime registration success. Checksum success is not runtime registration success.

Runtime registration remains controlled separately by exact `VCP_EXTERNAL_PLUGIN_ALLOWLIST` entries.

## 4. Manifest Location And Format

For the future `VCPToolBox-JENN-Extensions` package, the checksum file location is:

```text
VCPToolBox-JENN-Extensions/manifests/MANIFEST.sha256
```

Line format:

```text
<lowercase-sha256-hex>  <package-relative-posix-path>
```

Rules:

- Use SHA-256 over raw file bytes.
- Use lowercase hex digests.
- Use two spaces between digest and path.
- Use paths relative to the external package root.
- Use forward slashes in paths, including on Windows.
- Sort paths ordinally before writing.
- Do not include absolute paths.
- Do not include machine usernames, home paths, temp paths, or private operator path details.
- Do not include `manifests/MANIFEST.sha256` in itself.
- Do not include `.git/**`, `.gitignore` implementation side effects, or ignored private/runtime paths.

## 5. Include Rules

Future source-package checksums should include:

- reviewed plugin source files;
- `plugin-manifest.json` and other reviewed plugin manifests;
- reviewed source-like runtime payloads;
- plugin-declared runtime-required `Plugin/**/dist/**` content;
- reviewed non-secret package docs;
- reviewed package README files;
- reviewed scripts used only for local validation or dry-run behavior.

The first M3 pilot must remain `Plugin/JennAIGentOrchestrator/`, not `Plugin/AIGentOrchestrator/`, unless a later reviewed task changes the pilot identity.

## 6. Exclude Rules

Future source-package checksums must exclude:

- `.env`, `.env.*`, `config.env`, local config variants, and real provider config;
- credentials, tokens, auth material, private keys, passwords, and secret-like files;
- `Plugin/UserAuth/code.bin`;
- cache, state, tmp, logs, output, outputs, generated image data, and runtime diagnostics;
- SQLite, DB, vector, WAL, SHM, FAISS, index, and sidecar stores;
- operator data and private LocalState lanes;
- `.agent_board/**`;
- `VCPToolBox-JENN-LocalState/**`;
- package receipts unless a later receipt-specific checksum is explicitly defined;
- `manifests/MANIFEST.sha256`;
- broad generated artifacts not reviewed as runtime source;
- `AdminPanel-Vue/dist/**` unless the task is explicitly frontend build/release;
- `Plugin/**/dist/**` only when a plugin-specific task proves that path is disposable build output.

Do not add a blanket `dist/`, `**/dist/`, `Plugin/**/dist/`, or `Plugin/**/dist/**` exclusion.

## 7. Paths-Only Secret-Risk Scan Contract

The S9 scan is paths-only. It checks path names and classifications; it must not read private file contents or inspect real secrets.

The scan must run after copying reviewed paths and before checksum generation.

Minimum scan assertions:

- no env/config path is present;
- no secret/token/key/auth-like path is present;
- no cache/state/log/output/image/runtime path is present;
- no DB/vector sidecar path is present;
- no LocalState root path is present;
- no `.agent_board/**` path is present;
- no root package path is being used as runtime registration evidence;
- no wildcard or name-only runtime allowlist evidence is recorded.

If a denied path is found, the copy-first task is `BLOCKED` until the candidate is removed from the reviewed source list or a separate explicit gate is opened.

Do not repair a denied path by deleting user-owned source data. Fix the copy candidate, package ignore rules, or task scope instead.

## 8. Future Generation Command Shape

These are command shapes for a later copy-first task. S9 does not run them.

```powershell
$root = Resolve-Path '%WORKSPACE_PARENT%/VCPToolBox-JENN-Extensions'
$manifest = Join-Path $root 'manifests/MANIFEST.sha256'
$files = git -C $root ls-files -co --exclude-standard |
  Where-Object { $_ -ne 'manifests/MANIFEST.sha256' } |
  Sort-Object

$lines = foreach ($rel in $files) {
  $native = $rel -replace '/', [IO.Path]::DirectorySeparatorChar
  $full = Join-Path $root $native
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $full).Hash.ToLowerInvariant()
  "$hash  $rel"
}

$lines | Set-Content -LiteralPath $manifest -Encoding utf8NoBOM
```

Before using this shape, the task must prove the file list was already filtered by S7 and S8 rules. `git ls-files -co --exclude-standard` is not a substitute for the required denylist and paths-only risk scan.

Do not run this against LocalState. Do not run this against `.agent_board/**`.

## 9. Future Verification Command Shape

Future verification must recompute SHA-256 over the listed files and fail on any mismatch, missing file, extra denied path, or path outside the external package root.

Verification rules:

- resolve each path under the package root;
- reject `..`, absolute paths, drive-qualified paths, and symlink escapes;
- reject paths ignored by S7/S8 denylist rules;
- recompute SHA-256 over raw file bytes;
- compare lowercase digests exactly;
- record pass/fail in a sanitized receipt.

Do not verify by reading LocalState or `.agent_board/**`.

## 10. Receipt Rules

Future copy-first receipts should be written under:

```text
VCPToolBox-JENN-Extensions/receipts/
```

Receipts may record:

- source commit or source package revision;
- target package revision;
- copied source path list;
- denylist scan command and pass/fail result;
- checksum generation command and pass/fail result;
- checksum verification command and pass/fail result;
- explicit exclusions;
- rollback plan.

Receipts must not record:

- secret values;
- raw env values;
- provider tokens;
- auth codes;
- `.agent_board/**` contents;
- private LocalState contents;
- live provider responses;
- operator private notes beyond sanitized path-level evidence.

Receipts are evidence, not source payload. They are excluded from `MANIFEST.sha256` unless a later receipt-specific manifest is explicitly defined.

## 11. Rollback Interaction

If a future checksum is wrong:

- regenerate it only after rerunning the paths-only risk scan;
- update the sanitized receipt;
- do not delete copied source files as a shortcut;
- do not delete LocalState or `.agent_board/**`;
- do not untrack, stub, or remove core copies.

If a future copy-first package must be disabled at runtime:

- omit `VCP_PLUGIN_DIRS`, `VCP_PLUGIN_ALLOWED_ROOTS`, and `VCP_EXTERNAL_PLUGIN_ALLOWLIST`;
- remove only newly created placeholder or package files after verifying the resolved target path is inside the approved external package root;
- never delete source-of-truth user data or private LocalState as a rollback shortcut.

## 12. S9 Validation

S9 validation:

```powershell
$files = @(
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S9_MANIFEST_CHECKSUM_RULES_20260621.md',
  'docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md'
)
$bad = foreach ($file in $files) {
  Select-String -Path $file -Pattern '[ \t]+$' | ForEach-Object { "${file}:$($_.LineNumber)" }
}
if ($bad) { $bad; exit 1 }
git diff --check -- docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S9_MANIFEST_CHECKSUM_RULES_20260621.md docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_TODO_TRACKER_20260620.md
rg -n "Status: RULES_ONLY|paths-only secret-risk|MANIFEST\\.sha256|Checksum generation before denylist|Discovery success is not runtime registration success|\\.agent_board/|Plugin/\\*\\*/dist" docs/governance/CLEAN_UPSTREAM_CORE_JENN_EXTERNAL_RUNTIME_S9_MANIFEST_CHECKSUM_RULES_20260621.md
git status --short
```

Do not run actual checksum generation, provider calls, bridge calls, external writes, service startup, copy-first, LocalState reads, or `.agent_board/**` reads as part of S9.

## 13. S9 Acceptance

S9 is PASS when:

- this rules document exists;
- it defines the required order of denylist, paths-only secret-risk scan, checksum generation, and checksum verification;
- it defines `MANIFEST.sha256` location and line format;
- it keeps LocalState private and outside plugin checksum scope;
- it keeps `.agent_board/**` blocked from automatic copy, checksum, and migration;
- it preserves `Plugin/**/dist/**` by default;
- it states checksum success is not runtime registration success;
- it defines rollback rules that do not delete user-owned source data, LocalState, or `.agent_board/**`;
- no external package, LocalState directory, checksum file, runtime env, provider, bridge, service, or clean core code is changed.

When S6, S7, S8, and S9 are all PASS, M2 can be marked PASS. M3 copy-first work remains separate.
