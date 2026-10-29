# Actual validation commands

All paths below are relative to the candidate root. Counts in `validation-results.json` are per invocation and overlap; do not add them into a unique test count. Native final-source commands and archived raw logs are in `native-report.md`.

## protocol-tests-final.txt

```sh
node --test tests/upstreamR1Safety.test.cjs tests/toolResultBatch.test.js tests/toolBatchTimezone.test.js tests/toolBatchUpstreamProjection.test.js tests/roleDividerToolResults.test.js tests/oneRingUntriggeredPassthrough.test.js tests/memoryThinkingTray.test.js tests/approvalFeedbackPassthrough.test.js
```

PASS {"tests": 112, "pass": 112, "fail": 0, "skipped": 0}

## approval-tests.txt

```sh
node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/approvalFeedbackPassthrough.test.js tests/suveiMutationApprovalResponse.test.js
```

PASS {"tests": 22, "pass": 22, "fail": 0, "skipped": 0}

## approval-config-tests.txt

```sh
node --test tests/toolApprovalManager.test.js
```

PASS {"tests": 20, "pass": 20, "fail": 0, "skipped": 0}

## jev-core-tests.txt

```sh
node --test tests/jevClient.test.js tests/jevToolCallExp.test.js
```

PASS {"tests": 52, "pass": 52, "fail": 0, "skipped": 0}

## jev-extended-regression.txt

```sh
env -u JEV_API_KEY -u JEV_API_URL -u JEV_PROVIDER -u JEV_MODEL node --test tests/jevThirdPartyPolicy.test.js tests/jevThirdPartyRegistry.test.js tests/jevThirdPartyEcosystem.test.js tests/jevStressAndChaosMatrix.test.js tests/jevRedTeamChaosExams.test.js
```

PASS {"tests": 222, "pass": 159, "fail": 0, "skipped": 63} — Skipped entries are NOT_RUN, never PASS.

## fork-guards-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/humanAuthorizationKernel.test.cjs tests/toolApprovalPathSafety.test.cjs tests/residentHostContract.test.cjs tests/residentProviderPresenceContract.test.cjs tests/suveiMutationApprovalResponse.test.js tests/nativeDeliveryProvenance.test.cjs tests/pr280SelfAudit.test.cjs tests/pr282AdminReview.test.cjs tests/upstreamDeliveryReviewFixes.test.cjs tests/rebaselineMigrationMatrix.test.cjs tests/native-http-contract.test.cjs tests/native-conversation-context.test.cjs tests/native-websocket.test.cjs tests/native-websocket-connection.test.cjs tests/native-transport-diagnostics.test.cjs tests/native-ws-paired.test.cjs tests/local-listen-options.test.cjs tests/self-proxy-loopback.test.cjs tests/websocket-message-diagnostics.test.cjs tests/external-native-host-config.test.cjs tests/external-native-host-config-exit.test.cjs
```

PASS {"tests": 297, "pass": 289, "fail": 0, "skipped": 8} — Skipped entries are NOT_RUN, never PASS.

## memory-regressions.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --test-concurrency=1 --test-timeout=30000 --require ./tests/fixtures/offlineRegressionSetup.cjs tests/abiV2ReviewRegression.test.js tests/adminRagMaintenanceRoutes.test.js tests/agentAssistantFlowlockProtocol.test.js tests/ragGreenLane.test.js tests/ragJevModifiers.test.js tests/ragDiaryCopyOnWrite.test.js tests/ragRefreshSystemBoundary.test.js tests/ragNativeChainAudit.test.js tests/riverThinkingMeta.test.js tests/textChunker.test.js tests/vcpTimelinePlaceholders.test.js tests/oneRingTemporaryContract.test.js tests/jevContextPrune.test.js tests/jevFoldFilter.test.js tests/jevRiverRerank.test.js tests/kbmAuditRegression.test.js tests/kbmConfigurationCompatibility.test.js tests/kbmDeadCodeCleanup.test.js tests/kbmNativeKnnProxy.test.js tests/kbmNativeLifecycle.test.js tests/kbmOfflineWriteSafety.test.js tests/kbmPrecommitSnapshotDiagnostics.test.js tests/kbmTaskDrain.test.js tests/kbmWatcherBackpressure.test.js tests/kbmWatcherReconciliation.test.js tests/timelineRiverMemo.test.js tests/associativeDiscoveryRiverMemo.test.js tests/resultDeduplicator.test.js tests/resultDeduplicatorBounds.test.js tests/diaryIndexAtomicDelta.test.js tests/tagIndexGenerationalBaseline.test.js tests/tagConsistencyIncrementalIndex.test.js tests/chunkIndexGenerationalBaseline.test.cjs tests/nativeRiverDefaultMode.test.js tests/nativeRiverQueryFallback.test.js tests/nativeSemanticDeduplication.test.js
```

PASS {"tests": 194, "pass": 194, "fail": 0, "skipped": 0}

## client-compatibility-final.txt

```sh
node --experimental-vm-modules --test tests/upstreamR1ClientCompatibility.test.cjs
```

PASS {"tests": 10, "pass": 10, "fail": 0, "skipped": 0} — Probe PASS reproduces a compatibility matrix with FAIL. DEPLOYMENT_COMPATIBILITY_BLOCKED.

## vtrade-tests.txt

```sh
cd Plugin/VTrade && env -i PATH="$PATH" LANG=C.UTF-8 npm test
```

PASS {"tests": 112, "pass": 112, "fail": 0, "skipped": 0}

## admin-tests.txt

```sh
cd AdminPanel-Vue && npm test
```

PASS {}

## admin-build.txt

```sh
cd AdminPanel-Vue && npm run build
```

PASS {}

## npm-ci.txt

```sh
npm ci --ignore-scripts --no-audit --no-fund
```

PASS {}

## admin-npm-ci.txt

```sh
cd AdminPanel-Vue && npm ci --ignore-scripts --no-audit --no-fund
```

PASS {}

## sqlite-build.txt

```sh
npm rebuild better-sqlite3
```

PASS {}

## Earlier failures and how they were handled

- `protocol-tests.txt`: 80 PASS / 5 FAIL. Upstream AST fixture omitted Jenn `_settleApprovalResponse` and Resident constant. Fixture now loads actual helper/constant; authorization code was preserved. `approval-fixture-debug.txt` preserves the intermediate fixture diagnosis; final combined protocol/approval run is authoritative.
- `fork-guards.txt`: 293 PASS / 16 FAIL / 8 NOT_RUN. The opt-in preload replaced `loadConfig`, which prevented the explicit synthetic config suite from loading its own temporary JSON. That suite passed all 20 tests without this unrelated preload; the other 297 guarded tests ran separately (289 PASS / 8 NOT_RUN). No production configuration or permission code was changed to satisfy these assertions.
- `result-replay-before.txt`: a batch-embedded request was parsed as one call before the parser fix. The current negative suite asserts zero, preserves legitimate literal arguments, and tests incomplete/disconnected responses.
- Native initial parallel timing and quality-fixture failures, rebuilds, provenance, and platform limits are recorded in `native-report.md`; original logs are preserved.
- Full source `git diff --check` reports inherited upstream CRLF/trailing whitespace (see `source-whitespace-diagnostics.txt`); not treated as a functional test pass and not silently erased by reformatting the upstream merge.
