# VCPToolBox Upstream R1-B 独立审查回执

**审查日期：** 2026-10-29  
**提交候选（待在原始 Git 仓中独立核验）：** `73924de991d344d8fdac6c01266c6a2d8825f894`  
**报告候选 Tree：** `11d7ad7afe06d49432734b23deba9849ee27a383`  
**输入：** 用户提交的 `HANDOFF.md` 和 `VCPToolBox-Upstream-R1-B-review.zip`  
**裁决：** `INDEPENDENT_REVIEW_CONDITIONAL_ACCEPT / APPROVED_FOR_MERGE=NO / DEPLOYMENT_COMPATIBILITY_BLOCKED`

## 1. 我独立核实的项目

- ZIP CRC 正常；归档中五份带摘要的文件与 `SHA256SUMS` 一致。
- `candidate.patch` SHA256=`c6061655e024f2fdd1ed675f617df2945f274617d8ac95e72e5023e550b9fb4e`，涉及 602 个 Git diff 文件条目。
- 原始 `conflict-stages.txt` 有 90 个不同待解决路径；JSON 清单也有 90 项：76 个 delete/modify 和 14 个 content/binary。日志中的额外 rename/delete 行不能累加为新的 75 项未解冲突。
- 从 patch 独立恢复的新增模块 `modules/toolResultBatch.js` SHA256=`70fb62ee19d21e072ce4329e7970d695c27ec750e99c896b1199ee2f2534e35f`，与源码清单一致；独立 Node.js 抽测时区格式、模型可见投影和工具请求原文保留通过。
- 从 Git binary patch 的 literal 块**独立解码**：DailyNoteSearcher Linux SHA256=`a4e87a6ad29d3e15eeacaa7914a4e41b30e9b8b6146f8bc8f89094ef82a14a79`；被隔离 Windows Vexus SHA256=`f3da3b501504bb77d667e007dc4fb0b7c81e9fb2958df5a535d5f16694e3956e`；与申报值及 Git blob 元信息一致。这仅验证载荷字节，不证明其运行通过。
- 原始日志含协议 `112/112`、Fork 宿主 `289 PASS / 8 SKIP`、Rust `191/191`、Linux pinned 构建 `BUILD_1_SHA256 = BUILD_2_SHA256 = d114ffd7b0cb6bb51ede252d2a9e7d027b2068b04b12d31eab5f7187e85da26d`。这是独立查验**日志证据内容**，不是我在本机重新运行这些完整构建/测试。

## 2. 需要处理的实质问题

### P1：人工审核“静默拒绝”语义被改变

`Plugin.js` 的候选补丁使 `notifyAiOnReject === false` 时，若审核人填写非空 `reason`，原本隐匿于 AI 的理由现在作为 `user_feedback` 向 AI 透传。`docs/TOOL_APPROVAL_REASON_PROTOCOL.md` 明确把旧语义改成“填写原因表示希望向 AI 反馈”；新增测试也按新行为编写并通过。

这属于治理与隐私语义变化，**不是普通合并冲突**。在 Jenn 现有授权边界下，不能仅因为测试通过就认定该变化已获授权。建议默认保留原静默语义，仅在审核人或受信 UI 明确选择“将此留言发送给 AI”时传播；并补充批准留言、拒绝留言、静默拒绝、无留言、敏感内容过滤及 Trusted Action 不越权的正反测试。若产品负责人决定采纳上游新默认行为，应有单独明确裁决和 UI 告知。

### P1：跨版本客户端与 Windows 仍阻塞

`client-compatibility-evidence.json` 报告旧客户端新 batch 外壳残留、未闭合批次渲染、伪造批次边界误分类及角色标记展示隔离失败。测试进程 10 PASS 是“预期失败的诊断断言通过”，不是兼容通过。实际 Electron DOM、磁盘持久化与重启未执行。

所用旧本地客户端 HEAD `1f86d591...`，不是审查时 Jenn VCPChat 远端默认分支 HEAD `ff4c05b1...`，因此该测试只证明所冻本地旧客户端存在不兼容，不代表远端最新客户端也经过同样验收。

Windows 合并源码版 Vexus 未构建；默认 Windows x64 loader 在缺候选构建时明确拒绝，不能认为现有 Windows 使用能力保持正常。暂不批准跨版本部署与生产替换。

### P2：合并候选的原始 Git 对象/当前整合目标仍需确认

ZIP 给出了补丁、自报的双父 SHA 和独立 index 回放通过记录，但不包含可由本审查环境直接验证的 Merge Commit 对象或冻结 Fork 全量 Git 对象。候选提交 SHA/Tree 的完整重演留给有原仓 Git 对象的受控环境。该交付还指出实际本地 master 为 `e2373b3...` 而非固定 Fork 输入 `fef48db3...`；在未来合并前，必须对**实际目标分支 HEAD**另行执行一次无写入验证，不能假设不存在新冲突。

### 设计例外：保留而不激活的上游能力

LinuxShellExecutor v2 以 `.upstream-v2.js.disabled` 保留，上游脚本去沙箱等行为未激活；DeedPage/VTrade/WeatherInfoNow 仍为 `.block`；WeatherReporter 默认 qweather 和六小时 cron 保持 Jenn 旧策略。这些取舍已披露，不能把“上游提交完整继承”误写成“上游全部能力已启用”。

## 3. 后续限域收口任务

让现有 Codex 在**同一隔离候选工作树**完成最窄修补：

1. 给人工审核留言传播增加明确的受信授权/显式 opt-in，或提交产品负责人确认新语义的正式裁决；默认不得自行削弱静默拒绝边界。
2. 重跑审批+ToolExecutor+Trusted Action 相关回归，并追加正反测试，给出新本地提交 SHA、Tree SHA、补丁和新旧行为矩阵。
3. 从原始候选本地仓库核对 merge 双父与 tree，并在当前目标 master 的镜像/隔离工作树中只做合并可行性预演；不得改 master。
4. 保持新 Box 协议源码，不为旧 Chat 回退协议；保留 `DEPLOYMENT_COMPATIBILITY_BLOCKED`，后续另起 VCPChat 定向兼容施工。Windows 原生构建/运行保留单独阻塞，不以 Linux 代替。

**禁止推送、创建 PR、部署、改生产、替换运行安装及修改 NativeSync/ChannelHub 状态。**

## 4. 最终状态

- `INDEPENDENT_REVIEW_CONDITIONAL_ACCEPT`：审查资料完整且有较强隔离集成证据，允许做限域收口。
- `APPROVED_FOR_MERGE = NO`：尚未完成授权语义裁决及提交/目标分支独立核验。
- `DEPLOYMENT_COMPATIBILITY_BLOCKED`：旧客户端和 Windows 构建未通过。
- 不将原始日志 PASS、模拟测试 PASS 或已报道的可复现双构建扩大解释为生产验收。
