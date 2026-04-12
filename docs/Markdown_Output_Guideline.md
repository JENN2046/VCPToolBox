# VCP Plugin Markdown 渲染标准指南

本文档记录 VCP 插件向大模型输出文本结果时的最佳实践格式。随着应用深入，我们发现纯 JSON 输出会导致模型混淆、过多的 Token 消耗以及阅读障碍。

因此，所有生成非结构化数据的插件，都应尽可能将其结果使用 Markdown 进行包裹和预格式化。

## 标准核心包裹层 (Data Structure)

VCP 主系统在处理多模态和文字输出时，期望以下核心数据结构：

```json
{
  "status": "success",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "你的 Markdown 格式化输出字符串"
      }
    ]
  }
}
```

> **注意**：必须使用 `[{ type: 'text', text: '<string>' }]` 数组结构包裹你的字符串内容。如果直接将字符串赋给 `{ content: "..." }`，在经过多层 JSON 序列化传递时，大模型接收到的很可能仍是一段带有大量 `\n`、`\r` 和 `\"` 的生硬字符串，从而无法正常触发对话侧的 Markdown 渲染。

## 场景案例

### 1. 终端执行结果

对于脚本或命令行输出，应使用带语言高亮的 Markdown Block，并辅以说明性标题：

```javascript
const outputText = `**PowerShell 执行结果**\n\`\`\`powershell\n${rawStdout}\n\`\`\``;

const finalResult = {
  status: 'success',
  result: {
    content: [
      { type: 'text', text: outputText }
    ]
  }
};
console.log(JSON.stringify(finalResult));
```

### 2. 文件详情信息

对于键值对关联较强的属性信息，使用 Markdown List 展现：

```javascript
const markdownList = `**文件信息**: \`${fileData.name}\`
- **路径**: \`${fileData.path}\`
- **目录**: \`${fileData.directory}\`
- **类型**: ${fileData.type === 'directory' ? '目录' : '文件'}
- **大小**: ${fileData.sizeFormatted} (${fileData.size} Bytes)
- **修改时间**: ${new Date(fileData.lastModified).toLocaleString()}`;
```

### 3. 多项列表 / 内容索引

对于长条目的平铺，推荐使用 Markdown Table，方便模型建立空间与表格认知：

```javascript
let markdownTable = `| 名称 | 类型 | 大小 | 修改时间 | 隐藏 |\n|---|---|---|---|---|\n`;
for (const item of directoryItems) {
  const typeStr = item.type === 'directory' ? '目录' : '文件';
  const sizeStr = item.sizeFormatted || '-';
  const timeStr = new Date(item.lastModified).toLocaleString();
  const hiddenStr = item.isHidden ? '是' : '否';
  markdownTable += `| **${item.name}** | ${typeStr} | ${sizeStr} | ${timeStr} | ${hiddenStr} |\n`;
}
const outputText = `Directory listing of \`${dirPath}\`\n\n` + markdownTable;
```

### 4. 警告与拦截提示

如果在命令执行前后产生了前置警告、提示、或其他非致命阻断，可以使用 GitHub 风格的 Alert Banner 包裹并放在结果顶部：

```javascript
let finalContentText = resultOutput;
if (notice) {
  finalContentText = `> [!WARNING]\n> ${notice}\n\n` + finalContentText;
}

const finalResult = {
  status: 'success',
  result: {
    content: [
      { type: 'text', text: finalContentText }
    ]
  }
};
```

### 5. Mermaid 图 / 流程图

对于流程图、系统关系图、状态机等需要图形化理解的内容，应优先使用 Mermaid code block，而不是把图结构写成自由文本或 JSON 片段。

推荐写法：

```javascript
const mermaidText = `**VCP Agent Memory Loop**

\`\`\`mermaid
flowchart LR
    A["Codex / Agent 对话"] --> B["CodexMemoryBridge\\n入口治理"]
    B --> C["DailyNote /\\nDailyNoteWrite\\n结构化落盘"]
    C --> D["Embedding + SQLite +\\nVexusIndex\\n向量化与索引"]
    D --> E["KnowledgeBaseManager\\n总调度"]
    E --> F["RAGDiaryPlugin +\\nTagMemo\\n召回 / 标签增强\\n/ 去重 / 重排"]
    F --> G["当前推理与回答"]

    H["AgentDream 梦通道"] -. "独立通道" .-> C
    G --> A
\`\`\``;

const finalResult = {
  status: 'success',
  result: {
    content: [
      { type: 'text', text: mermaidText }
    ]
  }
};
```

Mermaid 输出约束：

- 必须通过 `type: 'text'` 包裹，不要把 Mermaid 内容再做 JSON 字符串二次转义。
- 必须使用 ` ```mermaid ` 代码块，不要用普通代码块替代。
- 节点文案应尽量短，可以使用 `\n` 控制换行，避免超长横向节点。
- 如果图中同时存在“主链”和“侧通道”，优先用实线 / 虚线区分语义。
- 如果图主要用于总览，而不是细算法说明，优先控制在 5 到 8 个节点。

不推荐的写法：

- 把 Mermaid 源文本写成转义满屏的 JSON 字符串
- 只提供节点列表，不给关系线
- 在一个 Mermaid 块中堆积过多节点，导致阅读和渲染都过载

## 为什么要这么做？

1. **Token 节省**：纯 Markdown 表格、列表相较于充满 `": "` 和 `},{` 控制字符的 JSON，会大幅稀释噪音符号。
2. **逻辑穿透力**：绝大多数先进 LLM 都在海量 Markdown 数据集上接受过指令微调。阅读代码高亮区和 Markdown 表格对它们来说更自然，可以显著降低长文理解中的注意力损耗。
3. **消除转义困扰**：利用 `type: 'text'` 这个统一管道传输 Markdown 源文本，可以避免二次 JSON 嵌套导致换行符变成字面意义上的 `\n`。
