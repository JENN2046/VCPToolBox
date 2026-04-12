/**
 * 定时任务示例
 *
 * 展示如何实现定时消息推送功能
 */

import { createProactiveSender } from '../src/core/proactiveSender.js';
import { createOneBotClient } from '../src/adapters/onebot/client.js';

/**
 * 创建定时任务调度器
 */
export function createScheduler({ onebotClient, logger = console }) {
  const sender = createProactiveSender({ onebotClient, logger });
  const timers = new Map();

  /**
   * 添加定时任务
   * @param {string} id - 任务 ID
   * @param {Function} task - 任务函数
   * @param {number} interval - 间隔（毫秒）
   */
  function addTask(id, task, interval) {
    if (timers.has(id)) {
      logger.warn(`[scheduler] Task ${id} already exists, replacing...`);
      clearInterval(timers.get(id));
    }

    const timerId = setInterval(task, interval);
    timers.set(id, timerId);
    logger.info(`[scheduler] Task ${id} added, interval: ${interval}ms`);
  }

  /**
   * 移除定时任务
   * @param {string} id - 任务 ID
   */
  function removeTask(id) {
    const timerId = timers.get(id);
    if (timerId) {
      clearInterval(timerId);
      timers.delete(id);
      logger.info(`[scheduler] Task ${id} removed`);
    }
  }

  /**
   * 清理所有任务
   */
  function clearAll() {
    for (const [id, timerId] of timers) {
      clearInterval(timerId);
    }
    timers.clear();
    logger.info('[scheduler] All tasks cleared');
  }

  return {
    addTask,
    removeTask,
    clearAll,
    getActiveTasks: () => timers.size,
  };
}

// 示例：每日早安推送
export function setupDailyGreeting({ onebotClient, logger = console }) {
  const scheduler = createScheduler({ onebotClient, logger });
  const sender = createProactiveSender({ onebotClient, logger });

  // 配置要推送的群列表
  const groups = process.env.GREETING_GROUPS ? process.env.GREETING_GROUPS.split(',').map(Number) : [];

  // 每日早安语料
  const greetings = [
    '大家早上好！新的一天，加油！☀️',
    '早安！愿你今天有个好心情！🌅',
    '美好的一天开始了，加油！💪',
    '早安！今天也要元气满满哦！✨',
  ];

  // 每天早上 9 点发送
  scheduler.addTask('morning-greeting', async () => {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    for (const groupId of groups) {
      await sender.sendGroupMessage(groupId, greeting);
    }
  }, 24 * 60 * 60 * 1000); // 24 小时

  return scheduler;
}

export { createScheduler };
