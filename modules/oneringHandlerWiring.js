'use strict';

const {
  abortPostTurnMetadata,
  completePostTurnMetadata,
} = require('./oneringPostTurnMetadata');

function dispatchOneRingAssistantRecordCandidate(context, candidate, {
  phaseLabel = 'final_turn',
  logPrefix = '[OneRing Handler]',
  abortPostTurnOnSkip = false,
  now,
} = {}) {
  if (!candidate || candidate.shouldRecord !== true) {
    const skipped = skipCandidate(candidate);
    if (abortPostTurnOnSkip) {
      dispatchOneRingPostTurnAbort(context, skipped, { logPrefix, phaseLabel, now });
    }
    return { ...skipped, dispatched: false };
  }

  const recorder = resolveOneRingRecorder(context);
  if (!recorder) {
    return { ...candidate, dispatched: false };
  }

  const metadata = buildOneRingDispatchMetadata(context, { phaseLabel });

  Promise.resolve()
    .then(() => recorder(candidate, metadata))
    .then(recordResult => completeOneRingPostTurnAfterRecord(
      context,
      metadata,
      candidate,
      recordResult,
      { now },
    ))
    .catch(error => {
      console.error(`${logPrefix} Error recording assistant candidate (${phaseLabel}):`, error);
    });

  return { ...candidate, dispatched: true };
}

function buildOneRingDispatchMetadata(context, { phaseLabel = 'final_turn' } = {}) {
  return {
    phaseLabel,
    messages: context?.originalBody?.messages,
    postTurn: context?.oneRingPostTurn || null,
  };
}

function completeOneRingPostTurnAfterRecord(context, metadata, candidate, recordResult, { now } = {}) {
  const store = resolveOneRingPostTurnStore(context, 'completePostTurn');
  const postTurn = metadata?.postTurn;
  if (!store || !postTurn) {
    return { completed: false, reason: !store ? 'missing-post-turn-store' : 'missing-post-turn-metadata' };
  }

  if (!recordResult || recordResult.recorded === false) {
    return { completed: false, reason: recordResult?.reason || 'assistant-record-not-persisted' };
  }

  const responseMessageId = normalizePositiveInteger(recordResult.id);
  if (responseMessageId === null) {
    return { completed: false, reason: 'missing-response-message-id' };
  }

  const completed = completePostTurnMetadata(postTurn, candidate, { now });
  if (!completed.ok) {
    return { completed: false, reason: completed.reason };
  }

  const result = store.completePostTurn(completed.metadata, responseMessageId);
  return {
    completed: Boolean(result?.updated),
    reason: result?.updated ? null : result?.reason || 'post-turn-completion-skipped',
    row: result?.row || null,
  };
}

function dispatchOneRingPostTurnAbort(context, candidate, { logPrefix = '[OneRing Handler]', phaseLabel = 'final_turn', now } = {}) {
  const store = resolveOneRingPostTurnStore(context, 'abortPostTurn');
  const postTurn = context?.oneRingPostTurn;
  if (!store || !postTurn) {
    return { aborted: false, reason: !store ? 'missing-post-turn-store' : 'missing-post-turn-metadata' };
  }

  Promise.resolve()
    .then(() => {
      const aborted = abortPostTurnMetadata(postTurn, candidate?.reason || 'assistant-candidate-not-recordable', { now });
      if (!aborted.ok) {
        return { aborted: false, reason: aborted.reason };
      }
      const result = store.abortPostTurn(aborted.metadata);
      return {
        aborted: Boolean(result?.updated),
        reason: result?.updated ? null : result?.reason || 'post-turn-abort-skipped',
        row: result?.row || null,
      };
    })
    .catch(error => {
      console.error(`${logPrefix} Error aborting OneRing post-turn (${phaseLabel}):`, error);
    });

  return { aborted: true, reason: null };
}

function resolveOneRingRecorder(context) {
  const hook = context?.handleOneRingAssistantRecordCandidate || context?.onOneRingAssistantRecordCandidate;
  if (typeof hook === 'function') {
    return (candidate, metadata) => hook(candidate, metadata);
  }

  const oneRingModule = context?.pluginManager?.messagePreprocessors?.get?.('OneRing');
  if (oneRingModule && typeof oneRingModule.recordAIResponseFromMessages === 'function') {
    return (candidate, metadata) => oneRingModule.recordAIResponseFromMessages(metadata.messages, candidate.content);
  }

  return null;
}

function skipCandidate(candidate) {
  return candidate || {
    shouldRecord: false,
    role: 'assistant',
    content: '',
    reason: 'missing-assistant-record-candidate',
  };
}

function resolveOneRingPostTurnStore(context, methodName) {
  const store = context?.oneRingPostTurnStore;
  if (store && typeof store[methodName] === 'function') {
    return store;
  }
  return null;
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

module.exports = {
  buildOneRingDispatchMetadata,
  completeOneRingPostTurnAfterRecord,
  dispatchOneRingAssistantRecordCandidate,
};
