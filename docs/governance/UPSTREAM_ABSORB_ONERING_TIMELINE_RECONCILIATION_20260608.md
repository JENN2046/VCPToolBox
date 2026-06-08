# Upstream Absorb: OneRing Timeline Reconciliation

Date: 2026-06-08

Source:
- upstream commit: `e478faa6`
- upstream files reviewed:
  - `Plugin/OneRing/OneRingTimelineCommon.js`
  - `Plugin/OneRing/OneRingRawClientTimeline.js`
  - `Plugin/OneRing/OneRingServerInferredTimeline.js`

## Absorbed Backend Surface

This package absorbs the low-risk, pure timeline contract layer into the local backend implementation:

- raw client `sha256` hashing
- `sha256:` client hash normalization
- strict client timestamp binding schema normalization
- tail-whitespace-only raw hash tolerance
- post-block timestamp binding by verified role, index, and hash
- timestamp binding merge helper

Local implementation:
- `modules/oneringTimeline.js`

Local tests:
- `tests/onering-timeline.test.js`

## Safety Boundary

This package intentionally does not import the upstream strategy files wholesale.

Deferred items:
- `RawClientTimelineStrategy` DB correction scheduling
- `ServerInferredTimelineStrategy` reversible working-view integration
- large `Plugin/OneRing/OneRing.js` pipeline rewiring
- upstream `Plugin/OneRing/onring.bak.js`

Reason:
- upstream strategies couple timeline logic to DB writes, fuzzy extraction, snapshot hashing, metadata tagging, and plugin main-flow mutation.
- the local backend now has a thinner, default-off OneRing wrapper and safer post-turn store/handler wiring.
- timeline intake should therefore land first as pure, testable primitives before any runtime handler or plugin mutation.

## Validation Intent

Required validation for this package:

```powershell
node --check modules\oneringTimeline.js
node --test tests\onering-timeline.test.js tests\onering-plugin-wrapper.test.js tests\onering-handler-wiring.test.js tests\onering-response-meta-capture.test.js
```

This validation does not execute real shell/file/bridge/external writes and does not touch real OneRing runtime data.
