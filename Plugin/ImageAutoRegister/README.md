# ImageAutoRegister - 图片自动注册监听器

自动监听 `image/` 目录下所有子目录的新图片文件，并自动注册到图片评分管理系统。

## 功能

- **实时监听**: 使用 `fs.watch` 监听图片目录变化
- **自动注册**: 新图片生成后自动注册到评分数据库
- **来源识别**: 根据目录名自动识别来源插件（ZImageGen、FluxGen、ComfyUI 等 10+ 插件）
- **初始扫描**: 启动时扫描已有图片，避免重复注册
- **容错处理**: 注册失败不影响主流程

## 支持的生图插件

| 目录名 | 来源插件名 |
|--------|-----------|
| zimagegen | ZImageGen |
| zimagegen2 | ZImageGen2 |
| zimageturbogen | ZImageTurboGen |
| fluxgen | FluxGen |
| geminiimagegen | GeminiImageGen |
| nanobananagen | NanoBananaGen |
| qwenimagegen | QwenImageGen |
| doubaogen | DoubaoGen |
| commyuigen | ComfyUIGen |
| comfycloud | ComfyCloudGen |

## 文件结构

```
Plugin/ImageAutoRegister/
├── plugin-manifest.json      # 插件清单
├── image-auto-register.js    # 后端监听服务
├── widget.html               # Desktop 评分面板
└── README.md                 # 本文件
```

## Desktop Widget 使用

### 方式一：通过流式推送
在 VCP Desktop 中输出以下内容打开评分面板：
```
<<<[DESKTOP_PUSH]>>>
<div style="width:100%;height:100%;"><iframe src="/api/image-rating/widget" style="width:100%;height:100%;border:none;"></iframe></div>
<<<[DESKTOP_PUSH_END]>>>
```

### 方式二：通过 DesktopRemote 工具
调用 `DesktopRemote` 工具的 `CreateWidget` 命令，将 `/api/image-rating/widget` 的 HTML 内容作为 `htmlContent` 参数传入。

## 使用方式

### 后端服务
插件启用后自动启动，无需手动操作。

### Desktop 面板
通过 VCP Desktop 流式推送或 Widget 创建功能打开评分面板。

### 手动扫描
```javascript
const autoRegister = require('./Plugin/ImageAutoRegister/image-auto-register.js');
autoRegister.scan();     // 重新扫描所有图片
autoRegister.getStatus(); // 获取监听状态
```

## API 接口

Widget 通过以下 API 端点获取数据：

```
GET    /api/image-rating/stats              # 统计信息
GET    /api/image-rating/images?limit=30    # 图片列表
PUT    /api/image-rating/image/:id/rating   # 设置评分
PUT    /api/image-rating/image/:id/favorite # 设置收藏
```
