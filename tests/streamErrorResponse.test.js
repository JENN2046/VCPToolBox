'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const writeStreamError = require('../modules/handlers/writeStreamError');

async function requestFailure(t, { preflight = false, partial = false, error }) {
  const server = http.createServer((_req, res) => {
    res.status = status => { res.statusCode = status; return res; };
    if (preflight) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.flushHeaders();
      res.write(': vcp-preflight-keepalive\n\n');
    }
    if (partial) {
      res.write('data: {"choices":[{"delta":{"content":"partial answer"}}]}\n\n');
    }
    setImmediate(() => writeStreamError(res, error, 'synthetic-model'));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await fetch(`http://127.0.0.1:${server.address().port}/`);
  return { status: result.status, type: result.headers.get('content-type'), body: await result.text() };
}

for (const preflight of [false, true]) {
  test(`timeout produces a visible SSE error and DONE with headers already sent=${preflight}`, async t => {
    const response = await requestFailure(t, { preflight, error: new Error('Connection timed out after 900s') });
    assert.equal(response.status, 200);
    assert.match(response.type, /text\/event-stream/);
    const frames = response.body.split('\n\n').filter(frame => frame.startsWith('data: '));
    assert.equal(frames.length, 2);
    const payload = JSON.parse(frames[0].slice(6));
    assert.match(payload.choices[0].delta.content, /\[ERROR\].*900 秒/);
    assert.equal(payload.choices[0].finish_reason, 'stop');
    assert.equal(frames[1], 'data: [DONE]');
  });
}

test('failure after partial output stays visible without exposing raw upstream diagnostics', async t => {
  const response = await requestFailure(t, {
    preflight: true, partial: true,
    error: new Error('request https://private.invalid/?token=synthetic-secret failed')
  });
  assert.match(response.body, /partial answer/);
  assert.match(response.body, /\[ERROR\]/);
  assert.doesNotMatch(response.body, /private\.invalid|synthetic-secret/);
  assert.equal(response.body.match(/\[DONE\]/g).length, 1);
});

for (const state of ['destroyed', 'writableEnded']) {
  test(`does not write to a response that is ${state}`, () => {
    const response = { [state]: true, write() { throw new Error('Unexpected write'); } };
    assert.equal(writeStreamError(response, new Error('timeout')), false);
  });
}
