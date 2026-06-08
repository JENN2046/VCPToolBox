# Jenn Extraction Implementation Plan - 2026-06-08

## 1. Summary

This plan records the implementation path for turning
`vcptoolbox_jenn_extraction_package_20260608.zip` into a safe local
externalization track.

Current branch:

```text
codex/jenn-extraction-readonly-preflight-20260608
```

Current local commits in scope:

```text
5eadafeb docs: add jenn extraction readonly preflight
1d3cbd0a feat: discover external legacy plugin dirs
9f890367 docs: clarify external plugin dirs contract
```

The branch should remain a narrow PR that contains only readonly preflight,
minimal legacy external plugin discovery, and documentation for the current
contract.

## 2. Current PR Boundary

Keep this PR limited to:

- readonly extraction audit script
- governance ledger entries for the extraction strategy package
- minimal `VCP_PLUGIN_DIRS` discovery for legacy `plugin-manifest.json` plugin
  folders
- tests proving missing/empty external directories are safe and external
  discovery does not execute plugin entrypoint code

Do not add to this PR:

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

This contract is the only runtime behavior change in the current branch.

## 4. Next Work Queue

1. Open the current branch as a PR and request review.
2. If review asks for high-risk external plugin policy, create a separate
   external plugin safety-gate PR.
3. Keep Agent external directories as a later readonly design package.
4. Keep LocalState migration as `Observe only` until explicit migration
   authorization exists.
5. Keep AdminPanel extension loader as `Observe only` until plugin and Agent
   externalization boundaries are stable.

## 5. Validation

Validation commands for this branch:

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

## 6. Rollback

Rollback this branch by reverting the current PR commits. No runtime data,
secrets, AdminPanel source, Agent files, LocalState files, or plugin content
should need manual cleanup because this plan does not move or delete them.
