/**
 * OneBot 11 协议客户端
 *
 * 支持 WebSocket 正向连接到 OneBot 实现 (go-cqhttp, NapCat, LLOneBot 等)
 *
 * OneBot 11 协议参考: https://github.com/botuniverse/onebot-11
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const RECONNECT_DELAY_BASE = 1000; // 1秒
const RECONNECT_DELAY_MAX = 30000; // 30秒
const HEARTBEAT_INTERVAL = 30000; // 30秒

/**
 * 创建 OneBot 客户端
 * @param {Object} options
 * @param {string} options.wsUrl - WebSocket 地址 (如 ws://127.0.0.1:3001)
 * @param {string} options.accessToken - access_token (可选)
 * @param {Object} options.logger - 日志器
 * @returns {Object} OneBot 客户端实例
 */
export function createOneBotClient({ wsUrl, accessToken = '', logger = console }) {
  const emitter = new EventEmitter();
  let ws = null;
  let isConnected = false;
  let reconnectAttempt = 0;
  let heartbeatTimer = null;
  let selfId = null; // 当前已验证的 QQ 号
  let reconnectTimer = null;
  let manualClose = true;
  let connecting = null;

  /**
   * 生成 API 调用的 echo 字段
   */
  let echoCounter = 0;
  const pendingApiCalls = new Map();

  function generateEcho() {
    return `echo_${Date.now()}_${++echoCounter}`;
  }

  /**
   * 调用 OneBot API
   * @param {string} action - API 名称
   * @param {Object} params - 参数
   * @param {number} timeout - 超时时间 (毫秒)
   * @returns {Promise<Object>} API 响应
   */
  async function callApi(action, params = {}, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!isConnected || !ws) {
        reject(new Error('OneBot not connected'));
        return;
      }

      const echo = generateEcho();
      const payload = {
        action,
        params,
        echo,
      };

      const timer = setTimeout(() => {
        pendingApiCalls.delete(echo);
        reject(new Error(`API call timeout: ${action}`));
      }, timeout);

      pendingApiCalls.set(echo, { resolve, reject, timer });

      // A socket can close between isConnected and send().
      try {
        ws.send(JSON.stringify(payload), error => {
          if (error && pendingApiCalls.has(echo)) {
            clearTimeout(timer);
            pendingApiCalls.delete(echo);
            reject(error);
          }
        });
        logger.debug('[onebot] API call sent:', { action, echo });
      } catch (error) {
        clearTimeout(timer);
        pendingApiCalls.delete(echo);
        reject(error);
      }
    });
  }

  /**
   * 处理 WebSocket 消息
   */
  function handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // 处理 API 响应
      if (message.echo) {
        const pending = pendingApiCalls.get(message.echo);
        if (pending) {
          clearTimeout(pending.timer);
          pendingApiCalls.delete(message.echo);

          if (message.status === 'ok') {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.msg || 'API call failed'));
          }
        }
        return;
      }

      // 处理心跳
      if (message.meta_event_type === 'heartbeat') {
        logger.debug('[onebot] Heartbeat received');
        return;
      }

      // 处理生命周期事件
      if (message.post_type === 'meta_event' && message.meta_event_type === 'lifecycle') {
        if (message.sub_type === 'connect') {
          selfId = message.self_id;
          logger.info('[onebot] Lifecycle: connect, self_id:', selfId);
          emitter.emit('connect', { selfId });
        }
        return;
      }

      // 处理消息事件
      if (message.post_type === 'message') {
        emitter.emit('message', message);
        return;
      }

      // 处理通知事件
      if (message.post_type === 'notice') {
        emitter.emit('notice', message);
        return;
      }

      // 处理请求事件
      if (message.post_type === 'request') {
        emitter.emit('request', message);
        return;
      }

      logger.debug('[onebot] Unhandled message type:', message.post_type);
    } catch (error) {
      logger.error('[onebot] Failed to parse message:', error);
    }
  }

  /**
   * 启动心跳
   */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (isConnected && ws) {
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL);
    heartbeatTimer.unref();
  }

  /**
   * 停止心跳
   */
  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function rejectPending(error) {
    for (const [echo, call] of pendingApiCalls) {
      clearTimeout(call.timer);
      pendingApiCalls.delete(echo);
      call.reject(error);
    }
  }

  /**
   * One socket handles both OneBot events and API calls. Reconnect only after
   * unexpected loss. Manual disable/shutdown always suppresses reconnect.
   */
  function connect() {
    if (isConnected && ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (connecting) return connecting;
    manualClose = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    connecting = new Promise((resolve, reject) => {
      const headers = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      logger.info('[onebot] Connecting to:', wsUrl);
      const socket = new WebSocket(wsUrl, { headers });
      ws = socket;
      let settled = false;
      const succeed = () => { if (!settled) { settled = true; resolve(); } };
      const fail = error => { if (!settled) { settled = true; reject(error); } };
      const timer = setTimeout(() => {
        fail(new Error('OneBot connection timeout'));
        socket.terminate();
      }, 10000);

      socket.on('open', () => {
        clearTimeout(timer);
        if (manualClose || ws !== socket) { socket.close(); return; }
        isConnected = true;
        reconnectAttempt = 0;
        logger.info('[onebot] WebSocket connected');
        startHeartbeat();
        succeed();
        // Lifecycle packets are optional in some OneBot implementations.
        // Verify selfId through an API read, including after automatic reconnect.
        getLoginInfo().then(info => {
          if (!manualClose && ws === socket && info?.user_id != null) {
            selfId = String(info.user_id);
            emitter.emit('connect', { selfId });
          }
        }).catch(error => {
          logger.warn('[onebot] Could not verify QQ identity: ' + error.message);
        });
      });
      socket.on('message', data => { if (!manualClose && ws === socket) handleMessage(data); });
      socket.on('pong', () => logger.debug('[onebot] Pong received'));
      socket.on('error', error => {
        clearTimeout(timer);
        logger.error('[onebot] WebSocket error:', error);
        fail(error);
        if (emitter.listenerCount('error')) emitter.emit('error', error);
      });
      socket.on('close', (code, reason) => {
        clearTimeout(timer);
        if (ws === socket) ws = null;
        isConnected = false;
        selfId = null;
        stopHeartbeat();
        rejectPending(new Error('OneBot disconnected'));
        fail(new Error('OneBot closed before opening'));
        emitter.emit('close', code, reason);
        if (!manualClose) queueMicrotask(() => { if (!manualClose) scheduleReconnect(); });
      });
    }).finally(() => { connecting = null; });
    return connecting;
  }

  function scheduleReconnect() {
    if (manualClose || reconnectTimer || connecting) return;
    reconnectAttempt++;
    const delay = Math.min(RECONNECT_DELAY_BASE * 2 ** (reconnectAttempt - 1), RECONNECT_DELAY_MAX);
    logger.info(`[onebot] Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
    emitter.emit('reconnecting', reconnectAttempt);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (manualClose || isConnected) return;
      connect().catch(error => {
        logger.error('[onebot] Reconnect failed:', error);
        // The failed socket's close event schedules the next attempt.
      });
    }, delay);
    reconnectTimer.unref?.();
  }

  async function disconnect() {
    manualClose = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopHeartbeat();
    rejectPending(new Error('OneBot manually disconnected'));
    const socket = ws;
    if (!socket) { isConnected = false; selfId = null; return; }
    if (socket.readyState === WebSocket.CONNECTING) socket.terminate();
    else if (socket.readyState === WebSocket.OPEN) socket.close();
    if (socket.readyState !== WebSocket.CLOSED) {
      await new Promise(resolve => {
        const timer = setTimeout(() => { socket.terminate(); resolve(); }, 1000);
        socket.once('close', () => { clearTimeout(timer); resolve(); });
      });
    }
    if (ws === socket) ws = null;
    isConnected = false;
    selfId = null;
  }

  /**
   * 发送私聊消息
   * @param {number} userId - 用户 ID
   * @param {Array} message - 消息段数组
   */
  async function sendPrivateMessage(userId, message) {
    return callApi('send_private_msg', {
      user_id: userId,
      message,
    });
  }

  /**
   * 发送群消息
   * @param {number} groupId - 群 ID
   * @param {Array} message - 消息段数组
   */
  async function sendGroupMessage(groupId, message) {
    return callApi('send_group_msg', {
      group_id: groupId,
      message,
    });
  }

  /**
   * 发送消息 (自动判断私聊/群聊)
   * @param {string} messageType - 消息类型 (private/group)
   * @param {number} targetId - 目标 ID (用户 ID 或群 ID)
   * @param {Array} message - 消息段数组
   */
  async function sendMessage(messageType, targetId, message) {
    if (messageType === 'private') {
      return sendPrivateMessage(targetId, message);
    } else if (messageType === 'group') {
      return sendGroupMessage(targetId, message);
    }
    throw new Error(`Unknown message type: ${messageType}`);
  }

  /**
   * 获取登录信息
   */
  async function getLoginInfo() {
    return callApi('get_login_info');
  }

  /**
   * 获取好友列表
   */
  async function getFriendList() {
    return callApi('get_friend_list');
  }

  /**
   * 获取群列表
   */
  async function getGroupList() {
    return callApi('get_group_list');
  }

  /**
   * 获取群成员信息
   */
  async function getGroupMemberInfo(groupId, userId) {
    return callApi('get_group_member_info', {
      group_id: groupId,
      user_id: userId,
    });
  }

  /**
   * 撤回消息
   * @param {number} messageId - 消息 ID
   */
  async function deleteMsg(messageId) {
    return callApi('delete_msg', { message_id: messageId });
  }

  /**
   * 获取消息
   * @param {number} messageId - 消息 ID
   */
  async function getMsg(messageId) {
    return callApi('get_msg', { message_id: messageId });
  }

  return {
    // 事件
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),

    // 连接管理
    connect,
    disconnect,
    get isConnected() { return isConnected; },
    get selfId() { return selfId; },

    // API 调用
    callApi,
    sendMessage,
    sendPrivateMessage,
    sendGroupMessage,
    getLoginInfo,
    getFriendList,
    getGroupList,
    getGroupMemberInfo,
    deleteMsg,
    getMsg,
  };
}