---
name: 元思维系统执行机制
description: VCP元思维系统的完整执行流程
type: reference
---

# 元思维系统完整执行流程

## 执行流程图

```
用户请求
    │
    ├─→ chatCompletionHandler.js 接收请求
    │
    ├─→ messageProcessor.js 变量展开
    │   │
    │   └─→ [[VCP元思考:xxx]] 占位符识别
    │
    ├─→ RAGDiaryPlugin.processMessages()
    │   │
    │   ├─→ ContextVectorManager.updateContext()
    │   │   └─→ 维护历史消息的向量映射
    │   │
    │   ├─→ SemanticGroup.detectAndActivateGroups()
    │   │   └─→ 匹配词元组，激活语义组
    │   │
    │   ├─→ ContextVectorManager.segmentContext()
    │   │   └─→ 基于语义相似度分段
    │   │
    │   ├─→ _calculateDynamicParams()
    │   │   └─→ 计算 L, R, S 参数
    │   │
    │   ├─→ metaThinkingManager.processMetaThinkingChain()
    │   │   │
    │   │   ├─→ 加载配置（如果有缓存则跳过）
    │   │   ├─→ Auto模式：根据相似度选择主题
    │   │   ├─→ 获取链配置：clusters + kSequence
    │   │   ├─→ 语义组增强（如果启用）
    │   │   │
    │   │   └─→ 递归遍历每个思维簇：
    │   │       │
    │   │       ├─→ vectorDBManager.search(cluster, vector, k)
    │   │       │   └─→ 检索top-k个元逻辑模块
    │   │       │
    │   │       ├─→ 计算结果向量的平均值
    │   │       │
    │   │       └─→ 向量融合：0.8*query + 0.2*resultAvg
    │   │           └─→ 为下一阶段准备新的查询向量
    │   │
    │   └─→ 格式化结果并替换占位符
    │
    └─→ broadcastVCPInfo() → WebSocket推送给前端
        │
        └─→ 前端显示：META_THINKING_CHAIN 类型信息
```

---

## 详细执行步骤

### 步骤1：detectAndActivateGroups - 词元组匹配

**位置**：`SemanticGroupManager.js:274-297`

```javascript
detectAndActivateGroups(text) {
    const activatedGroups = new Map();

    for (const [groupName, groupData] of Object.entries(this.groups)) {
        const autoLearnedWords = groupData.auto_learned || [];
        const allWords = [...groupData.words, ...autoLearnedWords];

        // 匹配词元
        const matchedWords = allWords.filter(word => this.flexibleMatch(text, word));

        if (matchedWords.length > 0) {
            // 计算激活强度：匹配词元数 / 总词元数
            const activationStrength = matchedWords.length / allWords.length;

            activatedGroups.set(groupName, {
                strength: activationStrength,
                matchedWords: matchedWords,
                allWords: allWords
            });
        }
    }

    return activatedGroups;
}
```

**关键点**：
- 包含大小写不敏感的模糊匹配
- 激活强度 = 匹配词元数 / 总词元数
- 记录最后激活时间和激活次数

---

### 步骤2：getEnhancedVector - 向量增强

**位置**：`SemanticGroupManager.js:397-434`

```javascript
async getEnhancedVector(originalQuery, activatedGroups, precomputedQueryVector = null) {
    let queryVector = precomputedQueryVector;

    if (!queryVector) {
        // 生成查询向量
        queryVector = await this.ragPlugin.getSingleEmbeddingCached(originalQuery);
    }

    if (activatedGroups.size === 0) {
        return queryVector; // 无激活组，直接返回原始向量
    }

    // 构建加权向量列表
    const vectors = [queryVector];
    const weights = [1.0]; // 原始查询权重

    for (const [groupName, data] of activatedGroups) {
        const groupVector = this.groupVectorCache.get(groupName);
        if (groupVector) {
            vectors.push(groupVector);
            // 权重 = 组全局权重 × 激活强度
            const groupWeight = (this.groups[groupName].weight || 1.0) * data.strength;
            weights.push(groupWeight);
        }
    }

    // 加权平均
    const enhancedVector = this.weightedAverageVectors(vectors, weights);
    return enhancedVector;
}
```

**示例**：
```
用户输入: "上周的项目进展如何？"

语义组匹配结果：
- "项目管理"组：匹配词元["项目", "进展"]，强度=2/5=40%
- "时间规划"组：匹配词元["上周"]，强度=1/4=25%

向量融合：
queryVector = Embedding("上周的项目进展如何？")
projectVector = [缓存的项目管理向量]
timeVector = [缓存的时间规划向量]

enhancedVector =
    1.0 * queryVector(0.70)
  + 0.40 * projectVector(0.14)
  + 0.25 * timeVector(0.09)
  = 加权平均
```

---

### 步骤3：processMetaThinkingChain - 元思考链执行

**位置**：`MetaThinkingManager.js:106-328`

```javascript
async processMetaThinkingChain(
    chainName, queryVector, userContent, aiContent,
    combinedQueryForDisplay, kSequence, useGroup,
    isAutoMode = false, autoThreshold = 0.65
) {
    // 1. 加载配置（兜底）
    if (!this.metaThinkingChains.chains || Object.keys(...).length === 0) {
        await this.loadConfig();
    }

    // 2. Auto模式：选择最匹配的主题
    if (isAutoMode) {
        let bestChain = 'default';
        let maxSimilarity = -1;

        for (const [themeName, themeVector] of themeEntries) {
            const similarity = this.ragPlugin.cosineSimilarity(queryVector, themeVector);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                bestChain = themeName;
            }
        }

        if (maxSimilarity >= autoThreshold) {
            finalChainName = bestChain;
        } else {
            finalChainName = 'default';
        }
    }

    // 3. 获取链配置
    const chainConfig = this.metaThinkingChains.chains[finalChainName];
    const chain = chainConfig.clusters; // ["前思维簇", "逻辑推理簇", ...]
    const finalKSequence = chainConfig.kSequence; // [2, 1, 1, 1, 1]

    // 4. 语义组增强
    if (useGroup) {
        const activatedGroups = this.ragPlugin.semanticGroups.detectAndActivateGroups(userContent);
        if (activatedGroups.size > 0) {
            const enhancedVector = await this.ragPlugin.semanticGroups.getEnhancedVector(
                userContent, activatedGroups, currentQueryVector
            );
            if (enhancedVector) {
                currentQueryVector = enhancedVector;
            }
        }
    }

    // 5. 递归遍历每个思维簇
    for (let i = 0; i < chain.length; i++) {
        const clusterName = chain[i];
        const k = finalKSequence[i];

        // 检索思维簇
        const searchResults = await this.ragPlugin.vectorDBManager.search(
            clusterName, currentQueryVector, k
        );

        // 计算结果向量的平均值
        const resultVectors = [];
        for (const result of searchResults) {
            let vector = result.vector;
            if (!vector) {
                vector = await this.ragPlugin.vectorDBManager.getVectorByText(clusterName, result.text);
            }
            if (vector) {
                resultVectors.push(Array.isArray(vector) ? vector : JSON.parse(vector));
            }
        }

        if (resultVectors.length > 0) {
            const avgResultVector = this._getAverageVector(resultVectors);

            // 向量融合：0.8 * query + 0.2 * resultAvg
            const metaWeights = config.metaThinkingWeights || [0.8, 0.2];
            currentQueryVector = this.ragPlugin._getWeightedAverageVector(
                [queryVector, avgResultVector],
                metaWeights
            );
        }
    }

    // 6. 格式化结果
    return this._formatMetaThinkingResults(chainResults, finalChainName, ...);
}
```

---

### 步骤4：_formatMetaThinkingResults - 结果格式化

**位置**：`MetaThinkingManager.js:356-397`

```javascript
_formatMetaThinkingResults(chainResults, chainName, activatedGroups, isAutoMode) {
    let content = `\n[--- VCP元思考链: "${chainName}" ${isAutoMode ? '(Auto模式)' : ''} ---]\n`;

    // 语义组信息
    if (activatedGroups && activatedGroups.size > 0) {
        content += `[语义组增强: ${Array.from(activatedGroups.keys()).join(', ')}]\n`;
    }

    // 推理链路径
    content += `[推理链路径: ${chainResults.map(r => r.clusterName).join(' → ')}]\n\n`;

    // 每个阶段的结果
    for (const stageResult of chainResults) {
        content += `【阶段${stageResult.stage}: ${stageResult.clusterName}】\n`;

        if (stageResult.results.length === 0) {
            content += `  [未找到匹配的元逻辑模块]\n`;
        } else {
            content += `  [召回 ${stageResult.results.length} 个元逻辑模块]\n`;
            for (const result of stageResult.results) {
                content += `  * ${result.text.trim()}\n`;
            }
        }
        content += '\n';
    }

    content += `[--- 元思考链结束 ---]\n`;
    return content;
}
```

**输出示例**：

```
[--- VCP元思考链: "default" ---]
[语义组增强: 项目管理(40%), 时间规划(25%)]
[推理链路径: 前思维簇 → 逻辑推理簇 → 反思簇 → 结果辩证簇 → 陈词总结梳理簇]

【阶段1: 前思维簇】
  [召回 2 个元逻辑模块]
  * 【思考模块】意图识别与资源预检
  * 【思考模块】任务复杂度评估

【阶段2: 逻辑推理簇】
  [召回 1 个元逻辑模块]
  * 【思考模块】跨域类比：项目管理与软件开发

【阶段3: 反思簇】
  [召回 1 个元逻辑模块]
  * 【思考模块】一致性校验：时间与质量的平衡

【阶段4: 结果辩证簇】
  [召回 1 个元逻辑模块]
  * 【思考模块】认知失调调和：进度与风险的权衡

【阶段5: 陈词总结梳理簇】
  [召回 1 个元逻辑模块]
  * 【思考模块】知识归档：项目经验沉淀

[--- 元思考链结束 ---]
```

---

## VCP Info广播

**位置**：`MetaThinkingManager.js:298-318`

```javascript
// VCP Info 广播：发送完整的思维链执行详情
if (this.ragPlugin.pushVcpInfo) {
    vcpInfoData = {
        type: 'META_THINKING_CHAIN',
        chainName: finalChainName,
        query: combinedQueryForDisplay,
        useGroup,
        activatedGroups: activatedGroups ? Array.from(activatedGroups.keys()) : [],
        stages: chainDetailedInfo, // 详细信息
        totalStages: chain.length,
        kSequence: finalKSequence
    };
    this.ragPlugin.pushVcpInfo(vcpInfoData);
}
```

**前端接收的数据结构**：

```json
{
  "type": "META_THINKING_CHAIN",
  "chainName": "default",
  "query": "上周的项目进展如何？",
  "useGroup": true,
  "activatedGroups": ["项目管理", "时间规划"],
  "stages": [
    {
      "stage": 1,
      "clusterName": "前思维簇",
      "k": 2,
      "resultCount": 2,
      "results": [
        {"text": "【思考模块】意图识别...", "score": 0.85},
        {"text": "【思考模块】资源预检...", "score": 0.78}
      ]
    },
    ...
  ],
  "totalStages": 5,
  "kSequence": [2, 1, 1, 1, 1]
}
```

---

## 性能优化

### 1. 缓存机制

```javascript
// 生成缓存键
const cacheKey = this.ragPlugin._generateCacheKey({
    userContent,
    aiContent,
    chainName,
    kSequence,
    useGroup,
    isAutoMode
});

// 检查缓存
const cachedResult = this.ragPlugin._getCachedResult(cacheKey);
if (cachedResult) {
    return cachedResult.content; // 直接返回缓存
}
```

### 2. 语义组向量预计算

**位置**：`SemanticGroupManager.js:322-394`

```javascript
async precomputeGroupVectors() {
    for (const [groupName, groupData] of Object.entries(this.groups)) {
        const allWords = [...groupData.words, ...groupData.auto_learned];
        const groupDescription = `${groupName}相关主题：${allWords.join(', ')}`;

        // 请求 Embedding API
        const vector = await this.ragPlugin.getSingleEmbeddingCached(groupDescription);

        // 保存到向量文件
        const vectorId = crypto.randomUUID();
        const vectorPath = path.join(this.vectorsDirPath, `${vectorId}.json`);
        await fs.writeFile(vectorPath, JSON.stringify(vector), 'utf-8');

        // 缓存到内存
        this.groupVectorCache.set(groupName, vector);
    }
}
```

**优势**：
- 向量只计算一次，多次复用
- 内存缓存 + 磁盘文件双重存储

---

## 配套参数

**rag_params.json**：

```json
{
  "RAGDiaryPlugin": {
    "mainSearchWeights": [0.7, 0.3],
    "metaThinkingWeights": [0.8, 0.2],
    "refreshWeights": [0.5, 0.35, 0.15],
    "tagWeightRange": [0.05, 0.45],
    "noise_penalty": 0.05
  }
}
```

**关键参数**：
- `metaThinkingWeights`: 元思维向量融合权重 [query, resultAvg]
- `mainSearchWeights`: 主检索权重 [user, ai]
- `refreshWeights`: 刷新权重 [user, ai, tool]

---

## 参考

- `Plugin/RAGDiaryPlugin/MetaThinkingManager.js:106-328` - 主执行流程
- `Plugin/RAGDiaryPlugin/SemanticGroupManager.js:274-460` - 语义组增强
- `Plugin/RAGDiaryPlugin/RAGDiaryPlugin.js:1284-1355` - 占位符解析
- `Plugin/RAGDiaryPlugin/ContextVectorManager.js:310-452` - 语义分段
