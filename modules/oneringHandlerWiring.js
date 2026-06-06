'use strict';

function dispatchOneRingAssistantRecordCandidate(context, candidate, { phaseLabel = 'final_turn', logPrefix = '[OneRing Handler]' } = {}) {
  if (!candidate || candidate.shouldRecord !== true) {
    return { ...skipCandidate(candidate), dispatched: false };
  }

  const recorder = resolveOneRingRecorder(context);
  if (!recorder) {
    return { ...candidate, dispatched: false };
  }

  const metadata = {
    phaseLabel,
    messages: context?.originalBody?.messages,
  };

  Promise.resolve()
    .then(() => recorder(candidate, metadata))
    .catch(error => {
      console.error(`${logPrefix} Error recording assistant candidate (${phaseLabel}):`, error);
    });

  return { ...candidate, dispatched: true };
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

module.exports = {
  dispatchOneRingAssistantRecordCandidate,
};
