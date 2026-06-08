# Jenn Extraction Implementation Plan - 2026-06-08

## 1. Summary

This plan records the implementation path for turning
`vcptoolbox_jenn_extraction_package_20260608.zip` into a safe local
externalization track.

Closed branch:

```text
codex/jenn-extraction-readonly-preflight-20260608
```

Merged main status:

```text
main at a64b7846756a548a306f5aad1d40732ce4ffcde1
Merge pull request #223 from JENN2046/codex/jenn-extraction-readonly-preflight-20260608
```

Merged commits in scope:

```text
5eadafeb docs: add jenn extraction readonly preflight
1d3cbd0a feat: discover external legacy plugin dirs
9f890367 docs: clarify external plugin dirs contract
```

The narrow PR is closed and merged into `main`. This document is now the
closeout and follow-up boundary for the Jenn extraction track.

## 2. Merged Package Boundary

The merged package is limited to:

- readonly extraction audit script
- governance ledger entries for the extraction strategy package
- minimal `VCP_PLUGIN_DIRS` discovery for legacy `plugin-manifest.json` plugin
  folders
- tests proving missing/empty external directories are safe and external
  discovery does not execute plugin entrypoint code

Do not expand this merged package retroactively. The following work remains out
of scope and must use separate packages:

- plugin migration
- plugin deletion or stub replacement
- AdminPanel extension loader
- Agent external directory loader
- LocalState migration
- external modern `plugins/registry.json` support
- new permission model or high-risk plugin allow policy

## 3. Implemented Contract

`VCP_PLUGIN_DIRS` behavior is intentionally narrow:

- built-in `Plugin/` discovery runs first
- external legacy directories run after built-in discovery
- duplicate plugin names keep the existing first-loaded behavior, so external
  plugins do not override built-in plugins
- missing or empty external directories are ignored
- `;` separated paths are supported
- `:` separated paths are supported when the value is not a Windows drive path
- discovery reads manifest/config metadata but does not execute plugin
  entrypoint code

This contract is the only runtime behavior change in the merged package.

## 4. Next Work Queue

1. Treat PR #223 as closed and do not reopen it with extra extraction scope.
2. If review asks for high-risk external plugin policy, create a separate
   external plugin safety-gate PR.
3. Keep Agent external directories as a later readonly design package.
4. Keep LocalState migration as `Observe only` until explicit migration
   authorization exists.
5. Keep AdminPanel extension loader as `Observe only` until plugin and Agent
   externalization boundaries are stable.

## 5. Future Package Approval Boundaries

Allowed as small local follow-up packages after normal branch/diff preflight:

- docs-only closeout or ledger updates
- readonly Agent external-directory design
- readonly AdminPanel extension-loader design
- readonly LocalState risk assessment
- external plugin safety-gate design that does not change default loading or
  execution behavior

Requires explicit approval before implementation:

- extracting, copying, moving, deleting, stubbing, or replacing plugin content
- enabling Agent external directory loading
- enabling AdminPanel extension loading
- migrating LocalState or any operator/private state
- adding external modern `plugins/registry.json` support
- changing plugin permission policy, high-risk allow behavior, or default
  execution authority
- reading or operating on a workspace-external ZIP package
- committing, pushing, opening a PR, or writing to any remote service

## 6. Validation

Validation commands for the merged package were:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\jenn-extraction-audit-readonly.ps1
node --check Plugin.js
node --check tests\plugin-external-dirs.test.js
node --test tests\plugin-external-dirs.test.js
npm test
git diff --check
```

Expected result:

```text
npm test: 341/341 pass
```

`npm test` may create untracked `dailynote/` artifacts. These artifacts must
not be committed.

This closeout update was validated by checking the markdown diff and whitespace
only. It does not rerun the full merged-package test suite.

## 7. Rollback

Rollback the merged package by reverting PR #223 or the listed commits. No
runtime data, secrets, AdminPanel source, Agent files, LocalState files, or
plugin content should need manual cleanup because this plan does not move or
delete them.
