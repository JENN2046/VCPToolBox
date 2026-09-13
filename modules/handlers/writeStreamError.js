'use strict';

// An SSE response can already have sent keepalive headers before upstream fails.
// Always send a visible error chunk while the response is still writable.
function writeStreamError(res, error, model = 'unknown') {
  if (res.writableEnded || res.destroyed) return false;
  if (!res.headersSent) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }
  const timeout = /^Connection timed out after (\d+(?:\.\d+)?)s$/.exec(String(error?.message || ''));
  const content = timeout
    ? `[ERROR] 等待上游模型响应超时（单次等待 ${timeout[1]} 秒，重试已耗尽）。请稍后重试或检查上游服务。`
    : '[ERROR] 上游请求失败，本次回复未正常完成。请稍后重试或查看服务端日志。';
  const payload = {
    id: `chatcmpl-VCP-error-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }]
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  res.end('data: [DONE]\n\n');
  return true;
}

module.exports = writeStreamError;
