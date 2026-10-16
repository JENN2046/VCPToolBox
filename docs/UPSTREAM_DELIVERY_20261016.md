# VCPToolBox source update — frozen 30193c89

Fork base: `d24edd7ed3f4f42fda5c23a3c02a6f0035161979` (`master`, including #289).
Author target: `30193c89249345479e03be6d4913c35d583df84e`.
Previous delivery comparison: `f66f2ede0b27f69116b1ed95736f3aea37be0f4c` (#283).
The original exact rebaseline is documented at `9deadda698eb87b4ee2aef5c27ea7c01e8970a02`.
The comparison contains 54 author commits; this is not a claim that fork history is linear with upstream.

## Resulting behavior

- Accept author changes to RiverMemo-only retrieval, chunk-index generational baselines,
  interaction completion, plugin command metadata, the admin panel and plugin sources.
- Keep the author `allowChainedCommandWhitelist` feature. It defaults to false;
  explicit true permits a matching command prefix to exempt the complete shell chain.
  This behavior was explicitly accepted for this source update. No runtime configuration is changed.
- Keep upstream CodeSearcher external-directory search, including absolute paths and
  relative parent traversal. Jenn explicitly accepted this changed boundary after the
  old confinement regression failed. This is not project-root confinement: it can read
  external files under the process account's permissions, with the retained sensitive
  configuration filter and approval policy. Native tests use only synthetic sibling
  directories to verify the new behavior and sensitive-file rejection.
- Preserve downstream Human authorization, Resident presentation, external-plugin admission,
  native broker transport, path-whitelist coverage, structural argument trimming,
  Jev proxy isolation, call-envelope limits and fail-closed registry rebuilding.
- Preserve indexed ownership of JEV control tags. An arbitrary `prefix:value` is not
  reinterpreted as another parameter's alias. A URL is not copied into both a primary
  text parameter and an explicitly declared URL parameter.
- Adapt the LightMemo compatibility wrapper to the new Memory A/B selector and Jev
  refinement, rejecting trace/Cold combinations before retrieval. Preserve the
  unscored candidate tail when the new LightMemo Jev scoring window is smaller than K.

## Source and state boundary

Configuration, credentials, authorization binaries, Agent/TVS personal content,
diaries, images and knowledge data retain their base Git identities. Their bodies
were not used for reconciliation. The one unchanged public source dependency
`TVStxt/JevToolCallDecision.txt` was admitted only after its fork and author object
identities matched. Admin dist is rebuilt from reviewed sources, not copied from
the author's compiled output. Changed native artifacts require locked-source builds.

No deployment, service restart, provider call, real data migration or configuration
activation is included. Source acceptance does not switch a running instance.

## Validation scope and remaining limits

The bounded runtime regression selection covers the existing safety and compatibility
contracts and the new ordinary-runtime tests. Separate negative tests cover schema
initialization without altering existing synthetic chunks, stale baseline replay,
slot rotation, failed publication and model mismatch.

Third-party JEV remains disabled by default. The author's new optional ecosystem,
chaos and stress suites contain unavailable distributed-plugin fixtures and some
declarations rejected by the retained stricter validator. They are not accepted as
activation evidence; their diagnostic failures must not be represented as passing.
This update does not relax declaration validation to make those optional examples callable.

The unchanged OpenHerPersona preprocessor suite can retain a live handle after
tests; it is reported separately, not counted as a successful full-repository run.
Admin unit-test diagnostics reproduce the same 16 test failures and three missing
helper-suite failures on the unmodified fork base. The candidate's eight added
admin tests pass. Admin typecheck and production build are independently required.

Native verification and hosted CI results are recorded in the PR as they complete.
Until all required native artifacts are rebuilt and checked, the PR remains draft.
DailyNoteSearcher Windows x64 and Linux x64 GNU/arm64 musl builds also run CLI and
loopback-only HTTP search, invalid-folder, instance-bound shutdown and graceful-exit
checks against temporary synthetic data, not real diaries or active services.
