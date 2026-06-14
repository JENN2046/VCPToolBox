# Gate 83 AIGent Orchestrator Plugin Execution Validation Design RFC

## Route

```text
route: 83
classification: PLUGIN_EXECUTION_VALIDATION_DESIGN_RFC_READY
design only: yes
plugin execution validation performed: no
```

## Prior Proof Boundary

```text
Gate 82 real image generation validation: sealed
provider validation: not plugin execution
real image validation: not plugin execution
plugin execution validation: not yet sealed
LocalState validation: not in Gate 83
server route validation: not in Gate 83
runtime cutover: not in Gate 83
core copy deletion: not in Gate 83
```

Gate 82 proved a bounded provider/image path and preserved `processToolCall: no` and `executePlugin: no`. Gate 83 must therefore design a separate proof surface for external plugin execution without inferring success from provider contact, generated image output, or the Gate 82 harness.

## Candidate Validation Path

The safe candidate path is a later bounded harness that proves the runtime can resolve and invoke `JennAIGentOrchestrator` from the sealed external plugin path while keeping all downstream and side-effect boundaries closed.

The later harness should be split into stages:

```text
stage 1: load plugin registry/root metadata in a bounded local process
stage 2: prove exact external plugin resolution for JennAIGentOrchestrator
stage 3: prove core fallback is false
stage 4: prove explicit external allow policy match
stage 5: invoke one bounded plugin execution entrypoint only if a safe no-provider command is identified
stage 6: emit sanitized projection only
```

No stage may start server routes, write LocalState, contact the image provider, generate an image, modify the external package, delete the core copy, or perform runtime cutover.

## Design Gap

```text
required harness or design gap:
  a new Gate 83 bounded plugin execution harness is required
whether processToolCall is needed:
  yes
whether executePlugin is needed:
  yes
whether external plugin file content review is needed:
  yes
whether LocalState write is required:
  no
whether provider contact is required:
  no
whether real image generation is required:
  no
```

Rationale:

`processToolCall` is the normal tool-call boundary for plugin invocation. `executePlugin` is part of the current local plugin execution path after tool-call preparation. A later execution gate should prove both boundaries only inside a bounded harness and only after an approved safe command is identified.

External plugin file content review is not performed in this RFC. It is needed in a later design or preflight segment to identify a no-provider, no-LocalState, no-runtime-cutover command or to prove that no such command exists. If the external plugin exposes no safe command, the later segment must block before execution.

## Later PASS Projection

A later execution gate should emit only sanitized fields similar to:

```text
result: PASS
route: 83-execution
plugin execution validation: sealed
plugin name: JennAIGentOrchestrator
resolved plugin source: external
resolved external path exact match: yes
core fallback false: yes
external allow policy matched: yes
manifest identity matched: yes
safe command identified: yes
safe command category: no-provider/no-LocalState/no-runtime-cutover
processToolCall called: yes
executePlugin called: yes
plugin handler reached: yes
plugin result sanitized: yes
provider endpoint contact: no
real image generation invoked: no
image output produced: no
LocalState write: no
server route activation: no
runtime cutover: no
core copy removal: no
credential value printed: no
token value printed: no
raw authorization header printed: no
provider response body printed: no
request body printed: no
raw image bytes printed: no
base64 image data printed: no
external plugin modified: no
```

## Later BLOCK Projection

A later execution gate should block with sanitized evidence if any of these conditions appear:

```text
result: BLOCK
route: 83-execution
exact sanitized blocker category:
  external path mismatch / core fallback true / allow policy missing / manifest identity mismatch / safe command unavailable / provider contact attempted / LocalState write attempted / server route activation attempted / runtime cutover attempted / raw output hygiene failure / plugin execution error / unknown
processToolCall called: yes/no
executePlugin called: yes/no
plugin handler reached: yes/no
provider endpoint contact: yes/no
real image generation invoked: yes/no
image output produced: yes/no
LocalState write: yes/no
server route activation: yes/no
runtime cutover: yes/no
core copy removal: yes/no
sanitizer suspected forbidden output: yes/no
retry started: no
Gate 84 started: no
```

## Secret Hygiene

The later harness and receipt must prove:

```text
credential value printed: no
token value printed: no
raw authorization header printed: no
provider response body printed: no
request body printed: no
raw image bytes printed: no
base64 image data printed: no
env values printed: no
secret-like value printed: no
```

It must emit sanitized booleans, categories, exact allowed plugin names, and exact allowed path identity only. It must not print raw args, raw env values, raw provider responses, request bodies, image bytes, or generated image content.

## Scope Boundaries For Later Execution Gate

```text
allowed goal:
  prove bounded external plugin execution only
not allowed:
  provider validation
not allowed:
  real image generation validation
not allowed:
  LocalState validation
not allowed:
  server route validation
not allowed:
  runtime cutover
not allowed:
  core copy deletion or alteration
not allowed:
  broad plugin source changes
```

The later gate must remain one-shot and fail closed. A retry must require a separate route segment.

## Recommendation

```text
RECOMMEND_GATE_83A_PLUGIN_EXECUTION_VALIDATION_HARNESS_DESIGN_OR_PREFLIGHT
```

Gate 83A should be a narrow design/preflight segment that may inspect the external plugin manifest and source under a new explicit boundary, identify a safe no-provider command if one exists, and design the exact bounded harness. It must not execute plugin code unless a later segment explicitly authorizes execution.
