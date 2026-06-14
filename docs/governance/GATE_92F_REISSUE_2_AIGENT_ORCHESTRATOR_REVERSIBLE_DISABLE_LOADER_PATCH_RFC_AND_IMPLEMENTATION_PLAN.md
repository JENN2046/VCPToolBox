# Gate 92F-Reissue-2 AIGent Orchestrator Reversible Disable Loader Patch RFC And Implementation Plan

## Route Identity

```text
Route Segment: 92F-Reissue-2
Title: Reversible Disable Loader Patch RFC / Implementation Plan
Result: PASS
Classification: REVERSIBLE_DISABLE_LOADER_PATCH_RFC_AND_IMPLEMENTATION_PLAN
Mode: A1 documentation-only
Authorization token used: AUTHORIZE_ROUTE_92F_REISSUE_2_REVERSIBLE_DISABLE_LOADER_PATCH_RFC_DOCS_ONLY
```

## Current State

```text
92A: SEALED
92B-Reissue-1: SEALED
92C: SEALED
92D: SEALED
92E: SEALED
92F: SEALED AS BLOCK
92F-Reissue-1: SEALED
```

Operational truth:

```text
Runtime external selection bounded proof: SEALED
Operator-facing bounded validation: SEALED
Core copy disable: BLOCKED
Core copy removal: NOT AUTHORIZED
Loader patch: NOT IMPLEMENTED
Post-disable rollback drill: NOT READY
Full closeout: BLOCKED
```

## Boundary

```text
92F-Reissue-2 does not patch the loader.
92F-Reissue-2 does not disable the core copy.
92F-Reissue-2 does not create a .disabled marker.
92F-Reissue-2 does not remove the core copy.
92F-Reissue-2 does not authorize final closeout.
```

## Selected Mechanism

```text
selected mechanism: .disabled marker support in Plugin.js legacy loader
```

Intended future behavior:

```text
If Plugin/<folder>/.disabled exists, Plugin.js legacy discovery/loading must skip that plugin
folder.
If Plugin/<folder>/.disabled does not exist, Plugin.js legacy discovery/loading behavior remains
unchanged.
The plugin folder remains physically present.
plugin-manifest.json remains physically present.
Rollback is deleting Plugin/<folder>/.disabled.
```

## Future Patch Gate

```text
92F-Reissue-3 - Reversible Disable Loader Patch Proof
```

Gate 92F-Reissue-3 must be the only future gate that may modify loader source.

Expected allowed patch target:

```text
Plugin.js
```

Expected forbidden patch targets:

```text
Plugin/AIGentOrchestrator/
Plugin/AIGentOrchestrator/plugin-manifest.json
modules/pluginRootResolver.js
modules/externalPluginAllowPolicy.js
package.json
.env
config.env
external repo files
```

Any change outside `Plugin.js` requires a separate Commander-issued gate.

## Future Patch Semantics

The future 92F-Reissue-3 patch must:

```text
check for Plugin/<folder>/.disabled before loading the plugin
skip the disabled plugin folder when marker exists
not delete the plugin folder
not modify plugin-manifest.json
not alter external plugin allow policy
not alter external plugin resolution
not change provider behavior
not change LocalState behavior
not start server
not contact providers
not generate images
not expose secrets
```

The future patch should fail closed if filesystem inspection errors occur around the `.disabled`
check.

## Future Patch Proof Conditions

Gate 92F-Reissue-3 must prove, using synthetic/local validation only:

```text
.disabled absent -> legacy core plugin remains loadable
.disabled present -> legacy core plugin is skipped
external JennAIGentOrchestrator path remains selectable
external manifest identity remains matched
core source directory remains physically present
core plugin manifest remains physically present
no server start
no route activation
no HTTP request
no provider contact
no real image generation
no LocalState write
no external repo mutation
no raw secret-like output
```

## Future Validation Approach

A future bounded harness or narrow test must validate loader behavior without server start.

Future allowed validation command shape:

```powershell
node scripts/run-jenn-aigent-orchestrator-reversible-disable-loader-patch-proof-harness.js
```

The future harness must be authorized in 92F-Reissue-3, not in this segment.

The future harness must:

```text
create a temporary bounded fixture or use synthetic paths
avoid mutating real Plugin/AIGentOrchestrator unless explicitly authorized by a later gate
avoid server start
avoid HTTP requests
avoid provider contact
avoid image generation
avoid LocalState writes
emit approved fields only
fail closed on unexpected loader behavior
fail closed on secret-like output
```

## Future Core-Copy Disable Retry Gate

```text
92F-Reissue-4 - Core Copy Reversible Disable Proof Retry
```

Gate 92F-Reissue-4 may proceed only after 92F-Reissue-3 is sealed.

The retry may then create:

```text
Plugin/AIGentOrchestrator/.disabled
```

Only if 92F-Reissue-3 proves the active legacy loader honors the marker.

The retry must still forbid:

```text
core copy removal
directory rename
source deletion
manifest broad edits
server start
provider contact
image generation
LocalState write
commit
push
```

## Future Rollback Sequence

For the `.disabled` marker:

```powershell
Remove-Item Plugin\AIGentOrchestrator\.disabled
```

A future proof must show that rollback restores the pre-disable state without touching the external
repo.

## Future 92G And 92H Conditions

```text
92G - Post-Disable Rollback Drill Proof remains blocked until 92F-Reissue-4 seals.
```

```text
92H - Final Closeout Retry remains blocked until all are sealed:
  92C runtime cutover bounded proof
  92D operator-facing behavior validation
  92F-Reissue-3 loader patch proof
  92F-Reissue-4 reversible core-copy disable proof
  92G post-disable rollback drill proof
  secret-safety scan
  repo final state recorded
  external repo unchanged or explicitly authorized
```

## Safety Confirmations

```text
Plugin.js changed: no
Plugin/AIGentOrchestrator changed: no
.disabled marker created: no
plugin-manifest.json changed: no
core copy disabled: no
core copy removed: no
server started: no
route activated: no
HTTP request issued: no
provider endpoint contact: no
real image generation invoked: no
LocalState write performed: no
package.json changed: no
.env/config changed: no
external repo changed/pushed: no
commit performed: no
push performed: no
secret-like value exposure: no
```

## Sealability Decision

```text
92F-Reissue-2 sealable
recommended next segment: 92F-Reissue-3 - Reversible Disable Loader Patch Proof
```
