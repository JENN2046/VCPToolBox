# Gate 42 | External Package Remote Policy RFC

## Status

This RFC is ready for review, not a remote binding receipt.

Gate 42 does not create, bind, or push an external remote.

Gate 42 does not authorize runtime cutover.

Gate 42 is a governance documentation policy only. It does not mutate the
external package, core runtime, plugin discovery, or provider execution path.

## Current evidence

Core HEAD:

```text
836630f6adf29a41ad7c3ef924158e8f87cba004
```

Core `origin/main`:

```text
836630f6adf29a41ad7c3ef924158e8f87cba004
```

External package HEAD:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External package current remote state:

```text
local-only, no remotes, no origin configured
```

External validator commands:

```text
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

Core baseline commands:

```text
node --check scripts/check-prod-baseline.js
npm run test:baseline
```

Gate 41 recommended an external remote policy gate because the external package
has no `origin`. Static prep can be reasoned about locally, but remote
integration policy must be explicit before any external package binding or push.

## Remote ownership policy

The external package must use a dedicated external package repository unless a
future explicit policy overrides this.

The external package remote must not be silently embedded into the core repo,
LocalState root, package root wildcard, or Plugin discovery root.

The external package must remain separable from core runtime behavior.

Core baseline must not depend on external package filesystem availability.

## Approved remote prerequisites for a future gate

A canonical external remote URL must be provided explicitly by the operator or
repository owner.

The URL must be recorded without embedded credentials.

The hosting namespace / owner must be identified.

The intended default branch must be identified.

The expected initial remote state must be identified as one of:

- empty remote;
- remote already containing compatible history.

If the remote already contains history, the future gate must compare histories
before any push.

If the remote is empty, the future gate may bind `origin` and push `main` only
after validation.

No external remote may be inferred from core origin.

No external remote may be guessed from package name.

## Future binding policy

Future binding must happen only in a separate gate.

Future binding may use:

```text
git remote add origin <approved-redacted-url>
```

It must not use credential-bearing URLs.

It must record the remote URL in redacted/non-secret form only.

It must verify:

```text
git remote -v
git remote get-url --all origin
```

It must block if `origin` already exists and differs from the approved URL.

It must block if the external worktree is dirty.

It must block if external HEAD is not:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

unless a later gate explicitly supersedes this expected baseline.

## Future first-push policy

Future first external push must happen only in a separate gate.

Future first push may use only:

```text
git push -u origin main
```

It must not push tags.

It must not publish packages.

It must not release or deploy.

It must verify after push that remote `main` equals the local external HEAD.

It must leave the external worktree clean.

It must not modify core runtime behavior.

It must not start runtime cutover.

## Remote mismatch and rejection policy

If remote `main` already exists and does not match expected history, block.

If push is rejected, block.

Do not pull, merge, rebase, reset, force-push, or repair without a separate task
book.

No force push is allowed.

No history rewrite is allowed.

## Credential and secret handling

Do not record credentials, access keys, raw authorization headers, personal
access credentials, SSH private keys, session material, or secret-like values.

Use only non-secret remote references and redacted fingerprints where evidence
is needed.

Command receipts must not include credential-bearing URLs.

## Out-of-scope runtime boundaries

No runtime cutover.

No provider calls.

No downstream plugin dispatch.

No LocalState writes.

No `Plugin/**` modifications.

No `modules/**` modifications.

No `scripts/**` modifications; this gate explicitly does not modify scripts.

No server route activation.

No Plugin Store live operation.

No real image generation/provider validation.

No allowlist broadening.

No wildcard/name-only/package-root/LocalState-root allowlists.

Gate 31D remains planner-only no-provider evidence, not provider validation.

## Recommended next gate

Recommendation:

```text
BLOCK_GATE_43_PENDING_REMOTE_URL
```

Rationale:

No trusted explicit canonical external remote URL is available in this gate. The
external package remains local-only with no `origin`, so Gate 43 must remain
blocked until the operator or repository owner provides a credential-free
canonical external remote URL and intended remote state.

This recommendation does not authorize runtime cutover, provider validation,
external push, external remote mutation, or external package edits.
