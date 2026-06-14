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

## 4. Historical Next Work Queue

This queue records the 2026-06-08 follow-up boundary for PR #223. It is
superseded by the active 2026-06-14 V2 direction in sections 8-14 wherever the
two sections differ.

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

## 8. 2026-06-14 V2 Forward Plan

This section updates the forward plan after a five-pass local audit of the
current repository. It does not rewrite the historical PR #223 closeout above.
The old plan remains the record for the narrow merged package; this V2 section
is the active direction for the next Jenn externalization work.

Verified repository state at the audit checkpoint:

```text
workspace: A:\AGENTS_OS_Workspace\runtime\VCPToolBox
branch: main
HEAD/origin: ee61d579b2e0fda4ad2d76ccfbd4fa530cf2dddf
upstream/main: 22899aedd076c8c27434a66b4fa468515e17bcae
merge-base: 8b8a71d80672d2f0a060d4bc47384d1e3ad2d05e
worktree: clean
origin-only commits vs upstream: 1105
upstream-only commits vs origin: 234
estimated both-changed paths: 155
```

Current plan score after audit: `8.0/10`.

Reason for the score:

- The direction is still correct: keep core thin, copy Jenn-specific surfaces
  outward first, and reduce future upstream merge pressure.
- The original plan underestimates the amount of Jenn surface still tracked in
  core.
- External plugin infrastructure is now more mature than the original package
  described, so the next plan should use the current gates instead of treating
  `VCP_PLUGIN_DIRS` as the only available mechanism.
- Agent, LocalState, and AdminPanel externalization are still design or
  inventory lanes, not runtime migration lanes.

## 9. Current Repository Reality

External plugin infrastructure now present in `main`:

- `VCP_PLUGIN_DIRS`
- `VCP_PLUGIN_ALLOWED_ROOTS`
- `VCP_PLUGIN_INSTALL_DIR`
- `VCP_EXTERNAL_PLUGIN_ALLOWLIST`
- external plugin safety gate
- external plugin allow policy
- runtime environment sandbox
- AdminPanel plugin target metadata for external plugin roots
- Plugin Store safeguards for external install paths and source redaction

Runtime lanes that are not implemented yet:

- `VCP_AGENT_DIRS`
- `VCP_AGENT_OVERRIDE_DIRS`
- `VCP_LOCAL_STATE_DIR`
- `VCP_ADMIN_EXTENSION_DIRS`

Known Jenn surfaces still tracked in core include:

- `Agent/` character and workflow files
- `.agent_board/`
- `AGENTS.override.md`
- `MEMORY.md`
- `data/photo-studio/`
- `README For VCPChat.md`
- Jenn AIGent, Codex memory, DingTalk, image, and PhotoStudio plugin families
- `modules/photoStudio/`
- hardcoded Jenn/AdminPanel operational routes
- local or generated runtime surfaces that must remain blocked until separately
  authorized

Known external package state:

- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-Extensions` exists and is a
  clean Git repository.
- `A:\AGENTS_OS_Workspace\runtime\VCPToolBox-JENN-LocalState` exists and is not
  a Git repository.
- `AIGentOrchestrator` has a completed copy-first sample: the core copy remains
  present, the core copy is disabled by marker, the external
  `JennAIGentOrchestrator` copy exists, and the integrity script passes.

## 10. Updated Three-Day Goal

For the next three days, every package should move toward this goal:

1. Make `JENN2046/VCPToolBox` easier to track against
   `lioensky/VCPToolBox upstream/main`.
2. Keep the core repository thin by moving Jenn-specific plugins, Agents,
   AdminPanel pages, Codex/photo workflows, and private local state into
   external packages.
3. Prefer copy-first, reversible packages before any delete, stub, route cutover,
   loader enablement, or LocalState migration.
4. Preserve secret safety: path-only reporting for sensitive files, no secret
   value reads, and no env file edits unless explicitly authorized.
5. Require explicit authorization before remote writes, commits, pushes, PRs,
   deletion, migration, production impact, or irreversible actions.

Every work package must answer this gate before execution:

```text
Does this step make the core thinner, make Jenn state more external, reduce
future upstream conflict pressure, or improve the safety/validation of that
externalization path?
```

If the answer is no, skip the step or explain why it is still necessary.

## 11. V2 Lane Order

Use this order unless a later audit proves it unsafe or stale:

1. `P3 Inventory V2`: produce a current, docs-only, path-only inventory of
   tracked Jenn surfaces, external package surfaces, blocked local state, and
   missing runtime lanes.
2. `P7 Plugin Copy-First`: choose one or two low-risk leaf plugins and create a
   dry-run package using the existing external plugin gates. Any real copy,
   extraction, move, delete, stub replacement, or route cutover for tracked core
   plugin content requires explicit authorization under sections 5 and 14.
3. `A2 Agent External Directory`: keep this readonly first; classify Agent files
   and define loader contract before any `VCP_AGENT_DIRS` runtime behavior.
4. `P6 LocalState`: inventory runtime data and private stores only; no migration
   until explicit authorization exists.
5. `P4 AdminPanel Extension Loader`: design after plugin and Agent boundaries
   are clearer; no runtime loader yet.
6. `Upstream Absorption`: classify upstream changes into Full, Selective, or
   Observe after externalization pressure is reduced enough to avoid noisy
   conflict work.

## 12. First Safe Work Package

The next safe package should be `P3 Inventory V2`.

Scope:

- create or update a governance inventory document
- include path counts and classification only
- compare core, `VCPToolBox-JENN-Extensions`, and
  `VCPToolBox-JENN-LocalState`
- record the exact generation commands, filters, and excluded path classes
- record source revisions for core, `VCPToolBox-JENN-Extensions`, and
  `VCPToolBox-JENN-LocalState`; if a source is not a Git repository, record
  `not a Git repository`
- record the classification rule version or audit date used by the inventory
- identify candidate leaf plugins for the first copy-first package
- identify blocked secret, runtime, generated, and private-store surfaces
- keep all output path-only for sensitive files

Non-goals:

- no plugin deletion
- no plugin stub replacement
- no plugin copy or extraction without explicit authorization
- no Agent loader implementation
- no AdminPanel loader implementation
- no LocalState migration
- no secret value reads
- no `.env` edits
- no commit, push, PR, release, or remote write

Exit criteria:

- inventory document reflects current `main`
- inventory document records the core commit, external package revision state,
  commands, filters, and classification rules used to generate it
- candidate and blocked surfaces are separated
- next package can be selected without rereading the entire repository
- validation status is reported clearly

## 13. V2 Validation Baseline

Recent audit validation passed:

```text
node --test tests/plugin-external-dirs.test.js
node --test tests/externalPluginAllowPolicy.test.js
node --test tests/externalPluginSafetyGate.test.js
node --test tests/plugin-external-runtime-registration-gate.test.js
node --test tests/plugin-external-runtime-env-sandbox.test.js
node --test tests/plugin-external-runtime-direct-policy.test.js
node --test tests/admin-plugin-command-description-target.test.js
node --test tests/plugin-store-install-env-sandbox.test.js
node --test tests/plugin-store-source-redaction.test.js
node --test tests/plugin-store-ssrf-policy.test.js
node --test tests/p3-external-ecosystem-inventory.test.js
node --test tests/aiImageJennTrialFixtures.test.js
node --check Plugin.js
node --check modules/pluginRootResolver.js
node --check scripts/p3-external-ecosystem-inventory.js
node scripts/check-jenn-aigent-orchestrator-copy-integrity.js
```

Observed result:

```text
external/plugin safety suite: 103/103 pass
AIGentOrchestrator copy integrity: PASS
```

For docs-only V2 plan updates, `git diff --check` and manual diff review are
sufficient. For any runtime package, rerun the narrow tests above plus any
tests covering the touched module.

## 14. V2 Stop Conditions

Stop and request explicit authorization before:

- copying or extracting tracked core plugin content into an external package
- moving, deleting, or replacing tracked core files
- enabling new Agent, AdminPanel, or LocalState runtime loaders
- changing plugin execution authority or high-risk permission policy
- changing dependency manifests or lockfiles
- reading secret values or editing secret-bearing files
- migrating private operator state
- committing, pushing, opening a PR, or writing to any remote service
