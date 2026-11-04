# ChannelHub callback ownership

`POST /plugin-callback/ChannelHub/events` belongs to the ChannelHub service.
The generic asynchronous-task callback is registered earlier in `server.js`,
so it must call `next()` for this reserved plugin/task pair before creating
the results directory, writing a task result, or broadcasting a callback.
The service then applies its own adapter authentication and event validation.
If the service is absent or rejects the request, that outcome remains final.

The reservation matches Express's default case-insensitive routing. Case
variants cannot enter generic result storage. Decoded reserved parameters also
yield to later routing; if no service route matches the original URL, the
request ends as 404. Other plugins' `events` tasks and ChannelHub's ordinary
task IDs retain their existing result-file, WebSocket and acknowledgement flow.

Run the focused regression with the host's locked dependencies:

```sh
node --test tests/plugin-callback-routing.test.cjs
```

It extracts the actual native registration, uses the real Express router in
native startup order, and keeps result storage and broadcasts in memory.
Its synthetic service guard covers rejection, success, absent/unavailable
service, case and encoded aliases, and legacy callbacks. It does not start
the complete server or contact a model/channel provider; full ChannelHub
protocol and lifecycle acceptance is a separate isolated integration check.
