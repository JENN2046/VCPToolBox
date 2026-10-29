# 上游差异与隔离决策

完整 Git 三方合并以冻结 Fork 和固定 upstream 为父提交。下面是定向冲突/默认授权决策，不把这些差异冒称为已经激活的上游能力。原始冲突对象在 conflict-resolution.json，完整提交清单在 upstream-commits.txt。

| 上游变化 | 候选处理 | 原因/边界 |
|---|---|---|
| LinuxShellExecutor v2 entry, manifest, config, hosts, presets | 活跃入口及原有五份文件保持冻结 Fork；完整上游入口保存为 LinuxShellExecutor.upstream-v2.js.disabled，新增core源码保留 | 上游移除SandboxManager并改变超时、终端、广播、预设执行契约。默认不扩大执行权限；v2实际执行测试NOT_RUN。新共享SSHManager旧execute接口已静态核对；未执行SSH/真实命令。 |
| DeedPage manifest | .json.block | 不自动开放公开发布/删除网站能力；源码、依赖锁保留。未安装其可选发布依赖/使用凭据。 |
| VTrade manifest | .json.block | 不自动注册新服务/账本写入入口；全部上游模拟交易源码、测试保留，隔离测试通过。 |
| WeatherInfoNow .block→active | 维持.block | 不自动开放新增定时外访。 |
| WeatherReporter auto/UAPI + hourly cron | 默认qweather、原6小时cron；显式auto/uapi仍支持 | 防止现有和风配置失败时自动改发新外部服务。模板与manifest同源修正；缺省外访负向测试通过。 |
| LightMemo memory_ab compare_jev默认true | 默认false、显式true保留 | 不默认新增记忆内容模型发送。模板/manifest/实现同源测试通过。 |
| 新原生Jev HTTP路径 | 保留源码；修复只对Jev禁止环境代理、保留显式代理及普通Rerank既有政策；HTTP client cache区分策略 | 真实RAG绿道/并行调用绕过JS JevClient，必须保留Jenn直连语义。最终构建与测试见native-report.md。 |
| 上游Windows Vexus payload | 重命名.upstream-393dc5e.node.unverified；默认loader缺候选产物时报错 | 上游二进制没有合并Fork includePaths源码的本轮构建证明；不伪造Windows通过。其他未验证平台如实标注。 |
| AdminPanel-Vue tracked dist | 按上游停止跟踪，候选源码重建 | 构建产物本地保留且Git忽略；vue-tsc+vite build与80测试实际通过。ensure:admin --check-only通过。 |
| 批次/中文模型投影与旧结果回显 | 新协议完整保留；工具解析器只在顶层跳过结果区域，显式工具参数保持原文；roleDivider同时保护中文投影结果 | 文本边界只抑制解析，不验证来源、不授权执行。合法请求继续通过原授权链；未闭合结果区域保守保持字面。 |
| 流式/非流式不完整响应、断线 | 禁止分派尚未开始的工具及递归provider请求；清楚报告不完整、不提交成功 | 已开始的外部动作不能因断线倒推未执行；UNKNOWN不盲重试。 |
| 上游测试与Jenn审批拆分冲突 | AST fixture加载实际_settleApprovalResponse/Resident常量；保留可信审批包装器 | 没有删除测试或改宽权限换通过。初始失败/诊断及最终测试日志完整保留。 |

不另行导入其他本地候选或运行安装树里的未提交扩展；冻结Fork没有NativeSync/ChannelHub源码，不推定已包含或跨仓通过。没有新增全局ours/theirs策略或cherry-pick替代完整merge。
