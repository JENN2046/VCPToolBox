# Upstream Absorb OneRing Response Meta Capture - 2026-06-08

本文件记录 `b3f5840c..0c841d2a` Oring 范围中的 handler
response-meta capture 小型吸收包。

本包不 raw-merge upstream handler / `chatCompletionHandler.js` 改动，只吸收
“在上游请求前冻结 OneRing 响应 meta，并让最终 assistant 记录优先使用该 meta”
这一条窄行为。

## 1. Scope

| Item | Value |
| --- | --- |
| Local branch | `codex/onering-upstream-20260608-preflight` |
| Upstream evidence | `d6e13b6b 优化Oring并发管线` |
| Local package type | narrow handler response-meta implementation |

## 2. Local Mapping

Changed local files:

```text
modules/chatCompletionHandler.js
modules/handlers/streamHandler.js
modules/handlers/nonStreamHandler.js
modules/oneringHandlerWiring.js
Plugin/OneRing/OneRing.js
tests/onering-response-meta-capture.test.js
tests/onering-plugin-wrapper.test.js
docs/governance/UPSTREAM_ABSORB_ONERING_RESPONSE_META_CAPTURE_20260608.md
```

Local behavior:

- `chatCompletionHandler` calls `OneRing.extractMetaFromMessages()` after final
  preprocessing / Role Divider and before upstream fetch;
- extractor failures are non-fatal and return `null`;
- frozen meta is placed on handler context as `oneRingResponseMeta`;
- stream and non-stream handlers pass the frozen meta into
  `dispatchOneRingAssistantRecordCandidate()`;
- wiring sanitizes the frozen meta to known fields before using it;
- when frozen meta exists, `recordAIResponse(meta, content)` is preferred over
  legacy `recordAIResponseFromMessages(messages, content)`;
- local `Plugin/OneRing/OneRing.js` exposes a side-effect-free
  `extractMetaFromMessages()` wrapper method;
- explicit handler hooks still remain highest priority.

## 3. Explicit Non-goals

This package does not:

- import upstream `Plugin/OneRing/OneRing.js` rewrite;
- import timeline modules;
- change `Plugin.js` preprocessor priority;
- change tool execution or handler dispatch semantics;
- change stream helper result shape;
- write real OneRing config or data;
- enable OneRing by default;
- add frontend UI or `AdminPanel-Vue/dist/*`.

## 4. Validation

Expected validation:

```powershell
node --check modules/chatCompletionHandler.js
node --check modules/oneringHandlerWiring.js
node --check modules/handlers/streamHandler.js
node --check modules/handlers/nonStreamHandler.js
node --check Plugin/OneRing/OneRing.js
node --check tests/onering-response-meta-capture.test.js
node --check tests/onering-plugin-wrapper.test.js
node --test tests/onering-response-meta-capture.test.js tests/onering-handler-wiring.test.js tests/stream-handler-result-shape.test.js tests/onering-plugin-wrapper.test.js
git diff --check
```

No service startup, upstream request, admin API call, SQLite runtime write,
frontend build, bridge action, deploy, or push is required.
