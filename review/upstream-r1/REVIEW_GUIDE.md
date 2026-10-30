# Upstream Integration R1-B 审查入口

这是固定 Fork fef48db3 与固定官方上游 393dc5e4 的完整三方 merge 候选。分支 codex/upstream-box-r1-20261029。没有push、PR、远程CI或生产切换。

最终候选SHA、Tree、父提交和完整HANDOFF随交付包提供于本目录忽略的 delivery/。完整candidate.patch包含二进制和所有与固定Fork的差异；不需要执行机的安装目录即可独立应用并校验Tree。工作区路径本身不是跨机器源码交付；应取用最终ZIP及SHA256。

建议审查顺序：

1. delivery/HANDOFF.md 与 GIT.json：固定输入、实际合并边界和状态。
2. conflict-resolution.json：90个实际冲突（76个delete/modify、14个content/binary）及逐项选择。
3. upstream-exceptions.md：没有激活的上游执行入口/默认权限与原因；保留全部相应源码供review。
4. jenn-boundary-review.md、source-and-config-review.md：Jenn能力保护及来源边界。
5. validation-results.json、validation-commands.md、native-report.md：实际PASS/FAIL/BLOCKED/NOT_RUN及失败处理。
6. client-compatibility.md：DEPLOYMENT_COMPATIBILITY_BLOCKED。10个诊断测试PASS只是复现矩阵中的FAIL；不代表旧客户端通过。
7. checksums.sha256、docs/native-delivery-upstream-r1-linux.json：关键源码与原生payload一致性。

原始根回归/merge/diff输出以 regression-logs.tar.gz 原字节保留；原生构建/测试日志以 native-logs.tar.gz 保留；旧客户端14个实际模块以 client-source.tar.gz 原字节保留，并由provenance.json逐文件校验。无真实配置、私钥、凭据、记忆或数据库内容进入证据。

平台限制、现有CI receipt pin、已开始副作用的UNKNOWN处理和回退约束以最终HANDOFF为准。任何审查准备状态均不是APPROVED_FOR_MERGE。
