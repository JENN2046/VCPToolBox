# Jenn boundary review — fixed upstream integration R1-B

Review date: 2026-10-29 (user date). This is source review and isolated regression evidence for the working candidate, not production or cross-repository acceptance. No production host, real config.env, database, memory, identity, cursor, or remote CI was accessed. Initial work was read-only; the parent subsequently authorized the narrow default-policy fixes below and this review artifact. No commit or push was performed by this reviewer.

## Fixed inputs and provenance

- Fork: `fef48db3e0bea997e99d7e7bd9c8551ae2ddb593`.
- Ancestor: `d9f61c0d0faedc62c6b0a6e9fc93151c51b1ad80`.
- Upstream: `393dc5e408f1dd521b4150946f77781ebabce399`.
- Candidate inspected: `/home/jenn/AGENTS_OS_Workspace/runtime/worktrees/upstream-box-r1-20261029`; its final SHA/tree is owned by the final HANDOFF.
- The original source checkout HEAD observed was `e2373b3ef922cdee9796d53638f035be3f01c893`, not the frozen Fork. All historical claims in this review use explicit Git object IDs, not that checkout HEAD and not a presumed production install.
- Read the required fixed-date VCP Foundation snapshot. Its design/historical assertions were not used as current deployment acceptance.

## Protected existing implementations

At the frozen Fork, these are actual source implementations, not inferred installed features:

| Boundary | Fixed-Fork evidence | Candidate observation |
| --- | --- | --- |
| External registration | `Plugin.js:619-704` checks explicit name/source policy, duplicate core/existing names, and blocks direct/hybrid except the exact admitted AGENTSOSResident case. `:824-840` gates registration before require/initialization. | These functions retain the frozen implementation; no global external/direct exemption was added. |
| External config/environment | `Plugin.js:302-329` denies external global-config fallback and selects host-owned registered-manifest config; `:424-426` selects isolated external env; `:2196-2207` denies admin credentials to external plugins. | Preserved; candidate line numbers for admin denial moved to ~2243 due to upstream feedback support. |
| Native JSO broker | `modules/nativeConversationTransport.js:20-24` private WeakMap admission; `:43-69` invocation-scoped broker, loopback endpoint binding, resource restrictions, native-only delegation and credentials outside tool JSON. `Plugin.js:2263-2266` injects broker handle then removes JSO_LOCAL_AGENT_TOKEN from child env. | Source modules unchanged; corresponding Plugin call sites preserved (~2307-2310). UNKNOWN returns remain UNKNOWN and no automatic target invocation retry is added. |
| Trusted approvals | `Plugin.js:2490-2516` authenticates SUVEI mutation decisions through the service, exact request/project/intent/revision/fingerprint/state; `modules/approvalReceiptAuthority.js`, `humanClientAdmission.js` retain object-identity admission and one-use lifecycle. | Upstream approval feedback is receipt presentation; it does not replace the existing trusted decision checks. |
| Trusted client profile | `modules/trustedClientImplementationProfile.js:10`: vcp_chat.c2 activation is PRODUCTION_DISABLED. | Unchanged. Synthetic tests do not activate the production profile. |
| Native routes/listen | Frozen `server.js:1249` registers native conversation route; `:1570` obtains localListenArguments. | Both preserved (~1254 and ~1575); upstream POST logging change does not alter route/socket authorization. |
| Resident proposals | Frozen `modules/vcpLoop/toolExecutor.js:222-225,460-475,500-505` passes presentation sink only for host-classified resident PROPOSE calls and classifies failures. | Preserved alongside upstream result-success/feedback changes. |
| FileOperator | `configurationLoader.js` preserves inherited/dotenv behavior but fails closed for ambiguous/failed directory config; `directoryPolicy.js:26-65` resolves real existing ancestors, checks lexical+real containment, and rejects path-verification errors. | Fork hardening remains. Real config was not read. Empty successfully parsed allowlist remains its original unrestricted policy, not newly broadened here. |
| agentManager | No diff from ancestor to Fork or ancestor to upstream. | No candidate diff. No new identity/agent routing mechanism was invented. |

`git diff fef48db3 --` was empty for nativeConversationTransport, nativeConversationWebSocket, approvalReceiptAuthority, trustedClientAuthorityStore, trustedClientImplementationProfile, humanClientAdmission, nativeManifestAuthority, externalPluginAllowPolicy, externalPluginHostConfig, externalPluginSafetyGate, toolApprovalManager and agentManager at review time.

## LinuxShellExecutor semantic conflict and disposition

The frozen Fork had restored special-operator guards, privilege preflight, interaction detection, enabled security layers and preset confirmation. It also had SandboxManager and standard/high/maximum sandbox execution (`fef48db3:Plugin/LinuxShellExecutor/LinuxShellExecutor.js:1837,2540-2549`). Upstream v2 deletes SandboxManager and removes sandbox from all levels (`393dc5e:...:1277-1282`), replacing execution with detach/PTY paths. Treating this as a routine text merge would silently remove existing isolation.

The parent retained the exact frozen entrypoint and manifest, and preserved upstream v2 as `Plugin/LinuxShellExecutor/LinuxShellExecutor.upstream-v2.js.disabled`, with new core sources kept for review. This review supports that targeted quarantine; v2 is not an activated tool entrypoint. The disabled source is a retained integration artifact, not a claim of v2 runtime acceptance.

Shared SSH compatibility was checked against both versions: `execute(hostId, command, options)` and the old result shape remain. Upstream changes queue keys only when options.terminalId is supplied (`modules/SSHManager/SSHManager.js:1205-1209`); frozen LinuxShell passes timeout/signal/usePool/queue settings without terminalId (`fef48db3:...:2524-2538`), so its host serialization contract remains. executeSSH itself is not rewritten by upstream. Connection retries occur before dispatch, not as automatic retries of an unknown executed command. This is static compatibility evidence; no real SSH connection or command was performed. SSHManagerService remains manifest-blocked; new terminal RPC methods must not be considered newly available to model tools.

## New plugin/default side-effect controls

The parent blocked discovery of DeedPage, VTrade and WeatherInfoNow using `.json.block` while keeping upstream sources/tests. DeedPage can publish/delete public websites without credentials for creation; VTrade is a direct hybridservice with local ledger writes and admin routes; WeatherInfoNow changed from blocked to active hourly execution upstream. None was automatically authorized as a newly active tool/service by this task. MemoryThinkingTray is pure message preprocessing and remains integrated; its semantic interaction with OneRing is covered by the main protocol review, not asserted by this boundary report.

This reviewer applied the following narrow default fixes:

1. `Plugin/WeatherReporter/weather-reporter.js:467,556`: provider fallback is qweather, preserving the existing provider boundary. Explicit auto/uapi still supports the new source. Manifest default, `config.env.example` and README agree. Cron remains frozen `0 */6 * * *` instead of upstream hourly. The upstream 3-hour freshness contract is retained; a 6-hour schedule can therefore show unavailable between fresh periods. This is disclosed, not stale-cache success. Existing real config files were neither read nor modified; an already explicit provider selection still takes precedence.
2. `Plugin/LightMemo/nativeQuery.js:125`: compare_jev/compareJev defaults false for laboratory queries. Explicit true still invokes the full shared-pool Jev comparison. Manifest and config example document the opt-in. Existing compare_rerank behavior and ordinary-search explicit jev behavior stay intact. This avoids silently sending the bounded memory pool to a newly enabled comparison provider.
3. Existing WeatherReporter tests now stub dotenv only during module import, preventing real config reads. Minimal regression cases prove absent provider+credentials rejects before UAPI/cache fallback and laboratory default/false does not invoke Jev while explicit true/alias does; candidate objects are copied rather than contaminated with external scores.

## Absent and cross-repository capability limits

- NativeSync and ChannelHub: `git grep -i NativeSync|ChannelHub fef48db3` over the fixed tracked tree (excluding env/large vendored source) found no implementation references. No NativeSync or ChannelHub host implementation/acceptance can be claimed from this frozen tree. No other installation or candidate was inspected to import those claims. Their cross-repository contract tests are NOT_RUN here.
- Trusted Action v1 and native conversation HTTP/WS are present in the frozen Fork, as above. That does not imply NativeSync or ChannelHub compatibility.
- JSO: this Fork contains transport/broker contracts and a candidate paired workflow; the application/adapter acceptance belongs to the external pinned components. The actual frozen `.github/workflows/jso-agent-paired-candidate.yml` uses `a6c7d447ddaa29799c60aa109d5119b102d1eae4`; TRUSTED_ACTION_V1.md still mentions historical `77e89fae03202a3d861d6f3e78c8a06666df304d`. This pre-existing evidence-pin discrepancy was recorded rather than silently fixed or treated as passing evidence. Remote CI and full JSO/VCPChat/Extensions paired run: NOT_RUN.
- VCPChat protocol parsing, history recovery and current real rendering: main reviewer owns the isolated compatibility investigation. This report makes no cross-version deployment claim.

## Executed isolated tests

Runtime: Node v22.23.1. Commands ran in the candidate with an empty inherited environment plus PATH and synthetic HOME, without starting a production server or using real credentials. Loopback test servers and temporary fixtures only.

```sh
env -i PATH=/usr/bin:/bin HOME=/tmp node --test Plugin/WeatherReporter/weather-reporter.test.js tests/lightMemoABDiagnostics.test.js tests/linuxShellBubblewrap.test.cjs tests/fileOperatorDirectoryPolicy.test.cjs tests/fileOperatorConfigCompatibility.test.cjs tests/humanAuthorizationKernel.test.cjs tests/externalPluginAllowPolicy.test.js tests/externalPluginSafetyGate.test.js > review/upstream-r1/jenn-boundary-tests.log 2>&1
```

PASS: 131; FAIL: 0; NOT_RUN: 7 opt-in real bubblewrap smoke cases. Those seven are explicitly marked SKIP/NOT RUN by the existing suite and are not counted as passing Linux sandbox execution. The existing synthetic sandbox argument/cancellation/resource checks ran. No claim of actual OS bubblewrap acceptance is made here.

```sh
env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/plugin-external-runtime-registration-gate.test.js tests/plugin-external-runtime-direct-policy.test.js tests/plugin-external-runtime-env-sandbox.test.js tests/native-conversation-context.test.cjs tests/native-websocket.test.cjs tests/native-websocket-connection.test.cjs tests/native-transport-diagnostics.test.cjs > review/upstream-r1/jenn-runtime-contract-tests.log 2>&1
```

PASS: 190; FAIL: 0; SKIP: 0. This covers registration denial, direct/hybrid policy, external runtime env, forged native context, source/plan connection binding, socket provenance, transport errors/redaction and native-only broker behavior using synthetic keys/credentials and local sockets. It is not production enrollment, TLS topology, real application authentication, or cross-repository acceptance.

`git diff --check` over reviewer-edited source/test/docs files: PASS at review completion. No new test framework or dependency was added.

## Review result and remaining limits

The concrete sandbox regression and new default execution/provider exposures identified in this review have targeted candidate dispositions above. This report is evidence for independent review; it grants no merge/deployment approval. Actual sandbox smoke, remote SSH, NativeSync/ChannelHub, external JSO application paired acceptance, production permissions and configured runtime plugin inventory remain outside this executed evidence. Main HANDOFF must preserve those statuses and separately report any VCPChat deployment compatibility block.


## Supplemental protocol/parser review — same candidate, subsequent root fixes

The parent requested a read-only review of result-literal suppression and the incomplete-response/connection-close dispatch guards. Three concrete issues were reproduced with pure parser/handler fixtures, then the parent corrected them in the working candidate:

1. **Projected batch echo**: the initial stripResultLiterals implementation recognized English wire boundaries but not the Chinese model-visible `【工具返回批次开始｜时间：…】` projection. A batch containing a request parsed zero calls before projection and one after projection. Current `findNextResultLiteral` recognizes the timestamp-paired Chinese form; repeat check parses zero.
2. **Legitimate argument corruption**: globally stripping result literals before request parsing silently removed batch text from a legitimate FileOperator WriteFile `content:「始ESCAPE」…「末ESCAPE」` field while retaining an executable request. Current parser compares the next top-level request and literal positions, takes the earlier construct, and parses a request block intact. A comparison against the frozen fef48db3 parser now produces identical payload output for the fixture, including its pre-existing edge-whitespace trimming. Normal requests still parse once. Result-like argument text is not deleted by this new protection.
3. **Disconnect during archery**: the initial handler guard ran only at the start of a loop. A mixed archery+normal fixture closed/destroyed the client and aborted during await of archery, after which both handlers still dispatched one normal call. Parent added checks after awaited archery, before ordinary dispatch and before provider recursion. Repeat fixture on both handlers now observes normal executions after close=0 and provider requests after close=0.

The current parser boundaries are suppression syntax, not credentials. Forging a batch/raw-payload delimiter can suppress parsing but cannot manufacture trusted transport, an approval receipt, target permission, or a tool execution grant. Arbitrary model text without recognizable retained result framing remains subject to the existing model/tool authorization path; these text rules are not a general provenance guarantee. Original source/history strings are not rewritten by parser recognition. Already-dispatched work cannot be made unexecuted by a later socket close, and this check does not claim that guarantee.

Verified locally after these corrections:

- Pure parser comparison: projected echo=0 calls, ordinary request=1 call, ESCAPE payload equals fixed-Fork parser output.
- Pure handler fixtures: stream=false and stream=true both have zero normal dispatches and zero provider requests after the archery-induced close/abort.
- `env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/upstreamR1Safety.test.cjs`: PASS 16, FAIL 0, SKIP 0 at this review snapshot. The root may subsequently extend this file; these counts describe the executed snapshot only. It checks retained/restored literal text, ordinary requests outside literals, truncated upstream response suppression, normal/archery HTTP 502/504 error forwarding, provider-only retries, and abort-before-fetch.

The incomplete-turn checks preserve the existing completeness predicates: non-stream requires successful parsed response with visible content and finish_reason=stop; stream accepts a stop marker or compatible DONE-only completion and rejects invalid payload/abort. The added guards are appropriate to prevent a syntactically complete prefix from becoming an execution acceptance point. No additional unresolved critical defect was identified in this focused supplemental review. Full protocol compatibility and deployment acceptance remain the main HANDOFF's responsibility.


### Final focused recheck after regression cases were added

Re-read the final top-level literal scanner and both handlers' guards after archery completion, ordinary executeAll completion and before recursive provider fetch. The earlier three defects have explicit regression coverage in the expanded `tests/upstreamR1Safety.test.cjs`: Chinese projected result suppression, complete ESCAPE argument retention, and both handler modes closing before-response/during-archery/during-normal. A new non-stream truncated-finish regression is also present.

Independently reran `env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/upstreamR1Safety.test.cjs`: **PASS 25, FAIL 0, SKIP 0**. This supersedes the prior 16-case count for this file. No unresolved critical gap was found in the requested focused recheck. The root's separate 110-case protocol/approval run was reported by the root and is not counted as independently rerun here. No source code or commit was changed by this final recheck; only this review note was appended.


### Shared projected-boundary scanner recheck

Reviewed `toolResultBatch.createBatchStartScanner(includeProjected = false)`, `findBatchEnd`, and the parser/roleDivider opt-in callers. Default raw-only scanning and projection remain unchanged; parser and role-divider now share timestamp pairing for Chinese projected batches. Independently ran the expanded safety suite: PASS 26, FAIL 0, SKIP 0. The added role-tag test proves ordinary projected payload tags stay literal.

A further adversarial fixture identified a projected-delimiter collision in generated output: the formatter checked collisions with raw START/END but not their Chinese projected counterparts. With a fixed synthetic clock, a payload containing the identical projected END timestamp prematurely closed literal protection after projection; its remaining request parsed once and role-divider produced a system fragment. This is not authorization evidence, but violates the intended literal handling. Reported to root with the minimal fix: include matching Chinese START/END in the same timestamp collision-avoidance loop and add the synthetic-clock regression. No code changed by this reviewer. This finding remains pending until a later note explicitly records its verification.


### Projected-delimiter collision resolved — final requested check

The formatter now rejects a proposed timestamp if its payload contains any of the four exact delimiters: raw START, raw END, projected Chinese START, or projected Chinese END. Its existing monotonic timestamp loop advances until all four are absent, without replacing payload bytes. Reviewed the two added collision checks and the independent VM/2099 synthetic-clock case exercising actual formatter → projection → parser and roleDivider. The fixture now yields no executable request, no system role, and retains the payload substring byte-for-byte.

Independently reran `env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/upstreamR1Safety.test.cjs`: **PASS 27, FAIL 0, SKIP 0**. This supersedes the 26-case snapshot above and closes that snapshot's pending projected-delimiter collision finding. The root's 112-case aggregate is separate reported evidence; this reviewer independently reran only the requested 27-case suite for this final change. No further source change was made or requested by this focused review.
