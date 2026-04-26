# AIGentStyle - AI 生图风格训练师

**版本**: 0.1.0  
**阶段**: StyleTrainer 准备期  
**安全边界**: 默认只生成计划与 dry-run，不执行真实 LoRA 训练。

## 目标

AIGentStyle 是 AI 生图 Agent 阶段三的准备插件，负责把“训练一个专属风格 LoRA”拆成可验证的准备步骤：

- 扫描素材目录
- 统计训练图片
- 判断是否达到最小素材量
- 根据场景推荐 LoRA 参数
- 生成 dry-run 训练计划

## 目录约定

```text
Plugin/AIGentStyle/
|- AIGentStyle.js
|- plugin-manifest.json
|- config.env.example
|- datasets/          # 本地素材根目录，默认不提交真实素材
`- outputs/           # 训练计划与未来输出根目录，默认不提交运行产物
```

建议每个数据集使用单独目录：

```text
datasets/
`- ecommerce-dress-v1/
   |- 001.jpg
   |- 001.txt
   |- 002.jpg
   `- 002.txt
```

## 工具调用

### PrepareDataset

扫描数据集并输出 readiness 计划。

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentStyle「末」,
tool_name:「始」PrepareDataset「末」,
dataset_name:「始」ecommerce-dress-v1「末」,
scenario:「始」ecommerce「末」
<<<[END_TOOL_REQUEST]>>>
```

### RecommendParams

根据素材数量和场景推荐参数。

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentStyle「末」,
tool_name:「始」RecommendParams「末」,
scenario:「始」portrait「末」,
image_count:「始」24「末」
<<<[END_TOOL_REQUEST]>>>
```

### DryRunTrain

生成 dry-run 训练命令计划，不执行真实训练。

```text
<<<[TOOL_REQUEST]>>>
maid:「始」AIGentStyle「末」,
tool_name:「始」DryRunTrain「末」,
dataset_name:「始」ecommerce-dress-v1「末」,
scenario:「始」ecommerce「末」
<<<[END_TOOL_REQUEST]>>>
```

## 安全边界

- `AIGENT_STYLE_ALLOW_TRAINING=false` 是阶段 2 的固定默认值。
- 插件不会安装训练依赖。
- 插件不会启动 SD-Scripts、Flux-Dev 或外部训练进程。
- 真实训练、依赖安装、模型输出写入共享目录，都必须作为后续阶段单独确认。

## 阶段 3 入口

下一阶段可以在此基础上继续实现：

- 素材裁剪与尺寸统计
- caption 自动生成或校验
- dataset manifest 写入
- training job dry-run 文件落盘
- 真实训练执行器的显式安全门禁
