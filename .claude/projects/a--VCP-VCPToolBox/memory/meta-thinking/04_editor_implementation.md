---
name: 思维簇编辑器实现
description: AdminPanel思维链编辑器的完整实现
type: reference
---

# AdminPanel 思维链编辑器实现分析

**文件**：`AdminPanel/js/thinking-chains-editor.js`

---

## 模块结构

```javascript
import { apiFetch, showMessage } from './utils.js';

const API_BASE_URL = '/admin_api';
let thinkingChainsData = {};
let availableClusters = [];

export async function initializeThinkingChainsEditor() {...}
function setupEventListeners() {...}
function renderThinkingChainsEditor(container) {...}
function createThemeElement(themeName, chainConfig) {...}
function createChainItemElement(clusterName, index) {...}
function setupDragAndDrop(listElement) {...}
async function saveThinkingChains() {...}
function addNewThinkingChainTheme() {...}
```

---

## 初始化流程

**位置**：`thinking-chains-editor.js:11-36`

```javascript
export async function initializeThinkingChainsEditor() {
    console.log('Initializing Thinking Chains Editor...');
    const container = document.getElementById('thinking-chains-container');
    const statusSpan = document.getElementById('thinking-chains-status');
    if (!container || !statusSpan) return;

    container.innerHTML = '<p>正在加载思维链配置...</p>';
    statusSpan.textContent = '';

    setupEventListeners();

    try {
        // 并行加载配置和可用簇
        const [chainsResponse, clustersResponse] = await Promise.all([
            apiFetch(`${API_BASE_URL}/thinking-chains`),
            apiFetch(`${API_BASE_URL}/available-clusters`)
        ]);

        thinkingChainsData = chainsResponse;
        availableClusters = clustersResponse.clusters || [];

        renderThinkingChainsEditor(container);

    } catch (error) {
        container.innerHTML = `<p class="error-message">加载思维链配置失败: ${error.message}</p>`;
    }
}
```

**API端点**：
1. `/admin_api/thinking-chains` - GET: 获取思维链配置
2. `/admin_api/available-clusters` - GET: 获取所有可用的思维簇

---

## 事件绑定

**位置**：`thinking-chains-editor.js:41-53`

```javascript
function setupEventListeners() {
    const saveThinkingChainsButton = document.getElementById('save-thinking-chains-button');
    const addThinkingChainThemeButton = document.getElementById('add-thinking-chain-theme-button');

    if (saveThinkingChainsButton && !saveThinkingChainsButton.dataset.listenerAttached) {
        saveThinkingChainsButton.addEventListener('click', saveThinkingChains);
        saveThinkingChainsButton.dataset.listenerAttached = 'true';
    }
    if (addThinkingChainThemeButton && !addThinkingChainThemeButton.dataset.listenerAttached) {
        addThinkingChainThemeButton.addEventListener('click', addNewThinkingChainTheme);
        addThinkingChainThemeButton.dataset.listenerAttached = 'true';
    }
}
```

---

## UI渲染

**位置**：`thinking-chains-editor.js:55-80`

```javascript
function renderThinkingChainsEditor(container) {
    container.innerHTML = '';
    const themes = thinkingChainsData.chains || {}; // { "default": {...}, "creative_writing": {...} }

    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'thinking-chains-editor-wrapper';

    const themesContainer = document.createElement('div');
    themesContainer.id = 'thinking-chains-themes-container';
    themesContainer.className = 'thinking-chains-themes-container';

    if (Object.keys(themes).length === 0) {
        themesContainer.innerHTML = '<p>没有找到任何思维链主题。请点击"添加新主题"来创建一个。</p>';
    } else {
        for (const themeName in themes) {
            const themeElement = createThemeElement(themeName, themes[themeName]);
            themesContainer.appendChild(themeElement);
        }
    }

    const availableClustersElement = createAvailableClustersElement();
    editorWrapper.appendChild(themesContainer);
    editorWrapper.appendChild(availableClustersElement);
    container.appendChild(editorWrapper);
}
```

**UI结构**：
```
┌────────────────────────────────────────────────────────────────────────────┐
│ thinking-chains-editor-wrapper                                             │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ thinking-chains-themes-container                                       │ │
│ │ ┌──────────────────────────────────────────────────────────────┐       │ │
│ │ │ theme-details (for "default")                                │       │ │
│ │ │ ├─ theme-summary                                              │       │ │
│ │ │ │  ├─ theme-name-display: "主题: default"                    │       │ │
│ │ │ │  └─ delete-theme-btn: "删除该主题"                         │       │ │
│ │ │ └─ theme-content                                              │       │ │
│ │ │    ├─ k-sequence-editor                                       │       │ │
│ │ │    │  ├─ h4: "K值序列配置"                                    │       │ │
│ │ │    │  └─ k-sequence-inputs (data-theme-name="default")      │       │ │
│ │ │    │     ├─ k-value-input-group: "前思维簇: [2] 检索数量"   │       │ │
│ │ │    │     └─ k-value-input-group: "逻辑推理簇: [1] 检索数量" │       │ │
│ │ │    └─ theme-chain-list (draggable-list)                      │       │ │
│ │ │       ├─ chain-item: "前思维簇 ×"                            │       │ │
│ │ │       └─ chain-item: "逻辑推理簇 ×"                          │       │ │
│ │ └──────────────────────────────────────────────────────────────┘       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ available-clusters-container                                         │ │
│ │ ├─ h3: "可用的思维簇模块"                                              │ │
│ │ └─ available-clusters-list (draggable-list)                          │ │
│ │    ├─ chain-item: "《前思维簇》"                                       │ │
│ │    ├─ chain-item: "《逻辑推理簇》"                                     │ │
│ │    └─ chain-item: "《反思簇》"                                         │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 主题元素创建

**位置**：`thinking-chains-editor.js:82-148`

```javascript
function createThemeElement(themeName, chainConfig) {
    const details = document.createElement('details');
    details.className = 'theme-details';
    details.open = true;
    details.dataset.themeName = themeName;

    // 支持新旧格式
    let clusters, kSequence;
    if (Array.isArray(chainConfig)) {
        // 旧格式：直接是簇数组
        clusters = chainConfig;
        kSequence = new Array(clusters.length).fill(1);
    } else if (chainConfig && chainConfig.clusters) {
        // 新格式：包含clusters和kSequence的对象
        clusters = chainConfig.clusters || [];
        kSequence = chainConfig.kSequence || new Array(clusters.length).fill(1);
    } else {
        clusters = [];
        kSequence = [];
    }

    details.innerHTML = `
        <summary class="theme-summary">
            <span class="theme-name-display">主题: ${themeName}</span>
            <button class="delete-theme-btn">删除该主题</button>
        </summary>
        <div class="theme-content">
            <div class="k-sequence-editor">
                <h4>K值序列配置</h4>
                <p class="description">每个思维簇对应的检索数量（K值）</p>
                <div class="k-sequence-inputs" data-theme-name="${themeName}"></div>
            </div>
            <ul class="draggable-list theme-chain-list" data-theme-name="${themeName}"></ul>
        </div>
    `;

    const chainList = details.querySelector('.theme-chain-list');
    const kSequenceInputs = details.querySelector('.k-sequence-inputs');

    if (clusters.length > 0) {
        clusters.forEach((clusterName, index) => {
            const listItem = createChainItemElement(clusterName, index);
            chainList.appendChild(listItem);

            // 创建对应的K值输入框
            const kInput = createKValueInput(clusterName, kSequence[index] || 1, index);
            kSequenceInputs.appendChild(kInput);
        });
    } else {
        // 空状态提示
        const placeholder = document.createElement('li');
        placeholder.className = 'drop-placeholder';
        placeholder.textContent = '将思维簇拖拽到此处';
        chainList.appendChild(placeholder);

        kSequenceInputs.innerHTML = '<p class="no-clusters-message">添加思维簇后将显示K值配置</p>';
    }

    // 删除主题按钮事件
    details.querySelector('.delete-theme-btn').onclick = (e) => {
        e.preventDefault();
        if (confirm(`确定要删除主题 "${themeName}" 吗？`)) {
            details.remove();
        }
    };

    setupDragAndDrop(chainList);
    return details;
}
```

**支持格式**：
1. **旧格式**：`["前思维簇", "逻辑推理簇", "反思簇"]`
2. **新格式**：
   ```json
   {
     "clusters": ["前思维簇", "逻辑推理簇", "反思簇"],
     "kSequence": [2, 1, 1]
   }
   ```

---

## K值输入框

**位置**：`thinking-chains-editor.js:214-227`

```javascript
function createKValueInput(clusterName, kValue, index) {
    const div = document.createElement('div');
    div.className = 'k-value-input-group';
    div.dataset.clusterName = clusterName;
    div.dataset.index = index;

    div.innerHTML = `
        <label class="k-value-label">${clusterName}:</label>
        <input type="number" class="k-value-input" min="1" max="20" value="${kValue}" data-cluster="${clusterName}">
        <span class="k-value-hint">检索数量</span>
    `;

    return div;
}
```

---

## 可用簇列表

**位置**：`thinking-chains-editor.js:259-277`

```javascript
function createAvailableClustersElement() {
    const container = document.createElement('div');
    container.className = 'available-clusters-container';

    container.innerHTML = `
        <h3>可用的思维簇模块</h3>
        <p class="description">将模块从这里拖拽到左侧的主题列表中。</p>
        <ul class="draggable-list available-clusters-list"></ul>
    `;

    const list = container.querySelector('.available-clusters-list');
    availableClusters.forEach(clusterName => {
        const listItem = createChainItemElement(clusterName);
        listItem.querySelector('.remove-cluster-btn').remove(); // These are templates, not removable
        list.appendChild(listItem);
    });

    return container;
}
```

---

## 链项元素创建

**位置**：`thinking-chains-editor.js:150-209`

```javascript
function createChainItemElement(clusterName, index = null) {
    const li = document.createElement('li');
    li.className = 'chain-item';
    li.draggable = true;
    li.dataset.clusterName = clusterName;
    if (index !== null) {
        li.dataset.index = index;
    }

    li.innerHTML = `<span class="cluster-name">${clusterName}</span>`;

    // 只有已经添加到主题的簇才显示删除按钮
    if (index !== null) {
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'remove-cluster-btn';
        removeBtn.onclick = () => {
            const themeDetails = li.closest('.theme-details');
            li.remove();
            updateKSequenceInputs(themeDetails);
        };
        li.appendChild(removeBtn);
    }

    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', clusterName);
        e.dataTransfer.effectAllowed = 'move';

        setTimeout(() => {
            li.classList.add('dragging');

            // 如果是从可用模块拖拽，创建一个占位符
            const isFromAvailable = !li.querySelector('.remove-cluster-btn');
            if (isFromAvailable) {
                const placeholder = document.createElement('li');
                placeholder.className = 'dragging-placeholder';
                placeholder.textContent = clusterName;
                li.dataset.placeholder = 'true';
                document.body.appendChild(placeholder);
            }
        }, 0);
    });

    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');

        const placeholder = document.querySelector('.dragging-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        delete li.dataset.placeholder;

        updateKSequenceInputs(li.closest('.theme-details'));
    });

    return li;
}
```

**拖拽状态**：
- **dragging**: 拖拽中
- **placeholder**: 占位符（从可用模块拖拽时）

---

## 拖拽排序

**位置**：`thinking-chains-editor.js:279-358`

```javascript
function setupDragAndDrop(listElement) {
    listElement.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');

        if (!dragging) return;

        const isFromAvailable = dragging.dataset.placeholder === 'true';
        const isInSameList = dragging.parentNode === listElement;

        if (isFromAvailable) {
            // 从可用模块拖拽：使用占位符显示位置
            const placeholder = document.querySelector('.dragging-placeholder');
            if (placeholder) {
                const afterElement = getDragAfterElement(listElement, e.clientY);
                if (afterElement == null) {
                    listElement.appendChild(placeholder);
                } else {
                    listElement.insertBefore(placeholder, afterElement);
                }
            }
        } else if (isInSameList) {
            // 同列表内排序：移动实际元素
            const afterElement = getDragAfterElement(listElement, e.clientY);
            if (afterElement == null) {
                listElement.appendChild(dragging);
            } else {
                listElement.insertBefore(dragging, afterElement);
            }
        }
    });

    listElement.addEventListener('drop', e => {
        e.preventDefault();
        const clusterName = e.dataTransfer.getData('text/plain');
        const dragging = document.querySelector('.dragging');

        if (!dragging) return;

        const isFromAvailable = dragging.dataset.placeholder === 'true';
        const isInSameList = dragging.parentNode === listElement;

        if (isFromAvailable) {
            // 从可用模块拖拽到主题列表
            listElement.querySelector('.drop-placeholder')?.remove();

            const alreadyExists = [...listElement.querySelectorAll('.chain-item')]
                                     .some(item => item.dataset.clusterName === clusterName);

            if (clusterName && !alreadyExists) {
                const newItem = createChainItemElement(clusterName);

                const afterElement = getDragAfterElement(listElement, e.clientY);

                if (afterElement == null) {
                    listElement.appendChild(newItem);
                } else {
                    listElement.insertBefore(newItem, afterElement);
                }

                dragging.remove();
                updateKSequenceInputs(listElement.closest('.theme-details'));
            } else {
                dragging.remove();
            }

            // 更新可用簇列表
            const editorContainer = document.getElementById('thinking-chains-container');
            const oldAvailableContainer = editorContainer.querySelector('.available-clusters-container');
            if (oldAvailableContainer) {
                const newAvailableContainer = createAvailableClustersElement();
                oldAvailableContainer.replaceWith(newAvailableContainer);
            }
        } else if (isInSameList) {
            // 同列表内排序，已经在dragover中完成了位置更新
            updateKSequenceInputs(listElement.closest('.theme-details'));
        }
    });
}
```

**拖拽场景**：
1. **从可用模块拖拽**：创建新项，更新可用列表
2. **同列表内排序**：移动现有项

---

## K值输入框更新

**位置**：`thinking-chains-editor.js:232-257`

```javascript
function updateKSequenceInputs(themeDetails) {
    if (!themeDetails) return;

    const kSequenceInputs = themeDetails.querySelector('.k-sequence-inputs');
    const chainItems = themeDetails.querySelectorAll('.chain-item');

    if (!kSequenceInputs) return;

    // 清空现有输入框
    kSequenceInputs.innerHTML = '';

    if (chainItems.length === 0) {
        kSequenceInputs.innerHTML = '<p class="no-clusters-message">添加思维簇后将显示K值配置</p>';
        return;
    }

    // 为每个簇创建K值输入框
    chainItems.forEach((item, index) => {
        const clusterName = item.dataset.clusterName;
        const existingInput = kSequenceInputs.querySelector(`[data-cluster="${clusterName}"]`);
        const kValue = existingInput ? existingInput.value : 1;

        const kInput = createKValueInput(clusterName, kValue, index);
        kSequenceInputs.appendChild(kInput);
    });
}
```

**功能**：动态更新 K 值输入框，确保与链项数量一致

---

## 拖拽位置计算

**位置**：`thinking-chains-editor.js:360-371`

```javascript
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.dragging):not(.drop-placeholder)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
```

**算法**：
1. 计算每个元素的中心点
2. 找到最接近鼠标位置的元素
3. 返回插入位置

---

## 保存配置

**位置**：`thinking-chains-editor.js:373-415`

```javascript
async function saveThinkingChains() {
    const container = document.getElementById('thinking-chains-container');
    const statusSpan = document.getElementById('thinking-chains-status');
    if (!container || !statusSpan) return;

    const newChains = {};
    container.querySelectorAll('.theme-details').forEach(el => {
        const themeName = el.dataset.themeName;
        const clusters = [...el.querySelectorAll('.chain-item')].map(item => item.dataset.clusterName);

        // 收集K值序列
        const kSequence = [];
        const kInputs = el.querySelectorAll('.k-value-input');
        kInputs.forEach(input => {
            const kValue = parseInt(input.value) || 1;
            kSequence.push(Math.max(1, Math.min(20, kValue))); // 限制在1-20之间
        });

        // 使用新格式保存
        newChains[themeName] = {
            clusters: clusters,
            kSequence: kSequence.length > 0 ? kSequence : new Array(clusters.length).fill(1)
        };
    });

    const dataToSave = { ...thinkingChainsData, chains: newChains };

    statusSpan.textContent = '正在保存...';
    statusSpan.className = 'status-message info';
    try {
        await apiFetch(`${API_BASE_URL}/thinking-chains`, {
            method: 'POST',
            body: JSON.stringify(dataToSave)
        });
        showMessage('思维链配置已成功保存!', 'success');
        statusSpan.textContent = '保存成功!';
        statusSpan.className = 'status-message success';
        initializeThinkingChainsEditor(); // 重载
    } catch (error) {
        statusSpan.textContent = `保存失败: ${error.message}`;
        statusSpan.className = 'status-message error';
    }
}
```

**保存的数据格式**：
```json
{
  "default": {
    "clusters": ["前思维簇", "逻辑推理簇", "反思簇"],
    "kSequence": [2, 1, 1]
  },
  "creative_writing": {
    "clusters": ["前思维簇", "逻辑推理簇"],
    "kSequence": [3, 2]
  }
}
```

---

## 添加新主题

**位置**：`thinking-chains-editor.js:417-436`

```javascript
function addNewThinkingChainTheme() {
    const themeName = prompt('请输入新思维链主题的名称 (例如: creative-writing):');
    if (!themeName || !themeName.trim()) return;

    const normalizedThemeName = themeName.trim();
    const container = document.getElementById('thinking-chains-themes-container');
    if (!container) return;

    if (container.querySelector(`[data-theme-name="${normalizedThemeName}"]`)) {
        showMessage(`主题 "${normalizedThemeName}" 已存在!`, 'error');
        return;
    }

    container.querySelector('p')?.remove();

    // 使用新格式创建空主题
    const newThemeElement = createThemeElement(normalizedThemeName, { clusters: [], kSequence: [] });
    container.appendChild(newThemeElement);
    newThemeElement.scrollIntoView({ behavior: 'smooth' });
}
```

---

## API路由

**文件**：`routes/admin/rag.js`

```javascript
// GET /admin_api/thinking-chains
router.get('/thinking-chains', async (req, res) => {
    try {
        const metaChainPath = path.join(__dirname, '../../../Plugin/RAGDiaryPlugin/meta_thinking_chains.json');
        const metaChainData = await fs.readFile(metaChainPath, 'utf-8');
        res.json(JSON.parse(metaChainData));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /admin_api/thinking-chains
router.post('/thinking-chains', async (req, res) => {
    try {
        const metaChainPath = path.join(__dirname, '../../../Plugin/RAGDiaryPlugin/meta_thinking_chains.json');
        await fs.writeFile(metaChainPath, JSON.stringify(req.body, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /admin_api/available-clusters
router.get('/available-clusters', async (req, res) => {
    const entries = await fs.readdir(DAILYNOTE_DIR, { withFileTypes: true });
    res.json({
        clusters: entries.filter(e => e.isDirectory() && e.name.endsWith('簇')).map(e => e.name)
    });
});
```

---

## 完整工作流程

```
用户打开 AdminPanel
    │
    ├─→ initializeThinkingChainsEditor()
    │   │
    │   ├─→ apiFetch('/admin_api/thinking-chains')
    │   │   └─→ GET Plugin/RAGDiaryPlugin/meta_thinking_chains.json
    │   │
    │   └─→ apiFetch('/admin_api/available-clusters')
    │       └─→ 遍历 dailynote 目录，过滤以"簇"结尾的文件夹
    │
    ├─→ renderThinkingChainsEditor()
    │   │
    │   ├─→ 为每个主题创建 theme-details
    │   │   ├── 展示主题名称
    │   │   ├── 创建 K 值输入框
    │   │   └── 创建可拖拽的链项列表
    │   │
    │   └─→ 创建 available-clusters-container
    │       └─ 可用簇列表（模板）
    │
    └─→ 用户操作
        │
        ├─ 拖拽：从可用列表拖到主题列表
        ├─ 排序：同列表内拖拽调整顺序
        ├─ 添加簇：点击可用列表中的簇
        └─ 删除簇：点击 × 按钮
        │
        └─ 点击"保存"按钮
            │
            ├─→ 收集所有主题的 clusters 和 kSequence
            ├─→ POST /admin_api/thinking-chains
            │   └─→ 写入 meta_thinking_chains.json
            │
            └─→ 重载编辑器
```

---

## 数据结构映射

### 内存数据（编辑器）
```javascript
thinkingChainsData = {
    chains: {
        "default": {
            clusters: ["前思维簇", "逻辑推理簇", "反思簇"],
            kSequence: [2, 1, 1]
        }
    }
}
```

### HTML结构
```html
<details class="theme-details" data-theme-name="default">
  <summary class="theme-summary">
    <span class="theme-name-display">主题: default</span>
    <button class="delete-theme-btn">删除该主题</button>
  </summary>
  <div class="theme-content">
    <div class="k-sequence-editor">
      <div class="k-sequence-inputs" data-theme-name="default">
        <div class="k-value-input-group" data-cluster="前思维簇">
          <label>前思维簇:</label>
          <input value="2" min="1" max="20">
        </div>
        ...
      </div>
    </div>
    <ul class="draggable-list theme-chain-list">
      <li class="chain-item" data-cluster-name="前思维簇">前思维簇 ×</li>
      ...
    </ul>
  </div>
</details>
```

---

## 样式参考

```css
.thinking-chains-editor-wrapper {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.thinking-chains-themes-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.theme-details {
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
}

.theme-summary {
    padding: 12px 16px;
    background: #f5f5f5;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.theme-content {
    padding: 16px;
}

.droppable-list {
    min-height: 100px;
    border: 2px dashed #ccc;
    border-radius: 6px;
    padding: 8px;
}

.chain-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 6px;
    cursor: grab;
}

.chain-item:active {
    cursor: grabbing;
}

.chain-item.dragging {
    opacity: 0.5;
    background: #e3f2fd;
}

.remove-cluster-btn {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

---

## 参考

- `AdminPanel/js/thinking-chains-editor.js` - 完整实现
- `routes/admin/rag.js` - API路由
- `Plugin/RAGDiaryPlugin/meta_thinking_chains.json` - 数据文件
- `dailynote/` - 簇目录
