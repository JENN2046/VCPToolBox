/**
 * 健康检查和诊断脚本
 *
 * 用于检查 OneBot 适配器健康状态和诊断连接问题
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

async function checkHealth() {
  log(colors.cyan, '=== OneBot 适配器健康检查 ===\n');

  const issues = [];

  // 1. 检查环境变量
  log(colors.blue, '1. 检查环境变量...');
  const requiredEnv = ['ONEBOT_WS_URL', 'VCP_CHANNEL_HUB_URL'];
  for (const env of requiredEnv) {
    if (process.env[env]) {
      log(colors.green, `   ✓ ${env}: ${process.env[env]}`);
    } else {
      log(colors.red, `   ✗ ${env}: 未设置`);
      issues.push(`${env} 未设置`);
    }
  }

  // 2. 检查 WebSocket 连接
  log(colors.blue, '\n2. 检查 OneBot WebSocket 连接...');
  try {
    const wsUrl = process.env.ONEBOT_WS_URL || 'ws://127.0.0.1:3001';
    log(colors.yellow, `   尝试连接：${wsUrl}`);
    // 这里可以添加实际的连接测试
    log(colors.yellow, '   ! 需要运行中的适配器来测试实际连接');
  } catch (error) {
    log(colors.red, `   ✗ 连接失败：${error.message}`);
    issues.push('OneBot WebSocket 连接失败');
  }

  // 3. 检查 ChannelHub 可达性
  log(colors.blue, '\n3. 检查 ChannelHub 可达性...');
  try {
    const channelHubUrl = process.env.VCP_CHANNEL_HUB_URL || 'http://127.0.0.1:6010/internal/channel-hub/events';
    log(colors.yellow, `   ChannelHub URL: ${channelHubUrl}`);
    // 这里可以添加实际的 HTTP 检查
    log(colors.yellow, '   ! 需要运行中的适配器来测试实际连接');
  } catch (error) {
    log(colors.red, `   ✗ 检查失败：${error.message}`);
    issues.push('ChannelHub 不可达');
  }

  // 4. 配置文件检查
  log(colors.blue, '\n4. 检查配置文件...');
  const fs = require('fs');
  const path = require('path');

  const configFiles = ['.env', 'plugin-manifest.json'];
  for (const file of configFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      log(colors.green, `   ✓ ${file} 存在`);
    } else {
      log(colors.yellow, `   ! ${file} 不存在`);
    }
  }

  // 总结
  log(colors.cyan, '\n=== 健康检查完成 ===\n');

  if (issues.length === 0) {
    log(colors.green, '✓ 所有检查通过！');
  } else {
    log(colors.red, `发现 ${issues.length} 个问题:`);
    issues.forEach((issue, i) => {
      log(colors.red, `   ${i + 1}. ${issue}`);
    });
  }

  return issues.length === 0;
}

// 运行健康检查
checkHealth().then((healthy) => {
  process.exit(healthy ? 0 : 1);
}).catch((error) => {
  log(colors.red, `健康检查失败：${error.message}`);
  process.exit(1);
});
