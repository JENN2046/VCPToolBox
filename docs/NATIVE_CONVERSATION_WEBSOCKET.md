# Native conversation over the existing distributed connection

Opt-in desktop binding uses `transport: "vcp-websocket"`; ordinary distributed tools and HTTP native routes keep their existing contracts. The desktop must use WSS remotely (loopback WS is allowed for isolated tests). Do not expose `/v1/native-conversation` or JSO `/api/v2/agent` through a public HTTP proxy.

`native_conversation_request` and `native_conversation_response` are private transport frames, not registered model tools. Requests originate after the existing Electron main-process input and presentation checks. Shared VCP connection authentication does not replace the existing JSO owner verification; the owner credential is retained by the hosts and never passed to stdio tool arguments. Native frames bypass generic logs/evidence capture.

Each desktop profile needs a distinct, stable, non-secret `clientInstanceId` UUID in its binding. It locates the owner-scoped durable recovery journal; it grants no permissions. Reconnecting changes the confirmation conversation epoch, so old prepared sources and displayed plans cannot execute. Recovery only reconciles original operation IDs and projects stored facts. It never resends an execute request. An unavailable or expired owner credential fails closed.

The local synthetic integration and isolated proxy rules are validation evidence, not a claim of remote deployment or genuine human confirmation. No SSH lifecycle or additional identity service is required.

## Paired synthetic regression

With Node >=24.16 (JSO native SQLite requirement) and the existing dependencies installed, run:

```sh
JSO_SOURCE=/path/to/jso JSO_CHAT_SOURCE=/path/to/chat JSO_EXTENSIONS_ROOT=/path/to/extensions node --test tests/native-ws-paired.test.cjs
```

This starts isolated loopback servers and temporary synthetic data, uses the actual WebSocketServer, host broker, stdio plugin, JSO composition and ChartService, and removes its temporary state afterward. It uses a minimal plugin-manager harness and synthetic prepare/present/confirm messages; it does not launch Electron, call a model, or prove human physical input. Initial query/setup and authoritative readback use JSO HTTP; native proposals, confirmations and recovery use WS with HTTP fallback forbidden. It covers an unshown plan, cancellation/edit invalidation, separate client journals, invalid application identity, committed response loss, no repeated writes, and explicit snapshot start/end/revisions. IPC physical-source and slow-response behavior are separately tested in VCPChat.
