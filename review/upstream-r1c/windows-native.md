# R1-C Windows 原生验证与本轮 Linux 回归

`WINDOWS_NATIVE_VERIFICATION=BLOCKED`。当前没有可使用的已授权 Windows 本机环境。Windows 构建、真实加载和验收均未执行；本轮完成源码/工具链核对、可直接移交的本机构建与测试准备，以及真实 Linux 原生回归。`DEPLOYMENT_COMPATIBILITY_BLOCKED` 保持，不在本报告解除。

本报告对应新工作树 R1-C，基线 `554a02a9bcd14bcd7ce7cbd8896d76b2bed2eb4b`，基线 Tree `aa393a0a8bd98c6ebac71a066247f12bc36112fb`，冻结上游 `8c714a06531880e4be1fc24e9c8a4188a0b92691`。本轮上游增量没有修改 Vexus Rust、Cargo 锁或原生产物。最终 R1-C Commit/Tree 由总 HANDOFF 绑定；本报告不把构建准备称为已经完成的 Windows 验收。

## 环境实证及阻塞

本轮只读检查得到：Linux `7.0.0-38-generic x86_64`，内核不是 WSL；`cmd.exe`、`powershell.exe`、`pwsh`、`wsl.exe`、`wslpath` 均未找到；`/proc/sys/fs/binfmt_misc/WSLInterop`、`/mnt/c` 和 `/mnt/wsl` 均不存在。Node 实际为 `linux/x64`、`v22.23.1`、N-API `10`。

主执行者此前调用 DesktopCommander 设备清单，返回的 `QLL-6`、`jenn-System-Product-Name`、`VM-0-12-ubuntu` 均为 Offline；这是主执行者的设备工具回执，不是本子任务另行探测的结果。本子任务未启动、登录或绕过这些设备，未访问四台服务器、生产安装树或远程 CI，也未使用 Wine 或交叉编译代替 Windows 验收。

最短补齐路径是提供一个已经授权且可用的隔离 Windows x64 本机环境，在其中使用 R1-C 审查包的精确提交运行下述脚本。设备上线、凭据使用或 CI 启用不由本文自动授权。

## 源码和工具链核对

现有 `docs/native-delivery-upstream-r1-linux.json` 中的 53 个 Vexus 构建输入、3 个 DailyNoteSearcher 构建输入逐项进行了本轮 SHA256/历史 Git blob 比对，全部与 R1-BR 基线的实际文件字节一致。详见 `native-source-evidence.json`。DailyNote JavaScript 插件的范围修复与 DailyNoteSearcher Rust 是不同模块，不能混作同一次原生源码变化。

当前 Vexus 要求/准备：

- Rust 目标：真实 Windows x64 上的 `x86_64-pc-windows-msvc`；根 `rust-toolchain.toml` 固定 `1.89.0`。
- Node：现有构建工作流使用 `22.23.1`。Rust N-API feature 为 `napi4`，Cargo.lock 锁定 `napi 2.16.17`、`napi-derive 2.16.13`、`napi-build 2.3.1`。运行时实际 N-API 版本由本机日志记录。
- 构建 CLI：沿用现有 Windows recipe 的 `@napi-rs/cli@2.18.4`；不依赖 package.json 中较宽的开发版本范围。
- 需要 MSVC x64 C++ Build Tools、Windows SDK，以及可以直接解析 `cl.exe`/`link.exe` 的 Developer PowerShell。现有 recipe 没有冻结 MSVC 小版本；准备脚本记录实际文件版本、路径及 SHA256，不能提前声称某个未运行的编译器已经通过。
- Windows 默认加载名为 `rust-vexus-lite/vexus-lite.win32-x64-msvc.node`，当前明确不存在。
- 上游历史产物仍隔离为 `vexus-lite.win32-x64-msvc.upstream-393dc5e.node.unverified`，SHA256 `f3da3b501504bb77d667e007dc4fb0b7c81e9fb2958df5a535d5f16694e3956e`。未重命名回默认路径，未加载它，未将其当作当前源码构建。
- 原 `index.js`/`index.d.ts`、Cargo 锁、Rust 源码、Linux/Windows 隔离产物均未被本子任务修改。现有 Linux 收据和既有 Windows 历史收据没有被改写为本轮 Windows PASS。

原 Windows 工作流仍是历史 recipe/收据引用，不是本轮执行回执，且本轮没有触发它。

现有 Windows recipe 未见 Authenticode/SignTool 签名步骤；历史 `.node` 的 SHA256 只定位来源，不是代码签名证明。本轮没有 Windows 签名验收。准备脚本在实际构建后只读取并记录每个产物的 `Get-AuthenticodeSignature` 状态，不自动签名、不使用证书私钥，也不把未签名当成来源校验已经通过。是否要求发布签名留给独立发布裁决。

## 本机构建及验收准备

新增两个限域脚本：

- `scripts/verify-vexus-windows-local.ps1`：要求真实 Windows x64、精确提交及 clean checkout、固定 Node/Rust 和 MSVC 工具；仅向一个全新的、位于源码树之外的输出目录写入。只复制已校验收据中的 Rust 白名单源文件到两个独立干净构建根，固定 CLI，使用锁文件分别构建。不会在源码树安装 `.node`，不会修改 loader、分支、服务或原收据。
- `scripts/check-vexus-windows-candidate.cjs`：只接受实际 Windows x64 Node。实际加载新构建的 PE `.node`，检查 ABI 2、必要能力/方法、主要检索、排除项及错误参数；在隔离目录执行未修改的默认 loader，验证新产物正例、缺失、仅 `.unverified`、损坏二进制负例；复用现有八入口 native acceptance 与旧 3072/4096 维 SQL 兼容测试。子进程环境不继承 provider 凭据。最后在独立 receipt-root 生成并运行原有来源/哈希检查，不写回源码树。

两次构建 SHA256 若不同，结果记录 `byteEqual=false`、两组哈希与 PE TimeDateStamp，并以退出码 2 停止；不得称为可复现成功。需要结合两次 `dumpbin /headers` 输出和编译/PDB 路径继续调查。即使构建/测试通过，结果仍要求独立审核并保留剩余兼容阻塞。

在**已授权的 Windows x64 隔离 checkout** 中执行，`$R1C_SHA` 必须取自最终 HANDOFF 的完整 SHA，而非默认相信某个工作目录的 HEAD：

```powershell
# 在本机 Developer PowerShell 中准备；均不在生产 checkout 执行。
$src = 'C:\vcp-review\r1c-source'
$out = 'C:\vcp-review\r1c-windows-native-output'
$R1C_SHA = '<最终 HANDOFF 中的 40 位 R1-C 提交 SHA>'

# src 由交付 Git bundle 创建，checkout --detach 到 R1C_SHA；保持源码干净。
Set-Location $src
rustup toolchain install 1.89.0 --profile minimal --target x86_64-pc-windows-msvc
node --version                  # 必须 v22.23.1
rustc +1.89.0 --version --verbose
cl.exe /Bv
npm ci --ignore-scripts --no-audit --no-fund
npm rebuild better-sqlite3 --no-audit --no-fund

# out 必须尚不存在，且位于 src 外部。
& "$src\scripts\verify-vexus-windows-local.ps1" `
  -SourceRoot $src -ExpectedCommit $R1C_SHA -OutputRoot $out
```

不要修改系统 ExecutionPolicy 来绕过脚本执行限制；如果宿主政策拒绝运行，保留拒绝信息交审。本轮没有 PowerShell 运行时，以上 `.ps1` 的实际解析、执行以及 Windows helper 的真实平台执行均是 `NOT_RUN`。本轮仅做人工静态核对、CJS 的 `node --check`，并验证该 helper 在 Linux 会立即拒绝冒充 Windows。

预期输出是 `$out\logs\`、两个独立 build 根、`$out\proof\result.json`、原 native suite 的 stdout/stderr，以及 `$out\proof\receipt-root\docs\native-delivery-r1c-windows.json`。这些都是未来实际运行后产生的材料；本次未生成 Windows 构建收据。

### 必须保留的 loader 边界

现有 Windows loader 对缺失默认产物明确报 `VEXUS_CANDIDATE_BUILD_REQUIRED`，并禁止 npm fallback；仅存在 `.unverified` 不会被自动加载。损坏原生文件由实际 Node/OS 加载拒绝。

但该 loader 本身**不校验文件来源哈希，也没有对一个已放入默认文件名、格式有效但 ABI 过旧的 `.node` 做版本门控**。不能将“缺失/隔离物拒绝”写成“任意不可信/错误版本都被 loader 拒绝”。准备脚本另行核对当前构建的来源和 ABI；它没有改造运行期 loader。`validWrongVersionLoaderRejection` 在输出里保持明确未验证/能力边界，不能据此自动宣布 Windows 或部署全验收。

## 本轮真实 Linux 回归

本轮没有重新构建未变化的 Rust，也未复用上一批测试日志冒充结果。以下命令均在新 R1-C 工作树重新执行，使用现存且与基线 byte/blob/hash 一致的 Linux 默认产物：

```sh
node scripts/check-native-delivery.cjs x86_64-unknown-linux-gnu vexus daily \
  --receipt docs/native-delivery-upstream-r1-linux.json
node scripts/check-vexus-linux-native-abi.js
TDB_NATIVE_BINDING="$PWD/rust-vexus-lite/vexus-lite.linux-x64-gnu.node" \
  node --test --test-concurrency=1 \
  tests/tdbNativeAcceptance.test.js tests/chunkIndexGenerationalBaseline.test.cjs \
  tests/tdbLegacyDimensionCompatibility.test.js tests/nativeGreenLane.test.js \
  tests/nativeParallelRerank.test.js tests/nativeRerankSearchOptions.test.js \
  tests/nativeRerankProxyIsolation.test.js tests/resultDeduplicatorBounds.test.js \
  tests/lightMemoABDiagnostics.test.js
node --test tests/nativeDeliveryProvenance.test.cjs
```

| 状态 | 本轮项目 | 结果 |
| --- | --- | --- |
| PASS | 两组 Linux 来源/源码/产物收据 | 2 个 artifact 精确校验；DailyNoteSearcher 此处仅检查来源哈希，未执行其二进制 |
| PASS | 原 Linux 默认加载、ABI、索引往返与 Memo 生命周期守护 | 实际加载；原 GLIBC 上限保持 2.35，观测 2.34 |
| PASS | 现有 native 回归组 | 44 passed、0 failed、0 skipped；含原八入口 acceptance 包装，不另把八个入口重复累加为总数 |
| PASS | 原生产物收据负向 fixtures | 7 passed、0 failed、0 skipped |
| PASS，仅 Linux 模拟 | 既有 `review/upstream-r1/native-platform-probe.cjs` | 缺失 Windows 默认产物时不走 npm fallback；不是 Windows 本机验收 |
| PASS，准备检查 | 新 CJS helper 的语法及 Linux 平台拒绝 | `node --check` 通过；Linux 调用按预期拒绝 |
| NOT_RUN | 本轮重新构建 Rust、Rust 单元测试、旧 USearch 质量对比 | Rust/锁/产物完全未变，本轮重点是原生加载/ABI/核心检索；此前双构建仅作历史来源对照 |
| BLOCKED / NOT_RUN | Windows 双构建、真实加载、Windows ABI/RiverMemo/错误路径/Windows receipt | 没有已授权可用的 Windows 本机环境 |
| NOT_RUN | PowerShell 本机解析与执行 | 当前未安装/暴露 PowerShell；未安装替代运行时冒充 Windows |

Linux Vexus SHA256：`d114ffd7b0cb6bb51ede252d2a9e7d027b2068b04b12d31eab5f7187e85da26d`，Git blob `0f6edfc901132218202a0b1f2f0b715b7111fc74`。

Linux DailyNoteSearcher SHA256：`a4e87a6ad29d3e15eeacaa7914a4e41b30e9b8b6146f8bc8f89094ef82a14a79`，Git blob `7ffee44dd62a7f9053cce8be351a6cfea0d80215`。本轮仅验证该文件及源码与原收据/基线一致，不声称本轮实际运行其 Windows 或 Linux服务。

本轮上述 Linux 测试没有初始失败或修复复跑；新 Windows helper 在 Linux 的非零退出是预期的平台拒绝。实际原始输出无损保存在 `native-logs.tar.gz`（解压得 `native-logs/`）；`native-source-evidence.json` 绑定实际输入和哈希。R1-B 的旧构建日志仍是历史材料，没有被替换或重记为本轮通过。

默认分支、生产、VCPChat、NativeSync、ChannelHub 的状态不因本报告改变。Windows 与适用客户端兼容验收仍需分别完成；本报告没有解除部署阻塞。
