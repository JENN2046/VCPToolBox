/**
 * PromptEngineer RAG 检索模块
 *
 * 用于 AI 生图提示词的语义检索
 * 基于 KnowledgeBaseManager 和 RAGDiaryPlugin 实现
 */

const path = require('path');
const fs = require('fs').promises;

class PromptRAGRetriever {
  constructor(options = {}) {
    this.knowledgeBaseManager = options.knowledgeBaseManager;
    this.ragDiaryPlugin = options.ragDiaryPlugin;
    this.rootPath = options.rootPath || path.join(__dirname, '../../dailynote');

    // 提示词分类索引
    this.categories = {
      fashion: '服装电商',
      portrait: '人像写真',
      marketing: '营销海报',
      anime: '二次元'
    };

    // 质量词库
    this.qualityBoosters = {
      base: 'masterpiece, best quality',
      ultra: 'masterpiece, best quality, ultra-detailed, 8k, highres',
      photorealistic: 'photorealistic, professional, sharp focus',
      artistic: 'artistic, cinematic lighting, dramatic'
    };

    // 负面提示词
    this.negativePrompts = {
      general: '(worst quality, low quality, normal quality:1.7), lowres, blurry, distorted, out of focus',
      portrait: 'ugly, deformed, noisy, disfigured, bad anatomy, extra limbs, missing fingers, poorly drawn hands, poorly drawn face',
      ecommerce: 'watermark, text, signature, logo, brand name, copyright'
    };
  }

  /**
   * 获取嵌入向量
   */
  async getEmbedding(text) {
    if (!this.ragDiaryPlugin) {
      throw new Error('RAGDiaryPlugin is required for embedding');
    }
    return await this.ragDiaryPlugin.getSingleEmbeddingCached(text);
  }

  /**
   * 搜索提示词
   * @param {string} query - 查询文本
   * @param {string} category - 分类 (fashion/portrait/marketing/anime)
   * @param {number} limit - 返回数量
   * @returns {Promise<Array>} 搜索结果
   */
  async searchPrompts(query, category = 'all', limit = 5) {
    try {
      // 1. 获取查询向量
      const queryVector = await this.getEmbedding(query);
      if (!queryVector) {
        throw new Error('Failed to generate embedding for query');
      }

      // 2. 确定搜索范围
      const targets = category === 'all'
        ? ['AI 生图提示词 - 服装电商分类库']
        : [`AI 生图提示词 - ${category}`];

      // 3. 执行搜索
      const results = [];
      for (const target of targets) {
        try {
          const searchResults = await this.knowledgeBaseManager.search(
            target,
            queryVector,
            limit,
            0,
            [],
            1.33
          );
          results.push(...searchResults);
        } catch (e) {
          console.warn(`Search failed for target "${target}": ${e.message}`);
        }
      }

      // 4. 按分数排序并返回
      return results
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('[PromptRAGRetriever] searchPrompts error:', error);
      return [];
    }
  }

  /**
   * 根据关键词检索相关提示词模板
   */
  async retrieveByKeywords(keywords) {
    const {
      clothingType,    // 服装类型
      scene,           // 场景
      style,           // 风格
      lighting,        // 光影
      composition      // 构图
    } = keywords;

    const queries = [];
    if (clothingType) queries.push(`${clothingType} fashion model wearing`);
    if (scene) queries.push(`${scene} background`);
    if (style) queries.push(`${style} style`);
    if (lighting) queries.push(`${lighting} lighting`);
    if (composition) queries.push(`${composition}`);

    const query = queries.join(', ');
    return await this.searchPrompts(query, 'fashion', 10);
  }

  /**
   * 组合提示词
   */
  composePrompt(components) {
    const parts = [];

    // 主体描述
    if (components.subject) {
      parts.push(components.subject);
    }

    // 服装类型
    if (components.clothing) {
      parts.push(components.clothing);
    }

    // 场景
    if (components.scene) {
      parts.push(components.scene);
    }

    // 光影
    if (components.lighting) {
      parts.push(components.lighting);
    }

    // 构图
    if (components.composition) {
      parts.push(components.composition);
    }

    // 质量词
    const quality = components.quality || 'base';
    if (this.qualityBoosters[quality]) {
      parts.push(this.qualityBoosters[quality]);
    }

    return parts.join(', ');
  }

  /**
   * 生成负面提示词
   */
  getNegativePrompt(type = 'general') {
    return this.negativePrompts[type] || this.negativePrompts.general;
  }

  /**
   * 从样本库检索并组合提示词
   */
  async retrieveAndCompose(userRequest) {
    const {
      clothing,      // 服装类型
      scene,         // 场景
      style,         // 风格
      lighting,      // 光影
      composition,   // 构图
      quality        // 质量等级
    } = userRequest;

    // 构建查询
    const searchQuery = [
      clothing,
      scene,
      style,
      'fashion photography'
    ].filter(Boolean).join(' ');

    // 检索相似样本
    const similarPrompts = await this.searchPrompts(searchQuery, 'fashion', 5);

    // 提取最佳匹配
    const bestMatch = similarPrompts.length > 0
      ? similarPrompts[0].text || similarPrompts[0].content
      : '';

    // 组合最终提示词
    const composedPrompt = this.composePrompt({
      subject: clothing ? `professional model wearing ${clothing}` : 'professional model',
      scene: scene || '',
      lighting: lighting || 'studio lighting',
      composition: composition || 'full body shot',
      quality: quality || 'ultra'
    });

    return {
      prompt: composedPrompt,
      negative_prompt: this.getNegativePrompt('ecommerce'),
      similar_samples: similarPrompts,
      reference: bestMatch
    };
  }

  /**
   * 分类检索 - 服装类型
   */
  async searchByClothingType(clothingType) {
    const typeMap = {
      '连衣裙': 'dress elegant feminine',
      '衬衫': 'blouse shirt professional',
      '外套': 'jacket coat blazer',
      '裤装': 'pants jeans trousers',
      '运动装': 'sportswear athletic gym',
      '泳装': 'swimsuit bikini beach'
    };

    const query = typeMap[clothingType] || clothingType;
    return await this.searchPrompts(query, 'fashion', 10);
  }

  /**
   * 分类检索 - 场景
   */
  async searchByScene(scene) {
    const sceneMap = {
      '纯色': 'solid color studio white background',
      '街头': 'street urban city',
      '咖啡厅': 'cafe coffee shop indoor',
      '办公室': 'office workplace corporate',
      '户外': 'nature park garden outdoor',
      '海滩': 'beach ocean sunset tropical'
    };

    const query = sceneMap[scene] || scene;
    return await this.searchPrompts(query, 'fashion', 10);
  }

  /**
   * 生成完整工作流提示词
   */
  async generateWorkflowPrompt(userInput) {
    const {
      clothing_type,      // 服装类型
      clothing_color,     // 颜色
      scene_type,         // 场景类型
      model_type,         // 模特类型
      output_format       // 输出格式 (ecommerce/portrait/artistic)
    } = userInput;

    // 1. 检索相似样本
    const searchQuery = `${clothing_type} ${scene_type} ${model_type}`;
    const similarPrompts = await this.searchPrompts(searchQuery, 'fashion', 3);

    // 2. 组合提示词
    const prompt = this.composePrompt({
      subject: model_type ? `${model_type} model` : 'professional model',
      clothing: clothing_type ? `wearing ${clothing_type}, ${clothing_color || ''} color` : '',
      scene: scene_type || 'studio',
      lighting: 'professional studio lighting',
      composition: 'full body shot, fashion photography',
      quality: 'ultra'
    });

    // 3. 生成负面提示词
    const negativePrompt = this.getNegativePrompt('ecommerce');

    return {
      prompt,
      negative_prompt: negativePrompt,
      similar_samples: similarPrompts,
      workflow_type: output_format || 'ecommerce'
    };
  }
}

module.exports = PromptRAGRetriever;
