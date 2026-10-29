# R1-C actual validation commands

Run from the candidate root. Counts overlap; do not add them into a unique test total. Native/Linux and Windows preparation commands are in windows-native.md; those raw logs are in native-logs.tar.gz. Other exact output is losslessly in regression-logs.tar.gz.

## upstream-daily-initial.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test tests/dailyNoteUpdateScope.test.js
```

PASS {"tests": 24, "pass": 24, "fail": 0, "skipped": 0}

## daily-boundary-before-fix.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test tests/dailyNoteBoundarySafety.test.cjs
```

FAIL_FIXED {"tests": 12, "pass": 2, "fail": 10, "skipped": 0}

Snapshot of 12 newly added tests before fixes; 10 failures preserved, later expanded to 16 new tests.

## daily-scope-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test tests/dailyNoteUpdateScope.test.js tests/dailyNoteBoundarySafety.test.cjs
```

PASS {"tests": 40, "pass": 40, "fail": 0, "skipped": 0}

## r1br-protocol-authority-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/upstreamR1Safety.test.cjs tests/toolResultBatch.test.js tests/toolBatchTimezone.test.js tests/toolBatchUpstreamProjection.test.js tests/roleDividerToolResults.test.js tests/oneRingUntriggeredPassthrough.test.js tests/memoryThinkingTray.test.js tests/approvalFeedbackPassthrough.test.js tests/suveiMutationApprovalResponse.test.js tests/websocket-message-diagnostics.test.cjs tests/humanAuthorizationKernel.test.cjs
```

PASS {"tests": 135, "pass": 135, "fail": 0, "skipped": 0}

## jenn-boundary-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/externalPluginAllowPolicy.test.js tests/externalPluginSafetyGate.test.js tests/plugin-external-runtime-registration-gate.test.js tests/plugin-external-runtime-direct-policy.test.js tests/plugin-external-runtime-env-sandbox.test.js tests/fileOperatorDirectoryPolicy.test.cjs tests/fileOperatorConfigCompatibility.test.cjs tests/linuxShellBubblewrap.test.cjs tests/residentHostContract.test.cjs tests/residentProviderPresenceContract.test.cjs tests/toolApprovalPathSafety.test.cjs tests/native-http-contract.test.cjs tests/native-websocket.test.cjs
```

PASS {"tests": 260, "pass": 249, "fail": 0, "skipped": 11}

## approval-config-jev-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test tests/toolApprovalManager.test.js tests/jevClient.test.js tests/jevToolCallExp.test.js
```

PASS {"tests": 72, "pass": 72, "fail": 0, "skipped": 0}

Merge: `git -c merge.conflictStyle=diff3 merge --no-commit --no-ff 8c714a06531880e4be1fc24e9c8a4188a0b92691`. Zero unmerged index paths. Final target preflight uses `git merge-tree --write-tree --messages <actual-target-SHA> <final-candidate-SHA>`; exact output is in delivery/GIT.json. Initial refs queried via `git ls-remote --symref origin HEAD refs/heads/master`; final refs are queried again before delivery. No mutable default branch is used as a frozen implementation input.
