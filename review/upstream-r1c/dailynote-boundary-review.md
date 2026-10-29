# R1-C DailyNote 定向边界审查

范围：新隔离工作树 `upstream-box-r1c-20261029`，从 R1-BR `554a02a9bcd14bcd7ce7cbd8896d76b2bed2eb4b` 实际合并固定上游 `8c714a06531880e4be1fc24e9c8a4188a0b92691` 的 DailyNote 源码、manifest、增量测试及其实际宿主调用链。不重新审查原 143 项提交，不涉及其他仓库、真实记忆或生产。已读取用户 R1-C 正式任务书。

本报告先记录实际发现及复现；下文发现只有在后续明确追加复测结果后才算关闭。未修改源码或暂存、提交、推送。

## 上游实质改进

上游 update 必须给出作者或文件夹，取消未命中后的全库回退；同作者、公共、其他显式分类使用各自候选目录；fileName 仅缩小文件过滤；所有精确/宽松命中共同计数，多文件、多位置歧义不写入。`findDiaryUpdateMatches` 保留原文 UTF-16 区间，宽松匹配不再用 target.length 猜测替换长度。读取失败或读取时版本改变会返回 DAILY_NOTE_SCAN_INCOMPLETE，避免在不完整扫描下声称唯一。普通静态 symlink/junction、越根 realpath 文件会被排除。以上是命名范围和数据一致性改进，不是可信身份授权。

## 发现及纯合成复现

### 1. 作者前缀碰撞同时影响写入与诊断

初始合并源码 `ownerScope/inScope` 使用 `alias.startsWith(ownerAlias)`。在临时根建立 `nova的知识`、`novax的日记`，仅后者有唯一合成 target。通过真实 VM 加载 DailyNote（dotenv stub，KNOWLEDGEBASE_ROOT_PATH 指向 mkdtemp）调用 `dispatchCommand({command:'update',maid:'nova',target,replace:'changed'})`，返回 success、folder=novax的日记，且该文件被修改。

同一夹具对 target 加不存在的尾缀后，更新失败，但 fuzzyDiff.candidateFile 仍指向 novax，diff 包含其合成原文。这是同一范围判断错误的读泄漏，不是另一条独立权限机制。

最小建议：复用明确作者命名分界规则（完全相等，或作者名加“的”等已声明分隔符），公共范围复用已有 isPublicFolderAlias；目录选择和诊断继续共用同一集合。不能只给成功写入增加边界而保留诊断扫描范围。

### 2. 路径状 folder 文本被静默折叠成另一分类别名

临时根只有 `other的知识/note.txt` 含目标。`maid:'nova',folder:'other/的知识'` 被 normalizeDiaryFolderAlias 去掉斜杠，实际选择 other的知识，返回 success 并写入。该复现没有发生 OS 路径穿越；问题是看起来非法的路径状限定被静默重解释成有效目录，而不是 fail-closed。显式选 other的知识 本身在现有算法中允许，不能误报其已经受身份 ACL 保护。

最小建议：只在 update 参数入口拒绝 raw maid/folder 的路径分隔符、父目录/控制字符等非法形式，保留合法唯一别名兼容；不顺带改造 create 的既有 sanitize 行为或发明新 principal。

### 3. 读前 realpath/lstat 与 readFile 之间存在可复现 symlink 竞态

用实际临时文件和 fs Promise readFile hook 控制交错：DailyNote 完成 realpath/lstat/statsBefore 后，将自身 note 暂时 rename 到备份并创建指向范围外合成文件的 symlink；实际 readFile 读取该文件后，立即恢复原 note，再让 statsAfter 继续。原 note 的 size/mtime 保持不变，扫描没有标为 incomplete，失败诊断返回范围外合成内容片段。结果为 leakedOutsideFragment=true；原 note 和范围外文件均保持原文，没有访问真实记忆。

最小读侧建议：在检查对象后以 O_NOFOLLOW 打开句柄，先 fstat 核对被检对象 dev/ino 和版本，再用该句柄读取；读取后验证句柄/当前路径仍对应原对象。任何不一致先拒绝，内容不得进入命中或 fuzzy 诊断。此问题发生在读取，不可仅靠写前 realpath 校验修复。

### 继承的一致性限制

原 R1-BR 的 atomicReplaceIfUnchanged 也是 size/mtime 两次比较，然后临时文件 rename；本轮上游没有重写此 helper。它保证原子替换和普通版本变化冲突检测，但不能证明 inode 相同、内容相同，或消除最后检查到 rename 之间的非协作外部写入窗口。已有 DailyNote 进程内队列/KBD FIFO 约束参与者，不是所有外部编辑器的跨进程锁。建议最小补充 dev/ino/ctime 或已读内容校验，并如实保留非协作最终 rename 窄窗，不声称完成通用文件系统 CAS。

另一个继承边角：target 的 15 字符门槛按 raw.length 检查，而宽松匹配会删除空白/反斜杠；极短规范化 needle 仍可能匹配。该长度门槛不能当作身份或 ACL 保证。已告知主执行者，是否在本批加最小有效内容校验由其按限域目标决定。

## 实际宿主授权链与验证边界

- `modules/vcpLoop/toolExecutor.js → Plugin.processToolCall` 经现有 PluginManager/通用审批与执行桥调用。Plugin.js 明确将模型 toolArgs.maid 原样传给插件，作者字段是用户/模型提供的文本，不是认证对象。
- `modules/pluginBridgeRegistry.js` 的 direct-hybrid-service 只构造 requestIp、sourceNode、pluginName；`Plugin._executeDirectToolCallWithTimeout` 加 AbortSignal。此链没有给 DailyNote 建立受信 Agent/Topic principal 或按资源逐项 grant。
- DailyNote.processToolCall 调用 enqueueResidentRequest，context 只用于取消；队列 owner 是本地生成的 DailyNote:command:timestamp:count 字符串。KnowledgeBaseManager.runExternalFileMutation 和 modules/knowledgeBase/databaseCoordinator 的 ownerName 用于 FIFO、空闲协调及索引安排，不是主体授权。
- 通用 toolApproval 配置可能要求人工审批，但没有 DailyNote 专属的可信身份绑定或 Topic ACL。未读取当前真实配置，不能据默认仓库设置断言某部署已经要求逐次审批。
- 因而作者/目录过滤通过只证明明确候选范围；公共目录可搜索不自动授予任意主体修改权限；显式其他目录可选也不证明 caller 已获许可。跨 Agent/Topic 的身份授权缺口须在 HANDOFF 中明确保留。按用户要求，本批不新增 ACL、可信身份机制、客户端自报身份字段或跨仓接口。
- 静态链接检查、唯一匹配、队列和原子 rename 均不能单独替代授权。在无可信身份上下文的现有宿主上，不得报告“DailyNote 记忆 ACL 已完成”或“跨 Topic 写入授权已验收”。

## 执行记录

审查仅运行直接加载候选 DailyNote 源码的合成 VM/临时文件复现，dotenv 为 stub，TagMaster 未启用，不调用提供方。初始前缀/路径状别名复现得到 2 个错误 success，前缀 fuzzy 及受控 symlink read 竞态均泄漏合成片段。主执行者报告上游范围 suite 24 PASS；那是上游现有断言，不覆盖上述额外边界，且不记为本审查独立重跑。

待主执行者完成最小修复后，再追加针对这些发现的复测结果。Windows 原生、其他 R1-BR 保护回归、Git 最终候选和目标分支合并预演均由主执行者分别交付，本报告不冒称完成。


## 追加：按主执行者请求验证的提交竞态

两项均在初始合并源码上以真实临时文件和定点 fs Promise hook 复现，未修改源码或真实数据：

1. **相同 inode、相同 size、恢复 mtime 的并发内容丢失**：初始文件 mtime 固定到整毫秒；候选临时文件写完后，外部写入同长度不同正文并 utimes 恢复原 mtime。原 size/mtime 检查通过，返回 success，外部较新正文被候选替换。补充 dev/ino 只能识别换对象，无法识别这一同对象写入；bigint ctimeNs 与内容版本检查才覆盖该交错。此项支持主执行者正在实施的版本补强。
2. **最后检查后的目录搬移/链接替换**：在最终 fs.rename(temp,file) 调用处、真实 rename 执行前，外部将已验证作者目录移到配置 root 外并在原位置建 symlink。随后真实 rename 返回 success，搬至 root 外的原 note 被替换。结果为 outsideChanged=true。该最终检查到操作之间的非协作文件系统竞态不会仅因增加一次 stat/realpath 而消失；队列只约束参与者，不约束能重命名目录的其他本地进程。不能据此声称跨进程文件系统 CAS 或抵御任意同权限本地目录替换者。

第二项是继承设计的明确剩余运行边界，不建议在本批扩大为跨平台 dirfd/OS 沙箱或 ACL 重构。主执行者应补充能在操作前识别的路径/对象/版本变化并记录最终窄窗；若今后产品要求覆盖恶意非协作本地 writer，需另行明确操作系统权限边界与支持平台。


## 修后限域复核结果

已只读检查主执行者的批量最小修补。目录选择改为作者同名或作者名加“的”的明确分界，公共目录使用已有 isPublicFolderAlias；update 独立拒绝路径/不可见别名输入，未改变 create 共享 sanitize；target 同时要求原文及宽松规范化后的有效长度不少于 15，manifest 已同步说明。这是明确的安全性收紧：过去仅靠大量空白凑够 15 字符的调用现被拒绝，调用方须提供更多有效旧文本。

读取现在为 bigint lstat → open（支持时 O_NOFOLLOW）→ fstat/路径/根与目录对象验证 → handle.readFile → fstat/路径/根与目录再次验证。未验证的内容不会作为返回值进入匹配、候选或诊断。nlink 不为 1、ino 为 0、非普通文件或版本/对象不一致均拒绝。即使平台没有 O_NOFOLLOW，读取前的描述符 identity/version 检查仍先于 handle.readFile。Windows 真实 inode/ctime 行为仍属于未执行的平台验收，不从 Linux 测试推断通过。

atomic helper 现比较 dev、ino、size、mtimeNs、ctimeNs、nlink，并在两个提交检查点重新验证根/目录对象，覆盖前述同 inode 保持 size/mtime 的已复现交错。临时文件仍以 wx 创建，冲突清理临时文件；上游宽松 span mapping 算法未被替换。residentQueue 与 KnowledgeBaseManager waitForIndex:false 协调链未改动。

独立执行：

```sh
env -i PATH=/usr/bin:/bin HOME=/tmp node --test tests/dailyNoteUpdateScope.test.js tests/dailyNoteBoundarySafety.test.cjs
```

第一轮扩展前快照为 36 PASS / 0 FAIL / 0 SKIP；随后主执行者补入 no-O_NOFOLLOW、hardlink、扫描失败、规范化别名歧义测试，本审查再次运行，最终快照为 **40 PASS / 0 FAIL / 0 SKIP**（上游 24 与新增 16，不将两次执行相加）。新增测试真实加载当前 DailyNote 源码且仅用临时根、合成文本与 dotenv stub。已覆盖前缀错误写入/诊断、公共范围同名前缀、非法路径/不可见输入、极短有效 target、两种 nofollow 能力下的瞬态 symlink、同 inode 并发版本变化、hardlink、读取失败下的唯一性拒绝、别名歧义和 FIFO/KBD 取消行为。

据源码检查及上述独立复跑，本报告初始可收口发现 1、2、3、同 inode 版本覆盖及有效 target 边角已得到对应修复/验证。未发现需要新增身份机制或扩审旧集成的语义退化。`git -c core.whitespace=cr-at-eol diff --check` 对本次 DailyNote 修改通过。

审查快照 SHA256：

- dailynote.js: `1b1b895c77a6e151b58c5b2d2d516cef4bc86e7e8d4275ddb1332337bd5457ed`
- plugin-manifest.json: `d6fffd197fd9f0b3793fd2c785cee716fcc07e2b3a5540740ccc0e713ea10119`
- dailyNoteBoundarySafety.test.cjs: `1bcd544ee3b0354fb54537997492a791cc8a5743b9e8a1928631d7e400cbb321`
- dailyNoteUpdateScope.test.js: `79850ed2e8d0570c1df2ceee412a4c93e98b93a86e2808f43032ce7464d81dc4`

**仍保留的边界：** 最后一次检查到实际 rename 之间不受进程内队列约束的非协作本地目录搬移/写入窄窗，以及宿主没有为 DailyNote 建立可信 Agent/Topic principal 的事实，均没有被上述修复宣称解决。新增文件可在扫描之后由非协作外部进程改变，不能把唯一匹配断言提升为全目录跨进程事务。公共/作者目录是定位命名空间，不是 ACL；本批没有创建身份或授权入口。本次 PASS 不解除 Windows、旧客户端或生产部署阻塞，也不构成合并批准。
