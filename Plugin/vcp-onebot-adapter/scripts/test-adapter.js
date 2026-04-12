/**
 * OneBot 适配器测试脚本
 *
 * 测试 OneBot 消息编解码、会话管理等功能
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// 测试 OneBot 消息编解码
async function testMessageCodec() {
  log(colors.cyan, '\n=== 测试 OneBot 消息编解码 ===\n');

  const { createOneBotAdapter } = await import('../src/adapter/contract.js');

  const adapter = createOneBotAdapter({
    options: {
      wsUrl: 'ws://127.0.0.1:3001',
      accessToken: '',
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
    }
  });

  // 测试 1: 解析群消息
  log(colors.blue, '测试 1: 解析群消息...');
  try {
    const groupMessage = {
      post_type: 'message',
      message_type: 'group',
      group_id: 123456,
      user_id: 987654,
      message_id: 1001,
      message: [
        { type: 'text', data: { text: '你好' } },
        { type: 'face', data: { id: '1' } }
      ],
      sender: {
        nickname: '测试用户',
        card: '群名片',
        role: 'admin'
      }
    };

    const event = await adapter.decodeInbound(groupMessage, {});
    log(colors.green, `   ✓ 消息解析成功`);
    log(colors.green, `     - 发送者：${event.sender.nick}`);
    log(colors.green, `     - 内容：${JSON.stringify(event.payload.messages[0].content)}`);
  } catch (error) {
    log(colors.red, `   ✗ 解析失败：${error.message}`);
  }

  // 测试 2: 解析带表情的消息
  log(colors.blue, '\n测试 2: 解析带表情的消息...');
  try {
    const emojiMessage = {
      post_type: 'message',
      message_type: 'private',
      user_id: 987654,
      message_id: 1002,
      message: [
        { type: 'text', data: { text: '测试表情：' } },
        { type: 'face', data: { id: '1' } },
        { type: 'face', data: { id: '12' } },
        { type: 'face', data: { id: '100' } }
      ],
      sender: {
        nickname: '好友'
      }
    };

    const event = await adapter.decodeInbound(emojiMessage, {});
    log(colors.green, `   ✓ 表情消息解析成功`);
    log(colors.green, `     - 内容：${JSON.stringify(event.payload.messages[0].content)}`);
  } catch (error) {
    log(colors.red, `   ✗ 解析失败：${error.message}`);
  }

  // 测试 3: 解析回复消息
  log(colors.blue, '\n测试 3: 解析回复消息...');
  try {
    const replyMessage = {
      post_type: 'message',
      message_type: 'private',
      user_id: 987654,
      message_id: 1003,
      message: [
        { type: 'reply', data: { id: '1001' } },
        { type: 'text', data: { text: '这是回复内容' } }
      ],
      sender: {
        nickname: '好友'
      }
    };

    const event = await adapter.decodeInbound(replyMessage, {});
    log(colors.green, `   ✓ 回复消息解析成功`);
    log(colors.green, `     - 内容：${JSON.stringify(event.payload.messages[0].content)}`);
  } catch (error) {
    log(colors.red, `   ✗ 解析失败：${error.message}`);
  }

  // 测试 4: 编码出站消息
  log(colors.blue, '\n测试 4: 编码出站消息...');
  try {
    const reply = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: '你好！' },
            { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
          ]
        }
      ]
    };

    const encoded = await adapter.encodeOutbound(reply, {});
    log(colors.green, `   ✓ 消息编码成功`);
    log(colors.green, `     - 编码结果：${JSON.stringify(encoded)}`);
  } catch (error) {
    log(colors.red, `   ✗ 编码失败：${error.message}`);
  }

  // 测试 5: 健康检查
  log(colors.blue, '\n测试 5: 健康检查...');
  try {
    const health = await adapter.healthCheck();
    log(colors.green, `   ✓ 健康检查完成`);
    log(colors.green, `     - 健康状态：${health.healthy ? '健康' : '不健康'}`);
    log(colors.green, `     - 连接状态：${health.connectionState}`);
    log(colors.green, `     - 初始化状态：${health.initialized ? '已初始化' : '未初始化'}`);
  } catch (error) {
    log(colors.red, `   ✗ 健康检查失败：${error.message}`);
  }

  await adapter.shutdown();
}

// 运行所有测试
async function runTests() {
  log(colors.cyan, '========================================');
  log(colors.cyan, '   OneBot 适配器测试套件');
  log(colors.cyan, '========================================\n');

  const startTime = Date.now();

  await testMessageCodec();

  const duration = Date.now() - startTime;
  log(colors.cyan, `\n========================================`);
  log(colors.cyan, `测试完成，耗时：${duration}ms`);
  log(colors.cyan, '========================================\n');
}

runTests().catch((error) => {
  log(colors.red, `测试套件执行失败：${error.message}`);
  process.exit(1);
});
