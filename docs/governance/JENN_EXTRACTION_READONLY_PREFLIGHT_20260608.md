# Jenn Extraction Readonly Preflight - 2026-06-08

## 0. Scope

This document records the local feasibility pass for:

```text
C:\Users\617\Downloads\vcptoolbox_jenn_extraction_package_20260608.zip
```

The package is treated as an externalization strategy package, not as an
implementation patch. This preflight does not authorize moving, copying,
deleting, stubbing, merging, pushing, or extracting repository content.

## 1. Current Decision

Status: `READY_FOR_READONLY_AUDIT_ONLY`

The package is feasible as a route map for reducing long-term upstream merge
pressure, but the implementation must be staged. The next allowed step is a
readonly local audit that turns the package inventory into repository-specific
facts.

## 2. Local Readonly Audit Script

Added script:

```text
scripts/jenn-extraction-audit-readonly.ps1
```

The script is intentionally limited to:

- git branch/status/HEAD display
- ZIP path existence check
- inventory path existence check
- loader capability probe
- secret-risk path reporting by path only
- classification summary

The script intentionally does not:

- run `git fetch`
- extract the ZIP
- copy files
- move files
- delete files
- write reports
- read `.env` or `config.env` contents
- print secret-like matched values

## 3. Package Classification

| Area | Classification | Decision |
|------|----------------|----------|
| Package documentation strategy | `Full absorb` | Adopt as governance guidance. |
| Inventory model | `Full absorb` | Use for readonly path checks. |
| Secret-risk paths-only principle | `Full absorb` | Adopt as a hard audit rule. |
| Loader patch ideas | `Selective absorb` | Evaluate as narrow future PRs. |
| Copy-first extraction flow | `Selective absorb` | Keep as future migration procedure, not current action. |
| AdminPanel dynamic extension loader | `Observe only` | Too broad for this package; separate design review required. |
| LocalState full migration | `Observe only` | High private-state risk; do not start without explicit migration authorization. |
| Large stub/remove phase | `Observe only` | Do not remove or replace in-repo content in this preflight. |

## 4. Proposed Next Implementation Order

1. Run the readonly audit script and review the path inventory.
2. If the audit is stable, consider a tiny `VCP_PLUGIN_DIRS` loader PR.
3. Keep Agent loader, LocalState migration, and AdminPanel extension loader as
   separate packages.

The first implementation PR should not move existing plugins. It should only
prove that an empty or missing external plugin directory does not alter current
built-in plugin loading behavior.

## 5. Safety Boundaries

This preflight does not touch:

- `AdminPanel-Vue` source
- LocalState resolution
- plugin loading behavior
- agent loading behavior
- runtime/cache/state/log/image/operator data
- `.env` or `config.env`
- remote branches, PRs, or GitHub comments

## 6. Validation Target

Required validation for this package:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/jenn-extraction-audit-readonly.ps1
git diff --name-status
git diff --stat
```

No application tests are required for this documentation/script-only package
because it does not change runtime code.

## 7. Rollback

Rollback is straightforward:

```text
revert the commit, or remove scripts/jenn-extraction-audit-readonly.ps1 and
this preflight document, then revert the absorb-log entry.
```
