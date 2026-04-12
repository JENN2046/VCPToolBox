/**
 * AI 代理交互示例
 *
 * 展示如何实现以下场景：
 * 1. 定时消息推送
 * 2. 事件触发的消息通知
 * 3. 交互式问答
 * 4. 群聊管理助手
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

// 模拟 AI 代理类
class SimpleAgent {
  constructor(name) {
    this.name = name;
    this.memories = new Map();
  }

  /**
   * 处理用户消息并生成回复
   */
  async chat(input, context = {}) {
    // 简单的关键词回复逻辑
    const text = input.toLowerCase();

    if (text.includes('你好') || text.includes('hello')) {
      return `你好！我是 ${this.name}，有什么可以帮助你的？`;
    }

    if (text.includes('时间') || text.includes('date')) {
      return `现在是 ${new Date().toLocaleString('zh-CN')}`;
    }

    if (text.includes('帮助') || text.includes('help')) {
      return `
📚 使用帮助：
- 发送 "时间" 查看当前时间
- 发送 "你好" 打招呼
- 发送 "帮助" 查看此帮助
- 发送 "echo:xxx" 让我重复你的话
      `.trim();
    }

    if (text.startsWith('echo:')) {
      return `你说的是：${input.slice(5)}`;
    }

    // 默认回复
    return `我收到了你的消息："${input}"\n发送 "帮助" 查看更多功能。`;
  }

  /**
   * 记住用户信息
   */
  remember(userId, data) {
    this.memories.set(userId, {
      ...this.memories.get(userId),
      ...data,
      updatedAt: Date.now()
    });
  }

  /**
   * 获取用户记忆
   */
  getMemory(userId) {
    return this.memories.get(userId);
  }
}

// 导出示例
export { SimpleAgent };

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('AI 代理示例模块');
  console.log('这是一个示例模块，展示如何创建简单的 AI 代理。');
  console.log('');
  console.log('使用方法:');
  console.log('  import { SimpleAgent } from "./examples/agent-example.js";');
  console.log('  const agent = new SimpleAgent("小助手");');
  console.log('  const reply = await agent.chat("你好");');
  console.log('  console.log(reply);');
}
