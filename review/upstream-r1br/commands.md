# R1-BR 实际验证命令

在现有候选根目录执行；多组有重叠，不能相加成唯一测试总数。原始输出无损保存在 logs.tar.gz。

## approval-trusted-tests-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/approvalFeedbackPassthrough.test.js tests/suveiMutationApprovalResponse.test.js tests/websocket-message-diagnostics.test.cjs tests/humanAuthorizationKernel.test.cjs
```

PASS {"tests": 40, "pass": 40, "fail": 0, "skipped": 0}

## protocol-approval-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/upstreamR1Safety.test.cjs tests/toolResultBatch.test.js tests/toolBatchTimezone.test.js tests/toolBatchUpstreamProjection.test.js tests/roleDividerToolResults.test.js tests/oneRingUntriggeredPassthrough.test.js tests/memoryThinkingTray.test.js tests/approvalFeedbackPassthrough.test.js tests/suveiMutationApprovalResponse.test.js tests/websocket-message-diagnostics.test.cjs tests/humanAuthorizationKernel.test.cjs
```

PASS {"tests": 135, "pass": 135, "fail": 0, "skipped": 0}

## authority-regression-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test --require ./tests/fixtures/offlineRegressionSetup.cjs tests/toolApprovalPathSafety.test.cjs tests/residentHostContract.test.cjs tests/residentProviderPresenceContract.test.cjs tests/native-http-contract.test.cjs tests/native-websocket.test.cjs tests/native-websocket-connection.test.cjs tests/native-transport-diagnostics.test.cjs tests/rebaselineMigrationMatrix.test.cjs tests/pr280SelfAudit.test.cjs tests/pr282AdminReview.test.cjs
```

PASS {"tests": 221, "pass": 217, "fail": 0, "skipped": 4}

Skipped tests are NOT_RUN.

## approval-config-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --test tests/toolApprovalManager.test.js
```

PASS {"tests": 20, "pass": 20, "fail": 0, "skipped": 0}

## old-client-diagnostic-final.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node --experimental-vm-modules --test tests/upstreamR1ClientCompatibility.test.cjs
```

PASS {"tests": 10, "pass": 10, "fail": 0, "skipped": 0}

Diagnostic PASS reproduces existing old-client incompatibility FAIL, not compatibility acceptance.

## native-unchanged-smoke.txt

```sh
env -i PATH="$PATH" LANG=C.UTF-8 node scripts/check-vexus-linux-native-abi.js
```

PASS {}

原始候选对象：`git cat-file commit 73924de991d344d8fdac6c01266c6a2d8825f894`；`git hash-object -t commit review/upstream-r1br/original-merge.commit`；原始完整patch在一次性GIT_INDEX_FILE中以`git read-tree fef48db3...`、`git apply --cached --binary candidate.patch`、`git write-tree`再次回演，记录在original-object-verification.json。

目标快照来自`git ls-remote --symref origin HEAD refs/heads/master`，远端Chat仅`git ls-remote --symref https://github.com/JENN2046/VCPChat.git HEAD`。合并预演使用`git merge-tree --write-tree --messages <exact-target-SHA> <candidate-SHA>`，不更改任何分支、index、worktree或运行态。最终候选预演详细结果随delivery/GIT.json提供。
