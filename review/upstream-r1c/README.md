# VCP Upstream Integration R1-C

唯一实施仓库JENN2046/VCPToolBox。新工作树从554a02a9建立，真实merge固定8c714a（包含393之后且仅含6d7870f、8c714a两个新增提交）。原R1-B/R1-BR工作树保留。原始Git对象/父提交/Tree已核对；本轮无文本或删除修改冲突。固定输入见frozen-inputs.json，原始merge日志在regression-logs.tar.gz。

## 增量与限域语义修复

上游DailyNote新增显式作者/目录范围、无全库回退、fileName片段缩小、跨文件和文件内唯一匹配、宽松匹配回原始区间及扫描失败拒绝写入，完整保留。README吸收8c714a删除两张展示图，当前README与固定上游字节相同，未做其他文档重排。

新增负向检查发现并修复：

- nova不再向novax命名空间回退；公共范围不包含名为公共Alice的主体目录。使用明确作者同名/“作者的…”分隔，与既有create侧命名规则一致；公共范围复用已有公共别名规则。
- update原始作者/目录若带路径分隔符、路径状无效值、不可见控制符即拒绝，不先删除这些字符再指向另一个目录。显式其他分类仍仅精确/唯一别名目录，不扩大回退。
- 原target只检查raw长度，现规范化后也须15个有效UTF-16文本单元，避免靠空白填充形成一字更新；manifest同步说明。这是明确收紧，调用方可能需要提供更长旧文片段。
- 读取采用文件描述符：可用时O_NOFOLLOW，并在读取前后校验bigint设备/inode/size/mtimeNs/ctimeNs、单链接普通文件及根/目录对象。未验证内容不进入匹配或诊断。测试另模拟无O_NOFOLLOW时的fd身份检查；这不等于Windows运行通过。
- 提交沿用wx临时文件+rename，前后加强inode/ctime版本和根/目录校验，拒绝同inode/同size/恢复mtime的并发改写，不覆盖该并发内容，并清理临时文件。没有引入新ACL、任务内核或跨仓同步机制。

上游span mapping及resident FIFO/KBD waitForIndex:false协调保持。40个DailyNote测试（上游24+新增16）通过；初始新增12测试中2PASS/10FAIL已记录，修复/扩展后40PASS，不将多次运行累加。限域独立复核也重跑40，报告dailynote-boundary-review.md。

## 身份和并发边界

`MEMORY_IDENTITY_AUTHORIZATION=NOT_ESTABLISHED`。真实链为ToolExecutor→Plugin.processToolCall透传maid→directContext(requestIp/sourceNode/pluginName/signal)→DailyNote；没有在此插件提供可验证的Agent/Topic principal或逐资源grant。KBD owner字符串用于队列/索引协调，不是身份凭据。公共目录可定位/可搜索不等于任何主体自动获准写，作者别名也不是授权。当前仍依赖外层既有注册/审批权限，不能把本批定位范围通过当作完整ACL、跨Agent/Topic授权验收通过。没有增加自报身份字段或新授权机制。

进程内FIFO及KBD协调保护合作调用，不是全目录/全进程事务。最后一次路径检查到rename之间，具有同OS写权限的非协作进程仍可搬移目录；扫描后其他进程还可新增或修改候选。不能声称全局CAS或抵抗同权限恶意本地writer。完整OS隔离/目录事务不在本批范围，本报告不隐藏这一继承边界。稳定inode不可得、文件多硬链接或路径/版本改变时当前选择fail-closed；Windows文件系统实际行为未运行。

## Windows与Linux

WINDOWS_NATIVE_VERIFICATION=BLOCKED：当前为真实Linux，无cmd.exe/powershell.exe/pwsh/WSLInterop；连接工具所有已知设备Offline，没有访问生产/绕过离线。完成两份本地Windows隔离构建/验收准备脚本，准确命令和未验证项见windows-native.md。PowerShell本机解析/执行NOT_RUN；CJS语法和Linux平台拒绝实测PASS。没有构建、加载、安装任何Windows候选，也没有把.unverified恢复为默认文件。

原Windows loader缺失默认产物时拒载且不走npm fallback；它并不校验一个已放入默认名的有效旧ABI二进制的来源/版本。此项是已披露的未完成边界，不宣称Windows全验收。源码/loader/Cargo锁/Linux及隔离Windows二进制与554完全一致；本批未修改它们。

本轮Linux实际重新执行44项native回归、7项来源负向fixtures、2 artifact精确receipt和原ABI/GLIBC守护（2.34<=2.35）。原Rust双构建、191源码测试是历史证据，本轮未重建/未重跑，也未据此新记PASS。

## R1-BR保护及当前裁决

本轮重新执行协议/静默拒绝/审批/Trusted Action组合135PASS；Jenn外置allowlist/运行注册/环境沙箱/FileOperator/LinuxShell/宿主授权组249PASS、11NOT_RUN（7真实bwrap smoke、4实际Chat配对）；显式临时审批配置与Jev核心72PASS。有重叠，不相加成唯一测试数。当前源文件与R1-BR保护边界的字节一致性及实际日志另列。

Box新工具批次不回退；VCPChat、NativeSync、ChannelHub仓库及运行状态未改。旧Chat已证不兼容，最新远端Chat完整验收NOT_RUN；这些与Windows阻塞分别保留。

R1-C须独立复审，APPROVED_FOR_MERGE=NO，DEPLOYMENT_COMPATIBILITY_BLOCKED持续。本批没有push、PR、远程CI、修改master、生产安装覆盖/服务启停、真实记忆/数据库/游标/身份写入。最终HEAD/Tree/双父、目标快照预演及可获取补丁/Git对象随delivery/HANDOFF.md和审查ZIP给出。

保留新候选工作树供再审；delivery包先另存才能丢弃工作树。临时合成数据由测试清理；不清理或覆盖旧R1B/BR构建缓存。本轮node_modules仅供重跑测试、可重建，退出触发点为独立审核结束并另存证据后。Git回退只处理代码，不能自动倒退任何记忆、派发动作、身份、同步游标或新运行格式。
