# Upstream Absorb: OneRing Server-Inferred Timeline Primitives

Date: 2026-06-08

Source:
- upstream commit: `e478faa6`
- upstream file reviewed:
  - `Plugin/OneRing/OneRingServerInferredTimeline.js`
  - related helper snippets from `Plugin/OneRing/OneRing.js`

## Absorbed Backend Surface

This package absorbs the server-inferred timeline primitives needed before runtime wiring:

- reversible working-view construction for raw chat message arrays
- non-enumerable original index and working key metadata
- leading `[系统通知]...[系统通知结束]` user-content sanitization
- pseudo-system and empty user removal records
- restore of processed working messages back onto original message order
- anchored injected message placement with `z<workingKey>` / `o<workingKey>`
- custom merge hook for future tail-metadata projection

Local implementation:
- `modules/oneringTimeline.js`

Local tests:
- `tests/onering-timeline.test.js`

## Safety Boundary

This package intentionally does not wire the primitives into:

- `Plugin/OneRing/OneRing.js`
- `modules/chatCompletionHandler.js`
- stream/non-stream handlers
- DB correction scheduling
- context patch runtime behavior

Reason:
- server-inferred restore changes message flow shape and injected context placement.
- the local OneRing backend is default-off and has recently added response-meta capture and timeline hash primitives.
- runtime wiring should land as a later, narrower package with handler/plugin integration tests.

## Validation Intent

Required validation for this package:

```powershell
node --check modules\oneringTimeline.js
node --test tests\onering-timeline.test.js tests\onering-parser.test.js tests\onering-fuzzy.test.js tests\onering-plugin-wrapper.test.js tests\onering-handler-wiring.test.js tests\onering-response-meta-capture.test.js
npm test
git diff --check
```

This validation does not enable OneRing runtime behavior or execute real bridge/shell/file external writes.
