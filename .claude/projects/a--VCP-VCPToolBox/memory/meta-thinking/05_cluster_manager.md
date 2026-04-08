---
name: 思维簇管理器插件
description: ThoughtClusterManager插件的实现
type: reference
---

# 思维簇管理器插件分析

**文件**：`Plugin/ThoughtClusterManager/ThoughtClusterManager.js`

---

## 插件功能概述

ThoughtClusterManager 是一个**命令行驱动**的思维簇管理器插件，提供以下功能：

| 命令 | 说明 | 输入 |
|------|------|------|
| `CreateClusterFile` | 创建新思维簇文件 | clusterName, content |
| `EditClusterFile` | 编辑思维簇文件 | clusterName, targetText, replacementText |

---

## 参数规范

### CreateClusterFile

```javascript
{
  "command": "CreateClusterFile",
  "clusterName": "逻辑推理簇",
  "content": "【思考模块：逻辑推理】\n【核心功能】..."
}
```

**参数要求**：
- `clusterName`：**必须**以"簇"结尾（如"逻辑推理簇"）
- `content`：要写入的内容

**创建逻辑**：
1. 清理簇名称：移除空格
2. 验证名称格式
3. 创建簇目录（递归）
4. 生成时间戳文件名：`2025-03-27T10-00-00-000Z.md`
5. 写入内容

### EditClusterFile

```javascript
{
  "command": "EditClusterFile",
  "clusterName": "逻辑推理簇",
  "targetText": "原内容",
  "replacementText": "新内容"
}
```

**参数要求**：
- `targetText`：**至少15个字符**长，用于定位要替换的文本
- `replacementText`：替换文本

**搜索逻辑**：
1. 如果指定 clusterName，只搜索该簇
2. 如果未指定，搜索所有以"簇"结尾的目录
3. 逐个文件读取，查找 targetText
4. 找到后替换并保存

---

## 完整命令格式

### 单命令格式
```json
{
  "command": "CreateClusterFile",
  "clusterName": "逻辑推理簇",
  "content": "【思考模块：逻辑推理】\n【核心功能】进行逻辑推演..."
}
```

### 批量命令格式
```json
{
  "command1": "CreateClusterFile",
  "clusterName1": "逻辑推理簇",
  "content1": "...",
  "command2": "EditClusterFile",
  "clusterName2": "反思簇",
  "targetText2": "旧内容",
  "replacementText2": "新内容"
}
```

---

## 核心实现

### 主入口

**位置**：`ThoughtClusterManager.js:6-40`

```javascript
async function main() {
    try {
        const input = await readStdin();
        const request = JSON.parse(input);

        // 检查是否为串行调用
        if (request.command1) {
            const results = await processBatchRequest(request);
            const overallSuccess = results.every(r => r.success);
            const report = results.map((r, i) =>
                `[Command ${i + 1}]: ${r.success ? 'SUCCESS' : 'FAILED'}\n  - Message: ${r.message || r.error}`
            ).join('\n\n');

            console.log(JSON.stringify({ status: overallSuccess ? 'success' : 'error', result: `Batch processing completed.\n\n${report}` }));
        } else {
            // 处理单个命令
            const { command, ...parameters } = request;
            let result;
            switch (command) {
                case 'CreateClusterFile':
                    result = await createClusterFile(parameters);
                    break;
                case 'EditClusterFile':
                    result = await editClusterFile(parameters);
                    break;
                default:
                    result = { success: false, error: `Unknown command: ${command}` };
            }
            console.log(JSON.stringify({ status: result.success ? 'success' : 'error', result: result.message || result.error }));
        }
    } catch (error) {
        console.log(JSON.stringify({ status: 'error', error: error.message }));
        process.exit(1);
    }
}
```

**输出格式**：
```json
{
  "status": "success",
  "result": "File created successfully at D:\\...\md"
}
```

---

### 创建簇文件

**位置**：`ThoughtClusterManager.js:42-66`

```javascript
async function createClusterFile({ clusterName, content }) {
    if (!clusterName || !content) {
        return { success: false, error: 'Missing required parameters: clusterName and content.' };
    }

    const cleanedClusterName = clusterName.replace(/\s/g, '');
    if (!cleanedClusterName.endsWith('簇')) {
        return { success: false, error: "Folder name must end with '簇'." };
    }

    try {
        const clusterPath = path.join(DAILYNOTE_DIR, cleanedClusterName);
        await fs.mkdir(clusterPath, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${timestamp}.md`;
        const filePath = path.join(clusterPath, fileName);

        await fs.writeFile(filePath, content, 'utf8');

        return { success: true, message: `File created successfully at ${filePath}` };
    } catch (error) {
        return { success: false, error: `Failed to create file: ${error.message}` };
    }
}
```

**关键点**：
1. **清理名称**：移除空格
2. **验证格式**：必须以"簇"结尾
3. **递归创建**：`mkdir(..., { recursive: true })`
4. **时间戳命名**：`2025-10-13T09-10-24-022Z.md`

---

### 编辑簇文件

**位置**：`ThoughtClusterManager.js:80-129`

```javascript
async function editClusterFile({ clusterName, targetText, replacementText }) {
    if (!targetText || !replacementText) {
        return { success: false, error: 'Missing required parameters: targetText and replacementText.' };
    }
    if (targetText.length < 15) {
        return { success: false, error: 'targetText must be at least 15 characters long.' };
    }

    try {
        const searchPaths = [];
        if (clusterName) {
            const cleanedClusterName = clusterName.replace(/\s/g, '');
            if (!cleanedClusterName.endsWith('簇')) {
                return { success: false, error: "Folder name must end with '簇'." };
            }
            searchPaths.push(path.join(DAILYNOTE_DIR, cleanedClusterName));
        } else {
            // 搜索所有簇目录
            const allDirs = await fs.readdir(DAILYNOTE_DIR, { withFileTypes: true });
            for (const dirent of allDirs) {
                if (dirent.isDirectory() && dirent.name.endsWith('簇')) {
                    searchPaths.push(path.join(DAILYNOTE_DIR, dirent.name));
                }
            }
        }

        if (searchPaths.length === 0) {
            return { success: false, error: 'No cluster folders found to search in.' };
        }

        // 遍历所有文件
        for (const dirPath of searchPaths) {
            const files = await fs.readdir(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    const content = await fs.readFile(filePath, 'utf8');
                    if (content.includes(targetText)) {
                        const newContent = content.replace(targetText, replacementText);
                        await fs.writeFile(filePath, newContent, 'utf8');
                        return { success: true, message: `File updated successfully at ${filePath}` };
                    }
                }
            }
        }

        return { success: false, error: 'Target text not found in any file.' };
    } catch (error) {
        return { success: false, error: `Failed to edit file: ${error.message}` };
    }
}
```

**搜索范围**：
1. **指定簇**：只搜索指定的簇目录
2. **所有簇**：搜索所有以"簇"结尾的目录

**查找逻辑**：
1. 读取文件内容
2. 检查 targetText 是否存在
3. 替换内容
4. 保存文件
5. 返回成功

---

### 批量处理

**位置**：`ThoughtClusterManager.js:131-158`

```javascript
async function processBatchRequest(request) {
    const results = [];
    let i = 1;
    while (request[`command${i}`]) {
        const command = request[`command${i}`];
        const parameters = {
            clusterName: request[`clusterName${i}`],
            content: request[`content${i}`],
            targetText: request[`targetText${i}`],
            replacementText: request[`replacementText${i}`]
        };

        let result;
        switch (command) {
            case 'CreateClusterFile':
                result = await createClusterFile(parameters);
                break;
            case 'EditClusterFile':
                result = await editClusterFile(parameters);
                break;
            default:
                result = { success: false, error: `Unknown command: ${command}` };
        }
        results.push(result);
        i++;
    }
    return results;
}
```

**输出格式**：
```json
{
  "status": "success",
  "result": "[Command 1]: SUCCESS\n  - Message: File created...\n\n[Command 2]: SUCCESS\n  - Message: File updated..."
}
```

---

## 使用示例

### 示例1：创建新思维簇

```javascript
// stdin 输入：
{
  "command": "CreateClusterFile",
  "clusterName": "代码优化簇",
  "content": "【思考模块：代码优化】\n【触发条件】检测到代码重复或性能瓶颈时触发\n【核心功能】\n1. 识别可优化的代码模式\n2. 提出重构建议\n3. 提供性能优化方案"
}

// stdout 输出：
{
  "status": "success",
  "result": "File created successfully at D:\\...\代码优化簇\\2025-03-27T10-00-00-000Z.md"
}
```

### 示例2：编辑现有文件

```javascript
// stdin 输入：
{
  "command": "EditClusterFile",
  "clusterName": "代码优化簇",
  "targetText": "识别可优化的代码模式",
  "replacementText": "识别并分析可优化的代码模式"
}

// stdout 输出：
{
  "status": "success",
  "result": "File updated successfully at D:\\...\代码优化簇\\2025-03-27T10-00-00-000Z.md"
}
```

### 示例3：批量操作

```javascript
// stdin 输入：
{
  "command1": "CreateClusterFile",
  "clusterName1": "性能分析簇",
  "content1": "【思考模块：性能分析】...",
  "command2": "CreateClusterFile",
  "clusterName2": "内存优化簇",
  "content2": "【思考模块：内存优化】...",
  "command3": "EditClusterFile",
  "clusterName3": "",
  "targetText3": "核心功能",
  "replacementText3": "【核心功能】"
}

// stdout 输出：
{
  "status": "success",
  "result": "[Command 1]: SUCCESS\n  - Message: File created...\n\n[Command 2]: SUCCESS\n  - Message: File created...\n\n[Command 3]: FAILED\n  - Message: Target text not found..."
}
```

---

## 集成方式

### 通过 AdminPanel 集成

AdminPanel 中的思维簇管理面板可以通过调用 ThoughtClusterManager 来：

1. **创建新簇**：调用 `CreateClusterFile`
2. **批量创建**：调用 `processBatchRequest`
3. **快速编辑**：调用 `EditClusterFile`

### 通过命令行调用

```bash
# Windows PowerShell
echo '{"command":"CreateClusterFile","clusterName":"测试簇","content":"内容"}' | node Plugin/ThoughtClusterManager/ThoughtClusterManager.js

# Linux/macOS
echo '{"command":"CreateClusterFile","clusterName":"测试簇","content":"内容"}' | node Plugin/ThoughtClusterManager/ThoughtClusterManager.js
```

---

## 错误处理

### 参数缺失
```json
{
  "status": "error",
  "error": "Missing required parameters: clusterName and content."
}
```

### 格式错误
```json
{
  "status": "error",
  "error": "Folder name must end with '簇'."
}
```

### 文本未找到
```json
{
  "status": "error",
  "error": "Target text not found in any file."
}
```

### 寻找文件夹失败
```json
{
  "status": "error",
  "error": "No cluster folders found to search in."
}
```

---

## 安全考虑

### 输入验证
1. **空值检查**：检查 required 参数是否为空
2. **格式验证**：检查 clusterName 是否以"簇"结尾
3. **长度检查**：targetText 至少15个字符

### 文件系统安全
1. **路径处理**：使用 `path.join()` 避免路径遍历
2. **递归创建**：mkdir 设置 `recursive: true`
3. **文件类型检查**：stat.isFile() 确保是文件

---

## 与 AdminPanel 的配合

### AdminPanel 调用流程

```javascript
// AdminPanel/js/rags.js
async function createCluster() {
    const clusterName = prompt('请输入新思维簇名称（必须以"簇"结尾）：');
    if (!clusterName || !clusterName.trim()) return;

    const content = document.querySelector('#cluster-content').value;

    try {
        const response = await fetch('/admin_api/thought-cluster', {
            method: 'POST',
            body: JSON.stringify({
                command: 'CreateClusterFile',
                clusterName,
                content
            })
        });

        const result = await response.json();
        showMessage(result.status === 'success' ? '创建成功！' : `创建失败: ${result.error}`);
    } catch (error) {
        showMessage(`操作失败: ${error.message}`);
    }
}
```

---

## 文件结构

```
dailynote/
├── 前思维簇/
│   ├── 2025-03-27T10-00-00-000Z.md  ← 创建的簇文件
│   └── 2025-03-27T11-00-00-000Z.md
├── 逻辑推理簇/
│   ├── 2025-03-27T10-00-00-000Z.md
│   └── 2025-03-27T10-30-00-000Z.md  ← 编辑的簇文件
└── 反思簇/
    └── ...
```

---

## 参考

- `Plugin/ThoughtClusterManager/ThoughtClusterManager.js` - 完整实现
- `routes/admin/rag.js` - API路由
- `dailynote/` - 思维簇存储目录
