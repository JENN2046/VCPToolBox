# V1 Final Review：排队上下文最小修复

基线 `48a3344`，产品代码fcf9f53；独立分支 `codex/r10-v1-final-p1`。
产品只改 `Plugin/NativeSync/mobile/execution.js`，不改Schema、Hash、并发调度、
幂等ID、恢复协议或工具接口，不部署/Push/Merge。

原 `seq <= user_seq` 快照排除了排队期间完成的前序回复。现在从同一任务表
选择同Topic、更早user_seq、completed状态的reply ID，在原Journal查询中读取
其最新版本；用Map把回复放到其用户消息后、当前用户消息前。
后续用户输入和其他Topic仍被隔离；已删除回复不恢复，修改后内容正常使用。

新增4项测试实际检查合成模型收到的请求上下文：连续三任务配对顺序/未来输入
隔离、回复编辑、墓碑、queued重启恢复；不增加模型请求或重复回复。
同一测试对旧版3失败/1通过，对修复版4通过；最终相关Node总87项通过。
原并发/取消/Drain、权限分页/pending、HTTP生命周期、认证等回归保持通过。

配套Chat修复删除门禁及离线冷启动；其完整应用测试、R3/R8回归和部署边界见
对应Chat工作树 `docs/NATIVE_SYNC_V1_FINAL_P1_FIXES.md`。
本轮所有模型均为合成回环模型；生产R10/6005、真实聊天及凭据未改。
