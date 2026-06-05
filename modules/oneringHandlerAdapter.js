'use strict';

const { getVisibleMessageText } = require('./oneringParser');

const SUCCESS_OUTCOMES = new Set(['success', 'done', 'end']);

function buildAssistantRecordCandidate({ outcome = 'success', message } = {}) {
  if (!SUCCESS_OUTCOMES.has(outcome)) {
    return skip(outcome || 'not-success');
  }

  const content = getVisibleMessageText(message);
  if (!content.trim()) {
    return skip('empty-visible-content');
  }

  return {
    shouldRecord: true,
    role: 'assistant',
    content,
    reason: null,
  };
}

function buildStreamAssistantRecordCandidate(streamResult = {}) {
  const outcome = normalizeStreamOutcome(streamResult);
  return buildAssistantRecordCandidate({
    outcome,
    message: streamResult.message,
  });
}

function buildNonStreamAssistantRecordCandidate(nonStreamResult = {}) {
  const outcome = normalizeNonStreamOutcome(nonStreamResult);
  const message = nonStreamResult.message || nonStreamResult.payload?.choices?.[0]?.message;

  return buildAssistantRecordCandidate({
    outcome,
    message,
  });
}

function normalizeStreamOutcome(streamResult) {
  if (!streamResult || typeof streamResult !== 'object') {
    return 'invalid-stream-result';
  }

  if (streamResult.aborted) {
    return 'stream-aborted';
  }

  if (streamResult.idleTimeout) {
    return 'stream-idle-timeout';
  }

  if (streamResult.error) {
    return 'stream-error';
  }

  return streamResult.outcome || streamResult.status || 'missing-stream-success';
}

function normalizeNonStreamOutcome(nonStreamResult) {
  if (!nonStreamResult || typeof nonStreamResult !== 'object') {
    return 'invalid-nonstream-result';
  }

  if (nonStreamResult.ok === false) {
    return nonStreamResult.outcome || nonStreamResult.status || 'upstream-error';
  }

  if (nonStreamResult.error) {
    return nonStreamResult.outcome || nonStreamResult.status || 'upstream-error';
  }

  return nonStreamResult.outcome || nonStreamResult.status || 'success';
}

function skip(reason) {
  return {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason,
  };
}

module.exports = {
  buildAssistantRecordCandidate,
  buildStreamAssistantRecordCandidate,
  buildNonStreamAssistantRecordCandidate,
};
