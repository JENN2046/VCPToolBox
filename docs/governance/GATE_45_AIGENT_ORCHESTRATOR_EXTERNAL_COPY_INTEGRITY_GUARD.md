# Gate 45 | AIGentOrchestrator External Copy Integrity Guard

## 1. Status

Status: ready for review, not runtime cutover authorization.

Gate 45 creates a static integrity guard only.

This gate does not authorize provider validation.
This gate does not authorize downstream dispatch.
This gate does not modify runtime behavior.

## 2. Current evidence

Core HEAD:

```text
73f786fdb73eeada6b2388bbff01c31184f2513d
```

Core origin/main:

```text
73f786fdb73eeada6b2388bbff01c31184f2513d
```

External HEAD:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin/main:

```text
f7772c654c2d8d34698f2818fde02ec63df783cb
```

External origin:

```text
https://github.com/JENN2046/VCPToolBox-JENN-Extensions
```

External tags:

```text
none
```

Core validation:

```powershell
node --check scripts/check-prod-baseline.js
npm run test:baseline
```

External validation:

```powershell
node --check scripts\check-jenn-static-no-provider.mjs
node scripts\check-jenn-static-no-provider.mjs
```

## 3. Guard scope

The new explicit integrity guard covers:

- AIGentOrchestrator.js byte-for-byte equality
- config.env.example byte-for-byte equality
- plugin-manifest.json equality except approved identity fields:
  - name
  - description
- README.md external preface / identity allowance while retaining the core README body

## 4. Allowed divergence

External path/name identity may differ:

```text
AIGentOrchestrator
JennAIGentOrchestrator
```

Manifest name and description may differ for package identity.

README external preface may differ.

Source and config must not diverge.

Any broader manifest or README divergence blocks.

Any source/config divergence blocks.

## 5. Runtime exclusion

No runtime cutover.
No provider calls.
No downstream plugin dispatch.
No LocalState writes.
No Plugin/** modifications.
No modules/** modifications.
No server route activation.
No Plugin Store live operation.
No real image generation/provider validation.

Gate 31D remains planner-only no-provider evidence, not provider validation.

## 6. Baseline boundary

Core npm baseline must not depend on external package filesystem availability.

The cross-repo integrity script is run explicitly in Gate 45 and future explicit guard gates.

The core baseline only guards the existence and static contract of the script/doc.

## 7. Recommended next gate

RECOMMEND_GATE_46_CORE_REMOTE_INTEGRATION_FOR_GATE_45_GUARD
