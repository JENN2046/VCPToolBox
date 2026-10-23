# R1 综合验收报告

任务 `VCP_SEAMLESS_COMMUNICATION_R1`，2026-10-23。结果：PARTIAL。实现与 Commit 见 [四阶段矩阵](R1_IMPLEMENTATION_MATRIX.md)。

## 验收对象与授权

按 Jenn 后续明确指示，采用此前 V1 manual-client 的 Nova、Kerr 原生有效配置，在隔离目录新建 `R1-Nova-Kerr-验收群` 及新 Topic。没有采用另一套日常 VCPChat 的四个 Agent/旧 Group，也没有读取或复制原聊天历史。

全部模型为 `doubao-seed-2.0-mini`。Kerr 的原模型仅在验收副本覆盖。Jenn 另行明确授权将这两个 alias 的原始私有 Prompt 另存为验收文件后，才经已知 V1 AgentManager 冻结；文件仅留在 Ubuntu 私有验收目录，权限 0600，未下载、输出或入 Git。模型请求由已批准的隔离凭据引用在父进程内消费，未向 Windows/PWA 导出 provider Key。测试 host 配对权限不等同 provider 凭据。

Windows 路径为候选源码/证据存储及已授权 Electron 实机运行；项目测试、构建、完整 ToolBox 宿主均在 Ubuntu `/home/admin/VCPKF/vcp/artifacts/seamless-communication-r1/run-20261023` 执行。正式 6005、8888、生产配置、生产历史及入口未改动。

## 实际执行结果

| 项目 | 实际结果 | 证据与边界 |
|---|---|---|
| 完整宿主 | PASS（列明范围） | 当前原始 `server.js` 启动，NativeSync、AgentManager、原生 AgentGuard/ChatCompletionHandler 路径有效；真实原生 Prompt 快照。测试知识根为空或 synthetic，不能据此声称真实私有 RAG 等价 |
| Windows 原生 UI | PASS | 真实 Electron main/preload/main.html/renderer；Nova 原生单聊和新群顺序回复通过，没有替换应用模块。独立 Windows-A、Windows-B 是同一台电脑的两个隔离 AppData，不能计作两台设备 |
| Android | PASS（用户辅助、受测范围） | 用户在 Chrome 实际配对、发送 ANDROID-1，中央配置 v1 单次任务及 Nova 成功码匹配；顺序群聊配置 v4、两成员步骤各一次；用户确认后台约10秒及 /mobile/ 刷新后会话与新历史保留。无 ADB 自动取证，未自动确认本次设备型号/浏览器版本 |
| iPhone12 | NOT RUN | Jenn 回复“暂时无法操作”；已撤下配对二维码，没有把 API 会话当作 iOS Safari |
| 配置版本 | PASS（Windows/Android/云端） | 单聊绑定配置版本 1；云端三模式分别冻结版本 1/2/3，恢复 sequential 为 v4，Android 群任务绑定 v4；普通手机 API 无发布权限 |
| Checkpoint | PASS（列明范围） | 原生 IPC → Queue 创建消息，再仅补齐 contextCompaction。内容 SHA `22f9489f44ebb681f4ade4ad235cc0c9bdd55f58814bcab4873ac835c3f107e0` 不变，中央元数据 v1；两 Windows 收到相同 Checkpoint。Android Kerr 返回 ANDROID-3-OK 和正确 R1_CHECKPOINT_SENTINEL_20261023。旧历史排除由完整合成请求断言证明，未留存真实 provider payload 原文 |
| 图片/PDF/文本 | PASS（真实 Windows + PWA 内核/API） | 原生 fileManager 存储，CAS 上传/下载逐字节 SHA 校验；PDF 使用原生渲染帧，当前实机 PDF 文本提取为空，模型仍读出 PDF 识别码；图片识别颜色及文本完整识别码通过 |
| 附件反向接续 | PASS（列明范围） | PWA 内核/API 上传绿黄图与文本，模型读取通过。Android 实际查看三类桌面附件，再下载/选择/上传红蓝 PNG，SHA 与原图一致，模型识别红蓝；两 Windows 恢复原生句柄，6 个引用（5 个唯一原文件）Hash 全对。Kerr 已有同 Blob 时仍不能下载 Nova 消息附件（403）。手机 PDF/文本上传 UI 未测 |
| 群聊三模式 | PASS（真实 provider/API + Windows；Android 顺序模式） | sequential 两成员各一次；invite_only 普通消息 0 步、手动邀请 Kerr 1 步；naturerandom 的 `@所有人` 计划选中两成员，各一次。Android 另有两个独立 requestId 的顺序提交，每个成员步骤均 attempts1。群计划与回复 intent 由同一个持久执行器提交 |
| Windows 客户端退出后继续 | PASS | Windows-A 退出后，云端 API 顺序群聊完成；后续 Android 单聊、两个群任务和 PNG 上传也在两个测试客户端均退出时完成。再打开 Windows 接收到全部记录。Windows 主机没有实际断电，此处不宣称物理关机测试 |
| 消息/附件收敛 | PASS | 两配置最终各 Nova 11 条、Kerr 8 条、Group 17 条；36 条内容指纹与中央投影一致，无重复 ID；6 个附件引用 SHA 校验通过。两 Windows 最后 cursor39、outbox0、pendingfalse，配置/附件错误均为空 |
| 崩溃/恢复 | PASS（合成故障注入） | 125 回归包括 intent 后崩溃、Journal 后崩溃、Pending/ACK 缺口、取消、审批等待、未知副作用不重跑、持久计划只选一次；完整合成宿主两次正常退出/重开，无请求重放。本批没有对真实 paid 请求强制崩溃 |
| 单写入者 | PASS（受测路径） | 云端持久提交仍归 CentralStore/Journal/applied_ops；Windows 历史及本地附件句柄只经 HistoryMutationQueue/expectedRevision。CDS/MobileSync 共享 Topic 只读隔离及 Agent/Group 删除保护回归通过 |
| 数据兼容 | PASS（受测路径） | 原内容指纹兼容；元数据与内容分别比较，旧 JSON 不能取得新权威列；墓碑保护、旧元数据升级及不具备 attachments-v1 的旧协议拒绝均有负向测试。没有在真实历史库运行迁移 |

## 验证证据

最终代码证据基线：ToolBox `71df7031c7fe9585b39b7dd633c9f49476bfa2ff`；Chat `3bccdfb625c04571c7633a8b1892d427736308d7`。本报告提交只更新文档，不改变这些受测产品代码。

Ubuntu Node24 联合回归 125/125，PWA 构建成功。完整合成宿主 9 次请求、真实 provider 0、边界违规0。真实批次实际 18 次模型请求，均 HTTP200 且完成，无 abort/transport error，硬上限20；中央 12 个任务、9 个群成员步骤均 completed，没有自动追加真实工具调用。

私有证据根：Windows `P:/VCPKF/vcp/artifacts/seamless-communication-r1/`。仅下列低披露 JSON 为报告依据，不应打包整个 real-device 目录：

- `FULL_HOST_ACCEPTANCE.json`：合成完整宿主请求特征及退出证据。
- `real-device/REAL_ATTACHMENT_API_ACCEPTANCE.json`：双向 CAS、读取标志及 Hash。
- `real-device/REAL_CHECKPOINT_ACCEPTANCE.json`：同内容 Hash 元数据补齐。
- `real-device/REAL_GROUP_sequential.json`、`REAL_GROUP_invite_only.json`、`REAL_GROUP_naturerandom.json`：真实持久计划和步骤状态。
- `real-device/Windows-A_CONVERGENCE.json`、`Windows-B_CONVERGENCE.json`：逐 Topic 数量、指纹和附件校验。
- `real-device/REAL_BATCH_FINAL_PROOF.json`：18 次请求、任务/步骤计数、最终进程/端口及宿主退出摘要。
- `real-device/PWA_BOUNDARY_FIX_PROOF.json`、`PWA_STATIC_HTTP_PROOF.json`：公开构建复制校验及静态文件 HTTP 状态。
- `real-device/ANDROID_FINAL_ACCEPTANCE.json`、`ANDROID_MANUAL_USER_CONFIRMATIONS.json`、`ANDROID_MANUAL_SERVER_OBSERVATION.json`：手机操作确认与中央任务、附件 Hash、回复标识的对应；`ANDROID_MANUAL_RECONCILIATION.json` 记录早期未核实反馈已通过新的真实提交解决。

这些文件不包含 Prompt 原文、模型回复原文、provider payload 或 Key。私有原始配置、生成的连接文件、验收历史不进入 Git。

## 失败、修正与尚未验证事项

第一次附件模型询问只要求“R1 标识”，回答不含完整日期识别码，严格断言失败；明确要求完整识别码后另一次请求通过。两次均计入总预算，没有删除失败事实。后续文件恢复脚本最初读取顶层 internalFileName，实际原生句柄在 _fileManagerData 下；修正验收脚本后复用已完成任务，未重复收费调用。Checkpoint 脚本曾比较 API 行上不存在的 Hash 字段；已换用原始 messageHash 对真实 message 重新验证，并使用独立受控消息取得有效证据。收敛脚本也已区分本地作者消息和中央元数据 envelope。

早期 Android 反馈与后台无新任务不符，用户随后确认当时没有 Android 测试消息，未计通过。重新完成真实配对、输入并点击发送后，ANDROID-1、ANDROID-2、ANDROID-3 和群聊均取得中央记录和手机确认。配对页刷新丢失一次性码的情况未冒充会话恢复；成功进入 /mobile/ 后，后台/刷新恢复另行验证通过。手机群聊记录有两个不同 requestId，内容相同，两个任务都各成员一次；这是两次独立提交，不是同一 requestId 的重放。第二次群聊 Kerr 回复未匹配严格成功码，保留该标志为 false；第一次两成员成功码均匹配，没有为此再请求。

Linux headless Chromium 因“No usable sandbox”未运行，未降低 sandbox；转用真实 Windows Electron。短 SSH 连接间歇中断通过已有持久连接继续，未变更认证或探测生产环境。

Android 用户辅助接入首次返回 `NATIVE_R1_FS_BOUNDARY`：测试配置把公开 PWA 构建目录设在隔离根外，API 层验证没有覆盖这个静态文件读取。该越界读取被 guard 拒绝，没有放宽 guard。修复仅将已构建的 8 个公开文件复制到原隔离根内并逐文件核对 SHA，再更新测试副本的 PWA 目录；页面、JS、CSS、配对脚本 HTTP200。此项为验收环境修复，不是产品源码变更，也不消耗模型请求；阻断事件保留在该次宿主退出证据，不能抹平为整批从未触发边界。

自动审批曾拒绝 fail-open 上下文过滤、未授权活动宿主进程/映射读取、未经授权保存 Prompt。前两项没有执行；过滤保持 fail-closed 并有负向测试。Prompt 保存直到 Jenn 后续明确授权这两个 alias 才执行；没有借此读取其他 alias、真实记忆或运行进程环境。

真实私有记忆/RAG 等价、外部工具真实副作用、Android PDF/文本上传 UI、Android 邀请/随机模式 UI、iOS Safari/文件输入/接续及完整三端矩阵仍未验证。Android PNG 选择/上传与后台/刷新已完成，不能由此扩称所有文件类型及浏览器行为都通过。JEV/Game 及未发布的桌面 Canvas/workspace 上下文明确保持桌面限定；云端不会伪造。

## 收尾与交付边界

临时 cloudflared、隔离完整宿主、relay/front 和两套 Electron 已停止；Ubuntu 18971/18973/18974 端口关闭。最终宿主 exit0、完成 shutdown Phase10、边界违规0；历史重启记录中保留 1 次上述被拒绝的 PWA 越界读取。首批 Supervisor 汇总文件未写出，后续正常 stdin 停止已生成最终汇总；关闭结论同时依据独立 host exit、精确自有 PID 消失和端口探测。ADB 无残留 forward，本批专用 server15037 已停止，默认 ADB server 未改动。

私有 Prompt 验收快照保留在 Ubuntu 0600 目录供后续受控续验；未自动删除用户授权的证据。临时 URL 已失效，后续实机需重建本批隔离入口。生产未切换；没有 Push、创建/更新 PR 或 Merge。
