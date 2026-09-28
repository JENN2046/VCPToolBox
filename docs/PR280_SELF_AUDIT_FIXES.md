# PR #280 self-audit fixes

Scope: six findings against `9bda49d89b4cc973868999a23904546e51807954`.

| Finding | Resolution |
| --- | --- |
| ComfyUI specialized snapshots exposed sensitive widget values | Redact by widget/node identity and nested field names in the MAIN bridge and consuming adapter. Omit sensitive options, restrict action result fields, and block sensitive-widget actions. Ordinary widgets remain usable. |
| Doubao output format could become a relative output path | Allow only png/jpeg/jpg/webp, validate again at persistence, constrain paths to the image directory, and use exclusive creation. |
| TransBase64+ missed media produced by Capture | Back up immediately before the selected media processor and restore only missing media, including failure/no-op handling. |
| Responses reasoning snapshots were appended as deltas | Distinguish message snapshots from deltas. Buffer snapshot revisions until completion; the done/completed summary is authoritative. Pure delta streams continue streaming. |
| Jev rerank permanently discarded candidates outside its choice window | Append the unscored tail in retrieval order after scoring/RRF, then apply the requested result limit. |
| Jev errors carried raw upstream/transport content | Expose status, retryability and fixed errors without upstream bodies, transport messages or raw Axios/proxy causes. |

## Validation

Run locally on Windows with explicit approval for an isolated-test exception:

```sh
node --test tests/pr280SelfAudit.test.cjs tests/protocolBridgeResponses.test.js tests/jevClient.test.js tests/jevToolCallExp.test.js tests/jevRiverRerank.test.js tests/upstreamDeliveryReviewFixes.test.cjs tests/chromeBridge/runtime-core-test.js tests/chromeBridge/page-runtime-handle-test.js tests/chromeBridge/page-runtime-image-test.js tests/chromeBridge/contenteditable-reply-editor-test.js
```

Result: 93 tests passed, zero failures or skips. New regressions cover synthetic
sensitive values, POSIX and Windows path semantics, captured media, no-op/failing
media processors, repeated/growing/revised/empty reasoning snapshots, encrypted-only
follow-ups, mixed deltas/snapshots, RRF and requests exceeding the 255-choice ceiling.

The tests use synthetic fixtures, mocked providers and loopback-only protocol
servers. No production service, private store or live provider is involved.
This is not a full deployment or Linux business-path acceptance test. Native
Linux CI status is reported separately on the PR; native artifacts and workflows
are unchanged by these fixes.
