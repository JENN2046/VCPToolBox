# ImageAutoRegister Desktop 启动脚本

## 方式一：流式推送创建评分面板

在 VCP Desktop 中输出以下内容：

```
<<<[DESKTOP_PUSH]>>>
<div style="width:100%;height:100%;border-radius:12px;overflow:hidden;">
  <iframe src="/api/image-rating/widget" style="width:100%;height:100%;border:none;background:transparent;"></iframe>
</div>
<<<[DESKTOP_PUSH_END]>>>
```

## 方式二：DesktopRemote 工具创建持久化挂件

调用 DesktopRemote 工具：

```
tool_name:「始」DesktopRemote「末」,
command:「始」CreateWidget「末」,
htmlContent:「始」<div style="width:100%;height:100%;border-radius:12px;overflow:hidden;"><iframe src="/api/image-rating/widget" style="width:100%;height:100%;border:none;background:transparent;"></iframe></div>「末」,
x:「始」200「末」,
y:「始」150「末」,
width:「始」600「末」,
height:「始」500「末」,
autoSave:「始」true「末」,
saveName:「始」图片评分监控「末」
```

## 图标文件

图标已放置在：`H:\MCP\VCPChat\assets\iconset\ImageAutoRegister\icon.html`

系统会自动处理图标，用户可以在图标主题设置中调用。

## Desktop 启动按钮

在 Widget 头部已添加三个按钮：
- **面板**：打开 AdminPanel 管理面板
- **扫描**：手动触发图片扫描和注册
- **状态**：显示当前连接状态
