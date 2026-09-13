# 腾讯云 next 源码整理状态

- 发布分支：`nuobao-vcptoolbox`；目标：`JENN2046/VCPToolBox`。
- 来源：Jenn 确认的腾讯云正式 VCP 运行目录 `runtime/VCPToolBox-upstream-next`。
- 来源分支：`update/merge-20260905-r1`；源码 HEAD：`1dbbd29edf05254935c27a315eedca3a3f049d99`，叠加整理时工作目录中的源码改动。HEAD 不代表完整运行版本。
- 本分支是经过范围筛选的 next 源码快照，父提交为原远端 main `e5874076cf7946911815ac100bb2027038a6cc73`；不是跨机器合并结果，也不是新的部署。
- 原远端 main、prod/stable、其他分支和腾讯云正在运行的代码均保留。合并本分支之前，必须单独核对远端独有功能；不能把快照差异当作已审阅的删除方案。

## 入库边界

纳入后端、管理界面、Rust 源码、允许的插件实现、桥接代码、测试、依赖锁文件和配置模板。沿用目标仓库的 AGENTS.md 和 GitHub 工作流，未改 CI。

真实配置、认证材料、私有记忆、日记、知识库、Agent/TVS 运行提示词、日志、任务产物、运行数据库以及编译生成物不从 next 复制或提交。原件保留在原机器上。
`Plugin/CodexWorker` 属于单独的治理执行器及任务产物，需在外置执行层另行整理；本次不整包放入 VCP 核心。
`Plugin/GitOperator/repos.json.example` 的原件触发凭据形态检查，未发布原件；本分支使用新建的空配置模板。

## 验证与使用

详细结果见 [整理回执](docs/tencent-next-source-20260913.md)。源码包没有携带生产配置，不能直接替代运行目录。前端产物和 Rust 原生模块需按项目构建步骤生成。依赖来自现有安装的只读引用，原生模块仅作为本轮测试输入；未声称完成全新环境安装或 Rust 可复现构建。

next 的 Git 元数据仍依赖 core/.git；不要删除或移动 core 来整理 next。历史与私有数据均未清除。
