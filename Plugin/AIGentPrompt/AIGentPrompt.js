/**
 * AIGentPrompt - AI 生图提示词工程师 Agent
 *
 * 职责:
 * 1. 理解用户自然语言需求
 * 2. 从 RAG 知识库检索相似提示词
 * 3. 组合生成专业提示词
 * 4. 适配不同模型语法 (Flux/SDXL/MJ)
 */

const path = require('path');
const PromptRAGRetriever = require('./rag_retriever.js');

class AIGentPrompt {
  constructor(options = {}) {
    this.name = 'AIGentPrompt';
    this.description = 'AI 生图提示词工程师 - 生成专业级图像生成提示词';

    // 依赖注入
    this.knowledgeBaseManager = options.knowledgeBaseManager;
    this.ragDiaryPlugin = options.ragDiaryPlugin;

    // RAG 检索器
    this.retriever = new PromptRAGRetriever({
      knowledgeBaseManager: this.knowledgeBaseManager,
      ragDiaryPlugin: this.ragDiaryPlugin
    });

    // 模型语法适配
    this.modelSyntax = {
      flux: {
        name: 'Flux.1',
        qualityFormat: ', {quality}',
        negativeSupport: false  // Flux 不支持负面提示词
      },
      sdxl: {
        name: 'SDXL',
        qualityFormat: ', {quality}',
        negativeSupport: true
      },
      midjourney: {
        name: 'Midjourney',
        qualityFormat: ' --style raw --q {quality}',
        negativeSupport: true,
        negativeFormat: ' --no {negative}'
      }
    };

    // 质量词映射
    this.qualityMap = {
      base: 'masterpiece, best quality',
      ultra: 'masterpiece, best quality, ultra-detailed, 8k, highres, sharp focus',
      photorealistic: 'photorealistic, professional, sharp focus, 8k',
      artistic: 'artistic, cinematic lighting, dramatic, masterpiece'
    };
  }

  /**
   * 初始化
   */
  async initialize() {
    console.log('[AIGentPrompt] Initializing...');

    if (!this.knowledgeBaseManager) {
      console.warn('[AIGentPrompt] Warning: knowledgeBaseManager not provided');
    }
    if (!this.ragDiaryPlugin) {
      console.warn('[AIGentPrompt] Warning: ragDiaryPlugin not provided');
    }

    return true;
  }

  /**
   * 处理用户请求 - 生成提示词
   * @param {string} userInput - 用户自然语言输入
   * @param {object} context - 上下文信息
   * @returns {Promise<object>} 生成的提示词结果
   */
  async generatePrompt(userInput, context = {}) {
    try {
      // 1. 意图识别
      const intent = await this.identifyIntent(userInput);
      console.log('[AIGentPrompt] Identified intent:', intent);

      // 2. 从 RAG 检索相似提示词
      let similarPrompts = [];
      if (this.knowledgeBaseManager && this.ragDiaryPlugin) {
        similarPrompts = await this.retriever.searchPrompts(
          userInput,
          intent.category,
          5
        );
      }

      // 3. 组合提示词
      const composedPrompt = this.composePrompt(userInput, intent, similarPrompts);

      // 4. 适配模型语法
      const modelType = context.modelType || 'flux';
      const adaptedPrompt = this.adaptToModel(composedPrompt, modelType);

      // 5. 生成负面提示词
      const negativePrompt = this.generateNegativePrompt(intent);

      return {
        success: true,
        prompt: adaptedPrompt,
        negative_prompt: negativePrompt,
        intent: intent,
        similar_prompts: similarPrompts,
        model_type: modelType
      };
    } catch (error) {
      console.error('[AIGentPrompt] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 识别用户意图
   */
  async identifyIntent(userInput) {
    const lowerInput = userInput.toLowerCase();
    const intent = {
      category: 'fashion',  // fashion, portrait, marketing, anime
      subCategory: '',      // dress, shirt, jacket, etc.
      style: 'commercial',  // commercial, artistic, casual
      confidence: 0
    };

    // 服装电商关键词
    const fashionKeywords = ['服装', '衣服', '女装', '男装', '童装', 'dress', 'shirt', 'jacket', 'coat', 'fashion', 'model', '模特', '电商'];
    // 人像关键词
    const portraitKeywords = ['人像', '写真', '头像', 'portrait', 'headshot', 'photo'];
    // 营销关键词
    const marketingKeywords = ['海报', '促销', '营销', 'banner', 'promotion', 'marketing'];
    // 二次元关键词
    const animeKeywords = ['动漫', '二次元', 'anime', 'manga', 'game', '游戏'];

    // 分类判断
    let matchCount = 0;

    if (fashionKeywords.some(kw => lowerInput.includes(kw))) {
      intent.category = 'fashion';
      matchCount++;

      // 子分类
      if (lowerInput.includes('连衣裙') || lowerInput.includes('dress')) {
        intent.subCategory = 'dress';
      } else if (lowerInput.includes('衬衫') || lowerInput.includes('blouse') || lowerInput.includes('shirt')) {
        intent.subCategory = 'shirt';
      } else if (lowerInput.includes('外套') || lowerInput.includes('jacket') || lowerInput.includes('coat')) {
        intent.subCategory = 'jacket';
      } else if (lowerInput.includes('裤') || lowerInput.includes('pants') || lowerInput.includes('jeans')) {
        intent.subCategory = 'pants';
      }
    }

    if (portraitKeywords.some(kw => lowerInput.includes(kw))) {
      intent.category = 'portrait';
      matchCount++;
    }

    if (marketingKeywords.some(kw => lowerInput.includes(kw))) {
      intent.category = 'marketing';
      matchCount++;
    }

    if (animeKeywords.some(kw => lowerInput.includes(kw))) {
      intent.category = 'anime';
      matchCount++;
    }

    // 风格判断
    if (lowerInput.includes('清新') || lowerInput.includes('natural')) {
      intent.style = 'natural';
    } else if (lowerInput.includes('职业') || lowerInput.includes('business') || lowerInput.includes('professional')) {
      intent.style = 'professional';
    } else if (lowerInput.includes('艺术') || lowerInput.includes('artistic')) {
      intent.style = 'artistic';
    }

    intent.confidence = matchCount > 0 ? 0.8 : 0.5;
    return intent;
  }

  /**
   * 组合提示词
   */
  composePrompt(userInput, intent, similarPrompts) {
    const parts = [];

    // 如果有相似样本，优先使用
    if (similarPrompts.length > 0 && similarPrompts[0].text) {
      // 从相似样本提取基础
      const basePrompt = similarPrompts[0].text || similarPrompts[0].content;
      parts.push(basePrompt);
    } else {
      // 构建基础提示词
      if (intent.category === 'fashion') {
        parts.push('professional model');

        if (intent.subCategory) {
          parts.push(`wearing ${intent.subCategory}`);
        }

        parts.push('studio lighting, clean background');
        parts.push('fashion photography, commercial grade');
      } else if (intent.category === 'portrait') {
        parts.push('portrait photography');
        parts.push('natural lighting, detailed facial features');
      } else if (intent.category === 'marketing') {
        parts.push('commercial design, professional');
      } else if (intent.category === 'anime') {
        parts.push('anime style, detailed');
      }
    }

    // 添加质量词
    parts.push(this.qualityMap.ultra);

    return parts.join(', ');
  }

  /**
   * 生成负面提示词
   */
  generateNegativePrompt(intent) {
    if (intent.category === 'fashion') {
      return '(worst quality, low quality, normal quality:1.7), watermark, text, signature, logo, deformed, bad anatomy';
    } else if (intent.category === 'portrait') {
      return '(worst quality, low quality:1.4), ugly, deformed, noisy, blurry, bad anatomy, extra limbs, poorly drawn face';
    } else if (intent.category === 'anime') {
      return '(worst quality, low quality:1.4), deformed, mutated, extra limbs';
    }
    return '(worst quality, low quality, normal quality:1.7), lowres, blurry, distorted';
  }

  /**
   * 适配模型语法
   */
  adaptToModel(prompt, modelType = 'flux') {
    const syntax = this.modelSyntax[modelType] || this.modelSyntax.flux;

    // 质量词替换
    if (syntax.qualityFormat.includes('{quality}')) {
      const quality = this.qualityMap.base;
      prompt = prompt.replace('{quality}', quality);
    }

    return prompt;
  }

  /**
   * 获取分类词库
   */
  async getCategoryPrompts(category) {
    // 从 RAG 检索该分类下的所有提示词
    return await this.retriever.searchPrompts(category, category, 50);
  }
}

module.exports = AIGentPrompt;
