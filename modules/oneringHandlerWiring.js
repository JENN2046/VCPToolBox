'use strict';

const {
  abortPostTurnMetadata,
  completePostTurnMetadata,
} = require('./oneringPostTurnMetadata');
const {
  readOneRingPostTurnMetadata,
} = require('./oneringPostTurnContext');

function dispatchOneRingAssistantRecordCandidate(context, candidate, {
  phaseLabel = 'final_turn',
  logPrefix = '[OneRing Handler]',
  abortPostTurnOnSkip = false,
  responseMeta = null,
  now,
} = {}) {
  if (!candidate || candidate.shouldRecord !== true) {
    const skipped = skipCandidate(candidate);
    if (abortPostTurnOnSkip) {
      const metadata = buildOneRingDispatchMetadata(context, { phaseLabel, responseMeta });
      dispatchOneRingPostTurnAbort(context, skipped, { logPrefix, phaseLabel, metadata, now });
    }
    return { ...skipped, dispatched: false };
  }

  const metadata = buildOneRingDispatchMetadata(context, { phaseLabel, responseMeta });
  const recorder = resolveOneRingRecorder(context, metadata);
  const shouldPrepareWrapperPostTurn = !metadata.postTurn && canPrepareOneRingWrapperPostTurn(context);
  if (!recorder && !shouldPrepareWrapperPostTurn) {
    return { ...candidate, dispatched: false };
  }

  Promise.resolve()
    .then(async () => {
      if (shouldPrepareWrapperPostTurn) {
        await prepareOneRingWrapperPostTurn(context, metadata);
      }

      const resolvedRecorder = shouldPrepareWrapperPostTurn
        ? resolveOneRingRecorder(context, metadata)
        : recorder || resolveOneRingRecorder(context, metadata);
      if (!resolvedRecorder) {
        return { recorded: false, reason: 'missing-onering-recorder' };
      }

      return resolvedRecorder(candidate, metadata);
    })
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

function buildOneRingDispatchMetadata(context, { phaseLabel = 'final_turn', responseMeta = null } = {}) {
  const messages = context?.originalBody?.messages;
  const sideChannel = readOneRingPostTurnMetadata(messages);
  const frozenMeta = normalizeFrozenResponseMeta(responseMeta || context?.oneRingResponseMeta);
  return {
    phaseLabel,
    messages,
    responseMeta: frozenMeta,
    postTurn: context?.oneRingPostTurn || sideChannel?.postTurn || frozenMeta?.postTurn || null,
  };
}

function completeOneRingPostTurnAfterRecord(context, metadata, candidate, recordResult, { now } = {}) {
  if (isWrapperPostTurnResult(recordResult)) {
    return {
      completed: recordResult.postTurnCompleted === true,
      reason: recordResult.postTurnReason || null,
      row: null,
    };
  }

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

function dispatchOneRingPostTurnAbort(context, candidate, {
  logPrefix = '[OneRing Handler]',
  phaseLabel = 'final_turn',
  metadata = null,
  now,
} = {}) {
  const store = resolveOneRingPostTurnStore(context, 'abortPostTurn');
  const postTurn = context?.oneRingPostTurn || metadata?.postTurn;
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

function resolveOneRingRecorder(context, metadata = null) {
  const hook = context?.handleOneRingAssistantRecordCandidate || context?.onOneRingAssistantRecordCandidate;
  if (typeof hook === 'function') {
    return (candidate, metadata) => hook(candidate, metadata);
  }

  const oneRingModule = context?.pluginManager?.messagePreprocessors?.get?.('OneRing');
  if (
    oneRingModule
    && typeof oneRingModule.recordAIResponse === 'function'
    && (metadata?.postTurn || metadata?.responseMeta)
  ) {
    return (candidate, metadata) => oneRingModule.recordAIResponse(
      buildOneRingWrapperMeta(metadata),
      candidate.content,
    );
  }

  if (oneRingModule && typeof oneRingModule.recordAIResponseFromMessages === 'function') {
    return (candidate, metadata) => oneRingModule.recordAIResponseFromMessages(metadata.messages, candidate.content);
  }

  return null;
}

function canPrepareOneRingWrapperPostTurn(context) {
  if (hasExplicitOneRingRecorderHook(context)) {
    return false;
  }

  const oneRingModule = context?.pluginManager?.messagePreprocessors?.get?.('OneRing');
  if (typeof oneRingModule?._isEffectiveEnabled === 'function' && !oneRingModule._isEffectiveEnabled()) {
    return false;
  }

  return Boolean(
    oneRingModule
    && typeof oneRingModule.preparePostTurnFromMessages === 'function'
    && typeof oneRingModule.recordAIResponse === 'function'
  );
}

async function prepareOneRingWrapperPostTurn(context, metadata) {
  if (metadata?.postTurn) {
    return metadata.postTurn;
  }

  const oneRingModule = context?.pluginManager?.messagePreprocessors?.get?.('OneRing');
  if (!oneRingModule || typeof oneRingModule.preparePostTurnFromMessages !== 'function') {
    return null;
  }

  let result = null;
  try {
    result = await oneRingModule.preparePostTurnFromMessages(metadata?.messages);
  } catch {
    return null;
  }

  if (result?.prepared === true && result.postTurn) {
    metadata.postTurn = result.postTurn;
    context.oneRingPostTurn = result.postTurn;
    return result.postTurn;
  }

  return null;
}

function hasExplicitOneRingRecorderHook(context) {
  return typeof context?.handleOneRingAssistantRecordCandidate === 'function'
    || typeof context?.onOneRingAssistantRecordCandidate === 'function';
}

function buildOneRingWrapperMeta(metadata) {
  const postTurn = metadata?.postTurn || null;
  const responseMeta = metadata?.responseMeta || {};
  return {
    ...responseMeta,
    agentName: responseMeta.agentName || postTurn?.agentName,
    frontendSource: responseMeta.frontendSource || postTurn?.frontendSource,
    postTurn,
  };
}

function isWrapperPostTurnResult(recordResult) {
  return Boolean(
    recordResult
    && typeof recordResult === 'object'
    && (
      Object.hasOwn(recordResult, 'postTurnCompleted')
      || Object.hasOwn(recordResult, 'postTurnReason')
    ),
  );
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

function normalizeFrozenResponseMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const result = {};
  for (const key of [
    'agentName',
    'frontendSource',
    'lastUserSenderName',
    'lastUserTimestamp',
    'turnId',
    'requestHash',
    'retryOfTurnId',
    'responseMessageIdToUpdate',
  ]) {
    if (meta[key] !== undefined && meta[key] !== null) {
      result[key] = meta[key];
    }
  }

  if (meta.postTurn && typeof meta.postTurn === 'object') {
    result.postTurn = meta.postTurn;
  }

  return Object.keys(result).length > 0 ? result : null;
}

module.exports = {
  buildOneRingDispatchMetadata,
  completeOneRingPostTurnAfterRecord,
  dispatchOneRingAssistantRecordCandidate,
};
