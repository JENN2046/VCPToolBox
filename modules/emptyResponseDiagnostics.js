'use strict';

// Observer only: retain scalars, never retain response objects, lines or text.
// Character counts are JS UTF-16 lengths, not token counts or rendered text.
const chars = value => typeof value === 'string' ? value.length : 0;
const has = (value, key) => value != null && Object.prototype.hasOwnProperty.call(value, key);
const type = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const reasonEnum = value => ['stop', 'length', 'tool_calls', 'function_call', 'content_filter', 'error'].includes(value) ? value : 'other';
const identifier = value => Number.isSafeInteger(value) ? value
  : typeof value === 'string' && /^[\w.:/-]{1,128}$/.test(value) && !/bearer|sk-/i.test(value) ? value : null;
const contentType = response => {
  const mime = response?.headers?.get?.('content-type')?.split(';')[0]?.trim()?.toLowerCase();
  return ['text/event-stream', 'application/json', 'text/plain', 'text/html'].includes(mime) ? mime : 'other_or_missing';
};

class EmptyResponseDiagnostics {
  constructor(handler, body, response) {
    this.handler = handler;
    this.requestId = identifier(body?.requestId || body?.messageId);
    this.model = identifier(body?.model);
    this.streamRequested = body?.stream === true;
    this.startedAt = new Date().toISOString(); // Handler entry, not frontend message time.
    this.httpStatus = response?.status ?? null;
    this.responseContentType = contentType(response);
    this.responses = 0;
    this.upstreamBytes = 0;
    this.responseBytes = 0;
    this.fatalProviderError = false;
    this.emitted = false;
    this.turnEnded = false;
    this.sse = { lines: 0, dataLines: 0, dataSpaceLines: 0, dataNoSpaceLines: 0, doneLines: 0,
      jsonParseSuccess: 0, jsonParseFailure: 0, parserJsonParseSuccess: 0, observerOnlyJsonParseSuccess: 0 };
    this.delta = { choicesPresentCount: 0, contentPresentCount: 0, contentStringCount: 0, contentChars: 0,
      parserConsumedContentChars: 0, reasoningPresentCount: 0, reasoningChars: 0, toolCallsPresentCount: 0 };
    this.nonStream = { jsonParseSuccess: 0, jsonParseFailure: 0, choicesCount: 0, messagePresent: false,
      messageContentType: 'undefined', messageContentChars: 0, reasoningPresent: false, reasoningChars: 0,
      toolCallsPresent: false, totalMessageContentChars: 0 };
    this.aggregation = { collectedContentChars: 0, currentLoopContentChars: 0, assistantTurnPartCount: 0,
      assistantTurnChars: 0, finalOneRingTextChars: 0 };
    this.forwardedContentChars = 0;
    this.finishReasonSeen = null;
    this.terminationSignals = { done: false, finish_reason: false, provider_eof: false, abort: false,
      timeout: false, client_disconnect: false, tool_loop_exit: false, exception: false };
  }

  beginResponse(response) {
    this.responses++;
    this.turnEnded = false;
    this.lastHttpStatus = response?.status ?? null;
    this.lastResponseContentType = contentType(response);
    if (response?.ok === false || Number(response?.status) >= 400) this.fatalProviderError = true;
  }

  finishReason(value) {
    if (value !== undefined && value !== null) {
      this.finishReasonSeen = reasonEnum(value);
      this.terminationSignals.finish_reason = true;
    }
  }

  // Called once for each existing decoded line. Only otherwise-ignored no-space
  // data needs an additional JSON parse. This result NEVER enters the handler.
  streamLine(line, forwarded) {
    this.sse.lines++;
    if (!line.startsWith('data:')) return;
    this.sse.dataLines++;
    const spaced = line.startsWith('data: ');
    this.sse[spaced ? 'dataSpaceLines' : 'dataNoSpaceLines']++;
    const data = line.slice(5).trim();
    if (data === '[DONE]') {
      this.sse.doneLines++;
      this.terminationSignals.done = true;
    } else if (!spaced && data) {
      try { this.streamParsed(JSON.parse(data), false, forwarded); }
      catch { this.sse.jsonParseFailure++; }
    }
  }

  streamParsed(parsed, consumed, forwarded) {
    this.sse.jsonParseSuccess++;
    this.sse[consumed ? 'parserJsonParseSuccess' : 'observerOnlyJsonParseSuccess']++;
    if (parsed?.error != null) this.fatalProviderError = true;
    if (has(parsed, 'choices')) this.delta.choicesPresentCount++;
    const choice = parsed?.choices?.[0];
    const delta = choice?.delta;
    if (has(delta, 'content')) this.delta.contentPresentCount++;
    if (typeof delta?.content === 'string') this.delta.contentStringCount++;
    const length = chars(delta?.content);
    this.delta.contentChars += length;
    if (consumed) this.delta.parserConsumedContentChars += length;
    // Successful res.write of a parsed upstream data line; excludes generated
    // tool/status chunks and is NOT a claim about what the desktop rendered.
    if (forwarded) this.forwardedContentChars += length;
    if (has(delta, 'reasoning_content')) this.delta.reasoningPresentCount++;
    this.delta.reasoningChars += chars(delta?.reasoning_content);
    if (has(delta, 'tool_calls') || has(delta, 'function_call')) this.delta.toolCallsPresentCount++;
    this.finishReason(choice?.finish_reason);
  }

  endTurn(content, signal) {
    this.terminationSignals[signal] = true;
    if (this.turnEnded) return;
    this.turnEnded = true;
    this.aggregation.collectedContentChars += chars(content);
  }

  nonStreamParsed(parsed) {
    this.nonStream.jsonParseSuccess++;
    if (parsed?.error != null) this.fatalProviderError = true;
    const choice = parsed?.choices?.[0];
    const message = choice?.message;
    this.nonStream.choicesCount = Array.isArray(parsed?.choices) ? parsed.choices.length : 0;
    this.nonStream.messagePresent = message != null;
    this.nonStream.messageContentType = type(message?.content);
    this.nonStream.messageContentChars = chars(message?.content);
    this.nonStream.totalMessageContentChars += chars(message?.content);
    let reasoningChars = 0;
    let reasoningPresent = false;
    for (const obj of [message, choice, choice?.delta]) {
      for (const key of ['reasoning_content', 'reasoning', 'reasoning_details', 'thoughts', 'thinking', 'reasoning_text']) {
        if (has(obj, key)) reasoningPresent = true;
        reasoningChars += chars(obj?.[key]);
      }
    }
    this.nonStream.reasoningPresent = reasoningPresent;
    this.nonStream.reasoningChars = reasoningChars;
    this.nonStream.toolCallsPresent = has(message, 'tool_calls') || has(message, 'function_call');
    this.finishReason(choice?.finish_reason);
  }

  finalize(text, parts, loopContent, { req, res, abortController, clientVisibleContentChars, fullContentChars }) {
    this.aggregation.currentLoopContentChars = chars(loopContent);
    this.aggregation.assistantTurnPartCount = parts.length;
    this.aggregation.assistantTurnChars = parts.reduce((sum, part) => sum + chars(part), 0);
    this.aggregation.finalOneRingTextChars = chars(text);
    if (fullContentChars !== undefined) this.aggregation.fullContentChars = fullContentChars;
    this.terminationSignals.tool_loop_exit = true; // Reached handler final handoff.
    if (req?.aborted || (res?.destroyed && !res?.writableEnded)) this.terminationSignals.client_disconnect = true;
    if (abortController?.signal?.aborted) this.terminationSignals.abort = true;
    if (this.emitted || this.fatalProviderError || typeof text !== 'string' || text.trim().length > 0) return;
    this.emitted = true;
    const termination = ['client_disconnect', 'timeout', 'abort', 'exception', 'done', 'finish_reason', 'provider_eof', 'tool_loop_exit']
      .find(key => this.terminationSignals[key]);
    const payload = {
      event: 'VCP_EMPTY_ASSISTANT_RESPONSE_DIAGNOSTIC', handler: this.handler,
      requestId: this.requestId, model: this.model, streamRequested: this.streamRequested,
      startedAt: this.startedAt, httpStatus: this.httpStatus, responseContentType: this.responseContentType,
      lastHttpStatus: this.lastHttpStatus, lastResponseContentType: this.lastResponseContentType,
      responses: this.responses, aggregation: this.aggregation, termination,
      terminationSignals: this.terminationSignals, finishReasonSeen: this.finishReasonSeen
    };
    if (this.handler === 'stream') Object.assign(payload, { upstreamBytes: this.upstreamBytes, sse: this.sse,
      delta: this.delta, forwardedContentChars: this.forwardedContentChars });
    else Object.assign(payload, { responseBytes: this.responseBytes, nonStream: this.nonStream, clientVisibleContentChars });
    // Diagnostic output must never turn a successful handoff into an exception.
    try { console.warn('[VCP_EMPTY_ASSISTANT_RESPONSE_DIAGNOSTIC] ' + JSON.stringify(payload)); } catch {}
  }
}

module.exports = EmptyResponseDiagnostics;
