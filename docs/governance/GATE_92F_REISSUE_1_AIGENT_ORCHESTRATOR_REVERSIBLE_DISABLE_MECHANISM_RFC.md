# Gate 92F-Reissue-1 AIGent Orchestrator Reversible Disable Mechanism RFC

## Route Identity

```text
Route Segment: 92F-Reissue-1
Title: Core Copy Reversible Disable Mechanism RFC
Result: PASS
Classification: REVERSIBLE_DISABLE_MECHANISM_RFC
Mode: A1 documentation-only
Authorization token used: AUTHORIZE_ROUTE_92F_REISSUE_1_REVERSIBLE_DISABLE_MECHANISM_RFC_DOCS_ONLY
```

## Current State

```text
92A: SEALED
92B-Reissue-1: SEALED
92C: SEALED
92D: SEALED
92E: SEALED
92F: SEALED AS BLOCK
```

Operational truth:

```text
Runtime external selection bounded proof: SEALED
Operator-facing bounded validation: SEALED
Core copy disable: BLOCKED
Core copy removal: NOT AUTHORIZED
Post-disable rollback drill: NOT READY
Full closeout: BLOCKED
```

Gate 92F is sealed as BLOCK because no supported reversible disable mechanism exists under the
current runtime behavior. Gate 92G must not proceed until a future reversible disable proof is
sealed.

## Boundary

```text
This RFC does not patch the loader.
This RFC does not disable the core copy.
This RFC does not remove the core copy.
This RFC does not create Plugin/AIGentOrchestrator/.disabled.
This RFC does not modify Plugin/AIGentOrchestrator/plugin-manifest.json.
This RFC does not claim final closeout.
```

## Design Options

### Option A - .disabled Marker Support In Legacy Loader

Future behavior:

```text
If Plugin/<folder>/.disabled exists, Plugin.js legacy plugin discovery/loading must skip that
plugin folder.
The plugin folder remains physically present.
plugin-manifest.json remains physically present and unchanged.
Rollback is:
  Remove-Item Plugin\<folder>\.disabled
```

Expected future implementation target:

```text
Plugin.js
```

Rationale:

```text
smallest reversible mutation
does not change manifest semantics
does not delete or rename source
preserves rollback anchor
easy rollback by deleting one marker file
easy to audit
```

### Option B - Manifest Disable Flag Support

Future behavior:

```text
If plugin-manifest.json declares disabled or enabled === false, Plugin.js legacy plugin
discovery/loading must skip that plugin.
Rollback is:
  git checkout -- Plugin\<folder>\plugin-manifest.json
Only one manifest field may change.
```

Tradeoff:

```text
This keeps the state in one existing file but mutates plugin manifest semantics and requires
careful compatibility review across all legacy plugins.
```

### Option C - Existing Supported Mechanism

This option is allowed only if read-only inspection proves an existing mechanism is honored by the
active runtime path.

Current inspection did not prove an existing supported mechanism for the issued 92F boundary:

```text
.disabled marker honored by Plugin.js legacy loader: no
manifest disabled flag honored by Plugin.js legacy loader: no
plugin-manifest.json.block honored by Plugin.js legacy loader: no
```

`pluginRootResolver.js` recognizes `plugin-manifest.json.block` for manifest records, but the active
`Plugin.js` legacy runtime loading path reads `Plugin/<folder>/plugin-manifest.json` directly and
does not consume that blocked manifest candidate as a runtime disable.

## Recommendation

```text
recommended mechanism: .disabled marker support
```

Option A is the recommended future mechanism because it is the narrowest reversible operator action:
it preserves the core copy as a rollback anchor, avoids manifest mutation, avoids source deletion or
rename, and can be audited and reverted through one marker file.

## Future Gate Sequence

```text
92F-Reissue-2 - Reversible Disable Loader Patch RFC / Implementation Plan
92F-Reissue-3 - Reversible Disable Loader Patch Proof
92F-Reissue-4 - Core Copy Reversible Disable Proof Retry
92G - Post-Disable Rollback Drill Proof
92H - Final Closeout Retry
```

Gate 92G must remain blocked until 92F-Reissue-4 seals an actual reversible disable proof.

## Future Patch Constraints

A future loader patch gate may modify only the exact runtime loader file required, expected:

```text
Plugin.js
```

The future patch must not:

```text
modify Plugin/AIGentOrchestrator
modify external repo
modify package.json
modify .env/config
start server
contact providers
generate images
write LocalState
commit or push unless explicitly authorized by a later gate
```

## Future Proof Conditions

Future loader patch proof must prove:

```text
.disabled marker is recognized by active legacy loader
plugin folder is skipped when marker exists
plugin folder is loaded when marker is absent
no server start
no HTTP request
no provider contact
no image generation
no LocalState write
no external repo mutation
secret-like output not exposed
rollback remains one-file removal
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
92F-Reissue-1 sealable
recommended next segment: 92F-Reissue-2 - Reversible Disable Loader Patch RFC / Implementation Plan
```
