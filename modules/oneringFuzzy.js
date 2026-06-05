'use strict';

const {
  classifySenderSource,
  getVisibleMessageText,
  stripOneRingTailMarkers,
} = require('./oneringParser');

const SYSTEM_NOTICE_REGEX = /\[系统通知\][\s\S]*?\[系统通知结束\]/g;

function normalizeComparableText(input) {
  if (typeof input !== 'string') {
    return '';
  }

  const withoutSystemNotice = input.replace(SYSTEM_NOTICE_REGEX, '');
  const withoutTailMarkers = stripOneRingTailMarkers(withoutSystemNotice).text;
  const withoutGroupHeader = classifySenderSource(withoutTailMarkers).text;

  return withoutGroupHeader.replace(/\s+/g, ' ').trim();
}

function levenshteinDistance(leftInput, rightInput) {
  const left = typeof leftInput === 'string' ? leftInput : '';
  const right = typeof rightInput === 'string' ? rightInput : '';

  if (left === right) {
    return 0;
  }

  const leftLength = left.length;
  const rightLength = right.length;
  if (leftLength === 0) {
    return rightLength;
  }
  if (rightLength === 0) {
    return leftLength;
  }

  let previous = new Array(rightLength + 1);
  let current = new Array(rightLength + 1);

  for (let column = 0; column <= rightLength; column++) {
    previous[column] = column;
  }

  for (let row = 1; row <= leftLength; row++) {
    current[0] = row;
    const leftCode = left.charCodeAt(row - 1);

    for (let column = 1; column <= rightLength; column++) {
      const substitutionCost = leftCode === right.charCodeAt(column - 1) ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    [previous, current] = [current, previous];
  }

  return previous[rightLength];
}

function calculateTextSimilarity(leftInput, rightInput) {
  const left = normalizeComparableText(leftInput);
  const right = normalizeComparableText(rightInput);

  if (left === right) {
    return 1;
  }

  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }

  const lengthRatio = Math.min(left.length, right.length) / maxLength;
  if (lengthRatio < 0.5) {
    return lengthRatio;
  }

  return 1 - levenshteinDistance(left, right) / maxLength;
}

function extractComparableText(messageOrContent) {
  return normalizeComparableText(getVisibleMessageText(messageOrContent));
}

function diffContextBlocks(postBlocks, storedBlocks, options = {}) {
  const threshold = normalizeThreshold(options.threshold, 0.92);
  const editFloor = normalizeThreshold(options.editFloor, Math.max(0.55, threshold - 0.25));
  const normalizedPostBlocks = normalizeBlocks(postBlocks, 'text');
  const normalizedStoredBlocks = normalizeBlocks(storedBlocks, 'content');

  const result = {
    matchedCount: 0,
    unknownCount: 0,
    editedBlocks: [],
    newBlocks: [],
    reliable: true,
    matchStartIndex: null,
  };

  if (normalizedPostBlocks.length === 0) {
    return result;
  }

  if (normalizedStoredBlocks.length === 0) {
    result.newBlocks = normalizedPostBlocks.map((block, index) => ({
      ...block.original,
      role: block.role,
      text: block.text,
      postIndex: index,
    }));
    return result;
  }

  const bestStart = findBestStoredWindow(normalizedPostBlocks, normalizedStoredBlocks);
  result.matchStartIndex = bestStart;

  let storedIndex = bestStart;
  for (let postIndex = 0; postIndex < normalizedPostBlocks.length; postIndex++) {
    const postBlock = normalizedPostBlocks[postIndex];
    const storedBlock = normalizedStoredBlocks[storedIndex];

    if (!storedBlock) {
      result.newBlocks.push({
        ...postBlock.original,
        role: postBlock.role,
        text: postBlock.text,
        postIndex,
      });
      continue;
    }

    if (storedBlock.role !== postBlock.role) {
      result.unknownCount++;
      result.reliable = false;
      storedIndex++;
      continue;
    }

    const similarity = calculateTextSimilarity(postBlock.text, storedBlock.text);
    if (similarity >= threshold) {
      result.matchedCount++;
    } else if (similarity >= editFloor) {
      result.editedBlocks.push({
        postIndex,
        dbId: storedBlock.id,
        oldContent: storedBlock.rawText,
        newText: postBlock.rawText,
        similarity,
      });
    } else {
      result.unknownCount++;
      result.reliable = false;
    }

    storedIndex++;
  }

  return result;
}

function findBestStoredWindow(postBlocks, storedBlocks) {
  let bestStart = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let start = 0; start < storedBlocks.length; start++) {
    let score = 0;

    for (let postIndex = 0; postIndex < postBlocks.length; postIndex++) {
      const postBlock = postBlocks[postIndex];
      const storedBlock = storedBlocks[start + postIndex];

      if (!storedBlock) {
        score -= 0.25;
        continue;
      }

      if (postBlock.role !== storedBlock.role) {
        score -= 1;
        continue;
      }

      score += calculateTextSimilarity(postBlock.text, storedBlock.text);
    }

    if (score >= bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return bestStart;
}

function normalizeBlocks(blocks, textField) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .filter((block) => block && typeof block === 'object')
    .map((block) => {
      const textCandidate = getBlockTextCandidate(block, textField);
      const rawText = typeof textCandidate === 'string'
        ? textCandidate
        : getVisibleMessageText(textCandidate);

      return {
        id: block.id,
        role: typeof block.role === 'string' ? block.role : '',
        rawText,
        text: normalizeComparableText(rawText),
        original: block,
      };
    });
}

function getBlockTextCandidate(block, preferredField) {
  if (Object.prototype.hasOwnProperty.call(block, preferredField)) {
    return block[preferredField];
  }

  return preferredField === 'text' ? block.content : block.text;
}

function normalizeThreshold(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

module.exports = {
  SYSTEM_NOTICE_REGEX,
  normalizeComparableText,
  levenshteinDistance,
  calculateTextSimilarity,
  extractComparableText,
  diffContextBlocks,
};
