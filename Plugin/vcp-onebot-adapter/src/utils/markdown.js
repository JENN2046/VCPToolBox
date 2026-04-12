/**
 * Markdown 转 OneBot 消息段转换器
 *
 * 将 Markdown 格式的文本转换为 OneBot 消息段数组
 * 支持：标题、加粗、斜体、链接、代码块、列表等
 */

/**
 * 将 Markdown 文本转换为 OneBot 消息段
 * @param {string} markdown - Markdown 文本
 * @returns {Array} 消息段数组
 */
export function parseMarkdown(markdown) {
  const segments = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 代码块处理
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        // 发送代码块
        const code = codeBlockContent.join('\n');
        if (code) {
          segments.push({
            type: 'text',
            data: { text: `\n${codeBlockLang || 'code'}:\n${code}\n` }
          });
        }
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const prefix = '★'.repeat(level);
      segments.push({
        type: 'text',
        data: { text: `\n${prefix} ${headingMatch[2]}\n` }
      });
      continue;
    }

    // 列表项
    const listMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (listMatch) {
      segments.push({
        type: 'text',
        data: { text: `• ${listMatch[1]}\n` }
      });
      continue;
    }

    // 有序列表
    const orderedListMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      segments.push({
        type: 'text',
        data: { text: `${orderedListMatch[1]}\n` }
      });
      continue;
    }

    // 引用
    if (line.startsWith('> ')) {
      segments.push({
        type: 'text',
        data: { text: `「${line.slice(1)}」\n` }
      });
      continue;
    }

    // 空行
    if (line.trim() === '') {
      segments.push({
        type: 'text',
        data: { text: '\n' }
      });
      continue;
    }

    // 普通文本（处理行内样式）
    const processedLine = processInlineStyles(line);
    segments.push({
      type: 'text',
      data: { text: processedLine + '\n' }
    });
  }

  return mergeTextSegments(segments);
}

/**
 * 处理行内样式（加粗、斜体、链接等）
 * @param {string} text - 文本
 * @returns {string} 处理后的文本
 */
function processInlineStyles(text) {
  // 处理链接 [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // 处理加粗 **text** 或 __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');

  // 处理斜率 *text* 或 _text_
  text = text.replace(/\*([^*]+)\*/g, '$1');

  // 处理行内代码 `code`
  text = text.replace(/`([^`]+)`/g, '「$1」');

  return text;
}

/**
 * 合并相邻的文本段
 * @param {Array} segments - 消息段数组
 * @returns {Array} 合并后的数组
 */
function mergeTextSegments(segments) {
  if (segments.length === 0) return segments;

  const result = [];
  let currentText = '';

  for (const segment of segments) {
    if (segment.type === 'text') {
      currentText += segment.data?.text || '';
    } else {
      if (currentText) {
        result.push({ type: 'text', data: { text: currentText } });
        currentText = '';
      }
      result.push(segment);
    }
  }

  if (currentText) {
    result.push({ type: 'text', data: { text: currentText } });
  }

  return result;
}

/**
 * 创建富文本消息（支持表情、换行等）
 * @param {Object} options - 选项
 * @param {string} options.text - 文本内容
 * @param {Array} options.images - 图片 URL 数组
 * @param {boolean} options.useEmoji - 使用表情符号
 * @returns {Array} 消息段数组
 */
export function createRichMessage({ text, images = [], useEmoji = true }) {
  const segments = [];
  const lines = [];

  // 添加文本行
  if (text) {
    lines.push(text);
  }

  // 构建消息段
  for (const line of lines) {
    segments.push({
      type: 'text',
      data: { text: line + '\n' }
    });
  }

  // 添加图片
  for (const imageUrl of images.slice(0, 5)) { // 最多 5 张
    segments.push({
      type: 'image',
      data: { file: imageUrl }
    });
  }

  return segments;
}

export default {
  parseMarkdown,
  createRichMessage,
  processInlineStyles
};
