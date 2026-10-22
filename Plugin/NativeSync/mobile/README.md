# NativeSync Mobile：受限会话与持久执行

默认关闭。`NativeMobileEnabled=true` 时要求 `NativeMobileOrigin` 为明确 HTTPS origin，`NativeMobileTopics` 为最多 8 个显式测试 Agent/Topic 的 JSON 数组，`NativeMobilePwaDir` 指向已构建的 PWA。条目示例（不含凭据）：

```json
[{"key":"test-topic","ownerType":"agent","ownerId":"R3Agent","topicId":"r3-topic","agentAlias":"R3Agent","agentName":"R3Agent","topicName":"NativeSync test","model":"r7-synthetic"}]
```

配对码仅由宿主原有 Bearer 鉴权保护的 `POST /api/plugins/NativeSync/mobile/pairing` 签发，3 分钟、一次性使用。移动页面只提交配对码，不接收 ToolBox 全局 Key；随后使用 8 小时、不透明的 HttpOnly/Secure/SameSite=Strict Cookie，Path=/mobile。数据库仅存凭据 SHA256。移动入口要求直接 TLS 或本机可信 HTTPS 反向代理；修改全局 `trust proxy` 不能让远端伪造转发头通过移动入口。

- `GET /mobile/api/conversations`：从显式许可配置及现有 messages 派生目录。
- `GET /mobile/api/conversations/:key?after=0`：同一 SQLite 的完整文本消息和执行状态；每页 200 条，可继续读取。
- `POST /mobile/api/conversations/:key/messages`：仅接受 requestId/text。相同会话内 requestId 重试必须同内容，持久接受后返回 202。
- `POST /mobile/api/executions/:id/cancel`：只能取消本会话拥有的非终态执行。

同一个 `central.sqlite` 增加认证元数据和执行意图表；没有第二个聊天历史数据库。preparing/publishing 是可恢复的写前意图，消息始终调用原 `CentralStore.apply`，稳定 opId 防重，完成后清除临时 operation。202 在用户消息及 queued 状态均持久成功后返回。异常中断的 running 会重排，已保存的结果意图直接重放、不重新调用模型。

执行调用完整宿主的原 `/v1/chat/completions`，提示读取原 AgentManager，模型路由、预处理、工具执行仍由原 ChatCompletionHandler 完成。手机连接不拥有执行 AbortController；显式取消及宿主 drain 才会中止内部请求。取消先持久记录，再中止传输；发布最终结果后不能撤回。中断中的模型调用为至少一次恢复语义，不宣称真实工具副作用恰好一次；R7 仅使用合成模型且禁用无关工具。

首版执行串行、仅文本，单次上下文最多 200 条，超限失败而不静默截断。前端没有复杂离线编辑，只缓存公共 shell；API/聊天数据不进入 Service Worker cache。原同步 wire/SQLite 日志实现未修改。

完整验收见相邻 VCPChat R7 的 `docs/NATIVE_SYNC_R7_HANDOFF.md`。依赖安装与编译输出放在 `artifacts/native-sync-r7`，TLS 私钥、一次性码、会话 Cookie 和浏览器 profile 禁止输出、复制或提交为源码证据。
