# Gate 89 AIGent Orchestrator Core Copy Retirement RFC

## Route

```text
route: 89
result: PASS
classification: CORE_COPY_RETIREMENT_RFC
RFC only: yes
core copy disabled: no
core copy removed: no
runtime cutover performed: no
```

## Current Core Copy

The core copy remains present and unchanged at:

```text
Plugin/AIGentOrchestrator
```

Observed files:

```text
Plugin/AIGentOrchestrator/AIGentOrchestrator.js
Plugin/AIGentOrchestrator/config.env.example
Plugin/AIGentOrchestrator/plugin-manifest.json
Plugin/AIGentOrchestrator/README.md
```

## Prior Gates

```text
Gate 86A runtime cutover RFC and dry-run harness: sealed
Gate 86B runtime cutover shadow proof: sealed
Gate 87 bounded runtime cutover pre-mutation preflight: blocked before mutation
Gate 88 rollback drill: sealed
```

Gate 89 does not convert the Gate 87 block into cutover authorization. It only defines the
conditions under which a later core copy disable could be reviewed.

## Retirement Candidate Strategy

The only acceptable retirement candidate is a reversible disable marker or manifest-level
disable that can be restored without deleting the core source. Direct deletion is not an
acceptable first retirement move.

```text
preferred future strategy:
  reversible core disable
forbidden first move:
  delete Plugin/AIGentOrchestrator
  move Plugin/AIGentOrchestrator outside the repository
  alter plugin source behavior
  alter provider/downstream/LocalState behavior
  make runtime cutover persistent without rollback proof
```

## Required Preconditions For Gate 90

Gate 90 may not disable the core copy unless all of these are true in the same task book:

```text
Gate 87 exact bounded runtime cutover task book: present
Gate 87 bounded runtime cutover proof: pass
Gate 88 rollback drill proof: pass after Gate 87 proof
operator impact scope: stated
exact target file(s): stated
exact change: stated
rollback command or revert path: stated
post-disable validation command: stated
stop condition: stated
```

The exact target must be one of:

```text
Plugin/AIGentOrchestrator/plugin-manifest.json
Plugin/AIGentOrchestrator/.disabled
```

Any wider target set requires a new RFC.

## Required Gate 90 Safety Contract

Gate 90 must be a small reversible patch. It must not combine disablement with unrelated
runtime, provider, server, LocalState, UI, dependency, or external package changes.

```text
allowed:
  one reversible disable mechanism
  one focused proof document
  one narrow validation harness if needed
forbidden:
  deleting core source
  changing AIGentOrchestrator.js behavior
  changing external package files
  changing provider credentials
  changing .env or config.env without an exact approved target
  starting server
  calling provider
  generating image
  writing LocalState
  broad refactor
```

## Rollback Requirements

Gate 90 rollback must restore the previous core behavior with one of:

```text
revert the exact commit
remove the exact .disabled marker
restore the exact manifest field value
```

Rollback validation must include:

```text
core copy present: yes
external shadow proof still clean: yes
provider contact: no
LocalState write: no
runtime cutover side effect: no
```

## Result

```text
Gate 89 RFC sealed: yes
core copy changed: no
runtime changed: no
next route: Gate 90 Core copy disable, blocked until exact Gate 90 task book
```
